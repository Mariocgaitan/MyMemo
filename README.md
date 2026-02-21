# LifeLog AI - Personal Geo-Spatial Memory System

<div align="center">

🗺️ **A mobile-first PWA to capture and enrich daily experiences with AI**

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-00a393?logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.3+-61dafb?logo=react)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-336791?logo=postgresql)](https://www.postgresql.org/)
[![Python](https://img.shields.io/badge/Python-3.12+-3776ab?logo=python)](https://www.python.org/)

</div>

---

## 📋 Overview

LifeLog AI is a personal memory logging system that combines geolocation, photography, and artificial intelligence to create a rich, searchable archive of your life experiences.

**Key Features:**
- 📸 Photo capture with GPS coordinates
- 🧠 AI-powered face recognition (one-shot learning)
- 📝 NLP metadata extraction (sentiment, tags, entities)
- 🗺️ Interactive map visualization with clustering
- 📱 Offline-first PWA (Progressive Web App)
- 💰 Built-in cost tracking and management

---

## 🏗️ Architecture

### Tech Stack

**Frontend:**
- React 18 + Vite
- TailwindCSS
- Leaflet.js + OpenStreetMap
- IndexedDB (Dexie.js) for offline storage
- PWA with Service Workers

**Backend:**
- Python 3.12 with FastAPI
- PostgreSQL 16 with PostGIS + pgvector
- Redis for Celery task queue
- AWS S3 for image storage
- OpenAI API (GPT-4o-mini) for NLP

**AI/ML:**
- `face_recognition` (dlib) for face detection
- OpenAI for structured data extraction
- Future: Local Llama-3 model

---

## 🚀 Quick Start

### Prerequisites

- **Docker Desktop** (recommended)
- **Python 3.12+** with `uv`
- **Node.js 20+**
- **Git**

### 1. Clone & Setup

```bash
# Clone repository
cd MyMemo

# Copy environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Edit backend/.env and add your API keys:
# - AWS_ACCESS_KEY_ID
# - AWS_SECRET_ACCESS_KEY
# - OPENAI_API_KEY
```

### 2. Start with Docker (Recommended)

```bash
# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f

# Access services:
# - Frontend: http://localhost:5173
# - Backend API: http://localhost:8000
# - API Docs: http://localhost:8000/docs
```

### 3. Manual Setup (Without Docker)

#### Backend

```bash
cd backend

# Create virtual environment with uv
uv venv
.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # Linux/Mac

# Install dependencies
uv pip install -e .

# Start PostgreSQL and Redis separately (you'll need them running)

# Run migrations (once DB schema is created)
# python -m alembic upgrade head

# Start backend
uvicorn main:app --reload
```

#### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

---

## 📁 Project Structure

```
MyMemo/
├── backend/
│   ├── api/
│   │   └── v1/
│   │       └── endpoints/        # API routes
│   ├── core/
│   │   ├── config.py             # Settings
│   │   └── database.py           # DB connection
│   ├── models/                   # SQLAlchemy models
│   ├── services/
│   │   ├── face_service.py       # Face recognition
│   │   ├── nlp_service.py        # OpenAI processing
│   │   ├── geo_service.py        # PostGIS queries
│   │   └── storage_service.py    # S3 operations
│   ├── tasks/                    # Celery background jobs
│   ├── utils/                    # Helper functions
│   ├── tests/                    # Unit & integration tests
│   ├── main.py                   # FastAPI app
│   ├── pyproject.toml            # Dependencies (uv)
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── components/           # React components
│   │   ├── pages/                # Page views
│   │   ├── hooks/                # Custom hooks
│   │   ├── utils/                # Utilities
│   │   ├── App.jsx               # Main app
│   │   └── main.jsx              # Entry point
│   ├── public/                   # Static assets
│   ├── package.json
│   ├── vite.config.js
│   └── Dockerfile.dev
│
├── deployment/
│   └── init-extensions.sql       # PostgreSQL extensions
│
├── Proyecto_md/
│   ├── vision_borad.md           # Original MVP spec
│   ├── Architecture.md           # Technical deep dive
│   ├── Final_Architecture.md     # Complete architecture
│   └── Project_Tracker.md        # Development log
│
├── docker-compose.yml
└── .gitignore
```

---

## 🗄️ Database Setup

PostgreSQL extensions are initialized automatically via Docker. If running manually:

```sql
-- Connect to your database and run:
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

---

## 🧪 Development

### Backend Testing

```bash
cd backend
pytest                    # Run all tests
pytest -v                 # Verbose output
pytest --cov              # With coverage
```

### Frontend Testing

```bash
cd frontend
npm run lint              # Lint check
npm run build             # Production build
npm run preview           # Preview build
```

### Code Formatting (Backend)

```bash
black .                   # Format code
ruff check .              # Lint
mypy .                    # Type check
```

---

## 📊 Cost Management

The system tracks usage in real-time:

- **OpenAI API calls** (GPT-4o-mini)
- **S3 storage** (images + backups)
- **Monthly budget alerts** (default: $50)

Access dashboard: `GET /api/v1/usage/dashboard`

---

## 🔒 Security Notes

**Current (MVP):**
- No authentication (single-user local system)
- S3 pre-signed URLs (1-hour expiration)
- Local database access only

**Phase 2 (Planned):**
- JWT authentication
- Multi-user support
- Row-level security

---

## 📚 API Documentation

Once the backend is running:
- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

---

## 🛣️ Roadmap

- [x] ✅ Phase 0: Architecture & Planning (Complete)
- [ ] 🚧 Phase 1: MVP Development (In Progress)
  - [ ] Environment setup
  - [ ] Database schema implementation
  - [ ] Core CRUD operations
  - [ ] Face recognition pipeline
  - [ ] NLP metadata extraction
  - [ ] Map view
  - [ ] PWA offline support
- [ ] ⏳ Phase 2: Enhancements
  - [ ] Timeline view
  - [ ] Search functionality
  - [ ] Cost tracking dashboard
  - [ ] Export features
- [ ] ⏳ Phase 3: Authentication
- [ ] ⏳ Phase 4: Advanced Features

See [Project_Tracker.md](Proyecto_md/Project_Tracker.md) for detailed progress.

---

## 📖 Documentation

- **[Vision Board](Proyecto_md/vision_borad.md)** - Original MVP specification
- **[Final Architecture](Proyecto_md/Final_Architecture.md)** - Complete system design
- **[Project Tracker](Proyecto_md/Project_Tracker.md)** - Development log

---

## 🤝 Contributing

This is a personal project, but suggestions are welcome! Open an issue for:
- Bug reports
- Feature requests
- Architecture improvements

---

## 📄 License

Private project - All rights reserved.

---

## 🙏 Acknowledgments

- **FastAPI** - Modern Python API framework
- **React** - UI library
- **Leaflet** - Interactive maps
- **face_recognition** - Face detection
- **OpenAI** - NLP capabilities

---

<div align="center">

**Built with ❤️ for preserving life's moments**

[Report Bug](https://github.com/yourusername/MyMemo/issues) · [Request Feature](https://github.com/yourusername/MyMemo/issues)

</div>
