"""
MyMemo Admin Dashboard - Phase D UI
Run with: uv run streamlit run app.py
"""

import os
from datetime import datetime
from typing import Any

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import requests
import streamlit as st
from dotenv import load_dotenv

load_dotenv()


# -----------------------------------------------------------------------------
# Config
# -----------------------------------------------------------------------------
API_URL = os.getenv("MYMEMO_API_URL", "http://localhost:8000").rstrip("/")
ADMIN_KEY = os.getenv("ADMIN_API_KEY", "").strip()
USE_MOCK_DATA = os.getenv("USE_MOCK_DATA", "false").strip().lower() in {"1", "true", "yes", "on"}
REQUEST_TIMEOUT_SEC = int(os.getenv("DASHBOARD_REQUEST_TIMEOUT_SEC", "20"))

st.set_page_config(
    page_title="MyMemo Admin",
    page_icon="MAP",
    layout="wide",
    initial_sidebar_state="expanded",
)

COLORS = {
    "blue": "#1f77b4",
    "green": "#2ca02c",
    "orange": "#ff7f0e",
    "red": "#d62728",
    "purple": "#9467bd",
    "gray": "#7f7f7f",
    "teal": "#17becf",
}

st.markdown(
    """
<style>
[data-testid="stAppViewContainer"] {
    background:
      radial-gradient(1200px 400px at 10% -10%, rgba(23, 162, 184, 0.10), transparent 40%),
      radial-gradient(1000px 350px at 90% -15%, rgba(255, 127, 14, 0.10), transparent 42%),
      linear-gradient(180deg, #f8fbfc 0%, #f6f8fb 100%);
}
[data-testid="stMetric"] {
    background: rgba(255,255,255,0.85);
    border: 1px solid rgba(20,30,40,0.08);
    border-radius: 12px;
    padding: 14px 16px;
    box-shadow: 0 6px 18px rgba(20,30,40,0.06);
}
.section-title {
    font-size: 0.92rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    opacity: 0.65;
    margin: 0.7rem 0 0.5rem;
}
.hero {
    border-radius: 14px;
    border: 1px solid rgba(20,30,40,0.1);
    background: rgba(255,255,255,0.75);
    box-shadow: 0 10px 24px rgba(20,30,40,0.08);
    padding: 14px 16px;
    margin-bottom: 12px;
}
.pill {
    display: inline-block;
    border-radius: 999px;
    padding: 0.16rem 0.68rem;
    font-size: 0.78rem;
    font-weight: 700;
    margin-right: 0.35rem;
    border: 1px solid transparent;
}
.pill-healthy { background: #e8f7ef; color: #176a3a; border-color: #bfe9d0; }
.pill-warning { background: #fff3dc; color: #8e5a00; border-color: #ffd78d; }
.pill-critical { background: #ffe8e8; color: #8b1d1d; border-color: #ffc4c4; }
.pill-unknown { background: #edf1f4; color: #4c5b66; border-color: #d2dce3; }
</style>
""",
    unsafe_allow_html=True,
)


