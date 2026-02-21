# LifeLog AI - Final Architecture Specification (MVP + Scalability)

**Version:** 1.0  
**Date:** February 14, 2026  
**Status:** Pre-Development (Architecture Phase)

---

## 1. Executive Summary

**Project Name:** LifeLog AI  
**Type:** Personal Geo-Spatial Memory System (PWA)  
**Goal:** Mobile-first web application to capture and enrich daily experiences with AI-powered face recognition and NLP analysis.

**Core Value Proposition:**
- Capture memories with photos, text, and GPS location
- AI automatically recognizes people and extracts structured metadata
- Visualize life experiences on an interactive map
- Privacy-first, single-user system (multi-user in future phases)

---

## 2. Team Structure

| Role | Responsibility |
|------|---------------|
| **Product Owner (User)** | Requirements, testing, communication |
| **Solutions Architect (Gemini)** | Logic design, strategy, system architecture |
| **Lead Developer (Claude)** | Implementation, coding, deployment |

---

## 3. Technology Stack

### 3.1 Frontend
- **Framework:** React 18+ with Vite
- **Styling:** TailwindCSS 3+
- **PWA:** Service Workers (Workbox)
- **Maps:** Leaflet.js + OpenStreetMap (no Google Maps)
- **State Management:** React Context API + React Query (for server state)
- **Offline Storage:** IndexedDB (Dexie.js)
- **Image Handling:** WebP compression, EXIF parsing

### 3.2 Backend
- **Framework:** Python FastAPI (async)
- **API Version:** v1 (with versioning from day 1)
- **Background Tasks:** Celery + Redis (for AI processing)
- **Rate Limiting:** SlowAPI middleware
- **Validation:** Pydantic v2

### 3.3 Database
- **Primary DB:** PostgreSQL 16+
- **Extensions:**
  - PostGIS (geospatial queries)
  - pgvector (vector similarity search)
  - pg_trgm (full-text search)
- **Connection Pool:** asyncpg

### 3.4 Storage
- **Object Storage:** AWS S3
- **Buckets:**
  - `lifelogs-images-prod` (original images)
  - `lifelogs-images-thumbnails` (WebP compressed)
  - `lifelogs-backups` (DB backups)

### 3.5 AI/ML
- **Face Recognition:**
  - Primary: `face_recognition` (dlib)
  - Fallback: `DeepFace` (Facenet512)
  - Embedding Size: 128-d vectors
- **NLP:** OpenAI API (GPT-4o-mini)
- **Future:** Local Llama-3 fine-tuned model

### 3.6 Infrastructure
- **Development:** Docker + Docker Compose
- **Production:** AWS EC2 (t3.medium)
- **CI/CD:** GitHub Actions (planned for Phase 2)
- **Monitoring:** Prometheus + Grafana (Phase 2)
- **Logging:** Structured logging with ELK Stack (Phase 2)

---

## 4. System Architecture

### 4.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT (PWA)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Map View    │  │ Timeline View│  │ Memory Form  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         IndexedDB (Offline Queue + Cache)            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS/REST API
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      FastAPI Backend                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  API Routes  │  │ Auth Service │  │  Validation  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Service Layer                              │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      │ │
│  │  │Face Service │ │ NLP Service │ │ Geo Service │      │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘      │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │          Storage Service (S3)                    │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                    ▼
        ┌────────────────────┐  ┌──────────────────┐
        │   PostgreSQL       │  │  Celery + Redis  │
        │   + PostGIS        │  │  (AI Queue)      │
        │   + pgvector       │  │                  │
        └────────────────────┘  └──────────────────┘
                    │
                    ▼
        ┌────────────────────┐
        │      AWS S3        │
        │  (Image Storage)   │
        └────────────────────┘
