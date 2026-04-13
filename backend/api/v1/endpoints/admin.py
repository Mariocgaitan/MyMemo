"""
Admin stats endpoint — platform-wide metrics for the ops dashboard.
Protected by API key (X-Admin-Key header), NOT by user JWT.
No personal data is exposed — only aggregated counts and costs.
"""
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, cast, Date, text
from typing import Optional, Any
from datetime import datetime, timedelta, timezone
from calendar import monthrange
import os

import boto3
from botocore.exceptions import BotoCoreError, ClientError
import redis

try:
    import psutil
except Exception:  # pragma: no cover - optional runtime dependency
    psutil = None

from tasks.celery_app import celery_app

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


def _month_window_utc(now: datetime) -> tuple[datetime, datetime, int]:
    month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    if now.month == 12:
        next_month = datetime(now.year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        next_month = datetime(now.year, now.month + 1, 1, tzinfo=timezone.utc)
    return month_start, next_month, monthrange(now.year, now.month)[1]


def _pct(numerator: float, denominator: float) -> float:
    if denominator <= 0:
        return 0.0
    return round((numerator / denominator) * 100.0, 2)


def _daily_average(total: float, days_elapsed: int) -> float:
    if days_elapsed <= 0:
        return 0.0
    return round(total / days_elapsed, 4)


async def _get_db_metrics(db: AsyncSession) -> dict[str, Any]:
    active_connections = (await db.execute(text("""
        SELECT count(*)
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND state <> 'idle'
    """))).scalar() or 0

    max_connections = (await db.execute(text("SHOW max_connections"))).scalar() or 0
    try:
        max_connections = int(max_connections)
    except Exception:
        max_connections = 0

    db_size_bytes = (await db.execute(text("SELECT pg_database_size(current_database())"))).scalar() or 0
    db_size_gb = float(db_size_bytes) / (1024 ** 3) if db_size_bytes else 0.0

    return {
        "connections_active": int(active_connections),
        "max_connections": int(max_connections),
        "connections_pct": _pct(float(active_connections), float(max_connections)) if max_connections else 0.0,
        "db_size_gb": round(db_size_gb, 4),
    }


def _get_server_metrics() -> dict[str, Any]:
    if psutil is None:
        return {
            "available": False,
            "reason": "psutil not installed",
        }

    vm = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    proc = psutil.Process(os.getpid())
    uptime_seconds = max(0.0, datetime.now(timezone.utc).timestamp() - float(proc.create_time()))

    return {
        "available": True,
        "cpu_pct": round(float(psutil.cpu_percent(interval=0.2)), 2),
        "ram_used_gb": round(float(vm.used) / (1024 ** 3), 3),
        "ram_total_gb": round(float(vm.total) / (1024 ** 3), 3),
        "ram_pct": round(float(vm.percent), 2),
        "disk_used_gb": round(float(disk.used) / (1024 ** 3), 3),
        "disk_total_gb": round(float(disk.total) / (1024 ** 3), 3),
        "disk_pct": round(float(disk.percent), 2),
        "uptime_hours": round(uptime_seconds / 3600.0, 2),
    }


def _get_redis_metrics() -> dict[str, Any]:
    try:
        r = redis.Redis.from_url(settings.REDIS_URL, socket_connect_timeout=1, socket_timeout=1)
        ping_ok = bool(r.ping())
        queue_depth = int(r.llen("celery"))
        return {
            "status": "ok" if ping_ok else "degraded",
            "queue_depth": queue_depth,
        }
    except Exception as exc:
        return {
            "status": "unavailable",
            "queue_depth": 0,
            "error": str(exc),
        }


def _get_celery_metrics() -> dict[str, Any]:
    workers_active = 0
    try:
        inspect = celery_app.control.inspect(timeout=1)
        ping_response = inspect.ping() or {}
        workers_active = len(ping_response)
    except Exception as exc:
        return {
            "workers_active": 0,
            "status": "unavailable",
            "error": str(exc),
        }

    return {
        "workers_active": workers_active,
        "status": "ok",
    }


def _derive_infra_status(server: dict[str, Any], dbm: dict[str, Any], failed_jobs_24h: int, queue_depth: int) -> str:
    critical = False
    warning = False

    if server.get("available"):
        cpu = float(server.get("cpu_pct") or 0.0)
        disk = float(server.get("disk_pct") or 0.0)
        if cpu >= 95 or disk >= 95:
            critical = True
        elif cpu >= 80 or disk >= 85:
            warning = True

    conn_pct = float(dbm.get("connections_pct") or 0.0)
    if conn_pct >= 95:
        critical = True
    elif conn_pct >= 80:
        warning = True

    if failed_jobs_24h >= 20 or queue_depth >= 100:
        critical = True
    elif failed_jobs_24h >= 5 or queue_depth >= 20:
        warning = True

    if critical:
        return "critical"
    if warning:
        return "warning"
    return "healthy"


def _new_ce_client():
    # Cost Explorer is a global service exposed from us-east-1.
    client_kwargs: dict[str, Any] = {"region_name": "us-east-1"}
    if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
        client_kwargs["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID
        client_kwargs["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY
    return boto3.client("ce", **client_kwargs)


def _get_aws_costs_from_ce(start: datetime, end: datetime) -> dict[str, Any]:
    start_str = start.date().isoformat()
    end_str = end.date().isoformat()  # end is exclusive for CE API

    try:
        ce = _new_ce_client()

        grouped = ce.get_cost_and_usage(
            TimePeriod={"Start": start_str, "End": end_str},
            Granularity="MONTHLY",
            Metrics=["UnblendedCost"],
            GroupBy=[{"Type": "DIMENSION", "Key": "SERVICE"}],
        )

        groups = (grouped.get("ResultsByTime") or [{}])[0].get("Groups") or []
        by_service = []
        total_cost = 0.0
        for group in groups:
            service_name = (group.get("Keys") or ["Unknown"])[0]
            amount = float(((group.get("Metrics") or {}).get("UnblendedCost") or {}).get("Amount") or 0.0)
            if amount <= 0:
                continue
            by_service.append({"service": service_name, "cost_usd": round(amount, 4)})
            total_cost += amount

        daily = ce.get_cost_and_usage(
            TimePeriod={"Start": start_str, "End": end_str},
            Granularity="DAILY",
            Metrics=["UnblendedCost"],
        )
        daily_series = []
        for bucket in daily.get("ResultsByTime", []):
            date_str = bucket.get("TimePeriod", {}).get("Start")
            amount = float(((bucket.get("Total") or {}).get("UnblendedCost") or {}).get("Amount") or 0.0)
            daily_series.append({"date": date_str, "infra_usd": round(amount, 4)})

        return {
            "source": "aws_cost_explorer",
            "cached_at": datetime.now(timezone.utc).isoformat(),
            "total_usd": round(total_cost, 4),
            "by_service": by_service,
            "daily_series": daily_series,
            "error": None,
        }
    except (ClientError, BotoCoreError, ValueError) as exc:
        return {
            "source": "unavailable",
            "cached_at": datetime.now(timezone.utc).isoformat(),
            "total_usd": 0.0,
            "by_service": [],
            "daily_series": [],
            "error": str(exc),
        }


async def _build_active_alerts(db: AsyncSession, now: datetime) -> list[dict]:
    alerts: list[dict] = []
    month_start, next_month, days_in_month = _month_window_utc(now)

    mtd_cost = (await db.execute(
        select(func.sum(UsageMetric.cost_usd)).where(
            UsageMetric.recorded_at >= month_start,
            UsageMetric.recorded_at < next_month,
        )
    )).scalar() or 0.0
    mtd_cost = float(mtd_cost)

    days_elapsed = max(now.day, 1)
    projected_cost = (mtd_cost / days_elapsed) * days_in_month
    budget = float(settings.MONTHLY_BUDGET_USD)
    warning_threshold = budget * (float(settings.ALERT_THRESHOLD_PERCENTAGE) / 100.0)

    if mtd_cost >= warning_threshold:
        alerts.append({
            "name": "budget_warning",
            "severity": "warning",
            "description": f"Gasto acumulado supera el {settings.ALERT_THRESHOLD_PERCENTAGE}% del presupuesto mensual",
            "triggered_at": now.isoformat(),
            "current_value": round(mtd_cost, 4),
            "threshold": round(warning_threshold, 4),
            "unit": "USD",
        })

    if projected_cost >= budget:
        alerts.append({
            "name": "budget_critical",
            "severity": "critical",
            "description": "La proyeccion de gasto mensual supera el presupuesto",
            "triggered_at": now.isoformat(),
            "current_value": round(projected_cost, 4),
            "threshold": round(budget, 4),
            "unit": "USD",
        })

    failed_jobs_1h = (await db.execute(
        select(func.count(ProcessingJob.id)).where(
            ProcessingJob.status == "failed",
            ProcessingJob.created_at >= now - timedelta(hours=1),
        )
    )).scalar() or 0

    if failed_jobs_1h > 5:
        alerts.append({
            "name": "job_failure_spike",
            "severity": "warning",
            "description": "Jobs fallidos en la ultima hora por encima del umbral",
            "triggered_at": now.isoformat(),
            "current_value": int(failed_jobs_1h),
            "threshold": 5,
            "unit": "count",
        })

    return alerts


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


@router.get(
    "/executive",
    summary="Executive dashboard snapshot",
    description="Top-line platform KPIs for admin dashboard header.",
    dependencies=[Depends(require_admin_key)],
)
async def get_executive_snapshot(db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    day7_ago = now - timedelta(days=7)
    day30_ago = now - timedelta(days=30)
    day1_ago = now - timedelta(days=1)
    month_start, next_month, days_in_month = _month_window_utc(now)

    mtd_cost = (await db.execute(
        select(func.sum(UsageMetric.cost_usd)).where(
            UsageMetric.recorded_at >= month_start,
            UsageMetric.recorded_at < next_month,
        )
    )).scalar() or 0.0
    mtd_cost = float(mtd_cost)

    projected_cost = (mtd_cost / max(now.day, 1)) * days_in_month
    budget = float(settings.MONTHLY_BUDGET_USD)

    active_users_7d = (await db.execute(
        select(func.count(func.distinct(Memory.user_id))).where(Memory.created_at >= day7_ago)
    )).scalar() or 0

    active_users_30d = (await db.execute(
        select(func.count(func.distinct(Memory.user_id))).where(Memory.created_at >= day30_ago)
    )).scalar() or 0

    start_of_day = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    memories_today = (await db.execute(
        select(func.count(Memory.id)).where(Memory.created_at >= start_of_day)
    )).scalar() or 0

    jobs_failed_24h = (await db.execute(
        select(func.count(ProcessingJob.id)).where(
            ProcessingJob.status == "failed",
            ProcessingJob.created_at >= day1_ago,
        )
    )).scalar() or 0

    alerts = await _build_active_alerts(db, now)
    platform_status = "healthy"
    if any(a["severity"] == "critical" for a in alerts):
        platform_status = "critical"
    elif any(a["severity"] == "warning" for a in alerts):
        platform_status = "warning"

    return {
        "generated_at": now.isoformat(),
        "platform_status": platform_status,
        "burn_mtd_usd": round(mtd_cost, 4),
        "burn_projected_usd": round(projected_cost, 4),
        "budget_usd": budget,
        "budget_pct_used": _pct(mtd_cost, budget),
        "users_active_7d": int(active_users_7d),
        "users_active_30d": int(active_users_30d),
        "memories_today": int(memories_today),
        "jobs_failed_24h": int(jobs_failed_24h),
        "alerts_active": len(alerts),
    }


@router.get(
    "/users-kpis",
    summary="User growth KPIs",
    description="Activation, retention proxies, activity windows and monthly cohorts.",
    dependencies=[Depends(require_admin_key)],
)
async def get_users_kpis(db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    day7_ago = now - timedelta(days=7)
    day30_ago = now - timedelta(days=30)
    day90_ago = now - timedelta(days=90)

    total_registered = (await db.execute(select(func.count(User.id)))).scalar() or 0

    active_7d = (await db.execute(
        select(func.count(func.distinct(Memory.user_id))).where(Memory.created_at >= day7_ago)
    )).scalar() or 0
    active_30d = (await db.execute(
        select(func.count(func.distinct(Memory.user_id))).where(Memory.created_at >= day30_ago)
    )).scalar() or 0
    active_90d = (await db.execute(
        select(func.count(func.distinct(Memory.user_id))).where(Memory.created_at >= day90_ago)
    )).scalar() or 0

    activated_users = (await db.execute(
        select(func.count(func.distinct(Memory.user_id)))
    )).scalar() or 0

    cohort_7_start = now - timedelta(days=14)
    cohort_7_end = now - timedelta(days=7)
    cohort_30_start = now - timedelta(days=60)
    cohort_30_end = now - timedelta(days=30)

    registered_cohort_7 = (await db.execute(
        select(func.count(User.id)).where(
            User.created_at >= cohort_7_start,
            User.created_at < cohort_7_end,
        )
    )).scalar() or 0

    returned_cohort_7 = (await db.execute(
        select(func.count(func.distinct(User.id)))
        .join(Memory, Memory.user_id == User.id)
        .where(
            User.created_at >= cohort_7_start,
            User.created_at < cohort_7_end,
            Memory.created_at >= day7_ago,
        )
    )).scalar() or 0

    registered_cohort_30 = (await db.execute(
        select(func.count(User.id)).where(
            User.created_at >= cohort_30_start,
            User.created_at < cohort_30_end,
        )
    )).scalar() or 0

    returned_cohort_30 = (await db.execute(
        select(func.count(func.distinct(User.id)))
        .join(Memory, Memory.user_id == User.id)
        .where(
            User.created_at >= cohort_30_start,
            User.created_at < cohort_30_end,
            Memory.created_at >= day30_ago,
        )
    )).scalar() or 0

    active_30d_subq = select(func.distinct(Memory.user_id)).where(Memory.created_at >= day30_ago)
    churn_proxy_30d = (await db.execute(
        select(func.count(User.id)).where(
            User.created_at < day30_ago,
            ~User.id.in_(active_30d_subq),
        )
    )).scalar() or 0

    series_rows = (await db.execute(
        select(cast(User.created_at, Date).label("day"), func.count(User.id).label("count"))
        .where(User.created_at >= day30_ago)
        .group_by("day")
        .order_by("day")
    )).all()
    new_per_day = [{"date": str(row[0]), "count": row[1]} for row in series_rows]

    cohort_rows = (await db.execute(text("""
        SELECT
            to_char(date_trunc('month', u.created_at), 'YYYY-MM') AS month,
            COUNT(*) AS registered,
            COUNT(DISTINCT CASE
                WHEN m.created_at >= date_trunc('month', u.created_at) + INTERVAL '1 month'
                 AND m.created_at <  date_trunc('month', u.created_at) + INTERVAL '2 month'
                THEN u.id END
            ) AS returned_next_month
        FROM users u
        LEFT JOIN memories m ON m.user_id = u.id
        WHERE u.created_at >= date_trunc('month', now()) - INTERVAL '6 months'
        GROUP BY 1
        ORDER BY 1
    """))).all()

    cohorts = [
        {
            "month": row[0],
            "registered": int(row[1]),
            "returned_next_month": int(row[2]),
        }
        for row in cohort_rows
    ]

    return {
        "generated_at": now.isoformat(),
        "totals": {
            "registered": int(total_registered),
            "active_7d": int(active_7d),
            "active_30d": int(active_30d),
            "active_90d": int(active_90d),
        },
        "activation_rate_pct": _pct(float(activated_users), float(total_registered)),
        "retention_7d_pct": _pct(float(returned_cohort_7), float(registered_cohort_7)),
        "retention_30d_pct": _pct(float(returned_cohort_30), float(registered_cohort_30)),
        "churn_proxy_30d": int(churn_proxy_30d),
        "new_per_day": new_per_day,
        "cohorts": cohorts,
    }


@router.get(
    "/product-kpis",
    summary="Product usage KPIs",
    description="Memory, processing, people and social metrics aggregated for dashboard.",
    dependencies=[Depends(require_admin_key)],
)
async def get_product_kpis(db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    day7_ago = now - timedelta(days=7)
    day30_ago = now - timedelta(days=30)

    memories_total = (await db.execute(select(func.count(Memory.id)))).scalar() or 0
    memories_7d = (await db.execute(
        select(func.count(Memory.id)).where(Memory.created_at >= day7_ago)
    )).scalar() or 0
    memories_30d = (await db.execute(
        select(func.count(Memory.id)).where(Memory.created_at >= day30_ago)
    )).scalar() or 0

    per_day_rows = (await db.execute(
        select(cast(Memory.created_at, Date).label("day"), func.count(Memory.id).label("count"))
        .where(Memory.created_at >= day30_ago)
        .group_by("day")
        .order_by("day")
    )).all()
    memories_per_day = [{"date": str(row[0]), "count": int(row[1])} for row in per_day_rows]

    nlp_avg_seconds = (await db.execute(
        select(func.avg(func.extract("epoch", ProcessingJob.completed_at - ProcessingJob.started_at)))
        .where(
            ProcessingJob.job_type == "nlp_extraction",
            ProcessingJob.status == "completed",
            ProcessingJob.completed_at.is_not(None),
            ProcessingJob.started_at.is_not(None),
            ProcessingJob.created_at >= day30_ago,
        )
    )).scalar() or 0.0

    face_avg_seconds = (await db.execute(
        select(func.avg(func.extract("epoch", ProcessingJob.completed_at - ProcessingJob.started_at)))
        .where(
            ProcessingJob.job_type == "face_recognition",
            ProcessingJob.status == "completed",
            ProcessingJob.completed_at.is_not(None),
            ProcessingJob.started_at.is_not(None),
            ProcessingJob.created_at >= day30_ago,
        )
    )).scalar() or 0.0

    jobs_failed_30d = (await db.execute(
        select(func.count(ProcessingJob.id)).where(
            ProcessingJob.status == "failed",
            ProcessingJob.created_at >= day30_ago,
        )
    )).scalar() or 0

    jobs_completed_30d = (await db.execute(
        select(func.count(ProcessingJob.id)).where(
            ProcessingJob.status == "completed",
            ProcessingJob.created_at >= day30_ago,
        )
    )).scalar() or 0

    people_total = (await db.execute(select(func.count(Person.id)))).scalar() or 0
    people_named = (await db.execute(
        select(func.count(Person.id)).where(~Person.name.ilike("Unknown Person%"))
    )).scalar() or 0

    connections_accepted = (await db.execute(
        select(func.count(UserConnection.id)).where(UserConnection.status == "accepted")
    )).scalar() or 0
    connections_pending = (await db.execute(
        select(func.count(UserConnection.id)).where(UserConnection.status == "pending")
    )).scalar() or 0

    return {
        "generated_at": now.isoformat(),
        "memories": {
            "total": int(memories_total),
            "last_7d": int(memories_7d),
            "last_30d": int(memories_30d),
            "per_day": memories_per_day,
        },
        "processing": {
            "nlp_avg_seconds": round(float(nlp_avg_seconds), 2),
            "face_avg_seconds": round(float(face_avg_seconds), 2),
            "jobs_failed_30d": int(jobs_failed_30d),
            "jobs_completed_30d": int(jobs_completed_30d),
        },
        "travel": {
            "available": False,
            "reason": "TravelMemo models are not present in this branch",
        },
        "people": {
            "total": int(people_total),
            "named": int(people_named),
            "unnamed": int(people_total - people_named),
        },
        "connections": {
            "accepted": int(connections_accepted),
            "pending": int(connections_pending),
        },
    }


@router.get(
    "/alerts",
    summary="Active alerts",
    description="Returns active alerts based on budget and operational thresholds.",
    dependencies=[Depends(require_admin_key)],
)
async def get_active_alerts(db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    alerts = await _build_active_alerts(db, now)
    return {
        "generated_at": now.isoformat(),
        "active_count": len(alerts),
        "alerts": alerts,
    }


@router.get(
    "/finops",
    summary="FinOps snapshot",
    description="Current month costs combining DB-tracked usage and AWS Cost Explorer when available.",
    dependencies=[Depends(require_admin_key)],
)
async def get_finops(db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    month_start, next_month, days_in_month = _month_window_utc(now)
    days_elapsed = max(now.day, 1)

    # DB usage metrics for current month (AI + Google Places tracking)
    ai_rows = (await db.execute(
        select(UsageMetric.metric_type, func.sum(UsageMetric.cost_usd), func.count(UsageMetric.id))
        .where(
            UsageMetric.recorded_at >= month_start,
            UsageMetric.recorded_at < next_month,
        )
        .group_by(UsageMetric.metric_type)
    )).all()

    ai_by_type = [
        {
            "type": row[0],
            "cost_usd": round(float(row[1] or 0.0), 4),
            "calls": int(row[2]),
        }
        for row in ai_rows
    ]
    ai_total = round(sum(item["cost_usd"] for item in ai_by_type), 4)

    aws_costs = _get_aws_costs_from_ce(month_start, next_month)
    infra_total = float(aws_costs["total_usd"])

    mtd_total = round(ai_total + infra_total, 4)
    projected = round((mtd_total / days_elapsed) * days_in_month, 4)

    memories_created_month = (await db.execute(
        select(func.count(Memory.id)).where(
            Memory.created_at >= month_start,
            Memory.created_at < next_month,
        )
    )).scalar() or 0

    active_30d = (await db.execute(
        select(func.count(func.distinct(Memory.user_id))).where(Memory.created_at >= now - timedelta(days=30))
    )).scalar() or 0

    cost_per_memory = round(mtd_total / memories_created_month, 6) if memories_created_month else 0.0
    cost_per_active_user_30d = round(mtd_total / active_30d, 6) if active_30d else 0.0
    ratio_ai_vs_infra = round(ai_total / infra_total, 4) if infra_total > 0 else 0.0

    ai_daily_rows = (await db.execute(
        select(cast(UsageMetric.recorded_at, Date).label("day"), func.sum(UsageMetric.cost_usd).label("cost"))
        .where(
            UsageMetric.recorded_at >= month_start,
            UsageMetric.recorded_at < next_month,
        )
        .group_by("day")
        .order_by("day")
    )).all()
    ai_daily_map = {str(row[0]): round(float(row[1] or 0.0), 4) for row in ai_daily_rows}
    infra_daily_map = {item["date"]: float(item["infra_usd"]) for item in aws_costs.get("daily_series", [])}

    all_dates = sorted(set(ai_daily_map.keys()) | set(infra_daily_map.keys()))
    daily_series = []
    for day in all_dates:
        ai_day = ai_daily_map.get(day, 0.0)
        infra_day = infra_daily_map.get(day, 0.0)
        daily_series.append({
            "date": day,
            "ai_usd": round(ai_day, 4),
            "infra_usd": round(infra_day, 4),
            "total_usd": round(ai_day + infra_day, 4),
        })

    response: dict[str, Any] = {
        "generated_at": now.isoformat(),
        "period": "current_month",
        "ai_costs": {
            "total_usd": ai_total,
            "by_type": ai_by_type,
        },
        "infra_costs": {
            "source": aws_costs["source"],
            "cached_at": aws_costs["cached_at"],
            "total_usd": round(infra_total, 4),
            "by_service": aws_costs["by_service"],
        },
        "totals": {
            "mtd_usd": mtd_total,
            "projected_usd": projected,
            "daily_avg_usd": _daily_average(mtd_total, days_elapsed),
        },
        "unit_economics": {
            "cost_per_memory_created": cost_per_memory,
            "cost_per_active_user_30d": cost_per_active_user_30d,
        },
        "ratio_ai_vs_infra": ratio_ai_vs_infra,
        "daily_series": daily_series,
    }

    if aws_costs.get("error"):
        response["infra_costs"]["error"] = aws_costs["error"]

    return response


@router.get(
    "/infrastructure",
    summary="Infrastructure health snapshot",
    description="DigitalOcean/host-level server, database, Redis and Celery operational metrics.",
    dependencies=[Depends(require_admin_key)],
)
async def get_infrastructure_snapshot(db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    day1_ago = now - timedelta(days=1)

    server = _get_server_metrics()
    db_metrics = await _get_db_metrics(db)
    redis_metrics = _get_redis_metrics()
    celery_metrics = _get_celery_metrics()

    jobs_failed_24h = (await db.execute(
        select(func.count(ProcessingJob.id)).where(
            ProcessingJob.status == "failed",
            ProcessingJob.created_at >= day1_ago,
        )
    )).scalar() or 0

    queue_depth = int(redis_metrics.get("queue_depth") or 0)
    overall_status = _derive_infra_status(
        server=server,
        dbm=db_metrics,
        failed_jobs_24h=int(jobs_failed_24h),
        queue_depth=queue_depth,
    )

    return {
        "generated_at": now.isoformat(),
        "overall_status": overall_status,
        "server": server,
        "database": db_metrics,
        "celery": {
            **celery_metrics,
            "queue_depth": queue_depth,
            "jobs_failed_24h": int(jobs_failed_24h),
        },
        "redis": redis_metrics,
    }