# -----------------------------------------------------------------------------
# Mock Data
# -----------------------------------------------------------------------------
MOCK_DATA: dict[str, Any] = {
    "executive": {
        "generated_at": "2026-04-12T18:30:00Z",
        "platform_status": "healthy",
        "burn_mtd_usd": 13.42,
        "burn_projected_usd": 33.55,
        "budget_usd": 50.0,
        "budget_pct_used": 26.84,
        "users_active_7d": 4,
        "users_active_30d": 9,
        "memories_today": 3,
        "jobs_failed_24h": 0,
        "alerts_active": 0,
    },
    "finops": {
        "generated_at": "2026-04-12T18:30:00Z",
        "period": "current_month",
        "ai_costs": {
            "total_usd": 3.42,
            "by_type": [
                {"type": "openai_nlp_extraction", "cost_usd": 2.89, "calls": 71},
                {"type": "google_places_autocomplete", "cost_usd": 0.31, "calls": 110},
                {"type": "google_places_reverse_geocode", "cost_usd": 0.22, "calls": 44},
            ],
        },
        "infra_costs": {
            "source": "aws_cost_explorer",
            "cached_at": "2026-04-12T18:15:00Z",
            "total_usd": 10.0,
            "by_service": [
                {"service": "Amazon Simple Storage Service", "cost_usd": 8.2},
                {"service": "Data Transfer", "cost_usd": 1.8},
            ],
        },
        "totals": {
            "mtd_usd": 13.42,
            "projected_usd": 33.55,
            "daily_avg_usd": 1.12,
        },
        "unit_economics": {
            "cost_per_memory_created": 0.081,
            "cost_per_active_user_30d": 1.49,
        },
        "ratio_ai_vs_infra": 0.342,
        "daily_series": [
            {"date": "2026-04-09", "ai_usd": 0.22, "infra_usd": 0.79, "total_usd": 1.01},
            {"date": "2026-04-10", "ai_usd": 0.18, "infra_usd": 0.81, "total_usd": 0.99},
            {"date": "2026-04-11", "ai_usd": 0.27, "infra_usd": 0.82, "total_usd": 1.09},
            {"date": "2026-04-12", "ai_usd": 0.31, "infra_usd": 0.83, "total_usd": 1.14},
        ],
    },
    "infrastructure": {
        "generated_at": "2026-04-12T18:30:00Z",
        "overall_status": "healthy",
        "server": {
            "available": True,
            "cpu_pct": 17.4,
            "ram_used_gb": 1.1,
            "ram_total_gb": 2.0,
            "ram_pct": 55.0,
            "disk_used_gb": 7.3,
            "disk_total_gb": 25.0,
            "disk_pct": 29.2,
            "uptime_hours": 112.8,
        },
        "database": {
            "connections_active": 4,
            "max_connections": 100,
            "connections_pct": 4.0,
            "db_size_gb": 1.83,
        },
        "celery": {
            "workers_active": 1,
            "status": "ok",
            "queue_depth": 0,
            "jobs_failed_24h": 0,
        },
        "redis": {
            "status": "ok",
            "queue_depth": 0,
        },
    },
    "users_kpis": {
        "generated_at": "2026-04-12T18:30:00Z",
        "totals": {"registered": 14, "active_7d": 4, "active_30d": 9, "active_90d": 11},
        "activation_rate_pct": 64.29,
        "retention_7d_pct": 50.0,
        "retention_30d_pct": 40.0,
        "churn_proxy_30d": 3,
        "new_per_day": [
            {"date": "2026-04-09", "count": 1},
            {"date": "2026-04-11", "count": 2},
        ],
        "cohorts": [
            {"month": "2026-02", "registered": 4, "returned_next_month": 2},
            {"month": "2026-03", "registered": 5, "returned_next_month": 3},
            {"month": "2026-04", "registered": 5, "returned_next_month": 0},
        ],
    },
    "product_kpis": {
        "generated_at": "2026-04-12T18:30:00Z",
        "memories": {
            "total": 166,
            "last_7d": 21,
            "last_30d": 62,
            "per_day": [
                {"date": "2026-04-09", "count": 4},
                {"date": "2026-04-10", "count": 5},
                {"date": "2026-04-11", "count": 6},
                {"date": "2026-04-12", "count": 3},
            ],
        },
        "processing": {
            "nlp_avg_seconds": 2.8,
            "face_avg_seconds": 5.6,
            "jobs_failed_30d": 2,
            "jobs_completed_30d": 141,
        },
        "travel": {"available": False, "reason": "TravelMemo models are not present in this branch"},
        "people": {"total": 34, "named": 15, "unnamed": 19},
        "connections": {"accepted": 9, "pending": 1},
    },
    "alerts": {
        "generated_at": "2026-04-12T18:30:00Z",
        "active_count": 0,
        "alerts": [],
    },
    "users": {
        "total": 3,
        "users": [
            {
                "name": "Mario",
                "joined": "2026-02-18T12:10:00Z",
                "memories": 44,
                "people": 13,
                "connections": 5,
                "last_activity": "2026-04-12T10:11:00Z",
                "cost_usd": 2.31,
            },
            {
                "name": "Ana",
                "joined": "2026-03-08T09:10:00Z",
                "memories": 18,
                "people": 8,
                "connections": 2,
                "last_activity": "2026-04-11T18:01:00Z",
                "cost_usd": 0.89,
            },
            {
                "name": "Luis",
                "joined": "2026-03-20T13:55:00Z",
                "memories": 9,
                "people": 4,
                "connections": 1,
                "last_activity": "2026-04-09T07:20:00Z",
                "cost_usd": 0.22,
            },
        ],
    },
    "stats": {
        "generated_at": "2026-04-12T18:30:00Z",
        "users": {"total": 14, "new_last_7d": 3, "new_last_30d": 8, "active_last_30d": 9},
        "memories": {"total": 166, "last_7d": 21, "last_30d": 62},
        "connections": {"accepted": 9, "pending": 1},
        "people": {"total": 34, "named": 15, "unknown": 19},
        "costs": {
            "total_usd": 3.42,
            "last_30d_usd": 2.96,
            "last_7d_usd": 1.05,
            "by_type_last_30d": [
                {"type": "openai_nlp_extraction", "cost_usd": 2.89, "count": 71},
                {"type": "google_places_autocomplete", "cost_usd": 0.31, "count": 110},
            ],
        },
        "jobs_last_30d": {"completed": 141, "failed": 2, "pending": 1, "processing": 0},
        "series": {
            "memories_per_day": [
                {"date": "2026-04-09", "count": 4},
                {"date": "2026-04-10", "count": 5},
                {"date": "2026-04-11", "count": 6},
                {"date": "2026-04-12", "count": 3},
            ],
            "users_per_day": [
                {"date": "2026-04-09", "count": 1},
                {"date": "2026-04-11", "count": 2},
            ],
            "cost_per_day": [
                {"date": "2026-04-09", "cost_usd": 0.22},
                {"date": "2026-04-10", "cost_usd": 0.18},
                {"date": "2026-04-11", "cost_usd": 0.27},
                {"date": "2026-04-12", "cost_usd": 0.31},
            ],
        },
    },
}


