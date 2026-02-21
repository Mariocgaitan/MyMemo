# LifeLog AI - Frontend Quick Start Guide

**Last Updated:** February 19, 2026

## 🚀 Cómo Ejecutar el Proyecto

### Prerequisitos
- Node.js 18+ instalado
- Backend corriendo en http://localhost:8000
- Docker Desktop corriendo (para backend)

### Paso 1: Iniciar Backend
```bash
# Desde la raíz del proyecto
docker-compose up -d
```

Verifica que estén corriendo:
- `lifelogs_backend` → http://localhost:8000
- `lifelogs_db` → PostgreSQL en puerto 5432
- `lifelogs_redis` → Redis en puerto 6379
- `lifelogs_celery` → Worker de tareas async

### Paso 2: Iniciar Frontend
```bash
cd frontend
npm install  # Solo la primera vez
npm run dev
```

Frontend disponible en: http://localhost:5173/

---

## 🎨 Componentes Implementados

### UI Components (`src/components/ui/`)
- **Button** - 4 variantes: primary, secondary, outline, ghost
- **Input** - Con iconos, labels, validación
- **Textarea** - Auto-resize, validación
- **Card** - Con hover effects
- **Chip** - Para filtros y tags seleccionables

### Layout Components (`src/components/layout/`)
- **Header** - Con dark mode toggle, búsqueda, usuario
- **Layout** - Wrapper con FAB opcional

### Map Components (`src/components/map/`)
- **MapView** - Leaflet con clustering automático, popups interactivos

### Pages (`src/pages/`)
- **Home** - Mapa + Timeline + Filtros
- **CreateMemory** - Formulario para crear recuerdos
- **MemoryDetail** - Vista detallada de un recuerdo

---

## 🗺️ API Integration

### Service Layer (`src/services/api.js`)

Todos los endpoints del backend están mapeados:

```javascript
import { memoryAPI, peopleAPI, searchAPI, usageAPI } from './services/api';

// Ejemplos de uso:
const memories = await memoryAPI.getAll();
const memory = await memoryAPI.getById(id);
const newMemory = await memoryAPI.create(data);

const people = await peopleAPI.getAll();
await peopleAPI.rename(personId, 'Mario');

const results = await searchAPI.text('taquitos');
const nearby = await searchAPI.nearby(lat, lng, 5); // 5km radius
```

### Variables de Entorno
Archivo: `frontend/.env.local`
```
VITE_API_URL=http://localhost:8000
```

---

## 🎯 Features Implementadas

### ✅ Completado
1. **Design System**
   - Paleta de colores custom (naranja #F39C12 + azul gris #2C3E50)
   - Dark mode funcional (persiste en localStorage)
   - Animaciones suaves (200-300ms)
   - Typography scale consistente

2. **Navegación**
   - React Router con 3 rutas
   - Transiciones suaves entre páginas
   - FAB (Floating Action Button) para crear recuerdos

3. **Mapa Interactivo**
   - Leaflet con OpenStreetMap tiles
   - Clustering automático de markers cercanos
   - Popups con preview de memorias (imagen + descripción)
   - Click en memoria → navega a detalle

4. **Timeline**
   - Agrupación por día (Hoy, Ayer, Hace X días)
   - Scroll horizontal por grupo
   - Cards con preview de imagen + descripción

5. **Búsqueda y Filtros**
   - Barra de búsqueda (conectado a backend)
   - Filtros colapsables (categorías + personas)
   - Chips seleccionables multi-select

6. **API Connection**
   - Axios configurado con interceptors
   - Error handling
   - Loading states en toda la app

### 🔜 Pendiente (Próxima Sesión)
1. **Face Naming Modal** (como Instagram)
   - Detectar caras después de subir foto
   - Modal para nombrar personas nuevas
   - Actualizar backend con nombres

2. **Create Memory Form**
   - Conectar con API backend
   - Upload de imágenes (base64 o FormData)
   - Captura de GPS del navegador
   - Validación de campos

3. **Memory Detail Page**
   - Cargar datos reales del backend
   - Mostrar personas detectadas
   - Editar tags/categorías
   - Ver en mapa

4. **PWA Features**
   - Service Worker para offline
   - IndexedDB para queue de sync
   - Manifest.json
   - Install prompt

---

## 🎨 Guía de Estilos

### Colores
```css
/* Light Mode */
--primary: #F39C12        /* Naranja cálido */
--secondary: #2C3E50      /* Azul gris */
--background: #FAFAFA     /* Gris claro */

/* Dark Mode */
--primary: #F39C12        /* Mismo naranja */
--background: #121212     /* Negro */
--surface: #1E1E1E        /* Gris oscuro */
```

### Espaciado
```
sm: 4px  (0.25rem)
md: 16px (1rem)
lg: 32px (2rem)
```

### Bordes Redondeados
```
sm: 8px   (.5rem)
md: 12px  (.75rem)
lg: 16px  (1rem)
xl: 24px  (1.5rem)
2xl: 32px (2rem)
```

---

## 🐛 Troubleshooting

### Error: "Cannot connect to backend"
```bash
# Verifica que el backend esté corriendo
docker ps | grep lifelogs

# Si no está corriendo
docker-compose up -d
```

### Error: "Module not found: leaflet"
```bash
cd frontend
npm install
```

### Mapa no se ve o está en blanco
- Verifica que `leaflet/dist/leaflet.css` esté importado
- Revisa la consola del navegador por errores
- Asegúrate de que hay memorias con coordenadas válidas

### Dark mode no funciona
- Limpia localStorage: `localStorage.clear()`
- Recarga la página
- El toggle debe estar en el header (ícono luna/sol)

---

## 📦 Estructura de Carpetas

```
frontend/
├── src/
│   ├── components/
│   │   ├── ui/           # Componentes reutilizables
│   │   ├── layout/       # Header, Layout
│   │   └── map/          # MapView
│   ├── contexts/         # ThemeContext
│   ├── pages/            # Home, CreateMemory, MemoryDetail
│   ├── services/         # API client
│   ├── App.jsx           # Router setup
│   ├── index.css         # Global styles
│   └── main.jsx          # Entry point
├── .env.local           # Environment variables
├── package.json
├── tailwind.config.js
└── vite.config.js
```

---

## 🔥 Hot Tips

1. **Dark Mode Toggle**: Click en el ícono luna/sol en el header
2. **Crear Recuerdo**: Click en botón flotante + (esquina inferior derecha)
3. **Ver Detalle**: Click en cualquier pin del mapa o card del timeline
4. **Filtros**: Click en "Filtros" debajo de la barra de búsqueda
5. **Navegar**: Usa las flechas del navegador o botones "Volver"

---

## 🎯 Next Steps (Para ti)

1. Abre http://localhost:5173/ en tu navegador
2. Prueba el dark mode toggle
3. Verifica que el mapa se vea correctamente
4. Checa si las memorias del backend aparecen en el mapa y timeline
5. Prueba navegar entre páginas
6. Reporta cualquier error que veas

**Si todo funciona:** ✅ Pasamos a implementar el modal de nombrar caras
**Si hay errores:** 🐛 Los solucionamos juntos

---

**¿Dudas?** Pregúntame lo que necesites.
