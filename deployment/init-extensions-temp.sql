-- Install pgvector extension first (if not already available)
-- Note: postgis/postgis image includes PostGIS but we need to add pgvector manually

-- First, we need to compile and install pgvector
-- This will be done via a custom initialization script

-- Enable PostGIS for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Enable pg_trgm for full-text search optimization
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enable uuid-ossp for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Note: pgvector will be installed via a separate init script
-- CREATE EXTENSION IF NOT EXISTS vector;

-- Verify extensions
SELECT extname, extversion FROM pg_extension;