# -----------------------------------------------------------------------------
# API Client
# -----------------------------------------------------------------------------
def _headers() -> dict[str, str]:
    return {"X-Admin-Key": ADMIN_KEY}


@st.cache_data(ttl=120)
def fetch_json(path: str) -> dict[str, Any] | None:
    if USE_MOCK_DATA:
        key = path.rsplit("/", 1)[-1]
        return MOCK_DATA.get(key)

    try:
        r = requests.get(f"{API_URL}{path}", headers=_headers(), timeout=REQUEST_TIMEOUT_SEC)
        r.raise_for_status()
        return r.json()
    except Exception:
        return None


@st.cache_data(ttl=120)
def fetch_all() -> dict[str, dict[str, Any] | None]:
    endpoints = {
        "stats": "/api/v1/admin/stats",
        "users": "/api/v1/admin/users",
        "executive": "/api/v1/admin/executive",
        "finops": "/api/v1/admin/finops",
        "infrastructure": "/api/v1/admin/infrastructure",
        "users_kpis": "/api/v1/admin/users-kpis",
        "product_kpis": "/api/v1/admin/product-kpis",
        "alerts": "/api/v1/admin/alerts",
    }
    return {key: fetch_json(path) for key, path in endpoints.items()}


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
def money(v: float) -> str:
    return f"${float(v):,.4f}"


def to_df(rows: list[dict[str, Any]]) -> pd.DataFrame:
    if not rows:
        return pd.DataFrame()
    return pd.DataFrame(rows)


