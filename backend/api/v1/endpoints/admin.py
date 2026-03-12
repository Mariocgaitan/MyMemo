"""
Admin stats endpoint — platform-wide metrics for the ops dashboard.
Protected by API key (X-Admin-Key header), NOT by user JWT.
No personal data is exposed — only aggregated counts and costs.
"""
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, cast, Date
from typing import Optional
from datetime import datetime, timedelta, timezone

from core.database import get_db
from core.config import settings
from models.database import User, Memory, Person, UserConnection, UsageMetric, ProcessingJob

router = APIRouter(prefix="/admin", tags=["admin"])


# ── Auth dependency ───────────────────────────────────────────────────────────

def require_admin_key(x_admin_key: Optional[str] = Header(None)):
    if not settings.ADMIN_API_KEY:
        raise HTTPException(status_code=503, detail="Admin key not configured on server")
    if x_admin_key != settings.ADMIN_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing admin key")


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.get(
    "/stats",
    summary="Platform-wide admin stats",
    description="Aggregated metrics: users, memories, connections, costs, activity. No personal data.",
    dependencies=[Depends(require_admin_key)],
)
async def get_admin_stats(db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    day7_ago  = now - timedelta(days=7)
    day30_ago = now - timedelta(days=30)

    # ── User counts ──────────────────────────────────────────────────────────
    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0

    new_users_7d = (await db.execute(
        select(func.count(User.id)).where(User.created_at >= day7_ago)
    )).scalar() or 0

    new_users_30d = (await db.execute(
        select(func.count(User.id)).where(User.created_at >= day30_ago)
    )).scalar() or 0

    # Active = uploaded at least 1 memory in the last 30 days
    active_users_30d = (await db.execute(
        select(func.count(func.distinct(Memory.user_id))).where(Memory.created_at >= day30_ago)
    )).scalar() or 0

    # ── Memory counts ────────────────────────────────────────────────────────
    total_memories = (await db.execute(select(func.count(Memory.id)))).scalar() or 0

    memories_7d = (await db.execute(
        select(func.count(Memory.id)).where(Memory.created_at >= day7_ago)
    )).scalar() or 0

    memories_30d = (await db.execute(
        select(func.count(Memory.id)).where(Memory.created_at >= day30_ago)
    )).scalar() or 0

    # ── Connection counts ────────────────────────────────────────────────────
    total_connections = (await db.execute(
        select(func.count(UserConnection.id)).where(UserConnection.status == "accepted")
    )).scalar() or 0

    pending_connections = (await db.execute(
        select(func.count(UserConnection.id)).where(UserConnection.status == "pending")
    )).scalar() or 0

    # ── People / face recognition ────────────────────────────────────────────
    total_people = (await db.execute(select(func.count(Person.id)))).scalar() or 0

    named_people = (await db.execute(
        select(func.count(Person.id)).where(~Person.name.ilike("Unknown Person%"))
    )).scalar() or 0

    # ── Cost & token metrics ─────────────────────────────────────────────────
    cost_total = (await db.execute(
        select(func.sum(UsageMetric.cost_usd))
    )).scalar() or 0.0

    cost_30d = (await db.execute(
        select(func.sum(UsageMetric.cost_usd)).where(UsageMetric.recorded_at >= day30_ago)
    )).scalar() or 0.0

    cost_7d = (await db.execute(
        select(func.sum(UsageMetric.cost_usd)).where(UsageMetric.recorded_at >= day7_ago)
    )).scalar() or 0.0

    # Cost breakdown by metric_type (last 30d)
    type_rows = (await db.execute(
        select(UsageMetric.metric_type, func.sum(UsageMetric.cost_usd), func.count(UsageMetric.id))
        .where(UsageMetric.recorded_at >= day30_ago)
        .group_by(UsageMetric.metric_type)
    )).all()
    cost_by_type = [
        {"type": row[0], "cost_usd": round(float(row[1] or 0), 6), "count": row[2]}
        for row in type_rows
    ]

    # ── Processing jobs ──────────────────────────────────────────────────────
    job_rows = (await db.execute(
        select(ProcessingJob.status, func.count(ProcessingJob.id))
        .where(ProcessingJob.created_at >= day30_ago)
        .group_by(ProcessingJob.status)
    )).all()
    jobs_by_status = {row[0]: row[1] for row in job_rows}

    # ── Time-series: new memories per day (last 30d) ─────────────────────────
    mem_series_rows = (await db.execute(
        select(cast(Memory.created_at, Date).label("day"), func.count(Memory.id).label("count"))
        .where(Memory.created_at >= day30_ago)
        .group_by("day")
        .order_by("day")
    )).all()
    memories_per_day = [{"date": str(row[0]), "count": row[1]} for row in mem_series_rows]

    # ── Time-series: new users per day (last 30d) ────────────────────────────
    user_series_rows = (await db.execute(
        select(cast(User.created_at, Date).label("day"), func.count(User.id).label("count"))
        .where(User.created_at >= day30_ago)
        .group_by("day")
        .order_by("day")
    )).all()
    users_per_day = [{"date": str(row[0]), "count": row[1]} for row in user_series_rows]

    # ── Time-series: cost per day (last 30d) ─────────────────────────────────
    cost_series_rows = (await db.execute(
        select(
            cast(UsageMetric.recorded_at, Date).label("day"),
            func.sum(UsageMetric.cost_usd).label("cost"),
        )
        .where(UsageMetric.recorded_at >= day30_ago)
        .group_by("day")
        .order_by("day")
    )).all()
    cost_per_day = [{"date": str(row[0]), "cost_usd": round(float(row[1] or 0), 6)} for row in cost_series_rows]

    return {
        "generated_at": now.isoformat(),

        "users": {
            "total": total_users,
            "new_last_7d": new_users_7d,
            "new_last_30d": new_users_30d,
            "active_last_30d": active_users_30d,
        },

        "memories": {
            "total": total_memories,
            "last_7d": memories_7d,
            "last_30d": memories_30d,
        },

        "connections": {
            "accepted": total_connections,
            "pending": pending_connections,
        },

        "people": {
            "total": total_people,
            "named": named_people,
            "unknown": total_people - named_people,
        },

        "costs": {
            "total_usd": round(float(cost_total), 4),
            "last_30d_usd": round(float(cost_30d), 4),
            "last_7d_usd": round(float(cost_7d), 4),
            "by_type_last_30d": cost_by_type,
        },

        "jobs_last_30d": jobs_by_status,

        "series": {
            "memories_per_day": memories_per_day,
            "users_per_day": users_per_day,
            "cost_per_day": cost_per_day,
        },
    }


@router.get(
    "/users",
    summary="Per-user aggregated stats",
    description="Non-personal aggregated metrics per user: counts of memories, people, connections and cost.",
    dependencies=[Depends(require_admin_key)],
)
async def get_users_stats(db: AsyncSession = Depends(get_db)):
    # Users + memory count + people count + last activity
    rows = (await db.execute(
        select(
            User.id,
            User.name,
            User.created_at,
            func.count(func.distinct(Memory.id)).label("memory_count"),
            func.count(func.distinct(Person.id)).label("people_count"),
            func.max(Memory.created_at).label("last_activity"),
        )
        .outerjoin(Memory, Memory.user_id == User.id)
        .outerjoin(Person, Person.user_id == User.id)
        .group_by(User.id, User.name, User.created_at)
        .order_by(func.count(func.distinct(Memory.id)).desc())
    )).all()

    # Cost per user
    cost_rows = (await db.execute(
        select(UsageMetric.user_id, func.sum(UsageMetric.cost_usd))
        .group_by(UsageMetric.user_id)
    )).all()
    cost_map = {row[0]: float(row[1] or 0) for row in cost_rows}

    # Connections per user (requester + addressee, accepted only)
    conn_req = (await db.execute(
        select(UserConnection.requester_id, func.count(UserConnection.id))
        .where(UserConnection.status == "accepted")
        .group_by(UserConnection.requester_id)
    )).all()
    conn_addr = (await db.execute(
        select(UserConnection.addressee_id, func.count(UserConnection.id))
        .where(UserConnection.status == "accepted")
        .group_by(UserConnection.addressee_id)
    )).all()
    conn_map: dict = {}
    for uid, cnt in conn_req:
        conn_map[uid] = conn_map.get(uid, 0) + cnt
    for uid, cnt in conn_addr:
        conn_map[uid] = conn_map.get(uid, 0) + cnt

    return {
        "total": len(rows),
        "users": [
            {
                "name":          row.name or "Sin nombre",
                "joined":        row.created_at.isoformat() if row.created_at else None,
                "memories":      row.memory_count,
                "people":        row.people_count,
                "connections":   conn_map.get(row.id, 0),
                "last_activity": row.last_activity.isoformat() if row.last_activity else None,
                "cost_usd":      round(cost_map.get(row.id, 0), 6),
            }
            for row in rows
        ],
    }
