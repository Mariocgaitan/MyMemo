-- =============================================================================
-- TravelMemo Stage D — Promotions foundation migration
-- Run on the remote server after travel_migration.sql has been applied.
-- =============================================================================

-- 1. Add promotion boost weight column to places_catalog.
--    Default 0.0 means no boost until an active promotion is written.
ALTER TABLE places_catalog
    ADD COLUMN IF NOT EXISTS boost_weight FLOAT NOT NULL DEFAULT 0.0;

-- 2. Create place_promotions table (source of truth for campaigns).
CREATE TABLE IF NOT EXISTS place_promotions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    place_id            TEXT NOT NULL REFERENCES places_catalog(place_id) ON DELETE CASCADE,

    sponsor_name        TEXT,
    campaign_type       TEXT NOT NULL DEFAULT 'standard'
                            CHECK (campaign_type IN ('standard', 'featured', 'event')),

    -- Max boost capped at 0.15 (~+15% on composite score).
    boost_weight        FLOAT NOT NULL DEFAULT 0.05
                            CHECK (boost_weight >= 0.0 AND boost_weight <= 0.15),

    starts_at           TIMESTAMPTZ,
    ends_at             TIMESTAMPTZ,

    -- Quality gate: place must have at least this many approved organic memories.
    min_organic_memories INT NOT NULL DEFAULT 5,

    status              TEXT NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft', 'active', 'paused', 'ended')),

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promo_place  ON place_promotions(place_id);
CREATE INDEX IF NOT EXISTS idx_promo_active ON place_promotions(status, starts_at, ends_at);

-- 3. Helper trigger: auto-update updated_at on row change.
CREATE OR REPLACE FUNCTION update_place_promotions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_place_promotions_updated_at ON place_promotions;
CREATE TRIGGER trg_place_promotions_updated_at
    BEFORE UPDATE ON place_promotions
    FOR EACH ROW EXECUTE FUNCTION update_place_promotions_updated_at();

-- =============================================================================
-- Verification queries (run manually after migration to confirm)
-- =============================================================================
-- SELECT column_name FROM information_schema.columns
--     WHERE table_name = 'places_catalog' AND column_name = 'boost_weight';
-- SELECT COUNT(*) FROM place_promotions;
