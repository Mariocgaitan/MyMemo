# Mejoras MyMemo - Branch fixes_mymemo_bugs

## Regla de documentacion

Desde este punto, todas las mejoras se registran en este unico documento.

---

## Mejora 001 - Flujo post-upload sin modal intermedio de caras

### Objetivo
Eliminar el modal de caras reconocidas al terminar la creacion de un recuerdo para reducir friccion.

### Cambios aplicados
- Se retiro el flujo de `FaceTagModal` al finalizar upload.
- Despues de crear el recuerdo, ahora hay navegacion directa a `MemoryDetail` (`/memory/:id`).

### Impacto UX
- Menos pasos.
- El usuario ve en una sola vista descripcion, categorias y caras/personas.

### Archivos modificados
- `frontend/src/pages/CreateMemory.jsx`

---

## Mejora 002 - Rename global de persona + agregar persona manual en detalle

### Objetivo
1. Que el rename de persona sea consistente en toda la app.
2. Permitir agregar persona manual en un recuerdo aunque no haya cara detectada.

### Cambios aplicados

#### Backend
- Se agrego parche global de nombre para `ai_metadata.faces.person_name` en recuerdos relacionados.
- Se agrego endpoint para vincular/crear persona manual en un recuerdo:
  - `POST /api/v1/memories/{memory_id}/people` con body `{ "name": "..." }`.
- Se agrego schema request para ese endpoint.

#### Frontend
- Se agrego `memoryAPI.addPerson(memoryId, name)`.
- En `MemoryDetail`, se agrego UI para capturar nombre y agregar persona manual.
- Tras rename, se fuerza refresh adicional de nombres para reflejo inmediato.

### Impacto UX
- Rename mas confiable y visible de inmediato.
- Soporte a casos donde la IA no detecta rostro pero el usuario necesita vincular persona para filtros/share.

### Archivos modificados
- `backend/api/v1/endpoints/people.py`
- `backend/api/v1/endpoints/memories.py`
- `backend/models/schemas.py`
- `frontend/src/services/api.js`
- `frontend/src/pages/MemoryDetail.jsx`

---

## Mejora 003 - Personas con menu de 3 puntos

### Contexto
Actualmente las acciones de cada persona (renombrar, eliminar, fusionar, vincular, seleccionar portada) aparecen como iconos inline en la card. Eso aumenta ruido visual y no explica claramente para que sirve cada accion.

### Objetivo
Reducir ruido, mejorar comprension y mantener eficiencia.

### Estrategia funcional
1. Reemplazar la fila de iconos inline por un boton de 3 puntos (kebab) por card.
2. Al abrir el menu, mostrar acciones con:
   - titulo claro
   - descripcion corta de impacto
   - icono
3. Mantener acciones criticas con confirmacion modal (ej: eliminar, fusionar).
4. Mantener compatibilidad con modales actuales para no reescribir logica de negocio.

### Diseno propuesto

#### Card de persona
- Izquierda: avatar + nombre + metrica de apariciones.
- Derecha: solo boton kebab.

#### Menu de acciones (popover)
- Acciones recomendadas:
  - Ver recuerdos: "Ver fotos donde aparece esta persona"
  - Renombrar: "Cambia el nombre en todas sus apariciones"
  - Vincular usuario: "Relaciona esta persona con una cuenta amiga"
  - Cambiar portada: "Elige otra miniatura para identificarla"
  - Fusionar: "Unir con otra persona duplicada"
  - Eliminar: "Quitar persona y asociaciones"
- Separador visual antes de acciones destructivas.

#### Comportamiento responsive
- Desktop: popover anclado al kebab.
- Mobile: bottom sheet con mismas opciones y descripciones.

#### Estados UX
- Disabled con razon cuando aplique (ej: no se puede fusionar si solo hay una persona).
- Loading por accion.
- Cierre automatico del menu al ejecutar una accion.

### Implementacion aplicada
1. En `PersonCard` se elimino la fila de iconos inline y se reemplazo por un boton kebab de 3 puntos.
2. Se agrego menu contextual con titulo + descripcion por accion:
  - Ver recuerdos
  - Cambiar portada
  - Renombrar
  - Vincular con usuario (solo cuando la persona no es Unknown)
  - Fusionar personas (solo cuando hay mas de una persona)
  - Eliminar persona (estilo destructivo)
3. Se implemento comportamiento responsive:
  - Desktop: popover anclado al kebab.
  - Mobile: bottom sheet con las mismas acciones y descripciones.
4. Se mantiene reutilizacion de callbacks y modales existentes, sin cambios de endpoint.
5. Se corrigio el wiring de portada en lista pasando `onSelectThumbnail` desde la seccion al card.

### Archivos modificados
- `frontend/src/pages/People.jsx`

### Criterios de aceptacion
1. Cada card muestra solo kebab como entrada de acciones.
2. Todas las acciones actuales siguen disponibles via menu.
3. Cada opcion muestra una descripcion clara.
4. Flujo mobile funciona sin overlap visual.
5. No hay regresion en rename, merge, delete, link ni portada.

---

## Mejora 004 - Inicio: barra de pestanas visible + quitar boton extra de linea de tiempo

### Objetivo
1. Evitar que el mapa tape la barra de navegacion inferior (pestanas).
2. Eliminar el boton extra de linea de tiempo en la pagina de inicio.

### Implementacion aplicada
1. Se ajusto la seccion del mapa en Home para forzar una capa base (`z-0`) y prevenir que se renderice por encima de la barra de navegacion inferior.
2. Se removio el bloque/boton adicional de "Linea de tiempo" al final de Home para mantener una sola via de navegacion y evitar duplicidad.

### Archivos modificados
- `frontend/src/pages/Home.jsx`

### Impacto UX
- La barra de pestanas vuelve a mantenerse visible sin necesidad de hacer scroll para recuperarla.
- Se elimina ruido visual y duplicidad de acceso a timeline en Inicio.

---

## Mejora 005 - Subida de foto: aceptar vertical y horizontal sin friccion

### Objetivo
Hacer que al tomar o cargar foto se procese bien tanto en formato vertical como horizontal, con una solucion simple y mantenible.

### Implementacion aplicada
1. Se mejoro la conversion de imagen previa al upload para priorizar decodificacion con orientacion EXIF (`createImageBitmap` con `imageOrientation: from-image`) y mantener fallback compatible.
2. Se actualizo el preview en CreateMemory para respetar la orientacion real de la foto:
  - Se elimino el espejo horizontal forzado.
  - Se reemplazo el recorte rigido por render orientado (`object-contain`) con altura maxima controlada.

### Archivos modificados
- `frontend/src/pages/CreateMemory.jsx`

### Impacto UX
- Las fotos verticales ya no se ven deformadas/cortadas en preview.
- Las fotos horizontales y verticales siguen el mismo flujo de guardado sin pasos extra.
- No se agregaron dependencias ni complejidad adicional.
