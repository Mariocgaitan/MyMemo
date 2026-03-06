# Session 15: Multi-User Auth — Deploy Guide

## Commits en esta sesión (branch `feature/auth`)

| Commit | Descripción |
|---|---|
| `4447c3d` | feat: JWT auth backend (register, login, /me), protect all endpoints |
| `2293f3b` | fix: SQL injection en search_by_tags |
| `16e59c0` | security: rate limit, timing-safe login, SECRET_KEY guard, image MIME |
| `f9c57fb` | feat: frontend auth (Login, Register, AuthContext, ProtectedRoute) |
| `3d737d4` | config: token expiry 30 days |

---

## Pre-deploy: Generar el hash de tu contraseña

En tu máquina local, con el venv activo:
```bash
cd backend
python3 -c "from passlib.context import CryptContext; ctx = CryptContext(schemes=['bcrypt']); print(ctx.hash('TU_PASSWORD_AQUI'))"
```
Copia el resultado (empieza con `$2b$12$...`). Lo necesitas para el SQL.

---

## Deploy paso a paso

### 1. Merge + push desde tu máquina local
```bash
git checkout main
git merge feature/auth --no-ff -m "feat: multi-user auth + security hardening"
git push origin main
```

### 2. Conectar al servidor
```bash
ssh -p 2222 root@16.58.56.110
cd /app/mymemo
git pull origin main
```

### 3. Editar el script de migración con tus datos reales
```bash
nano deployment/migrate_to_auth.sql
# Reemplazar:
#   MARIO_EMAIL  → tu email real
#   BCRYPT_HASH  → el hash generado en el paso anterior
#   MARIO_NAME   → tu nombre (ej: 'Mario')
```

### 4. Ejecutar la migración de base de datos
```bash
docker cp deployment/migrate_to_auth.sql mymemo_db:/tmp/migrate_to_auth.sql
docker exec mymemo_db psql -U lifelogs_user -d lifelogs_db -f /tmp/migrate_to_auth.sql
```

Al final verás una tabla como:
```
      email       | name  | memories | people
------------------+-------+----------+--------
 mario@email.com  | Mario |       12 |      3
```
Si aparece con tus datos, la migración fue exitosa.

### 5. Asegurarse de que SECRET_KEY está seteada en .env.prod
```bash
grep SECRET_KEY .env.prod
# Si no está o es el default, generar una nueva:
python3 -c "import secrets; print('SECRET_KEY=' + secrets.token_hex(32))"
# Agregar al .env.prod
```

### 6. Rebuild + deploy
```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod build backend celery_worker frontend
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --no-deps backend celery_worker frontend
docker exec mymemo_redis redis-cli FLUSHDB
```

### 7. Verificar
```bash
docker compose -f docker-compose.prod.yml logs backend --tail=30
# Debe arrancar sin errores
```

Ir a `https://TU_DOMINIO` → debe aparecer la pantalla de login.
Iniciar sesión con tu email + contraseña → deben aparecer todos tus recuerdos existentes.

### 8. Probar face recognition (pendiente de sesiones anteriores)
```bash
docker compose -f docker-compose.prod.yml logs celery_worker --follow
# Abrir un recuerdo con caras → "Volver a detectar"
# Esperar logs: [face_service] Processing N face(s)...
```

---

## Qué tienen cada usuario

| Usuario | Datos |
|---|---|
| Mario (tú) | Todos los recuerdos y personas existentes migrados |
| Amigos nuevos | Perfil vacío, empiezan desde cero |

Los datos de cada usuario están completamente aislados — nadie puede ver los recuerdos de otro.

---

## Si algo sale mal

**Backend no arranca (error columna 'name' no existe):**
→ La migración no se ejecutó. Correr el SQL manualmente.

**"default user not found" en logs:**
→ El backend viejo todavía está corriendo. Forzar rebuild: `docker compose build --no-cache backend`

**Login retorna 401 con credenciales correctas:**
→ El hash en el SQL fue mal copiado. Regenerar y actualizar:
```sql
UPDATE users SET hashed_password = 'NUEVO_HASH' WHERE email = 'tu@email.com';
```


**Fecha:** March 5, 2026  
**Contexto:** Preparar la app para que amigos/conocidos la prueben. Cada persona con su propio perfil, recuerdos y caras aislados.

---

## Estado actual (buenas noticias)