```

### 4.2 Backend Service Structure

```
backend/
├── api/
│   ├── v1/
│   │   ├── endpoints/
│   │   │   ├── memories.py
│   │   │   ├── people.py
│   │   │   ├── search.py
│   │   │   └── export.py
│   │   └── dependencies.py
│   └── middleware/
│       ├── rate_limit.py
│       └── error_handler.py
├── services/
│   ├── face_service.py       # Face detection & recognition
│   ├── nlp_service.py         # OpenAI metadata extraction
│   ├── geo_service.py         # PostGIS spatial queries
│   └── storage_service.py     # S3 upload/download
├── models/
│   ├── database.py            # SQLAlchemy models
│   └── schemas.py             # Pydantic schemas
├── core/
│   ├── config.py              # Settings (env vars)
│   ├── database.py            # DB connection
│   └── security.py            # Auth (JWT for Phase 2)
├── tasks/
│   └── celery_tasks.py        # Background jobs
└── utils/
    ├── image_processing.py
    └── cost_tracker.py
```

---

## 5. Database Schema (PostgreSQL)

### 5.1 Core Tables

```sql
-- Users table (for future multi-user support)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(320) UNIQUE NOT NULL,
    hashed_password TEXT,  -- NULL for MVP (no auth)
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Memories table (core entity)
CREATE TABLE memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- User inputs
    description_raw TEXT NOT NULL,
    location_name VARCHAR(255) NOT NULL,
    coordinates GEOGRAPHY(Point, 4326) NOT NULL,  -- PostGIS
    
    -- Media
    image_url TEXT NOT NULL,  -- S3 original
    thumbnail_url TEXT,       -- S3 WebP compressed
    
    -- AI-generated metadata
    metadata JSONB DEFAULT '{}',  -- {sentiment, tags, price_range, summary}
    faces_processed BOOLEAN DEFAULT FALSE,
    
    -- Visibility & status
    visibility VARCHAR(20) DEFAULT 'visible',  -- 'visible', 'archived', 'hidden'
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Indexes
    CONSTRAINT valid_visibility CHECK (visibility IN ('visible', 'archived', 'hidden'))
);

-- Spatial index for fast geo queries
CREATE INDEX idx_memories_coordinates ON memories USING GIST(coordinates);

-- GIN index for JSONB metadata search
CREATE INDEX idx_memories_metadata ON memories USING GIN(metadata);

-- Full-text search index
CREATE INDEX idx_memories_description_fts ON memories 
    USING GIN(to_tsvector('english', description_raw));

-- People table (for face recognition)
CREATE TABLE people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    face_embedding VECTOR(128) NOT NULL,  -- pgvector
    
    -- Metadata
    times_detected INT DEFAULT 1,
    last_seen TIMESTAMP DEFAULT NOW(),
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(user_id, name)
);

-- Vector similarity index
CREATE INDEX idx_people_embedding ON people 
    USING ivfflat (face_embedding vector_cosine_ops)
    WITH (lists = 100);

-- Memory-People relationships
CREATE TABLE memory_people (
    memory_id UUID REFERENCES memories(id) ON DELETE CASCADE,
    person_id UUID REFERENCES people(id) ON DELETE CASCADE,
    confidence_score FLOAT,  -- 0.0 to 1.0 (face recognition confidence)
    
    PRIMARY KEY (memory_id, person_id)
);

-- Processing jobs (for async AI tasks)
CREATE TABLE processing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    memory_id UUID REFERENCES memories(id) ON DELETE CASCADE,
    job_type VARCHAR(50) NOT NULL,  -- 'face_recognition', 'nlp_extraction'
    status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'processing', 'completed', 'failed'
    
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 3,
    error_message TEXT,
    
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT valid_job_type CHECK (job_type IN ('face_recognition', 'nlp_extraction')),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

CREATE INDEX idx_jobs_status ON processing_jobs(status, created_at);

-- Usage metrics (cost tracking)
CREATE TABLE usage_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    metric_type VARCHAR(50) NOT NULL,  -- 'openai_tokens', 's3_storage_mb', 'face_detection'
    metric_value FLOAT NOT NULL,
    cost_usd DECIMAL(10, 4) DEFAULT 0,
    
    metadata JSONB DEFAULT '{}',
    recorded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_usage_metrics_date ON usage_metrics(user_id, recorded_at);

-- Memory versions (for edit history - Phase 2)
CREATE TABLE memory_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    memory_id UUID REFERENCES memories(id) ON DELETE CASCADE,
    description_raw TEXT NOT NULL,
    metadata_snapshot JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 5.2 Example Metadata JSONB Structure

