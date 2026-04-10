"""
TravelMemo endpoints (Stage A foundation).
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import Point
from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.deps import get_current_user
from core.limiter import limiter
from models.database import Memory, User
from models.travel_models import PlaceCatalog, PublicMemory, RecommendationEvent, SavedPlace
from models.travel_schemas import (
    FeedResponse,
    MapClustersResponse,
    MessageResponse,
    MyPublicMemoriesResponse,
    PlaceDetailResponse,
    PlaceMemoriesResponse,
    PromotionsResponse,
    PublicMemoryCard,
    ReportRequest,
    SavePlaceResponse,
    SavedPlaceItem,
    SavedPlacesResponse,
    ShareMemoryResponse,
    TravelEventRequest,
    TravelProfileResponse,
    TravelPreferencesRequest,
    TravelPreferencesResponse,
    UnshareMemoryResponse,
)
from services.travel_service import travel_service
from services.storage_service import storage_service
from tasks.travel_moderation import moderate_travel_post


router = APIRouter(prefix="/travel", tags=["travel"])


def _derive_place_id(memory: Memory, lat: float, lng: float) -> str:
    """Build a deterministic fallback place_id when Google place_id is unavailable."""
    md = memory.ai_metadata or {}
    place_id = md.get("place_id") or ((md.get("location") or {}).get("place_id") if isinstance(md.get("location"), dict) else None)
    if place_id:
        return str(place_id)

    name = (memory.location_name or "unknown").strip().lower().replace(" ", "-")
    return f"legacy:{name}:{lat:.4f}:{lng:.4f}"


def _build_public_card(item: PublicMemory) -> PublicMemoryCard:
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
        visit_month=item.visit_month,
        visit_year=item.visit_year,
        moderation_status=item.moderation_status,
        visibility_status=item.visibility_status,
        created_at=item.created_at,
    )


def _normalize_place_name(place_id: str) -> str:
    cleaned = place_id.replace("legacy:", "").split(":")[0].replace("-", " ").strip()
    return cleaned.title() if cleaned else "Lugar"


@router.post(
    "/share/{memory_id}",
    response_model=ShareMemoryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Share a private memory to TravelMemo",
)
@limiter.limit("10/minute")
async def share_memory(
    request: Request,
    memory_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = request
    memory_result = await db.execute(
        select(Memory).where(
            and_(
                Memory.id == memory_id,
                Memory.user_id == current_user.id,
            )
        )
    )
    memory = memory_result.scalar_one_or_none()
    if not memory:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found")

    point = to_shape(memory.coordinates)
    lat = point.y
    lng = point.x
    place_id = _derive_place_id(memory, lat, lng)

    existing_result = await db.execute(
        select(PublicMemory).where(PublicMemory.source_memory_id == memory.id)
    )
    existing = existing_result.scalar_one_or_none()
    if existing and existing.visibility_status != "hard_deleted":
        existing.visibility_status = "pending"
        existing.moderation_status = "pending"
        existing.moderation_reason = None
        memory.travel_shared = True
        await db.commit()
        moderate_travel_post.delay(str(existing.id))
        return ShareMemoryResponse(public_memory_id=existing.id, status="pending_moderation")

    nlp = (memory.ai_metadata or {}).get("nlp", {})
    visit_date = memory.memory_date or memory.created_at

    item = PublicMemory(
        id=uuid.uuid4(),
        source_memory_id=memory.id,
        user_id=current_user.id,
        place_id=place_id,
        place_name=memory.location_name,
        place_city=(memory.ai_metadata or {}).get("city"),
        place_country=(memory.ai_metadata or {}).get("country"),
        place_types=(nlp.get("topics") or []),
        public_photo_url=(memory.thumbnail_url or memory.image_url),
        public_description=memory.description_raw,
        emotion_label=nlp.get("emotion"),
        sentiment_score=nlp.get("sentiment_score"),
        visit_month=visit_date.month if visit_date else None,
        visit_year=visit_date.year if visit_date else None,
        visibility_status="pending",
        moderation_status="pending",
        location=from_shape(Point(lng, lat), srid=4326),
    )
    db.add(item)

    # Best-effort place cache upsert for Stage A.
    place_result = await db.execute(select(PlaceCatalog).where(PlaceCatalog.place_id == place_id))
    place = place_result.scalar_one_or_none()
    if not place:
        place = PlaceCatalog(
            place_id=place_id,
            name=memory.location_name,
            lat=lat,
            lng=lng,
            types=(nlp.get("topics") or []),
            city=(memory.ai_metadata or {}).get("city"),
            country=(memory.ai_metadata or {}).get("country"),
            location=from_shape(Point(lng, lat), srid=4326),
            last_enriched_at=datetime.now(timezone.utc),
        )
        db.add(place)

    memory.travel_shared = True

    await db.commit()

    moderate_travel_post.delay(str(item.id))

    return ShareMemoryResponse(public_memory_id=item.id, status="pending_moderation")


@router.delete(
    "/share/{memory_id}",
    response_model=UnshareMemoryResponse,
    summary="Unpublish a memory from TravelMemo",
)
async def unshare_memory(
    memory_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    memory_result = await db.execute(
        select(Memory).where(
            and_(
                Memory.id == memory_id,
                Memory.user_id == current_user.id,
            )
        )
    )
    memory = memory_result.scalar_one_or_none()
    if not memory:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found")

    public_result = await db.execute(
        select(PublicMemory).where(PublicMemory.source_memory_id == memory.id)
    )
    public_item = public_result.scalar_one_or_none()
    if public_item:
        public_item.visibility_status = "hidden"

    memory.travel_shared = False
    await db.commit()

    return UnshareMemoryResponse(status="unpublished")


@router.post(
    "/report/{public_memory_id}",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Report a public memory",
)
@limiter.limit("20/minute")
async def report_public_memory(
    request: Request,
    public_memory_id: uuid.UUID,
    payload: ReportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = request

    result = await db.execute(
        select(PublicMemory).where(PublicMemory.id == public_memory_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Public memory not found")

    event = RecommendationEvent(
        id=uuid.uuid4(),
        user_id=current_user.id,
        event_type="report",
        place_id=item.place_id,
        public_memory_id=item.id,
        session_id=None,
    )
    db.add(event)

    # If enough reports accumulate, mark for re-review queue.
    report_count = await db.scalar(
        select(func.count())
        .select_from(RecommendationEvent)
        .where(
            and_(
                RecommendationEvent.public_memory_id == item.id,
                RecommendationEvent.event_type == "report",
            )
        )
    )
    if (report_count or 0) >= 3 and item.moderation_status == "approved":
        item.moderation_status = "flagged"

    await db.commit()
    _ = payload.reason  # kept for contract; reason handling queue is Stage B.

    return MessageResponse(message="reported")


@router.get(
    "/my",
    response_model=MyPublicMemoriesResponse,
    summary="List current user's public memories",
)
async def list_my_public_memories(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PublicMemory)
        .where(PublicMemory.user_id == current_user.id)
        .order_by(desc(PublicMemory.created_at))
    )
    items = result.scalars().all()

    return MyPublicMemoriesResponse(items=[_build_public_card(item) for item in items])


@router.get(
    "/profile",
    response_model=TravelProfileResponse,
    summary="Get current user's TravelMemo profile",
)
async def get_travel_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await travel_service.build_profile(db, current_user.id)


@router.get(
    "/feed",
    response_model=FeedResponse,
    summary="Get personalized TravelMemo feed",
)
async def get_travel_feed(
    lat: float,
    lng: float,
    cursor: str | None = None,
    type_filter: str | None = None,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items, next_cursor = await travel_service.generate_feed(
        db=db,
        user_id=current_user.id,
        lat=lat,
        lng=lng,
        cursor=cursor,
        type_filter=type_filter,
        limit=min(max(limit, 1), 30),
    )
    return FeedResponse(items=items, next_cursor=next_cursor)


@router.get(
    "/map",
    response_model=MapClustersResponse,
    summary="Get place clusters for TravelMemo map",
)
async def get_travel_map(
    lat: float,
    lng: float,
    radius_km: float = 10,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    clusters = await travel_service.get_map_clusters(db, lat=lat, lng=lng, radius_km=radius_km)
    return MapClustersResponse(clusters=clusters)


@router.get(
    "/places/{place_id}",
    response_model=PlaceMemoriesResponse,
    summary="Get place detail with public memories",
)
async def get_place_detail(
    place_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    place_result = await db.execute(select(PlaceCatalog).where(PlaceCatalog.place_id == place_id))
    place = place_result.scalar_one_or_none()

    memories_result = await db.execute(
        select(PublicMemory)
        .where(
            and_(
                PublicMemory.place_id == place_id,
                PublicMemory.visibility_status == "active",
                PublicMemory.moderation_status == "approved",
            )
        )
        .order_by(desc(PublicMemory.created_at))
        .limit(50)
    )
    memories = memories_result.scalars().all()

    if not place and not memories:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Place not found")

    if not place and memories:
        first = memories[0]
        geo = to_shape(first.location)
        place = PlaceCatalog(
            place_id=first.place_id,
            name=first.place_name,
            lat=geo.y,
            lng=geo.x,
            city=first.place_city,
            country=first.place_country,
            location=first.location,
            memory_count=len(memories),
            avg_sentiment=None,
        )

    user_has_been_here = False
    user_visit_count = 0
    if place:
        user_visit_count = int(await db.scalar(
            select(func.count(Memory.id))
            .where(
                and_(
                    Memory.user_id == current_user.id,
                    Memory.location_name == place.name,
                )
            )
        ) or 0)
        user_has_been_here = user_visit_count > 0

    visit_context = None
    if user_visit_count >= 3:
        visit_context = "Ya has estado aqui varias veces"
    elif user_visit_count == 2:
        visit_context = "Ya repetiste este lugar"
    elif user_visit_count == 1:
        visit_context = "Ya has estado aqui antes"

    detail = PlaceDetailResponse(
        place_id=place.place_id,
        name=place.name,
        city=place.city,
        country=place.country,
        memory_count=place.memory_count or len(memories),
        avg_sentiment=place.avg_sentiment,
    )

    return PlaceMemoriesResponse(
        place=detail,
        memories=[
            travel_service._build_public_card(
                item,
                context_badge=await travel_service._context_badge(db, item),
            )
            for item in memories
        ],
        user_has_been_here=user_has_been_here,
        user_visit_count=user_visit_count,
        visit_context=visit_context,
    )


@router.post(
    "/preferences",
    response_model=TravelPreferencesResponse,
    summary="Update TravelMemo preferences",
)
async def update_travel_preferences(
    payload: TravelPreferencesRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    prefs = await travel_service.get_or_create_preferences(db, current_user.id)
    prefs.preferred_types = [value.strip() for value in payload.preferred_types if value.strip()]
    prefs.home_city = payload.home_city
    prefs.home_lat = payload.home_lat
    prefs.home_lng = payload.home_lng
    await db.commit()
    await db.refresh(prefs)

    return TravelPreferencesResponse(
        updated=True,
        preferred_types=prefs.preferred_types or [],
        home_city=prefs.home_city,
        home_lat=prefs.home_lat,
        home_lng=prefs.home_lng,
        profile_vector=prefs.profile_vector or {},
    )


@router.get(
    "/preferences",
    response_model=TravelPreferencesResponse,
    summary="Get TravelMemo preferences",
)
async def get_travel_preferences(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    prefs = await travel_service.get_or_create_preferences(db, current_user.id)
    return TravelPreferencesResponse(
        updated=True,
        preferred_types=prefs.preferred_types or [],
        home_city=prefs.home_city,
        home_lat=prefs.home_lat,
        home_lng=prefs.home_lng,
        profile_vector=prefs.profile_vector or {},
    )


@router.post(
    "/events",
    response_model=MessageResponse,
    summary="Store TravelMemo interaction event",
)
async def create_travel_event(
    payload: TravelEventRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = RecommendationEvent(
        id=uuid.uuid4(),
        user_id=current_user.id,
        event_type=payload.event_type,
        place_id=payload.place_id,
        public_memory_id=payload.public_memory_id,
        session_id=payload.session_id,
    )
    db.add(event)
    await db.commit()
    return MessageResponse(message="recorded")


@router.post(
    "/save/{place_id}",
    response_model=SavePlaceResponse,
    summary="Save a place for later",
)
async def save_place(
    place_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = await db.execute(
        select(SavedPlace).where(
            and_(SavedPlace.user_id == current_user.id, SavedPlace.place_id == place_id)
        )
    )
    saved = existing.scalar_one_or_none()
    if not saved:
        db.add(SavedPlace(user_id=current_user.id, place_id=place_id))
        db.add(
            RecommendationEvent(
                id=uuid.uuid4(),
                user_id=current_user.id,
                event_type="save",
                place_id=place_id,
                public_memory_id=None,
                session_id=None,
            )
        )
        await db.commit()
    return SavePlaceResponse(saved=True)


@router.delete(
    "/save/{place_id}",
    response_model=SavePlaceResponse,
    summary="Remove a saved place",
)
async def unsave_place(
    place_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(SavedPlace).where(
            and_(SavedPlace.user_id == current_user.id, SavedPlace.place_id == place_id)
        )
    )
    saved = result.scalar_one_or_none()
    if saved:
        await db.delete(saved)
        await db.commit()
    return SavePlaceResponse(saved=False)


@router.get(
    "/saved",
    response_model=SavedPlacesResponse,
    summary="List saved places",
)
async def list_saved_places(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(SavedPlace)
        .where(SavedPlace.user_id == current_user.id)
        .order_by(desc(SavedPlace.created_at))
    )
    saved_rows = result.scalars().all()

    places: list[SavedPlaceItem] = []
    for saved in saved_rows:
        place_result = await db.execute(select(PlaceCatalog).where(PlaceCatalog.place_id == saved.place_id))
        place = place_result.scalar_one_or_none()
        places.append(
            SavedPlaceItem(
                place_id=saved.place_id,
                place_name=place.name if place else _normalize_place_name(saved.place_id),
                city=place.city if place else None,
                country=place.country if place else None,
                memory_count=place.memory_count if place else 0,
                avg_sentiment=place.avg_sentiment if place else None,
                saved_at=saved.created_at,
            )
        )

    return SavedPlacesResponse(places=places)


# ---------------------------------------------------------------------------
# Stage D — Promotions stub (returns empty; product UI is Post-V1)
# ---------------------------------------------------------------------------

@router.get(
    "/promotions",
    response_model=PromotionsResponse,
    summary="[Stage D stub] List active place promotions",
)
async def list_promotions(
    current_user: User = Depends(get_current_user),
):
    """
    Promotions endpoint stub for Stage D.

    Returns an empty list with `coming_soon=True` until the business portal
    and campaign activation flow are built (Post-V1).

    The ranking layer is already wired to read `places_catalog.boost_weight`;
    activating a promotion only requires writing that value and a row here.
    """
    _ = current_user
    return PromotionsResponse(items=[], coming_soon=True)
