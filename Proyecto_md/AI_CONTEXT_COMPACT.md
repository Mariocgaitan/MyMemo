# MyMemo - Contexto Compacto (Hechos Ejecutados)

## 1. Producto implementado

PWA para registrar memorias con foto, descripcion y ubicacion, con enriquecimiento IA.

Funcionalidades implementadas:
- captura y guardado de recuerdos
- mapa interactivo
- timeline
- busqueda por texto/tags/fechas/ubicacion
- gestion de personas detectadas en fotos

## 2. Arquitectura implementada

Frontend:
- React + Vite + Tailwind
- Leaflet
- PWA

Backend:
- FastAPI
- Celery + Redis
- services layer para logica reusable

Datos y storage:
- PostgreSQL + PostGIS + pgvector + JSONB
- AWS S3 para imagenes y thumbnails

IA:
- NLP con OpenAI gpt-4o-mini
- reconocimiento facial con face_recognition/dlib

Infra:
- Docker Compose
- produccion en AWS Lightsail
- Nginx + SSL

## 3. Flujo tecnico que existe en codigo

Create memory:
1. POST de memoria con imagen/texto/ubicacion.
2. Persistencia en DB y S3.
3. Creacion de jobs `nlp_extraction` y `face_recognition`.
4. Actualizacion de metadata y relaciones persona-memoria.

Consulta:
1. listado paginado de memorias.
2. filtros por busqueda y geolocalizacion.
3. visualizacion por mapa y timeline.

People:
1. listado de personas detectadas.
2. rename y merge.
3. eliminar relacion persona-memoria.
4. rerun de deteccion facial por memoria.

## 4. Hitos cerrados (feb-mar 2026)

- API backend construida y operativa en produccion.
- S3 integrado con thumbnails y URLs firmadas.
- Pipeline Celery para NLP + faces funcionando.
- Refactor serverless-ready (services + wrappers + handlers lambda).
- Despliegue completo en Lightsail con HTTPS.
- Rediseño frontend con bottom tabs y header simplificado.
- Fix de paginacion historica en Home/Timeline (page/page_size).
- Cluster geoespacial dinamico por zoom.
- Onboarding inicial y tutorial de primer recuerdo.
- Flujo de persona principal en primer login.
- Feature Wrapped (9 pantallas) implementada y ajustada para mobile.

## 5. Correcciones tecnicas relevantes ya aplicadas

- race conditions en JSONB al escribir resultados IA.
- conversion de tipos numpy para persistencia SQL.
- lectura de nombres de personas desde BD en vez de snapshot JSON.
- seleccion de job activo para evitar conflictos en Celery.
- correcciones de z-index, estados de carga y fallbacks visuales en frontend.
- correcciones de cache PWA y de comportamiento de assets.

## 6. Estado factual actual

- Sistema desplegado y funcional.
- Frontend y backend en evolucion continua con foco en estabilidad y UX.
- Documentacion principal en tracker + session logs + arquitectura + infra.
