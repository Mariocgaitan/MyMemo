# LifeLog AI - Design System & UI Specification

**Version:** 1.0  
**Date:** February 19, 2026  
**Style:** Minimal Journal (Warm & Personal)  
**Modes:** Light + Dark

---

## 🎨 Color System

### Light Mode (Default)
```css
/* Primary Colors */
--primary: #F39C12;        /* Naranja cálido - memorias, nostalgia */
--primary-hover: #E67E22;  /* Naranja oscuro al hover */
--primary-light: #FFF3E0;  /* Fondo naranja suave */

--secondary: #2C3E50;      /* Azul gris oscuro - confianza */
--secondary-hover: #1A252F; /* Más oscuro al hover */

/* Neutral Colors */
--background: #FAFAFA;     /* Gris claro casi blanco */
--surface: #FFFFFF;        /* Blanco puro para cards */
--border: #E0E0E0;         /* Bordes sutiles */

/* Text Colors */
--text-primary: #2C3E50;   /* Texto principal */
--text-secondary: #7F8C8D; /* Texto secundario/metadata */
--text-tertiary: #BDC3C7;  /* Texto deshabilitado */

/* Semantic Colors */
--success: #27AE60;        /* Verde - confirmación */
--warning: #F39C12;        /* Naranja - advertencia */
--error: #E74C3C;          /* Rojo suave - error */
--info: #3498DB;           /* Azul - información */
```

### Dark Mode
```css
/* Primary Colors */
--primary: #F39C12;        /* Mismo naranja (mantiene calidez) */
--primary-hover: #FFA726;  /* Más brillante al hover */
--primary-light: #2A1F0F;  /* Fondo naranja muy oscuro */

--secondary: #E0E0E0;      /* Gris claro para contraste */
--secondary-hover: #FFFFFF; /* Blanco al hover */

/* Neutral Colors */
--background: #121212;     /* Negro puro (true dark) */
--surface: #1E1E1E;        /* Gris muy oscuro para cards */
--border: #2C2C2C;         /* Bordes sutiles oscuros */

/* Text Colors */
--text-primary: #E0E0E0;   /* Gris claro */
--text-secondary: #9E9E9E; /* Gris medio */
--text-tertiary: #5E5E5E;  /* Gris oscuro */

/* Semantic Colors */
--success: #4CAF50;        /* Verde más brillante */
--warning: #FFA726;        /* Naranja brillante */
--error: #EF5350;          /* Rojo brillante */
--info: #42A5F5;           /* Azul brillante */
```

### Category/Mood Colors (Para tags/filtros)
```css
--mood-exercise: #9B59B6;  /* Morado */
--mood-friends: #E74C3C;   /* Rojo */
--mood-family: #27AE60;    /* Verde */
--mood-work: #3498DB;      /* Azul */
--mood-travel: #F39C12;    /* Naranja */
--mood-food: #E67E22;      /* Naranja oscuro */
--mood-nature: #1ABC9C;    /* Turquesa */
--mood-learning: #9B59B6;  /* Morado */
```

---

## ⚙️ User Decisions (Confirmed)

✅ **Filtros:** Colapsados por defecto, se expanden al hacer click en "Filtros" (ahorra espacio)  
✅ **Timeline:** Scroll horizontal con agrupación por día (Hoy, Ayer, Hace 2 días...)  
✅ **Mapa Pins:** Clustering automático con números cuando hay muchos pins cercanos  
✅ **Foto:** Obligatoria siempre (es un photo diary visual)  
✅ **Validación:** Solo al presionar "Guardar" (menos intrusivo)  
✅ **Navegación:** Click en memoria = nueva pantalla completa con detalles  

---

## 📐 Layout Structure

### Screen 1: Main View (Home/Explorer)