```json
{
  "ai_generated": {
    "sentiment_score": 8,
    "sentiment_label": "positive",
    "tags": ["food", "mexican", "social"],
    "price_estimate": "medium",
    "summary": "Enjoyed tacos at Orinoco with great atmosphere",
    "extracted_entities": {
      "foods": ["tacos"],
      "places": ["Orinoco"]
    }
  },
  "processing": {
    "nlp_model": "gpt-4o-mini",
    "nlp_tokens_used": 150,
    "processed_at": "2026-02-14T10:30:00Z"
  }
}
```

---

## 6. API Design

### 6.1 Core Endpoints

#### **POST /api/v1/memories**
Create new memory (with sync queue support for offline)

**Request:**
```json
{
  "description_raw": "Amazing tacos at Orinoco",
  "location_name": "Orinoco Restaurante",
  "coordinates": {
    "lat": 19.4326,
    "lng": -99.1332
  },
  "image_base64": "data:image/jpeg;base64,...",
  "client_timestamp": "2026-02-14T10:30:00Z"
}
```

**Response (202 Accepted):**
```json
{
  "id": "uuid-here",
  "status": "processing",
  "message": "Memory created. AI processing in background.",
  "eta_seconds": 15
}
```

#### **GET /api/v1/memories**
List memories with filters

**Query Params:**
- `bounds`: `lat_min,lng_min,lat_max,lng_max` (map viewport)
- `person_id`: Filter by person UUID
- `start_date` / `end_date`: Date range
- `tags`: Comma-separated tags
- `limit` / `offset`: Pagination

**Response:**
```json
{
  "memories": [
    {
      "id": "uuid",
      "description_raw": "...",
      "location_name": "...",
      "coordinates": {"lat": 0, "lng": 0},
      "thumbnail_url": "https://...",
      "metadata": {...},
      "people": [
        {"id": "uuid", "name": "Brau", "confidence": 0.95}
      ],
      "created_at": "2026-02-14T10:30:00Z"
    }
  ],
  "total": 42,
  "page": 1
}
```

#### **GET /api/v1/memories/{id}**
Get single memory with full details

#### **GET /api/v1/search**
Search memories

**Query Params:**
- `q`: Search query (full-text search in Phase 1)
- `mode`: `text` | `semantic` (Phase 2)

#### **POST /api/v1/people**
Add new person (when labeling unknown face)

**Request:**
```json
{
  "name": "Brau",
  "face_embedding": [0.123, 0.456, ...],  // From frontend face detection
  "source_memory_id": "uuid"
}
```

#### **GET /api/v1/people**
List all known people

#### **GET /api/v1/export/training-data**
Export data for ML training (Phase 2)

**Response (ZIP file):**
- `memories.jsonl`: Text + metadata
- `embeddings.npy`: Face vectors
- `metadata.json`: Export config

#### **GET /api/v1/usage/metrics**
Get cost metrics

**Response:**
```json
{
  "current_month": {
    "total_cost_usd": 3.45,
    "budget_limit_usd": 50.00,
    "percentage_used": 6.9,
    "breakdown": {
      "openai_api": 2.00,
      "s3_storage": 1.45
    }
  },
  "alert_threshold_reached": false
}
```

### 6.2 Rate Limiting

- **Anonymous:** 10 requests/minute
- **Authenticated (Phase 2):** 60 requests/minute
- **Memory creation:** 10 memories/hour, 50 memories/day

---

## 7. AI/ML Implementation

### 7.1 Face Recognition Pipeline

**Flow:**
1. User uploads image → Saved to S3
2. Background job `face_recognition_task` triggered
3. **Pre-processing:**
   - Auto-rotate based on EXIF
   - Resize if > 2MB
   - Enhance brightness if too dark
4. **Detection:**
   - Use `face_recognition.face_locations()`
   - If fails → Fallback to `DeepFace.extract_faces()`
5. **Embedding Generation:**
   - `face_recognition.face_encodings()` → 128-d vector
6. **Similarity Search:**
   ```sql
   SELECT id, name, 1 - (face_embedding <=> $1) AS similarity
   FROM people
   WHERE user_id = $2
   ORDER BY face_embedding <=> $1
   LIMIT 1;
   ```
7. **Decision:**
   - Similarity > 0.6 → Auto-tag
   - Similarity < 0.6 → Mark as "unknown", return to UI
