# Runbook Dashboard en Instancia (MyMemo)

## Objetivo

Ejecutar y validar las fases implementadas del dashboard cuando la instancia quede libre, sin pruebas locales.

## Estado actual del código

- Fase A implementada en backend:
  - `GET /api/v1/admin/executive`
  - `GET /api/v1/admin/users-kpis`
  - `GET /api/v1/admin/product-kpis`
  - `GET /api/v1/admin/alerts`
  - Tracking de Google Places en `usage_metrics` desde:
    - `GET /api/v1/search/places/autocomplete`
    - `GET /api/v1/search/places/geocode`
    - `GET /api/v1/search/places/reverse-geocode`
- Fase B iniciada en backend:
  - `GET /api/v1/admin/finops` con integración a Cost Explorer y fallback `source = unavailable`.

## Prerrequisitos en instancia

1. Rama con cambios desplegada en el servidor (no `main` viejo).
2. Variables en `backend/.env`:
   - `ADMIN_API_KEY`
   - `GOOGLE_MAPS_API_KEY`
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_REGION`
3. Cost Explorer activado en la cuenta AWS (puede tardar 24-48h en mostrar datos).
4. Backend reiniciado luego del deploy.

## Despliegue cuando la instancia quede libre

```bash
cd /app/mymemo
git fetch origin
git checkout dashboard-gastos-y-usuarios
git pull --ff-only origin dashboard-gastos-y-usuarios
docker compose -f docker-compose.prod.yml up -d --build backend
docker compose -f docker-compose.prod.yml restart nginx
```

## Verificación rápida de salud

```bash
curl -sS https://mymemo-app.duckdns.org/health
```

Resultado esperado: status 200.

## Validación automática (recomendada)

Desde PowerShell en tu máquina:

```powershell
$securePass = Read-Host "Password" -AsSecureString

./deployment/validate_dashboard_instance.ps1 `
  -ApiUrl "https://mymemo-app.duckdns.org" `
  -Username "TU_EMAIL" `
  -Password $securePass
```

Notas:
- El script toma `ADMIN_API_KEY` automáticamente desde `backend/.env` si no se envía por parámetro.
- Si sólo quieres validar endpoints admin y omitir login/places:

```powershell
./deployment/validate_dashboard_instance.ps1 -ApiUrl "https://mymemo-app.duckdns.org" -SkipLogin -SkipPlaces
```

## Verificación endpoints admin (Fase A + Fase B)

Desde PowerShell en tu máquina:

```powershell
$apiUrl = "https://mymemo-app.duckdns.org"
$adminKey = (Get-Content .\backend\.env | Where-Object { $_ -like 'ADMIN_API_KEY=*' } | Select-Object -First 1).Split('=',2)[1].Trim()

Invoke-RestMethod -Uri "$apiUrl/api/v1/admin/stats" -Headers @{"X-Admin-Key"=$adminKey}
Invoke-RestMethod -Uri "$apiUrl/api/v1/admin/executive" -Headers @{"X-Admin-Key"=$adminKey}
Invoke-RestMethod -Uri "$apiUrl/api/v1/admin/users-kpis" -Headers @{"X-Admin-Key"=$adminKey}
Invoke-RestMethod -Uri "$apiUrl/api/v1/admin/product-kpis" -Headers @{"X-Admin-Key"=$adminKey}
Invoke-RestMethod -Uri "$apiUrl/api/v1/admin/alerts" -Headers @{"X-Admin-Key"=$adminKey}
Invoke-RestMethod -Uri "$apiUrl/api/v1/admin/finops" -Headers @{"X-Admin-Key"=$adminKey}
Invoke-RestMethod -Uri "$apiUrl/api/v1/admin/infrastructure" -Headers @{"X-Admin-Key"=$adminKey}
```

### Lectura esperada

- `stats` debe responder 200 (endpoint legacy).
- Los nuevos endpoints deben responder 200 (si sale 404, la instancia no tiene este código desplegado).
- `finops.infra_costs.source`:
  - `aws_cost_explorer` si CE ya tiene datos.
  - `unavailable` si CE no tiene datos todavia o hay error de permisos.

## Verificación login + JWT para pruebas de Google Places

```powershell
$apiUrl = "https://mymemo-app.duckdns.org"
$auth = Invoke-RestMethod `
  -Method Post `
  -Uri "$apiUrl/api/v1/auth/login" `
  -ContentType "application/x-www-form-urlencoded" `
  -Body "username=TU_EMAIL&password=TU_PASSWORD"

$token = $auth.access_token
$token
```

## Verificación tracking Google Places

```powershell
Invoke-RestMethod -Uri "$apiUrl/api/v1/search/places/autocomplete?q=roma%20norte&language=es&country=mx" `
  -Headers @{ Authorization = "Bearer $token" }

Invoke-RestMethod -Uri "$apiUrl/api/v1/search/places/reverse-geocode?latitude=19.4326&longitude=-99.1332&language=es" `
  -Headers @{ Authorization = "Bearer $token" }
```

Resultado esperado: respuestas 200 y costos apareciendo en `admin/finops` bajo tipos `google_places_*`.

## Diagnostico rapido de errores

- Error 404 en `/admin/executive`:
  - La instancia sigue en version anterior. Repetir deploy de rama correcta.
- Error 401 en endpoints admin:
  - `ADMIN_API_KEY` de cliente no coincide con backend.
- Error 503 en endpoints admin:
  - `ADMIN_API_KEY` no configurado en backend.
- Error 422 en login:
  - Debe ser `application/x-www-form-urlencoded` con `username` y `password`.
- `finops` con `source=unavailable`:
  - CE recien activado, sin ingest data, o permisos IAM incompletos.

## Siguiente fase (despues de validar en instancia)

Fase C:

1. Endpoint `GET /api/v1/admin/infrastructure`.
2. Metricas del Droplet via `psutil` (CPU, RAM, disco, uptime).
3. Metricas DB (`pg_stat_activity`, `pg_database_size`).
4. Metricas Celery/Redis (queue depth, workers activos).