def base_layout(fig: go.Figure, height: int = 320) -> go.Figure:
    fig.update_layout(
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(color="#1e2b33", size=12),
        margin=dict(l=0, r=0, t=10, b=0),
        height=height,
        xaxis=dict(showgrid=False),
        yaxis=dict(gridcolor="rgba(80,100,120,0.18)"),
    )
    return fig


def section(title: str):
    st.markdown(f'<p class="section-title">{title}</p>', unsafe_allow_html=True)


def status_badge(status: str) -> str:
    s = (status or "unknown").lower()
    if s == "healthy":
        return "GREEN Healthy"
    if s == "warning":
        return "ORANGE Warning"
    if s == "critical":
        return "RED Critical"
    return "GRAY Unknown"


def status_pill_html(status: str) -> str:
    s = (status or "unknown").lower()
    cls = {
        "healthy": "pill-healthy",
        "warning": "pill-warning",
        "critical": "pill-critical",
    }.get(s, "pill-unknown")
    label = s.capitalize()
    return f'<span class="pill {cls}">{label}</span>'


def severity_pill_html(severity: str) -> str:
    sev = (severity or "unknown").lower()
    cls = {
        "warning": "pill-warning",
        "critical": "pill-critical",
        "healthy": "pill-healthy",
    }.get(sev, "pill-unknown")
    return f'<span class="pill {cls}">{sev.capitalize()}</span>'


def patch_from_legacy(payload: dict[str, dict[str, Any] | None]) -> dict[str, dict[str, Any] | None]:
    stats = payload.get("stats") or {}

    if not payload.get("executive") and stats:
        users = stats.get("users", {})
        memories = stats.get("memories", {})
        costs = stats.get("costs", {})
        jobs = stats.get("jobs_last_30d", {})
        payload["executive"] = {
            "generated_at": stats.get("generated_at"),
            "platform_status": "unknown",
            "burn_mtd_usd": float(costs.get("last_30d_usd", 0.0)),
            "burn_projected_usd": 0.0,
            "budget_usd": 50.0,
            "budget_pct_used": 0.0,
            "users_active_7d": int(users.get("new_last_7d", 0)),
            "users_active_30d": int(users.get("active_last_30d", 0)),
            "memories_today": 0,
            "jobs_failed_24h": int(jobs.get("failed", 0)),
            "alerts_active": 0,
        }

    if not payload.get("users_kpis") and stats:
        users = stats.get("users", {})
        series = stats.get("series", {})
        payload["users_kpis"] = {
            "generated_at": stats.get("generated_at"),
            "totals": {
                "registered": int(users.get("total", 0)),
                "active_7d": int(users.get("new_last_7d", 0)),
                "active_30d": int(users.get("active_last_30d", 0)),
                "active_90d": 0,
            },
            "activation_rate_pct": 0.0,
            "retention_7d_pct": 0.0,
            "retention_30d_pct": 0.0,
            "churn_proxy_30d": 0,
            "new_per_day": series.get("users_per_day", []),
            "cohorts": [],
        }

    if not payload.get("product_kpis") and stats:
        memories = stats.get("memories", {})
        series = stats.get("series", {})
        people = stats.get("people", {})
        conns = stats.get("connections", {})
        jobs = stats.get("jobs_last_30d", {})
        payload["product_kpis"] = {
            "generated_at": stats.get("generated_at"),
            "memories": {
                "total": int(memories.get("total", 0)),
                "last_7d": int(memories.get("last_7d", 0)),
                "last_30d": int(memories.get("last_30d", 0)),
                "per_day": series.get("memories_per_day", []),
            },
            "processing": {
                "nlp_avg_seconds": 0.0,
                "face_avg_seconds": 0.0,
                "jobs_failed_30d": int(jobs.get("failed", 0)),
                "jobs_completed_30d": int(jobs.get("completed", 0)),
            },
            "travel": {"available": False, "reason": "Not available in legacy endpoint"},
            "people": {
                "total": int(people.get("total", 0)),
                "named": int(people.get("named", 0)),
                "unnamed": int(people.get("unknown", 0)),
            },
            "connections": {
                "accepted": int(conns.get("accepted", 0)),
                "pending": int(conns.get("pending", 0)),
            },
        }

    if not payload.get("alerts"):
        payload["alerts"] = {
            "generated_at": stats.get("generated_at"),
            "active_count": 0,
            "alerts": [],
        }

    return payload


