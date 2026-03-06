"""
SQLAlchemy Database Models
Defines the database schema for LifeLog AI
"""

from sqlalchemy import (
    Column, String, Text, Integer, Float, Boolean, DateTime, 
    ForeignKey, CheckConstraint, Index, DECIMAL
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from geoalchemy2 import Geography
# from pgvector.sqlalchemy import Vector  # TODO: Uncomment when pgvector is installed

from core.database import Base
import uuid


class User(Base):
    """
    User table (for future multi-user support)
    Currently single-user system
    """
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(320), unique=True, nullable=False, index=True)
    hashed_password = Column(Text, nullable=False)
    name = Column(String(255), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    memories = relationship("Memory", back_populates="user", cascade="all, delete-orphan")
    people = relationship("Person", back_populates="user", cascade="all, delete-orphan")


class Memory(Base):
    """
    Core entity - stores memories with location, photos, and metadata
    """
    __tablename__ = "memories"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # User inputs
    description_raw = Column(Text, nullable=False)
    location_name = Column(String(255), nullable=False)
    coordinates = Column(Geography(geometry_type='POINT', srid=4326), nullable=False)
    
    # Media
    image_url = Column(Text, nullable=False)  # S3 URL original
    thumbnail_url = Column(Text, nullable=True)  # S3 URL WebP compressed
    
    # AI-generated metadata (stored as JSON)
    ai_metadata = Column(JSONB, default={}, nullable=False)
    faces_processed = Column(Boolean, default=False, nullable=False)
    
    # Visibility & status
    visibility = Column(
        String(20), 
        default='visible', 
        nullable=False,
        server_default='visible'
    )
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Constraints
    __table_args__ = (
        CheckConstraint(
            "visibility IN ('visible', 'archived', 'hidden')",
            name='valid_visibility'
        ),
        # GIN index for JSONB metadata search
        Index('idx_memories_ai_metadata', 'ai_metadata', postgresql_using='gin'),
        # Note: GeoAlchemy2 automatically creates GIST index for Geography columns
    )
    
    # Relationships
    user = relationship("User", back_populates="memories")
    people_associations = relationship("MemoryPerson", back_populates="memory", cascade="all, delete-orphan")


class Person(Base):
    """
    People recognized in photos via face recognition
    """
    __tablename__ = "people"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    
    # Face embedding vector (128-d for face_recognition library)
    # TODO: Uncomment when pgvector is installed
    # face_embedding = Column(Vector(128), nullable=False)
    face_embedding = Column(Text, nullable=False)  # Temporary: store as JSON string
    
    # Face thumbnail (cropped from a memory photo)
    thumbnail_url = Column(String(500), nullable=True)
    
    # Metadata
    times_detected = Column(Integer, default=1, nullable=False)
    last_seen = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Constraints
    __table_args__ = (
        # Unique constraint: one person name per user
        Index('idx_unique_person_per_user', 'user_id', 'name', unique=True),
        # TODO: Uncomment when pgvector is installed
        # Vector similarity index
        # Index('idx_people_embedding', 'face_embedding', postgresql_using='ivfflat',
        #       postgresql_ops={'face_embedding': 'vector_cosine_ops'},
        #       postgresql_with={'lists': 100}),
    )
    
    # Relationships
    user = relationship("User", back_populates="people")
    memory_associations = relationship("MemoryPerson", back_populates="person", cascade="all, delete-orphan")


class MemoryPerson(Base):
    """
    Many-to-many relationship between memories and people
    Stores confidence scores for face recognition
    """
    __tablename__ = "memory_people"
    
    memory_id = Column(UUID(as_uuid=True), ForeignKey("memories.id", ondelete="CASCADE"), primary_key=True)
    person_id = Column(UUID(as_uuid=True), ForeignKey("people.id", ondelete="CASCADE"), primary_key=True)
    confidence_score = Column(Float, nullable=True)  # 0.0 to 1.0
    
    # Relationships
    memory = relationship("Memory", back_populates="people_associations")
    person = relationship("Person", back_populates="memory_associations")


class ProcessingJob(Base):
    """
    Tracks async AI processing jobs (face recognition, NLP)
    """
    __tablename__ = "processing_jobs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    memory_id = Column(UUID(as_uuid=True), ForeignKey("memories.id", ondelete="CASCADE"), nullable=False)
    
    job_type = Column(String(50), nullable=False)  # 'face_recognition', 'nlp_extraction'
    status = Column(String(20), default='pending', nullable=False)  # 'pending', 'processing', 'completed', 'failed'
    
    attempts = Column(Integer, default=0, nullable=False)
    max_attempts = Column(Integer, default=3, nullable=False)
    error_message = Column(Text, nullable=True)
    
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Constraints
    __table_args__ = (
        CheckConstraint(
            "job_type IN ('face_recognition', 'nlp_extraction')",
            name='valid_job_type'
        ),
        CheckConstraint(
            "status IN ('pending', 'processing', 'completed', 'failed')",
            name='valid_status'
        ),
        Index('idx_jobs_status', 'status', 'created_at'),
    )


class UsageMetric(Base):
    """
    Tracks usage metrics for cost management
    """
    __tablename__ = "usage_metrics"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    metric_type = Column(String(50), nullable=False)  # 'openai_tokens', 's3_storage_mb', 'face_detection'
    metric_value = Column(Float, nullable=False)
    cost_usd = Column(DECIMAL(10, 4), default=0, nullable=False)
    
    extra_data = Column(JSONB, default={}, nullable=False)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Indexes
    __table_args__ = (
        Index('idx_usage_metrics_date', 'user_id', 'recorded_at'),
    )


class MemoryVersion(Base):
    """
    Stores edit history for memories (Phase 2)
    Allows tracking changes to memory descriptions
    """
    __tablename__ = "memory_versions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    memory_id = Column(UUID(as_uuid=True), ForeignKey("memories.id", ondelete="CASCADE"), nullable=False)
    
    description_raw = Column(Text, nullable=False)
    ai_metadata_snapshot = Column(JSONB, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