```
┌────────────────────────────────────────────────────────────────┐
│  [≡]  LifeLog AI                    [🌙] [👤 Mario]          │ ← Header (sticky)
├────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ [🔍] Buscar por frase, tags, lugar...     [🔽 Filtros]   │ │ ← Search bar + collapse
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ⬇️ Expandible al click en "Filtros" ⬇️                       │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Categorías: [🏃 Ejercicio] [🧑‍🤝‍🧑 Amigos] [🍕 Comida] [+] │ │ ← Multi-select chips
│  │ Personas:   [👤 Brau] [👤 Gerardo] [👤 Ángel] [+]       │ │ ← Multi-select chips
│  └──────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│                  🗺️ MAPA INTERACTIVO                          │ ← Leaflet Map (60% height)
│                                                                │
│                  📍      (5)                                   │ ← Cluster con número
│                       📍                                       │ ← Pin individual
│              (12)          📍                                  │ ← Otro cluster
│                                                                │ (zoom para expandir)
│   ┌────────────────────────────────────────────────────────┐  │
│   │ Popup al click en pin:                                 │  │ ← Popup sobre mapa
│   │ ┌──────┐  Taquería de canasta                         │  │
│   │ │ 📷  │  🕐 Hace 2 horas                              │  │
│   │ └──────┘  👤 Con Ángel                                │  │
│   │                                                         │  │
│   │ ┌──────┐  Taquitos de nuevo!                          │  │ ← Lista de memorias
│   │ │ 📷  │  🕐 Hace 1 día                                 │  │   en esa ubicación
│   │ └──────┘  👤 Solo                                      │  │
│   │                                                         │  │
│   │ [Ver todas (5) →]                                      │  │
│   └────────────────────────────────────────────────────────┘  │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│  📅 TIMELINE (últimos 7 días)                    [Ver todo →] │ ← Timeline header
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Hoy                                                       │ │
│  │ ┌───────┐  ┌───────┐                                    │ │
│  │ │  📷  │  │  📷  │  ← Scroll horizontal                │ │
│  │ └───────┘  └───────┘     de cards pequeñas             │ │
│  │                                                           │ │
│  │ Ayer                                                      │ │
│  │ ┌───────┐  ┌───────┐  ┌───────┐                        │ │
│  │ │  📷  │  │  📷  │  │  📷  │                          │ │
│  │ └───────┘  └───────┘  └───────┘                        │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
│                            [+]                                 │ ← FAB (fixed)
└────────────────────────────────────────────────────────────────┘
```

**Dimensiones:**
- Header: 64px fixed
- Filters: Auto height (collapsed by default, max 120px expanded)
- Map: 60% viewport height (mínimo 400px)
- Timeline: 30% viewport height (scroll interno)
- FAB: 64x64px, bottom-right 24px

---

### Screen 2: Create Memory Form

```
┌────────────────────────────────────────────────────────────────┐
│  [←] Nuevo Recuerdo                                 [Guardar]  │ ← Header
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                                                           │ │
│  │                   📷 Foto del recuerdo                    │ │ ← Image preview
│  │                                                           │ │   (400px height)
│  │               [📸 Tomar foto] [📁 Cargar foto]           │ │
│  │                                                           │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  📍 Ubicación Actual                                          │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 📍 Taquería de canasta, CDMX                             │ │ ← Auto-detected GPS
│  │                                                           │ │   + geocoding
│  └──────────────────────────────────────────────────────────┘ │
│  [📍 Usar ubicación actual] [🗺️ Elegir en mapa]              │
│                                                                │
│  📝 Título (opcional)                                         │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Taquitos de canasta con Ángel                            │ │ ← Input text
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  💭 ¿Qué pasó? Cuéntame más...                               │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ En unos taquitos de canasta con ángel, hoy me pedí 5.   │ │ ← Textarea
│  │ No había de picadillo porque unos malditos se lo         │ │   (auto-resize)
│  │ acabaron. Buenísimos como siempre los tacos.             │ │
│  │                                                           │ │
│  │                                                           │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  🏷️ Categorías (opcional)                                    │
│  [ Ejercicio ] [ Amigos ] [ Comida ] [ Viaje ] [+]           │ ← Selectable chips
│                                                                │
│  👤 ¿Con quién estabas? (se detectará automáticamente)       │
│  [La IA detectará las caras después de guardar]              │
│                                                                │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │              [Guardar Recuerdo]                           │ │ ← Primary button
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

### Screen 3: Memory Detail View

```
┌────────────────────────────────────────────────────────────────┐
│  [←] Recuerdo                    [⋯ Opciones]                 │ ← Header
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                                                           │ │
│  │                    [IMAGEN FULL WIDTH]                    │ │ ← Hero image
│  │                                                           │ │   (6:4 aspect)
│  │                                                           │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  📅 19 de febrero, 2026 • 🕐 12:30 PM                        │ ← Metadata row
│  📍 Taquería de canasta, CDMX                                 │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  En unos taquitos de canasta con ángel, hoy me pedí 5.  │ │ ← Description
│  │  No había de picadillo porque unos malditos se lo        │ │   (full text)
│  │  acabaron. Buenísimos como siempre los tacos.            │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  🏷️ Tags                                                      │
│  [taquitos] [canasta] [CDMX] [food] [tacos]                  │ ← AI-generated tags
│                                                                │
│  👥 Personas detectadas                                       │
│  ┌────────┐  ┌────────┐                                      │
│  │  ○     │  │  ○     │                                      │ ← Face thumbnails
│  │  👤    │  │  👤    │                                      │   (circular)
│  │ Ángel  │  │  Tú    │                                      │
│  └────────┘  └────────┘                                      │
│                                                                │
│  🎭 Sentimiento: 😊 Positivo                                  │
│  🎯 Actividad: Comida                                         │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                  [Ver en Mapa]                            │ │ ← Action buttons
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 🧩 Component Library

