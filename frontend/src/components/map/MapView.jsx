import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const BASE_CLUSTER_RADIUS_METERS = 1000;

// Inject photo marker CSS once
const PHOTO_MARKER_CSS = `
  .photo-marker {
    background: none !important;
    border: none !important;
  }
  .photo-marker-inner {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    overflow: hidden;
    border: 3px solid white;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    background: #1f2937;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .photo-marker-inner img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .photo-marker-inner .photo-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
  }
  .photo-cluster {
    background: none !important;
    border: none !important;
  }
  .photo-cluster-inner {
    position: relative;
    width: 56px;
    height: 56px;
    border-radius: 8px;
    overflow: hidden;
    border: 3px solid white;
    box-shadow: 0 4px 14px rgba(0,0,0,0.4);
    background: #1f2937;
    display: flex;
    align-items: center;
    justify-content: center;
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
    font-size: 28px;
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
    <div class="photo-marker-inner" style="background-color: #1f2937 !important;">
      ${imgSrc
      ? `<img src="${imgSrc}" alt="" loading="lazy" />`
      : `<div class="photo-placeholder" style="font-size:20px;color:#6b7280;">+</div>`
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
function createClusterIconFromMemory(memory, count) {
  const imgSrc = memory?.thumbnail_url || memory?.image_url;
  const html = `
    <div class="photo-cluster-inner" style="background-color: #1f2937 !important;">
      ${imgSrc
      ? `<img src="${imgSrc}" alt="" loading="lazy" />`
      : `<div class="cluster-placeholder" style="font-size:20px;color:#6b7280;">+</div>`
    }
    </div>
  `;
  return L.divIcon({
    html,
    className: 'photo-cluster',
    iconSize: [56, 56],
    iconAnchor: [28, 28],
  });
}

function getMemoryTimestamp(memory) {
  return new Date(memory.memory_date || memory.created_at).getTime() || 0;
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getDynamicRadiusMeters(zoom) {
  const safeZoom = Number.isFinite(zoom) ? zoom : 12;
  const scaleFactor = Math.pow(2, 12 - safeZoom);
  const dynamic = BASE_CLUSTER_RADIUS_METERS * scaleFactor;
  return Math.max(120, Math.min(1600, dynamic));
}

function clusterMemoriesByRadius(memories, radiusMeters) {
  const clusters = [];

  for (const memory of memories) {
    if (!memory.latitude || !memory.longitude) continue;

    const lat = Number(memory.latitude);
    const lon = Number(memory.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    let matched = null;
    for (const cluster of clusters) {
      const d = haversineMeters(lat, lon, cluster.centerLat, cluster.centerLon);
      if (d <= radiusMeters) {
        matched = cluster;
        break;
      }
    }

    if (!matched) {
      clusters.push({
        centerLat: lat,
        centerLon: lon,
        memories: [memory],
      });
      continue;
    }

    matched.memories.push(memory);
    const n = matched.memories.length;
    matched.centerLat = ((matched.centerLat * (n - 1)) + lat) / n;
    matched.centerLon = ((matched.centerLon * (n - 1)) + lon) / n;
  }

  for (const cluster of clusters) {
    cluster.memories.sort((a, b) => getMemoryTimestamp(b) - getMemoryTimestamp(a));
    cluster.preview = cluster.memories[0] || null;
  }

  return clusters;
}

export default function MapView({ memories = [], onMemoryClick, loading = false, focusPoint = null }) {
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerLayerRef = useRef(null);
  const fittedRef = useRef(false);
  const [zoom, setZoom] = useState(12);
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

    const markerLayer = L.layerGroup();
    map.addLayer(markerLayer);
    mapInstanceRef.current = map;
    markerLayerRef.current = markerLayer;

    const handleZoomEnd = () => {
      setZoom(map.getZoom());
    };
    map.on('zoomend', handleZoomEnd);

    setMapReady(true);

    return () => {
      map.off('zoomend', handleZoomEnd);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Fit bounds when memory dataset changes.
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;

    if (memories.length === 0) {
      fittedRef.current = false;
      return;
    }

    const bounds = memories
      .filter(m => m.latitude && m.longitude)
      .map(m => [m.latitude, m.longitude]);

    if (bounds.length > 0 && !fittedRef.current) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      fittedRef.current = true;
    }
  }, [memories, mapReady]);

  // Pan/zoom to searched place from parent page.
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !focusPoint) return;

    const lat = Number(focusPoint.latitude);
    const lon = Number(focusPoint.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    mapInstanceRef.current.flyTo([lat, lon], Math.max(mapInstanceRef.current.getZoom(), 14), {
      duration: 0.8,
    });
  }, [focusPoint, mapReady]);

  // Update markers and clusters when data or zoom changes.
  useEffect(() => {
    if (!mapReady || !markerLayerRef.current) return;

    markerLayerRef.current.clearLayers();

    const radiusMeters = getDynamicRadiusMeters(zoom);
    const clusters = clusterMemoriesByRadius(memories, radiusMeters);

    clusters.forEach(cluster => {
      const isSingle = cluster.memories.length === 1;
      const marker = L.marker([cluster.centerLat, cluster.centerLon], {
        icon: isSingle
          ? createPhotoIcon(cluster.memories[0])
          : createClusterIconFromMemory(cluster.preview, cluster.memories.length),
      });

      marker.on('click', () => {
        if (isSingle) {
          if (onMemoryClick) onMemoryClick(cluster.memories[0]);
          return;
        }

        // Navigate to Timeline with the cluster memories as state
        const locationName = cluster.memories[0]?.location_name || 'Zona';
        navigate('/timeline', {
          state: {
            clusterMemories: cluster.memories,
            clusterLabel: locationName,
          },
        });
      });

      markerLayerRef.current.addLayer(marker);
    });
  }, [memories, mapReady, onMemoryClick, zoom, navigate]);

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
