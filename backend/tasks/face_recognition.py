"""
Face Recognition Task - Celery wrapper for face recognition service

This is a thin wrapper around the portable FaceRecognitionService.
For serverless deployment, use backend/lambda/face_handler.py instead.
"""
import uuid

from tasks.celery_app import celery_app
from core.database import SyncSessionLocal
from models.database import ProcessingJob
from sqlalchemy import select
from services.face_service import face_service


def _get_active_job(db, memory_id: uuid.UUID):
    """
    Return the most-recently-created pending/processing face job for this memory.
    Using .scalars().first() avoids MultipleResultsFound when rerun creates a new
    job while old completed/failed jobs still exist in the table.
    """
    return db.execute(
        select(ProcessingJob)
        .where(
            ProcessingJob.memory_id == memory_id,
            ProcessingJob.job_type == "face_recognition",
            ProcessingJob.status.in_(["pending", "processing"])
        )
        .order_by(ProcessingJob.created_at.desc())
    ).scalars().first()


@celery_app.task(name="tasks.face_recognition.process_faces", bind=True, max_retries=3)
def process_face_recognition(self, memory_id: str):
    """
    Celery task wrapper for face recognition
    
    This is a thin wrapper that delegates to FaceRecognitionService.
    The service contains the portable business logic.
    
    Args:
        memory_id: UUID of the memory to process
        
    Returns:
        Result dict from face_service.detect_and_recognize_faces()
    """
    mem_uuid = uuid.UUID(memory_id)
    with SyncSessionLocal() as db:
        try:
            # Get the active (pending/processing) job — use helper to avoid
            # MultipleResultsFound when the memory has been rerun more than once.
            job = _get_active_job(db, mem_uuid)
            
            # Delegate to portable service
            result = face_service.detect_and_recognize_faces(
                db=db,
                memory_id=memory_id,
                job=job
            )
            
            return result
            
        except Exception as e:
            # Get job for error handling (same safe query)
            job = _get_active_job(db, mem_uuid)
            
            if job:
                job.status = "failed"
                job.error_message = str(e)
                job.attempts += 1
                db.commit()
            
            # Retry if possible
            if self.request.retries < self.max_retries:
                raise self.retry(exc=e, countdown=60)
            
            return {
                "error": str(e),
                "memory_id": memory_id,
                "status": "failed"
            }
