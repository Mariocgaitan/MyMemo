"""
Search endpoints - Search memories by various criteria
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, text, cast, Text
from geoalchemy2.shape import from_shape
from shapely.geometry import Point
from typing import List, Optional
from datetime import datetime, date

from core.database import get_db
from core.deps import get_current_user
from models.database import Memory, User
from models.schemas import MemoryListResponse
from api.v1.endpoints.memories import memory_to_response


router = APIRouter(prefix="/search", tags=["search"])


# ============================================================
# ENDPOINTS
# ============================================================

@router.get(
    "/text",
    response_model=MemoryListResponse,
    summary="Full-text search",
    description="Search memories by text in description"
)
async def search_by_text(
    q: str = Query(..., min_length=2, description="Search query"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Search memories using PostgreSQL full-text search
    
    - **q**: Search query (minimum 2 characters)
    - **page**: Page number
    - **page_size**: Results per page
    """
    user = current_user
    
    # Build full-text search query across multiple fields:
    # description_raw + location_name + ai_metadata tags/themes/summary
    search_query = text("""
        SELECT id FROM memories
        WHERE user_id = :user_id
        AND (
            to_tsvector('spanish', COALESCE(description_raw, ''))
                @@ plainto_tsquery('spanish', :query)
            OR to_tsvector('english', COALESCE(description_raw, ''))
                @@ plainto_tsquery('english', :query)
            OR to_tsvector('spanish', COALESCE(location_name, ''))
                @@ plainto_tsquery('spanish', :query)
            OR LOWER(COALESCE(location_name, '')) LIKE LOWER('%' || :query_plain || '%')
            OR LOWER(COALESCE(ai_metadata::text, '')) LIKE LOWER('%' || :query_plain || '%')
        )
        ORDER BY ts_rank(
            to_tsvector('spanish', COALESCE(description_raw, '')) ||
            to_tsvector('english', COALESCE(description_raw, '')),
            plainto_tsquery('english', :query)
        ) DESC
        LIMIT :limit OFFSET :offset
    """)
    
    offset = (page - 1) * page_size
    
    result = await db.execute(
        search_query,
        {
            "user_id": user.id,
            "query": q,
            "query_plain": q,
            "limit": page_size,
            "offset": offset
        }
    )
    memory_ids = [row[0] for row in result.fetchall()]
    
    # Get total count
    count_query = text("""
        SELECT COUNT(*) FROM memories
        WHERE user_id = :user_id
        AND (
            to_tsvector('spanish', COALESCE(description_raw, ''))
                @@ plainto_tsquery('spanish', :query)
            OR to_tsvector('english', COALESCE(description_raw, ''))
                @@ plainto_tsquery('english', :query)
            OR to_tsvector('spanish', COALESCE(location_name, ''))
                @@ plainto_tsquery('spanish', :query)
            OR LOWER(COALESCE(location_name, '')) LIKE LOWER('%' || :query_plain || '%')
            OR LOWER(COALESCE(ai_metadata::text, '')) LIKE LOWER('%' || :query_plain || '%')
        )
    """)
    
    total_result = await db.execute(
        count_query,
        {"user_id": user.id, "query": q, "query_plain": q}
    )
    total = total_result.scalar()
    
    # Fetch full memory objects
    if memory_ids:
        memories_result = await db.execute(
            select(Memory).where(Memory.id.in_(memory_ids))
        )
        memories = memories_result.scalars().all()
        
        # Sort by original order
        id_to_memory = {str(m.id): m for m in memories}
        sorted_memories = [id_to_memory[str(mid)] for mid in memory_ids if str(mid) in id_to_memory]
    else:
        sorted_memories = []
    
    memory_responses = [memory_to_response(m) for m in sorted_memories]
    has_more = (offset + page_size) < total
    
    return MemoryListResponse(
        memories=memory_responses,
        total=total,
        page=page,
        page_size=page_size,
        has_more=has_more
    )


