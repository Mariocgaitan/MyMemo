"""
MyMemo — Admin Dashboard  v2
Corre con: uv run streamlit run app.py

Variables de entorno (dashboard/.env):
  MYMEMO_API_URL   URL base del backend  (default: http://localhost:8000)
  ADMIN_API_KEY    Clave X-Admin-Key para los endpoints /admin/*
    INSTANCE_MONTHLY_USD  Costo mensual estimado de la instancia
    DATABASE_MONTHLY_USD  Costo mensual estimado de la base de datos
"""
import os
import requests
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st
from dotenv import load_dotenv

load_dotenv()

# ── Config ────────────────────────────────────────────────────────────────────
API_URL   = os.getenv("MYMEMO_API_URL", "http://localhost:8000")
ADMIN_KEY = os.getenv("ADMIN_API_KEY", "")


def env_float(name: str, default: float = 0.0) -> float:
    value = os.getenv(name, "").strip()
    if not value:
        return default
    try:
        return float(value)
    except ValueError:
        return default


INSTANCE_MONTHLY_USD = env_float("INSTANCE_MONTHLY_USD")
DATABASE_MONTHLY_USD = env_float("DATABASE_MONTHLY_USD")

C = {
    "orange": "#F39C12",
    "green":  "#2ECC71",
    "red":    "#E74C3C",
    "purple": "#9B59B6",
    "blue":   "#3498DB",
    "teal":   "#1ABC9C",
    "gray":   "#95A5A6",
}

