# Dashboard Profesional MyMemo — Estrategia Definitiva

## 1. Diagnóstico del estado actual

### Lo que ya existe y funciona

| Componente | Qué tiene | Dónde vive |
|---|---|---|
| `GET /admin/stats` | Totales de usuarios, memorias, conexiones, personas, costo IA, series por día (últimos 30d) | `backend/api/v1/endpoints/admin.py` |
| `GET /admin/users` | Resumen por usuario: memorias, personas, conexiones, costo IA acumulado | `backend/api/v1/endpoints/admin.py` |
| `UsageMetric` tabla | Registra cada llamada NLP: tokens entrada/salida, costo USD, modelo | `backend/models/database.py` |
| `ProcessingJob` tabla | Estado de jobs async (face_recognition, nlp_extraction): pending/processing/completed/failed, intentos, tiempos | `backend/models/database.py` |
| Dashboard Streamlit | 6 tabs: Overview, Usuarios, Contenido, Costos, Operaciones, Por Usuario. Consume `/admin/stats` y `/admin/users` | `dashboard/app.py` |
| Config de presupuesto | `MONTHLY_BUDGET_USD = 50.0`, `ALERT_THRESHOLD_PERCENTAGE = 80` | `backend/core/config.py` |

### Brechas reales (lo que falta)

| Categoría | Brecha | Impacto |
|---|---|---|
| Costos AWS | Cero integración con Cost Explorer. Los costos de EC2, RDS, S3, Transfer son manuales hoy. | No hay control real de burn rate |
| Costos Google Maps | No se registra ninguna llamada a Places API. Es un costo real, no trackeable hoy. | Punto ciego en FinOps |
| Costos de moderación TravelMemo | La moderación usa `gpt-4o-mini` vision, que tiene pricing distinto al NLP. No se diferencia en `UsageMetric`. | Subcuenta el costo de IA |
| Salud de infra | No hay integración con CloudWatch. CPU, memoria, conexiones DB: no visibles hoy. | No se puede detectar degradación |
| Métricas de crecimiento | No existe cálculo de retención, activación ni cohortes. Solo "activos = memorias en 30d". | No hay señal de engagement real |
| Métricas Travel | TravelMemo existe. No hay ningún KPI de feed CTR, share rate, moderación ni guardados en el dashboard. | Producto nuevo sin visibilidad |
| Health de dependencias externas | Si OpenAI o S3 fallan, no hay señal en el dashboard. | Incidentes invisibles |
| Alertas activas | El umbral `ALERT_THRESHOLD_PERCENTAGE` existe en config pero no hay motor de alertas ni notificaciones. | El presupuesto puede superarse sin aviso |
| Latencia API | No se mide p50/p95 por endpoint. No hay middleware de timing. | Degradación de performance invisible |

---

## 2. Principios de diseño

1. **Backend como única fuente de verdad.** El dashboard nunca consulta AWS, DB, Redis ni OpenAI directamente. Todo pasa por endpoints admin del backend.
2. **Cache estratificada por volatilidad.** Costos AWS cambian cada horas; salud de infra cada minutos; métricas de producto cada pocos minutos. Cache en Redis con keys namespaceadas.
3. **Cada KPI tiene fórmula y fuente definida.** No hay números en el dashboard sin trazabilidad al endpoint y tabla de origen.
4. **Sin datos personales.** Todos los endpoints admin exponen únicamente agregados. Ningún correo, nombre real, ni contenido de memoria sale de estos endpoints.
5. **Alertas son datos, no notificaciones push.** En v1 el dashboard muestra alertas activas. Notificaciones (email, Slack) son Post-V1.
6. **Funciona offline de AWS.** Los módulos de producto, usuarios y costos IA funcionan sin credenciales AWS. Infra AWS degrada a "No disponible" sin romper el dashboard.

---

## 3. Inventario completo de costos a trackear

### Costos de IA (ya en parte trackeados, ampliar)

