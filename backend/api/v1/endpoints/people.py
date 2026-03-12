"""
People management endpoints - Manage recognized faces
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, delete, update
from sqlalchemy.exc import IntegrityError
from typing import List
import uuid
import json

MAX_ENCODINGS_PER_PERSON = 5


def _merge_encodings(source_embedding: str, target_embedding: str) -> str:
    """Combine face embeddings from two Person records, keeping up to MAX_ENCODINGS_PER_PERSON.
    Merging preserves the target's encodings first, then appends the source's.
    This ensures the stable/named person's encodings stay dominant."""
    def _parse(raw):
        if not raw:
            return []
        try:
            parsed = json.loads(raw)
            if parsed and isinstance(parsed[0], list):
                return parsed
            return [parsed]  # flat single encoding (edge case)
        except Exception:
            # Legacy comma-separated format
            return [[float(x) for x in raw.split(",")]]

    target_encs = _parse(target_embedding)
    source_encs = _parse(source_embedding)
    combined = (target_encs + source_encs)[:MAX_ENCODINGS_PER_PERSON]
    return json.dumps(combined)

from core.database import get_db
from core.deps import get_current_user
from models.database import Person, User, MemoryPerson, Memory
from models.schemas import PersonCreate, PersonResponse, MemoryResponse
from api.v1.endpoints.memories import memory_to_response
from services.storage_service import storage_service
from sqlalchemy.orm.attributes import flag_modified


async def _patch_ai_metadata_face_id(
    db: AsyncSession,
    memory_id: uuid.UUID,
    old_person_id: uuid.UUID,
    new_person_id: uuid.UUID,
):
    """Replace person_id in ai_metadata.faces so client-side filtering works correctly."""
    mem_result = await db.execute(select(Memory).where(Memory.id == memory_id))
    mem = mem_result.scalar_one_or_none()
    if not mem or not mem.ai_metadata:
        return
    faces = mem.ai_metadata.get("faces", [])
    if not isinstance(faces, list):
        return
    changed = False
    for face in faces:
        if str(face.get("person_id")) == str(old_person_id):
            face["person_id"] = str(new_person_id)
            changed = True
    if changed:
        flag_modified(mem, "ai_metadata")


def person_to_response(person: Person) -> PersonResponse:
    """Convert Person ORM model to response schema with fresh presigned URL"""
    fresh_thumbnail_url = None
    if person.thumbnail_url:
        # Generate fresh 7-day presigned url to avoid expired tokens in UI
        fresh_thumbnail_url = storage_service.get_presigned_url(
            f"faces/{person.id}.jpg", storage_service.thumbnails_bucket
        )

    return PersonResponse(
        id=person.id,
        user_id=person.user_id,
        name=person.name,
        thumbnail_url=fresh_thumbnail_url,
        times_detected=person.times_detected,
        last_seen=person.last_seen,
        created_at=person.created_at
    )


router = APIRouter(prefix="/people", tags=["people"])


# ============================================================
# ENDPOINTS
# ============================================================

@router.get(
    "",
    response_model=List[PersonResponse],
    summary="List all recognized people",
    description="Get list of all people recognized in memories. Optionally filter by memory_id."
)
async def list_people(
    memory_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all people for the current user, optionally filtered by memory"""
    user_id = current_user.id
    user = current_user
    
    # If memory_id provided, get only people in that memory
    if memory_id:
        result = await db.execute(
            select(Person)
            .join(MemoryPerson, Person.id == MemoryPerson.person_id)
            .where(
                and_(
                    Person.user_id == user.id,
                    MemoryPerson.memory_id == memory_id
                )
            )
        )
    else:
        # Get all people for user
        result = await db.execute(
            select(Person)
            .where(Person.user_id == user.id)
            .order_by(Person.times_detected.desc())
        )
    
    people = result.scalars().all()
    
    return [person_to_response(p) for p in people]


@router.get(
    "/{person_id}",
    response_model=PersonResponse,
    summary="Get person details",
    description="Get detailed information about a specific person"
)
async def get_person(
    person_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single person by ID"""
    user_id = current_user.id
    user = current_user
    
    result = await db.execute(
        select(Person).where(
            and_(
                Person.id == person_id,
                Person.user_id == user.id
            )
        )
    )
    person = result.scalar_one_or_none()
    
    if not person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Person not found"
        )
    
    return person_to_response(person)


