import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Calendar } from 'lucide-react';
import { memoryAPI } from '../services/api';

const parseMetadata = (metadata) => {
  if (!metadata) return {};
  if (typeof metadata === 'string') {
    try { return JSON.parse(metadata); } catch { return {}; }
  }
  return metadata;
};

export default function Timeline() {
  const navigate = useNavigate();
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await memoryAPI.getAll({ limit: 500, skip: 0 });
        setMemories(response.memories || []);
      } catch (e) {
        console.error('Error fetching memories:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const displayMemories = showAll
    ? memories
    : memories.filter(m => (Date.now() - new Date(m.memory_date || m.created_at)) / 86400000 <= 7);

  const hasOlderThanWeek = memories.some(
    m => (Date.now() - new Date(m.memory_date || m.created_at)) / 86400000 > 7
  );

  return (
    <div className="min-h-screen bg-bg-light dark:bg-bg-dark">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl hover:bg-primary/10 text-text-primary-light dark:text-text-primary-dark transition-colors"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark flex items-center gap-2">
            <Calendar size={18} className="text-primary" />
            Línea de tiempo
          </h1>
          <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
            {memories.length} recuerdo{memories.length !== 1 ? 's' : ''} en total
          </p>
        </div>
        {hasOlderThanWeek && (
          <button
            onClick={() => setShowAll(v => !v)}
            className="text-sm font-medium text-primary hover:text-primary-hover transition-colors"
          >
            {showAll ? 'Últimos 7 días' : 'Ver todo'}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4 pb-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : memories.length === 0 ? (
          <div className="text-center py-20 text-text-secondary-light dark:text-text-secondary-dark">
            <p className="font-medium text-lg">Nada por aquí todavía</p>
            <p className="text-sm mt-1">Toca <strong>+</strong> en el inicio para guardar tu primer recuerdo</p>
          </div>
        ) : displayMemories.length === 0 ? (
          <div className="text-center py-20 text-text-secondary-light dark:text-text-secondary-dark">
            <p className="font-medium">Sin recuerdos en los últimos 7 días</p>
            <button onClick={() => setShowAll(true)} className="mt-3 text-sm text-primary hover:text-primary-hover">
              Ver todos los recuerdos
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {groupByDay(displayMemories).map(group => (
              <div key={group.label}>
                {/* Day header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-px flex-1 bg-border-light dark:bg-border-dark" />
                  <span className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide px-2">
                    {group.label}
                  </span>
                  <div className="h-px flex-1 bg-border-light dark:bg-border-dark" />
                </div>

                {/* Memory cards — horizontal scroll */}
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  {group.memories.map(memory => {
                    const meta = parseMetadata(memory.ai_metadata);
                    const tags = meta.nlp?.tags || [];
                    const shared = memory.shared_by;
                    const cardStyle = shared ? {
                      border: `2px ${shared.border_style === 'glow' ? 'solid' : (shared.border_style || 'solid')} ${shared.border_color || '#6366f1'}`,
                      boxShadow: shared.border_style === 'glow' ? `0 0 10px ${shared.border_color}80` : undefined,
                    } : {};
                    return (
                      <div
                        key={memory.id}
                        onClick={() => navigate(`/memory/${memory.id}`)}
                        className={`flex-shrink-0 w-52 bg-surface-light dark:bg-surface-dark rounded-2xl overflow-hidden cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all${!shared ? ' border border-border-light dark:border-border-dark' : ''}`}
                        style={shared ? cardStyle : undefined}
                      >
                        <div className="relative h-36">
                          <img
                            src={memory.thumbnail_url || memory.image_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                            {formatTime(memory.memory_date || memory.created_at)}
                          </div>
                          {shared && (
                            <div
                              className="absolute top-2 left-2 flex items-center gap-1 text-white text-xs font-semibold px-2 py-0.5 rounded-full shadow"
                              style={{ backgroundColor: shared.border_color || '#6366f1' }}
                            >
                              📎 {shared.name}
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <p className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark line-clamp-2">
                            {memory.description_raw?.substring(0, 80) || 'Sin descripción'}
                          </p>
                          {memory.location_name && (
                            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1 truncate">
                              {memory.location_name}
                            </p>
                          )}
                          {!shared && tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {tags.slice(0, 3).map(tag => (
                                <span key={tag} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                  {String(tag)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function groupByDay(memories) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups = memories.reduce((acc, memory) => {
    const d = new Date(memory.memory_date || memory.created_at);
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    let label;
    if (day.getTime() === today.getTime()) label = 'Hoy';
    else if (day.getTime() === yesterday.getTime()) label = 'Ayer';
    else {
      const diff = Math.floor((today - day) / 86400000);
      label = diff < 7
        ? `Hace ${diff} días`
        : d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
    }
    if (!acc[label]) acc[label] = { label, date: day, memories: [] };
    acc[label].memories.push(memory);
    return acc;
  }, {});

  return Object.values(groups).sort((a, b) => b.date - a.date);
}

function formatTime(dateString) {
  return new Date(dateString).toLocaleTimeString('es-MX', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}
