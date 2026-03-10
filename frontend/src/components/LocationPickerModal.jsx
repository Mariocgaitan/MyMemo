/**
 * LocationPickerModal — pick a location from a Leaflet map.
 * Includes Nominatim geocoding search, GPS button, and draggable pin.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, X, Check, Loader2, Search } from 'lucide-react';

// Default center: Mexico City
const DEFAULT_CENTER = [19.4326, -99.1332];
const DEFAULT_ZOOM = 13;
const MAP_HEIGHT = 360;

export default function LocationPickerModal({ isOpen, onClose, onConfirm, initialLat, initialLng }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const searchDebounceRef = useRef(null);
  const [coords, setCoords] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [mapReady, setMapReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const moveMarker = useCallback((lat, lng) => {
    if (mapInstanceRef.current && markerRef.current) {
      const ll = [lat, lng];
      mapInstanceRef.current.setView(ll, mapInstanceRef.current.getZoom() < 14 ? 15 : mapInstanceRef.current.getZoom());
      markerRef.current.setLatLng(ll);
    }
    setCoords({ lat: parseFloat(lat.toFixed(6)), lng: parseFloat(lng.toFixed(6)) });
  }, []);

  const searchPlaces = useCallback(async (query) => {
    if (!query.trim() || query.trim().length < 3) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'es' } });
      const data = await res.json();
      setSearchResults(data);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => searchPlaces(val), 500);
  };

  const handleSelectResult = (result) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    moveMarker(lat, lng);
    setSearchResults([]);
    setSearchQuery(result.display_name.split(',').slice(0, 2).join(', '));
  };

  // initialise map when opened
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const tid = setTimeout(() => {
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
      setSearchQuery('');
      setSearchResults([]);
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
        moveMarker(latitude, longitude);
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

        {/* Search + GPS row */}
        <div className="px-4 py-2 flex items-center gap-2 border-b border-border-light dark:border-border-dark flex-shrink-0 bg-background-light dark:bg-background-dark relative">
          {/* Search input */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary-light dark:text-text-secondary-dark pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Buscar lugar..."
              className="w-full pl-8 pr-3 py-2 rounded-xl text-sm border-2 border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-text-primary-light dark:text-text-primary-dark placeholder:text-text-secondary-light focus:border-primary focus:outline-none transition-colors"
            />
            {searchLoading && (
              <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-primary" />
            )}
          </div>

          {/* GPS button */}
          <button
            onClick={handleUseGPS}
            disabled={gpsLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 flex-shrink-0"
            title="Usar mi GPS"
          >
            {gpsLoading ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
            <span className="hidden sm:inline">{gpsLoading ? 'Buscando...' : 'GPS'}</span>
          </button>

          {/* Dropdown results — floats over the map */}
          {searchResults.length > 0 && (
            <div className="absolute left-4 right-4 top-full mt-1 z-[200] bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl shadow-xl overflow-hidden">
              {searchResults.map((r, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectResult(r)}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-primary/10 transition-colors border-b last:border-b-0 border-border-light dark:border-border-dark"
                >
                  <span className="font-medium text-text-primary-light dark:text-text-primary-dark line-clamp-1">
                    {r.display_name.split(',').slice(0, 2).join(', ')}
                  </span>
                  <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark line-clamp-1">
                    {r.display_name.split(',').slice(2, 4).join(', ')}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* GPS error or coords hint */}
        {(gpsError || coords) && (
          <div className="px-4 py-1.5 flex-shrink-0 bg-background-light dark:bg-background-dark">
            {gpsError ? (
              <p className="text-xs text-yellow-600 dark:text-yellow-400">{gpsError}</p>
            ) : coords ? (
              <p className="text-xs text-green-600 dark:text-green-400">
                📍 {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
              </p>
            ) : null}
          </div>
        )}

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
