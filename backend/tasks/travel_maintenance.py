"""
Periodic maintenance tasks for TravelMemo.
"""

import uuid

from sqlalchemy import select

from core.database import AsyncSessionLocal
from models.database import User
from services.travel_service import travel_service
from tasks.celery_app import celery_app


@celery_app.task
def update_place_stats():
    import asyncio

    async def _run():
        async with AsyncSessionLocal() as db:
            await travel_service.update_place_stats(db)

    asyncio.run(_run())
    return {"status": "ok"}


@celery_app.task
def update_user_travel_profile(user_id: str):
    import asyncio

    async def _run():
        async with AsyncSessionLocal() as db:
            return await travel_service.update_user_profile(db, uuid.UUID(user_id))

    prefs = asyncio.run(_run())
    return {"status": "ok", "user_id": user_id, "profile_vector": prefs.profile_vector}


@celery_app.task
def update_all_user_travel_profiles():
    import asyncio

    async def _run():
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(User.id))
            return [str(user_id) for user_id in result.scalars().all()]

    user_ids = asyncio.run(_run())

    for user_id in user_ids:
        update_user_travel_profile.delay(user_id)

    return {"status": "queued", "users": len(user_ids)}