| Servicio | Modelo | Precio actual | Trackeo hoy |
|---|---|---|---|
| OpenAI NLP extraction | `gpt-4o-mini` text | $0.150 / 1M tokens input, $0.600 / 1M output | ✅ `metric_type = openai_nlp_extraction` |
| OpenAI moderación texto | `moderations` endpoint | Gratuito (OpenAI free endpoint) | ❌ No trackeado |
| OpenAI moderación imagen | `gpt-4o-mini` vision | $0.150 / 1M tokens input + image tokens | ❌ No trackeado, diferente al NLP |
| OpenAI profiles TravelMemo | `gpt-4o-mini` (futuro) | Igual que NLP | ❌ No existe aún |

### Costos de infraestructura AWS (ninguno trackeado hoy)

| Servicio | Fuente | Granularidad disponible |
|---|---|---|
| EC2 (instancia backend) | Cost Explorer | Diaria |
| RDS (PostgreSQL + PostGIS + pgvector) | Cost Explorer | Diaria |
| S3 imágenes originales | Cost Explorer | Diaria |
| S3 thumbnails | Cost Explorer | Diaria |
| S3 backups | Cost Explorer | Diaria |
| Data transfer out | Cost Explorer | Diaria |
| ElastiCache / Redis (si aplica) | Cost Explorer | Diaria |
| Route 53, ACM, otros | Cost Explorer | Diaria |

### Costos de APIs externas (ninguno trackeado hoy)

| Servicio | Trigger | Precio referencia |
|---|---|---|
| Google Places API (Nearby Search) | Búsqueda de lugares | ~$0.032 / request |
| Google Places API (Place Details) | Detalle al compartir en TravelMemo | ~$0.017 / request |
| Google Places API (Text Search) | Búsqueda por texto | ~$0.032 / request |

> **Nota:** Para trackear Google Maps se necesita registrar cada llamada en `UsageMetric` con `metric_type = google_places_*`. No requiere integración con Google Billing, sólo logging propio en el código.

---

## 4. Módulos del dashboard

### Módulo 1 — Executive Overview

Snapshot de estado de la plataforma. Una sola pantalla. Responde: "¿Cómo está el negocio hoy?"

**KPIs obligatorios:**

| KPI | Fórmula | Fuente |
|---|---|---|
| Burn mensual total | Suma de (IA actual mes + infra AWS mes + Google Maps mes) | `usage_metrics` + Cost Explorer |
| Burn proyectado fin de mes | `(gasto acumulado / días transcurridos) × días totales del mes` | Cálculo en backend |
| % presupuesto consumido | `burn_acumulado / MONTHLY_BUDGET_USD × 100` | Config + DB |
| Usuarios activos 7d | Usuarios con al menos 1 memoria en los últimos 7 días | `memories` |
| Usuarios activos 30d | Ídem, 30 días | `memories` |
| Memorias creadas hoy | Count de memorias con `created_at >= hoy 00:00 UTC` | `memories` |
| Estado plataforma | `Healthy / Warning / Critical` derivado de reglas de alertas activas | Motor de alertas |
| Jobs fallidos (24h) | Count de `processing_jobs` con `status = failed` en últimas 24h | `processing_jobs` |

---

### Módulo 2 — FinOps

Responde: "¿Cuánto gasto, en qué, y es sostenible si escalo?"

**KPIs obligatorios:**

| KPI | Fórmula | Fuente |
|---|---|---|
| Costo IA por tipo (30d) | Sum por `metric_type` de `usage_metrics` | DB |
| Costo AWS por servicio (mes actual) | Desglose EC2 / RDS / S3 / Transfer | Cost Explorer (cache 6h) |
| Costo Google Maps (30d) | Sum de `usage_metrics` con `metric_type LIKE 'google_places%'` | DB (requiere agregar tracking) |
| Costo total por servicio (donut) | IA + infra + APIs externas, agrupado | Combinado |
| Ratio IA / Infra | `costo_ia_mes / costo_aws_mes` | Combinado |
| Unit economics — costo por memoria | `(ia_mes + infra_mes) / memorias_creadas_mes` | Combinado |
| Unit economics — costo por usuario activo | `(ia_mes + infra_mes) / usuarios_activos_30d` | Combinado |
| Proyección fin de mes (total) | `(gasto_acumulado_mes / días_transcurridos) × días_mes` | Cálculo en backend |
| Serie diaria de costo total | Por día, suma de todos los costos | Combinado |