8. **Update:**
   - Insert into `memory_people` with confidence score
   - Set `memories.faces_processed = TRUE`

**Error Handling:**
- No faces detected → Save memory, set `faces_processed = FALSE`
- Processing failed → Retry 3 times with exponential backoff
- After 3 failures → Mark job as failed, notify user

### 7.2 NLP Pipeline (Metadata Extraction)

**Trigger:** On memory creation (async)

**OpenAI Prompt:**
```
You are a metadata extraction assistant for a personal memory journal.

INPUT:
- Description: "{user_description}"
- Date: {iso_date}
- Time: {time}
- Location: "{location_name}"

Extract the following in JSON format:
{
  "sentiment_score": <1-10>,
  "sentiment_label": "<positive|neutral|negative>",
  "tags": ["<tag1>", "<tag2>", ...],  // Max 5, lowercase
  "price_estimate": "<free|low|medium|high|luxury>",
  "summary": "<1 sentence summary>",
  "extracted_entities": {
    "foods": ["<food1>", ...],
    "activities": ["<activity1>", ...],
    "people_mentioned": ["<name1>", ...]  // From text, not faces
  }
}

Rules:
- Be concise
- If price not mentioned, infer from context or use "unknown"
- Tags should be generic (e.g., "food", "social", "travel")
```

**Response Handling:**
- Parse JSON response
- Validate with Pydantic schema
- Store in `memories.metadata` JSONB
- Track tokens used in `usage_metrics`

**Cost Optimization:**
- Use `gpt-4o-mini` (cheapest)
- Cache common patterns (future)
- Batch process if multiple memories queued

### 7.3 Future: Local Model Training

**Phase 2 Strategy:**
1. Export training data monthly (see `/export/training-data`)
2. Fine-tune Llama-3-8B on metadata extraction
3. Host locally or on EC2
4. Gradual migration: OpenAI for complex cases, local for simple

---

## 8. Frontend Architecture

### 8.1 PWA Configuration

**Service Worker Strategy:**
- **HTML/CSS/JS:** Cache-first (update in background)
- **API calls:** Network-first, fallback to cache
- **Images:** Cache-first with expiration (30 days)

**Offline Queue:**
```javascript
// IndexedDB schema
{
  "offline_queue": [
    {
      id: "client-uuid",
      endpoint: "/api/v1/memories",
      method: "POST",
      payload: {...},
      timestamp: "2026-02-14T10:30:00Z",
      retry_count: 0
    }
  ],
  "cached_memories": [
    // Last 50 memories with thumbnails
  ],
  "user_data": {
    "people": [...],  // For offline tagging
    "settings": {}
  }
}
```

### 8.2 Key Components

#### **MapView Component**
- **Library:** Leaflet + `react-leaflet`
- **Features:**
  - Marker clustering (MarkerClusterGroup)
  - Custom markers (color by sentiment)
  - Popup preview (thumbnail + snippet)
  - Bounds-based memory loading
- **Performance:**
  - Virtualization: Only render visible markers
  - Throttled pan/zoom events (300ms)

#### **TimelineView Component**
- **Layout:** Month > Week > Day hierarchy
- **Features:**
  - Infinite scroll (load more months)
  - Heatmap visualization (memories per day)
  - "On this day" section
- **Data Fetching:** React Query with pagination

#### **MemoryForm Component**
- **Fields:**
  - Photo capture (camera API) or upload
  - GPS auto-capture (Geolocation API)
  - Location name (manual input)
  - Description textarea
- **Validation:** Client-side with Zod
- **Offline:** Auto-save to IndexedDB queue

#### **SearchBar Component**
- **Phase 1:** Simple text filter
- **Features:**
  - Autocomplete for people names
  - Date range picker
  - Tag filter chips
- **Debounced:** 300ms delay

### 8.3 State Management

```javascript
// Context structure
{
  auth: {...},           // Phase 2
  memories: [...],       // Current view
  filters: {...},        // Active filters
  offline: {
    isOnline: true,
    queueCount: 0
  },
  ui: {
    activeView: 'map',   // 'map' | 'timeline'
    selectedMemory: null
  }
}
```

---

## 9. Cost Management System

### 9.1 Budget Configuration

