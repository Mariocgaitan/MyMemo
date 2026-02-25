import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';

// Fix for default marker icons in Webpack/Vite
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export default function MapView({ memories = [], onMemoryClick, onLocationClick, loading = false }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerClusterRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Create map centered on CDMX (default)
    const map = L.map(mapRef.current, {
      center: [19.4326, -99.1332], // CDMX coordinates
      zoom: 12,
      zoomControl: true,
    });

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Create marker cluster group
    const markerCluster = L.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
    });
    
    map.addLayer(markerCluster);

    mapInstanceRef.current = map;
    markerClusterRef.current = markerCluster;
    setMapReady(true);

    // Cleanup on unmount
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

    // Clear existing markers
    markerClusterRef.current.clearLayers();

    // Group memories by location (to show count in popup)
    const locationGroups = memories.reduce((acc, memory) => {
      const key = `${memory.latitude},${memory.longitude}`;
      if (!acc[key]) {
        acc[key] = {
          latitude: memory.latitude,
          longitude: memory.longitude,
          memories: [],
        };
      }
      acc[key].memories.push(memory);
      return acc;
    }, {});

    // Create markers for each location
    Object.values(locationGroups).forEach(location => {
      const marker = L.marker([location.latitude, location.longitude]);

      // Create popup content
      const popupContent = createPopupContent(location.memories, onMemoryClick);
      marker.bindPopup(popupContent, {
        maxWidth: 320,
        className: 'memory-popup',
      });

      // Add click event for single location
      marker.on('click', () => {
        if (onLocationClick) {
          onLocationClick(location);
        }
      });

      markerClusterRef.current.addLayer(marker);
    });

    // Fit bounds to show all markers
    if (memories.length > 0) {
      const bounds = memories.map(m => [m.latitude, m.longitude]);
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
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