st.set_page_config(
    page_title="MyMemo Admin",
    page_icon="🗺️",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown("""
<style>
[data-testid="stMetric"] {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px;
    padding: 16px 20px;
}
[data-testid="stMetricLabel"] { font-size: 0.78rem; opacity: 0.65; letter-spacing: 0.03em; }
[data-testid="stMetricValue"] { font-size: 1.9rem; font-weight: 700; }
.sec-header {
    font-size: 0.95rem; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.06em; opacity: 0.6; margin: 1rem 0 0.4rem;
}
</style>
""", unsafe_allow_html=True)

# ── Data fetching ─────────────────────────────────────────────────────────────
HEADERS = {"X-Admin-Key": ADMIN_KEY}

@st.cache_data(ttl=120)
def fetch_stats() -> dict | None:
    try:
        r = requests.get(f"{API_URL}/api/v1/admin/stats", headers=HEADERS, timeout=15)
        r.raise_for_status()
        return r.json()
    except Exception:
        return None

@st.cache_data(ttl=120)
def fetch_users() -> list[dict]:
    try:
        r = requests.get(f"{API_URL}/api/v1/admin/users", headers=HEADERS, timeout=15)
        r.raise_for_status()
        return r.json().get("users", [])
    except Exception:
        return []

# ── Chart helpers ─────────────────────────────────────────────────────────────
_BASE = dict(
    paper_bgcolor="rgba(0,0,0,0)",
    plot_bgcolor="rgba(0,0,0,0)",
    margin=dict(l=0, r=0, t=10, b=0),
    font=dict(size=12),
)

def _rgba(hex_color: str, alpha: float = 0.15) -> str:
    h = hex_color.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return f"rgba({r},{g},{b},{alpha})"

def area_chart(df: pd.DataFrame, x: str, y: str, color: str, height=320) -> go.Figure:
    fig = go.Figure(go.Scatter(
        x=df[x], y=df[y], mode="lines+markers",
        line=dict(color=color, width=2), marker=dict(size=5),
        fill="tozeroy", fillcolor=_rgba(color),
    ))
    fig.update_layout(**_BASE, height=height,
                      xaxis=dict(showgrid=False, tickangle=-30),
                      yaxis=dict(gridcolor="rgba(128,128,128,0.15)"))
    return fig

def bar_chart(df: pd.DataFrame, x: str, y: str, color: str, height=320) -> go.Figure:
    fig = px.bar(df, x=x, y=y, color_discrete_sequence=[color])
    fig.update_layout(**_BASE, height=height, showlegend=False,
                      xaxis=dict(showgrid=False, tickangle=-30),
                      yaxis=dict(gridcolor="rgba(128,128,128,0.15)"))
    return fig

def donut(values: list, names: list, colors: list, height=260) -> go.Figure:
    fig = px.pie(values=values, names=names, color_discrete_sequence=colors, hole=0.52)
    fig.update_layout(**_BASE, height=height, showlegend=True,
                      legend=dict(font=dict(size=11)))
    fig.update_traces(textposition="inside", textinfo="percent+label")
    return fig


def currency(value: float) -> str:
    return f"${value:,.4f}"

def filter_series(raw: list[dict], date_key: str, val_key: str, days: int) -> pd.DataFrame:
    if not raw:
        return pd.DataFrame(columns=[date_key, val_key])
    df = pd.DataFrame(raw)
    df[date_key] = pd.to_datetime(df[date_key])
    return df.sort_values(date_key).tail(days).reset_index(drop=True)


# ── Early auth check ──────────────────────────────────────────────────────────
if not ADMIN_KEY:
    st.error("⚠️ **ADMIN_API_KEY** no configurada. Crea `dashboard/.env` con las variables requeridas.")
    st.stop()

data = fetch_stats()

# ── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("## 🗺️ MyMemo Admin")
    st.divider()

    if data:
        st.success("✅ Backend conectado")
        gen = data.get("generated_at", "")
        if gen:
            st.caption(f"Actualizado: {gen[11:19]} UTC")
    else:
        st.error(f"❌ Sin conexión\n`{API_URL}`")

    st.divider()
    days = st.radio(
        "Período de análisis",
        [7, 14, 30],
        index=2,
        format_func=lambda x: f"Últimos {x} días",
    )
    st.divider()
    if st.button("🔄 Refrescar datos", use_container_width=True):
        st.cache_data.clear()
        st.rerun()
    if INSTANCE_MONTHLY_USD or DATABASE_MONTHLY_USD:
        st.divider()
        st.caption(
            "Infra configurada: "
            f"instancia {currency(INSTANCE_MONTHLY_USD)} / mes · "
            f"DB {currency(DATABASE_MONTHLY_USD)} / mes"
        )
    st.caption(f"Backend: `{API_URL}`")

if not data:
    st.error("No se pudo conectar con el backend. Verifica la URL y la API key en `dashboard/.env`.")
    st.stop()

# ── Unpack & filter ───────────────────────────────────────────────────────────
users_d  = data.get("users", {})
mems_d   = data.get("memories", {})
conns_d  = data.get("connections", {})
people_d = data.get("people", {})
costs_d  = data.get("costs", {})
jobs_d   = data.get("jobs_last_30d", {})
series_d = data.get("series", {})

mem_df  = filter_series(series_d.get("memories_per_day", []), "date", "count", days)
user_df = filter_series(series_d.get("users_per_day", []),   "date", "count", days)
cost_df = filter_series(series_d.get("cost_per_day", []),    "date", "cost_usd", days)

mems_in_period  = int(mem_df["count"].sum())   if not mem_df.empty  else 0
users_in_period = int(user_df["count"].sum())  if not user_df.empty else 0
cost_in_period  = float(cost_df["cost_usd"].sum()) if not cost_df.empty else 0.0

# ── Page header ───────────────────────────────────────────────────────────────
st.title("🗺️ MyMemo — Panel de Administración")
st.caption(f"Período activo: **últimos {days} días** · Caché 2 min")

# ── Tabs ──────────────────────────────────────────────────────────────────────
tab_ov, tab_usr, tab_cont, tab_cost, tab_ops, tab_per = st.tabs([
    "📊 Overview", "👥 Usuarios", "📸 Contenido",
    "💸 Costos", "⚙️ Operaciones", "🧑 Por Usuario",
])


# ══════════════════════════════════════════════════════════════════════════════
# TAB 1 — OVERVIEW
# ══════════════════════════════════════════════════════════════════════════════
with tab_ov:
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Usuarios totales",    users_d.get("total", 0),
              delta=f"+{users_in_period} en {days}d")
    c2.metric("Memorias totales",    mems_d.get("total", 0),
              delta=f"+{mems_in_period} en {days}d")
    c3.metric("Costo IA acumulado",  f"${costs_d.get('total_usd', 0):.4f}",
              delta=f"${cost_in_period:.4f} en {days}d")
    c4.metric("Personas detectadas", people_d.get("total", 0),
              delta=f"{people_d.get('named', 0)} nombradas")

    st.divider()
    col_a, col_b = st.columns(2)
    with col_a:
        st.markdown('<p class="sec-header">Memorias por día</p>', unsafe_allow_html=True)
        if not mem_df.empty:
            st.plotly_chart(bar_chart(mem_df, "date", "count", C["orange"]),
                            use_container_width=True, config={"displayModeBar": False})
        else:
            st.info("Sin memorias en este período.")
    with col_b:
        st.markdown('<p class="sec-header">Nuevos usuarios por día</p>', unsafe_allow_html=True)
        if not user_df.empty:
            st.plotly_chart(area_chart(user_df, "date", "count", C["blue"]),
                            use_container_width=True, config={"displayModeBar": False})
        else:
            st.info("Sin nuevos usuarios en este período.")


