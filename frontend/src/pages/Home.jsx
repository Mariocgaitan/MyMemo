import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronDown, ChevronUp, Plus, X, MapPin, ArrowRight } from 'lucide-react';
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

export default function Home() {
  const navigate = useNavigate();
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedPeople, setSelectedPeople] = useState([]);
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null); // null = not searching
  const [searchLoading, setSearchLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [people, setPeople] = useState([]);
  const [showAllTimeline, setShowAllTimeline] = useState(false);
  const [locationModal, setLocationModal] = useState(null); // { location_name, memories[] }
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

  // Base list: API search results when searching, otherwise all loaded memories
  const baseMemories = searchResults !== null ? searchResults : memories;

  // Apply category and people filters on top
  const filteredMemories = baseMemories.filter(memory => {
    // Client-side fallback text filter (when API search not yet returned or no query)
    if (searchQuery.trim() && searchResults === null) {
      const q = searchQuery.toLowerCase();
      const inDesc = (memory.description_raw || '').toLowerCase().includes(q);
      const inLocation = (memory.location_name || '').toLowerCase().includes(q);
      // Fixed: tags live in ai_metadata.nlp.tags
      const inTags = (memory.ai_metadata?.nlp?.tags || []).some(t => t.toLowerCase().includes(q));
      if (!inDesc && !inLocation && !inTags) return false;
    }

    // Category filter
    if (selectedCategories.length > 0) {
      const memCats = memory.ai_metadata?.user_categories || [];
      const hasCategory = selectedCategories.some(cat => memCats.includes(cat));
      if (!hasCategory) return false;
    }

    // People filter
    if (selectedPeople.length > 0) {
      const memFaces = memory.ai_metadata?.faces || [];
      const faceIds = memFaces.map(f => f.person_id);
      const hasPerson = selectedPeople.some(pid => faceIds.includes(pid));
      if (!hasPerson) return false;
    }

    return true;
  });

  // Timeline: limit to last 7 days unless showAllTimeline is true
  const timelineMemories = showAllTimeline
    ? filteredMemories
    : filteredMemories.filter(m => {
        const diffDays = (Date.now() - new Date(m.created_at)) / 86400000;
        return diffDays <= 7;
      });

  const hasMoreThanWeek = filteredMemories.some(m => {
    const diffDays = (Date.now() - new Date(m.created_at)) / 86400000;
    return diffDays > 7;
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
        {/* Search bar with filters toggle */}
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
          <button
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            className="px-4 py-2 rounded-xl border-2 border-border-light dark:border-border-dark hover:border-primary transition-colors flex items-center gap-2 text-sm font-medium text-text-primary-light dark:text-text-primary-dark"
          >
            {filtersExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            Filtros
          </button>
        </div>

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
                  👤 {person.name}
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
        title={locationModal?.memories?.[0] && (locationModal.memories[0].location_name || '📍 Recuerdos en este lugar')}
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
                  className="bg-surface-light dark:bg-surface-dark rounded-xl overflow-hidden border border-border-light dark:border-border-dark hover:shadow-md transition-shadow"
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
                    {memory.ai_metadata?.nlp?.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {memory.ai_metadata.nlp.tags.slice(0, 4).map(tag => (
                          <span key={tag} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => { setLocationModal(null); navigate(`/memory/${memory.id}`); }}
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

      {/* Timeline Container - 40% height */}
      <div className="bg-surface-light dark:bg-surface-dark border-t border-border-light dark:border-border-dark p-4 flex-[2] overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
            📅 {showAllTimeline ? 'Todos los recuerdos' : 'Últimos 7 días'}
            {searchQuery && (
              <span className="ml-2 text-sm font-normal text-text-secondary-light dark:text-text-secondary-dark">
                — {filteredMemories.length} resultado{filteredMemories.length !== 1 ? 's' : ''}
              </span>
            )}
          </h2>
          {hasMoreThanWeek && (
            <button
              onClick={() => setShowAllTimeline(prev => !prev)}
              className="text-sm font-medium text-primary hover:text-primary-hover transition-colors"
            >
              {showAllTimeline ? '← Recientes' : 'Ver todo →'}
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent mx-auto"></div>
          </div>
        ) : memories.length === 0 ? (
          <div className="text-center py-12 text-text-secondary-light dark:text-text-secondary-dark">
            <p className="text-3xl mb-2">📸</p>
            <p className="font-medium">Aún no tienes recuerdos</p>
            <p className="text-sm mt-1">Toca el botón <strong>+</strong> para crear tu primer recuerdo</p>
          </div>
        ) : timelineMemories.length === 0 ? (
          <div className="text-center py-12 text-text-secondary-light dark:text-text-secondary-dark">
            <p className="text-3xl mb-2">🔍</p>
            <p className="font-medium">
              {searchQuery ? `Sin resultados para "${searchQuery}"` : 'Sin recuerdos en los últimos 7 días'}
            </p>
            {(searchQuery || !showAllTimeline) && (
              <button
                onClick={searchQuery ? clearSearch : () => setShowAllTimeline(true)}
                className="mt-2 text-sm text-primary hover:text-primary-hover"
              >
                {searchQuery ? 'Limpiar búsqueda' : 'Ver todos los recuerdos'}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4 overflow-y-auto h-[calc(100%-3rem)]">
            {groupMemoriesByDay(timelineMemories).map(group => (
              <div key={group.label}>
                <h3 className="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark mb-2">
                  {group.label}
                </h3>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {group.memories.map(memory => (
                    <div
                      key={memory.id}
                      onClick={() => handleMemoryClick(memory)}
                      className="flex-shrink-0 w-48 bg-white dark:bg-surface-dark rounded-xl shadow-card hover:shadow-card-hover overflow-hidden cursor-pointer transition-all duration-normal hover:-translate-y-1"
                    >
                      <img 
                        src={memory.thumbnail_url || memory.image_url} 
                        alt="Memory"
                        className="w-full h-32 object-cover"
                      />
                      <div className="p-3">
                        <p className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark line-clamp-2">
                          {memory.description_raw?.substring(0, 60) || 'Sin descripción'}
                        </p>
                        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1">
                          🕐 {formatRelativeTime(memory.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

        )}
      </div>
    </div>
  );
}

// Helper function to group memories by day
function groupMemoriesByDay(memories) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups = memories.reduce((acc, memory) => {
    const memoryDate = new Date(memory.created_at);
    const memoryDay = new Date(memoryDate.getFullYear(), memoryDate.getMonth(), memoryDate.getDate());
    
    let label;
    if (memoryDay.getTime() === today.getTime()) {
      label = 'Hoy';
    } else if (memoryDay.getTime() === yesterday.getTime()) {
      label = 'Ayer';
    } else {
      const diffDays = Math.floor((today - memoryDay) / (1000 * 60 * 60 * 24));
      if (diffDays < 7) {
        label = `Hace ${diffDays} días`;
      } else {
        label = memoryDate.toLocaleDateString('es-MX', { 
          day: 'numeric', 
          month: 'short' 
        });
      }
    }

    if (!acc[label]) {
      acc[label] = [];
    }
    acc[label].push(memory);
    return acc;
  }, {});

  return Object.entries(groups)
    .map(([label, memories]) => ({ label, memories }))
    .sort((a, b) => {
      const orderMap = { 'Hoy': 0, 'Ayer': 1 };
      const aOrder = orderMap[a.label] ?? 999;
      const bOrder = orderMap[b.label] ?? 999;
      return aOrder - bOrder;
    });
}

// Helper function to format relative time
function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
  
  return date.toLocaleTimeString('es-MX', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true
  });
}
