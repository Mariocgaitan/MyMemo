# MyMemo Wrapped - Plan de Implementación Detallado

**Fecha**: 2026-03-22  
**Estado**: Listo para codificar  
**Prioridad**: Alta (Feature para atraer usuarios)

---

## 📋 Índice
1. [Visión General](#visión-general)
2. [Arquitectura de Datos](#arquitectura-de-datos)
3. [Pantallas Detalladas](#pantallas-detalladas)
4. [Estructura de Componentes](#estructura-de-componentes)
5. [Flujo de Navegación](#flujo-de-navegación)
6. [Tecnología & Dependencias](#tecnología--dependencias)
7. [Consideraciones de Performance](#consideraciones-de-performance)
8. [Roadmap de Implementación](#roadmap-de-implementación)

---

## 🎯 Visión General

**Objetivo**: Crear una experiencia visual tipo Spotify Wrapped que resume y celebra los recuerdos del usuario en MyMemo durante el año.

**Usuario vería**: 9 pantallas animadas con estadísticas, fotos y datos agregados de sus recuerdos.

**Acceso**: Botón en Header (página Home/Mapa) con icono `Trophy` o `Sparkles`.

**Scope MVP**: Función disponible 24/7 (sin restricción de frecuencia por ahora).

---

## 🗂️ Arquitectura de Datos

### Datos que se Necesitan Obtener

```
1. Todas las memorias del usuario
   - GET /api/v1/memories?page=1&page_size=500
   - Necesario: id, image_url, created_at, memory_date, description

2. Todas las personas
   - GET /api/v1/people
   - Necesario: id, name, photo_url, frequency_in_memories

3. Todas las categorías
   - GET /api/v1/categories
   - Necesario: id, label, value

4. Datos de ubicación (si aplica)
   - Incluido en memories (location_name, latitude, longitude)
```

### Procesamiento de Datos (Frontend - `useWrappedData.js`)

```javascript
// Hook que procesa datos crudos en estadísticas bonitas
useWrappedData(memories, people, categories) => {
  return {
    // Pantalla 1
    totalMemories: 47,
    memoriesThisYear: memories[], // ordenadas por fecha
    
    // Pantalla 2
    firstMemory: { date, image, description },
    lastMemory: { date, image, description },
    
    // Pantalla 3
    stats: {
      totalPhotos: 157,
      activeDays: 215,
      avgPerWeek: 0.9,
    },
    
    // Pantalla 4
    peopleCloud: [
      { name: 'María', frequency: 45, rotation: -5 },
      { name: 'Juan', frequency: 32, rotation: 0 },
      // ... sin solapamiento
    ],
    
    // Pantalla 5
    topPerson: {
      name: 'María',
      frequency: 45,
      photos: [15 imágenes], // masonry
    },
    
    // Pantalla 6
    topCategory: {
      label: 'Viajes',
      frequency: 23,
      photos: [15 imágenes], // masonry
    },
    
    // Pantalla 7
    cities: [
      { name: 'CDMX', count: 12, photo, lat, lng },
      { name: 'Cancún', count: 8, photo, lat, lng },
      // ... máximo 8 ciudades
    ],
    
    // Pantalla 8
    timeline: [
      { month: 'Enero', count: 3, photos: [] },
      { month: 'Febrero', count: 5, photos: [] },
      // ... 12 meses
    ],
  }
}
```

---

## 📱 Pantallas Detalladas

### Pantalla 1: Timelapse de Recuerdos

**Concepto**: Fotos pasando rápidamente como timelapse, con texto grande abajo.

```
┌─────────────────────────┐
│                         │
│   [Foto 1 - fade]       │
│   [Foto 2 - fade]       │
│   [Foto 3 - fade]       │
│                         │
│   "Subiste 47           │
│    recuerdos en 2026"   │
│                         │
└─────────────────────────┘
```

**Detalles Técnicos**:
- Mostrar 8-10 fotos en rotación (cada 1s)
- Transición: `fade` + `scale` (Framer Motion)
- Fotos aleatorias de todo el año
- Texto grande (60-80px), bold, centered

**Componente**: `WrappedTimelapse.jsx`

---

### Pantalla 2: Primer vs Último Recuerdo

**Concepto**: Comparativa lado a lado (izq = primero, der = último).

```
┌──────────────┬──────────────┐
│  PRIMERO     │  ÚLTIMO      │
│              │              │
│  [Foto1]     │  [Foto2]     │
│              │              │
│  15/01/2026  │  20/12/2026  │
│  "Viaje a..." │ "Cumpleaños" │
└──────────────┴──────────────┘
```

**Detalles Técnicos**:
- Layout: 2 columnas iguales
- Foto arriba, info (fecha + description snippet) abajo
- Animación entrada: slide from left/right

**Componente**: `WrappedFirstLast.jsx`

---

### Pantalla 3: Estadísticas Rápidas

**Concepto**: 3 tarjetas con métricas principales.

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  📸         │  │  🗓️         │  │  ⏱️         │
│             │  │             │  │             │
│   157       │  │   215       │  │   0.9       │
│  FOTOS      │  │ DÍAS ACTIVOS│  │ PROM/SEMANA │
└─────────────┘  └─────────────┘  └─────────────┘
```

**Detalles Técnicos**:
- 3 tarjetas, cada una con:
  - Icono (emoji o Lucide)
  - Número grande (48px+)
  - Label pequeño
- Animación: stagger entrada (cada 0.1s)
- Fondo: gradiente sutil

**Componente**: `WrappedStats.jsx`

---

### Pantalla 4: Cloud de Personas

**Concepto**: Nombres dispersos en la pantalla, tamaño = frecuencia, rotación aleatoria.

```
        María (24px, -5°)
    Juan (16px, 5°)     Sofia (20px, 0°)
                 
    Carlos (14px, -3°)    Ana (18px, 2°)
        
    "Conociste 23 personas"
```

**Detalles Técnicos**:
- Nombres en diferentes tamaños (proporcional a frecuencia)
- Rotación: SOLO -5°, 0°, +5° (vertical/horizontal)
- Algoritmo anti-solapamiento:
  - Generar posiciones en grid invisible
  - Revisar que bounding boxes no se toquen
  - Spacer mínimo entre textos
- Animación: aparecer uno a uno (stagger 0.05s)
- Font: Bold, colores variados (primario + secundarios)

**Componente**: `WrappedPeopleCloud.jsx`

**Función Auxiliar**: `generateNonOverlappingPositions.js`

---

### Pantalla 5: Top Persona

**Concepto**: La persona que más salió en recuerdos + sus fotos en masonry.

```
┌─────────────────────────┐
│  "Tu mejor acompañante" │
│                         │
│  🧑 María (45 apariciones)│
│                         │
│  [Masonry Grid]         │
│  [Foto1] [Foto2] [Foto3]│
│  [Foto4] [Foto5] [Foto6]│
│  ...                    │
└─────────────────────────┘
```

**Detalles Técnicos**:
- Header: "Tu mejor acompañante: [Name]"
- Debajo: foto de perfil pequeña + count
- Grid Masonry: 3-4 columnas (responsive)
- Fotos: Primeras 15 o todas si menos
- Animación: fotos aparecen con zoom + fade (stagger)

**Componente**: `WrappedTopPerson.jsx`

**Librería**: `react-masonry-css` o CSS Grid manual

---

### Pantalla 6: Top Categoría

**Concepto**: La categoría con más recuerdos + sus fotos.

```
┌─────────────────────────┐
│  "Tu categoría favorita"│
│                         │
│  🏷️  Viajes (23 items)   │
│                         │
│  [Masonry Grid]         │
│  [Foto1] [Foto2] [Foto3]│
│  [Foto4] [Foto5] [Foto6]│
│  ...                    │
└─────────────────────────┘
```

**Detalles Técnicos**:
- Idéntico a Pantalla 5 pero con categoría
- Header: "Tu categoría favorita: [Label]"
- Mismo masonry layout

**Componente**: `WrappedTopCategory.jsx`

---

### Pantalla 7: Ciudades Visitadas

**Concepto**: Grid de ciudades con foto + nombre + estadísticas.

```
┌────────────┬────────────┐
│ [Foto CDMX]│ [Foto Cancún]│
│ 🗺️ CDMX    │ 🗺️ Cancún   │
│ 12 recuerdos│ 8 recuerdos│
└────────────┴────────────┘

┌────────────┬────────────┐
│ [Foto Playa]│ [Foto MTY] │
│ 🗺️ Playa... │ 🗺️ Monterr.│
│ 5 recuerdos│ 4 recuerdos│
└────────────┴────────────┘
```

**Detalles Técnicos**:
- Grid: 2 columnas máximo (responsive: 1 col mobile)
- Cada card: foto + overlay con nombre + count
- Máximo 8 ciudades (top por cantidad de recuerdos)
- Animación: cascada de entrada (cada 0.1s)
- Foto: objeto-fit cover

**Componente**: `WrappedCities.jsx`

---

### Pantalla 8: Timeline Visual

**Concepto**: Línea horizontal con actividad por mes.

```
Ene  Feb  Mar  Abr  May  Jun  Jul  Ago  Sep  Oct  Nov  Dic
 ●    ●●   ●    ●●●  ●●   ●    ●●   ●●●  ●●   ●   ●●●  ●●●
 3    5    3    8    5    2    4    7    5    3    6    8

"Tu mes más activo: Agosto (8 recuerdos)"
```

**Detalles Técnicos**:
- 12 columnas (meses)
- Cada columna: círculo del tamaño proporcional a count
- Línea conectando los círculos
- Label debajo: mes + count
- Solo visual (no clickeable por ahora)
- Animación: línea se dibuja de izq a der, luego círculos aparecen

**Componente**: `WrappedTimeline.jsx`

---

### Pantalla 9: Cierre + Share

**Concepto**: Mensaje motivacional + botón para exportar/compartir.

```
┌─────────────────────────┐
│                         │
│   ✨ Confetti/Sparkles  │
│                         │
│  "Que venga más         │
│   recuerdos en 2027"    │
│                         │
│   [DESCARGAR IMAGEN]    │
│   [COMPARTIR]           │
│                         │
└─────────────────────────┘
```

**Detalles Técnicos**:
- Animación: confetti cayendo (librería o CSS custom)
- Botones:
  - "Descargar": html2canvas de pantalla actual
  - "Compartir": copiar link o social share
- Texto grande, centrado, motivacional

**Componente**: `WrappedEnd.jsx`

---

## 🏗️ Estructura de Componentes

```
/components/wrapped/
│
├── WrappedModal.jsx
│   ├── Lógica principal (state, navegación)
│   ├── Fetch datos
│   ├── Renderiza pantalla actual
│   ├── Botones Next/Previous
│   ├── Progress bar (9 steps)
│   └── Swipe detection (opcional)
│
├── WrappedTimelapse.jsx
├── WrappedFirstLast.jsx
├── WrappedStats.jsx
├── WrappedPeopleCloud.jsx
├── WrappedTopPerson.jsx
├── WrappedTopCategory.jsx
├── WrappedCities.jsx
├── WrappedTimeline.jsx
├── WrappedEnd.jsx
│
└── hooks/
    ├── useWrappedData.js (procesar datos)
    └── useExportImage.js (html2canvas wrapper)
```

### Componente Padre: `WrappedModal.jsx`

```jsx
export default function WrappedModal({ isOpen, onClose }) {
  const [currentScreen, setCurrentScreen] = useState(0);
  const [wrappedData, setWrappedData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch datos on mount
  useEffect(() => { /* ... */ }, [isOpen]);

  // Procesar datos
  const processedData = useWrappedData(rawMemories, people, categories);

  // Pantallas en orden
  const screens = [
    <WrappedTimelapse data={processedData} />,
    <WrappedFirstLast data={processedData} />,
    // ... etc
  ];

  return (
    <motion.div className="fixed inset-0 z-50 bg-black">
      {/* Header con Progress Bar */}
      <ProgressBar current={currentScreen} total={9} />
      
      {/* Pantalla actual con transición */}
      <AnimatePresence mode="wait">
        {screens[currentScreen]}
      </AnimatePresence>

      {/* Botones navegación */}
      <NavigationButtons 
        onNext={() => setCurrentScreen(prev => prev + 1)}
        onPrev={() => setCurrentScreen(prev => prev - 1)}
        canNext={currentScreen < 8}
        canPrev={currentScreen > 0}
      />
    </motion.div>
  );
}
```

---

## 🔄 Flujo de Navegación

1. Usuario ve Home/Mapa
2. Toca botón Wrapped (icono Trophy en header)
3. Modal abre en pantalla 1
4. Usuario navega con botones Next/Prev (o swipe)
5. En pantalla 9 (cierre), puede descargar/compartir
6. Modal cierra

**Estado**: Se mantiene el scroll position en Home al cerrar.

---

## 🛠️ Tecnología & Dependencias

### Dependencias Nuevas
- `framer-motion` - Animaciones fluidas
- `html2canvas` - Exportar pantallas como imagen
- `react-masonry-css` - Layout masonry (opcional, puedo usar CSS Grid)

### Librerías Existentes Usadas
- `react-router-dom` - Modal en ruta (opcional)
- `lucide-react` - Iconos
- `tailwind` - Estilos
- `date-fns` - Formato de fechas

### Instalación en Servidor
```bash
# En /app/mymemo/frontend
npm install framer-motion html2canvas react-masonry-css
```

---

## ⚡ Consideraciones de Performance

1. **Fetch de datos**: Hacer en paralelo (Promise.all)
2. **Lazy loading de fotos**: Usar URLs de thumbnail cuando sea posible
3. **Memoización**: Usar `useMemo` para procesamiento de datos
4. **Code splitting**: Wrapped puede cargarse on-demand (lazy import)
5. **Transiciones**: Usar `transform` y `opacity` (GPU accelerated)

---

## 🚀 Roadmap de Implementación

### Fase 1: Setup (Hoy)
- [ ] Crear estructura de carpetas
- [ ] Crear `useWrappedData.js`
- [ ] Crear `WrappedModal.jsx` (skeleton)

### Fase 2: Pantallas Básicas (Mañana)
- [ ] Pantalla 1-3 (timelapse, first/last, stats)
- [ ] Testear con datos reales

### Fase 3: Pantallas Complejas (Día 3)
- [ ] Pantalla 4 (cloud sin solapamiento)
- [ ] Pantalla 5-6 (masonry)
- [ ] Pantalla 7-8 (ciudades y timeline)

### Fase 4: Pulido & Export (Día 4)
- [ ] Pantalla 9 (cierre + export)
- [ ] Confetti animation
- [ ] html2canvas integration
- [ ] Testear swipe (opcional)

### Fase 5: Integración & Deploy (Día 5)
- [ ] Botón en Header
- [ ] Modal trigger
- [ ] Rebuild Docker
- [ ] Deploy a producción

---

## 📝 Notas Técnicas

### Anti-Solapamiento en Cloud (Pantalla 4)

```javascript
function generateNonOverlappingPositions(names, containerWidth, containerHeight) {
  const gridCells = [];
  const cellSize = 100; // px
  
  // Generar grid invisible
  for (let y = 0; y < containerHeight; y += cellSize) {
    for (let x = 0; x < containerWidth; x += cellSize) {
      gridCells.push({ x, y, occupied: false });
    }
  }
  
  // Colocar nombres sin overlap
  return names.map(name => {
    const availableCell = gridCells.find(c => !c.occupied);
    if (availableCell) {
      availableCell.occupied = true;
      return {
        name,
        x: availableCell.x,
        y: availableCell.y,
        rotation: [-5, 0, 5][Math.floor(Math.random() * 3)],
        fontSize: calculateFontSize(name.frequency),
      };
    }
  });
}
```

### Export a Imagen

```javascript
import html2canvas from 'html2canvas';

async function exportScreenAsImage(screenRef, screenName) {
  const canvas = await html2canvas(screenRef.current);
  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = `mymemo-wrapped-${screenName}.png`;
  link.click();
}
```

---

## ✅ Criterio de Aceptación

- [ ] 9 pantallas renderizando correctamente
- [ ] Framer Motion animaciones suave (60fps)
- [ ] Datos agregados correctamente
- [ ] Cloud de personas sin solapamiento
- [ ] Export a PNG funcional
- [ ] Botón en header accesible
- [ ] Mobile responsive
- [ ] Sin errores en consola

---

**Autor**: Mario  
**Última actualización**: 2026-03-22  
**Status**: 🟢 Listo para codificar
