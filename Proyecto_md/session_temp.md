# Session 19: Estrategia de Rediseño Frontend + Mapa

Fecha: 2026-03-19
Estado: Planeacion (sin codificar aun)

---

## 1) Objetivo de la sesion

Definir una estrategia optima, por fases, para implementar estos cambios de producto:

1. Rediseño general estilo app social (barra inferior con 5 tabs).
2. Simplificar header (sin menu de 3 puntos; dejar reiniciar cache, modo y salida).
3. Mapa con clustering por radio de 500 m y vista tipo timeline al abrir cluster.
4. Corregir desaparicion de recuerdos antiguos en mapa.
5. Instrucciones iniciales para onboarding de uso de componentes principales.
6. Definir usuario principal en primer login (cara + nombre).
7. Evaluar reemplazo/mejora de buscador de mapa (Google Maps / Waze / Uber-like place search).

---

## 2) Principios de implementacion

1. No romper flujos existentes: crear recuerdo, timeline, personas, mapa, generador.
2. Entregar por verticales pequenas y desplegables.
3. Siempre dejar feature flags simples para desactivar funcionalidades nuevas si hay regresion.
4. Medir impacto en UX/performance antes de pasar a la siguiente fase.

---

## 3) Arquitectura funcional objetivo (frontend)

### Navegacion principal (Bottom Tab Bar)

Tabs (con iconos, sin texto visible por defecto):

1. Mapa (pantalla principal por defecto)
2. Linea del tiempo
3. Agregar recuerdo (accion central destacada)
4. Buscar recuerdo
5. Personas

Reglas:

1. Mantener rutas existentes para compatibilidad.
2. Integrar la barra en el layout global, no por pagina.
3. Header simplificado: solo reiniciar cache, modo y logout.

---

## 4) Estrategia por fases (orden recomendado)

## Fase A - Base de navegacion y layout (prioridad maxima)

Objetivo: mover la app al nuevo modelo visual sin alterar logica de negocio.

Entregables:

1. Bottom tab bar funcional con las 5 rutas.
2. Mapa como home principal.
3. Header limpio sin menu de 3 puntos.

Riesgos:

1. Superposicion de barra sobre mapa o FAB.
2. Safe areas en mobile (iOS notch / bottom inset).

Mitigacion:

1. Reservar padding inferior global.
2. Ajustar z-index y hit areas.

---

## Fase B - Mapa estable y completo (antes del cluster nuevo)

Objetivo: resolver bug de recuerdos antiguos que desaparecen.

Entregables:

1. Auditoria de filtros activos por defecto (fecha, people, limites).
2. Garantizar que mapa carga todo lo que corresponde (sin recortes por antiguedad no deseados).
3. Tests/manual checks con recuerdos recientes y antiguos.

Riesgos:

1. El problema puede venir de frontend, backend o ambos.
2. Cargar todo sin paginacion puede afectar performance.

Mitigacion:

1. Verificar endpoint y params reales.
2. Si hace falta, usar paginacion incremental pero sin ocultar historicos.

---

## Fase C - Cluster geoespacial 500 m + vista de grupo tipo timeline

Objetivo: mejorar legibilidad del mapa en zonas densas.

Definicion funcional:

1. Todo recuerdo dentro de un radio de 500 m cae en un cluster visual.
2. Al tocar cluster: abrir vista panel/pestana tipo timeline solo con recuerdos de ese cluster.

Estrategia tecnica recomendada:

1. Clustering por distancia geodesica (no solo grid de zoom) con umbral configurable.
2. Calculo en frontend para MVP rapido.
3. Opcional futura: precluster en backend para datasets mas grandes.

Decision confirmada: **Clustering dinamico por zoom**

- A zoom 50% (alejado): 500 m visualmenpte grandes => clusters cerrados.
- A zoom 100%+ (acercado): 500 m visualmente pequenos => clusters se separan mas.
- Calculo: distancia geodesica constante (500 m reales), pero visualizacion se adapta segun zoom del mapa.
- Cuando usuario hace zoom in/out, clusters se reagrupan dinamicamente en tiempo real.

Razon: intuitivo, el usuario ve como se desagrupan al acercarse.

---

## Fase D - Onboarding guiado

Objetivo: que nuevos usuarios entiendan los 5 componentes clave sin friccion.

### Alcance MVP (cerrado)

1. Tutorial inicial de navegacion (primera sesion).
2. Tutorial contextual del primer recuerdo (la primera vez que entra a crear recuerdo).
3. Boton "Ver tutorial de nuevo" desde ajustes/perfil.

### Tutorial 1: Inicial (navegacion global)

Objetivo: orientar en tabs y flujo general de app.

Paso 1 - Bienvenida
Titulo: "Bienvenido a MyMemo"
Texto: "Te mostramos rapidamente como moverte por la app."
CTA primario: "Empezar"
CTA secundario: "Saltar"

