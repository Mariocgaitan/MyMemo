# MyTravelMemo - Implementation Blueprint

## Scope lock for current coding phase

- Revenue-generation features are deferred.
- Do not implement ads, sponsored placements, campaign management, or billing in this phase.
- Focus only on community/product core: sharing, discovery, moderation, personalization v1.

## Must-have V1 (Execution Contract)

- Public share flow from private memory (toggle + privacy preview)
- Public data projection table with strict field copy rules
- Feed + map explore + place detail endpoints
- Rule-based ranking v1 with soft recency decay
- Moderation pipeline v1 (text + image) with best-effort human review
- Manual appeals by admin in MVP
- Save place interaction and telemetry base
- Security guardrails: ownership checks, response filtering, rate limits

## Post-V1 (Deferred)

- Promotions/sponsored inventory in product flows
- Billing, campaigns, and business onboarding
- Advanced monetization ranking layer
- Full business portal
- ML ranking phase
- Social interaction modules (comments, replies, follow)

## 0. Strategic Assessment (Pre-Code Evaluation)

### What the current strategy gets right

**Infrastructure inheritance (zero cost to unlock):**
- Every existing Memory already has `ai_metadata.nlp` with emotion label, sentiment score, topics, and activities. This is the recommendation engine Phase 1 input — it exists already, free.
- PostGIS `GEOGRAPHY(POINT, 4326)` is the coordinate type used in `memories`. The geo queries for TravelMemo feed and map are one `ST_DWithin` extension — same engine already running.
- pgvector is in the DB schema (currently deactivated, waiting for the extension install). When enabled, embedding similarity for place matching costs nothing to add.
- Celery + Redis is live. A moderation task is simply a third task type on the same workers.
- Google Places API already integrated and paid for in `search.py`. Place metadata is free to cache as public memories are shared.
- `UserConnection` (friend graph) already exists. Social signals for Phase 2 recommendation are available from day 1.

**Data model isolation is correct:**
- The public/private boundary is structurally sound. `public_memories` copying fields from `memories` at publish time (rather than joining live) means there is no possible API response that leaks private data through a bug in a JOIN. This is the right design.

### Real limitations to plan around

**1. Cold start content problem (critical)**
The feed is empty at launch. A product that shows a feed of 3 cards is not a product. This is the single biggest risk.
- Mitigation: before public launch, seed with Mario's own memories and a curated set of real places. The system needs a visible minimum of ~30–50 cards from ~10+ distinct places to feel alive. This is not synthetic — it's real data from the creator.

**2. Anonymous profile creates a trust gap**
Decision 18 locks anonymous public profile. Without knowing if a reviewer is a local, a tourist, or a business owner, the credibility of a memory card is unclear.
- Mitigation in v1: derive and display a `context_badge` — "Visited 3 times" or "Lived here 6+ months" or "Traveler passing through" — inferred from private memory history (frequency and date range at that location). This adds trust signal without breaking anonymity.

**3. No social interaction in v1 makes the feed feel static**
Read-only cards with no reactions, no bookmark, no "I want to go here" action creates a digital brochure, not a community.
- Mitigation: add a single lightweight interaction — a `save` button (bookmark place to a personal list). This is not a social signal (no public count shown), but it gives the user something to do on a card. It also becomes the highest-quality signal for recommendation Phase 2.

**4. One photo per public memory limits visual richness**
The current `Memory` model stores one `image_url`. TravelMemo competes visually against Google Maps and Instagram. One photo per card works for MVP, but feels thin.
- Decision for later: in Stage B, allow up to 3 photos per public memory stored as a JSONB array. Not MVP. Do not design the schema to be blocked by this — store `extra_photos JSONB DEFAULT '[]'` from day one but leave UI for later.

**5. Recommendation circular dependency for new users**
New users of MyMemo have no private memory history → profile_vector is empty → recommendation is geography-only for them. This degrades TravelMemo for new users specifically.
- Mitigation already planned (cold start chips). Confirmed by decision 9. Execute properly: the 3-5 interest chips on first visit must actually persist to `user_travel_preferences.preferred_types` and be used as a proxy profile_vector until real history accumulates.

