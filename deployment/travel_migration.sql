-- TravelMemo Stage A migration

BEGIN;

CREATE TABLE IF NOT EXISTS public_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    place_id TEXT NOT NULL,
    place_name TEXT NOT NULL,
    place_city TEXT,
    place_country TEXT,
    place_types TEXT[] DEFAULT '{}',

    public_photo_url TEXT NOT NULL,
    public_description TEXT,
    emotion_label TEXT,
    sentiment_score FLOAT,
    visit_month INTEGER,
    visit_year INTEGER,
    extra_photos JSONB DEFAULT '[]',

    visibility_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (visibility_status IN ('pending', 'active', 'hidden', 'hard_deleted')),
    moderation_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'flagged')),
    moderation_checked_at TIMESTAMPTZ,
    moderation_reason TEXT,

    location GEOGRAPHY(POINT, 4326) NOT NULL,

    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pm_source ON public_memories(source_memory_id);
CREATE INDEX IF NOT EXISTS idx_pm_user ON public_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_pm_place ON public_memories(place_id);
CREATE INDEX IF NOT EXISTS idx_pm_location ON public_memories USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_pm_feed ON public_memories(visibility_status, moderation_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pm_place_types ON public_memories USING GIN(place_types);


CREATE TABLE IF NOT EXISTS places_catalog (
    place_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    lat FLOAT NOT NULL,
    lng FLOAT NOT NULL,
    types TEXT[] DEFAULT '{}',
    city TEXT,
    country TEXT,
    location GEOGRAPHY(POINT, 4326) NOT NULL,

    memory_count INT DEFAULT 0,
    avg_sentiment FLOAT DEFAULT 0.5,

    last_enriched_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pc_location ON places_catalog USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_pc_types ON places_catalog USING GIN(types);


CREATE TABLE IF NOT EXISTS recommendation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL
        CHECK (event_type IN ('view', 'click', 'save', 'hide', 'visit_intent', 'report')),
    place_id TEXT NOT NULL,
    public_memory_id UUID REFERENCES public_memories(id) ON DELETE SET NULL,
    session_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_re_user_time ON recommendation_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_re_place ON recommendation_events(place_id, event_type);


CREATE TABLE IF NOT EXISTS user_travel_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    preferred_types TEXT[] DEFAULT '{}',
    home_city TEXT,
    home_lat FLOAT,
    home_lng FLOAT,
    profile_vector JSONB DEFAULT '{}',
    last_computed_at TIMESTAMPTZ
);


CREATE TABLE IF NOT EXISTS saved_places (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    place_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    PRIMARY KEY (user_id, place_id)
);


ALTER TABLE memories
    ADD COLUMN IF NOT EXISTS travel_shared BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_memories_travel_shared
    ON memories(user_id, travel_shared)
    WHERE travel_shared = TRUE;

COMMIT;
