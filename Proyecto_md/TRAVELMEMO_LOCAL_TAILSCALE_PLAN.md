# TravelMemo - Plan de prueba local + SSH con Tailscale

## Objetivo

Cerrar validacion local de TravelMemo (Stage C) antes de desplegar al servidor.

## Parte 1: Prueba local completa

### Backend
1. Activar entorno virtual en backend.
2. Correr API local con FastAPI.
3. Verificar endpoints Travel:
   - `GET /api/v1/travel/feed`
   - `GET /api/v1/travel/map`
   - `GET /api/v1/travel/profile`
   - `GET /api/v1/travel/places/{place_id}`

### Frontend
1. Levantar frontend Vite en local.
2. Probar flujo Stage C:
   - Feed muestra `context_badge`.
   - Mapa muestra popup contextual y abre detalle.
   - PlaceDetail muestra `visit_context` + conteo de visitas.
   - Perfil muestra resumen y lista de memorias.

### Checklist funcional
- Compartir memoria desde detalle privado.
- Ver memoria en feed Travel.
- Guardar lugar.
- Abrir detalle desde feed y mapa.
- Ver tab Perfil con datos reales.

## Parte 2: SSH por Tailscale

### En servidor
1. Instalar Tailscale.
2. Autenticar nodo.
3. Verificar IP Tailscale (`100.x.y.z`).
4. Confirmar que SSH del sistema esta activo.
5. (Opcional) habilitar `tailscale up --ssh`.

### En laptop local
1. Instalar Tailscale e iniciar sesion en la misma tailnet.
2. Probar conectividad al servidor:
   - `tailscale ping <nombre-o-ip-tailscale>`
3. Probar SSH:
   - `ssh usuario@<nombre-o-ip-tailscale>`

## Parte 3: Despliegue controlado (despues de validar local)

1. Ejecutar migracion `deployment/travel_migration.sql` en servidor.
2. Reiniciar backend y workers Celery.
3. Probar endpoints Travel en servidor.
4. Hacer smoke test UI rapido.

## Criterio de salida

TravelMemo Stage C pasa validacion local completa y queda listo para despliegue por SSH seguro via Tailscale.
