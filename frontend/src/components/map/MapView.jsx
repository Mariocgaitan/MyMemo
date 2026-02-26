import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';

// Inject photo marker CSS once
const PHOTO_MARKER_CSS = `
  .photo-marker {
    background: none !important;
    border: none !important;
  }
  .photo-marker-inner {
    width: 48px;
    height: 48px;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    overflow: hidden;
    border: 3px solid white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.35);
    background: #6366f1;
  }
  .photo-marker-inner img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transform: rotate(45deg) scale(1.35);
    transform-origin: center;
  }
  .photo-marker-inner .photo-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    transform: rotate(45deg);
  }
  .photo-cluster {
    background: none !important;
    border: none !important;
  }
  .photo-cluster-inner {
    position: relative;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    overflow: hidden;
    border: 3px solid white;
    box-shadow: 0 2px 10px rgba(0,0,0,0.4);
    background: #6366f1;
  }
  .photo-cluster-inner img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .photo-cluster-inner .cluster-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
  }
  .photo-cluster-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    background: #6366f1;
    color: white;
    font-size: 11px;
    font-weight: 700;
    min-width: 20px;
    height: 20px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid white;
    padding: 0 3px;
    line-height: 1;
    z-index: 1;
  }
`;

if (!document.getElementById('photo-marker-styles')) {
  const style = document.createElement('style');
  style.id = 'photo-marker-styles';
  style.textContent = PHOTO_MARKER_CSS;
  document.head.appendChild(style);
}

// Create a photo pin icon from a memory
function createPhotoIcon(memory) {
  const imgSrc = memory.thumbnail_url || memory.image_url;
  const html = `
    <div class="photo-marker-inner">
      ${imgSrc
        ? `<img src="${imgSrc}" alt="" loading="lazy" />`
        : `<div class="photo-placeholder">📸</div>`
      }
    </div>
  `;
  return L.divIcon({
    html,
    className: 'photo-marker',
    iconSize: [48, 48],
    iconAnchor: [10, 46], // tip of the rotated square
    popupAnchor: [14, -40],
  });
}

// Create a cluster icon showing the most recent memory's thumbnail
function createClusterIcon(cluster) {
  const markers = cluster.getAllChildMarkers();
  // Get most recent memory thumbnail from first marker's options
  const firstMemory = markers[0]?.options?._memory;
  const imgSrc = firstMemory?.thumbnail_url || firstMemory?.image_url;
  const count = cluster.getChildCount();
  const html = `
    <div style="position:relative;display:inline-block;">
      <div class="photo-cluster-inner">
        ${imgSrc
          ? `<img src="${imgSrc}" alt="" loading="lazy" />`
          : `<div class="cluster-placeholder">📸</div>`
        }
      </div>
      <span class="photo-cluster-badge">${count > 99 ? '99+' : count}</span>
    </div>
  `;
  return L.divIcon({
    html,
    className: 'photo-cluster',
    iconSize: [56, 56],
    iconAnchor: [28, 28],
  });
}