# ══════════════════════════════════════════════════════════════════════════════
# TAB 2 — USUARIOS
# ══════════════════════════════════════════════════════════════════════════════
with tab_usr:
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Total registrados",  users_d.get("total", 0))
    c2.metric(f"Nuevos ({days}d)",  users_in_period)
    c3.metric("Nuevos (30 días)",   users_d.get("new_last_30d", 0))
    c4.metric("Activos (30 días)",  users_d.get("active_last_30d", 0),
              help="Subieron al menos 1 memoria en los últimos 30 días")

    st.divider()
    if not user_df.empty:
        user_df_c = user_df.copy()
        user_df_c["acumulado"] = user_df_c["count"].cumsum()

        col_l, col_r = st.columns(2)
        with col_l:
            st.markdown('<p class="sec-header">Nuevos registros por día</p>', unsafe_allow_html=True)
            st.plotly_chart(bar_chart(user_df_c, "date", "count", C["blue"]),
                            use_container_width=True, config={"displayModeBar": False})
        with col_r:
            st.markdown('<p class="sec-header">Crecimiento acumulado en el período</p>', unsafe_allow_html=True)
            st.plotly_chart(area_chart(user_df_c, "date", "acumulado", C["teal"]),
                            use_container_width=True, config={"displayModeBar": False})
    else:
        st.info("Sin datos de usuarios en este período.")


# ══════════════════════════════════════════════════════════════════════════════
# TAB 3 — CONTENIDO
# ══════════════════════════════════════════════════════════════════════════════
with tab_cont:
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Total memorias",          mems_d.get("total", 0))
    c2.metric(f"Memorias ({days}d)",     mems_in_period)
    c3.metric("Conexiones aceptadas",    conns_d.get("accepted", 0))
    c4.metric("Conexiones pendientes",   conns_d.get("pending", 0))

    st.divider()
    st.markdown('<p class="sec-header">Memorias subidas por día</p>', unsafe_allow_html=True)
    if not mem_df.empty:
        st.plotly_chart(bar_chart(mem_df, "date", "count", C["orange"], height=340),
                        use_container_width=True, config={"displayModeBar": False})
    else:
        st.info("Sin memorias en este período.")

    st.divider()
    col_a, col_b = st.columns(2)
    with col_a:
        st.markdown('<p class="sec-header">Personas detectadas</p>', unsafe_allow_html=True)
        pa, pb = st.columns(2)
        pa.metric("Total", people_d.get("total", 0))
        pb.metric("Nombradas", people_d.get("named", 0))
        if people_d.get("total", 0) > 0:
            st.plotly_chart(
                donut(
                    [people_d.get("named", 0), people_d.get("unknown", 0)],
                    ["Nombradas", "Sin nombre"],
                    [C["teal"], C["gray"]],
                ),
                use_container_width=True, config={"displayModeBar": False},
            )
    with col_b:
        st.markdown('<p class="sec-header">Estado de conexiones</p>', unsafe_allow_html=True)
        total_conns = conns_d.get("accepted", 0) + conns_d.get("pending", 0)
        if total_conns > 0:
            st.plotly_chart(
                donut(
                    [conns_d.get("accepted", 0), conns_d.get("pending", 0)],
                    ["Aceptadas", "Pendientes"],
                    [C["green"], C["orange"]],
                ),
                use_container_width=True, config={"displayModeBar": False},
            )
        else:
            st.info("Sin conexiones registradas.")


