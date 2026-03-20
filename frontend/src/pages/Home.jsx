import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, MapPin, Navigation, ArrowRight, Users, Tag, Plus, Calendar } from 'lucide-react';
import { Input, Chip } from '../components/ui';
import Modal from '../components/ui/Modal';
import MapView from '../components/map/MapView';
import { memoryAPI, peopleAPI, searchAPI, categoriesAPI, connectionsAPI } from '../services/api';

// Helper to safely parse ai_metadata which might come as a string
const parseMetadata = (metadata) => {
  if (!metadata) return {};
  if (typeof metadata === 'string') {
    try { return JSON.parse(metadata); } catch { return {}; }
  }
  return metadata;
};

export default function Home() {
  const navigate = useNavigate();
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedPeople, setSelectedPeople] = useState([]);
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null); // null = not searching
  const [searchLoading, setSearchLoading] = useState(false);
  const [placeSearchQuery, setPlaceSearchQuery] = useState('');
  const [placeResults, setPlaceResults] = useState([]);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [placeError, setPlaceError] = useState('');
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [categories, setCategories] = useState([]);
  const [people, setPeople] = useState([]);
  const [connections, setConnections] = useState([]);
  const [locationModal, setLocationModal] = useState(null);
  const [nearbyResults, setNearbyResults] = useState(null); // null = not active
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState('');
  const [newCatLabel, setNewCatLabel] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const searchDebounceRef = useRef(null);
  const placeDebounceRef = useRef(null);

  // Load categories from backend on mount
  useEffect(() => {
    categoriesAPI.getAll()
      .then(cats => { if (cats.length > 0) setCategories(cats); })
      .catch(() => {});
    // Clean up any leftover localStorage key from old version
    localStorage.removeItem('mymemo_categories');
  }, []);

  // Fetch memories AND people from backend
  useEffect(() => {
    fetchMemories();
    fetchPeople();
    fetchConnections();
  }, []);

  useEffect(() => () => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (placeDebounceRef.current) clearTimeout(placeDebounceRef.current);
  }, []);

  const fetchMemories = async () => {
    try {
      setLoading(true);
      const response = await memoryAPI.getAllPages({ pageSize: 100 });
      // Keep full history for map so older memories never disappear due to pagination.
      setMemories(response.memories || []);
    } catch (error) {
      console.error('Error fetching memories:', error);
      setMemories([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPeople = async () => {
    try {
      const data = await peopleAPI.getAll();
      const named = (data || []).filter(p => !p.name.startsWith('Unknown Person'));
      setPeople(named);
    } catch (error) {
      console.error('Error fetching people:', error);
    }
  };

  const fetchConnections = async () => {
    try {
      const data = await connectionsAPI.list();
      setConnections(data || []);
    } catch (error) {
      console.error('Error fetching connections:', error);
      setConnections([]);
    }
  };

  // Debounced API search — fires 400ms after the user stops typing
  const handleSearchChange = useCallback((e) => {
    const value = e.target.value;
    setSearchQuery(value);

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    if (!value.trim()) {
      setSearchResults(null);
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      try {
        setSearchLoading(true);
        const results = await searchAPI.text(value.trim(), { limit: 200 });
        const apiResults = results.memories || results || [];
        // Solo reemplazar si la API devuelve algo — si devuelve vacío,
        // mantener client-side para evitar falsos "sin resultados"
        setSearchResults(apiResults.length > 0 ? apiResults : null);
      } catch (err) {
        console.error('Search error:', err);
        setSearchResults(null); // fall back to client-side
      } finally {
        setSearchLoading(false);
      }
    }, 400);
  }, []);

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
  };

  const handlePlaceSearchChange = useCallback((e) => {
    const value = e.target.value;
    setPlaceSearchQuery(value);
    setPlaceError('');

    if (placeDebounceRef.current) clearTimeout(placeDebounceRef.current);

    if (!value.trim() || value.trim().length < 2) {
      setPlaceResults([]);
      return;
    }

    placeDebounceRef.current = setTimeout(async () => {
      try {
        setPlaceLoading(true);
        const data = await searchAPI.placesAutocomplete(value.trim(), { country: 'mx', language: 'es' });
        setPlaceResults(data.predictions || []);
      } catch (err) {
        console.error('Place autocomplete error:', err);
        setPlaceResults([]);
        setPlaceError(err.response?.data?.detail || 'No se pudo buscar lugares');
      } finally {
        setPlaceLoading(false);
      }
    }, 350);
  }, []);

  const clearPlaceSearch = () => {
    setPlaceSearchQuery('');
    setPlaceResults([]);
    setPlaceError('');
    setSelectedPlace(null);
    if (placeDebounceRef.current) clearTimeout(placeDebounceRef.current);
  };

  const selectPlaceResult = async (prediction) => {
    try {
      setPlaceLoading(true);
      setPlaceError('');
      const geocoded = await searchAPI.geocodePlace(prediction.place_id, { language: 'es' });

      setSelectedPlace({
        latitude: geocoded.latitude,
        longitude: geocoded.longitude,
        label: geocoded.formatted_address || prediction.description,
      });
      setPlaceSearchQuery(geocoded.formatted_address || prediction.description || '');
      setPlaceResults([]);
      setNearbyResults(null);
    } catch (err) {
      console.error('Place geocode error:', err);
      setPlaceError(err.response?.data?.detail || 'No se pudo ubicar este lugar');
    } finally {
      setPlaceLoading(false);
    }
  };

  const handleNearbySearch = () => {
    if (!navigator.geolocation) {
      setNearbyError('Tu dispositivo no soporta geolocalización');
      return;
    }
    setNearbyLoading(true);
    setNearbyError('');
    setNearbyResults(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const results = await searchAPI.nearby(latitude, longitude, 5);
          const list = results.memories || results || [];
          setNearbyResults(list);
        } catch (e) {
          const errMsg = e.response?.data?.detail || e.message || 'Error desconocido';
          setNearbyError(`Error del servidor: ${errMsg}`);
        } finally {
          setNearbyLoading(false);
        }
      },
      (err) => {
        console.error("GPS Error:", err);
        setNearbyError(`No se pudo obtener tu ubicación: ${err.message || 'Desconocido'}`);
        setNearbyLoading(false);
      },
      {
        enableHighAccuracy: false, // Prevents 10s hang on desktop/some mobiles
        maximumAge: 300000,        // 5 mins cache
        timeout: 15000             // 15 seconds to give mobile enough time
      }
    );
  };

  const clearNearby = () => setNearbyResults(null);

  // Sort categories by usage count across loaded memories
  const sortedCategories = [...categories].sort((a, b) => {
    const count = (val) => memories.filter(m => {
      const meta = parseMetadata(m.ai_metadata);
      return (meta.user_categories || []).includes(val);
    }).length;
    return count(b.value) - count(a.value);
  });

  // Sort people by times_detected (most seen first)
  const sortedPeople = [...people].sort(
    (a, b) => (b.times_detected || 0) - (a.times_detected || 0)
  );

  const toggleCategory = (category) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const togglePerson = (personId) => {
    setSelectedPeople(prev =>
      prev.includes(personId)
        ? prev.filter(p => p !== personId)
        : [...prev, personId]
    );
  };

  // Base list: nearby > API search > all loaded memories
  const baseMemories = nearbyResults !== null
    ? nearbyResults
    : searchResults !== null
      ? searchResults
      : memories;

  // Apply category and people filters on top
  const filteredMemories = baseMemories.filter(memory => {
    const meta = parseMetadata(memory.ai_metadata);

    // Client-side fallback text filter (when API search not yet returned or no query)
    if (searchQuery.trim() && searchResults === null) {
      const q = searchQuery.toLowerCase();
      const inDesc = (memory.description_raw || '').toLowerCase().includes(q);
      const inLocation = (memory.location_name || '').toLowerCase().includes(q);
      const inTags = (meta.nlp?.tags || []).some(t => t.toLowerCase().includes(q));
      if (!inDesc && !inLocation && !inTags) return false;
    }

    // Category filter
    if (selectedCategories.length > 0) {
      const memCats = meta.user_categories || [];
      const hasCategory = selectedCategories.some(cat => memCats.includes(cat));
      if (!hasCategory) return false;
    }

    // People filter
    if (selectedPeople.length > 0) {
      const memFaces = meta.faces || [];
      const faceIds = memFaces.map(f => f.person_id);
      let hasPerson = selectedPeople.some(pid => faceIds.includes(pid));

      // Shared-memory bridge: selected person IDs are local, but shared memories
      // may contain partner-side person IDs. Match by connection + shared_by user.
      if (!hasPerson && memory.shared_by?.user_id) {
        const partnerId = String(memory.shared_by.user_id);
        const conn = connections.find(c =>
          String(c.requester?.id) === partnerId || String(c.addressee?.id) === partnerId
        );

        if (conn) {
          const myLocalPersonForPartner = String(conn.requester?.id) === partnerId
            ? conn.person_id_in_addressee
            : conn.person_id_in_requester;

          if (myLocalPersonForPartner) {
            hasPerson = selectedPeople.some(pid => String(pid) === String(myLocalPersonForPartner));
          }
        }
      }

      // Fallback for legacy/stale link data: match selected person name with shared partner name.
      if (!hasPerson && memory.shared_by?.name) {
        const partnerName = String(memory.shared_by.name).trim().toLowerCase();
        hasPerson = selectedPeople.some(pid => {
          const selected = people.find(p => String(p.id) === String(pid));
          return selected?.name && String(selected.name).trim().toLowerCase() === partnerName;
        });
      }

      if (!hasPerson) return false;
    }

    return true;
  });

  const addCategory = async () => {
    if (!newCatLabel.trim()) return;
    const label = newCatLabel.trim();
    const value = label.toLowerCase().replace(/\s+/g, '_');
    const newCat = { id: `cat_${Date.now()}`, label, value };
    const updated = [...categories, newCat];
    setCategories(updated);
    setNewCatLabel('');
    setAddingCat(false);
    try {
      await categoriesAPI.save(updated);
    } catch (e) {
      console.error('Error saving category:', e);
    }
  };

  const removeCategory = async (catId) => {
    const updated = categories.filter(c => c.id !== catId);
    setCategories(updated);
    try {
      await categoriesAPI.save(updated);
    } catch (e) {
      console.error('Error saving category:', e);
    }
  };

  const handleMemoryClick = (memory) => {
    navigate(`/memory/${memory.id}`);
  };

  const handleLocationClick = (location) => {
    setLocationModal(location);
  };

  const groupedLocationMemories = locationModal
    ? groupMemoriesByDay(locationModal.memories || [])
    : [];

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col">
      {/* Search and Filters */}
      <div className="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark p-4 space-y-3">
        {/* Search bar + geo button + filters toggle */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              placeholder="Buscar por frase, tags, lugar..."
              value={searchQuery}
              onChange={handleSearchChange}
              startIcon={searchLoading
                ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                : <Search size={20} />}
              className="flex-1 w-full"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light"
              >
                <X size={16} />
              </button>
            )}
          </div>
          {/* Nearby search button */}
          <button
            onClick={handleNearbySearch}
            disabled={nearbyLoading}
            title="Buscar memorias cerca de aqui"
            className={`px-3 py-2 rounded-xl border-2 transition-colors flex items-center gap-1 ${nearbyResults !== null
              ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
              : 'border-border-light dark:border-border-dark hover:border-primary text-text-primary-light dark:text-text-primary-dark'
              } disabled:opacity-50`}
          >
            {nearbyLoading
              ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              : <Navigation size={16} />}
          </button>
        </div>

        {/* Place search input */}
        <div className="relative">
          <Input
            placeholder="Buscar lugar en el mapa (Google)"
            value={placeSearchQuery}
            onChange={handlePlaceSearchChange}
            startIcon={placeLoading
              ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              : <MapPin size={18} />}
            className="w-full"
          />
          {placeSearchQuery && (
            <button
              onClick={clearPlaceSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light"
              aria-label="Limpiar búsqueda de lugar"
            >
              <X size={16} />
            </button>
          )}

          {placeResults.length > 0 && (
            <div className="absolute z-[1100] mt-1 w-full rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark shadow-lg overflow-hidden">
              {placeResults.slice(0, 6).map((result) => (
                <button
                  key={result.place_id}
                  onClick={() => selectPlaceResult(result)}
                  className="w-full px-4 py-3 text-left hover:bg-primary/10 transition-colors border-b border-border-light dark:border-border-dark last:border-b-0"
                >
                  <p className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                    {result.main_text || result.description}
                  </p>
                  {result.secondary_text && (
                    <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-0.5">
                      {result.secondary_text}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {placeError && (
          <p className="text-xs text-red-500 px-1">{placeError}</p>
        )}

        {selectedPlace && (
          <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-2">
            <MapPin size={14} className="text-blue-600 flex-shrink-0" />
            <span className="text-sm text-blue-800 dark:text-blue-300 flex-1 truncate">
              Mapa centrado en: {selectedPlace.label}
            </span>
            <button onClick={() => setSelectedPlace(null)} className="text-blue-700 dark:text-blue-400 hover:text-blue-900">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Nearby active banner */}
        {nearbyResults !== null && (
          <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-2">
            <MapPin size={14} className="text-green-600 flex-shrink-0" />
            <span className="text-sm text-green-800 dark:text-green-300 flex-1">
              {nearbyResults.length > 0
                ? `${nearbyResults.length} memoria${nearbyResults.length !== 1 ? 's' : ''} cerca de ti (5 km)`
                : 'Sin memorias en un radio de 5 km'}
            </span>
            <button onClick={clearNearby} className="text-green-700 dark:text-green-400 hover:text-green-900">
              <X size={14} />
            </button>
          </div>
        )}
        {nearbyError && (
          <p className="text-xs text-red-500 px-1">{nearbyError}</p>
        )}

        {/* Horizontal scroll filter rows */}
        <div className="space-y-1">
          {/* ── Categorías row ── */}
          <div className="flex items-center gap-2">
            {/* Fixed label */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <Tag size={12} className="text-primary" />
              <span className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                Cats
              </span>
              {selectedCategories.length > 0 && (
                <span className="text-white bg-primary rounded-full px-1.5 py-0.5 text-[10px] leading-none">{selectedCategories.length}</span>
              )}
            </div>
            {/* Scrollable chips */}
            <div className="flex-1 overflow-x-auto scrollbar-hide">
              <div className="flex items-center gap-1.5 pb-0.5" style={{ width: 'max-content' }}>
                {sortedCategories.map(cat => (
                  <div key={cat.id} className="relative group flex items-center flex-shrink-0">
                    <Chip
                      selected={selectedCategories.includes(cat.value)}
                      onClick={() => toggleCategory(cat.value)}
                    >
                      {cat.label}
                    </Chip>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeCategory(cat.id); }}
                      className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      title="Eliminar"
                    >
                      <X size={8} />
                    </button>
                  </div>
                ))}
                {/* Add new category */}
                {addingCat ? (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <input
                      autoFocus
                      value={newCatLabel}
                      onChange={e => setNewCatLabel(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') addCategory();
                        if (e.key === 'Escape') { setAddingCat(false); setNewCatLabel(''); }
                      }}
                      placeholder="Nombre..."
                      className="text-xs px-2 py-1 rounded-full border border-primary bg-background-light dark:bg-background-dark text-text-primary-light dark:text-text-primary-dark focus:outline-none w-24"
                    />
                    <button onClick={addCategory} className="text-xs text-primary font-medium hover:text-primary-hover flex-shrink-0">OK</button>
                    <button onClick={() => { setAddingCat(false); setNewCatLabel(''); }} className="flex-shrink-0 text-text-secondary-light dark:text-text-secondary-dark"><X size={12} /></button>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingCat(true)}
                    className="flex-shrink-0 flex items-center gap-0.5 text-xs text-primary hover:text-primary-hover font-medium px-2 py-1 rounded-full border border-dashed border-primary/40 hover:border-primary transition-colors"
                  >
                    <Plus size={11} /> Nueva
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Personas row ── */}
          {sortedPeople.length > 0 && (
            <div className="flex items-center gap-2">
              {/* Fixed label */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <Users size={12} className="text-primary" />
                <span className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                  Gente
                </span>
                {selectedPeople.length > 0 && (
                  <span className="text-white bg-primary rounded-full px-1.5 py-0.5 text-[10px] leading-none">{selectedPeople.length}</span>
                )}
              </div>
              {/* Scrollable chips */}
              <div className="flex-1 overflow-x-auto scrollbar-hide">
                <div className="flex items-center gap-1.5 pb-0.5" style={{ width: 'max-content' }}>
                  {sortedPeople.map(person => (
                    <Chip
                      key={person.id}
                      selected={selectedPeople.includes(person.id)}
                      onClick={() => togglePerson(person.id)}
                      className="flex-shrink-0"
                    >
                      {person.name}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Clear filters */}
          {(selectedCategories.length > 0 || selectedPeople.length > 0) && (
            <button
              onClick={() => { setSelectedCategories([]); setSelectedPeople([]); }}
              className="text-xs text-primary hover:text-primary-hover font-medium flex items-center gap-1"
            >
              <X size={11} /> Limpiar ({selectedCategories.length + selectedPeople.length})
            </button>
          )}
        </div>
      </div>

      {/* Map Container - 60% height */}
      <div className="flex-[3] relative">
        <MapView
          memories={filteredMemories}
          onMemoryClick={handleMemoryClick}
          onLocationClick={handleLocationClick}
          loading={loading}
          focusPoint={selectedPlace}
        />
      </div>

      {/* Location Modal */}
      <Modal
        isOpen={!!locationModal}
        onClose={() => setLocationModal(null)}
        title={locationModal?.location_name || locationModal?.memories?.[0]?.location_name || 'Recuerdos en esta zona'}
        size="lg"
      >
        {locationModal && (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
              {locationModal.memories.length} {locationModal.memories.length === 1 ? 'recuerdo' : 'recuerdos'} en este lugar
            </p>
            <div className="space-y-6">
              {groupedLocationMemories.map(group => (
                <div key={group.label}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-px flex-1 bg-border-light dark:bg-border-dark" />
                    <span className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide px-2">
                      {group.label}
                    </span>
                    <div className="h-px flex-1 bg-border-light dark:bg-border-dark" />
                  </div>

                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    {group.memories.map(memory => {
                      const shared = memory.shared_by;
                      const cardStyle = shared ? {
                        border: `2px ${shared.border_style === 'glow' ? 'solid' : (shared.border_style || 'solid')} ${shared.border_color || '#6366f1'}`,
                        boxShadow: shared.border_style === 'glow' ? `0 0 10px ${shared.border_color}80` : undefined,
                      } : {};

                      return (
                        <div
                          key={memory.id}
                          className={`flex-shrink-0 w-56 cursor-pointer bg-surface-light dark:bg-surface-dark rounded-xl overflow-hidden hover:shadow-md transition-shadow${!shared ? ' border border-border-light dark:border-border-dark' : ''}`}
                          style={shared ? cardStyle : undefined}
                          onClick={() => { setLocationModal(null); navigate(`/memory/${memory.id}`); }}
                        >
                          <div className="relative h-40 bg-gray-100 dark:bg-gray-800">
                            <img
                              src={memory.thumbnail_url || memory.image_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                              {new Date(memory.memory_date || memory.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                          </div>
                          <div className="p-3">
                            <p className="text-sm text-text-primary-light dark:text-text-primary-dark line-clamp-2">
                              {memory.description_raw || 'Sin descripción'}
                            </p>
                            <button
                              className="mt-2 flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-hover transition-colors"
                            >
                              Ver detalle <ArrowRight size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Timeline pill — compact, navigates to /timeline */}
      <button
        onClick={() => navigate('/timeline')}
        className="bg-surface-light dark:bg-surface-dark border-t-2 border-border-light dark:border-border-dark px-5 py-5 flex items-center justify-between hover:bg-primary/5 active:bg-primary/10 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Calendar size={16} className="text-primary" />
          </div>
          <div className="flex flex-col items-start">
            <span className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark leading-tight">Línea de tiempo</span>
            <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
              {memories.length > 0 ? `${memories.length} recuerdo${memories.length !== 1 ? 's' : ''}` : 'Ver todos los recuerdos'}
            </span>
          </div>
        </div>
        <ArrowRight size={18} className="text-primary" />
      </button>
    </div>
  );
}

function groupMemoriesByDay(memories) {
  const sorted = [...memories].sort(
    (a, b) => new Date(b.memory_date || b.created_at) - new Date(a.memory_date || a.created_at)
  );

  const groups = sorted.reduce((acc, memory) => {
    const d = new Date(memory.memory_date || memory.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const label = d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
    if (!acc[key]) acc[key] = { label, date: d, memories: [] };
    acc[key].memories.push(memory);
    return acc;
  }, {});

  return Object.values(groups).sort((a, b) => b.date - a.date);
}
