"""
Celery background tasks
"""
from tasks.celery_app import celery_app
from tasks.face_recognition import process_face_recognition
from tasks.nlp_extraction import process_nlp_extraction

__all__ = [
    "celery_app",
    "process_face_recognition",
    "process_nlp_extraction"
]