@router.get(
    "/{person_id}/memories",
    response_model=List[MemoryResponse],
    summary="Get memories with this person",
    description="Get all memories where this person appears"
)
async def get_person_memories(
    person_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all memories containing this person"""
    user_id = current_user.id
    user = current_user
    
    # Verify person exists and belongs to user
    person_result = await db.execute(
        select(Person).where(
            and_(
                Person.id == person_id,
                Person.user_id == user.id
            )
        )
    )
    person = person_result.scalar_one_or_none()
    
    if not person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Person not found"
        )
    
    # Get all memories with this person
    result = await db.execute(
        select(Memory)
        .join(MemoryPerson, Memory.id == MemoryPerson.memory_id)
        .where(MemoryPerson.person_id == person_id)
        .order_by(Memory.created_at.desc())
    )
    memories = result.scalars().all()
    
    return [memory_to_response(m) for m in memories]


@router.patch(
    "/{person_id}",
    response_model=PersonResponse,
    summary="Update person name",
    description="Update the name of a recognized person"
)
async def update_person(
    person_id: uuid.UUID,
    person_data: PersonCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update person's name"""
    user_id = current_user.id  # capture before any await to avoid session expiry

    result = await db.execute(
        select(Person).where(
            and_(
                Person.id == person_id,
                Person.user_id == user_id
            )
        )
    )
    person = result.scalar_one_or_none()

    if not person:
        # Person record is missing (orphaned ai_metadata face reference).
        # Pre-check: does a person with this name already exist for this user?
        existing_named_result = await db.execute(
            select(Person).where(
                and_(Person.user_id == user_id, Person.name == person_data.name)
            )
        )
        named_person = existing_named_result.scalar_one_or_none()

        # Helper: ensure memory link exists for a given person
        async def _ensure_memory_link(linked_person_id):
            if not person_data.memory_id:
                return
            try:
                mem_uuid = uuid.UUID(person_data.memory_id)
            except ValueError:
                return
            link_check = await db.execute(
                select(MemoryPerson).where(
                    and_(
                        MemoryPerson.memory_id == mem_uuid,
                        MemoryPerson.person_id == linked_person_id,
                    )
                )
            )
            if not link_check.scalar_one_or_none():
                db.add(MemoryPerson(
                    memory_id=mem_uuid,
                    person_id=linked_person_id,
                    confidence_score=1.0,
                ))

        if named_person:
            # A person with that name already exists — link this memory to them
            # Also rewrite ai_metadata so the face points to the real person_id
            await _ensure_memory_link(named_person.id)
            if person_data.memory_id:
                try:
                    await _patch_ai_metadata_face_id(
                        db, uuid.UUID(person_data.memory_id), person_id, named_person.id
                    )
                except ValueError:
                    pass
            await db.commit()
            return person_to_response(named_person)

        # No existing person with that name — create a fresh Person row
        new_person = Person(
            id=person_id,
            user_id=user_id,
            name=person_data.name,
            face_embedding=json.dumps([]),  # no encoding — rebuilt on next rerun
            times_detected=1,
        )
        db.add(new_person)
        await _ensure_memory_link(person_id)
        await db.commit()
        await db.refresh(new_person)
        return person_to_response(new_person)

    # Update name — si ya existe una persona con ese nombre, hacer merge
    # (reasignar las memorias al existente y eliminar el duplicado)
    try:
        person.name = person_data.name
        await db.commit()
        await db.refresh(person)
        return person_to_response(person)
    except IntegrityError:
        await db.rollback()
        # Busca la persona existente con ese nombre
        existing_result = await db.execute(
            select(Person).where(
                and_(
                    Person.user_id == user_id,
                    Person.name == person_data.name
                )
            )
        )
        existing_person = existing_result.scalar_one_or_none()
        if not existing_person:
            raise HTTPException(status_code=500, detail="Error al actualizar nombre")

        # Merge face encodings from the renamed person into the existing one
        # This preserves all known face data instead of losing the source encodings
        existing_person.face_embedding = _merge_encodings(
            person.face_embedding, existing_person.face_embedding
        )
        # Copy thumbnail if existing person has none
        if not existing_person.thumbnail_url and person.thumbnail_url:
            existing_person.thumbnail_url = person.thumbnail_url
        # Update detection count
        existing_person.times_detected += person.times_detected

        # Patch ai_metadata.faces in all memories that reference the old person_id
        affected_mems = await db.execute(
            select(MemoryPerson.memory_id).where(MemoryPerson.person_id == person_id)
        )
        for (mem_id,) in affected_mems.fetchall():
            await _patch_ai_metadata_face_id(db, mem_id, person_id, existing_person.id)

        # Reasigna las memorias de la persona duplicada a la existente
        await db.execute(
            update(MemoryPerson)
            .where(MemoryPerson.person_id == person_id)
            .values(person_id=existing_person.id)
        )
        # Elimina la persona duplicada
        await db.execute(delete(Person).where(Person.id == person_id))
        await db.commit()
        await db.refresh(existing_person)
        return person_to_response(existing_person)


@router.delete(
    "/{person_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete person",
    description="Delete a person and all their associations with memories"
)
async def delete_person(
    person_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a person"""
    user_id = current_user.id
    user = current_user
    
    result = await db.execute(
        select(Person).where(
            and_(
                Person.id == person_id,
                Person.user_id == user.id
            )
        )
    )
    person = result.scalar_one_or_none()
    
    if not person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Person not found"
        )
    
    # Delete person (CASCADE will delete memory_people associations)
    await db.delete(person)
    await db.commit()
    
    return None


@router.post(
    "/{person_id}/merge/{target_person_id}",
    response_model=PersonResponse,
    summary="Merge two people",
    description="Merge two person records (useful when same person was recognized as different people)"
)
async def merge_people(
    person_id: uuid.UUID,
    target_person_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Merge person_id into target_person_id
    - All memories associated with person_id will be reassigned to target_person_id
    - person_id will be deleted
    """
    user_id = current_user.id
    user = current_user
    
    # Get both people
    result = await db.execute(
        select(Person).where(
            and_(
                Person.id.in_([person_id, target_person_id]),
                Person.user_id == user.id
            )
        )
    )
    people = result.scalars().all()
    
    if len(people) != 2:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or both people not found"
        )
    
    source_person = next(p for p in people if p.id == person_id)
    target_person = next(p for p in people if p.id == target_person_id)
    
    # Update all memory_people associations
    # First patch ai_metadata so filters work correctly after merge
    affected_mems = await db.execute(
        select(MemoryPerson.memory_id).where(MemoryPerson.person_id == person_id)
    )
    for (mem_id,) in affected_mems.fetchall():
        await _patch_ai_metadata_face_id(db, mem_id, person_id, target_person_id)

    await db.execute(
        MemoryPerson.__table__.update()
        .where(MemoryPerson.person_id == person_id)
        .values(person_id=target_person_id)
    )

    # Merge face encodings so the target person gains the source's encodings.
    # More encodings = better matching for future photos from different angles.
    target_person.face_embedding = _merge_encodings(
        source_person.face_embedding, target_person.face_embedding
    )
    # Copy thumbnail if target has none
    if not target_person.thumbnail_url and source_person.thumbnail_url:
        target_person.thumbnail_url = source_person.thumbnail_url

    # Update target person stats
    target_person.times_detected += source_person.times_detected

    # Delete source person
    await db.delete(source_person)
    
    await db.commit()
    await db.refresh(target_person)
    
    return person_to_response(target_person)