@router.get(
    "/nearby",
    response_model=MemoryListResponse,
    summary="Search by location",
    description="Find memories within a radius of given coordinates"
)
async def search_nearby(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(10.0, ge=0.1, le=1000, description="Search radius in kilometers"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Search memories by proximity to coordinates
    
    - **latitude/longitude**: Center point of search
    - **radius_km**: Search radius in kilometers
    """
    user = current_user
    
    # Create search point
    search_point = Point(longitude, latitude)
    geography_point = from_shape(search_point, srid=4326)
    
    radius_meters = radius_km * 1000
    offset = (page - 1) * page_size
    
    # Safe SQLAlchemy ORM Query using GeoAlchemy2 functions
    distance_col = func.ST_Distance(Memory.coordinates, geography_point).label("distance")
    
    query = (
        select(Memory)
        .where(
            and_(
                Memory.user_id == user.id,
                func.ST_DWithin(Memory.coordinates, geography_point, radius_meters)
            )
        )
        .order_by(distance_col.asc())
        .offset(offset)
        .limit(page_size)
    )
    
    result = await db.execute(query)
    sorted_memories = result.scalars().all()
    
    # Get total count
    count_query = select(func.count()).select_from(Memory).where(
        and_(
            Memory.user_id == user.id,
            func.ST_DWithin(Memory.coordinates, geography_point, radius_meters)
        )
    )
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    memory_responses = [memory_to_response(m) for m in sorted_memories]
    has_more = (offset + page_size) < total
    
    return MemoryListResponse(
        memories=memory_responses,
        total=total,
        page=page,
        page_size=page_size,
        has_more=has_more
    )


@router.get(
    "/date-range",
    response_model=MemoryListResponse,
    summary="Search by date range",
    description="Find memories created within a date range"
)
async def search_by_date_range(
    start_date: date = Query(..., description="Start date (inclusive)"),
    end_date: date = Query(..., description="End date (inclusive)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Search memories by date range
    
    - **start_date**: Start date (YYYY-MM-DD)
    - **end_date**: End date (YYYY-MM-DD)
    """
    user = current_user
    
    # Convert dates to datetime
    start_datetime = datetime.combine(start_date, datetime.min.time())
    end_datetime = datetime.combine(end_date, datetime.max.time())
    
    # Build query
    query = select(Memory).where(
        and_(
            Memory.user_id == user.id,
            Memory.created_at >= start_datetime,
            Memory.created_at <= end_datetime
        )
    ).order_by(Memory.created_at.desc())
    
    # Get total count
    count_query = select(func.count()).select_from(Memory).where(
        and_(
            Memory.user_id == user.id,
            Memory.created_at >= start_datetime,
            Memory.created_at <= end_datetime
        )
    )
    
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    
    result = await db.execute(query)
    memories = result.scalars().all()
    
    memory_responses = [memory_to_response(m) for m in memories]
    has_more = (offset + page_size) < total
    
    return MemoryListResponse(
        memories=memory_responses,
        total=total,
        page=page,
        page_size=page_size,
        has_more=has_more
    )


@router.get(
    "/tags",
    response_model=MemoryListResponse,
    summary="Search by AI-extracted tags",
    description="Find memories with specific AI-extracted tags"
)
async def search_by_tags(
    tags: List[str] = Query(..., description="List of tags to search for"),
    match_all: bool = Query(False, description="If true, memory must have ALL tags. If false, ANY tag."),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Search memories by AI-extracted tags
    
    - **tags**: List of tags (e.g., ?tags=beach&tags=sunset)
    - **match_all**: Require all tags (AND) vs any tag (OR)
    """
    user = current_user
    
    # Build JSONB query using parameterized ORM expressions (safe from SQL injection)
    if match_all:
        # Memory must contain ALL tags
        tag_conditions = [
            cast(Memory.ai_metadata['tags'], Text).ilike(f'%{tag}%')
            for tag in tags
        ]
        tag_filter = and_(*tag_conditions)
    else:
        # Memory must contain ANY tag
        tag_conditions = [
            cast(Memory.ai_metadata['tags'], Text).ilike(f'%{tag}%')
            for tag in tags
        ]
        tag_filter = or_(*tag_conditions)
    
    query = select(Memory).where(
        and_(
            Memory.user_id == user.id,
            tag_filter
        )
    ).order_by(Memory.created_at.desc())
    
    # Get total count
    count_query = select(func.count()).select_from(Memory).where(
        and_(
            Memory.user_id == user.id,
            tag_filter
        )
    )
    
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    
    result = await db.execute(query)
    memories = result.scalars().all()
    
    memory_responses = [memory_to_response(m) for m in memories]
    has_more = (offset + page_size) < total
    
    return MemoryListResponse(
        memories=memory_responses,
        total=total,
        page=page,
        page_size=page_size,
        has_more=has_more
    )
