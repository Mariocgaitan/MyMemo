"""
Usage metrics endpoints - Track AI usage and costs
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from datetime import datetime, date, timedelta

from core.database import get_db
from core.deps import get_current_user
from models.database import UsageMetric, User
from models.schemas import UsageMetricResponse, UsageSummaryResponse


router = APIRouter(prefix="/usage", tags=["usage"])


# ============================================================
# ENDPOINTS
# ============================================================

@router.get(
    "/summary",
    response_model=UsageSummaryResponse,
    summary="Get usage summary",
    description="Get aggregated usage metrics for a period"
)
async def get_usage_summary(
    start_date: Optional[date] = Query(None, description="Start date (defaults to 30 days ago)"),
    end_date: Optional[date] = Query(None, description="End date (defaults to today)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get usage summary with total costs and API calls
    
    - **start_date**: Start of period (YYYY-MM-DD)
    - **end_date**: End of period (YYYY-MM-DD)
    """
    user = current_user
    
    # Default to last 30 days if not specified
    if not end_date:
        end_date = date.today()
    if not start_date:
        start_date = end_date - timedelta(days=30)
    
    # Convert to datetime
    start_datetime = datetime.combine(start_date, datetime.min.time())
    end_datetime = datetime.combine(end_date, datetime.max.time())
    
    # Get aggregated metrics
    result = await db.execute(
        select(
            func.count(UsageMetric.id).label("total_api_calls"),
            func.sum(UsageMetric.cost_usd).label("total_cost")
        )
        .where(
            UsageMetric.user_id == user.id,
            UsageMetric.recorded_at >= start_datetime,
            UsageMetric.recorded_at <= end_datetime
        )
    )
    
    row = result.first()
    total_api_calls = row.total_api_calls or 0
    total_cost = float(row.total_cost) if row.total_cost else 0.0
    
    # Count memories created in period (from Memory table)
    from models.database import Memory
    memory_count_result = await db.execute(
        select(func.count(Memory.id))
        .where(
            Memory.user_id == user.id,
            Memory.created_at >= start_datetime,
            Memory.created_at <= end_datetime
        )
    )
    total_memories = memory_count_result.scalar()
    
    return UsageSummaryResponse(
        total_memories=total_memories,
        total_api_calls=total_api_calls,
        total_cost_usd=round(total_cost, 4),
        period_start=start_datetime,
        period_end=end_datetime
    )


