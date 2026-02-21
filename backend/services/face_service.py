"""
Face Recognition Service - Pure business logic (serverless-ready)

This module contains portable face detection and recognition logic
that can be used by Celery tasks, Lambda functions, or any other orchestrator.
"""
import os
import sys
import uuid
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone

import face_recognition
import requests
import numpy as np
from io import BytesIO
from PIL import Image
from sqlalchemy.orm import Session
from sqlalchemy import select

from models.database import Memory, Person, MemoryPerson, ProcessingJob
from sqlalchemy.orm.attributes import flag_modified
from services.storage_service import storage_service


class FaceRecognitionService:
    """Service for face detection and recognition"""
    
    def __init__(self):
        """Initialize face recognition service"""
        # Explicitly add face_recognition_models to Python path
        models_path = "/usr/local/lib/python3.12/site-packages/face_recognition_models"
        if models_path not in sys.path:
            sys.path.insert(0, models_path)
        
        # Set environment variable for model location
        os.environ['FACE_RECOGNITION_MODELS'] = models_path
    
    def detect_and_recognize_faces(
        self,
        db: Session,
        memory_id: str,
        job: Optional[ProcessingJob] = None
    ) -> Dict[str, Any]:
        """
        Detect and recognize faces in a memory image
        
        Args:
            db: Database session
            memory_id: UUID of the memory to process
            job: Optional processing job for status tracking
            
        Returns:
            Result dict with faces_found, faces list, and status
            
        Raises:
            Exception: If face recognition fails
        """
        try:
            # Get memory
            memory = db.execute(
                select(Memory).where(Memory.id == uuid.UUID(memory_id))
            ).scalar_one_or_none()
            
            if not memory:
                return {"error": f"Memory {memory_id} not found"}
            
            # Update job status if provided
            if job:
                job.status = "processing"
                job.started_at = datetime.now(timezone.utc)
                db.commit()
            
            # Download image from S3
            response = requests.get(memory.image_url, timeout=30)
            response.raise_for_status()
            image_bytes = response.content
            
            # Load image with face_recognition (requires numpy array)
            image = face_recognition.load_image_file(BytesIO(image_bytes))
            # Also load as PIL Image for cropping face thumbnails
            pil_image = Image.open(BytesIO(image_bytes)).convert('RGB')
            
            # Detect faces (HOG model - CPU friendly)
            face_locations = face_recognition.face_locations(image, model="hog")
            face_encodings = face_recognition.face_encodings(image, face_locations)
            
            if not face_encodings:
                # No faces found - mark as completed
                if job:
                    job.status = "completed"
                    job.completed_at = datetime.now(timezone.utc)
                
                memory.faces_processed = True
                db.commit()
                
                return {
                    "memory_id": memory_id,
                    "faces_found": 0,
                    "message": "No faces detected in image"
                }
            
            # Process each detected face
            detected_faces = self._process_detected_faces(
                db=db,
                memory=memory,
                face_encodings=face_encodings,
                face_locations=face_locations,
                pil_image=pil_image
            )
            
            # Update memory metadata
            db.refresh(memory)  # Get latest version to avoid overwriting NLP data
            if not memory.ai_metadata:
                memory.ai_metadata = {}
            
            memory.ai_metadata["faces"] = detected_faces
            flag_modified(memory, "ai_metadata")
            memory.faces_processed = True
            
            # Update job status
            if job:
                job.status = "completed"
                job.completed_at = datetime.now(timezone.utc)
            
            db.commit()
            
            return {
                "memory_id": memory_id,
                "faces_found": len(detected_faces),
                "faces": detected_faces,
                "status": "completed"
            }
            
        except Exception as e:
            # Handle errors
            if job:
                job.status = "failed"
                job.error_message = str(e)
                job.attempts += 1
                db.commit()
            
            raise e
    
    def _process_detected_faces(
        self,
        db: Session,
        memory: Memory,
        face_encodings: List,
        face_locations: List,
        pil_image: Image.Image = None
    ) -> List[Dict[str, Any]]:
        """
        Process detected faces and match with existing people
        
        Args:
            db: Database session
            memory: Memory object
            face_encodings: List of face encodings
            face_locations: List of face locations
            pil_image: PIL Image for cropping face thumbnails
            
        Returns:
            List of detected face dicts with person info
        """
        img_w, img_h = (pil_image.size if pil_image else (0, 0))
        detected_faces = []
        
        for face_encoding, face_location in zip(face_encodings, face_locations):
            # face_location = (top, right, bottom, left)
            top, right, bottom, left = face_location
            
            # Crop face with 30% padding for a nicer thumbnail
            face_crop = None
            if pil_image:
                pad_x = int((right - left) * 0.3)
                pad_y = int((bottom - top) * 0.3)
                crop_left   = max(0, left - pad_x)
                crop_top    = max(0, top - pad_y)
                crop_right  = min(img_w, right + pad_x)
                crop_bottom = min(img_h, bottom + pad_y)
                face_crop = pil_image.crop((crop_left, crop_top, crop_right, crop_bottom))
            
            # Convert encoding to string for storage
            encoding_str = ",".join(map(str, face_encoding.tolist()))
            
            # Try to match with existing people
            existing_people = db.execute(
                select(Person).where(Person.user_id == memory.user_id)
            ).scalars().all()
            
            matched_person = None
            best_match_confidence = 0.0
            
            for person in existing_people:
                # Parse stored encoding
                stored_encoding = np.array([float(x) for x in person.face_embedding.split(",")])
                
                # Compare faces (lower distance = better match)
                face_distance = face_recognition.face_distance([stored_encoding], face_encoding)[0]
                confidence = 1 - face_distance  # Convert distance to confidence
                
                # Threshold: 0.6 (60% confidence)
                if confidence > 0.6 and confidence > best_match_confidence:
                    matched_person = person
                    best_match_confidence = confidence
            
            if matched_person:
                # Update existing person
                matched_person.times_detected += 1
                matched_person.last_seen = datetime.now(timezone.utc)
                
                # Update thumbnail if person doesn't have one yet
                if not matched_person.thumbnail_url:
                    try:
                        matched_person.thumbnail_url = storage_service.upload_face_thumbnail(
                            face_crop, matched_person.id
                        )
                    except Exception as e:
                        print(f"Warning: failed to upload face thumbnail: {e}")
                
                # Link to memory
                memory_person = MemoryPerson(
                    memory_id=memory.id,
                    person_id=matched_person.id,
                    confidence_score=float(best_match_confidence)
                )
                db.add(memory_person)
                
                detected_faces.append({
                    "person_id": str(matched_person.id),
                    "name": matched_person.name,
                    "confidence": float(best_match_confidence),
                    "is_new": False
                })
            else:
                # Create new unknown person
                new_person = Person(
                    id=uuid.uuid4(),
                    user_id=memory.user_id,
                    name=f"Unknown Person {uuid.uuid4().hex[:8]}",
                    face_embedding=encoding_str,
                    times_detected=1
                )
                db.add(new_person)
                db.flush()  # Get the ID
                
                # Upload face thumbnail for new person
                try:
                    new_person.thumbnail_url = storage_service.upload_face_thumbnail(
                        face_crop, new_person.id
                    )
                except Exception as e:
                    print(f"Warning: failed to upload face thumbnail: {e}")
                
                # Link to memory
                memory_person = MemoryPerson(
                    memory_id=memory.id,
                    person_id=new_person.id,
                    confidence_score=1.0
                )
                db.add(memory_person)
                
                detected_faces.append({
                    "person_id": str(new_person.id),
                    "name": new_person.name,
                    "confidence": 1.0,
                    "is_new": True
                })
        
        return detected_faces


# Singleton instance
face_service = FaceRecognitionService()
