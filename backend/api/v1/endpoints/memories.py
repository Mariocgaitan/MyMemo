"""
Memory management endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, delete as sa_delete
from geoalchemy2.shape import from_shape
from shapely.geometry import Point
from typing import List, Optional
import uuid
from datetime import datetime

from core.database import get_db
from core.deps import get_current_user
from models.database import Memory, User, ProcessingJob, MemoryPerson, Person, UserConnection
from models.schemas import (
    MemoryCreate,
    MemoryResponse,
    MemoryListResponse,
    MemoryUpdate,
    MessageResponse,
    ProcessingJobResponse,
    SharedByInfo,
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

    # -------------------------------------------------------------
    # Hydrate Face Avatars with fresh S3 Links
    # -------------------------------------------------------------
    # The database stringifies `ai_metadata` into a static JSONB column. 
    # Avatar URLs (faces/...jpg) are stored in the separate `Person` table and 
    # often expire. We must dynamically inject fresh pre-signed URLs into 
    # the returned JSON payload without permanently modifying the DB row.
    import copy
    safe_metadata = copy.deepcopy(memory.ai_metadata) if memory.ai_metadata else {}
    
    if "faces" in safe_metadata and isinstance(safe_metadata["faces"], list):
        for face in safe_metadata["faces"]:
            pid = face.get("person_id")
            if pid:
                # Ask Storage Service to give us a valid 7-day link for this person's avatar
                face["thumbnail_url"] = storage_service.get_presigned_url(
                    f"faces/{pid}.jpg", 
                    storage_service.thumbnails_bucket
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
        ai_metadata=safe_metadata,
        faces_processed=memory.faces_processed,
        visibility=memory.visibility,
        created_at=memory.created_at,
        updated_at=memory.updated_at
    )


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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
    user_id = current_user.id
    user = current_user
    
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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List memories with pagination, including memories shared by connected users.
    Own memories and shared memories are merged and sorted by creation date.
    
    - **page**: Page number (starts at 1)
    - **page_size**: Number of items per page (max 100)
    - **visibility**: Filter by visibility (visible, archived, hidden). Only applies to own memories.
    """
    user = current_user

    # Validate pagination
    if page < 1:
        page = 1
    if page_size < 1 or page_size > 100:
        page_size = 20

    # ------------------------------------------------------------------
    # 1. Own memories: (memory_id, created_at, shared_by=None)
    # ------------------------------------------------------------------
    own_query = select(Memory.id, Memory.created_at).where(Memory.user_id == user.id)
    if visibility:
        own_query = own_query.where(Memory.visibility == visibility)
    own_result = await db.execute(own_query)
    own_rows = own_result.all()  # list of (id, created_at)

    # ------------------------------------------------------------------
    # 2. Shared memories from accepted connections
    # ------------------------------------------------------------------
    conn_result = await db.execute(
        select(UserConnection).where(
            and_(
                UserConnection.status == "accepted",
                or_(
                    UserConnection.requester_id == user.id,
                    UserConnection.addressee_id == user.id,
                ),
            )
        )
    )
    connections = conn_result.scalars().all()

    # Build a map of memory_id → SharedByInfo for shared memories
    shared_info_map: dict[uuid.UUID, SharedByInfo] = {}

    for conn in connections:
        am_requester = conn.requester_id == user.id
        # The person_id that represents ME in the partner's DB
        my_person_in_partner = conn.person_id_in_addressee if am_requester else conn.person_id_in_requester
        partner_id = conn.addressee_id if am_requester else conn.requester_id
        # My border prefs for this connection
        border_color = conn.border_color_requester if am_requester else conn.border_color_addressee
        border_style = conn.border_style_requester if am_requester else conn.border_style_addressee

        if not my_person_in_partner:
            # Connection has no linked person yet — skip shared memories for this pair
            continue

        # Find partner's memories where my_person_in_partner appears as a face
        shared_q = (
            select(Memory.id, Memory.created_at)
            .join(MemoryPerson, MemoryPerson.memory_id == Memory.id)
            .where(
                and_(
                    Memory.user_id == partner_id,
                    Memory.visibility == "visible",
                    MemoryPerson.person_id == my_person_in_partner,
                )
            )
        )
        shared_res = await db.execute(shared_q)
        for mem_id, mem_created_at in shared_res.all():
            if mem_id not in shared_info_map:
                # Load partner's name lazily
                partner_res = await db.execute(select(User).where(User.id == partner_id))
                partner = partner_res.scalar_one_or_none()
                partner_name = partner.name if partner else None
                shared_info_map[mem_id] = SharedByInfo(
                    user_id=partner_id,
                    name=partner_name,
                    border_color=border_color,
                    border_style=border_style,
                )

    # ------------------------------------------------------------------
    # 3. Merge + sort by created_at descending → paginate
    # ------------------------------------------------------------------
    all_entries = [(ts, mid) for mid, ts in own_rows]

    # Add shared (need their created_at)
    if shared_info_map:
        shared_ids = list(shared_info_map.keys())
        shared_mem_res = await db.execute(
            select(Memory.id, Memory.created_at).where(Memory.id.in_(shared_ids))
        )
        for mem_id, ts in shared_mem_res.all():
            all_entries.append((ts, mem_id))

    # Deduplicate (own memory that also appears in shared → keep as own)
    own_ids = {mid for _, mid in [(ts, mid) for mid, ts in own_rows]}
    deduped: list[tuple] = []
    seen: set[uuid.UUID] = set()
    for ts, mid in all_entries:
        if mid in seen:
            continue
        # If it's a shared memory that the user also owns, skip the shared copy
        if mid in shared_info_map and mid in own_ids:
            seen.add(mid)
            continue
        seen.add(mid)
        deduped.append((ts, mid))

    # Sort newest first
    deduped.sort(key=lambda x: x[0], reverse=True)

    total = len(deduped)
    offset = (page - 1) * page_size
    page_entries = deduped[offset: offset + page_size]
    has_more = (offset + page_size) < total

    # ------------------------------------------------------------------
    # 4. Load full Memory objects for this page
    # ------------------------------------------------------------------
    page_ids = [mid for _, mid in page_entries]
    if not page_ids:
        return MemoryListResponse(memories=[], total=total, page=page, page_size=page_size, has_more=False)

    mem_result = await db.execute(select(Memory).where(Memory.id.in_(page_ids)))
    memories_map: dict[uuid.UUID, Memory] = {m.id: m for m in mem_result.scalars().all()}

    memory_responses: list[MemoryResponse] = []
    for _, mid in page_entries:
        mem = memories_map.get(mid)
        if not mem:
            continue
        resp = memory_to_response(mem)
        resp.shared_by = shared_info_map.get(mid)
        memory_responses.append(resp)

    return MemoryListResponse(
        memories=memory_responses,
        total=total,
        page=page,
        page_size=page_size,
        has_more=has_more,
    )


