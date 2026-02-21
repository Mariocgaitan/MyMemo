"""
People management endpoints - Manage recognized faces
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, delete
from typing import List
import uuid

from core.database import get_db
from models.database import Person, User, MemoryPerson, Memory
from models.schemas import PersonCreate, PersonResponse, MemoryResponse
from api.v1.endpoints.memories import get_default_user, memory_to_response


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
    db: AsyncSession = Depends(get_db)
):
    """List all people for the current user, optionally filtered by memory"""
    user = await get_default_user(db)
    
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
    
    return people


@router.get(
    "/{person_id}",
    response_model=PersonResponse,
    summary="Get person details",
    description="Get detailed information about a specific person"
)
async def get_person(
    person_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get a single person by ID"""
    user = await get_default_user(db)
    
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
    
    return person


@router.get(
    "/{person_id}/memories",
    response_model=List[MemoryResponse],
    summary="Get memories with this person",
    description="Get all memories where this person appears"
)
async def get_person_memories(
    person_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get all memories containing this person"""
    user = await get_default_user(db)
    
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
    db: AsyncSession = Depends(get_db)
):
    """Update person's name"""
    user = await get_default_user(db)
    
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
    
    # Update name
    person.name = person_data.name
    
    await db.commit()
    await db.refresh(person)
    
    return person


@router.delete(
    "/{person_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete person",
    description="Delete a person and all their associations with memories"
)
async def delete_person(
    person_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """Delete a person"""
    user = await get_default_user(db)
    
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
    db: AsyncSession = Depends(get_db)
):
    """
    Merge person_id into target_person_id
    - All memories associated with person_id will be reassigned to target_person_id
    - person_id will be deleted
    """
    user = await get_default_user(db)
    
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
    await db.execute(
        MemoryPerson.__table__.update()
        .where(MemoryPerson.person_id == person_id)
        .values(person_id=target_person_id)
    )
    
    # Update target person stats
    target_person.times_detected += source_person.times_detected
    
    # Delete source person
    await db.delete(source_person)
    
    await db.commit()
    await db.refresh(target_person)
    
    return target_person