### 1. Header / Navbar
```jsx
<header className="
  sticky top-0 z-50 
  bg-white dark:bg-[#1E1E1E] 
  border-b border-[#E0E0E0] dark:border-[#2C2C2C]
  px-6 py-4
  flex items-center justify-between
  shadow-sm
">
  <div className="flex items-center gap-4">
    <button className="lg:hidden"> {/* Hamburger menu */}
      <MenuIcon />
    </button>
    <h1 className="text-xl font-bold text-[#2C3E50] dark:text-[#E0E0E0]">
      LifeLog AI
    </h1>
  </div>
  
  <div className="flex items-center gap-4">
    <button> {/* Dark mode toggle */}
      <Moon className="text-[#7F8C8D]" />
    </button>
    <div className="flex items-center gap-2">
      <img src="/avatar.jpg" className="w-8 h-8 rounded-full" />
      <span className="text-sm font-medium text-[#2C3E50] dark:text-[#E0E0E0]">
        Mario
      </span>
    </div>
  </div>
</header>
```

### 2. Search Bar
```jsx
<div className="
  relative w-full
  bg-white dark:bg-[#1E1E1E]
  rounded-2xl
  border-2 border-[#E0E0E0] dark:border-[#2C2C2C]
  focus-within:border-[#F39C12] focus-within:ring-2 focus-within:ring-[#F39C12]/20
  transition-all duration-200
">
  <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7F8C8D]" />
  <input 
    type="text"
    placeholder="Buscar por frase, tags, lugar..."
    className="
      w-full pl-12 pr-4 py-3
      bg-transparent
      text-[#2C3E50] dark:text-[#E0E0E0]
      placeholder:text-[#BDC3C7]
      outline-none
    "
  />
</div>
```

### 3. Filter Chips (Multi-select)
```jsx
<div className="flex flex-wrap gap-2">
  <span className="text-sm font-medium text-[#7F8C8D] mr-2">Categorías:</span>
  
  {/* Selected chip */}
  <button className="
    px-4 py-2 rounded-full
    bg-[#F39C12] text-white
    text-sm font-medium
    flex items-center gap-2
    hover:bg-[#E67E22]
    transition-colors duration-200
  ">
    🏃 Ejercicio
    <X size={14} />
  </button>
  
  {/* Unselected chip */}
  <button className="
    px-4 py-2 rounded-full
    bg-white dark:bg-[#1E1E1E]
    border-2 border-[#E0E0E0] dark:border-[#2C2C2C]
    text-[#2C3E50] dark:text-[#E0E0E0]
    text-sm font-medium
    hover:border-[#F39C12]
    transition-colors duration-200
  ">
    🧑‍🤝‍🧑 Amigos
  </button>
  
  {/* Add new chip */}
  <button className="
    px-4 py-2 rounded-full
    border-2 border-dashed border-[#E0E0E0] dark:border-[#2C2C2C]
    text-[#7F8C8D]
    text-sm font-medium
    hover:border-[#F39C12] hover:text-[#F39C12]
    transition-colors duration-200
  ">
    + Añadir
  </button>
</div>
```

