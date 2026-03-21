# MyMemo — Server Infrastructure Reference

**Última actualización:** Marzo 2026  
**Propósito:** Referencia única de toda la infraestructura del servidor para evitar conflictos y tener contexto claro en cada sesión.

---

## 🖥️ Instancia AWS Lightsail

| Parámetro | Valor |
|---|---|
| **Nombre** | `mymemo-production-2` |
| **Proveedor** | AWS Lightsail |
| **SO** | Ubuntu 24.04 LTS |
| **RAM** | 2 GB |
| **vCPUs** | 2 |
| **Disco** | 60 GB SSD |
| **Swap** | 2 GB (`/swapfile`) — necesario para compilar dlib |
| **IP estática** | `16.58.56.110` |
| **Zona** | us-east-2 (Ohio) |
| **Dominio** | `mymemo-app.duckdns.org` (DuckDNS gratuito) |
| **SSL** | Let's Encrypt — auto-renueva cada 90 días |

> ⚠️ La instancia anterior (`mymemo-production`) fue eliminada para evitar doble cobro. `mymemo-production-2` fue creada desde snapshot.

---

## 🔐 Acceso SSH

```bash
# Alias configurado en ~/.ssh/config
ssh mymemo

# Comando completo equivalente
ssh -p 2222 -i ~/.ssh/LightsailDefaultKey-us-east-2.pem ubuntu@16.58.56.110

# Puerto no estándar porque ISP bloquea el puerto 22
# Puerto 2222 habilitado vía systemd socket override
```

---

## 📁 Estructura en el Servidor

```
/app/mymemo/                    ← Raíz del proyecto (git repo)
├── backend/                    ← FastAPI app
├── frontend/
│   └── dist/                   ← Build React compilado (npm run build)
├── deployment/
│   ├── nginx.prod.conf         ← Config nginx (TU_DOMINIO reemplazado)
│   ├── deploy.sh               ← Script de despliegue
│   ├── init-extensions.sql     ← Extensiones PostgreSQL
│   └── migrate_to_auth.sql     ← Migración multi-usuario (ya ejecutada)
├── docker-compose.prod.yml     ← Compose de PRODUCCIÓN
├── .env.prod                   ← Variables de entorno reales (NO en git)
└── /swapfile                   ← 2GB swap del sistema
```

---

## 🐳 Arquitectura Docker (Producción)

### Comando base para TODOS los comandos Docker en producción:
```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod [COMANDO]
```
> ⚠️ **SIEMPRE** usar `--env-file .env.prod`. Sin él, las variables de entorno no se cargan.

---

### Servicios y Contenedores

| Servicio en compose | Contenedor real | Imagen | Puerto expuesto |
|---|---|---|---|
| `db` | `mymemo_db` | `postgis/postgis:16-3.4` | Solo interno |
| `redis` | `mymemo_redis` | `redis:7-alpine` | Solo interno |
| `backend` | `mymemo_backend` | Build `./backend` | Solo interno (nginx proxea) |
| `celery_worker` | `mymemo_celery` | Build `./backend` | Ninguno |
| `nginx` | `mymemo_nginx` | `nginx:alpine` | `80:80`, `443:443` |
| `certbot` | `mymemo_certbot` | `certbot/certbot` | Ninguno |

---

### Volúmenes Docker

| Volumen | Qué contiene |
|---|---|
| `postgres_data` | Base de datos PostgreSQL (persistente) |
| `redis_data` | Datos Redis (colas Celery) |
| `certbot_certs` | Certificados SSL Let's Encrypt |
| `certbot_www` | Challenge files para renovación SSL |

---

### Flujo de Tráfico

```
Internet
    │
    ▼
mymemo_nginx (:80 / :443)
    │
    ├── /api/*  ──────────────► mymemo_backend (:8000) [FastAPI]
    │                                │
    │                                ▼
    │                         mymemo_redis → mymemo_celery [Celery]
    │                                │
    │                                ▼
    │                         mymemo_db [:5432] [PostgreSQL+PostGIS]
    │
    └── /*  ────────────────► /usr/share/nginx/html [React SPA dist/]
```

---

### Configuración nginx

- **HTTP (80)** → Redirige todo a HTTPS, excepto `/.well-known/acme-challenge/` para certbot
- **HTTPS (443)** → Sirve la app
  - `/api/*` → proxy a `backend:8000` (timeout 120s para imágenes pesadas)
  - `/` → React SPA con fallback a `index.html` (React Router)
  - `/sw.js` → `no-cache` siempre (crítico para PWA updates)
  - `*.js, *.css, *.png...` → cache 30 días (`immutable`)
  - `client_max_body_size` → 20MB (fotos)
- **SSL** → TLSv1.2 + TLSv1.3, certs en `/etc/letsencrypt/live/mymemo-app.duckdns.org/`

---

## 🔧 Backend — Dependencias (pyproject.toml)