**Monthly Limits:**
- Total: $50 USD ($100 max alert)
- OpenAI API: $30 max
- S3 Storage: $15 max
- EC2/Infrastructure: $5 budget

### 9.2 Tracking Mechanism

**Per-Request Tracking:**
```python
# In nlp_service.py
async def extract_metadata(text: str) -> dict:
    response = await openai_client.chat.completions.create(...)
    
    # Track usage
    tokens_used = response.usage.total_tokens
    cost_usd = (tokens_used / 1_000_000) * 0.15  # $0.15 per 1M tokens
    
    await db.execute(
        "INSERT INTO usage_metrics (user_id, metric_type, metric_value, cost_usd) "
        "VALUES ($1, 'openai_tokens', $2, $3)",
        user_id, tokens_used, cost_usd
    )
```

**Alert System:**
```python
# In cost_tracker.py
async def check_budget_alerts(user_id: UUID):
    current_month_cost = await get_monthly_cost(user_id)
    
    if current_month_cost >= 40:  # 80% of $50
        await send_notification(
            user_id,
            "⚠️ Budget Alert: $40/$50 used this month"
        )
```

### 9.3 Dashboard Endpoint

**GET /api/v1/usage/dashboard**
```json
{
  "current_month": {
    "cost_breakdown": [
      {"service": "OpenAI API", "cost": 12.50, "percentage": 25},
      {"service": "S3 Storage", "cost": 8.30, "percentage": 16.6}
    ],
    "usage_stats": {
      "memories_created": 35,
      "faces_processed": 48,
      "api_calls": 1205
    }
  },
  "trend": {
    "daily_average": 1.67,
    "projected_month_end": 46.90
  }
}
```

---

## 10. Backup & Data Export Strategy

### 10.1 Automated Backups

**Daily PostgreSQL Backup:**
```bash
# Cron job on EC2
0 2 * * * pg_dump lifelogs_db | gzip | aws s3 cp - s3://lifelogs-backups/db/backup_$(date +%Y%m%d).sql.gz
```

**Retention Policy:**
- Daily backups: Keep 7 days
- Weekly backups: Keep 4 weeks
- Monthly backups: Keep 12 months

### 10.2 User Export Feature

**GET /api/v1/export/full-archive**

Returns ZIP containing:
```
lifelogs_export_2026-02-14/
├── memories/
│   ├── 2026-01/
│   │   ├── memory_uuid1.json
│   │   ├── memory_uuid1.jpg
│   │   ├── memory_uuid2.json
│   │   └── memory_uuid2.jpg
│   └── ...
├── people.json
├── metadata.json  (export info)
└── README.txt
```

**Formats Supported:**
- JSON (default)
- GPX (for geo tracking apps)
- CSV (for spreadsheet analysis)

---

## 11. Security Considerations

### 11.1 Current (MVP - Single User)

- **API:** No authentication (local use only)
- **S3:** Pre-signed URLs with 1-hour expiration
- **DB:** Local access only, no public exposure
- **HTTPS:** Not required for localhost, mandatory for production

### 11.2 Phase 2 (Multi-User)

- **Authentication:** JWT tokens (httpOnly cookies)
- **Authorization:** Row-level security in PostgreSQL
- **Password:** bcrypt hashing, min 12 chars
- **Rate Limiting:** Per-user + IP-based
- **CORS:** Whitelist frontend domain only

---

## 12. Development Roadmap

### Phase 1: MVP (Weeks 1-4)
- [ ] Project setup (Docker, FastAPI boilerplate)
- [ ] Database schema implementation
- [ ] S3 integration
- [ ] Basic memory CRUD
- [ ] Face recognition pipeline
- [ ] NLP metadata extraction
- [ ] Frontend: Map view + memory form
- [ ] PWA offline support
- [ ] Basic testing

### Phase 2: Enhancements (Weeks 5-8)
- [ ] Timeline view
- [ ] Search functionality (full-text)
- [ ] Cost tracking dashboard
- [ ] Export features
- [ ] Automated backups
- [ ] UI polish & animations
- [ ] Performance optimization

### Phase 3: Authentication (Weeks 9-10)
- [ ] JWT authentication system
- [ ] User registration/login
- [ ] Multi-user support
- [ ] Privacy controls

