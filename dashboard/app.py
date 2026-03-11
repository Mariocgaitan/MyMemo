"""
MyMemo — Admin Dashboard
Corre con: streamlit run app.py

Variables de entorno:
  MYMEMO_API_URL   URL base del backend  (default: http://localhost:8000)
  ADMIN_API_KEY    Clave X-Admin-Key para el endpoint /admin/stats
"""
import os
import requests
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st
from dotenv import load_dotenv

load_dotenv()  # Carga dashboard/.env si existe

# ── Config ────────────────────────────────────────────────────────────────────
API_URL   = os.getenv("MYMEMO_API_URL", "http://localhost:8000")
ADMIN_KEY = os.getenv("ADMIN_API_KEY", "")

COLORS = {
    "primary":  "#F39C12",
    "success":  "#2ECC71",
    "danger":   "#E74C3C",
    "purple":   "#9B59B6",
    "blue":     "#3498DB",
    "teal":     "#1ABC9C",
}

st.set_page_config(
    page_title="MyMemo Admin",
    page_icon="🗺️",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# ── Helpers ───────────────────────────────────────────────────────────────────
@st.cache_data(ttl=120)
def fetch_stats() -> dict | None:
    if not ADMIN_KEY:
        st.error("⚠️ ADMIN_API_KEY no configurada. Agrega la variable de entorno y reinicia.")
        return None
    try:
        r = requests.get(
            f"{API_URL}/api/v1/admin/stats",
            headers={"X-Admin-Key": ADMIN_KEY},
            timeout=15,
        )
        r.raise_for_status()
        return r.json()
    except requests.HTTPError as e:
        st.error(f"Error HTTP {e.response.status_code}: {e.response.text}")
        return None
    except Exception as e:
        st.error(f"No se pudo conectar con `{API_URL}`: {e}")
        return None


def sparkline(series: list[dict], x_key: str, y_key: str, color: str) -> go.Figure:
    """Mini line chart sin ejes, para usar como indicador visual."""
    df = pd.DataFrame(series) if series else pd.DataFrame({x_key: [], y_key: []})
    fig = go.Figure(go.Scatter(
        x=df[x_key] if not df.empty else [],
        y=df[y_key] if not df.empty else [],
        mode="lines",
        line=dict(color=color, width=2),
        fill="tozeroy",
        fillcolor=color.replace(")", ",0.15)").replace("rgb", "rgba") if "rgb" in color else color + "26",
    ))
    fig.update_layout(
        margin=dict(l=0, r=0, t=0, b=0),
        height=60,
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        xaxis=dict(visible=False),
        yaxis=dict(visible=False),
    )
    return fig


def bar_chart(series: list[dict], x_key: str, y_key: str, color: str,
              x_label: str = "", y_label: str = "") -> go.Figure:
    df = pd.DataFrame(series) if series else pd.DataFrame({x_key: [], y_key: []})
    fig = px.bar(
        df, x=x_key, y=y_key,
        color_discrete_sequence=[color],
        labels={x_key: x_label, y_key: y_label},
    )
    fig.update_layout(
        margin=dict(l=0, r=0, t=10, b=0),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        showlegend=False,
    )
    fig.update_xaxes(showgrid=False)
    fig.update_yaxes(gridcolor="rgba(128,128,128,0.15)")
    return fig


def line_chart(series: list[dict], x_key: str, y_key: str, color: str,
               x_label: str = "", y_label: str = "") -> go.Figure:
    df = pd.DataFrame(series) if series else pd.DataFrame({x_key: [], y_key: []})
    fig = px.line(
        df, x=x_key, y=y_key,
        color_discrete_sequence=[color],
        labels={x_key: x_label, y_key: y_label},
        markers=True,
    )
    fig.update_layout(
        margin=dict(l=0, r=0, t=10, b=0),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        showlegend=False,
    )
    fig.update_xaxes(showgrid=False)
    fig.update_yaxes(gridcolor="rgba(128,128,128,0.15)")
    return fig


# ── Header ────────────────────────────────────────────────────────────────────
col_title, col_btn = st.columns([6, 1])
with col_title:
    st.title("🗺️ MyMemo — Admin Dashboard")
    st.caption(f"Backend: `{API_URL}` · caché 2 min")
with col_btn:
    st.write("")
    if st.button("🔄 Refrescar", use_container_width=True):
        st.cache_data.clear()
        st.rerun()

st.divider()

# ── Load data ─────────────────────────────────────────────────────────────────
data = fetch_stats()
if not data:
    st.stop()

users   = data.get("users", {})
mems    = data.get("memories", {})
conns   = data.get("connections", {})
people  = data.get("people", {})
costs   = data.get("costs", {})
jobs    = data.get("jobs_last_30d", {})
series  = data.get("series", {})

generated_at = data.get("generated_at", "")
if generated_at:
    st.caption(f"Datos generados: {generated_at[:19].replace('T', ' ')} UTC")

# ── KPI row 1: Usuarios ───────────────────────────────────────────────────────
st.subheader("👥 Usuarios")
u1, u2, u3, u4 = st.columns(4)
u1.metric("Total registrados",   users.get("total", 0))
u2.metric("Nuevos (7 días)",     users.get("new_last_7d", 0))
u3.metric("Nuevos (30 días)",    users.get("new_last_30d", 0))
u4.metric("Activos (30 días)",   users.get("active_last_30d", 0),
          help="Usuarios que subieron al menos 1 memoria en los últimos 30 días")

# Sparkline usuarios/día
users_series = series.get("users_per_day", [])
if users_series:
    st.plotly_chart(
        sparkline(users_series, "date", "count", COLORS["blue"]),
        use_container_width=True, config={"displayModeBar": False},
    )

# ── KPI row 2: Memorias ───────────────────────────────────────────────────────
st.divider()
st.subheader("📸 Memorias")
m1, m2, m3, m4 = st.columns(4)
m1.metric("Total memorias",    mems.get("total", 0))
m2.metric("Últimos 7 días",    mems.get("last_7d", 0))
m3.metric("Últimos 30 días",   mems.get("last_30d", 0))
m4.metric("Conexiones activas", conns.get("accepted", 0))

# Bar: memorias por día
mem_series = series.get("memories_per_day", [])
if mem_series:
    st.plotly_chart(
        bar_chart(mem_series, "date", "count", COLORS["primary"],
                  x_label="Fecha", y_label="Memorias"),
        use_container_width=True, config={"displayModeBar": False},
    )
else:
    st.info("Sin datos de memorias por día todavía.")

# ── KPI row 3: Costos ─────────────────────────────────────────────────────────
st.divider()
st.subheader("💸 Costos IA")
c1, c2, c3, c4 = st.columns(4)
c1.metric("Costo total acumulado", f"${costs.get('total_usd', 0):.4f}")
c2.metric("Últimos 30 días",       f"${costs.get('last_30d_usd', 0):.4f}")
c3.metric("Últimos 7 días",        f"${costs.get('last_7d_usd', 0):.4f}")

# Proyección mensual basada en últimos 7 días
cost_7d = costs.get("last_7d_usd", 0)
projection = (cost_7d / 7) * 30 if cost_7d else 0
c4.metric("Proyección mensual", f"${projection:.4f}",
          delta=f"{'↑' if projection > costs.get('last_30d_usd', 0) else '↓'} vs mes actual",
          delta_color="inverse")

# Line: costo por día
cost_series = series.get("cost_per_day", [])
col_cost, col_breakdown = st.columns([2, 1])

with col_cost:
    if cost_series:
        st.plotly_chart(
            line_chart(cost_series, "date", "cost_usd", COLORS["danger"],
                       x_label="Fecha", y_label="Costo (USD)"),
            use_container_width=True, config={"displayModeBar": False},
        )
    else:
        st.info("Sin datos de costo por día.")

with col_breakdown:
    by_type = costs.get("by_type_last_30d", [])
    if by_type:
        st.markdown("**Desglose por tipo (30d)**")
        df_type = pd.DataFrame(by_type).sort_values("cost_usd", ascending=False)
        fig_pie = px.pie(
            df_type, names="type", values="cost_usd",
            color_discrete_sequence=px.colors.qualitative.Set2,
            hole=0.4,
        )
        fig_pie.update_layout(
            margin=dict(l=0, r=0, t=10, b=0),
            paper_bgcolor="rgba(0,0,0,0)",
            showlegend=True,
            legend=dict(font=dict(size=11)),
        )
        st.plotly_chart(fig_pie, use_container_width=True, config={"displayModeBar": False})
        st.dataframe(
            df_type.rename(columns={"type": "Tipo", "cost_usd": "Costo USD", "count": "Llamadas"}),
            use_container_width=True, hide_index=True,
        )
    else:
        st.info("Sin métricas de costo por tipo.")

# ── Personas & Reconocimiento facial ─────────────────────────────────────────
st.divider()
st.subheader("🤖 Reconocimiento facial")
p1, p2, p3, p4 = st.columns(4)
p1.metric("Total personas detectadas", people.get("total", 0))
p2.metric("Nombradas",                 people.get("named", 0))
p3.metric("Sin nombre",                people.get("unknown", 0))
pct = round(people.get("named", 0) / people.get("total", 1) * 100) if people.get("total") else 0
p4.metric("% identificadas",           f"{pct}%")

# ── Jobs de procesamiento ─────────────────────────────────────────────────────
st.divider()
st.subheader("⚙️ Jobs de procesamiento (últimos 30 días)")
if jobs:
    j_cols = st.columns(len(jobs))
    status_colors = {"completed": "✅", "failed": "❌", "pending": "🕐", "processing": "⏳"}
    for col, (status, count) in zip(j_cols, sorted(jobs.items())):
        col.metric(f"{status_colors.get(status, '•')} {status.capitalize()}", count)

    # Barra de proporción
    total_jobs = sum(jobs.values())
    if total_jobs:
        df_jobs = pd.DataFrame([{"status": k, "count": v} for k, v in jobs.items()])
        fig_jobs = px.bar(
            df_jobs, x="count", y=[""] * len(df_jobs), color="status",
            orientation="h", barmode="stack",
            color_discrete_map={
                "completed": COLORS["success"],
                "failed": COLORS["danger"],
                "pending": COLORS["primary"],
                "processing": COLORS["blue"],
            },
            labels={"count": "Jobs", "status": "Estado"},
        )
        fig_jobs.update_layout(
            height=80, margin=dict(l=0, r=0, t=0, b=0),
            paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
            yaxis=dict(visible=False), xaxis=dict(visible=False),
            showlegend=True,
        )
        st.plotly_chart(fig_jobs, use_container_width=True, config={"displayModeBar": False})
else:
    st.info("Sin datos de jobs.")

# ── Footer ────────────────────────────────────────────────────────────────────
st.divider()
st.caption("MyMemo Admin Dashboard · Solo datos agregados, sin información personal · caché 2 min")