Paso 2 - Mapa
Titulo: "Tu vista principal"
Texto: "Aqui ves tus recuerdos por zona. Al acercar el mapa, los grupos se separan."
CTA: "Siguiente"

Paso 3 - Linea del tiempo
Titulo: "Recuerdos por fecha"
Texto: "Aqui revisas tu historial y abres cualquier recuerdo para ver detalle."
CTA: "Siguiente"

Paso 4 - Buscar
Titulo: "Busqueda rapida"
Texto: "Encuentra recuerdos por texto, lugar, tags o personas."
CTA: "Siguiente"

Paso 5 - Personas
Titulo: "Tu red de personas"
Texto: "Gestiona nombres, entrena rostros y mejora la precision de reconocimiento."
CTA primario: "Terminar"
CTA secundario: "Saltar"

### Tutorial 2: Primer recuerdo (contextual en CreateMemory)

Objetivo: guiar exactamente como crear un buen recuerdo y etiquetar personas.

Disparador:
1. Primera entrada a Crear Recuerdo (`first_memory_tutorial_completed = false`).

Paso A - Foto y fecha
Titulo: "Empieza con foto y fecha"
Texto: "Sube una foto clara. Si vienes de galeria inteligente, la fecha puede llegar precargada."

Paso B - Descripcion
Titulo: "Cuenta que paso"
Texto: "Escribe una descripcion corta y util. Esto mejora la busqueda futura."

Paso C - Categorias (aclaracion fuerte)
Titulo: "Categorias = organizacion personal"
Texto: "Las categorias son tuyas y te ayudan a filtrar rapido (ejemplo: Viaje, Trabajo, Familia). Puedes usar varias en un mismo recuerdo."

Paso D - Personas (aclaracion fuerte)
Titulo: "Personas = quienes aparecen o participaron"
Texto: "Agrega nombres de quienes estaban contigo. Esto ayuda a vincular recuerdos por persona y mejorar sugerencias."

Paso E - Asociacion con amistades (aclaracion fuerte)
Titulo: "Como funciona con amistades"
Texto: "Si tienes una amistad conectada, MyMemo puede relacionar personas equivalentes entre cuentas para compartir y filtrar recuerdos de forma consistente."

Paso F - Guardar y continuar
Titulo: "Listo para guardar"
Texto: "Guarda el recuerdo. Despues podras editar descripcion, categorias y personas cuando quieras."
CTA primario: "Entendido"
CTA secundario: "No mostrar otra vez"

### Flujo UX (como se mostrara)

1. Overlay semitransparente con blur suave.
2. Spotlight (recorte) sobre el elemento objetivo del paso.
3. Tarjeta flotante inferior en mobile / lateral en desktop.
4. Progreso visible: "Paso X de N" + barra fina.
5. Navegacion: Anterior, Siguiente, Saltar.
6. Al cambiar de paso, si el elemento no esta visible, autoscroll o autonav a la vista correspondiente.

### Diseño visual (propuesta)

1. Estilo limpio, minimalista, sin emojis.
2. Iconografia Lucide consistente con la tab bar.
3. Tarjeta con bordes redondeados (16-20px), sombra media, contraste AA.
4. Microanimaciones cortas (200-250ms): fade + slide.
5. Color de acento igual al primario de marca para CTAs y progreso.

### Reglas de comportamiento

1. Tutorial inicial aparece solo si `onboarding_completed = false`.
2. Tutorial primer recuerdo aparece solo si `first_memory_tutorial_completed = false`.
3. Si usuario toca "Saltar", marcar solo el tutorial actual como completado.
4. Si hay cambio de layout (mobile/desktop), recalcular anclas al redimensionar.

### Persistencia

1. Guardar bandera por usuario: `onboarding_completed`.
2. Guardar bandera por usuario: `first_memory_tutorial_completed`.
3. Guardar timestamp opcional: `onboarding_completed_at`.
4. Guardar version opcional: `onboarding_version` para relanzar tour si cambia UX mayor.

### Criterio de "Done" Fase D

1. Tutorial inicial se ejecuta en primer login y no reaparece despues de completar.
2. Tutorial de primer recuerdo se ejecuta solo al entrar por primera vez a Crear Recuerdo.
3. Explicaciones de categorias, personas y amistades quedan claras y accionables.
4. Boton "Ver tutorial de nuevo" funcional para ambos tutoriales.
5. Funciona en mobile y desktop sin bloquear interacciones criticas.

Estado actual:
1. Implementado en frontend con `TourOverlay` reutilizable.
2. Tutorial inicial conectado al Layout + tabs.
3. Tutorial de primer recuerdo conectado a CreateMemory.
4. Boton de ayuda en header para relanzar tutorial.
5. Persistencia temporal en localStorage por usuario (`mymemo:onboarding:*`).