> **Serie "IA vs Infra vs APIs"**: tres líneas en el mismo gráfico de área. Permite ver el mix de costos a medida que crece el uso.

---

### Módulo 3 — Usuarios y Growth

Responde: "¿Están llegando, usando y volviendo?"

**KPIs obligatorios:**

| KPI | Fórmula | Fuente |
|---|---|---|
| Nuevos registros por día | Count `users` por `created_at::date` | DB |
| Activación | `usuarios_con_al_menos_1_memoria / usuarios_registrados_mismo_período × 100%` | DB |
| Retención Día 7 | De usuarios registrados hace 7 días, % que creó una memoria en los últimos 7 días | DB |
| Retención Día 30 | Ídem, 30 días | DB |
| Usuarios activos 7d / 30d / 90d | Usuarios con memorias en cada ventana | DB |
| Ratio activos 30d / total | `activos_30d / total_usuarios × 100%` | DB |
| Cohorte mensual básica | Por mes de registro, cuántos crearon memoria en mes M+1 | DB (query compleja — ver nota) |
| Top usuarios por actividad | Ordenados por memorias + último acceso | DB |

> **Nota cohortes**: la query es pesada. Calcular en background task semanal y cachear resultado, no en tiempo real.

> **Churn proxy**: usuarios con `last_memory_date < hace 30 días` pero registrados hace más de 30 días. No es churn real (no hay suscripción), pero indica inactividad.

---

### Módulo 4 — Producto y Contenido

Responde: "¿Qué están creando y cómo se relacionan con la plataforma?"

**KPIs obligatorios (MyMemo core):**

| KPI | Fórmula | Fuente |
|---|---|---|
| Memorias por día | Count por día | `memories` |
| Memorias por tipo / emoción top | Group by `ai_metadata->nlp->emotion` | `memories` |
| Personas detectadas totales | Count `people` | `people` |
| Personas nombradas vs sin nombre | Count por nombre `ILIKE 'Unknown Person%'` | `people` |
| Conexiones sociales activas | Count `user_connections` con `status = accepted` | `user_connections` |
| Jobs completados vs fallidos (30d) | Por `job_type` y `status` | `processing_jobs` |
| Tiempo promedio de procesamiento NLP | Avg de `completed_at - started_at` donde `job_type = nlp_extraction` | `processing_jobs` |
| Tiempo promedio de procesamiento faces | Ídem, `face_recognition` | `processing_jobs` |

**KPIs obligatorios (TravelMemo):**

| KPI | Fórmula | Fuente |
|---|---|---|
| Share rate | `memorias_compartidas_en_travel / total_memorias × 100%` | `memories.travel_shared` |
| Memorias Travel por estado moderación | Count por `moderation_status` | `public_memories` |
| Approval rate moderación | `approved / total_moderados × 100%` | `public_memories` |
| Cola de moderación pendiente | Count `moderation_status = pending` | `public_memories` |
| Lugares activos en catálogo | Count `places_catalog` con `memory_count > 0` | `places_catalog` |
| Interacciones por tipo (30d) | Count `recommendation_events` agrupado por `event_type` | `recommendation_events` |
| Lugares guardados (total y últimos 30d) | Count `saved_places` | `saved_places` |
| Reportes de contenido (30d) | Count eventos con `event_type = report` | `recommendation_events` |

---

### Módulo 5 — Infraestructura y Operación

Responde: "¿La plataforma está sana y puede aguantar más carga?"