**6. Moderation cost at scale**
Using GPT-4o-mini chat completions (approx $0.00015/1K input tokens) for every moderation check is expensive at volume. A 300-word description + 4KB image check per public memory could add up.
- Mitigation v1: use the **OpenAI Moderation API** (free, purpose-built, not chat completions) for text. Use GPT-4o-mini vision only for image moderation when the free pre-screen flags uncertainty. This cuts moderation cost by ~90% vs using chat completions for everything.

**7. Places catalog query cost**
Every new `place_id` hits Google Places API. At 1000 shares/day, that's 1000 API calls with real cost.
- Mitigation: `places_catalog` table is the cache. Check DB first. Only hit Google API on cache miss. Lazy populate on first share — already the correct design. Cache must persist place enrichment for ≥30 days before re-checking Google.

### How to make it feel like YOUR space, not a platform

The risk is that TravelMemo becomes a review site that happens to live inside MyMemo. The antidote is to surface the user's own context at every point:

**Personal narrative layer (by priority):**
1. "You've been here before" — if user already has a private memory at the same place_id, show a quiet banner on the place detail page. No user action required. Built from simple join: `WHERE source_memory.user_id = current_user AND place_id = ?`.
2. Emotion-first cards — the NLP already extracts an emotion label. Show it prominently. A card that says "Nostálgico · Café en Roma Norte" feels personal. A card with 4.2 stars feels like a review site.
3. "Why this?" chip under the card — one plain-language reason: "Similar to your visits in Condesa" or "Popular tonight near you". Phase 1 rule-based explanation, not ML mystery. Builds trust without complexity.
4. Contribution counter — "You've shared 8 memories" shown on the user's TravelMemo profile screen. No points, no levels — just a number and a list.
5. Local vs visitor derived badge — inferred from `(visits_at_place_in_last_180_days > 1)` → show "Local insight". Not editable, not gameable.

**Copy and visual tone:**
- Never use the word "reviews". Use "memories" or "moments".
- Never show aggregate star ratings on the feed cards. Stars belong only on Place Detail if at all, in Phase B.
- Card labels: "Feliz · Restaurante · hace 2 meses" not "★ 4.5 · 24 reviews".
- The share action copy should read "Compartir este momento" not "Publicar reseña".

**Community sense without monetization:**
- Place Detail shows "3 personas compartieron un momento aquí" — a count of authentic memories creates social proof without needing comments, likes, or any social graph.
- "Place Stories" concept (Stage B): a place's memories shown chronologically become a collective narrative. Costs nothing to implement — it is just `ORDER BY visit_month, visit_year`.

**Monetization path that preserves the feel:**
When monetization starts (Stage D), the mechanism must be:
1. Businesses are listed in Places Catalog the same as any place.
2. Promoted places get a tie-breaking boost in feed ranking, not a separate injection.
3. A "featured" label is shown on the card (legal requirement), but visually it is the same card style — no banner, no animation.
4. Quality gate (decision 15): a place can only activate a promotion if it has a minimum number of organic public memories. The product always has authentic content first.
5. The "Deals & Promotions" section (Screen 4 in UX) is where sponsored campaigns, coupons, and specials live. Users who want deals opt in actively. Main feed is clean.

---

## 1. Architecture Principles

1. **Module, not separate app** — same FastAPI process, same DB, same auth, same Redis, same Celery workers. New `api/v1/endpoints/travel.py` router. No new process.
2. **Data boundary is a hard wall** — `public_memories` stores copied values at publish time. No live JOIN to private `memories` in any feed API response. Breaking this rule creates privacy risk.
3. **Async-first reads, fire-and-forget writes** — feed reads are fast sync queries. Interaction events are Celery tasks, never blocking.
4. **Cache-heavy** — feed results cached in Redis per user+location grid cell. Trending places cached globally. Cold TTLs: feed=5min, trending=30min.
5. **Cursor pagination everywhere** — no offset pagination in TravelMemo. Cursor = (score_int, created_at, id) encoded as base64 opaque string.
6. **Moderation is always async** — publish is instant. Moderation runs in background. Default state after publish is `pending` (not visible in public feed). Approve is fast (seconds via auto-check). Reject is manual for borderline cases.

---

## 2. Backend File Structure