# ══════════════════════════════════════════════════════════════════════════════
# TAB 4 — COSTOS
# ══════════════════════════════════════════════════════════════════════════════
with tab_cost:
    cost_7d    = costs_d.get("last_7d_usd", 0)
    cost_30d   = costs_d.get("last_30d_usd", 0)
    cost_total = costs_d.get("total_usd", 0)
    projection = (cost_7d / 7) * 30 if cost_7d else 0
    infra_monthly = INSTANCE_MONTHLY_USD + DATABASE_MONTHLY_USD
    combined_monthly = projection + infra_monthly

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Costo IA acumulado", currency(cost_total))
    c2.metric(f"Costo IA ({days}d)", currency(cost_in_period))
    c3.metric("Infra mensual fija", currency(infra_monthly),
              help="Suma de instancia y base de datos definida por variables de entorno del dashboard")
    c4.metric("Run-rate mensual total", currency(combined_monthly),
              delta=f"{'↑' if projection > cost_30d else '='} vs mes actual",
              delta_color="inverse" if projection > cost_30d else "off")

    st.divider()
    col_cost_ai, col_cost_infra = st.columns([2, 1])
    with col_cost_ai:
        st.markdown('<p class="sec-header">Costo IA por día</p>', unsafe_allow_html=True)
        if not cost_df.empty:
            st.plotly_chart(area_chart(cost_df, "date", "cost_usd", C["red"], height=320),
                            use_container_width=True, config={"displayModeBar": False})
        else:
            st.info("Sin datos de costo de IA en este período.")
    with col_cost_infra:
        st.markdown('<p class="sec-header">Infraestructura mensual</p>', unsafe_allow_html=True)
        df_infra = pd.DataFrame([
            {"concept": "Instancia", "cost": INSTANCE_MONTHLY_USD},
            {"concept": "Base de datos", "cost": DATABASE_MONTHLY_USD},
        ])
        if float(df_infra["cost"].sum()) > 0:
            fig_infra = px.bar(
                df_infra,
                x="concept",
                y="cost",
                color="concept",
                color_discrete_map={"Instancia": C["purple"], "Base de datos": C["blue"]},
            )
            fig_infra.update_layout(
                **_BASE,
                height=320,
                showlegend=False,
                xaxis=dict(showgrid=False),
                yaxis=dict(gridcolor="rgba(128,128,128,0.15)"),
            )
            st.plotly_chart(fig_infra, use_container_width=True, config={"displayModeBar": False})
        else:
            st.info("Configura `INSTANCE_MONTHLY_USD` y `DATABASE_MONTHLY_USD` en `dashboard/.env`.")

    by_type = costs_d.get("by_type_last_30d", [])
    st.divider()
    col_pie, col_tbl = st.columns([1, 1])

    with col_pie:
        st.markdown('<p class="sec-header">Composición mensual estimada</p>', unsafe_allow_html=True)
        monthly_ai = projection
        pie_values = [monthly_ai, INSTANCE_MONTHLY_USD, DATABASE_MONTHLY_USD]
        pie_names = ["IA", "Instancia", "Base de datos"]
        non_zero = [(name, value) for name, value in zip(pie_names, pie_values) if value > 0]
        if non_zero:
            fig_mix = donut(
                [value for _, value in non_zero],
                [name for name, _ in non_zero],
                [C["red"], C["purple"], C["blue"]][:len(non_zero)],
                height=300,
            )
            st.plotly_chart(fig_mix, use_container_width=True, config={"displayModeBar": False})
        else:
            st.info("Sin costos para mostrar todavía.")

    with col_tbl:
        st.markdown('<p class="sec-header">Tabla de costos</p>', unsafe_allow_html=True)
        rows = [
            {"Tipo": "IA acumulada", "Costo (USD)": currency(cost_total), "Ventana": "Histórico"},
            {"Tipo": "IA proyectada", "Costo (USD)": currency(projection), "Ventana": "Mensual estimada"},
            {"Tipo": "Instancia", "Costo (USD)": currency(INSTANCE_MONTHLY_USD), "Ventana": "Mensual fija"},
            {"Tipo": "Base de datos", "Costo (USD)": currency(DATABASE_MONTHLY_USD), "Ventana": "Mensual fija"},
            {"Tipo": "Total mensual estimado", "Costo (USD)": currency(combined_monthly), "Ventana": "Mensual"},
        ]
        st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)

    if by_type:
        st.divider()
        df_type = pd.DataFrame(by_type).sort_values("cost_usd", ascending=False)
        st.markdown('<p class="sec-header">Desglose IA por tipo (30 días)</p>', unsafe_allow_html=True)
        col_type_pie, col_type_tbl = st.columns([1, 1])
        with col_type_pie:
            fig_pie = px.pie(df_type, names="type", values="cost_usd",
                             color_discrete_sequence=px.colors.qualitative.Set2, hole=0.48)
            fig_pie.update_layout(**_BASE, height=300)
            st.plotly_chart(fig_pie, use_container_width=True, config={"displayModeBar": False})
        with col_type_tbl:
            df_disp = df_type.copy()
            df_disp["cost_usd"] = df_disp["cost_usd"].apply(lambda x: f"${x:.6f}")
            st.dataframe(
                df_disp.rename(columns={"type": "Tipo", "cost_usd": "Costo (USD)", "count": "Llamadas"}),
                use_container_width=True, hide_index=True,
            )
    else:
        st.info("Sin desglose de costos IA por tipo todavía.")


