"""
Celery tasks for TravelMemo moderation.
"""

from datetime import datetime, timezone
import uuid

from sqlalchemy import select

from core.database import SyncSessionLocal
from models.database import Memory
from models.travel_models import PublicMemory, PlaceCatalog
from services.moderation_service import travel_moderation_service
from services.storage_service import storage_service
from tasks.celery_app import celery_app


def _normalize_types_sync(nlp: dict) -> list[str]:
    """Mirror of _extract_place_types in travel.py (sync version for Celery). Returns (types, emotion_label)."""
    _map = {
        # comida
        "food": "comida", "comida": "comida", "restaurante": "comida", "restaurant": "comida",
        "dinner": "comida", "lunch": "comida", "breakfast": "comida", "desayuno": "comida",
        "almuerzo": "comida", "cena": "comida", "mariscos": "comida", "seafood": "comida",
        "tacos": "comida", "pizza": "comida", "sushi": "comida", "brunch": "comida",
        # cafe
        "coffee": "cafe", "cafe": "cafe", "café": "cafe", "espresso": "cafe", "tea": "cafe",
        # salidas
        "nightlife": "salidas", "bar": "salidas", "drinks": "salidas",
        "cocktail": "salidas", "mojito": "salidas", "night": "salidas",
        "club": "salidas", "discoteca": "salidas", "cantina": "salidas",
        # deporte
        "sports": "deporte", "exercise": "deporte", "gym": "deporte", "fitness": "deporte",
        "deporte": "deporte", "fútbol": "deporte", "futbol": "deporte", "running": "deporte",
        "hiking": "deporte", "outdoor": "deporte",
        # arte
        "architecture": "arte", "historic": "arte", "museum": "arte",
        "art": "arte", "arquitectura": "arte", "museo": "arte",
        "iglesia": "arte", "church": "arte", "monument": "arte", "arte": "arte",
        # pareja
        "romance": "pareja", "romantic": "pareja", "pareja": "pareja",
        "aniversario": "pareja", "anniversary": "pareja", "spa": "pareja",
        # familia
        "family": "familia", "familia": "familia", "niños": "familia",
        "park": "familia", "parque": "familia", "naturaleza": "familia",
        "nature": "familia", "beach": "familia", "playa": "familia",
        # fiesta
        "fiesta": "fiesta", "party": "fiesta", "cumpleaños": "fiesta",
        "celebration": "fiesta", "birthday": "fiesta", "evento": "fiesta",
    }
    _sentiment = {"positive": "Me encantó", "neutral": "Recuerdo", "negative": "Mejorable"}

    raw = [t.lower() for t in (nlp.get("themes") or [])]
    if nlp.get("activity"):
        raw.append(nlp["activity"].lower())
    raw += [t.lower() for t in (nlp.get("tags") or [])]

    types = []
    for token in raw:
        mapped = _map.get(token)
        if mapped and mapped not in types:
            types.append(mapped)
    return types, _sentiment.get((nlp.get("sentiment") or "").lower())


@celery_app.task(bind=True, max_retries=3)
def moderate_travel_post(self, public_memory_id: str):
    """Moderate a public memory asynchronously and update visibility/moderation statuses."""
    db = SyncSessionLocal()
    try:
        result = db.execute(
            select(PublicMemory).where(PublicMemory.id == uuid.UUID(public_memory_id))
        )
        item = result.scalar_one_or_none()
        if not item:
            return {"status": "not_found", "public_memory_id": public_memory_id}

        # Text moderation
        is_text_safe, text_reason = travel_moderation_service.moderate_text(item.public_description or "")
        if not is_text_safe:
            item.moderation_status = "rejected"
            item.visibility_status = "hidden"
            item.moderation_reason = text_reason
            item.moderation_checked_at = datetime.now(timezone.utc)
            db.commit()
            return {"status": "rejected", "reason": text_reason}

        # Image moderation
        presigned_url = storage_service.get_presigned_url(
            item.public_photo_url,
            storage_service.thumbnails_bucket,
            expiration=600,
        )
        is_image_safe, image_reason = travel_moderation_service.moderate_image(presigned_url)
        if not is_image_safe:
            item.moderation_status = "rejected"
            item.visibility_status = "hidden"
            item.moderation_reason = image_reason
            item.moderation_checked_at = datetime.now(timezone.utc)
            db.commit()
            return {"status": "rejected", "reason": image_reason}

        item.moderation_status = "approved"
        item.visibility_status = "active"
        item.moderation_reason = None
        item.moderation_checked_at = datetime.now(timezone.utc)

        # Backfill emotion_label / sentiment_score / place_types from source memory NLP
        # (they may have been null if NLP hadn't finished when the memory was shared)
        if item.source_memory_id:
            source = db.execute(
                select(Memory).where(Memory.id == item.source_memory_id)
            ).scalar_one_or_none()
            if source:
                nlp = (source.ai_metadata or {}).get("nlp", {})
                if nlp:
                    types, label = _normalize_types_sync(nlp)
                    if not item.emotion_label and label:
                        item.emotion_label = label
                    s = (nlp.get("sentiment") or "").lower()
                    if item.sentiment_score is None:
                        item.sentiment_score = 1.0 if s == "positive" else (0.0 if s == "negative" else 0.5)
                    if not item.place_types and types:
                        item.place_types = types
                        # Also patch PlaceCatalog
                        place = db.execute(
                            select(PlaceCatalog).where(PlaceCatalog.place_id == item.place_id)
                        ).scalar_one_or_none()
                        if place and not place.types:
                            place.types = types

        db.commit()
        return {"status": "approved", "public_memory_id": public_memory_id}
    except Exception as exc:
        db.rollback()
        raise self.retry(exc=exc, countdown=5)
    finally:
        db.close()
