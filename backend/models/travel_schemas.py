"""
TravelMemo pydantic schemas.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ShareMemoryResponse(BaseModel):
    public_memory_id: UUID
    status: str


class UnshareMemoryResponse(BaseModel):
    status: str


class PublicMemoryCard(BaseModel):
    id: UUID
    place_id: str
    place_name: str
    place_city: Optional[str] = None
    place_country: Optional[str] = None
    public_photo_url: str
    public_description: Optional[str] = None
    emotion_label: Optional[str] = None
    sentiment_score: Optional[float] = None
    why_this: Optional[str] = None
    distance_km: Optional[float] = None
    context_badge: Optional[str] = None
    # Stage D hook: always False until promotions go live
    is_featured: bool = False
    visit_month: Optional[int] = None
    visit_year: Optional[int] = None
    moderation_status: str
    visibility_status: str
    created_at: datetime


class MyPublicMemoriesResponse(BaseModel):
    items: List[PublicMemoryCard]


class FeedResponse(BaseModel):
    items: List[PublicMemoryCard]
    next_cursor: Optional[str] = None


class PlaceCluster(BaseModel):
    place_id: str
    place_name: str
    latitude: float
    longitude: float
    memory_count: int
    preview: Optional[PublicMemoryCard] = None


class MapClustersResponse(BaseModel):
    clusters: List[PlaceCluster]


class PlaceDetailResponse(BaseModel):
    place_id: str
    name: str
    city: Optional[str] = None
    country: Optional[str] = None
    memory_count: int = 0
    avg_sentiment: Optional[float] = None


class PlaceMemoriesResponse(BaseModel):
    place: PlaceDetailResponse
    memories: List[PublicMemoryCard]
    user_has_been_here: bool
    user_visit_count: int = 0
    visit_context: Optional[str] = None


# ---------------------------------------------------------------------------
# Discovery feed — Google Places enriched with MyMemo memories
# ---------------------------------------------------------------------------

class DiscoverPlaceCard(BaseModel):
    """A place from Google Places, enriched with MyMemo public memory data."""
    google_place_id: str
    name: str
    address: Optional[str] = None
    lat: float
    lng: float
    distance_km: Optional[float] = None
    types: List[str] = Field(default_factory=list)
    rating: Optional[float] = None
    user_ratings_total: Optional[int] = None
    open_now: Optional[bool] = None
    has_memories: bool = False
    memory_count: int = 0
    similar_users_count: int = 0
    preview_memory: Optional[PublicMemoryCard] = None
    why_this: Optional[str] = None


class DiscoverFeedResponse(BaseModel):
    places: List[DiscoverPlaceCard]


class TravelPreferencesRequest(BaseModel):
    preferred_types: List[str] = Field(default_factory=list, max_length=10)
    home_city: Optional[str] = Field(default=None, max_length=120)
    home_lat: Optional[float] = None
    home_lng: Optional[float] = None


class TravelPreferencesResponse(BaseModel):
    updated: bool
    preferred_types: List[str] = Field(default_factory=list)
    home_city: Optional[str] = None
    home_lat: Optional[float] = None
    home_lng: Optional[float] = None
    profile_vector: Dict[str, Any] = Field(default_factory=dict)


class TravelEventRequest(BaseModel):
    event_type: str = Field(..., min_length=3, max_length=32)
    place_id: str = Field(..., min_length=2, max_length=255)
    public_memory_id: Optional[UUID] = None
    session_id: Optional[str] = Field(default=None, max_length=120)


class SavePlaceResponse(BaseModel):
    saved: bool


class SavedPlaceItem(BaseModel):
    place_id: str
    place_name: str
    city: Optional[str] = None
    country: Optional[str] = None
    memory_count: int = 0
    avg_sentiment: Optional[float] = None
    saved_at: datetime


class SavedPlacesResponse(BaseModel):
    places: List[SavedPlaceItem]


# ---------------------------------------------------------------------------
# Stage D — Promotions pillar (skeleton; product UI is Post-V1)
# ---------------------------------------------------------------------------

class PromotionCard(BaseModel):
    """
    Minimal public representation of an active promotion for a place.
    Returned by GET /travel/promotions.
    Full campaign management schema lives in the Post-V1 business portal.
    """
    place_id: str
    place_name: str
    city: Optional[str] = None
    country: Optional[str] = None
    campaign_type: str
    label: str = "Destacado"


class PromotionsResponse(BaseModel):
    items: List[PromotionCard]
    coming_soon: bool = True


class TravelProfileResponse(BaseModel):
    shared_memories_count: int
    places_count: int
    top_types: List[str] = Field(default_factory=list)
    preferred_types: List[str] = Field(default_factory=list)
    items: List[PublicMemoryCard] = Field(default_factory=list)


class ModerationQueueState(BaseModel):
    moderation_status: str
    visibility_status: str
    moderation_reason: Optional[str] = None


class ReportRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500)


class MessageResponse(BaseModel):
    message: str

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "message": "ok"
            }
        }
    )