# ══════════════════════════════════════════════════════════════════════════════
# TAB 5 — OPERACIONES
# ══════════════════════════════════════════════════════════════════════════════
with tab_ops:
    STATUS_ICON = {"completed": "✅", "failed": "❌", "pending": "🕐", "processing": "⏳"}
    total_jobs  = sum(jobs_d.values()) if jobs_d else 0
    completed   = jobs_d.get("completed", 0)
    failed      = jobs_d.get("failed", 0)
    success_pct = round(completed / total_jobs * 100) if total_jobs else 0

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Total jobs (30d)", total_jobs)
    c2.metric("Completados",      completed)
    c3.metric("Fallidos",         failed)
    c4.metric("Tasa de éxito",    f"{success_pct}%")

    st.divider()
    if jobs_d:
        df_jobs_raw = pd.DataFrame([{"status": k, "count": v} for k, v in jobs_d.items()])
        df_jobs_disp = pd.DataFrame([
            {"Estado": f"{STATUS_ICON.get(k, '•')} {k.capitalize()}",
             "Jobs": v,
             "Porcentaje": f"{round(v / total_jobs * 100)}%"}
            for k, v in sorted(jobs_d.items())
        ])

        col_bar, col_tbl = st.columns([2, 1])
        with col_bar:
            st.markdown('<p class="sec-header">Distribución de jobs</p>', unsafe_allow_html=True)
            fig_j = px.bar(
                df_jobs_raw, x="status", y="count", color="status",
                color_discrete_map={
                    "completed":  C["green"], "failed":     C["red"],
                    "pending":    C["orange"], "processing": C["blue"],
                },
            )
            fig_j.update_layout(**_BASE, height=300, showlegend=False,
                                xaxis=dict(showgrid=False),
                                yaxis=dict(gridcolor="rgba(128,128,128,0.15)"))
            st.plotly_chart(fig_j, use_container_width=True, config={"displayModeBar": False})
        with col_tbl:
            st.markdown('<p class="sec-header">Resumen</p>', unsafe_allow_html=True)
            st.dataframe(df_jobs_disp, use_container_width=True, hide_index=True)
    else:
        st.info("Sin datos de jobs en los últimos 30 días.")

    st.divider()
    st.markdown('<p class="sec-header">Reconocimiento facial</p>', unsafe_allow_html=True)
    pct_named = round(people_d.get("named", 0) / people_d.get("total", 1) * 100) if people_d.get("total") else 0
    fc1, fc2, fc3 = st.columns(3)
    fc1.metric("Total personas detectadas", people_d.get("total", 0))
    fc2.metric("Identificadas por nombre",  people_d.get("named", 0))
    fc3.metric("% identificadas",           f"{pct_named}%")