> **Nota de arquitectura real:** El servidor corre en un Droplet de DigitalOcean, no en EC2/RDS de AWS. CloudWatch no aplica. Las métricas del servidor se obtienen desde el propio proceso backend usando `psutil` (CPU, RAM, disco). La DB es PostgreSQL en el mismo Droplet — métricas vía `pg_stat_*`. El único servicio AWS activo es S3.

**KPIs del servidor (DigitalOcean Droplet — via `psutil` en el backend):**

| KPI | Fuente | Cache |
|---|---|---|
| CPU utilización actual | `psutil.cpu_percent(interval=1)` | 1 min |
| RAM usada / total (GB) | `psutil.virtual_memory()` | 1 min |
| Disco usado / total (GB) | `psutil.disk_usage('/')` | 5 min |
| Uptime del proceso backend | `psutil.Process(os.getpid()).create_time()` | 30 s |

**KPIs PostgreSQL (sin CloudWatch):**

**KPIs desde la propia DB (sin CloudWatch):**

| KPI | Query | Cache |
|---|---|---|
| Conexiones activas en DB | `pg_stat_activity` count | 1 min |
| Tamaño total de DB | `pg_database_size(current_database())` | 30 min |
| Tamaño de tablas críticas | `pg_total_relation_size('memories')` etc | 30 min |
| Índices no usados | `pg_stat_user_indexes` donde `idx_scan = 0` | 6 h |

**KPIs Celery / Redis:**

| KPI | Fuente | Cache |
|---|---|---|
| Jobs pendientes en cola | `redis.llen('celery')` o Celery Inspect API | 1 min |
| Workers activos | Celery Inspect `.active()` | 1 min |
| Jobs fallidos totales (24h) | `processing_jobs` con `status = failed` y `created_at >= 24h ago` | 5 min |
| Tasa de reintento | Avg de `attempts` donde `attempts > 1` | 5 min |

---

### Módulo 6 — Alertas

Responde: "¿Hay algo que requiere atención ahora mismo?"

**Reglas de alerta v1:**

| Nombre | Condición | Severity |
|---|---|---|
| Budget Warning | `burn_mes_actual >= MONTHLY_BUDGET_USD × (ALERT_THRESHOLD_PERCENTAGE / 100)` | Warning |
| Budget Critical | `burn_proyectado_fin_mes >= MONTHLY_BUDGET_USD` | Critical |
| Job failure spike | `jobs_fallidos_1h > 5` | Warning |
| Moderation backlog | `pending_moderation > 50` | Warning |
| DB storage low | `free_storage_gb < 5` | Critical |
| EC2 CPU high | `cpu_avg_1h > 80%` | Warning |
| EC2 CPU critical | `cpu_avg_15min > 95%` | Critical |
| DB connections high | `conexiones_activas > 80% del max_connections` | Warning |

Cada alerta tiene: `name`, `severity`, `condition_description`, `triggered_at`, `current_value`, `threshold`.

`GET /admin/alerts` devuelve la lista de alertas activas en el momento de la consulta. No persiste historial en v1.

---

### Módulo 7 — Por Usuario (detalle operativo)

Responde: "¿Quién está usando la plataforma y cuánto cuesta cada uno?"

| Campo | Fuente |
|---|---|
| Nombre (ofuscado si se desea) | `users` |
| Fecha de registro | `users.created_at` |
| Total memorias | `memories` |
| Personas detectadas | `people` |
| Conexiones activas | `user_connections` |
| Última actividad | `max(memories.created_at)` |
| Costo IA acumulado | `sum(usage_metrics.cost_usd)` |
| Memorias compartidas en Travel | `count(memories WHERE travel_shared = true)` |

> Este módulo ya existe parcialmente. Le falta el campo de Travel.

---

## 5. Contrato de endpoints

Seis endpoints admin nuevos. Los existentes (`/admin/stats`, `/admin/users`) se mantienen para no romper el dashboard actual.

