"""
Memory management endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from geoalchemy2.shape import from_shape
from shapely.geometry import Point
from typing import List, Optional
import uuid
from datetime import datetime

from core.database import get_db
from models.database import Memory, User, ProcessingJob
from models.schemas import (
    MemoryCreate,
    MemoryResponse,
    MemoryListResponse,
    MemoryUpdate,
    MessageResponse,
    ProcessingJobResponse
)
from services.storage_service import storage_service
from tasks.celery_app import celery_app


router = APIRouter(prefix="/memories", tags=["memories"])


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def memory_to_response(memory: Memory) -> MemoryResponse:
    """Convert Memory ORM model to response schema with fresh presigned URLs"""
    # Extract coordinates from Geography column
    from geoalchemy2.shape import to_shape
    point = to_shape(memory.coordinates)

    # Always generate a fresh presigned URL (7-day expiry).
    # Works whether the stored value is a raw key (new format) or
    # an old full presigned URL that may have already expired.
    fresh_image_url = storage_service.get_presigned_url(
        memory.image_url, storage_service.images_bucket
    )
    fresh_thumbnail_url = (
        storage_service.get_presigned_url(
            memory.thumbnail_url, storage_service.thumbnails_bucket
        )
        if memory.thumbnail_url
        else None
    )

    return MemoryResponse(
        id=memory.id,
        user_id=memory.user_id,
        description_raw=memory.description_raw,
        location_name=memory.location_name,
        latitude=point.y,
        longitude=point.x,
        image_url=fresh_image_url,
        thumbnail_url=fresh_thumbnail_url,
        ai_metadata=memory.ai_metadata,
        faces_processed=memory.faces_processed,
        visibility=memory.visibility,
        created_at=memory.created_at,
        updated_at=memory.updated_at
    )


async def get_default_user(db: AsyncSession) -> User:
    """Get the default user (temporary until auth is implemented)"""
    result = await db.execute(
        select(User).where(User.email == "default@lifelogs.local")
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Default user not found. Please run init_db.py"
        )
    
    return user


# ============================================================
# ENDPOINTS
# ============================================================

@router.post(
    "",
    response_model=MemoryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new memory",
    description="Upload a new memory with photo, location, and description. AI processing happens asynchronously."
)
async def create_memory(
    memory_data: MemoryCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new memory with image upload to S3
    
    - **description**: User's text description
    - **location_name**: Name of the location
    - **coordinates**: GPS coordinates (lat/lng)
    - **image_base64**: Base64-encoded image
    
    Returns the created memory with a 201 status code.
    AI processing (face recognition, NLP) happens in the background.
    """
    # Get default user (until auth is implemented)
    user = await get_default_user(db)
    
    # Generate memory ID
    memory_id = uuid.uuid4()
    
    # Upload image to S3
    try:
        image_url, thumbnail_url = storage_service.upload_image(
            image_base64=memory_data.image_base64,
            memory_id=memory_id
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload image: {str(e)}"
        )
    
    # Create Geography point from coordinates
    point = Point(memory_data.coordinates.longitude, memory_data.coordinates.latitude)
    geography_point = from_shape(point, srid=4326)
    
    # Prepare initial metadata
    initial_metadata = {}
    if memory_data.categories:
        initial_metadata['user_categories'] = [cat.strip() for cat in memory_data.categories.split(',') if cat.strip()]
    if memory_data.tagged_people:
        initial_metadata['tagged_people'] = [name.strip() for name in memory_data.tagged_people.split(',') if name.strip()]
    
    # Create memory record
    new_memory = Memory(
        id=memory_id,
        user_id=user.id,
        description_raw=memory_data.description,
        location_name=memory_data.location_name,
        coordinates=geography_point,
        image_url=image_url,
        thumbnail_url=thumbnail_url,
        ai_metadata=initial_metadata,
        faces_processed=False,
        visibility="visible"
    )
    
    db.add(new_memory)
    
    # Create processing jobs for background tasks
    face_job = ProcessingJob(
        id=uuid.uuid4(),
        memory_id=memory_id,
        job_type="face_recognition",
        status="pending",
        attempts=0,
        max_attempts=3
    )
    
    nlp_job = ProcessingJob(
        id=uuid.uuid4(),
        memory_id=memory_id,
        job_type="nlp_extraction",
        status="pending",
        attempts=0,
        max_attempts=3
    )
    
    db.add(face_job)
    db.add(nlp_job)
    
    # Commit transaction
    await db.commit()
    await db.refresh(new_memory)
    
    # Trigger Celery tasks for AI processing (asynchronous)
    print(f"🔥 About to send Celery tasks for memory: {memory_id}", flush=True)
    try:
        result1 = celery_app.send_task('tasks.face_recognition.process_faces', args=[str(memory_id)])
        print(f"✅ Face recognition task sent: {result1.id}", flush=True)
        
        result2 = celery_app.send_task('tasks.nlp_extraction.process_nlp', args=[str(memory_id)])
        print(f"✅ NLP task sent: {result2.id}", flush=True)
    except Exception as e:
        # Log error but don't fail the request - tasks can be retried manually
        print(f"❌ Warning: Failed to trigger Celery tasks: {str(e)}", flush=True)
    
    return memory_to_response(new_memory)