@router.get(
    "/metrics",
    response_model=list[UsageMetricResponse],
    summary="Get detailed usage metrics",
    description="Get individual usage metric records"
)
async def get_usage_metrics(
    metric_type: Optional[str] = Query(None, description="Filter by metric type"),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get detailed usage metric records
    
    - **metric_type**: Filter by type (e.g., "openai_nlp_extraction")
    - **start_date/end_date**: Date range filter
    - **limit**: Maximum records to return
    """
    user = current_user
    
    # Build query
    query = select(UsageMetric).where(UsageMetric.user_id == user.id)
    
    # Apply filters
    if metric_type:
        query = query.where(UsageMetric.metric_type == metric_type)
    
    if start_date:
        start_datetime = datetime.combine(start_date, datetime.min.time())
        query = query.where(UsageMetric.recorded_at >= start_datetime)
    
    if end_date:
        end_datetime = datetime.combine(end_date, datetime.max.time())
        query = query.where(UsageMetric.recorded_at <= end_datetime)
    
    # Order by most recent first
    query = query.order_by(UsageMetric.recorded_at.desc()).limit(limit)
    
    result = await db.execute(query)
    metrics = result.scalars().all()
    
    return metrics


@router.get(
    "/by-type",
    summary="Get usage breakdown by type",
    description="Get cost and count breakdown by metric type"
)
async def get_usage_by_type(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get usage breakdown grouped by metric type
    
    Returns aggregated stats per metric type (useful for cost analysis)
    """
    user = current_user
    
    # Default to last 30 days
    if not end_date:
        end_date = date.today()
    if not start_date:
        start_date = end_date - timedelta(days=30)
    
    start_datetime = datetime.combine(start_date, datetime.min.time())
    end_datetime = datetime.combine(end_date, datetime.max.time())
    
    # Group by metric_type
    result = await db.execute(
        select(
            UsageMetric.metric_type,
            func.count(UsageMetric.id).label("count"),
            func.sum(UsageMetric.cost_usd).label("total_cost"),
            func.avg(UsageMetric.cost_usd).label("avg_cost")
        )
        .where(
            UsageMetric.user_id == user.id,
            UsageMetric.recorded_at >= start_datetime,
            UsageMetric.recorded_at <= end_datetime
        )
        .group_by(UsageMetric.metric_type)
        .order_by(func.sum(UsageMetric.cost_usd).desc())
    )
    
    breakdown = []
    for row in result:
        breakdown.append({
            "metric_type": row.metric_type,
            "count": row.count,
            "total_cost_usd": round(float(row.total_cost), 4),
            "avg_cost_usd": round(float(row.avg_cost), 6)
        })
    
    return {
        "period_start": start_datetime.isoformat(),
        "period_end": end_datetime.isoformat(),
        "breakdown": breakdown
    }


@router.get(
    "/daily",
    summary="Get daily usage stats",
    description="Get usage aggregated by day"
)
async def get_daily_usage(
    days: int = Query(30, ge=1, le=365, description="Number of days to retrieve"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get daily usage statistics for the last N days
    
    Useful for charts and tracking usage over time
    """
    user = current_user
    
    end_date = date.today()
    start_date = end_date - timedelta(days=days)
    
    start_datetime = datetime.combine(start_date, datetime.min.time())
    end_datetime = datetime.combine(end_date, datetime.max.time())
    
    # Group by date
    result = await db.execute(
        select(
            func.date(UsageMetric.recorded_at).label("date"),
            func.count(UsageMetric.id).label("count"),
            func.sum(UsageMetric.cost_usd).label("total_cost")
        )
        .where(
            UsageMetric.user_id == user.id,
            UsageMetric.recorded_at >= start_datetime,
            UsageMetric.recorded_at <= end_datetime
        )
        .group_by(func.date(UsageMetric.recorded_at))
        .order_by(func.date(UsageMetric.recorded_at))
    )
    
    daily_stats = []
    for row in result:
        daily_stats.append({
            "date": row.date.isoformat(),
            "api_calls": row.count,
            "cost_usd": round(float(row.total_cost), 4)
        })
    
    return {
        "period_days": days,
        "daily_stats": daily_stats
    }


@router.get(
    "/current-month",
    summary="Get current month usage",
    description="Get usage for the current calendar month"
)
async def get_current_month_usage(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get usage statistics for the current calendar month
    
    Useful for monthly budget tracking
    """
    user = current_user
    
    # Calculate first and last day of current month
    today = date.today()
    first_day = date(today.year, today.month, 1)
    
    # Calculate last day of month
    if today.month == 12:
        last_day = date(today.year + 1, 1, 1) - timedelta(days=1)
    else:
        last_day = date(today.year, today.month + 1, 1) - timedelta(days=1)
    
    start_datetime = datetime.combine(first_day, datetime.min.time())
    end_datetime = datetime.combine(last_day, datetime.max.time())
    
    # Get aggregated metrics
    result = await db.execute(
        select(
            func.count(UsageMetric.id).label("total_calls"),
            func.sum(UsageMetric.cost_usd).label("total_cost")
        )
        .where(
            UsageMetric.user_id == user.id,
            UsageMetric.recorded_at >= start_datetime,
            UsageMetric.recorded_at <= end_datetime
        )
    )
    
    row = result.first()
    total_calls = row.total_calls or 0
    total_cost = float(row.total_cost) if row.total_cost else 0.0
    
    # Calculate days remaining in month
    days_in_month = (last_day - first_day).days + 1
    days_elapsed = (today - first_day).days + 1
    days_remaining = days_in_month - days_elapsed
    
    # Estimate projected cost
    if days_elapsed > 0:
        daily_avg = total_cost / days_elapsed
        projected_cost = daily_avg * days_in_month
    else:
        projected_cost = 0.0
    
    return {
        "month": f"{today.year}-{today.month:02d}",
        "days_elapsed": days_elapsed,
        "days_remaining": days_remaining,
        "total_api_calls": total_calls,
        "total_cost_usd": round(total_cost, 4),
        "projected_cost_usd": round(projected_cost, 4),
        "daily_average_usd": round(total_cost / days_elapsed, 4) if days_elapsed > 0 else 0.0
    }