---

## Fase E - Usuario principal en primer login (cara + nombre)

Objetivo: dejar definido el owner facial para mejorar reconocimiento y UX.

Flujo propuesto:

1. Primer login detectado.
2. Modal obligatorio: nombre + foto frontal.
3. Validacion de una sola cara.
4. Guardar como "principal" y registrar embedding inicial.

Dependencias:

1. Reusar flujo de entrenamiento facial ya existente.
2. Definir flag backend: primary_person_id por usuario.

---

## Fase F - Buscador de mapa mejorado (research + implementacion)

Objetivo: mejorar calidad de lugares y POIs.

Decision confirmada: **Google Places API**

1. Alta calidad, cobertura global, autocompletado robusto.
2. Costo estimado: minimo para MVP (primeros 1000 searches gratis/mes).
3. Integracion directa con Google Maps que ya usamos en frontend Leaflet.

Nota sobre Waze/Uber:

1. No existe API publica general de busqueda de lugares.
2. Google es la opcion mas realista y confiable.

---

## 5) Orden final sugerido de ejecucion

1. Fase A (navegacion + layout)
2. Fase B (bug recuerdos antiguos en mapa)
3. Fase C (cluster 500 m + timeline de cluster)
4. Fase D (onboarding)
5. Fase E (usuario principal)
6. Fase F (buscador externo de lugares)

Razon:

1. Primero estructura visual base.
2. Luego estabilidad del mapa (base de todo).
3. Despues feature geoespacial avanzada.
4. Al final flows de activacion y mejoras de proveedor externo.

---

## 6) Definicion de listo por fase

Cada fase se considera "Done" cuando cumple:

1. QA mobile + desktop sin regresiones visibles.
2. Sin errores en consola ni warnings criticos.
3. Flujo principal documentado en changelog corto.
4. Deployable sin tocar infraestructura fuera de lo necesario.

---

## 7) Decisiones cerradas

✅ Clustering: **Dinamico por zoom** (500 m geodesicos reales, ajuste visual segun zoom del mapa).
✅ Buscador mapa: **Google Places API**.
✅ Bottom tab bar labels: **Solo icono siempre, label visible en navegacion del header al cambiar de tab (no en la barra misma)**.

---

## 8) Aclaracion: Bottom Tab Bar labels

Estructura visual objetivo:

```
┌─────────────────────────────────┐
│  [<] Mapa      [Header limpio] │  <- titulo de la seccion actual
└─────────────────────────────────┘
│                                   │
│      [Contenido de la tab]        │
│                                   │
└─────────────────────────────────┘
│ [◉] [═] [✚] [⊙] [◈]          │  <- bottom bar, solo iconos (Lucide)
└─────────────────────────────────┘
```

Iconos (de Lucide) representan:
1. ◉ (Map) → Mapa
2. ═ (Clock / Timeline) → Linea del tiempo
3. ✚ (Plus, central y mas grande) → Agregar recuerdo
4. ⊙ (Search) → Buscar recuerdo
5. ◈ (Users) → Personas

El nombre/label se muestra en el header de cada seccion, no en la barra para mantener limpieza visual.

---

## 9) Proximos pasos: Arrancar Fase A

✅ **FASE A COMPLETADA** (commit `df6cc35`)

Implementado:
1. ✅ BottomTabBar.jsx con 5 rutas y navegación fluida.
2. ✅ Header simplificado (solo refresh cache, modo, logout).
3. ✅ Layout refactorizado con BottomTabBar integrado.
4. ✅ Ruta /search con página SearchMemory básica.
5. ✅ Timeline ahora usa Layout (recupera BottomTabBar).
6. ✅ Padding inferior (pb-20) para que contenido no choque con barra.

✅ **FASE B COMPLETADA** (pendiente commit local de esta fase)

Hallazgo raiz:
1. Frontend pedia `/memories` con `limit/skip`, pero backend usa `page/page_size`.
2. Resultado real: solo llegaba la primera pagina (20 recuerdos), ocultando historicos en mapa y timeline.

Fix aplicado:
1. `memoryAPI.getAllPages()` agregado con paginacion real por `page/page_size` y `has_more`.
2. Home ahora carga historial completo con `getAllPages({ pageSize: 100 })`.
3. Timeline ahora carga historial completo con `getAllPages({ pageSize: 100 })`.

✅ **FASE C IMPLEMENTADA** (pendiente commit local de esta fase)

Implementado:
1. Clustering geoespacial en frontend por distancia real (haversine) con radio dinamico por zoom.
2. Radio base 500m y ajuste automatico al hacer zoom (se separan/agrupan dinamicamente).
3. Click en cluster abre modal con recuerdos de ese cluster.
4. Modal de cluster en formato timeline por dia (secciones con tarjetas horizontales).

Siguiente: **Fase D - Onboarding guiado**
