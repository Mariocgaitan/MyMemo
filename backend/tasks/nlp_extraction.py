"""
NLP Extraction Task - Celery wrapper for NLP extraction service

This is a thin wrapper around the portable NLPExtractionService.
For serverless deployment, use backend/lambda/nlp_handler.py instead.
"""
import uuid

from tasks.celery_app import celery_app
from core.database import SyncSessionLocal
from models.database import ProcessingJob
from sqlalchemy import select
from services.nlp_service import nlp_service


@celery_app.task(name="tasks.nlp_extraction.process_nlp", bind=True, max_retries=3)
def process_nlp_extraction(self, memory_id: str):
    """
    Celery task wrapper for NLP extraction
    
    This is a thin wrapper that delegates to NLPExtractionService.
    The service contains the portable business logic.
    
    Args:
        memory_id: UUID of the memory to process
        
    Returns:
        Result dict from nlp_service.extract_metadata()
    """
    with SyncSessionLocal() as db:
        try:
            # Get processing job
            job = db.execute(
                select(ProcessingJob).where(
                    ProcessingJob.memory_id == uuid.UUID(memory_id),
                    ProcessingJob.job_type == "nlp_extraction"
                )
            ).scalar_one_or_none()
            
            # Delegate to portable service
            result = nlp_service.extract_metadata(
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
                    ProcessingJob.job_type == "nlp_extraction"
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
