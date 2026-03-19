import { useState } from 'react';
import { ChevronLeft, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { memoryAPI } from '../services/api';

export default function SearchMemory() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setSearched(true);
    try {
      const data = await memoryAPI.search(query);
      setResults(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Search error:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-background-light dark:bg-background-dark">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-surface-light dark:hover:bg-surface-dark rounded-lg transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
            Buscar Recuerdo
          </h1>
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Escribe para buscar recuerdos..."
              className="w-full px-4 py-3 pr-12 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark placeholder:text-text-tertiary-light placeholder:dark:text-text-tertiary-dark focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
            />
            <button
              type="submit"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-text-secondary-light dark:text-text-secondary-dark hover:text-primary transition-colors"
              aria-label="Buscar"
            >
              <Search size={20} />
            </button>
          </div>
        </form>

        {/* Results */}
        {searched && (
          <div>
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block">
                  <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                </div>
              </div>
            ) : results.length > 0 ? (
              <div className="space-y-4">
                <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  Se encontraron {results.length} resultados
                </p>
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {results.map((memory) => (
                    <div
                      key={memory.id}
                      onClick={() => navigate(`/memory/${memory.id}`)}
                      className="cursor-pointer rounded-xl overflow-hidden bg-surface-light dark:bg-surface-dark hover:shadow-lg transition-shadow group"
                    >
                      {memory.thumbnail_url && (
                        <div className="aspect-square overflow-hidden bg-background-light dark:bg-background-dark">
                          <img
                            src={memory.thumbnail_url}
                            alt={memory.description}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>
                      )}
                      <div className="p-3">
                        <p className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark line-clamp-2">
                          {memory.description}
                        </p>
                        <p className="text-xs text-text-tertiary-light dark:text-text-tertiary-dark mt-1">
                          {new Date(memory.memory_date || memory.created_at).toLocaleDateString('es-MX')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-text-secondary-light dark:text-text-secondary-dark">
                  No se encontraron recuerdos con "{query}"
                </p>
              </div>
            )}
          </div>
        )}

        {!searched && (
          <div className="text-center py-12">
            <p className="text-text-secondary-light dark:text-text-secondary-dark">
              Escribe algo para comenzar a buscar
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