# -----------------------------------------------------------------------------
# Renderers
# -----------------------------------------------------------------------------
def render_executive(exe: dict[str, Any]):
    st.subheader("Executive")
    st.markdown(
        f"""
        <div class="hero">
            {status_pill_html(exe.get('platform_status', 'unknown'))}
            <strong>Estado general de plataforma</strong>
        </div>
        """,
        unsafe_allow_html=True,
    )
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Platform", exe.get("platform_status", "unknown").capitalize())
    c2.metric("Burn MTD", money(exe.get("burn_mtd_usd", 0)))
    c3.metric("Projected", money(exe.get("burn_projected_usd", 0)))
    c4.metric("Budget Used", f"{float(exe.get('budget_pct_used', 0)):.2f}%")

    c5, c6, c7, c8 = st.columns(4)
    c5.metric("Active 7d", int(exe.get("users_active_7d", 0)))
    c6.metric("Active 30d", int(exe.get("users_active_30d", 0)))
    c7.metric("Memories Today", int(exe.get("memories_today", 0)))
    c8.metric("Alerts Active", int(exe.get("alerts_active", 0)))



def render_finops(fin: dict[str, Any]):
    st.subheader("FinOps")

    totals = fin.get("totals", {})
    unit = fin.get("unit_economics", {})
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("MTD Total", money(totals.get("mtd_usd", 0)))
    c2.metric("Projected", money(totals.get("projected_usd", 0)))
    c3.metric("CP Memory", money(unit.get("cost_per_memory_created", 0)))
    c4.metric("CP Active User", money(unit.get("cost_per_active_user_30d", 0)))

    section("Daily Cost Mix")
    df = to_df(fin.get("daily_series", []))
    if not df.empty:
        fig = go.Figure()
        fig.add_trace(go.Bar(name="Infra", x=df["date"], y=df["infra_usd"], marker_color=COLORS["blue"]))
        fig.add_trace(go.Bar(name="AI", x=df["date"], y=df["ai_usd"], marker_color=COLORS["orange"]))
        fig.update_layout(barmode="stack")
        st.plotly_chart(base_layout(fig, 340), use_container_width=True, config={"displayModeBar": False})
    else:
        st.info("No daily series available yet.")

    col_l, col_r = st.columns(2)
    with col_l:
        section("AI Cost by Type")
        ai_types = to_df((fin.get("ai_costs") or {}).get("by_type", []))
        if not ai_types.empty:
            fig = px.bar(ai_types, x="type", y="cost_usd", color_discrete_sequence=[COLORS["red"]])
            st.plotly_chart(base_layout(fig, 300), use_container_width=True, config={"displayModeBar": False})
        else:
            st.info("No AI usage types yet.")

    with col_r:
        section("Infra by Service")
        infra = to_df((fin.get("infra_costs") or {}).get("by_service", []))
        if not infra.empty:
            fig = px.pie(infra, names="service", values="cost_usd", hole=0.5)
            st.plotly_chart(base_layout(fig, 300), use_container_width=True, config={"displayModeBar": False})
        else:
            src = (fin.get("infra_costs") or {}).get("source", "unknown")
            st.info(f"Infra data unavailable. source={src}")

    infra_info = fin.get("infra_costs", {})
    if infra_info.get("error"):
        st.warning(f"Cost Explorer fallback active: {infra_info.get('error')}")