New files to create:
```
backend/
  api/v1/endpoints/
    travel.py                  # All TravelMemo API endpoints
  models/
    travel_models.py           # PublicMemory, PlacesCatalog, RecommendationEvent, UserTravelPrefs
    travel_schemas.py          # Pydantic request/response schemas for travel
  services/
    travel_service.py          # Feed generation, recommendation Phase 1, profile vector
    moderation_service.py      # Text + image moderation pipeline
  tasks/
    travel_moderation.py       # Celery task: moderate_travel_post
    travel_maintenance.py      # Celery periodic: update_user_profiles, update_place_stats
```

Files to extend (minimal touch):
```
backend/
  models/database.py           # Import travel_models to ensure Alembic picks them up
  api/v1/__init__.py            # Register travel router
  tasks/celery_app.py           # No change needed (task autodiscovery)
```

---

## 3. Database Schema

### New tables (SQL migration)

```sql
-- Table: public_memories
-- Immutable projection of private memory at point of publish

CREATE TABLE public_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Place data (cached from Google at publish time)
    place_id TEXT NOT NULL,
    place_name TEXT NOT NULL,
    place_city TEXT,
    place_country TEXT,
    place_types TEXT[] DEFAULT '{}',

    -- Public content (copied, never referenced live from private memory)
    public_photo_url TEXT NOT NULL,          -- S3 key
    public_description TEXT,
    emotion_label TEXT,                      -- copied from ai_metadata.nlp.emotion
    sentiment_score FLOAT,                   -- copied from ai_metadata.nlp.sentiment_score
    visit_month SMALLINT,                    -- coarse date
    visit_year SMALLINT,

    -- Extra photo slots for Stage B (empty in MVP)
    extra_photos JSONB DEFAULT '[]',

    -- Status
    visibility_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (visibility_status IN ('pending', 'active', 'hidden', 'hard_deleted')),
    moderation_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'flagged')),
    moderation_checked_at TIMESTAMPTZ,
    moderation_reason TEXT,

    -- Geo (PostGIS)
    location GEOGRAPHY(POINT, 4326) NOT NULL,

    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_pm_source ON public_memories(source_memory_id);
CREATE INDEX idx_pm_user ON public_memories(user_id);
CREATE INDEX idx_pm_place ON public_memories(place_id);
CREATE INDEX idx_pm_location ON public_memories USING GIST(location);
CREATE INDEX idx_pm_feed ON public_memories(visibility_status, moderation_status, created_at DESC);
CREATE INDEX idx_pm_place_types ON public_memories USING GIN(place_types);


-- Table: places_catalog
-- Cached place metadata. Populated lazily on first share at that place.

CREATE TABLE places_catalog (
    place_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    lat FLOAT NOT NULL,
    lng FLOAT NOT NULL,
    types TEXT[] DEFAULT '{}',
    city TEXT,
    country TEXT,
    location GEOGRAPHY(POINT, 4326) NOT NULL,

    -- Denormalized stats (updated by periodic task, not real-time)
    memory_count INT DEFAULT 0,
    avg_sentiment FLOAT DEFAULT 0.5,

    last_enriched_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pc_location ON places_catalog USING GIST(location);
CREATE INDEX idx_pc_types ON places_catalog USING GIN(types);


-- Table: recommendation_events
-- Interaction telemetry. Append-only, never updated.

CREATE TABLE recommendation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL
        CHECK (event_type IN ('view', 'click', 'save', 'hide', 'visit_intent', 'report')),
    place_id TEXT NOT NULL,
    public_memory_id UUID REFERENCES public_memories(id) ON DELETE SET NULL,
    session_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_re_user_time ON recommendation_events(user_id, created_at DESC);
CREATE INDEX idx_re_place ON recommendation_events(place_id, event_type);


-- Table: user_travel_preferences
-- Per-user preferences and computed profile vector. Upsert pattern.

CREATE TABLE user_travel_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    preferred_types TEXT[] DEFAULT '{}',     -- from cold start chips
    home_city TEXT,
    home_lat FLOAT,
    home_lng FLOAT,
    profile_vector JSONB DEFAULT '{}',       -- {"restaurant": 0.8, "park": 0.3, ...}
    last_computed_at TIMESTAMPTZ
);


-- Table: saved_places
-- User bookmarks (single interaction that v1 supports)

CREATE TABLE saved_places (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    place_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    PRIMARY KEY (user_id, place_id)
);
```

### Schema change to existing `memories` table

Add one column:
```sql
ALTER TABLE memories
  ADD COLUMN travel_shared BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for "my shared memories" query in MemoryDetail
CREATE INDEX idx_memories_travel_shared ON memories(user_id, travel_shared) WHERE travel_shared = TRUE;
```