### Phase 4: Advanced Features (Future)
- [ ] Semantic search
- [ ] Local Llama-3 model
- [ ] CI/CD pipeline
- [ ] Monitoring & logging
- [ ] Mobile native app (React Native)

---

## 13. Testing Strategy

### 13.1 Backend Testing

**Unit Tests (pytest):**
- Service layer functions
- Database models
- Utility functions

**Integration Tests:**
- API endpoints (with TestClient)
- Database operations
- S3 mock (moto library)

**AI Testing:**
- Mock OpenAI responses
- Test face recognition with sample images

### 13.2 Frontend Testing

**Unit Tests (Vitest):**
- Utility functions
- Custom hooks

**Component Tests (React Testing Library):**
- Form validation
- Map interactions
- Offline queue logic

**E2E Tests (Playwright - Phase 2):**
- Full memory creation flow
- Search and filter
- Offline/online sync

### 13.3 Manual Testing Checklist

- [ ] Create memory offline, sync when online
- [ ] Face recognition with known/unknown faces
- [ ] Map clustering at different zoom levels
- [ ] Timeline view navigation
- [ ] Search with various filters
- [ ] Cost metrics accuracy
- [ ] Export data integrity

---

## 14. Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| **API Response Time** | < 200ms | P95 for GET requests |
| **Memory Creation** | < 500ms | API response (before AI) |
| **Face Recognition** | < 10s | Background job |
| **NLP Processing** | < 5s | Background job |
| **Map Load (50 pins)** | < 1s | Initial render |
| **PWA Install Size** | < 5MB | Excluding cached images |
| **Lighthouse Score** | > 90 | Performance, PWA, Accessibility |

---

## 15. Deployment Configuration

### 15.1 Docker Compose (Development)

```yaml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/lifelogs
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: lifelogs
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  celery_worker:
    build: ./backend
    command: celery -A tasks.celery_tasks worker --loglevel=info
    depends_on:
      - redis
      - db

volumes:
  postgres_data:
```

### 15.2 AWS EC2 Production Setup

**Instance:** t3.medium (2 vCPU, 4GB RAM)

**Services:**
- Nginx (reverse proxy)
- Docker Compose
- Certbot (SSL)

**Security Groups:**
- 80 (HTTP) → Redirect to HTTPS
- 443 (HTTPS)
- 22 (SSH) → IP restricted

---

## 16. Open Questions & Future Decisions

1. **Search Implementation:** Start with text or invest in semantic from day 1?
   - **Decision:** Text for MVP, semantic in Phase 2

2. **Face Recognition Threshold:** 0.6 is default, tune after testing

3. **Image Retention:** Keep originals forever or delete after X months?
   - **Recommendation:** Keep forever, cheap storage

4. **Backup Restoration:** Automated vs manual process?
   - **MVP:** Manual restore scripts

5. **Mobile App:** PWA sufficient or native app needed?
   - **Decision:** PWA for MVP, evaluate native later

---

## 17. Success Metrics (MVP)

- [ ] 100% of memories synced correctly (offline → online)
- [ ] Face recognition accuracy > 85% (subjective evaluation)
- [ ] NLP metadata quality > 80% ("useful" rating by user)
- [ ] Zero data loss
- [ ] Monthly costs < $30
- [ ] App usable offline for 7+ days

---

## 18. Known Limitations (MVP)

1. **No video support** (only images)
2. **No social features** (sharing, comments)
3. **No multi-device sync conflicts** (last-write-wins)
4. **No advanced analytics** (charts, insights)
5. **No voice notes** (text only)
6. **Limited to 1000 memories** (before performance optimization needed)

---

## 19. Contact & Resources

**Documentation:**
- API Docs: `http://localhost:8000/docs` (FastAPI auto-generated)
- Frontend Storybook: Future

**External Dependencies:**
- OpenAI API: https://platform.openai.com/docs
- face_recognition: https://github.com/ageitgey/face_recognition
- Leaflet: https://leafletjs.com/
- PostGIS: https://postgis.net/docs/

**Support:**
- GitHub Issues: [Repository URL]
- Development Slack: [Channel]

---

**End of Architecture Document**

*This is a living document. Update version number when making significant changes.*
