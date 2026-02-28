"""
Face Recognition Service - Pure business logic (serverless-ready)

This module contains portable face detection and recognition logic
that can be used by Celery tasks, Lambda functions, or any other orchestrator.
"""
import os
import sys
import uuid
import json
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone

import face_recognition
import requests
import numpy as np
from io import BytesIO
from PIL import Image, ImageEnhance
from sqlalchemy.orm import Session
from sqlalchemy import select

from models.database import Memory, Person, MemoryPerson, ProcessingJob
from sqlalchemy.orm.attributes import flag_modified
from services.storage_service import storage_service

# Store up to this many encodings per person for robust matching
MAX_ENCODINGS_PER_PERSON = 5
# Match threshold: lower = stricter. 0.55 reduces false positives vs 0.6
MATCH_TOLERANCE = 0.55


class FaceRecognitionService:
    """Service for face detection and recognition"""

    def __init__(self):
        """Initialize face recognition service"""
        models_path = "/usr/local/lib/python3.12/site-packages/face_recognition_models"
        if models_path not in sys.path:
            sys.path.insert(0, models_path)
        os.environ['FACE_RECOGNITION_MODELS'] = models_path

    # ------------------------------------------------------------------
    # Encoding serialization helpers (backward-compatible)
    # ------------------------------------------------------------------

    @staticmethod
    def _load_person_encodings(person: Person) -> List[np.ndarray]:
        """
        Parse stored face encodings from a Person record.

        Supports two formats:
        - New: JSON string  '[[0.1, 0.2, ...], [0.15, ...]]'  → multiple encodings
        - Old: comma-separated string  '0.1,0.2,...'            → single encoding
        """
        raw = person.face_embedding
        if not raw:
            return []
        try:
            parsed = json.loads(raw)
            if parsed and isinstance(parsed[0], list):
                return [np.array(enc) for enc in parsed]
            # JSON array of numbers (edge-case: single encoding as flat list)
            return [np.array(parsed)]
        except (json.JSONDecodeError, TypeError):
            # Legacy comma-separated format
            return [np.array([float(x) for x in raw.split(",")])]

    @staticmethod
    def _serialize_encodings(encodings: List[np.ndarray]) -> str:
        """Serialize a list of encodings to a JSON string."""
        return json.dumps([enc.tolist() for enc in encodings])

    @staticmethod
    def _preprocess_image(image_bytes: bytes) -> np.ndarray:
        """
        Normalize image before face detection:
        - Slight contrast enhancement helps with uneven lighting
        - Keeps original resolution (no downscale)
        """
        pil = Image.open(BytesIO(image_bytes)).convert("RGB")
        
        # Performance optimization for EC2 t2.micro/small
        # Resize image proportionally if larger than 1000px on either side
        max_dimension = 1000
        if pil.width > max_dimension or pil.height > max_dimension:
            ratio = min(max_dimension / pil.width, max_dimension / pil.height)
            new_size = (int(pil.width * ratio), int(pil.height * ratio))
            pil = pil.resize(new_size, Image.Resampling.LANCZOS)
        
        pil = ImageEnhance.Contrast(pil).enhance(1.3)
        pil = ImageEnhance.Brightness(pil).enhance(1.05)
        return np.array(pil), pil


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
            
            # Refresh presigned URL before downloading — stored URL may have expired
            fresh_url = storage_service.get_presigned_url(
                memory.image_url, storage_service.images_bucket
            )
            response = requests.get(fresh_url, timeout=30)
            response.raise_for_status()
            image_bytes = response.content

            # Load and preprocess image
            image, pil_image = self._preprocess_image(image_bytes)

            # --- OpenCV Haar Cascades for Ultra-Fast Detection ---
            # detectMultiScale scans the image in milliseconds vs HOG which takes minutes on EC2
            import cv2
            gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
            
            # Load the pre-trained Haar Cascade model from cv2 data
            cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            face_cascade = cv2.CascadeClassifier(cascade_path)
            
            # scaleFactor=1.05 and minNeighbors=6 catch smaller/distant non-selfie faces safely
            # minNeighbors=6 reduces false positive objects misidentified as faces
            cv_faces = face_cascade.detectMultiScale(gray, scaleFactor=1.05, minNeighbors=6, minSize=(20, 20))
            
            # Convert OpenCV (x, y, w, h) to face_recognition (top, right, bottom, left) bounding boxes
            face_locations = [(y, x + w, y + h, x) for (x, y, w, h) in cv_faces]
            
            # Extract identities ONLY for the exact boxes found by OpenCV
            face_encodings = face_recognition.face_encodings(image, face_locations, num_jitters=1)
            
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
        image_w = img_w  # store for bbox normalization
        image_h = img_h

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
                # Load ALL stored encodings for this person (multi-encoding support)
                person_encodings = self._load_person_encodings(person)
                if not person_encodings:
                    continue

                # Compare against each stored encoding, keep the best (lowest distance)
                distances = face_recognition.face_distance(person_encodings, face_encoding)
                min_distance = float(np.min(distances))
                confidence = 1.0 - min_distance

                if confidence > MATCH_TOLERANCE and confidence > best_match_confidence:
                    matched_person = person
                    best_match_confidence = confidence
            
            if matched_person:
                # Update existing person
                matched_person.times_detected += 1
                matched_person.last_seen = datetime.now(timezone.utc)

                # Add new encoding to the stored list (up to MAX_ENCODINGS_PER_PERSON)
                existing_encodings = self._load_person_encodings(matched_person)
                if len(existing_encodings) < MAX_ENCODINGS_PER_PERSON:
                    existing_encodings.append(face_encoding)
                    matched_person.face_embedding = self._serialize_encodings(existing_encodings)
                
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
                    "person_name": matched_person.name,
                    "name": matched_person.name,
                    "confidence": float(best_match_confidence),
                    "is_new": False,
                    "bbox": {
                        "top": top, "right": right,
                        "bottom": bottom, "left": left
                    },
                    "image_w": image_w,
                    "image_h": image_h,
                })
            else:
                # Create new unknown person — store encoding in new JSON format
                new_person = Person(
                    id=uuid.uuid4(),
                    user_id=memory.user_id,
                    name=f"Unknown Person {uuid.uuid4().hex[:8]}",
                    face_embedding=self._serialize_encodings([face_encoding]),
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
                    "person_name": new_person.name,
                    "name": new_person.name,
                    "confidence": 1.0,
                    "is_new": True,
                    "bbox": {
                        "top": top, "right": right,
                        "bottom": bottom, "left": left
                    },
                    "image_w": image_w,
                    "image_h": image_h,
                })
        
        return detected_faces


# Singleton instance
face_service = FaceRecognitionService()
