/**
 * LocationPickerModal — pick a location from a Leaflet map.
 * Clicking the map moves the pin; dragging the pin also works.
 * Has a "Use my GPS" button as shortcut.
 */
import { useEffect, useRef, useState } from 'react';
import { Navigation, X, Check, Loader2 } from 'lucide-react';

// Default center: Mexico City
const DEFAULT_CENTER = [19.4326, -99.1332];
const DEFAULT_ZOOM = 13;
const MAP_HEIGHT = 360; // explicit px — Leaflet requires this

// Lazily load Leaflet so it only runs in the browser
async function loadLeaflet() {
  const L = (await import('leaflet')).default;
  await import('leaflet/dist/leaflet.css');
  return L;
}

export default function LocationPickerModal({ isOpen, onClose, onConfirm, initialLat, initialLng }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const [coords, setCoords] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [mapReady, setMapReady] = useState(false);

  // initialise map when opened
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    // Wait for the DOM to paint, then initialise Leaflet
    const tid = setTimeout(async () => {
      if (cancelled || !mapRef.current || mapInstanceRef.current) return;

      const L = await loadLeaflet();
      if (cancelled || !mapRef.current || mapInstanceRef.current) return;

      const startLat = initialLat || DEFAULT_CENTER[0];
      const startLng = initialLng || DEFAULT_CENTER[1];

      const map = L.map(mapRef.current, {
        center: [startLat, startLng],
        zoom: DEFAULT_ZOOM,
        zoomControl: true,
        scrollWheelZoom: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Custom pin icon
      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:32px;height:44px;
          background:#8B6F47;
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          border:3px solid white;
          box-shadow:0 3px 10px rgba(0,0,0,0.35);
        "></div>`,
        iconSize: [32, 44],
        iconAnchor: [16, 44],
      });

      const marker = L.marker([startLat, startLng], { icon, draggable: true }).addTo(map);
      markerRef.current = marker;
      mapInstanceRef.current = map;

      const updateCoords = (lat, lng) => {
        setCoords({ lat: parseFloat(lat.toFixed(6)), lng: parseFloat(lng.toFixed(6)) });
      };

      if (initialLat && initialLng) {
        updateCoords(initialLat, initialLng);
      }

      // Click on map → move marker
      map.on('click', (e) => {
        marker.setLatLng(e.latlng);
        updateCoords(e.latlng.lat, e.latlng.lng);
      });

      // Drag marker
      marker.on('dragend', () => {
        const ll = marker.getLatLng();
        updateCoords(ll.lat, ll.lng);
      });

      setMapReady(true);
    }, 80);

    return () => {
      cancelled = true;
      clearTimeout(tid);
    };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clean up map when closed
  useEffect(() => {
    if (!isOpen && mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
      setCoords(null);
      setGpsError('');
      setMapReady(false);
    }
  }, [isOpen]);

  const handleUseGPS = () => {
    if (!navigator.geolocation) {
      setGpsError('Tu dispositivo no soporta GPS');
      return;
    }
    setGpsLoading(true);
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setGpsLoading(false);
        setCoords({ lat: parseFloat(latitude.toFixed(6)), lng: parseFloat(longitude.toFixed(6)) });
        if (mapInstanceRef.current && markerRef.current) {
          const ll = [latitude, longitude];
          mapInstanceRef.current.setView(ll, 16);
          markerRef.current.setLatLng(ll);
        }
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === 1) {
          setGpsError('Permiso denegado — activa la ubicación en tu navegador');
        } else {
          setGpsError('No se pudo obtener el GPS. Selecciona el punto en el mapa.');
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  };

  const handleConfirm = () => {
    if (!coords) return;
    onConfirm(coords.lat, coords.lng);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet — no overflow-hidden so Leaflet controls render correctly */}
      <div
        className="relative z-10 w-full sm:max-w-lg bg-surface-light dark:bg-surface-dark rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-light dark:border-border-dark flex-shrink-0">
          <h2 className="font-bold text-text-primary-light dark:text-text-primary-dark">
            Elige la ubicación
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-primary/10 text-text-secondary-light dark:text-text-secondary-dark"
          >
            <X size={18} />
          </button>
        </div>

        {/* GPS row */}
        <div className="px-4 py-2 flex items-center gap-3 border-b border-border-light dark:border-border-dark flex-shrink-0 bg-background-light dark:bg-background-dark">
          <button
            onClick={handleUseGPS}
            disabled={gpsLoading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {gpsLoading ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
            {gpsLoading ? 'Buscando...' : 'Usar mi GPS'}
          </button>
          <span className="text-xs flex-1">
            {gpsError ? (
              <span className="text-yellow-600 dark:text-yellow-400">{gpsError}</span>
            ) : coords ? (
              <span className="text-green-600 dark:text-green-400">
                {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
              </span>
            ) : (
              <span className="text-text-secondary-light dark:text-text-secondary-dark">
                Toca el mapa para fijar el punto
              </span>
            )}
          </span>
        </div>

        {/* Map container — explicit height so Leaflet can measure it */}
        <div style={{ position: 'relative', height: MAP_HEIGHT, flexShrink: 0 }}>
          {/* Loading placeholder while Leaflet loads */}
          {!mapReady && (
            <div
              style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--color-surface, #f5f5f5)',
              }}
            >
              <Loader2 size={28} className="animate-spin text-primary" />
            </div>
          )}
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border-light dark:border-border-dark flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border-2 border-border-light dark:border-border-dark text-sm font-semibold text-text-primary-light dark:text-text-primary-dark hover:border-primary transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!coords}
            className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Check size={16} /> Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
