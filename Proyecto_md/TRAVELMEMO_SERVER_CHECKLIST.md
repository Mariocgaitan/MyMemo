# TravelMemo - Server Checklist

## 1. Subir la rama

Desde tu maquina local:

```bash
git add .
git commit -m "feat: stage A foundation for TravelMemo"
git push -u origin TravelMemo
```

## 2. Entrar al servidor

```bash
ssh -p 2222 root@TU_HOST
```

## 3. Traer la rama al servidor

```bash
cd /app/mymemo
git fetch origin
git checkout TravelMemo || git checkout -b TravelMemo origin/TravelMemo
git pull origin TravelMemo
```

## 4. Ejecutar la migracion

```bash
docker cp deployment/travel_migration.sql mymemo_db:/tmp/travel_migration.sql
docker exec mymemo_db psql -U lifelogs_user -d lifelogs_db -f /tmp/travel_migration.sql
```

## 5. Verificar schema

```bash
docker exec mymemo_db psql -U lifelogs_user -d lifelogs_db -c "\dt public_memories"
docker exec mymemo_db psql -U lifelogs_user -d lifelogs_db -c "\dt places_catalog"
docker exec mymemo_db psql -U lifelogs_user -d lifelogs_db -c "\dt recommendation_events"
docker exec mymemo_db psql -U lifelogs_user -d lifelogs_db -c "\dt user_travel_preferences"
docker exec mymemo_db psql -U lifelogs_user -d lifelogs_db -c "\dt saved_places"
docker exec mymemo_db psql -U lifelogs_user -d lifelogs_db -c "\d memories"
```

Verificar en `memories`:
- existe columna `travel_shared`

## 6. Reiniciar servicios

```bash
docker compose -f docker-compose.prod.yml restart backend celery_worker
```

## 7. Revisar logs

```bash
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f celery_worker
```

## 8. Compilacion rapida dentro del backend

```bash
docker exec mymemo_backend python -m py_compile \
  /app/api/v1/endpoints/travel.py \
  /app/models/travel_models.py \
  /app/models/travel_schemas.py \
  /app/services/moderation_service.py \
  /app/tasks/travel_moderation.py
```

## 9. Validacion funcional

Probar en la app:

1. Abrir un recuerdo.
2. Pulsar `Compartir en TravelMemo`.
3. Confirmar que aparece el preview modal.
4. Confirmar que la memoria entra en moderacion.
5. Abrir la pestaña `MyTravelMemo`.
6. Confirmar que aparece en tu lista publica.
7. Probar `Despublicar`.
8. Probar reportar una memoria publica.

## 10. SQL de validacion rapida

```bash
docker exec mymemo_db psql -U lifelogs_user -d lifelogs_db -c "SELECT id, source_memory_id, place_name, visibility_status, moderation_status, created_at FROM public_memories ORDER BY created_at DESC LIMIT 10;"
docker exec mymemo_db psql -U lifelogs_user -d lifelogs_db -c "SELECT id, location_name, travel_shared, created_at FROM memories ORDER BY created_at DESC LIMIT 10;"
```

## 11. Archivos clave de esta entrega

- `deployment/travel_migration.sql`
- `backend/api/v1/endpoints/travel.py`
- `backend/models/travel_models.py`
- `backend/models/travel_schemas.py`
- `backend/services/moderation_service.py`
- `backend/tasks/travel_moderation.py`
- `frontend/src/pages/TravelMemo.jsx`
- `frontend/src/components/travel/ShareModal.jsx`

## Nota

La base de datos de TravelMemo no se migra localmente. Todo este flujo esta pensado para ejecutarse en el servidor por SSH.