This flag drives the toggle state in MemoryDetail UI. A Memory can have `travel_shared=true` but `public_memories.visibility_status='hidden'` (user unpublished it). The flag tracks user intent; the visibility_status tracks actual public exposure.

---

## 4. Backend API Endpoints

All under prefix `/api/v1/travel`.

### Feed and discovery

```
GET /travel/feed
  Query: lat, lng, cursor (optional), type_filter (optional)
  Auth: required
  Response: { items: PublicMemoryCard[], next_cursor: str | null }

GET /travel/map
  Query: lat, lng, radius_km (default 10)
  Auth: required
  Response: { clusters: PlaceCluster[] }

GET /travel/places/{place_id}
  Auth: required
  Response: { place: PlaceDetail, memories: PublicMemoryCard[], user_has_been_here: bool }
```

### Personal actions

```
POST /travel/share/{memory_id}
  Auth: required
  Body: {} (no body, all data comes from the private memory + its ai_metadata)
  Response: { public_memory_id: UUID, status: "pending_moderation" }
  Side effect: creates public_memory, queues moderation task, sets memory.travel_shared=true

DELETE /travel/share/{memory_id}
  Auth: required
  Response: { status: "unpublished" }
  Side effect: sets public_memory.visibility_status='hidden', memory.travel_shared=false

GET /travel/my
  Auth: required
  Response: { items: MyPublicMemory[] }  -- includes moderation_status for own memories

POST /travel/save/{place_id}
  Auth: required
  Response: { saved: true }

DELETE /travel/save/{place_id}
  Auth: required
  Response: { saved: false }

GET /travel/saved
  Auth: required
  Response: { places: SavedPlace[] }
```

### Events and reporting

```
POST /travel/events
  Auth: required
  Body: { event_type, place_id, public_memory_id? }
  Response: 204 No Content
  Side effect: queues Celery batch write (not sync DB write)

POST /travel/report/{public_memory_id}
  Auth: required
  Body: { reason: str }
  Response: { reported: true }

POST /travel/preferences
  Auth: required
  Body: { preferred_types: str[], home_city?: str }
  Response: { updated: true }
```

---

## 5. Recommendation Algorithm (Phase 1)

Rule-based scoring. No ML model required. Uses only existing data.

```python
def score_place(place, user_prefs, user_lat, user_lng, now):
    """
    Composite score for a place in the feed.
    All components normalized to [0, 1].
    """
    # Component 1: geographic proximity (weight 0.35)
    distance_km = haversine(user_lat, user_lng, place.lat, place.lng)
    geo = 1.0 / (1.0 + distance_km / 5.0)  # 5km half-distance

    # Component 2: type affinity with user profile (weight 0.30)
    if user_prefs.profile_vector:
        affinity = sum(
            user_prefs.profile_vector.get(t, 0.0) for t in place.types
        ) / max(len(place.types), 1)
    else:
        # Cold start: use preferred_types chips as binary proxy
        affinity = 1.0 if any(t in user_prefs.preferred_types for t in place.types) else 0.2

    # Component 3: place quality signal (weight 0.20)
    quality = min(place.memory_count / 10.0, 1.0) * (place.avg_sentiment or 0.5)

    # Component 4: recency of latest memory (weight 0.15)
    days_since = (now - place.latest_memory_date).days
    recency = math.exp(-days_since / 90.0)  # 90-day half-life

    return (
        0.35 * geo
        + 0.30 * affinity
        + 0.20 * quality
        + 0.15 * recency
    )
```

**Feed generation flow:**
1. Get user location (lat, lng) from request.
2. Load `user_travel_preferences` from DB (or Redis cache key `travel:prefs:{user_id}` TTL=10min).
3. Query `places_catalog` within radius (PostGIS `ST_DWithin`). Limit to top 200 candidate places.
4. For each candidate place, compute `score_place`.
5. Sort descending by score.
6. Paginate with cursor = (score * 1e6 as int, created_at, id) encoded as base64.
7. For each place in page, fetch the top 1–2 active public memories by `ORDER BY sentiment_score DESC, created_at DESC`.
8. Cache result in Redis: `travel:feed:{user_id}:{lat_1dp}:{lng_1dp}` TTL=300s.
9. Return cards.