El modelo de datos **ya es multi-usuario completo**:
- Tabla `users` existe con `id` (UUID), `email`, `hashed_password`
- `memories`, `people`, `usage_metrics` ya tienen FK `user_id → users`
- Todos los endpoints ya filtran por `user.id`
- `config.py` ya tiene `SECRET_KEY`, `ALGORITHM = "HS256"`, `ACCESS_TOKEN_EXPIRE_MINUTES = 30`

**Lo único que falta:** reemplazar `get_default_user()` (hardcoded a `default@lifelogs.local`) por una dependencia real `get_current_user()` que valide un JWT.

---

## Arquitectura de auth elegida: JWT + email/password

**¿Por qué no OAuth/Google?**  
Para una beta privada con amigos, email+contraseña es más rápido de implementar y no requiere configurar OAuth apps ni dominios verificados. Google OAuth puede agregarse después.

**¿Por qué JWT y no sesiones con cookie?**  
Ya está configurado JWT en el backend. La app es SPA + API separados, JWT es el patrón natural.

**¿Registro abierto o por invitación?**  
Registro abierto simple para facilitar la prueba. Si se quiere controlar el acceso, basta con un flag `is_active` en el user o una lista de emails permitidos.

---

## Plan de implementación — 2 sesiones

### Sesión A: Backend Auth (estimado ~3-4 horas de trabajo)

#### 1. Nueva dependencia: `python-jose` + `passlib[bcrypt]`
Ya puede estar instalada (revisar `pyproject.toml`). Si no:
```bash
pip install python-jose[cryptography] passlib[bcrypt]
```

#### 2. Nuevo archivo: `backend/core/security.py`
```python
# Funciones:
# - hash_password(plain) → hashed
# - verify_password(plain, hashed) → bool
# - create_access_token(data, expires_delta) → str
# - decode_token(token) → payload dict
```

#### 3. Nueva dependencia FastAPI: `backend/core/deps.py`
```python
async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> User:
    # Valida JWT → extrae user_id → busca en DB → retorna User
    # Lanza HTTP 401 si token inválido o expirado
```

#### 4. Nuevos endpoints: `backend/api/v1/endpoints/auth.py`
```
POST /api/v1/auth/register
    Body: { email, password, name? }
    → Valida email único → hashea password → crea User → retorna { access_token, token_type }

POST /api/v1/auth/login  
    Body: { email, password }  (OAuth2PasswordRequestForm compatible)
    → Verifica credentials → retorna { access_token, token_type }

GET /api/v1/auth/me
    Header: Authorization: Bearer <token>
    → Retorna { id, email, name, created_at }
```

#### 5. Modificar todos los endpoints existentes
Reemplazar en los 4 archivos de endpoints:
```python
# ANTES (en cada endpoint):
user = await get_default_user(db)

# DESPUÉS:
# Agregar a la firma del endpoint:
current_user: User = Depends(get_current_user)
# Y usar current_user en lugar de user
```

Archivos afectados:
- `backend/api/v1/endpoints/memories.py`
- `backend/api/v1/endpoints/people.py`
- `backend/api/v1/endpoints/search.py`
- `backend/api/v1/endpoints/usage.py`

#### 6. Registrar el nuevo router en `main.py`
```python
from api.v1.endpoints import auth
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
```

#### 7. DB: hacer email NOT NULL
Migración simple — actualizar el modelo `User`:
```python
email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
hashed_password: Mapped[str] = mapped_column(Text, nullable=False)
```
Como la DB en producción tiene un solo usuario `default@lifelogs.local`, se hace DROP + recrear o se agrega un script de migración simple.

---

### Sesión B: Frontend Auth (estimado ~3-4 horas de trabajo)

#### 1. Nuevo contexto: `frontend/src/contexts/AuthContext.jsx`
```jsx
// Estado: { user, token, isLoading, isAuthenticated }
// Acciones: login(email, password), register(email, password), logout()
// Token guardado en localStorage
// Al montar: leer token → llamar /auth/me → validar sesión
```

#### 2. Nuevas páginas
- `frontend/src/pages/Login.jsx` — form email+password → llama `authAPI.login()` → redirect a Home
- `frontend/src/pages/Register.jsx` — form email+password → llama `authAPI.register()` → auto-login → redirect a Home

#### 3. Componente protector: `frontend/src/components/ProtectedRoute.jsx`
```jsx
// Si !isAuthenticated → <Navigate to="/login" />
// Si isLoading → spinner
// Si autenticado → renderiza children
```

#### 4. Actualizar `frontend/src/services/api.js`
- Agregar `authAPI.login()`, `authAPI.register()`, `authAPI.me()`
- Agregar interceptor axios que inyecta `Authorization: Bearer <token>` en todas las requests
- Manejar 401 → redirect a login (limpiar token)