### `GET /admin/executive`
Cache: 2 min. Propósito: cargar el header del dashboard en un solo request.

```json
{
  "generated_at": "ISO8601",
  "platform_status": "healthy | warning | critical",
  "burn_mtd_usd": 12.45,
  "burn_projected_usd": 38.50,
  "budget_usd": 50.0,
  "budget_pct_used": 24.9,
  "users_active_7d": 3,
  "users_active_30d": 8,
  "memories_today": 5,
  "jobs_failed_24h": 0,
  "alerts_active": 0
}
```

### `GET /admin/finops`
Cache: 30 min (mezclado: DB en tiempo casi real + AWS con cache propia 6h).

```json
{
  "generated_at": "ISO8601",
  "period": "current_month",
  "ai_costs": {
    "total_usd": 4.50,
    "by_type": [
      {"type": "openai_nlp_extraction", "cost_usd": 4.10, "calls": 820},
      {"type": "openai_vision_moderation", "cost_usd": 0.40, "calls": 35},
      {"type": "google_places_nearby", "cost_usd": 0.00, "calls": 0}
    ]
  },
  "infra_costs": {
    "source": "aws_cost_explorer | manual_estimate | unavailable",
    "cached_at": "ISO8601",
    "total_usd": 34.0,
    "by_service": [
      {"service": "EC2", "cost_usd": 18.0},
      {"service": "RDS", "cost_usd": 12.0},
      {"service": "S3", "cost_usd": 2.0},
      {"service": "Transfer", "cost_usd": 2.0}
    ]
  },
  "totals": {
    "mtd_usd": 38.50,
    "projected_usd": 47.20,
    "daily_avg_usd": 1.28
  },
  "unit_economics": {
    "cost_per_memory_created": 0.047,
    "cost_per_active_user_30d": 4.81
  },
  "ratio_ai_vs_infra": 0.13,
  "daily_series": [
    {"date": "2026-04-01", "ai_usd": 0.18, "infra_usd": 1.10, "total_usd": 1.28}
  ]
}
```

### `GET /admin/infrastructure`
Cache: 5 min. No requiere credenciales AWS. Todo desde el proceso backend y DB.

```json
{
  "generated_at": "ISO8601",
  "overall_status": "healthy | warning | critical",
  "server": {
    "cpu_pct": 12.5,
    "ram_used_gb": 0.9,
    "ram_total_gb": 2.0,
    "ram_pct": 45.0,
    "disk_used_gb": 8.4,
    "disk_total_gb": 25.0,
    "disk_pct": 33.6,
    "uptime_hours": 142.3
  },
  "celery": {
    "workers_active": 2,
    "queue_depth": 0,
    "jobs_failed_24h": 1
  },
  "redis": {
    "status": "ok | unavailable"
  }
}
```

### `GET /admin/users-kpis`
Cache: 5 min.

```json
{
  "generated_at": "ISO8601",
  "totals": {
    "registered": 12,
    "active_7d": 3,
    "active_30d": 8,
    "active_90d": 10
  },
  "activation_rate_pct": 66.7,
  "retention_7d_pct": 50.0,
  "retention_30d_pct": 37.5,
  "churn_proxy_30d": 2,
  "new_per_day": [{"date": "2026-04-01", "count": 1}],
  "cohorts": [
    {"month": "2026-03", "registered": 5, "returned_next_month": 3}
  ]
}
```

### `GET /admin/product-kpis`
Cache: 2 min.