---

## 6. Moderation Pipeline

### Text moderation

Use **OpenAI Moderation API** (separate from chat completions, currently free):

```python
from openai import OpenAI

async def moderate_text(text: str) -> tuple[bool, str]:
    """Returns (is_safe, reason). Uses free moderation endpoint."""
    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    response = client.moderations.create(input=text)
    result = response.results[0]
    if result.flagged:
        triggered = [k for k, v in result.categories.model_dump().items() if v]
        return False, f"flagged: {', '.join(triggered)}"
    return True, ""
```

Custom category checks on top of OpenAI result:
- Political content: keyword list + pattern match for partisan language.
- Religious proselytism: pattern match. Travel criticism of religious sites is allowed; preaching is not.
- These extra checks are done with simple regex patterns, not LLM calls.

### Image moderation

Phase 1: GPT-4o-mini vision for images that pass text check.
Phase 2 (when volume justifies): AWS Rekognition (`detect_moderation_labels` call, $0.001 per image) is cheaper at scale.

```python
async def moderate_image(image_s3_key: str) -> tuple[bool, str]:
    """Returns (is_safe, reason). Uses GPT-4o-mini vision."""
    # Generate short-lived presigned URL for OpenAI to fetch the image
    url = storage_service.get_presigned_url(image_s3_key, bucket, expiry=300)
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": url}},
                {"type": "text", "text": (
                    "Does this image contain nudity, graphic violence, "
                    "hate symbols, or content inappropriate for a public "
                    "travel app? Answer SAFE or UNSAFE and one sentence why."
                )}
            ]
        }],
        max_tokens=60,
    )
    answer = response.choices[0].message.content.strip().upper()
    if answer.startswith("UNSAFE"):
        return False, answer
    return True, ""
```

### Celery task: `moderate_travel_post`

```python
@celery_app.task(bind=True, max_retries=3)
def moderate_travel_post(self, public_memory_id: str):
    # 1. Load public_memory from DB
    # 2. Run text moderation on public_description
    # 3. If text fails: set moderation_status='rejected', set visibility='hidden', return
    # 4. Run image moderation on public_photo_url
    # 5. If image fails: same rejection flow
    # 6. If both pass: set moderation_status='approved', set visibility_status='active'
    # 7. Commit
```

Auto-approval flow means public memories typically become visible within 10–30 seconds of sharing.

---

## 7. Profile Vector Maintenance

Celery periodic task (runs weekly per user):

```python
@celery_app.task
def update_user_travel_profile(user_id: str):
    """
    Recomputes user's type affinity profile from private memory history.
    Reads ai_metadata.nlp.place_types (or infers from ai_metadata.nlp.topics).
    """
    # 1. Load user's memories from last 12 months
    # 2. For each memory, extract place types from ai_metadata.nlp
    # 3. Build frequency dict: {"restaurant": 12, "park": 5, "museum": 3}
    # 4. Normalize to [0, 1]: divide by max value
    # 5. Upsert to user_travel_preferences.profile_vector
    # 6. Update last_computed_at
```

What the NLP service already extracts per memory (from `ai_metadata.nlp`):
- `emotion`: one of joy, nostalgia, excitement, calm, etc.
- `sentiment_score`: 0.0 to 1.0
- `topics`: ["food", "architecture", "nightlife"]
- `activities`: ["eating", "exploring", "photography"]

`topics` and `activities` map directly to Google Places `types`. This is the key connection.

---

## 8. Place Stats Maintenance

Celery periodic task (runs every 6 hours):

```python
@celery_app.task
def update_place_stats():
    """
    Refreshes denormalized counters in places_catalog.
    Avoids real-time aggregation on every feed request.
    """
    # UPDATE places_catalog pc
    # SET memory_count = (
    #     SELECT COUNT(*) FROM public_memories pm
    #     WHERE pm.place_id = pc.place_id
    #     AND pm.visibility_status = 'active'
    #     AND pm.moderation_status = 'approved'
    # ),
    # avg_sentiment = (
    #     SELECT AVG(sentiment_score) FROM public_memories pm
    #     WHERE pm.place_id = pc.place_id
    #     AND pm.visibility_status = 'active'
    # )
```

---

## 9. Frontend Structure

### New files to create

