"""
API v1 - Version 1 endpoints
"""
from fastapi import APIRouter
from api.v1.endpoints import auth, memories, people, search, usage, connections, admin

# Create main API router for v1
api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(auth.router, prefix="/v1/auth", tags=["auth"])
api_router.include_router(memories.router, prefix="/v1", tags=["memories"])
api_router.include_router(people.router, prefix="/v1", tags=["people"])
api_router.include_router(search.router, prefix="/v1", tags=["search"])
api_router.include_router(usage.router, prefix="/v1", tags=["usage"])
api_router.include_router(connections.router, prefix="/v1", tags=["connections"])
api_router.include_router(admin.router, prefix="/v1", tags=["admin"])
