-- Initialize PostgreSQL extensions for LifeLog AI
-- Note: PostGIS is included in postgis/postgis image
-- pgvector will be added later when needed for face recognition

-- Enable PostGIS for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Enable pg_trgm for full-text search optimization
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enable uuid-ossp for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- TODO: Add pgvector extension when implementing face recognition
-- This requires compilation or using a different base image
-- CREATE EXTENSION IF NOT EXISTS vector;

-- Verify successfully installed extensions
SELECT format('✅ Extension %s version %s installed', extname, extversion) as status
FROM pg_extension
WHERE extname IN ('postgis', 'pg_trgm', 'uuid-ossp')
ORDER BY extname;
