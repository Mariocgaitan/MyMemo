"""
TravelMemo SQLAlchemy models.
"""

import uuid

from geoalchemy2 import Geography
from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.sql import func

from core.database import Base


class PublicMemory(Base):
    __tablename__ = "public_memories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_memory_id = Column(UUID(as_uuid=True), ForeignKey("memories.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    place_id = Column(Text, nullable=False, index=True)
    place_name = Column(Text, nullable=False)
    place_city = Column(Text, nullable=True)
    place_country = Column(Text, nullable=True)
    place_types = Column(ARRAY(Text), nullable=False, server_default="{}")

    public_photo_url = Column(Text, nullable=False)
    public_description = Column(Text, nullable=True)
    emotion_label = Column(Text, nullable=True)
    sentiment_score = Column(Float, nullable=True)
    visit_month = Column(Integer, nullable=True)
    visit_year = Column(Integer, nullable=True)
    extra_photos = Column(JSONB, nullable=False, server_default="[]")

    visibility_status = Column(String(20), nullable=False, server_default="pending")
    moderation_status = Column(String(20), nullable=False, server_default="pending")
    moderation_checked_at = Column(DateTime(timezone=True), nullable=True)
    moderation_reason = Column(Text, nullable=True)

    location = Column(Geography(geometry_type="POINT", srid=4326), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint(
            "visibility_status IN ('pending', 'active', 'hidden', 'hard_deleted')",
            name="valid_public_visibility_status",
        ),
        CheckConstraint(
            "moderation_status IN ('pending', 'approved', 'rejected', 'flagged')",
            name="valid_public_moderation_status",
        ),
        Index("idx_pm_source", "source_memory_id"),
        Index("idx_pm_user", "user_id"),
        Index("idx_pm_location", "location", postgresql_using="gist"),
        Index("idx_pm_feed", "visibility_status", "moderation_status", "created_at"),
        Index("idx_pm_place_types", "place_types", postgresql_using="gin"),
    )


class PlaceCatalog(Base):
    __tablename__ = "places_catalog"

    place_id = Column(Text, primary_key=True)
    name = Column(Text, nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    types = Column(ARRAY(Text), nullable=False, server_default="{}")
    city = Column(Text, nullable=True)
    country = Column(Text, nullable=True)
    location = Column(Geography(geometry_type="POINT", srid=4326), nullable=False)

    memory_count = Column(Integer, nullable=False, server_default="0")
    avg_sentiment = Column(Float, nullable=False, server_default="0.5")
    boost_weight = Column(Float, nullable=False, server_default="0.0")

    last_enriched_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        Index("idx_pc_location", "location", postgresql_using="gist"),
        Index("idx_pc_types", "types", postgresql_using="gin"),
    )


class RecommendationEvent(Base):
    __tablename__ = "recommendation_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    event_type = Column(Text, nullable=False)
    place_id = Column(Text, nullable=False)
    public_memory_id = Column(UUID(as_uuid=True), ForeignKey("public_memories.id", ondelete="SET NULL"), nullable=True)
    session_id = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint(
            "event_type IN ('view', 'click', 'save', 'hide', 'visit_intent', 'report')",
            name="valid_recommendation_event_type",
        ),
        Index("idx_re_user_time", "user_id", "created_at"),
        Index("idx_re_place", "place_id", "event_type"),
    )


class UserTravelPreference(Base):
    __tablename__ = "user_travel_preferences"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    preferred_types = Column(ARRAY(Text), nullable=False, server_default="{}")
    home_city = Column(Text, nullable=True)
    home_lat = Column(Float, nullable=True)
    home_lng = Column(Float, nullable=True)
    profile_vector = Column(JSONB, nullable=False, server_default="{}")
    last_computed_at = Column(DateTime(timezone=True), nullable=True)


class SavedPlace(Base):
    __tablename__ = "saved_places"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    place_id = Column(Text, primary_key=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class PlacePromotion(Base):
    """
    Stage D — monetization skeleton (not yet active).

    A row here means a place has an active or scheduled promotion.
    The feed ranking hook reads `boost_weight` from `places_catalog`
    (written by the activation job) — this table is the source of truth
    for business rules.  The product UI that creates campaigns is Post-V1.
    """
    __tablename__ = "place_promotions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    place_id = Column(Text, ForeignKey("places_catalog.place_id", ondelete="CASCADE"), nullable=False)

    # Campaign identity (filled by business onboarding — Post-V1)
    sponsor_name = Column(Text, nullable=True)
    campaign_type = Column(String(32), nullable=False, server_default="standard")

    # Ranking boost: value in [0.0, 0.15] added to composite score.
    # Capped to prevent domination.  Default 0.05 = +5% in scoring formula.
    boost_weight = Column(Float, nullable=False, server_default="0.05")

    # Campaign window
    starts_at = Column(DateTime(timezone=True), nullable=True)
    ends_at = Column(DateTime(timezone=True), nullable=True)

    # Quality gate: place must have this many approved organic memories before boost applies.
    min_organic_memories = Column(Integer, nullable=False, server_default="5")

    status = Column(String(20), nullable=False, server_default="draft")

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint(
            "status IN ('draft', 'active', 'paused', 'ended')",
            name="valid_promotion_status",
        ),
        CheckConstraint(
            "campaign_type IN ('standard', 'featured', 'event')",
            name="valid_promotion_campaign_type",
        ),
        CheckConstraint(
            "boost_weight >= 0.0 AND boost_weight <= 0.15",
            name="valid_promotion_boost_weight",
        ),
        Index("idx_promo_place", "place_id"),
        Index("idx_promo_active", "status", "starts_at", "ends_at"),
    )
