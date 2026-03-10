"""
Pydantic schemas for request/response validation
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field, field_validator, ConfigDict
from enum import Enum


# ============================================================
# ENUMS
# ============================================================

class VisibilityEnum(str, Enum):
    """Memory visibility status"""
    visible = "visible"
    archived = "archived"
    hidden = "hidden"


class JobTypeEnum(str, Enum):
    """Processing job types"""
    face_recognition = "face_recognition"
    nlp_extraction = "nlp_extraction"


class JobStatusEnum(str, Enum):
    """Processing job status"""
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"


# ============================================================
# MEMORY SCHEMAS
# ============================================================

class CoordinatesSchema(BaseModel):
    """GPS coordinates validation"""
    latitude: float = Field(..., ge=-90, le=90, description="Latitude between -90 and 90")
    longitude: float = Field(..., ge=-180, le=180, description="Longitude between -180 and 180")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "latitude": 19.4326,
                "longitude": -99.1332
            }
        }
    )


class MemoryCreate(BaseModel):
    """Request schema for creating a memory"""
    description: str = Field(..., min_length=1, max_length=5000, description="User's description of the memory")
    location_name: str = Field(..., min_length=1, max_length=255, description="Name of the location")
    coordinates: CoordinatesSchema = Field(..., description="GPS coordinates")
    image_base64: str = Field(..., description="Base64-encoded image data (JPEG/PNG)")
    categories: str | None = Field(None, description="Comma-separated list of categories")
    tagged_people: str | None = Field(None, description="Comma-separated list of people names (for manual tagging)")
    memory_date: Optional[datetime] = Field(None, description="Custom date for the memory (defaults to now if not set)")
    
    @field_validator('image_base64')
    @classmethod
    def validate_image_base64(cls, v: str) -> str:
        """Validate base64 image format, size, and MIME type (JPEG/PNG/WebP only)"""
        import base64

        # Remove data URI prefix if present
        if ',' in v:
            header, data = v.split(',', 1)
            if not header.startswith('data:image/'):
                raise ValueError("Invalid image data URI header")
            v = data

        # Decode and check size
        try:
            decoded = base64.b64decode(v)
        except Exception:
            raise ValueError("Invalid base64 image data")

        if len(decoded) > 10 * 1024 * 1024:
            raise ValueError("Image size exceeds 10MB limit")

        # Validate magic bytes — only allow JPEG, PNG, WebP
        # JPEG: FF D8 FF
        # PNG:  89 50 4E 47
        # WebP: 52 49 46 46 ... 57 45 42 50
        is_jpeg = decoded[:3] == b'\xff\xd8\xff'
        is_png = decoded[:4] == b'\x89PNG'
        is_webp = decoded[:4] == b'RIFF' and decoded[8:12] == b'WEBP'
        if not (is_jpeg or is_png or is_webp):
            raise ValueError("Only JPEG, PNG, and WebP images are allowed")

        return v
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "description": "Beautiful sunset at the beach with friends",
                "location_name": "Playa del Carmen",
                "coordinates": {
                    "latitude": 20.6296,
                    "longitude": -87.0739
                },
                "image_base64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
            }
        }
    )


class MemoryResponse(BaseModel):
    """Response schema for memory data"""
    id: UUID
    user_id: UUID
    description_raw: str
    location_name: str
    latitude: float
    longitude: float
    image_url: str
    thumbnail_url: Optional[str]
    ai_metadata: Dict[str, Any]
    faces_processed: bool
    visibility: VisibilityEnum
    memory_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    # Populated only for memories shared by a connected user
    shared_by: Optional["SharedByInfo"] = None
    
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "user_id": "123e4567-e89b-12d3-a456-426614174000",
                "description_raw": "Beautiful sunset at the beach",
                "location_name": "Playa del Carmen",
                "latitude": 20.6296,
                "longitude": -87.0739,
                "image_url": "https://mymemo-images-prod-2026.s3.us-east-2.amazonaws.com/memories/550e8400-e29b-41d4-a716-446655440000.jpg",
                "thumbnail_url": "https://mymemo-thumbnails-prod-2026.s3.us-east-2.amazonaws.com/memories/550e8400-e29b-41d4-a716-446655440000.webp",
                "ai_metadata": {
                    "tags": ["beach", "sunset", "vacation"],
                    "entities": ["Playa del Carmen"],
                    "sentiment": "positive"
                },
                "faces_processed": False,
                "visibility": "visible",
                "created_at": "2026-02-16T18:30:00Z",
                "updated_at": "2026-02-16T18:30:00Z"
            }
        }
    )


class MemoryListResponse(BaseModel):
    """Response schema for paginated memory list"""
    memories: List[MemoryResponse]
    total: int
    page: int
    page_size: int
    has_more: bool
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "memories": [],
                "total": 42,
                "page": 1,
                "page_size": 20,
                "has_more": True
            }
        }
    )


class MemoryUpdate(BaseModel):
    """Request schema for updating a memory"""
    description: Optional[str] = Field(None, min_length=1, max_length=5000)
    location_name: Optional[str] = Field(None, min_length=1, max_length=255)
    visibility: Optional[VisibilityEnum] = None
    memory_date: Optional[datetime] = None


# ============================================================
# PERSON SCHEMAS
# ============================================================

class PersonCreate(BaseModel):
    """Request schema for creating/updating a person"""
    name: str = Field(..., min_length=1, max_length=255, description="Name of the person")
    # Optional: memory_id the face belongs to — used to re-create orphaned person records
    memory_id: Optional[str] = Field(None, description="Memory ID where this face was detected")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "John Doe"
            }
        }
    )


class PersonResponse(BaseModel):
    """Response schema for person data"""
    id: UUID
    user_id: UUID
    name: str
    thumbnail_url: Optional[str] = None
    times_detected: int
    last_seen: datetime
    created_at: datetime
    
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440001",
                "user_id": "123e4567-e89b-12d3-a456-426614174000",
                "name": "John Doe",
                "times_detected": 15,
                "last_seen": "2026-02-16T18:30:00Z",
                "created_at": "2026-01-01T10:00:00Z"
            }
        }
    )


class MemoryPersonLink(BaseModel):
    """Schema for linking person to memory with confidence"""
    person: PersonResponse
    confidence_score: Optional[float] = Field(None, ge=0.0, le=1.0)


# ============================================================
# PROCESSING JOB SCHEMAS
# ============================================================

class ProcessingJobResponse(BaseModel):
    """Response schema for processing job status"""
    id: UUID
    memory_id: UUID
    job_type: JobTypeEnum
    status: JobStatusEnum
    attempts: int
    max_attempts: int
    error_message: Optional[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime
    
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440002",
                "memory_id": "550e8400-e29b-41d4-a716-446655440000",
                "job_type": "face_recognition",
                "status": "processing",
                "attempts": 1,
                "max_attempts": 3,
                "error_message": None,
                "started_at": "2026-02-16T18:30:05Z",
                "completed_at": None,
                "created_at": "2026-02-16T18:30:00Z"
            }
        }
    )


# ============================================================
# USAGE METRICS SCHEMAS
# ============================================================

class UsageMetricResponse(BaseModel):
    """Response schema for usage metrics"""
    id: UUID
    user_id: UUID
    metric_type: str
    metric_value: float
    cost_usd: float
    extra_data: Dict[str, Any]
    recorded_at: datetime
    
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440003",
                "user_id": "123e4567-e89b-12d3-a456-426614174000",
                "metric_type": "openai_api_call",
                "metric_value": 1.0,
                "cost_usd": 0.0015,
                "extra_data": {
                    "model": "gpt-4o-mini",
                    "tokens_used": 500
                },
                "recorded_at": "2026-02-16T18:30:00Z"
            }
        }
    )


class UsageSummaryResponse(BaseModel):
    """Response schema for aggregated usage metrics"""
    total_memories: int
    total_api_calls: int
    total_cost_usd: float
    period_start: datetime
    period_end: datetime
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "total_memories": 150,
                "total_api_calls": 450,
                "total_cost_usd": 12.50,
                "period_start": "2026-02-01T00:00:00Z",
                "period_end": "2026-02-16T23:59:59Z"
            }
        }
    )


# ============================================================
# USER SCHEMAS
# ============================================================

class UserResponse(BaseModel):
    """Response schema for user data"""
    id: UUID
    email: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "email": "user@example.com",
                "created_at": "2026-01-01T00:00:00Z",
                "updated_at": "2026-02-16T18:30:00Z"
            }
        }
    )


# ============================================================
# GENERIC RESPONSE SCHEMAS
# ============================================================

class MessageResponse(BaseModel):
    """Generic message response"""
    message: str
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "message": "Operation completed successfully"
            }
        }
    )


class ErrorResponse(BaseModel):
    """Error response schema"""
    error: str
    detail: Optional[str] = None
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "error": "ValidationError",
                "detail": "Invalid coordinates provided"
            }
        }
    )


# ============================================================
# CONNECTION SCHEMAS
# ============================================================

class ConnectionStatusEnum(str, Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"


class ConnectionCreate(BaseModel):
    """Send a connection request to another user"""
    user_id: UUID = Field(..., description="ID of the target user (obtain via /connections/search)")
    person_id: Optional[UUID] = Field(None, description="Person record in your DB that represents this user")


class ConnectionStyleUpdate(BaseModel):
    """Update border color/style for shared memory cards"""
    border_color: str = Field(..., pattern=r"^#[0-9A-Fa-f]{6}$", description="Hex color, e.g. #8B6F47")
    border_style: str = Field(..., pattern=r"^(solid|dashed|glow)$", description="Border style")


class ConnectionAccept(BaseModel):
    """Accept a connection and optionally link the requester's Person record"""
    person_id: Optional[UUID] = Field(None, description="Person record in your DB that represents the requester")


class ConnectionUserInfo(BaseModel):
    """Minimal user info exposed in connection responses"""
    id: UUID
    name: Optional[str]

    model_config = ConfigDict(from_attributes=True)


class ConnectionResponse(BaseModel):
    """Full connection record"""
    id: UUID
    requester: ConnectionUserInfo
    addressee: ConnectionUserInfo
    person_id_in_requester: Optional[UUID]
    person_id_in_addressee: Optional[UUID]
    status: ConnectionStatusEnum
    border_color_requester: str
    border_style_requester: str
    border_color_addressee: str
    border_style_addressee: str
    created_at: datetime
    accepted_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


class SharedByInfo(BaseModel):
    """Metadata attached to a shared memory"""
    user_id: UUID
    name: Optional[str]
    border_color: str
    border_style: str


# Resolve forward reference in MemoryResponse.shared_by
MemoryResponse.model_rebuild()