```
frontend/src/
  pages/
    TravelMemo.jsx               # Root tab page — hosts feed/map toggle + screens
  
  components/travel/
    DiscoverFeed.jsx             # Virtualized infinite-scroll card list
    MapExplore.jsx               # Leaflet map with place cluster pins
    PlaceDetail.jsx              # Place detail sheet with memories
    MemoryCard.jsx               # Public memory card (emotion + photo + description)
    PlaceChips.jsx               # Horizontal filter chips (type filter)
    ShareModal.jsx               # Privacy preview before publish
    SavedPlaces.jsx              # User's saved places list
    TravelProfile.jsx            # User's own public contributions
    ColdStartFlow.jsx            # First-visit interest chips selector

  contexts/
    TravelContext.jsx            # Location permission, prefs, cached feed state

  services/
    travelApi.js                 # All /api/v1/travel/* API calls
```

### Files to extend (minimal touch)

```
frontend/src/
  App.jsx                        # Add /travel route
  components/layout/             # Add TravelMemo as 5th tab in bottom nav
  pages/MemoryDetail.jsx         # Add "Compartir en TravelMemo" toggle + ShareModal
```

### TravelContext responsibilities

```jsx
// TravelContext provides:
{
  location: { lat, lng } | null,   // browser geolocation (requested on TravelMemo mount)
  locationGranted: bool,
  preferences: UserTravelPrefs,     // from /travel/preferences
  setPreferences: fn,
  feedState: { items, cursor, loading, hasMore },
  loadFeed: fn,
  loadMoreFeed: fn,
  invalidateFeed: fn,              // called after share/unshare
}
```

### Share flow in MemoryDetail

The only change needed in the existing `MemoryDetail.jsx`:
1. Add a `ShareToggle` component at the bottom of the detail view.
2. Toggle state derives from `memory.travel_shared` (new field added to `MemoryResponse` schema).
3. On toggle ON: open `ShareModal` showing exactly what will be public (photo, description, place, emotion — no faces, no exact date, no name). Confirm → call `POST /travel/share/{id}`.
4. On toggle OFF: call `DELETE /travel/share/{id}`.
5. Show `pending_moderation` status inline after share (not blocking).

---

## 10. Connection Points: TravelMemo ↔ MyMemo

These are the exact integration seams, ordered by criticality:

| Event in MyMemo | Effect in TravelMemo | Implementation |
|---|---|---|
| Memory created | NLP task extracts emotion/sentiment/topics → available for share | Existing Celery flow, no change |
| User clicks "Share" toggle | Public memory created, moderation queued | `POST /travel/share/{id}` |
| User toggles off | Public memory hidden, flag cleared | `DELETE /travel/share/{id}` |
| Memory deleted | Public memory hard-deleted | ON DELETE CASCADE on FK |
| Memory description edited | **Not propagated** (decision 2: description copied at publish, not linked) | No action needed |
| NLP re-runs on memory | **Not propagated** (same reason above — data isolation) | No action needed |
| User deletes account | All `public_memories` cascade deleted | ON DELETE CASCADE user_id FK |
| User visits TravelMemo tab | Location requested, cold start shown if no preferences | TravelContext mount |
| User views Place Detail in TravelMemo | "You've been here before" banner | Query: `memories WHERE user_id=? AND place coordinates near place.location` |

---

## 11. Security Boundaries

**These must be enforced at the API layer, not assumed from client:**

1. `POST /travel/share/{memory_id}` — verify `memory.user_id == current_user.id` before any data copy. Never trust memory_id from client to belong to the caller.
2. Public memory response schema must NOT include: `source_memory_id` exposed in public feed (only in `/travel/my`), `user_id`, any face data fields.
3. Image presigned URL for `public_photo_url`: public memories should use **public S3 bucket** or a long TTL signed URL (unlike private memories which use short 7-day signed URLs). Decision: at publish time, copy the thumbnail to a public-read S3 prefix (`public/memories/`) so public feed does not require per-user AWS credentials.
4. Moderation API key: same `settings.OPENAI_API_KEY`. No new credential needed.
5. Rate limiting on `POST /travel/share`: use existing `limiter` (already in `core/limiter.py`). Max 10 shares per minute per user to prevent spam.

---

## 12. Execution Order (Coding Stages)

### Stage A — Foundation (MVP core, ~3–4 sessions)