@router.get(
    "/{memory_id}",
    response_model=MemoryResponse,
    summary="Get a memory by ID",
    description="Retrieve detailed information about a specific memory"
)
async def get_memory(
    memory_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single memory by ID"""
    user_id = current_user.id
    user = current_user
    
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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a memory's editable fields"""
    user_id = current_user.id
    user = current_user
    
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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a memory and its S3 images"""
    user_id = current_user.id
    user = current_user
    
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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all processing jobs for a memory"""
    user_id = current_user.id
    user = current_user
    
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


@router.post(
    "/{memory_id}/rerun-faces",
    response_model=MessageResponse,
    summary="Re-run face recognition",
    description="Clear existing face data and queue a new face recognition job"
)
async def rerun_face_recognition(
    memory_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reset face data and re-queue face recognition for a memory"""
    user_id = current_user.id
    user = current_user

    memory_result = await db.execute(
        select(Memory).where(and_(Memory.id == memory_id, Memory.user_id == user.id))
    )
    memory = memory_result.scalar_one_or_none()
    if not memory:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found")

    # 1. Remove all MemoryPerson links for this memory and decrement counters
    mp_result = await db.execute(
        select(MemoryPerson).where(MemoryPerson.memory_id == memory_id)
    )
    mps = mp_result.scalars().all()
    for mp in mps:
        person_result = await db.execute(
            select(Person).where(Person.id == mp.person_id)
        )
        person = person_result.scalar_one_or_none()
        if person:
            person.times_detected = max(0, person.times_detected - 1)
    await db.execute(sa_delete(MemoryPerson).where(MemoryPerson.memory_id == memory_id))

    # 2. Reset face metadata on the memory
    meta = dict(memory.ai_metadata or {})
    meta["faces"] = []
    memory.ai_metadata = meta
    memory.faces_processed = False
    memory.updated_at = datetime.utcnow()

    # 3. Cancel any previous pending/processing face jobs
    jobs_result = await db.execute(
        select(ProcessingJob).where(
            and_(
                ProcessingJob.memory_id == memory_id,
                ProcessingJob.job_type == "face_recognition"
            )
        )
    )
    for old_job in jobs_result.scalars().all():
        if old_job.status in ("pending", "processing"):
            old_job.status = "failed"
            old_job.error_message = "Reemplazado por nuevo análisis"

    # 4. Create fresh job
    new_job = ProcessingJob(
        id=uuid.uuid4(),
        memory_id=memory_id,
        job_type="face_recognition",
        status="pending"
    )
    db.add(new_job)
    await db.commit()

    # 5. Trigger Celery task
    from tasks.face_recognition import process_face_recognition
    process_face_recognition.delay(str(memory_id))

    return MessageResponse(message="Face recognition queued")


@router.delete(
    "/{memory_id}/people/{person_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove person from memory",
    description="Unlink a person from this specific memory. Auto-deletes the person if no other memories reference them."
)
async def remove_person_from_memory(
    memory_id: uuid.UUID,
    person_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a person from a specific memory without necessarily deleting them globally"""
    user_id = current_user.id
    user = current_user

    memory_result = await db.execute(
        select(Memory).where(and_(Memory.id == memory_id, Memory.user_id == user.id))
    )
    memory = memory_result.scalar_one_or_none()
    if not memory:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found")

    # Find the MemoryPerson link
    mp_result = await db.execute(
        select(MemoryPerson).where(
            and_(
                MemoryPerson.memory_id == memory_id,
                MemoryPerson.person_id == person_id
            )
        )
    )
    mp = mp_result.scalar_one_or_none()
    if not mp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not associated with this memory")

    # Decrement times_detected; auto-delete person if this was their only memory
    person_result = await db.execute(
        select(Person).where(and_(Person.id == person_id, Person.user_id == user.id))
    )
    person = person_result.scalar_one_or_none()
    if person:
        person.times_detected = max(0, person.times_detected - 1)
        if person.times_detected == 0:
            await db.delete(person)

    # Delete the association row
    await db.execute(
        sa_delete(MemoryPerson).where(
            and_(
                MemoryPerson.memory_id == memory_id,
                MemoryPerson.person_id == person_id
            )
        )
    )

    # Remove face entry from ai_metadata
    meta = dict(memory.ai_metadata or {})
    if "faces" in meta and isinstance(meta["faces"], list):
        meta["faces"] = [f for f in meta["faces"] if str(f.get("person_id")) != str(person_id)]
    memory.ai_metadata = meta
    memory.updated_at = datetime.utcnow()

    await db.commit()
    return None
