# MyMemo - Historial Tecnico Consolidado (Feb-Mar 2026)

## 1. Alcance implementado

Producto construido: PWA de memorias con foto, texto, ubicacion y enriquecimiento IA.

Stack implementado en codigo:
- Frontend: React + Vite + Tailwind + Leaflet
- Backend: FastAPI + Celery + Redis
- Datos: PostgreSQL + PostGIS + pgvector + JSONB
- Media: AWS S3 (imagenes + thumbnails)
- IA: OpenAI gpt-4o-mini (NLP) + face_recognition/dlib (caras)
- Infra: Docker Compose + AWS Lightsail + Nginx + SSL

## 2. Fase de arquitectura y base (febrero)

Hechos cerrados:
- Definicion de arquitectura completa.
- Definicion de esquema de base de datos (memories, people, memory_people, processing_jobs, usage_metrics, memory_versions).
- Inicializacion de entorno local con Docker Compose.
- Integracion de extensiones DB (PostGIS, pgvector, pg_trgm, uuid-ossp).

## 3. Backend construido (febrero)

Implementado:
- Endpoints de memories, people, search y usage.
- Carga de imagenes a S3 + generacion de thumbnails.
- Procesamiento asincrono con Celery para NLP y reconocimiento facial.
- Registro de costos de IA por uso.
- Documentacion API en OpenAPI/Swagger.

Hechos tecnicos relevantes:
- Resolucion de conflictos async/sync entre FastAPI y Celery con engine/sesiones separadas.
- Refactor a capa services para separar logica de negocio de la infraestructura.
- Wrappers thin para Celery y handlers preparados para Lambda.
- Correccion de race condition en JSONB para que convivan resultados de NLP y Faces.
- Correccion de serializacion numpy -> tipos Python nativos para escritura en DB.

## 4. Frontend MVP y despliegue (febrero)

Implementado:
- Home con mapa y memorias.
- CreateMemory con captura de foto, texto y ubicacion.
- MemoryDetail con datos reales de API.
- Gestion de personas (rename y merge).
- Timeline funcional.
- PWA instalable.

Produccion:
- Deploy en Lightsail con dominio y HTTPS.
- Flujo operativo de backend, db, redis, celery, nginx y certbot.

## 5. Fase 2 UX/bugs (finales de febrero - marzo)

Hechos cerrados documentados:
- Conexiones frontend->API corregidas en produccion (sin localhost hardcodeado).
- Fix de colisiones al renombrar personas con merge controlado.
- Fix de coordenadas manuales en CreateMemory.
- Fix de URLs de fotos expirada con URLs firmadas frescas.
- Fix de estados de jobs IA visibles en detalle con polling.
- Fix de confirmacion de borrado en UI.
- Fix de fallback visual de rostros (crop bbox -> thumbnail -> silueta).
- Fix de crash de Home por estado obsoleto filtersExpanded.
- Fix de FAB oculto por z-index sobre Leaflet.
- Fix de banner IA para no mostrar historico de errores como activo.
- Fix para leer nombres de personas desde BD (no desde JSON congelado).
- Fix de MultipleResultsFound en Celery usando seleccion explicita de job activo.

## 6. Rediseño de navegacion y mapa (marzo)

Implementado en fases A/B/C:
- Bottom tab bar de 5 tabs integrada en layout global.
- Header simplificado.
- Correccion de carga historica completa de memorias (page/page_size real).
- Clustering geoespacial por distancia con ajuste dinamico por zoom.
- Modal de cluster con vista tipo timeline por dia.

Implementado en fases D/E/F (estado en session_temp):
- Onboarding inicial + tutorial contextual de primer recuerdo.
- Persistencia de estado de onboarding por usuario.
- Flujo de persona principal en primer login (nombre + foto).
- Endpoints de apoyo para self_person.
- Decision de Places API para busqueda de lugares.

## 7. Entregables adicionales construidos

- Pantalla People completa con acciones inline y drill-down de memorias por persona.
- Edicion de memorias (descripcion, ubicacion, categorias).
- Busqueda geoespacial desde UI.
- Dashboard admin en Streamlit para metricas/costos.
- MyMemo Wrapped implementado (9 pantallas) con varias rondas de fixes mobile/datos/layout.

## 8. Infraestructura operativa en servidor

Hechos cerrados:
- Migracion y estabilizacion en instancia nueva tras incidentes de SSH/snapshot/firewall.
- Swap de 2GB para builds de dlib.
- Puerto SSH 2222 operativo.
- Procedimientos de deploy, rebuild y logs documentados.

## 9. Estado factual al cierre de marzo

- Producto en produccion con uso real.
- Backend funcional con pipeline IA integrado.
- Frontend operativo con rediseño implementado y mejoras continuas.
- Documentacion tecnica extensa en tracker, arquitectura, session logs e infraestructura.
