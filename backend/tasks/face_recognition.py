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
    with SyncSessionLocal() as db:
        try:
            # Get processing job
            job = db.execute(
                select(ProcessingJob).where(
                    ProcessingJob.memory_id == uuid.UUID(memory_id),
                    ProcessingJob.job_type == "face_recognition"
                )
            ).scalar_one_or_none()
            
            # Delegate to portable service
            result = face_service.detect_and_recognize_faces(
                db=db,
                memory_id=memory_id,
                job=job
            )
            
            return result
            
        except Exception as e:
            # Get job for error handling
            job = db.execute(
                select(ProcessingJob).where(
                    ProcessingJob.memory_id == uuid.UUID(memory_id),
                    ProcessingJob.job_type == "face_recognition"
                )
            ).scalar_one_or_none()
            
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