@router.get(
    "",
    response_model=MemoryListResponse,
    summary="List memories",
    description="Get paginated list of memories with optional filtering"
)
async def list_memories(
    page: int = 1,
    page_size: int = 20,
    visibility: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    List memories with pagination
    
    - **page**: Page number (starts at 1)
    - **page_size**: Number of items per page (max 100)
    - **visibility**: Filter by visibility (visible, archived, hidden)
    """
    # Get default user
    user = await get_default_user(db)
    
    # Validate pagination
    if page < 1:
        page = 1
    if page_size < 1 or page_size > 100:
        page_size = 20
    
    # Build query
    query = select(Memory).where(Memory.user_id == user.id)
    
    if visibility:
        query = query.where(Memory.visibility == visibility)
    
    # Order by creation date (newest first)
    query = query.order_by(Memory.created_at.desc())
    
    # Get total count
    count_query = select(func.count()).select_from(Memory).where(Memory.user_id == user.id)
    if visibility:
        count_query = count_query.where(Memory.visibility == visibility)
    
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    
    # Execute query
    result = await db.execute(query)
    memories = result.scalars().all()
    
    # Convert to response schemas
    memory_responses = [memory_to_response(m) for m in memories]
    
    # Calculate if there are more pages
    has_more = (offset + page_size) < total
    
    return MemoryListResponse(
        memories=memory_responses,
        total=total,
        page=page,
        page_size=page_size,
        has_more=has_more
    )


@router.get(
    "/{memory_id}",
    response_model=MemoryResponse,
    summary="Get a memory by ID",
    description="Retrieve detailed information about a specific memory"
)
async def get_memory(
    memory_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get a single memory by ID"""
    user = await get_default_user(db)
    
    result = await db.execute(
        select(Memory).where(
            and_(
                Memory.id == memory_id,
                Memory.user_id == user.id
            )
        )
    )
    memory = result.scalar_one_or_none()
    
    if not memory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Memory not found"
        )
    
    return memory_to_response(memory)


@router.patch(
    "/{memory_id}",
    response_model=MemoryResponse,
    summary="Update a memory",
    description="Update memory description, location name, or visibility"
)
async def update_memory(
    memory_id: uuid.UUID,
    update_data: MemoryUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a memory's editable fields"""
    user = await get_default_user(db)
    
    result = await db.execute(
        select(Memory).where(
            and_(
                Memory.id == memory_id,
                Memory.user_id == user.id
            )
        )
    )
    memory = result.scalar_one_or_none()
    
    if not memory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Memory not found"
        )
    
    # Update fields if provided
    if update_data.description is not None:
        memory.description_raw = update_data.description
    if update_data.location_name is not None:
        memory.location_name = update_data.location_name
    if update_data.visibility is not None:
        memory.visibility = update_data.visibility
    
    memory.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(memory)
    
    return memory_to_response(memory)


@router.delete(
    "/{memory_id}",
    response_model=MessageResponse,
    summary="Delete a memory",
    description="Permanently delete a memory and its associated images"
)
async def delete_memory(
    memory_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """Delete a memory and its S3 images"""
    user = await get_default_user(db)
    
    result = await db.execute(
        select(Memory).where(
            and_(
                Memory.id == memory_id,
                Memory.user_id == user.id
            )
        )
    )
    memory = result.scalar_one_or_none()
    
    if not memory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Memory not found"
        )
    
    # Delete from S3
    try:
        storage_service.delete_image(memory_id)
    except Exception as e:
        # Log error but continue with DB deletion
        print(f"Warning: Failed to delete S3 images: {str(e)}")
    
    # Delete from database (CASCADE will delete related records)
    await db.delete(memory)
    await db.commit()
    
    return MessageResponse(message="Memory deleted successfully")


@router.get(
    "/{memory_id}/jobs",
    response_model=List[ProcessingJobResponse],
    summary="Get processing jobs for a memory",
    description="Check the status of background AI processing tasks"
)
async def get_memory_jobs(
    memory_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get all processing jobs for a memory"""
    user = await get_default_user(db)
    
    # Verify memory exists and belongs to user
    memory_result = await db.execute(
        select(Memory).where(
            and_(
                Memory.id == memory_id,
                Memory.user_id == user.id
            )
        )
    )
    memory = memory_result.scalar_one_or_none()
    
    if not memory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Memory not found"
        )
    
    # Get all jobs for this memory
    jobs_result = await db.execute(
        select(ProcessingJob).where(ProcessingJob.memory_id == memory_id)
    )
    jobs = jobs_result.scalars().all()
    
    return jobs