export default function MapView({ memories = [], onMemoryClick, onLocationClick, loading = false }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerClusterRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [19.4326, -99.1332],
      zoom: 12,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const markerCluster = L.markerClusterGroup({
      maxClusterRadius: 60,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: createClusterIcon,
    });

    map.addLayer(markerCluster);
    mapInstanceRef.current = map;
    markerClusterRef.current = markerCluster;
    setMapReady(true);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update markers when memories change
  useEffect(() => {
    if (!mapReady || !markerClusterRef.current) return;

    markerClusterRef.current.clearLayers();

    // Group memories by exact lat/lng
    const locationGroups = memories.reduce((acc, memory) => {
      if (!memory.latitude || !memory.longitude) return acc;
      const key = `${memory.latitude},${memory.longitude}`;
      if (!acc[key]) {
        acc[key] = { latitude: memory.latitude, longitude: memory.longitude, memories: [] };
      }
      acc[key].memories.push(memory);
      return acc;
    }, {});

    Object.values(locationGroups).forEach(location => {
      // Most recent memory at this spot drives the pin photo
      const primary = location.memories[0];
      const marker = L.marker([location.latitude, location.longitude], {
        icon: createPhotoIcon(primary),
        _memory: primary, // stored so cluster icon can read it
      });

      const popupContent = createPopupContent(location.memories, onMemoryClick);
      marker.bindPopup(popupContent, { maxWidth: 320, className: 'memory-popup' });

      marker.on('click', () => {
        if (onLocationClick) onLocationClick(location);
      });

      markerClusterRef.current.addLayer(marker);
    });

    if (memories.length > 0) {
      const bounds = memories
        .filter(m => m.latitude && m.longitude)
        .map(m => [m.latitude, m.longitude]);
      if (bounds.length > 0) {
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    }
  }, [memories, mapReady, onMemoryClick, onLocationClick]);

  return (
    <div className="w-full h-full relative">
      <div 
        ref={mapRef} 
        className="w-full h-full"
        style={{ minHeight: '400px' }}
      />
      
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-sm z-[1000]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
            <p className="text-text-secondary-light dark:text-text-secondary-dark">
              Cargando recuerdos...
            </p>
          </div>
        </div>
      )}
      
      {/* Empty state overlay - only show when not loading */}
      {!loading && memories.length === 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none">
          <div className="bg-white dark:bg-surface-dark shadow-card rounded-xl px-6 py-4 text-center">
            <p className="text-4xl mb-2">🗺️</p>
            <p className="font-medium text-text-primary-light dark:text-text-primary-dark mb-1">
              No hay recuerdos aún
            </p>
            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
              Presiona el botón + para crear tu primer recuerdo
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to create popup HTML
function createPopupContent(memories, onMemoryClick) {
  const container = document.createElement('div');
  container.className = 'memory-popup-content';

  // Header
  const header = document.createElement('div');
  header.className = 'bg-primary/10 px-4 py-3 border-b border-gray-200 dark:border-gray-700';
  header.innerHTML = `
    <h3 class="font-bold text-gray-900 dark:text-gray-100">
      📍 ${memories[0].location_name || memories[0].location || 'Ubicación'}
    </h3>
    <p class="text-sm text-gray-600 dark:text-gray-400">
      ${memories.length} ${memories.length === 1 ? 'recuerdo' : 'recuerdos'} en este lugar
    </p>
  `;
  container.appendChild(header);

  // Memory list
  const list = document.createElement('div');
  list.className = 'divide-y divide-gray-200 dark:divide-gray-700 max-h-64 overflow-y-auto';
  
  memories.slice(0, 5).forEach(memory => {
    const item = document.createElement('div');
    item.className = 'flex gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors';
    item.onclick = () => {
      if (onMemoryClick) onMemoryClick(memory);
    };

    const img = memory.thumbnail_url || memory.image_url;
    item.innerHTML = `
      <img 
        src="${img}" 
        alt="Memory"
        class="w-20 h-20 rounded-lg object-cover flex-shrink-0"
        loading="lazy"
      />
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
          ${memory.description_raw?.substring(0, 50) || 'Sin descripción'}...
        </p>
        <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">
          🕐 ${formatDate(memory.created_at)}
        </p>
        ${memory.people?.length > 0 ? `
          <p class="text-xs text-gray-600 dark:text-gray-400">
            👤 Con ${memory.people.map(p => p.name).join(', ')}
          </p>
        ` : ''}
      </div>
    `;
    list.appendChild(item);
  });
  container.appendChild(list);

  // View all button if more than 5
  if (memories.length > 5) {
    const footer = document.createElement('div');
    footer.className = 'border-t border-gray-200 dark:border-gray-700 p-3';
    footer.innerHTML = `
      <button class="w-full text-center text-sm font-medium text-primary hover:text-primary-hover transition-colors">
        Ver todos (${memories.length}) →
      </button>
    `;
    container.appendChild(footer);
  }

  return container;
}

// Helper function to format date
function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
  if (diffDays < 7) return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
  
  return date.toLocaleDateString('es-MX', { 
    day: 'numeric', 
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
  });
}