**Backend:**
1. Write `models/travel_models.py` (SQLAlchemy models for all 5 new tables).
2. Write `models/travel_schemas.py` (Pydantic schemas for all travel API I/O).
3. Write SQL migration file (`deployment/travel_migration.sql`).
4. Add `travel_shared` column to `memories`.
5. Write `services/moderation_service.py` (text + image checks, sync functions).
6. Write `tasks/travel_moderation.py` (Celery task `moderate_travel_post`).
7. Write `api/v1/endpoints/travel.py` with:
   - `POST /travel/share/{memory_id}`
   - `DELETE /travel/share/{memory_id}`
   - `GET /travel/my`
   - `GET /travel/places/{place_id}` (basic)
8. Register travel router in `api/v1/__init__.py`.
9. Extend `MemoryResponse` schema to include `travel_shared` field.

**Frontend:**
1. Add `travelApi.js` with share/unshare/my endpoints.
2. Add `ShareModal.jsx` (privacy preview component).
3. Extend `MemoryDetail.jsx` with share toggle + modal.
4. Add skeleton `TravelMemo.jsx` page (empty feed placeholder).
5. Add `/travel` route in `App.jsx`.
6. Add 5th tab in bottom nav.

**Test:**
- Share a memory, confirm `public_memories` row created with correct data.
- Confirm no private fields exposed in response.
- Delete source memory, confirm cascade.
- Confirm face data not present in any travel API response.

### Stage B — Discovery (~2–3 sessions)

**Backend:**
1. Write `services/travel_service.py` with `generate_feed()` and `get_place_clusters()`.
2. Write `tasks/travel_maintenance.py` (profile + place stats periodic tasks).
3. Implement `GET /travel/feed` with Phase 1 scoring.
4. Implement `GET /travel/map` with PostGIS cluster query.
5. Implement `POST /travel/preferences` (cold start).
6. Implement `POST /travel/events` (fire-and-forget telemetry).
7. Implement `POST /travel/save/{place_id}` and `DELETE`.
8. Add Redis caching for feed results.

**Frontend:**
1. `TravelContext.jsx` with geolocation and feed state.
2. `ColdStartFlow.jsx` (interest chip selector, shown once).
3. `DiscoverFeed.jsx` (virtualized card list from feed API).
4. `MapExplore.jsx` (Leaflet with cluster pins from map API).
5. `MemoryCard.jsx` (emotion label, photo, place name, "Why this?" line).
6. `PlaceChips.jsx` (type filter bar).

### Stage C — Personalization (~1–2 sessions)

1. Enable periodic profile vector computation Celery beat task.
2. Improve feed scoring with actual profile_vector from DB.
3. Add `saved_places` tab (`SavedPlaces.jsx`).
4. Add `TravelProfile.jsx` (user's own public memory list + stats).
5. Add "You've been here before" banner in `PlaceDetail.jsx`.
6. Add local vs visitor derived badge logic.

### Stage D — Monetization (future, post user growth, deferred)

1. `place_promotions` table and management endpoints.
2. Campaign injection in feed scoring (tie-breaking boost only).
3. "Featured" label on promoted cards (same component, different badge).
4. `Deals & Promotions` section (Screen 4).
5. Business onboarding flow.

Status:
- Deferred. Not part of the current coding execution.

---

## 13. What NOT to build in MVP

Do not build:
- Comments, replies, or social following.
- Rating stars (no aggregate score in feed).
- Public user profiles (anonymous per decision 18).
- Push notifications for TravelMemo events.
- Multiple photos per card (schema has the slot, UI is not needed yet).
- Business portal or self-serve campaign creation.
- ML ranking model (Phase 2+).
- Right-to-be-forgotten automation (manual process acceptable at small scale).
- Real-time feed updates (polling or websocket).

---

## 14. Risk Register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Empty feed at launch | High | Critical | Seed with creator's own memories before announcing feature |
| Private data leak via API bug | Low | Critical | Data copy at publish + security review of travel responses |
| Moderation cost spike | Medium | Medium | Use free OpenAI Moderation API for text; GPT vision only on uncertainty |
| Google Places API cost | Medium | Low | Lazy cache in places_catalog, 30-day minimum before re-check |
| Feed feels empty without social | Medium | Medium | Context badges + "X moments here this month" count on cards |
| Celery worker overload | Low | Low | Moderation and profile tasks are low-priority queue (separate queue name) |
