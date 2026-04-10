"""
TravelMemo recommendation and discovery service.
"""

import base64
import json
import math
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List, Optional

import redis.asyncio as aioredis
from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from models.database import Memory
from models.travel_models import PlaceCatalog, PlacePromotion, PublicMemory, UserTravelPreference
from models.travel_schemas import PlaceCluster, PublicMemoryCard, TravelProfileResponse
from services.storage_service import storage_service

# ---------------------------------------------------------------------------
# Redis feed cache
# ---------------------------------------------------------------------------
_redis_pool: Optional[aioredis.Redis] = None


async def _get_redis() -> Optional[aioredis.Redis]:
    """Return a shared async Redis client, or None if unavailable."""
    global _redis_pool
    if _redis_pool is None:
        try:
            _redis_pool = aioredis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=1,
            )
        except Exception:
            return None
    return _redis_pool


# Feed cache TTL seconds.
_FEED_CACHE_TTL = 300  # 5 minutes
_PROMO_QUALITY_MIN_MEMORIES = 5  # Stage D quality gate threshold


@dataclass
class FeedCandidate:
    place: PlaceCatalog
    latest_memory_date: datetime
    preview: Optional[PublicMemory]
    score: float
    why_this: str
    distance_km: float


class TravelService:
    def __init__(self):
        self.feed_cache = {}

    @staticmethod
    def _encode_cursor(offset: int) -> str:
        payload = json.dumps({"offset": offset}).encode("utf-8")
        return base64.urlsafe_b64encode(payload).decode("utf-8")

    @staticmethod
    def _decode_cursor(cursor: Optional[str]) -> int:
        if not cursor:
            return 0
        try:
            payload = json.loads(base64.urlsafe_b64decode(cursor.encode("utf-8")).decode("utf-8"))
            return max(int(payload.get("offset", 0)), 0)
        except Exception:
            return 0

    @staticmethod
    def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        radius_km = 6371.0
        d_lat = math.radians(lat2 - lat1)
        d_lon = math.radians(lon2 - lon1)
        a = (
            math.sin(d_lat / 2) ** 2
            + math.cos(math.radians(lat1))
            * math.cos(math.radians(lat2))
            * math.sin(d_lon / 2) ** 2
        )
        return radius_km * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    def _build_public_card(self, item: PublicMemory, why_this: Optional[str] = None, distance_km: Optional[float] = None, context_badge: Optional[str] = None) -> PublicMemoryCard:
        photo_url = storage_service.get_presigned_url(
            item.public_photo_url,
            storage_service.thumbnails_bucket,
        )
        return PublicMemoryCard(
            id=item.id,
            place_id=item.place_id,
            place_name=item.place_name,
            place_city=item.place_city,
            place_country=item.place_country,
            public_photo_url=photo_url,
            public_description=item.public_description,
            emotion_label=item.emotion_label,
            sentiment_score=item.sentiment_score,
            why_this=why_this,
            distance_km=distance_km,
            context_badge=context_badge,
            visit_month=item.visit_month,
            visit_year=item.visit_year,
            moderation_status=item.moderation_status,
            visibility_status=item.visibility_status,
            created_at=item.created_at,
        )

    def _why_this(self, place: PlaceCatalog, prefs: UserTravelPreference, distance_km: float) -> str:
        place_types = place.types or []
        preferred_types = prefs.preferred_types or []
        profile_vector = prefs.profile_vector or {}

        matching_type = next((place_type for place_type in place_types if place_type in preferred_types), None)
        if matching_type:
            return f"Coincide con tu interes por {matching_type}"

        strongest = None
        strongest_value = 0.0
        for place_type in place_types:
            value = float(profile_vector.get(place_type, 0.0))
            if value > strongest_value:
                strongest = place_type
                strongest_value = value
        if strongest:
            return f"Similar a tus visitas de {strongest}"

        if distance_km <= 3:
            return "Popular cerca de ti"
        if distance_km <= 10:
            return "Buen descubrimiento en tu zona"
        return "Lugar con memorias recientes"

    async def _context_badge(self, db: AsyncSession, item: PublicMemory) -> str | None:
        count_same_place = await db.scalar(
            select(func.count(PublicMemory.id)).where(
                and_(
                    PublicMemory.user_id == item.user_id,
                    PublicMemory.place_id == item.place_id,
                    PublicMemory.visibility_status == "active",
                    PublicMemory.moderation_status == "approved",
                )
            )
        )
        if (count_same_place or 0) >= 3:
            return "Local insight"
        if (count_same_place or 0) == 2:
            return "Repeated visits"
        return "Traveler passing through"

    async def get_or_create_preferences(self, db: AsyncSession, user_id):
        result = await db.execute(
            select(UserTravelPreference).where(UserTravelPreference.user_id == user_id)
        )
        prefs = result.scalar_one_or_none()
        if prefs:
            return prefs

        prefs = UserTravelPreference(user_id=user_id)
        db.add(prefs)
        await db.commit()
        await db.refresh(prefs)
        return prefs

    @staticmethod
    def _promotion_quality_gate(place: PlaceCatalog) -> bool:
        """
        Stage D quality gate.
        A place can only receive a promotion boost when it has enough
        organic approved memories (avoids buying visibility for empty places).
        """
        return (place.memory_count or 0) >= _PROMO_QUALITY_MIN_MEMORIES

    def _score_place(
        self,
        place: PlaceCatalog,
        latest_memory_date: datetime,
        prefs: UserTravelPreference,
        user_lat: float,
        user_lng: float,
    ) -> float:
        distance_km = self._haversine_km(user_lat, user_lng, place.lat, place.lng)
        geo = 1.0 / (1.0 + distance_km / 5.0)

        place_types = place.types or []
        profile_vector = prefs.profile_vector or {}
        preferred_types = prefs.preferred_types or []
        if profile_vector:
            affinity = sum(float(profile_vector.get(place_type, 0.0)) for place_type in place_types) / max(len(place_types), 1)
        else:
            affinity = 1.0 if any(place_type in preferred_types for place_type in place_types) else 0.2

        quality = min((place.memory_count or 0) / 10.0, 1.0) * float(place.avg_sentiment or 0.5)

        now = datetime.now(timezone.utc)
        latest = latest_memory_date if latest_memory_date.tzinfo else latest_memory_date.replace(tzinfo=timezone.utc)
        days_since = max((now - latest).days, 0)
        recency = math.exp(-days_since / 120.0)

        # Stage D promotion boost hook.
        # boost_weight is 0.0 until a promotion is activated — no behaviour change now.
        promo = float(place.boost_weight or 0.0) if self._promotion_quality_gate(place) else 0.0

        # Weights sum to 1.0 + promo (promo is additive, capped at 0.15 by DB constraint).
        return 0.35 * geo + 0.30 * affinity + 0.20 * quality + 0.15 * recency + promo

    async def _get_active_promotion_boost(self, db: AsyncSession, place_id: str) -> float:
        """
        Stage D — returns the current boost_weight for a place if it has an active
        promotion. Returns 0.0 until promotions go live.
        The feed ranking already reads place.boost_weight (written by an activation job);
        this helper is the programmatic entrypoint for future use.
        """
        now = datetime.now(timezone.utc)
        result = await db.execute(
            select(PlacePromotion.boost_weight)
            .where(
                and_(
                    PlacePromotion.place_id == place_id,
                    PlacePromotion.status == "active",
                    (PlacePromotion.starts_at == None) | (PlacePromotion.starts_at <= now),  # noqa: E711
                    (PlacePromotion.ends_at == None) | (PlacePromotion.ends_at >= now),  # noqa: E711
                )
            )
            .order_by(desc(PlacePromotion.boost_weight))
            .limit(1)
        )
        row = result.scalar_one_or_none()
        return float(row) if row is not None else 0.0

    async def generate_feed(self, db: AsyncSession, user_id, lat: float, lng: float, cursor: Optional[str], type_filter: Optional[str], limit: int = 20):
        prefs = await self.get_or_create_preferences(db, user_id)
        offset = self._decode_cursor(cursor)

        # Stage D: Redis feed cache (key scoped to user + rounded location + filter)
        lat_r = round(lat, 1)
        lng_r = round(lng, 1)
        cache_key = f"travel:feed:{user_id}:{lat_r}:{lng_r}:{type_filter or ''}:{offset}:{limit}"
        redis = await _get_redis()
        if redis and offset == 0:  # only cache first page
            cached = await redis.get(cache_key)
            if cached:
                try:
                    data = json.loads(cached)
                    items = [PublicMemoryCard.model_validate(item) for item in data["items"]]
                    return items, data.get("next_cursor")
                except Exception:
                    pass  # stale/corrupt cache — fall through to DB

        candidates_result = await db.execute(
            select(PlaceCatalog)
            .order_by(desc(PlaceCatalog.memory_count), desc(PlaceCatalog.last_enriched_at))
            .limit(250)
        )
        places = candidates_result.scalars().all()

        filtered_places = []
        for place in places:
            if type_filter and type_filter not in (place.types or []):
                continue
            if self._haversine_km(lat, lng, place.lat, place.lng) <= 50:
                filtered_places.append(place)

        feed_candidates: List[FeedCandidate] = []
        for place in filtered_places:
            preview_result = await db.execute(
                select(PublicMemory)
                .where(
                    and_(
                        PublicMemory.place_id == place.place_id,
                        PublicMemory.visibility_status == "active",
                        PublicMemory.moderation_status == "approved",
                    )
                )
                .order_by(desc(PublicMemory.created_at))
                .limit(1)
            )
            preview = preview_result.scalar_one_or_none()
            if not preview:
                continue

            latest_date = preview.created_at
            distance_km = self._haversine_km(lat, lng, place.lat, place.lng)
            score = self._score_place(place, latest_date, prefs, lat, lng)
            feed_candidates.append(
                FeedCandidate(
                    place=place,
                    latest_memory_date=latest_date,
                    preview=preview,
                    score=score,
                    why_this=self._why_this(place, prefs, distance_km),
                    distance_km=distance_km,
                )
            )

        feed_candidates.sort(key=lambda item: (item.score, item.latest_memory_date), reverse=True)
        page_candidates = feed_candidates[offset: offset + limit]
        next_cursor = None
        if offset + limit < len(feed_candidates):
            next_cursor = self._encode_cursor(offset + limit)

        items = [
            self._build_public_card(
                candidate.preview,
                why_this=candidate.why_this,
                distance_km=round(candidate.distance_km, 1),
                context_badge=await self._context_badge(db, candidate.preview),
            )
            for candidate in page_candidates
            if candidate.preview
        ]

        # Write to Redis cache (first page only; best-effort)
        if redis and offset == 0:
            try:
                payload = json.dumps({
                    "items": [item.model_dump(mode="json") for item in items],
                    "next_cursor": next_cursor,
                })
                await redis.setex(cache_key, _FEED_CACHE_TTL, payload)
            except Exception:
                pass

        return items, next_cursor

    async def get_map_clusters(self, db: AsyncSession, lat: float, lng: float, radius_km: float = 10):
        result = await db.execute(
            select(PlaceCatalog)
            .order_by(desc(PlaceCatalog.memory_count), desc(PlaceCatalog.last_enriched_at))
            .limit(250)
        )
        places = result.scalars().all()

        clusters = []
        for place in places:
            if self._haversine_km(lat, lng, place.lat, place.lng) > radius_km:
                continue

            preview_result = await db.execute(
                select(PublicMemory)
                .where(
                    and_(
                        PublicMemory.place_id == place.place_id,
                        PublicMemory.visibility_status == "active",
                        PublicMemory.moderation_status == "approved",
                    )
                )
                .order_by(desc(PublicMemory.created_at))
                .limit(1)
            )
            preview = preview_result.scalar_one_or_none()
            distance_km = self._haversine_km(lat, lng, place.lat, place.lng)
            clusters.append(
                PlaceCluster(
                    place_id=place.place_id,
                    place_name=place.name,
                    latitude=place.lat,
                    longitude=place.lng,
                    memory_count=place.memory_count or 0,
                    preview=self._build_public_card(
                        preview,
                        distance_km=round(distance_km, 1),
                        context_badge=await self._context_badge(db, preview),
                    ) if preview else None,
                )
            )

        return clusters

    async def update_place_stats(self, db):
        places_result = await db.execute(select(PlaceCatalog))
        places = places_result.scalars().all()
        for place in places:
            stats_result = await db.execute(
                select(
                    func.count(PublicMemory.id),
                    func.avg(PublicMemory.sentiment_score),
                ).where(
                    and_(
                        PublicMemory.place_id == place.place_id,
                        PublicMemory.visibility_status == "active",
                        PublicMemory.moderation_status == "approved",
                    )
                )
            )
            count_value, avg_sentiment = stats_result.one()
            place.memory_count = int(count_value or 0)
            place.avg_sentiment = float(avg_sentiment or 0.5)

        await db.commit()

    async def update_user_profile(self, db: AsyncSession, user_id):
        prefs = await self.get_or_create_preferences(db, user_id)
        memories_result = await db.execute(
            select(Memory).where(Memory.user_id == user_id)
        )
        memories = memories_result.scalars().all()

        counts = {}
        for memory in memories:
            nlp = (memory.ai_metadata or {}).get("nlp", {})
            for topic in (nlp.get("topics") or []):
                counts[topic] = counts.get(topic, 0) + 1

        if counts:
            max_value = max(counts.values())
            prefs.profile_vector = {
                key: round(value / max_value, 4)
                for key, value in counts.items()
            }
        else:
            prefs.profile_vector = {}

        prefs.last_computed_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(prefs)
        return prefs

    async def build_profile(self, db: AsyncSession, user_id) -> TravelProfileResponse:
        prefs = await self.get_or_create_preferences(db, user_id)
        items_result = await db.execute(
            select(PublicMemory)
            .where(PublicMemory.user_id == user_id)
            .order_by(desc(PublicMemory.created_at))
            .limit(50)
        )
        items = items_result.scalars().all()

        places_count = await db.scalar(
            select(func.count(func.distinct(PublicMemory.place_id))).where(PublicMemory.user_id == user_id)
        )
        shared_memories_count = await db.scalar(
            select(func.count(PublicMemory.id)).where(PublicMemory.user_id == user_id)
        )

        top_types = sorted(
            (prefs.profile_vector or {}).items(),
            key=lambda item: item[1],
            reverse=True,
        )[:5]

        cards = [
            self._build_public_card(item, context_badge=await self._context_badge(db, item))
            for item in items
        ]

        return TravelProfileResponse(
            shared_memories_count=int(shared_memories_count or 0),
            places_count=int(places_count or 0),
            top_types=[name for name, _ in top_types],
            preferred_types=prefs.preferred_types or [],
            items=cards,
        )


travel_service = TravelService()