def render_infrastructure(infra: dict[str, Any]):
    st.subheader("Infrastructure")
    st.markdown(
        f"""
        <div class="hero">
            {status_pill_html(infra.get('overall_status', 'unknown'))}
            <strong>Salud de infraestructura</strong>
        </div>
        """,
        unsafe_allow_html=True,
    )

    server = infra.get("server", {})
    db = infra.get("database", {})
    celery = infra.get("celery", {})
    redis_s = infra.get("redis", {})

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("CPU %", f"{float(server.get('cpu_pct', 0)):.2f}")
    c2.metric("RAM %", f"{float(server.get('ram_pct', 0)):.2f}")
    c3.metric("Disk %", f"{float(server.get('disk_pct', 0)):.2f}")
    c4.metric("Uptime (h)", f"{float(server.get('uptime_hours', 0)):.2f}")

    c5, c6, c7, c8 = st.columns(4)
    c5.metric("DB Connections", int(db.get("connections_active", 0)))
    c6.metric("DB Conn %", f"{float(db.get('connections_pct', 0)):.2f}")
    c7.metric("DB Size (GB)", f"{float(db.get('db_size_gb', 0)):.4f}")
    c8.metric("Redis", redis_s.get("status", "unknown"))

    c9, c10, c11 = st.columns(3)
    c9.metric("Celery Workers", int(celery.get("workers_active", 0)))
    c10.metric("Queue Depth", int(celery.get("queue_depth", 0)))
    c11.metric("Jobs Failed 24h", int(celery.get("jobs_failed_24h", 0)))



def render_users_growth(users_kpis: dict[str, Any], users_payload: dict[str, Any] | None):
    st.subheader("Users & Growth")
    totals = users_kpis.get("totals", {})

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Registered", int(totals.get("registered", 0)))
    c2.metric("Active 7d", int(totals.get("active_7d", 0)))
    c3.metric("Active 30d", int(totals.get("active_30d", 0)))
    c4.metric("Active 90d", int(totals.get("active_90d", 0)))

    c5, c6, c7 = st.columns(3)
    c5.metric("Activation %", f"{float(users_kpis.get('activation_rate_pct', 0)):.2f}")
    c6.metric("Retention 7d %", f"{float(users_kpis.get('retention_7d_pct', 0)):.2f}")
    c7.metric("Retention 30d %", f"{float(users_kpis.get('retention_30d_pct', 0)):.2f}")

    col_l, col_r = st.columns(2)
    with col_l:
        section("New Users per Day")
        new_df = to_df(users_kpis.get("new_per_day", []))
        if not new_df.empty:
            fig = px.bar(new_df, x="date", y="count", color_discrete_sequence=[COLORS["blue"]])
            st.plotly_chart(base_layout(fig, 300), use_container_width=True, config={"displayModeBar": False})
        else:
            st.info("No daily registration data.")

    with col_r:
        section("Monthly Cohorts")
        cohorts = to_df(users_kpis.get("cohorts", []))
        if not cohorts.empty:
            fig = go.Figure()
            fig.add_trace(go.Bar(name="Registered", x=cohorts["month"], y=cohorts["registered"], marker_color=COLORS["teal"]))
            fig.add_trace(go.Bar(name="Returned M+1", x=cohorts["month"], y=cohorts["returned_next_month"], marker_color=COLORS["orange"]))
            fig.update_layout(barmode="group")
            st.plotly_chart(base_layout(fig, 300), use_container_width=True, config={"displayModeBar": False})
        else:
            st.info("No cohort data available.")

    section("Per-user table")
    users_tbl = to_df((users_payload or {}).get("users", []))
    if not users_tbl.empty:
        if "cost_usd" in users_tbl.columns:
            users_tbl["cost_usd"] = users_tbl["cost_usd"].apply(lambda x: f"${float(x):.6f}")
        st.dataframe(users_tbl, use_container_width=True, hide_index=True)
    else:
        st.info("No per-user rows available.")