#### 5. Actualizar `frontend/src/App.jsx`
- Envolver `<App>` en `<AuthProvider>`
- Envolver rutas privadas en `<ProtectedRoute>`
- Agregar rutas `/login` y `/register` (públicas)

#### 6. Actualizar `Header.jsx`
- Mostrar nombre/email del usuario logueado
- Botón "Cerrar sesión" → `authContext.logout()` → redirect a `/login`

---

## Diagrama de flujo auth

```
Usuario abre app
    ↓
¿Tiene token en localStorage?
    ├── NO → redirect /login
    └── SÍ → GET /auth/me con token
              ├── 401 (expirado) → limpiar token → /login
              └── 200 → setUser → mostrar app

POST /auth/login
    ↓ 200: { access_token: "eyJ..." }
    ↓ guardar en localStorage
    ↓ redirect /home

Todas las requests API:
    headers: { Authorization: "Bearer eyJ..." }
    ← 401 → logout() automático
```

---

## Orden de implementación recomendado

```
1. security.py (hash + JWT utils)          ← base de todo
2. deps.py (get_current_user)              ← dependencia FastAPI
3. auth.py endpoints (register + login)    ← probar en Swagger
4. Modificar los 4 endpoint files          ← reemplazar get_default_user
5. main.py: registrar router               ← activar
6. Test manual en Swagger /docs            ← verificar antes de tocar frontend
─────────────────────────────────────────
7. AuthContext.jsx                         ← estado global
8. api.js: interceptor + authAPI           ← comunicación
9. Login.jsx + Register.jsx                ← páginas
10. ProtectedRoute.jsx                     ← guardia
11. App.jsx: rutas + AuthProvider          ← conectar todo
12. Header.jsx: usuario + logout           ← UX completa
```

---

## Consideraciones de seguridad

| Item | Decisión |
|---|---|
| Almacenamiento del token | `localStorage` — simple para MVP. Para producción futura: `httpOnly cookie` |
| Expiración del token | 30 minutos (ya configurado). Agregar refresh token después |
| Contraseñas | `bcrypt` con factor de coste por defecto (12 rounds) |
| CORS | Ya configurado, solo orígenes permitidos |
| Rate limiting en `/login` | No para MVP; agregar si se abre al público |
| Emails únicos | Constraint `unique=True` en el modelo ya existe |

---

## Migración de datos de producción

El servidor tiene un usuario `default@lifelogs.local` con recuerdos reales.

**Plan:**
1. Hacer backup: `docker exec mymemo_db pg_dump ... > backup_antes_auth.sql`
2. Crear el primer usuario "real" con email de Mario via script o endpoint
3. Reasignar `user_id` de todos los recuerdos/personas existentes al nuevo UUID
4. Eliminar el usuario `default@lifelogs.local`

Script de migración (ejecutar una sola vez):
```sql
-- 1. Crear usuario Mario (contraseña hasheada con bcrypt)
INSERT INTO users (id, email, hashed_password, created_at)
VALUES (gen_random_uuid(), 'mario@email.com', '<bcrypt_hash>', NOW());

-- 2. Reasignar todos los recuerdos
UPDATE memories SET user_id = (SELECT id FROM users WHERE email='mario@email.com')
WHERE user_id = (SELECT id FROM users WHERE email='default@lifelogs.local');

-- 3. Reasignar personas
UPDATE people SET user_id = (SELECT id FROM users WHERE email='mario@email.com')
WHERE user_id = (SELECT id FROM users WHERE email='default@lifelogs.local');

-- 4. Eliminar usuario temporal
DELETE FROM users WHERE email='default@lifelogs.local';
```

---

## Lo que NO hay que hacer todavía

- ❌ Email verification (agrega fricción para amigos)
- ❌ "Forgot password" flow (se puede hacer a mano por ahora)
- ❌ Google OAuth (para después)
- ❌ Roles/permissions (todos los usuarios tienen los mismos permisos)
- ❌ Admin panel (no necesario para beta privada)
- ❌ Refresh tokens (30 min es suficiente para probar; re-login no molesta)

---

## Próximos pasos tras el auth

Una vez que amigos puedan registrarse y subir sus propios recuerdos:
1. Verificar que face recognition funciona (el rebuild pendiente)
2. Quizás: perfil de usuario (nombre, foto)
3. Quizás: compartir un recuerdo con otro usuario (link público)
