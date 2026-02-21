import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, MapPin, Trash2 } from 'lucide-react';
import { Button, Chip } from '../components/ui';
import { memoryAPI } from '../services/api';

export default function MemoryDetail() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [memory, setMemory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchMemory = async () => {
      try {
        const data = await memoryAPI.getById(id);
        setMemory(data);
      } catch (err) {
        setError('No se pudo cargar el recuerdo');
      } finally {
        setLoading(false);
      }
    };
    fetchMemory();
  }, [id]);

  const handleDelete = async () => {
    if (!confirm('¿Eliminar este recuerdo?')) return;
    setDeleting(true);
    try {
      await memoryAPI.delete(id);
      navigate('/');
    } catch {
      alert('Error al eliminar');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center">
        <p className="text-text-secondary-light dark:text-text-secondary-dark">Cargando...</p>
      </div>
    );
  }

  if (error || !memory) {
    return (
      <div className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center gap-4">
        <p className="text-text-secondary-light dark:text-text-secondary-dark">{error}</p>
        <Button onClick={() => navigate('/')}>Volver</Button>
      </div>
    );
  }

  const meta = memory.ai_metadata || {};
  const faces = meta.faces || [];
  const tags = meta.detected_tags || [];
  const categories = meta.user_categories || [];
  const sentiment = meta.sentiment_label || meta.sentiment || null;
  const activity = meta.activity || categories[0] || null;

  // Formatea la fecha
  const date = memory.created_at
    ? new Date(memory.created_at).toLocaleDateString('es-MX', {
        day: 'numeric', month: 'long', year: 'numeric'
      })
    : null;
  const time = memory.created_at
    ? new Date(memory.created_at).toLocaleTimeString('es-MX', {
        hour: '2-digit', minute: '2-digit'
      })
    : null;

  return (
    <div className="min-h-[calc(100vh-80px)] bg-background-light dark:bg-background-dark pb-8">
      {/* Header */}
      <div className="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-text-primary-light dark:text-text-primary-dark hover:text-primary transition-colors"
          >
            <ChevronLeft size={20} />
            <span className="font-medium">Volver</span>
          </button>
          <h1 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">
            Recuerdo
          </h1>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors text-red-500"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 mt-6 space-y-6">
        {/* Hero Image */}
        {memory.image_url && (
          <div className="aspect-[3/2] rounded-2xl overflow-hidden shadow-card">
            <img
              src={memory.image_url}
              alt="Recuerdo"
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Metadata */}
        <div className="space-y-2">
          {(date || time) && (
            <div className="flex items-center gap-2 text-sm text-text-secondary-light dark:text-text-secondary-dark">
              {date && <span>📅 {date}</span>}
              {date && time && <span>•</span>}
              {time && <span>🕐 {time}</span>}
            </div>
          )}
          {memory.location && (
            <div className="flex items-center gap-2 text-sm text-text-primary-light dark:text-text-primary-dark">
              <MapPin size={16} className="text-primary" />
              <span className="font-medium">{memory.location}</span>
            </div>
          )}
        </div>

        {/* Description */}
        {memory.content && (
          <div className="bg-surface-light dark:bg-surface-dark rounded-2xl p-6">
            <p className="text-text-primary-light dark:text-text-primary-dark leading-relaxed">
              {memory.content}
            </p>
          </div>
        )}

        {/* Tags */}
        {(tags.length > 0 || categories.length > 0) && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
              🏷️ Tags
            </h3>
            <div className="flex flex-wrap gap-2">
              {[...categories, ...tags].map((tag, i) => (
                <Chip key={i} selected>{tag}</Chip>
              ))}
            </div>
          </div>
        )}

        {/* People */}
        {faces.filter(f => f.person_name && f.person_name !== 'Unknown Person').length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
              👥 Personas detectadas
            </h3>
            <div className="flex gap-4 flex-wrap">
              {faces
                .filter(f => f.person_name && f.person_name !== 'Unknown Person')
                .map((face, i) => (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center">
                      {face.thumbnail_url
                        ? <img src={face.thumbnail_url} alt={face.person_name} className="w-full h-full object-cover" />
                        : <span className="text-2xl">👤</span>
                      }
                    </div>
                    <span className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                      {face.person_name}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* AI Insights */}
        {(sentiment || activity) && (
          <div className="grid grid-cols-2 gap-4">
            {sentiment && (
              <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-4">
                <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  🎭 Sentimiento
                </p>
                <p className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mt-1">
                  {sentiment}
                </p>
              </div>
            )}
            {activity && (
              <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-4">
                <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  🎯 Actividad
                </p>
                <p className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mt-1">
                  {activity}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


  return (
    <div className="min-h-[calc(100vh-80px)] bg-background-light dark:bg-background-dark pb-8">
      {/* Header */}
      <div className="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-text-primary-light dark:text-text-primary-dark hover:text-primary transition-colors"
          >
            <ChevronLeft size={20} />
            <span className="font-medium">Volver</span>
          </button>
          <h1 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">
            Recuerdo
          </h1>
          <button className="p-2 hover:bg-background-light dark:hover:bg-background-dark rounded-lg transition-colors">
            <MoreVertical size={20} className="text-text-secondary-light dark:text-text-secondary-dark" />
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 mt-6 space-y-6">
        {/* Hero Image */}
        <div className="aspect-[3/2] rounded-2xl overflow-hidden shadow-card">
          <img
            src={memory.image}
            alt="Memory"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Metadata */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-text-secondary-light dark:text-text-secondary-dark">
            <span>📅 {memory.date}</span>
            <span>•</span>
            <span>🕐 {memory.time}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-text-primary-light dark:text-text-primary-dark">
            <MapPin size={16} className="text-primary" />
            <span className="font-medium">{memory.location}</span>
          </div>
        </div>

        {/* Description */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-2xl p-6">
          <p className="text-text-primary-light dark:text-text-primary-dark leading-relaxed">
            {memory.description}
          </p>
        </div>

        {/* Tags */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
            🏷️ Tags
          </h3>
          <div className="flex flex-wrap gap-2">
            {memory.tags.map(tag => (
              <Chip key={tag} selected>
                {tag}
              </Chip>
            ))}
          </div>
        </div>

        {/* People */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
            👥 Personas detectadas
          </h3>
          <div className="flex gap-4">
            {memory.people.map(person => (
              <div key={person.id} className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-2xl">👤</span>
                </div>
                <span className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                  {person.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* AI Insights */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-4">
            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
              🎭 Sentimiento
            </p>
            <p className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mt-1">
              😊 {memory.sentiment}
            </p>
          </div>
          <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-4">
            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
              🎯 Actividad
            </p>
            <p className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mt-1">
              {memory.activity}
            </p>
          </div>
        </div>

        {/* Action Button */}
        <Button fullWidth variant="secondary">
          <MapPin size={18} />
          Ver en Mapa
        </Button>
      </div>
    </div>
  );
}