def render_product(product: dict[str, Any]):
    st.subheader("Product")

    memories = product.get("memories", {})
    processing = product.get("processing", {})
    people = product.get("people", {})
    conns = product.get("connections", {})
    travel = product.get("travel", {})

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Memories Total", int(memories.get("total", 0)))
    c2.metric("Memories 7d", int(memories.get("last_7d", 0)))
    c3.metric("NLP Avg (s)", f"{float(processing.get('nlp_avg_seconds', 0)):.2f}")
    c4.metric("Face Avg (s)", f"{float(processing.get('face_avg_seconds', 0)):.2f}")

    c5, c6, c7, c8 = st.columns(4)
    c5.metric("People", int(people.get("total", 0)))
    c6.metric("People Named", int(people.get("named", 0)))
    c7.metric("Connections Accepted", int(conns.get("accepted", 0)))
    c8.metric("Jobs Failed 30d", int(processing.get("jobs_failed_30d", 0)))

    section("Memories per Day")
    mem_df = to_df(memories.get("per_day", []))
    if not mem_df.empty:
        fig = px.bar(mem_df, x="date", y="count", color_discrete_sequence=[COLORS["orange"]])
        st.plotly_chart(base_layout(fig, 320), use_container_width=True, config={"displayModeBar": False})
    else:
        st.info("No daily memory series available.")

    section("Travel")
    if travel.get("available") is False:
        st.info(travel.get("reason", "Travel metrics unavailable"))
    else:
        st.json(travel)



def render_alerts(alert_payload: dict[str, Any]):
    st.subheader("Alerts")

    alerts = alert_payload.get("alerts", [])
    st.metric("Active Alerts", int(alert_payload.get("active_count", len(alerts))))

    if not alerts:
        st.success("No active alerts.")
        return

    for a in alerts:
        st.markdown(
            f"""
            <div class="hero" style="margin-bottom:10px;">
                {severity_pill_html(a.get('severity', 'unknown'))}
                <strong>{a.get('name', 'unnamed_alert')}</strong><br/>
                <span style="opacity:0.85">{a.get('description', '')}</span><br/>
                <span style="font-size:0.86rem; opacity:0.72;">
                    current={a.get('current_value')} · threshold={a.get('threshold')} · unit={a.get('unit')} · at={a.get('triggered_at')}
                </span>
            </div>
            """,
            unsafe_allow_html=True,
        )


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
with st.sidebar:
    st.markdown("## MyMemo Admin")
    st.caption("Phase D UI")
    st.divider()

    module = st.radio(
        "Module",
        ["Executive", "FinOps", "Infrastructure", "Users & Growth", "Product", "Alerts"],
        index=0,
    )

    st.divider()
    st.caption(f"Mode: {'MOCK' if USE_MOCK_DATA else 'LIVE API'}")
    st.caption(f"API: {API_URL}")
    st.caption("Visual profile: executive")

    if st.button("Refresh", use_container_width=True):
        st.cache_data.clear()
        st.rerun()

if not USE_MOCK_DATA and not ADMIN_KEY:
    st.error("ADMIN_API_KEY missing. Set it in dashboard/.env or enable USE_MOCK_DATA=true.")
    st.stop()

payload = fetch_all()
payload = patch_from_legacy(payload)

st.title("MyMemo Dashboard")

executive = payload.get("executive") or {}
st.caption(f"Generated at: {executive.get('generated_at') or datetime.utcnow().isoformat()}")

if module == "Executive":
    render_executive(executive)
elif module == "FinOps":
    render_finops(payload.get("finops") or {})
elif module == "Infrastructure":
    render_infrastructure(payload.get("infrastructure") or {})
elif module == "Users & Growth":
    render_users_growth(payload.get("users_kpis") or {}, payload.get("users"))
elif module == "Product":
    render_product(payload.get("product_kpis") or {})
elif module == "Alerts":
    render_alerts(payload.get("alerts") or {})

st.divider()
st.caption("MyMemo Admin Dashboard v3 - Fase D (UI modular, mock-ready, API-compatible)")
