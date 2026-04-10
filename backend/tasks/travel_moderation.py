"""
Celery tasks for TravelMemo moderation.
"""

from datetime import datetime, timezone
import uuid

from sqlalchemy import select

from core.database import SyncSessionLocal
from models.travel_models import PublicMemory
from services.moderation_service import travel_moderation_service
from services.storage_service import storage_service
from tasks.celery_app import celery_app


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
        db.commit()

        return {"status": "approved", "public_memory_id": public_memory_id}
    except Exception as exc:
        db.rollback()
        raise self.retry(exc=exc, countdown=5)
    finally:
        db.close()