### 4. Map Pin Popup Card
```jsx
<div className="
  bg-white dark:bg-[#1E1E1E]
  rounded-2xl
  shadow-xl
  overflow-hidden
  w-80
  max-h-96
  overflow-y-auto
">
  {/* Location header */}
  <div className="bg-[#F39C12]/10 dark:bg-[#2A1F0F] px-4 py-3 border-b border-[#E0E0E0] dark:border-[#2C2C2C]">
    <h3 className="font-bold text-[#2C3E50] dark:text-[#E0E0E0]">
      📍 Taquería de canasta
    </h3>
    <p className="text-sm text-[#7F8C8D]">5 recuerdos en este lugar</p>
  </div>
  
  {/* Memory list */}
  <div className="divide-y divide-[#E0E0E0] dark:divide-[#2C2C2C]">
    {/* Memory item */}
    <div className="flex gap-3 p-3 hover:bg-[#FAFAFA] dark:hover:bg-[#121212] cursor-pointer transition-colors">
      <img 
        src="/memory.jpg" 
        className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#2C3E50] dark:text-[#E0E0E0] truncate">
          Taquitos con Ángel
        </p>
        <p className="text-xs text-[#7F8C8D] mt-1">
          🕐 Hace 2 horas
        </p>
        <p className="text-xs text-[#7F8C8D]">
          👤 Con Ángel
        </p>
      </div>
    </div>
  </div>
  
  {/* View all button */}
  <div className="border-t border-[#E0E0E0] dark:border-[#2C2C2C] p-3">
    <button className="w-full text-center text-sm font-medium text-[#F39C12] hover:text-[#E67E22]">
      Ver todos →
    </button>
  </div>
</div>
```

### 5. Timeline Card (Small)
```jsx
<div className="
  bg-white dark:bg-[#1E1E1E]
  rounded-xl
  shadow-md hover:shadow-xl
  overflow-hidden
  w-48 flex-shrink-0
  cursor-pointer
  transition-all duration-300
  hover:-translate-y-1
">
  <img 
    src="/memory.jpg" 
    className="w-full h-32 object-cover"
  />
  <div className="p-3">
    <p className="text-sm font-medium text-[#2C3E50] dark:text-[#E0E0E0] line-clamp-2">
      Taquitos de canasta
    </p>
    <p className="text-xs text-[#7F8C8D] mt-1">
      🕐 Hace 2 horas
    </p>
  </div>
</div>
```

### 6. Floating Action Button (FAB)
```jsx
<button className="
  fixed bottom-6 right-6 z-50
  w-16 h-16
  bg-[#F39C12] hover:bg-[#E67E22]
  text-white
  rounded-full
  shadow-2xl hover:shadow-3xl
  flex items-center justify-center
  transition-all duration-300
  hover:scale-110
  active:scale-95
">
  <Plus size={32} strokeWidth={2.5} />
</button>
```

### 7. Primary Button
```jsx
<button className="
  w-full
  px-6 py-3
  bg-[#F39C12] hover:bg-[#E67E22]
  text-white
  font-semibold
  rounded-xl
  shadow-lg hover:shadow-xl
  transition-all duration-200
  hover:-translate-y-0.5
  active:translate-y-0
  disabled:opacity-50 disabled:cursor-not-allowed
">
  Guardar Recuerdo
</button>
```

### 8. Secondary Button
```jsx
<button className="
  px-6 py-3
  border-2 border-[#2C3E50] dark:border-[#E0E0E0]
  text-[#2C3E50] dark:text-[#E0E0E0]
  font-semibold
  rounded-xl
  hover:bg-[#2C3E50] hover:text-white
  dark:hover:bg-[#E0E0E0] dark:hover:text-[#1E1E1E]
  transition-all duration-200
">
  Cancelar
</button>
```

### 9. Input Field
```jsx
<div className="space-y-2">
  <label className="block text-sm font-medium text-[#2C3E50] dark:text-[#E0E0E0]">
    📝 Título (opcional)
  </label>
  <input
    type="text"
    placeholder="Dale un nombre a este recuerdo..."
    className="
      w-full px-4 py-3
      bg-white dark:bg-[#1E1E1E]
      border-2 border-[#E0E0E0] dark:border-[#2C2C2C]
      rounded-xl
      text-[#2C3E50] dark:text-[#E0E0E0]
      placeholder:text-[#BDC3C7]
      focus:border-[#F39C12] focus:ring-2 focus:ring-[#F39C12]/20
      transition-all duration-200
      outline-none
    "
  />
</div>
```

### 10. Textarea (Auto-resize)
```jsx
<div className="space-y-2">
  <label className="block text-sm font-medium text-[#2C3E50] dark:text-[#E0E0E0]">
    💭 ¿Qué pasó? Cuéntame más...
  </label>
  <textarea
    placeholder="Escribe todo lo que quieras recordar..."
    rows={4}
    className="
      w-full px-4 py-3
      bg-white dark:bg-[#1E1E1E]
      border-2 border-[#E0E0E0] dark:border-[#2C2C2C]
      rounded-xl
      text-[#2C3E50] dark:text-[#E0E0E0]
      placeholder:text-[#BDC3C7]
      focus:border-[#F39C12] focus:ring-2 focus:ring-[#F39C12]/20
      transition-all duration-200
      outline-none
      resize-none
    "
  />
</div>
```

