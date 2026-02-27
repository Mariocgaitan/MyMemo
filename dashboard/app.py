"""
MyMemo — Admin Dashboard de Costos y Uso de IA
Corre con: streamlit run app.py
"""
import os
import requests
import pandas as pd
import plotly.express as px
import streamlit as st
from datetime import datetime, timedelta

# ── Config ───────────────────────────────────────────────────────────────────
API_URL = os.getenv("MYMEMO_API_URL", "http://localhost:8000")

st.set_page_config(
    page_title="MyMemo — Admin Dashboard",
    page_icon="🧠",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# ── Helpers ───────────────────────────────────────────────────────────────────
@st.cache_data(ttl=60)
def fetch(endpoint: str, params: dict = None):
    """Fetch from the backend API, return JSON or None."""
    try:
        r = requests.get(f"{API_URL}{endpoint}", params=params, timeout=10)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        st.error(f"Error al conectar con la API ({endpoint}): {e}")
        return None


# ── Header ────────────────────────────────────────────────────────────────────
st.title("🧠 MyMemo — Dashboard de Admin")
st.caption(f"Conectado a: `{API_URL}`")

col_refresh, _ = st.columns([1, 8])
with col_refresh:
    if st.button("🔄 Refrescar"):
        st.cache_data.clear()
        st.rerun()

st.divider()

# ── Fetch data ────────────────────────────────────────────────────────────────
usage_data   = fetch("/api/v1/usage/summary")
metrics_raw  = fetch("/api/v1/usage/metrics", {"limit": 500})
memories_raw = fetch("/api/v1/memories", {"limit": 1, "skip": 0})
people_raw   = fetch("/api/v1/people")

# ── Top KPI Cards ─────────────────────────────────────────────────────────────
st.subheader("📊 Resumen del mes")

if usage_data:
    kpi1, kpi2, kpi3, kpi4 = st.columns(4)
    with kpi1:
        st.metric("Total tokens OpenAI", f"{usage_data.get('total_openai_tokens', 0):,}")
    with kpi2:
        st.metric("Costo estimado", f"${usage_data.get('total_cost_usd', 0):.4f} USD")
    with kpi3:
        st.metric("Faces detectadas", f"{usage_data.get('total_face_detections', 0):,}")
    with kpi4:
        total_memories = memories_raw.get("total", "—") if memories_raw else "—"
        st.metric("Total memorias", total_memories)
else:
    st.warning("No se pudo cargar el resumen de uso.")

st.divider()

# ── Metrics over time ─────────────────────────────────────────────────────────
if metrics_raw:
    metrics = metrics_raw if isinstance(metrics_raw, list) else metrics_raw.get("metrics", [])
    if metrics:
        df = pd.DataFrame(metrics)
        df["date"] = pd.to_datetime(df["recorded_at"]).dt.date

        # ── Tokens por día ────────────────────────────────────────────────────
        st.subheader("📈 Tokens OpenAI por día")
        tokens_df = (
            df[df["metric_type"] == "openai_tokens"]
            .groupby("date")["metric_value"]
            .sum()
            .reset_index()
            .rename(columns={"metric_value": "tokens"})
        )
        if not tokens_df.empty:
            fig = px.bar(
                tokens_df, x="date", y="tokens",
                color_discrete_sequence=["#F39C12"],
                labels={"date": "Fecha", "tokens": "Tokens"},
            )
            fig.update_layout(plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)")
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.info("No hay datos de tokens aún.")

        # ── Costo acumulado ───────────────────────────────────────────────────
        st.subheader("💸 Costo acumulado por día (USD)")
        cost_df = (
            df.groupby("date")["cost_usd"]
            .sum()
            .reset_index()
            .rename(columns={"cost_usd": "costo_usd"})
        )
        if not cost_df.empty:
            fig2 = px.line(
                cost_df, x="date", y="costo_usd",
                color_discrete_sequence=["#E74C3C"],
                labels={"date": "Fecha", "costo_usd": "Costo (USD)"},
                markers=True,
            )
            fig2.update_layout(plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)")
            st.plotly_chart(fig2, use_container_width=True)
        else:
            st.info("No hay datos de costo aún.")

        # ── Caras detectadas por día ──────────────────────────────────────────
        st.subheader("👥 Faces detectadas por día")
        faces_df = (
            df[df["metric_type"] == "face_detection"]
            .groupby("date")["metric_value"]
            .sum()
            .reset_index()
            .rename(columns={"metric_value": "faces"})
        )
        if not faces_df.empty:
            fig3 = px.bar(
                faces_df, x="date", y="faces",
                color_discrete_sequence=["#2ECC71"],
                labels={"date": "Fecha", "faces": "Caras detectadas"},
            )
            fig3.update_layout(plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)")
            st.plotly_chart(fig3, use_container_width=True)
        else:
            st.info("No hay datos de faces aún.")

        st.divider()

        # ── Tabla detallada ───────────────────────────────────────────────────
        st.subheader("📋 Métricas detalladas (últimas 100)")
        cols_show = ["metric_type", "metric_value", "cost_usd", "recorded_at"]
        available = [c for c in cols_show if c in df.columns]
        st.dataframe(df[available].head(100), use_container_width=True)

else:
    st.warning("No hay métricas registradas todavía.")

st.divider()

# ── People summary ────────────────────────────────────────────────────────────
st.subheader("👤 Resumen de personas")
if people_raw:
    named = [p for p in people_raw if not str(p.get("name", "")).startswith("Unknown Person")]
    unknown = [p for p in people_raw if str(p.get("name", "")).startswith("Unknown Person")]
    p1, p2 = st.columns(2)
    with p1:
        st.metric("Personas nombradas", len(named))
    with p2:
        st.metric("Sin nombre", len(unknown))

    if named:
        st.markdown("**Top personas por apariciones:**")
        people_df = pd.DataFrame(named)[["name", "times_detected"]].sort_values(
            "times_detected", ascending=False
        )
        fig4 = px.bar(
            people_df.head(10), x="name", y="times_detected",
            color_discrete_sequence=["#9B59B6"],
            labels={"name": "Persona", "times_detected": "Apariciones"},
        )
        fig4.update_layout(plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)")
        st.plotly_chart(fig4, use_container_width=True)
else:
    st.info("Sin datos de personas.")

st.caption("MyMemo Admin Dashboard · Datos actualizados cada 60 s (usa 🔄 para forzar)")
