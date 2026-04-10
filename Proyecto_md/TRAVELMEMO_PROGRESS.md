# TravelMemo - Progress Log

## Estado actual

TravelMemo ya tiene base funcional en estrategia, backend y frontend.

## Cerrado hasta ahora

### Estrategia
- Scope definido: V1 fuerte, no MVP debil.
- Monetizacion diferida por completo.
- Reglas de moderacion cerradas.
- Recency decay definido como suave.
- Apelaciones definidas como manuales por admin en MVP.
- Corte Must-have V1 vs Post-V1 documentado.

### Stage A implementado
- Nuevos modelos SQLAlchemy para TravelMemo.
- Migracion SQL creada para servidor.
- Endpoints base:
  - share
  - unshare
  - my public memories
  - place detail
  - report
- Moderation service y Celery task creados.
- Campo `travel_shared` agregado a memories.
- Toggle de compartir integrado en MemoryDetail.
- Preview modal de privacidad implementado.
- Pagina inicial de TravelMemo integrada en rutas y tab inferior.

### Stage B implementado
- Feed personalizado backend.
- Map clusters backend.
- Preferencias de usuario backend.
- Eventos backend.
- Save / unsave / saved places backend.
- TravelContext frontend.
- Cold start flow frontend.
- Feed UI frontend.
- Map UI frontend.
- Saved places UI frontend.
- Explicacion de ranking tipo `why_this` agregada al feed.
- Detalle de lugar en frontend preparado.

### Stage C implementado (funcional)
- Endpoint de perfil Travel agregado.
- Context badges agregados en backend para feed, mapa y detalle.
- Place detail enriquecido con `user_visit_count` y `visit_context`.
- Pestaña de perfil Travel agregada en frontend.
- Badge de contexto visible en feed y detalle.
- Banner `ya has estado aqui` mejorado con numero de visitas.
- Mapa usa preview contextual y abre detalle con `public_memory_id` para tracking.

## Archivos clave creados

### Backend
- `backend/api/v1/endpoints/travel.py`
- `backend/models/travel_models.py`
- `backend/models/travel_schemas.py`
- `backend/services/moderation_service.py`
- `backend/services/travel_service.py`
- `backend/tasks/travel_moderation.py`
- `backend/tasks/travel_maintenance.py`
- `deployment/travel_migration.sql`

### Frontend
- `frontend/src/pages/TravelMemo.jsx`
- `frontend/src/contexts/TravelContext.jsx`
- `frontend/src/components/travel/ShareModal.jsx`
- `frontend/src/components/travel/ColdStartFlow.jsx`
- `frontend/src/components/travel/DiscoverFeed.jsx`
- `frontend/src/components/travel/MapExplore.jsx`
- `frontend/src/components/travel/PlaceChips.jsx`
- `frontend/src/components/travel/SavedPlaces.jsx`
- `frontend/src/components/travel/PlaceDetail.jsx`

### Documentacion
- `Proyecto_md/MYTRAVELMEMO_STRATEGY.md`
- `Proyecto_md/MYTRAVELMEMO_CODING_PLAN.md`
- `Proyecto_md/TRAVELMEMO_SERVER_CHECKLIST.md`
- `Proyecto_md/TRAVELMEMO_PROGRESS.md`

## Pendiente inmediato

### Stage C
- Validacion manual end-to-end en local pendiente.

### Stage D pilares implementados
- `PlacePromotion` SQLAlchemy model.
- `boost_weight` column en `PlaceCatalog` (model + DB).
- `is_featured` en `PublicMemoryCard` (siempre False hasta activar).
- `PromotionCard` y `PromotionsResponse` schemas.
- Quality gate `_promotion_quality_gate` (minimo 5 memorias organicas).
- Hook de boost en `_score_place` (lee `place.boost_weight`, default 0.0).
- `_get_active_promotion_boost` helper para uso futuro.
- Redis cache de primera pagina de feed (TTL 5 min).
- Endpoint stub `GET /travel/promotions` retorna `{"items": [], "coming_soon": true}`.
- Migracion SQL `deployment/stage_d_promotion_migration.sql`.
- Frontend `PromotionsSection.jsx` (placeholder "Proximamente").
- Tab Promociones en `TravelMemo.jsx`.

## Pendiente (Post-V1 / monetizacion diferida)
- Portal de negocios y onboarding de sponsors.
- UI de gestion de campanas.
- Job de activacion que escribe `boost_weight` en `places_catalog`.
- Analytics de campanas.

## Nota operativa - migraciones pendientes en servidor SSH
1. `deployment/travel_migration.sql` (Stage A/B/C base)
2. `deployment/stage_d_promotion_migration.sql` (Stage D pilares)
