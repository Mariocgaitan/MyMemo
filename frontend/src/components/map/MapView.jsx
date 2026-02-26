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

      // No Leaflet popup — click opens the modal in parent
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
  }, [memories, mapReady, onLocationClick]);

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