```json
{
  "generated_at": "ISO8601",
  "memories": {
    "total": 142,
    "last_7d": 18,
    "last_30d": 61,
    "per_day": [{"date": "2026-04-01", "count": 3}]
  },
  "processing": {
    "nlp_avg_seconds": 2.4,
    "face_avg_seconds": 5.1,
    "jobs_failed_30d": 3,
    "jobs_completed_30d": 138
  },
  "travel": {
    "share_rate_pct": 12.0,
    "public_memories_active": 17,
    "moderation_pending": 2,
    "moderation_approved": 15,
    "moderation_rejected": 1,
    "approval_rate_pct": 94.1,
    "events_30d": [
      {"type": "view", "count": 145},
      {"type": "click", "count": 38},
      {"type": "save", "count": 12},
      {"type": "report", "count": 1}
    ],
    "feed_ctr_pct": 26.2,
    "places_active": 9,
    "saved_places_total": 12
  },
  "people": {
    "total": 28,
    "named": 11,
    "unnamed": 17
  },
  "connections": {
    "accepted": 6,
    "pending": 2
  }
}
```

### `GET /admin/alerts`
Cache: 30 seg.

```json
{
  "generated_at": "ISO8601",
  "active_count": 1,
  "alerts": [
    {
      "name": "budget_warning",
      "severity": "warning",
      "description": "Gasto acumulado supera el 80% del presupuesto mensual",
      "triggered_at": "ISO8601",
      "current_value": 41.20,
      "threshold": 40.00,
      "unit": "USD"
    }
  ]
}
```

---

## 6. Arquitectura y cache

```
Dashboard Streamlit
    │
    └── HTTP (X-Admin-Key) ──▶ FastAPI Backend
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
              PostgreSQL       Redis Cache       AWS APIs
              (métricas,       (keys           (Cost Explorer,
              usage,           namespaceadas)   CloudWatch)
              travel)
```

**Esquema de cache Redis para admin:**

| Key | TTL | Descripción |
|---|---|---|
| `admin:executive` | 120 s | Snapshot ejecutivo |
| `admin:finops` | 1800 s | FinOps combinado |
| `admin:finops:aws` | 21600 s | Sólo datos AWS Cost Explorer (6h) |
| `admin:infra` | 300 s | Estado de infraestructura |
| `admin:users_kpis` | 300 s | KPIs de crecimiento |
| `admin:product_kpis` | 120 s | KPIs de producto |
| `admin:alerts` | 30 s | Alertas activas |

Si Redis no está disponible, el backend responde desde DB directamente (degraded mode — sin cache).

---

## 7. Fases de ejecución

### Fase A — Backend: ampliar métricas (funciona sin AWS)

**Entregables:**
- Agregar tracking de `google_places_*` en todos los endpoints que llaman a Google Places API.
- Agregar tracking de `openai_vision_moderation` en `moderation_service.py`.
- Implementar `GET /admin/executive` (todo desde DB, sin AWS).
- Implementar `GET /admin/product-kpis` (incluye Travel).
- Implementar `GET /admin/users-kpis` (activación, retención básica, churn proxy).
- Implementar `GET /admin/alerts` (sólo reglas de DB, sin métricas AWS).

**Viable en local/staging sin credenciales AWS:** Sí.

### Fase B — FinOps real AWS (sólo S3 + Cost Explorer)

**Entregables:**
- Integrar `boto3` con AWS Cost Explorer para costos de S3.
- Implementar `GET /admin/finops` con cache 6h para el bloque AWS.
- Cálculo de unit economics y proyección mensual.
- Lógica de failover si Cost Explorer no está disponible (datos aún no ingested).

**Requiere:** `ce:GetCostAndUsage` — ya adjuntado a `mymemo-dashboard-user`. Datos disponibles ~24h después de activar Cost Explorer.

**Nota:** EC2 y RDS no aplican (servidor en DigitalOcean). Los únicos costos AWS son S3 y data transfer.

### Fase C — Salud de infraestructura (psutil + pg_stat)

**Entregables:**
- Agregar `psutil` al backend para métricas del servidor (CPU, RAM, disco, uptime).
- Queries a `pg_stat_activity` y `pg_database_size` para métricas de DB.
- Integrar Celery Inspect API para queue depth y workers activos.
- Implementar `GET /admin/infrastructure` — no requiere boto3 ni credenciales AWS.

**No requiere credenciales AWS.** Funciona en local y en producción sin cambios de config.

### Fase D — Dashboard Streamlit v2