---

## 🎭 Interactions & Animations

### Hover Effects
```css
/* Card hover */
.card {
  transition: transform 200ms ease-out, box-shadow 200ms ease-out;
}
.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 
              0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

/* Button hover */
.button-primary {
  transition: transform 200ms ease-out, background-color 200ms ease-out;
}
.button-primary:hover {
  transform: translateY(-2px);
}
.button-primary:active {
  transform: translateY(0);
}

/* Chip selection */
.chip {
  transition: all 200ms ease-out;
}
.chip:hover {
  transform: scale(1.05);
}
```

### Page Transitions
```jsx
// Usar Framer Motion para transiciones suaves entre páginas
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -20 }}
  transition={{ duration: 0.3 }}
>
  {/* Page content */}
</motion.div>
```

### Loading States
```jsx
/* Skeleton loading para cards */
<div className="animate-pulse">
  <div className="bg-[#E0E0E0] dark:bg-[#2C2C2C] h-48 rounded-xl"></div>
  <div className="mt-3 space-y-2">
    <div className="bg-[#E0E0E0] dark:bg-[#2C2C2C] h-4 rounded w-3/4"></div>
    <div className="bg-[#E0E0E0] dark:bg-[#2C2C2C] h-4 rounded w-1/2"></div>
  </div>
</div>
```

---

## 📱 Responsive Breakpoints

```css
/* Mobile First */
.container {
  padding: 1rem; /* 16px */
}

/* Tablet: 768px+ */
@media (min-width: 768px) {
  .container {
    padding: 1.5rem; /* 24px */
  }
  
  .timeline {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Desktop: 1024px+ */
@media (min-width: 1024px) {
  .container {
    padding: 2rem; /* 32px */
  }
  
  .timeline {
    grid-template-columns: repeat(3, 1fr);
  }
  
  /* Show sidebar on desktop */
  .sidebar {
    display: block;
  }
}

/* Large Desktop: 1440px+ */
@media (min-width: 1440px) {
  .container {
    max-width: 1440px;
    margin: 0 auto;
  }
  
  .timeline {
    grid-template-columns: repeat(4, 1fr);
  }
}
```

---

## 🎯 Accessibility (a11y)

### Focus States
```css
/* Visible focus ring para keyboard navigation */
.interactive:focus-visible {
  outline: 2px solid #F39C12;
  outline-offset: 2px;
}
```

### ARIA Labels
```jsx
<button aria-label="Crear nuevo recuerdo">
  <Plus />
</button>

<input 
  type="search" 
  aria-label="Buscar recuerdos por frase o tags"
  placeholder="Buscar..."
/>

<img 
  src="/memory.jpg" 
  alt="Taquitos de canasta con Ángel en CDMX"
/>
```

### Keyboard Shortcuts
```
- Cmd/Ctrl + K: Abrir búsqueda
- N: Nuevo recuerdo
- /: Ir a búsqueda
- Esc: Cerrar modal/popup
- ← →: Navegar timeline
```

---

## 🌐 i18n (Internationalization) - Future

```javascript
// Preparar para múltiples idiomas
const translations = {
  es: {
    'header.title': 'LifeLog AI',
    'search.placeholder': 'Buscar por frase, tags, lugar...',
    'button.save': 'Guardar Recuerdo',
    'button.cancel': 'Cancelar',
    // ...
  },
  en: {
    'header.title': 'LifeLog AI',
    'search.placeholder': 'Search by phrase, tags, place...',
    'button.save': 'Save Memory',
    'button.cancel': 'Cancel',
    // ...
  }
};
```

---

## 📦 Icon System

### Icon Library: Lucide React
```bash
npm install lucide-react
```

### Commonly Used Icons
```jsx
import { 
  Search,      // Búsqueda
  Plus,        // Crear nuevo
  MapPin,      // Ubicación
  Calendar,    // Fecha
  Users,       // Personas
  Tag,         // Tags
  Camera,      // Cámara
  Image,       // Galería
  Heart,       // Favorito
  Share2,      // Compartir
  MoreVertical, // Opciones
  ChevronLeft, // Volver
  X,           // Cerrar
  Moon,        // Dark mode
  Sun,         // Light mode
  Menu,        // Hamburger menu
} from 'lucide-react';
```

