"""
LifeLog AI - FastAPI Main Application
Personal Geo-Spatial Memory System
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from core.config import settings
from core.database import engine, Base
from api.v1 import api_router

# Lifespan context manager for startup/shutdown events
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup and shutdown events
    """
    # Startup
    print("🚀 Starting LifeLog AI Backend...")
    print(f"📊 Environment: {settings.ENVIRONMENT}")
    print(f"🔍 Debug Mode: {settings.DEBUG}")
    
    # Create database tables (in production use Alembic migrations)
    async with engine.begin() as conn:
        # await conn.run_sync(Base.metadata.create_all)
        pass  # Tables will be created manually first time
    
    print("✅ Database connected")
    yield
    
    # Shutdown
    print("🛑 Shutting down LifeLog AI Backend...")
    await engine.dispose()


# Initialize FastAPI app
app = FastAPI(
    title="LifeLog AI API",
    description="Personal Geo-Spatial Memory System with AI-powered face recognition and NLP",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root endpoint
@app.get("/")
async def root():
    """
    Root endpoint - API health check
    """
    return {
        "service": "LifeLog AI API",
        "version": "0.1.0",
        "status": "operational",
        "environment": settings.ENVIRONMENT,
        "docs": "/docs"
    }


# Health check endpoint
@app.get("/health")
async def health_check():
    """
    Health check endpoint for monitoring
    """
    return {
        "status": "healthy",
        "database": "connected",  # TODO: Add actual DB check
        "redis": "connected",     # TODO: Add actual Redis check
    }


# Include API routers
app.include_router(
    api_router,
    prefix="/api"
)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG
    )