**Entregables:**
- Reescribir `dashboard/app.py` para consumir los 6 nuevos endpoints.
- Módulo Executive: health badge + burn rate + alertas activas prominentes.
- Módulo FinOps: donut IA vs Infra vs APIs, serie diaria de costos, unit economics.
- Módulo Infraestructura: KPIs EC2/RDS/Redis/Celery con colores semáforo.
- Módulo Usuarios: serie de registros, activación, retención, cohortes.
- Módulo Producto: contenido, procesamiento, Travel KPIs completos.
- Módulo Alertas: tabla de alertas activas con severity.

### Fase E — Alertas y gobernanza (Post-V1)

**Entregables:**
- Motor de alertas persistente con historial en DB.
- Notificaciones a Slack o email cuando se dispara alerta crítica.
- Budget allocation por categoría (cuánto destinar a IA, cuánto a infra).
- Panel de configuración de umbrales.

---

## 8. Permisos IAM necesarios

Crear un IAM user o role dedicado al backend con estas políticas:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CostExplorer",
      "Effect": "Allow",
      "Action": ["ce:GetCostAndUsage", "ce:GetCostForecast"],
      "Resource": "*"
    },
    {
      "Sid": "CloudWatch",
      "Effect": "Allow",
      "Action": [
        "cloudwatch:GetMetricData",
        "cloudwatch:ListMetrics"
      ],
      "Resource": "*"
    },
    {
      "Sid": "EC2ReadOnly",
      "Effect": "Allow",
      "Action": ["ec2:DescribeInstances", "ec2:DescribeInstanceStatus"],
      "Resource": "*"
    },
    {
      "Sid": "RDSReadOnly",
      "Effect": "Allow",
      "Action": ["rds:DescribeDBInstances"],
      "Resource": "*"
    }
  ]
}
```

Las credenciales van en `backend/.env` como `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY` (ya están en config pero vacías).

**Recomendado en producción:** usar IAM Role en la instancia EC2 (Instance Profile) para no manejar access keys.

---

## 9. Stack del dashboard

**Decisión: mantener Streamlit.**

Razones:
- Streamlit es la herramienta correcta para un dashboard de control interno de founder.
- No necesita auth frontend (protegido por `ADMIN_API_KEY` en el backend).
- Velocidad de desarrollo 5-10x vs React para este caso de uso.
- La capa de lógica ya está en el backend; el dashboard sólo presenta.
- Si en el futuro se quiere embeber en el producto React, los endpoints admin son reutilizables sin cambios.

**Cambios al stack del dashboard:**
- Agregar `boto3>=1.34` a `dashboard/requirements.txt` y `backend/pyproject.toml`.
- Agregar una página por módulo usando `st.navigation` (Streamlit 1.29+) en vez de tabs en un solo archivo.

---

## 10. Limitaciones conocidas

| Limitación | Descripción |
|---|---|
| Cost Explorer con retraso | Los costos AWS tienen retraso de 24-48h. No son tiempo real. El dashboard debe mostrarlo claramente. |
| Solo S3 en AWS | El servidor corre en DigitalOcean, no en EC2/RDS. Cost Explorer solo mostrará costos de S3 y data transfer. Las métricas de servidor vienen de `psutil`, no de CloudWatch. |
| Cohortes en DB grandes = lento | La query de cohortes cruza usuarios con memorias en múltiple períodos. Con base pequeña no hay problema. Al escalar, mover a Celery task periódico. |
| Google Maps → sólo tracking propio | No hay API de billing de Google Maps accesible programáticamente. El tracking se hace por logging de llamadas en el propio código. |
| Celery Inspect en producción | Si hay múltiples workers o broker diferente, `inspect().active()` puede ser inconsistente. Usar `redis.llen` como señal más confiable de queue depth. |
| Latencia API → requiere middleware | Para medir p50/p95 de endpoints se necesita agregar middleware de timing. No existe hoy. Es Fase E. |