---

## 🎨 Typography

### Font Families
```css
/* Primary: Inter (sans-serif) */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 
               'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
}
```

### Font Sizes
```css
/* Usar escala tipográfica consistente */
.text-xs { font-size: 0.75rem; line-height: 1rem; }    /* 12px */
.text-sm { font-size: 0.875rem; line-height: 1.25rem; } /* 14px */
.text-base { font-size: 1rem; line-height: 1.5rem; }    /* 16px - default */
.text-lg { font-size: 1.125rem; line-height: 1.75rem; } /* 18px */
.text-xl { font-size: 1.25rem; line-height: 1.75rem; }  /* 20px */
.text-2xl { font-size: 1.5rem; line-height: 2rem; }     /* 24px */
.text-3xl { font-size: 1.875rem; line-height: 2.25rem; } /* 30px */
```

### Font Weights
```css
.font-normal { font-weight: 400; }   /* Body text */
.font-medium { font-weight: 500; }   /* Subtle emphasis */
.font-semibold { font-weight: 600; } /* Headers, buttons */
.font-bold { font-weight: 700; }     /* Page titles */
```

---

## 📏 Spacing System

```css
/* Usar escala consistente de 4px */
.space-1 { margin/padding: 0.25rem; }  /* 4px */
.space-2 { margin/padding: 0.5rem; }   /* 8px */
.space-3 { margin/padding: 0.75rem; }  /* 12px */
.space-4 { margin/padding: 1rem; }     /* 16px - default */
.space-6 { margin/padding: 1.5rem; }   /* 24px */
.space-8 { margin/padding: 2rem; }     /* 32px */
.space-12 { margin/padding: 3rem; }    /* 48px */
.space-16 { margin/padding: 4rem; }    /* 64px */
```

---

## 🎬 Animation Timing

```css
/* Usar duraciones consistentes */
:root {
  --duration-instant: 0ms;
  --duration-fast: 150ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
  --duration-slower: 500ms;
  
  --ease: cubic-bezier(0.4, 0, 0.2, 1); /* ease-out */
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
}
```

---

## 🔄 State Management Plan

### Global State (Context API)
```jsx
// ThemeContext - Dark/Light mode
// AuthContext - Usuario actual
// FilterContext - Filtros activos (categorías, personas)
// MapContext - Estado del mapa (center, zoom, selected pin)
```

### Local State (useState)
```jsx
// Form inputs
// Modal open/closed
// Loading states
// Error states
```

### Server State (React Query)
```jsx
// API calls
// Caching
// Background refetching
```

---

## 📸 Image Handling

### Aspect Ratios
```css
/* Memory images */
.image-hero { aspect-ratio: 3 / 2; }    /* Main view */
.image-card { aspect-ratio: 4 / 3; }    /* Timeline cards */
.image-thumbnail { aspect-ratio: 1 / 1; } /* Square thumbnails */
```

### Lazy Loading
```jsx
<img 
  src="/memory.jpg" 
  loading="lazy" 
  decoding="async"
  className="..."
/>
```

### Placeholder (Blur)
```jsx
// Usar next/image o similar para blur placeholder automático
<Image
  src="/memory.jpg"
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,..."
/>
```

---

## ✅ Feature Flags (Para desarrollo incremental)

```javascript
const features = {
  darkMode: true,          // ✅ Día 1
  mapView: true,           // ✅ Día 1
  timeline: true,          // ✅ Día 1
  personDetection: true,   // ✅ Backend ready
  nlpExtraction: true,     // ✅ Backend ready
  offlineMode: false,      // 🔜 Semana 3
  shareMemory: false,      // 🔜 Future
  exportData: false,       // 🔜 Future
  voiceNotes: false,       // 🔜 Future
};
```

---

## 🎯 Next Steps for Implementation

1. ✅ Design system complete
2. 🔜 Setup TailwindCSS con tema custom
3. 🔜 Crear componentes base (Button, Input, Card, etc.)
4. 🔜 Implementar Header + Layout
5. 🔜 Integrar Leaflet para mapa
6. 🔜 Crear formulario de Memory
7. 🔜 Conectar con API backend
8. 🔜 Implementar timeline
9. 🔜 Agregar dark mode toggle

---

**End of Design System Document**