```toml
# Core API
fastapi>=0.115.0
uvicorn[standard]>=0.32.0
sqlalchemy>=2.0.36
asyncpg>=0.30.0          # Driver async PostgreSQL para FastAPI
psycopg2-binary>=2.9.10  # Driver sync PostgreSQL para Celery

# Auth & Security
python-jose[cryptography]>=3.3.0   # JWT tokens
bcrypt>=4.0.0                       # Hash de contraseñas
slowapi>=0.1.9                      # Rate limiting

# AI / ML  ← FUENTE DE PROBLEMAS DE ESPACIO EN DISCO
face-recognition>=1.3.0   # dlib — requiere compilación ~10-20 min + ~500MB build
deepface>=0.0.93          # ⚠️ Trae TensorFlow (~500MB+) — NO SE USA ACTUALMENTE

# Storage & Cloud
boto3>=1.35.0    # AWS S3
openai>=1.54.0   # GPT-4o-mini NLP

# Geo
geoalchemy2>=0.15.2
shapely>=2.0.0
```

---

## 🏗️ Dockerfile Backend

```dockerfile
FROM python:3.12-slim

# Dependencias sistema para dlib / face_recognition
RUN apt-get update && apt-get install -y \
    build-essential cmake \
    libopenblas-dev liblapack-dev \
    libx11-dev libgtk-3-dev git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN pip install uv
COPY pyproject.toml ./

# Instalación de dependencias (tarda ~20-40 min por compilación de dlib)
RUN pip install --no-cache-dir 'setuptools==69.5.1' wheel
RUN uv pip install --system -e .
RUN uv pip install --system git+https://github.com/ageitgey/face_recognition_models

COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

> ⚠️ **IMPORTANTE:** El build tarda ~20-40 minutos por la compilación de dlib. Solo hacer rebuild cuando cambien dependencias en `pyproject.toml`.

---

## 📋 Variables de Entorno (.env.prod)

> El archivo real está en `/app/mymemo/.env.prod` en el servidor. **Nunca se commitea a git.**

| Variable | Descripción | Ejemplo |
|---|---|---|
| `DOMAIN` | Dominio de la app | `mymemo-app.duckdns.org` |
| `EMAIL` | Email para Let's Encrypt | `mario@email.com` |
| `DB_USER` | Usuario PostgreSQL | `lifelogs_user` |
| `DB_PASSWORD` | Contraseña PostgreSQL | *(segura)* |
| `DB_NAME` | Nombre de la BD | `lifelogs_db` |
| `SECRET_KEY` | JWT signing key (32 bytes hex) | *(generada con secrets.token_hex)* |
| `AWS_ACCESS_KEY_ID` | AWS IAM key | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret | *(secreta)* |
| `AWS_REGION` | Región S3 | `us-east-1` |
| `S3_BUCKET_IMAGES` | Bucket imágenes originales | `mymemo-images-prod-2026` |
| `S3_BUCKET_THUMBNAILS` | Bucket thumbnails | `mymemo-thumbnails-prod-2026` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |
| `GOOGLE_MAPS_API_KEY` | Google Places API | *(para Fase F)* |
| `ADMIN_API_KEY` | API key admin interna | *(secreta)* |

---

## 🗄️ Base de Datos

| Parámetro | Valor |
|---|---|
| **Motor** | PostgreSQL 16 + PostGIS 3.4 |
| **Host (interno Docker)** | `db:5432` |
| **Usuario** | `lifelogs_user` |
| **BD** | `lifelogs_db` |
| **Extensiones** | PostGIS, pg_trgm, uuid-ossp, pgvector |
| **URL async (FastAPI)** | `postgresql+asyncpg://lifelogs_user:PASS@db:5432/lifelogs_db` |
| **URL sync (Celery)** | `postgresql+psycopg2://lifelogs_user:PASS@db:5432/lifelogs_db` |

### Acceso directo a la BD:
```bash
docker exec -it mymemo_db psql -U lifelogs_user -d lifelogs_db
```

---

## 🔑 Comandos de Referencia Rápida

### Ver estado de todos los servicios
```bash
cd /app/mymemo
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
```

### Ver logs en tiempo real
```bash
# Todos los servicios
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f

# Solo backend
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f backend

# Solo celery (face recognition)
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f celery_worker

# Solo nginx
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f nginx
```

### Reiniciar servicios (SIN rebuild — rápido)
```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod restart backend celery_worker
```

### Deploy de cambios de CÓDIGO (frontend o backend sin deps nuevas)
```bash
cd /app/mymemo
git pull origin main

# Solo frontend cambió:
cd frontend && npm run build && cd ..
docker compose -f docker-compose.prod.yml --env-file .env.prod restart nginx

# Solo backend cambió (código Python, sin nuevas librerías):
docker compose -f docker-compose.prod.yml --env-file .env.prod restart backend celery_worker
```

### Rebuild COMPLETO (solo cuando cambien dependencias en pyproject.toml)
```bash
# ⚠️ Tarda 20-40 min — solo cuando sea necesario
docker compose -f docker-compose.prod.yml --env-file .env.prod build --no-cache backend celery_worker
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --no-deps backend celery_worker
```