# ══════════════════════════════════════════════════════════════════════════════
# TAB 6 — POR USUARIO
# ══════════════════════════════════════════════════════════════════════════════
with tab_per:
    users_list = fetch_users()

    if not users_list:
        st.warning("No se pudieron cargar las estadísticas por usuario.")
        st.info("Asegúrate de que el endpoint `/api/v1/admin/users` esté desplegado en el servidor.")
    else:
        df_u = pd.DataFrame(users_list)

        avg_mem   = round(df_u["memories"].mean(), 1) if "memories" in df_u.columns else 0
        top_user  = df_u.loc[df_u["memories"].idxmax(), "name"] if not df_u.empty else "—"
        total_cost_u = df_u["cost_usd"].sum() if "cost_usd" in df_u.columns else 0

        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Usuarios registrados", len(df_u))
        c2.metric("Memorias promedio",    avg_mem)
        c3.metric("Usuario más activo",   top_user)
        c4.metric("Costo total atribuido", f"${total_cost_u:.4f}")

        st.divider()
        st.markdown('<p class="sec-header">Estadísticas por usuario</p>', unsafe_allow_html=True)

        df_display = df_u.copy()
        for col in ("joined", "last_activity"):
            if col in df_display.columns:
                df_display[col] = pd.to_datetime(df_display[col], errors="coerce").dt.strftime("%Y-%m-%d")
        if "cost_usd" in df_display.columns:
            df_display["cost_usd"] = df_display["cost_usd"].apply(lambda x: f"${x:.4f}")

        st.dataframe(
            df_display.rename(columns={
                "name": "Usuario", "joined": "Registro",
                "memories": "Memorias", "people": "Personas",
                "connections": "Conexiones", "last_activity": "Última actividad",
                "cost_usd": "Costo IA",
            }),
            use_container_width=True, hide_index=True,
        )

        st.divider()
        col_a, col_b = st.columns(2)
        with col_a:
            st.markdown('<p class="sec-header">Memorias por usuario</p>', unsafe_allow_html=True)
            fig_mem = px.bar(
                df_u.sort_values("memories", ascending=False),
                x="name", y="memories", color_discrete_sequence=[C["orange"]],
            )
            fig_mem.update_layout(**_BASE, height=320, showlegend=False,
                                  xaxis=dict(showgrid=False, tickangle=-30),
                                  yaxis=dict(gridcolor="rgba(128,128,128,0.15)"))
            st.plotly_chart(fig_mem, use_container_width=True, config={"displayModeBar": False})

        with col_b:
            st.markdown('<p class="sec-header">Costo IA por usuario</p>', unsafe_allow_html=True)
            fig_cost = px.bar(
                df_u.sort_values("cost_usd", ascending=False),
                x="name", y="cost_usd", color_discrete_sequence=[C["red"]],
            )
            fig_cost.update_layout(**_BASE, height=320, showlegend=False,
                                   xaxis=dict(showgrid=False, tickangle=-30),
                                   yaxis=dict(gridcolor="rgba(128,128,128,0.15)"))
            st.plotly_chart(fig_cost, use_container_width=True, config={"displayModeBar": False})


# ── Footer ────────────────────────────────────────────────────────────────────
st.divider()
st.caption("MyMemo Admin Dashboard v2 · Solo datos agregados, sin información personal · Caché 2 min")
