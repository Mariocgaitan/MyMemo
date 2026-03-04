import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, X, MapPin, Navigation, ArrowRight, Calendar } from 'lucide-react';
import { Input, Chip } from '../components/ui';
import Modal from '../components/ui/Modal';
import MapView from '../components/map/MapView';
import { memoryAPI, peopleAPI, searchAPI } from '../services/api';

// Initial categories
const INITIAL_CATEGORIES = [
  { id: 'cat_1', label: 'GeitanVida', value: 'geitanvida' },
  { id: 'cat_2', label: 'ComidaBienRica', value: 'comidabienrica' },
  { id: 'cat_3', label: 'ConLasGuarras', value: 'conlasguarras' },
  { id: 'cat_4', label: 'Onichans', value: 'onichans' },
  { id: 'cat_5', label: 'Fititit', value: 'fititit' },
  { id: 'cat_6', label: 'Aestetik?', value: 'aestetik' },
  { id: 'cat_7', label: 'NerdBoy', value: 'nerdboy' },
  { id: 'cat_8', label: 'Famituki', value: 'famituki' },
];

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
  const [categories, setCategories] = useState([]);
  const [people, setPeople] = useState([]);
  const [locationModal, setLocationModal] = useState(null);
  const [nearbyResults, setNearbyResults] = useState(null); // null = not active
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState('');
  const searchDebounceRef = useRef(null);

  // Load categories from localStorage on mount
  useEffect(() => {
    const savedCategories = localStorage.getItem('mymemo_categories');
    if (savedCategories) {
      setCategories(JSON.parse(savedCategories));
    } else {
      setCategories(INITIAL_CATEGORIES);
      localStorage.setItem('mymemo_categories', JSON.stringify(INITIAL_CATEGORIES));
    }
  }, []);

  // Fetch memories AND people from backend
  useEffect(() => {
    fetchMemories();
    fetchPeople();
  }, []);

  const fetchMemories = async () => {
    try {
      setLoading(true);
      const response = await memoryAPI.getAll({ limit: 200, skip: 0 });
      // API returns { memories: [...], total, page, page_size, has_more }
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
      const hasPerson = selectedPeople.some(pid => faceIds.includes(pid));
      if (!hasPerson) return false;
    }

    return true;
  });

  const addCategory = () => {
    const label = prompt('Nombre de la categoría:');
    if (!label || !label.trim()) return;

    const value = label.toLowerCase().replace(/\s+/g, '_');
    const newCategory = { id: `cat_${Date.now()}`, label: label.trim(), value };

    const updatedCategories = [...categories, newCategory];
    setCategories(updatedCategories);
    localStorage.setItem('mymemo_categories', JSON.stringify(updatedCategories));
  };

  const handleMemoryClick = (memory) => {
    navigate(`/memory/${memory.id}`);
  };

  const handleLocationClick = (location) => {
    setLocationModal(location);
  };

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
          <button
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            className="px-4 py-2 rounded-xl border-2 border-border-light dark:border-border-dark hover:border-primary transition-colors flex items-center gap-2 text-sm font-medium text-text-primary-light dark:text-text-primary-dark"
          >
            {filtersExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            Filtros
          </button>
        </div>

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

        {/* Expandable filters */}
        {filtersExpanded && (

          <div className="space-y-3 animate-slide-up">
            {/* Categories */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
                Categorías:
              </span>
              {categories.map(cat => (
                <Chip
                  key={cat.id}
                  selected={selectedCategories.includes(cat.value)}
                  onClick={() => toggleCategory(cat.value)}
                  onRemove={selectedCategories.includes(cat.value) ? () => toggleCategory(cat.value) : undefined}
                >
                  {cat.label}
                </Chip>
              ))}
              <Chip variant="dashed" onClick={addCategory}>
                <Plus size={14} /> Añadir
              </Chip>
            </div>

            {/* People */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
                Personas:
              </span>
              {people.length === 0 && (
                <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark italic">
                  Aún no hay personas reconocidas
                </span>
              )}
              {people.map(person => (
                <Chip
                  key={person.id}
                  selected={selectedPeople.includes(person.id)}
                  onClick={() => togglePerson(person.id)}
                  onRemove={selectedPeople.includes(person.id) ? () => togglePerson(person.id) : undefined}
                >
                  {person.name}
                </Chip>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Map Container - 60% height */}
      <div className="flex-[3] relative">
        <MapView
          memories={filteredMemories}
          onMemoryClick={handleMemoryClick}
          onLocationClick={handleLocationClick}
          loading={loading}
        />
      </div>

      {/* Location Modal */}
      <Modal
        isOpen={!!locationModal}
        onClose={() => setLocationModal(null)}
        title={locationModal?.memories?.[0] && (locationModal.memories[0].location_name || 'Recuerdos en este lugar')}
        size="lg"
      >
        {locationModal && (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
              {locationModal.memories.length} {locationModal.memories.length === 1 ? 'recuerdo' : 'recuerdos'} en este lugar
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {locationModal.memories.map(memory => (
                <div
                  key={memory.id}
                  className="cursor-pointer bg-surface-light dark:bg-surface-dark rounded-xl overflow-hidden border border-border-light dark:border-border-dark hover:shadow-md transition-shadow"
                  onClick={() => { setLocationModal(null); navigate(`/memory/${memory.id}`); }}
                >
                  {/* Photo */}
                  <div className="relative h-48 bg-gray-100 dark:bg-gray-800">
                    <img
                      src={memory.thumbnail_url || memory.image_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                      {new Date(memory.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  {/* Info */}
                  <div className="p-4">
                    <p className="text-sm text-text-primary-light dark:text-text-primary-dark line-clamp-3">
                      {memory.description_raw}
                    </p>
                    {Array.isArray(parseMetadata(memory.ai_metadata)?.nlp?.tags) && parseMetadata(memory.ai_metadata).nlp.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {parseMetadata(memory.ai_metadata).nlp.tags.slice(0, 4).map(tag => (
                          <span key={tag} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            {String(tag)}
                          </span>
                        ))}
                      </div>
                    )}
                    <button
                      className="mt-3 flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-hover transition-colors"
                    >
                      Ver detalle <ArrowRight size={14} />
                    </button>
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
        className="bg-surface-light dark:bg-surface-dark border-t border-border-light dark:border-border-dark px-5 py-3 flex items-center justify-between hover:bg-primary/5 active:bg-primary/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-primary" />
          <span className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">Línea de tiempo</span>
          <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
            {memories.length > 0 ? `${memories.length} recuerdo${memories.length !== 1 ? 's' : ''}` : ''}
          </span>
        </div>
        <ArrowRight size={16} className="text-text-secondary-light dark:text-text-secondary-dark" />
      </button>
    </div>
  );
}