### Limpiar cola Redis (si hay tareas atascadas)
```bash
docker exec mymemo_redis redis-cli FLUSHDB
```

---

## ⚠️ Problemas Conocidos y Soluciones

### 1. Disco lleno durante rebuild
**Síntoma:** `no space left on device` durante `docker build`  
**Causa raíz:** Imágenes Docker antiguas + capas de build acumuladas  
**Solución:** Ver sección "Gestión de Espacio en Disco" abajo

### 2. OOM durante build de dlib
**Síntoma:** El build muere silenciosamente o el worker crashea  
**Causa:** Compilar dlib requiere ~1.5GB RAM  
**Solución:** El swap de 2GB en `/swapfile` está configurado para esto

### 3. Safari PWA no actualiza
**Síntoma:** Cambios de código no se ven en iPhone  
**Solución:** Botón "Recargar" en el Header (limpia SW + cache)

### 4. Variables de entorno vacías en Docker
**Síntoma:** Backend arranca con valores vacíos / errores de config  
**Causa:** Se olvidó `--env-file .env.prod` en el comando  
**Solución:** SIEMPRE incluir `--env-file .env.prod`

### 5. Face recognition error numpy
**Síntoma:** `TypeError: compute_face_descriptor(): incompatible function arguments`  
**Fix aplicado:** `np.ascontiguousarray()` en `backend/services/face_service.py` (commit `7c5992b`)

---

## 🧹 Gestión de Espacio en Disco

### Ver uso actual
```bash
df -h /                           # Espacio total del disco
docker system df                  # Espacio usado por Docker
docker images                     # Imágenes y sus tamaños
```

### Limpiar capas y caché Docker (SEGURO — no borra datos)
```bash
docker builder prune -f           # Limpia caché de build
docker image prune -f             # Elimina imágenes sin usar (dangling)
docker system prune -f            # Limpia todo lo no usado (sin volúmenes)
```

### Limpiar TODO incluyendo imágenes no activas (más agresivo)
```bash
# ⚠️ Esto elimina imágenes que no están en uso activo
docker system prune -a -f
# Los volúmenes de datos (postgres_data, etc.) NO se tocan con este comando
```

### Ver qué ocupa más espacio en el sistema
```bash
du -sh /var/lib/docker/*          # Desglose del storage de Docker
du -sh /app/mymemo/frontend/dist  # Build del frontend
du -sh /app/mymemo/frontend/node_modules  # node_modules (puede ser grande)
```

---

## 📊 Arquitectura de Imágenes Docker

### Problema actual en docker-compose.prod.yml
```yaml
# ⚠️ Ambos servicios tienen build: ./backend por separado
# Esto construye la imagen DOS VECES — duplica tiempo y espacio en disco
backend:
  build: ./backend        # ← Build #1
  
celery_worker:
  build: ./backend        # ← Build #2 (innecesario, idéntico al anterior)
```

### Solución (optimización recomendada)
```yaml
# Backend construye Y nombra la imagen
backend:
  build: ./backend
  image: mymemo-backend   # ← Nombrar la imagen

# Celery reutiliza la misma imagen — no rebuilds
celery_worker:
  image: mymemo-backend   # ← Reusar sin build propio
  # Sin build:
```

> ℹ️ En `docker-compose.yml` (dev) ya está implementado así correctamente. Pendiente aplicar la misma optimización en `docker-compose.prod.yml`.

---

## 🌐 AWS S3

| Bucket | Propósito | Región |
|---|---|---|
| `mymemo-images-prod-2026` | Imágenes originales subidas | us-east-1 |
| `mymemo-thumbnails-prod-2026` | Thumbnails WebP generados | us-east-1 |

- **Acceso:** Pre-signed URLs (validez 7 días, generadas frescas en cada respuesta)
- **IAM User:** `MyMemo-app` con permisos `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`

---

## 📱 Frontend (React PWA)

| Parámetro | Valor |
|---|---|
| **Build tool** | Vite |
| **Build output** | `frontend/dist/` |
| **Servido por** | nginx (archivo estático) |
| **PWA** | Workbox — `skipWaiting`, `clientsClaim`, `NetworkOnly` para `/api/*` |
| **Rebuild comando** | `cd /app/mymemo/frontend && npm run build` |
| **Tiempo de rebuild** | ~8-15 segundos |

> ⚠️ Después de cada `npm run build`, nginx sirve el nuevo `dist/` automáticamente sin reinicio.

---

## 🔄 Flujo de Deploy por Tipo de Cambio

| Tipo de cambio | Comando necesario | Tiempo estimado |
|---|---|---|
| Solo CSS/JS frontend | `npm run build` en frontend | ~10s |
| Código Python backend (sin deps) | `restart backend celery_worker` | ~5s |
| Nueva dependencia Python | `build --no-cache` + `up -d` | 20-40 min |
| Config nginx | `restart nginx` | ~2s |
| Variables `.env.prod` | `restart` del servicio afectado | ~5s |
| Schema BD (migración SQL) | `docker exec mymemo_db psql ...` | ~2s |
