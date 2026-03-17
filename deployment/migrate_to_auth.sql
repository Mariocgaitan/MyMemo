-- ============================================================
-- Migration: Add auth support + migrate existing data to real user
-- Run ONCE on the production server before starting the new backend
--
-- Usage:
--   docker exec mymemo_db psql -U lifelogs_user -d lifelogs_db -f /tmp/migrate_to_auth.sql
-- ============================================================

BEGIN;

-- ── 1. Schema changes ─────────────────────────────────────────────────────────

-- Add 'name' column to users (new field added in this version)
ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);

-- Make email NOT NULL (was nullable in single-user MVP)
-- First give the default user a real email if it somehow has NULL
UPDATE users SET email = 'default@lifelogs.local' WHERE email IS NULL;
ALTER TABLE users ALTER COLUMN email SET NOT NULL;

-- Make hashed_password NOT NULL
-- Give a placeholder to any row that has NULL (the default user had no password)
UPDATE users SET hashed_password = 'DISABLED' WHERE hashed_password IS NULL;
ALTER TABLE users ALTER COLUMN hashed_password SET NOT NULL;

-- Add unique index on email if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE tablename = 'users' AND indexname = 'ix_users_email'
    ) THEN
        CREATE UNIQUE INDEX ix_users_email ON users(email);
    END IF;
END$$;

-- ── 2. Create Mario's real user + reassign all data (email defined once) ────────
-- IMPORTANT: Replace only these 3 values before running:
--   MARIO_EMAIL   → your real email
--   MARIO_NAME    → your display name (e.g. 'Mario')
--   BCRYPT_HASH   → generate on the server with:
--                   docker exec mymemo_backend python -c \
--                   "import bcrypt; print(bcrypt.hashpw(b'YOUR_PASSWORD', bcrypt.gensalt()).decode())"

DO $$
DECLARE
    v_mario_id   UUID;
    v_default_id UUID;
BEGIN
    -- Insert real user; if email already exists just get the ID
    INSERT INTO users (id, email, hashed_password, name, created_at, updated_at)
    VALUES (
        gen_random_uuid(),
        'MARIO_EMAIL',   -- ← change this
        'BCRYPT_HASH',   -- ← change this
        'MARIO_NAME',    -- ← change this
        NOW(),
        NOW()
    )
    ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_mario_id;

    -- Get default user ID
    SELECT id INTO v_default_id FROM users WHERE email = 'default@lifelogs.local';

    IF v_default_id IS NULL THEN
        RAISE NOTICE 'default@lifelogs.local not found — skipping reassignment';
    ELSE
        -- Reassign all data
        UPDATE memories      SET user_id = v_mario_id WHERE user_id = v_default_id;
        UPDATE people        SET user_id = v_mario_id WHERE user_id = v_default_id;
        UPDATE usage_metrics SET user_id = v_mario_id WHERE user_id = v_default_id;

        -- Delete placeholder user
        DELETE FROM users WHERE id = v_default_id;

        RAISE NOTICE 'Reassigned all data from default user to %', 'MARIO_EMAIL';
    END IF;
END $$;

-- ── 3. Verify ────────────────────────────────────────────────────────────────
SELECT
    u.email,
    u.name,
    COUNT(DISTINCT m.id) AS memories,
    COUNT(DISTINCT p.id) AS people
FROM users u
LEFT JOIN memories m ON m.user_id = u.id
LEFT JOIN people p ON p.user_id = u.id
GROUP BY u.email, u.name;

COMMIT;
