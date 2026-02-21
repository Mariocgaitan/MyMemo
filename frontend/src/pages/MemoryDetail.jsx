import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, MoreVertical, MapPin } from 'lucide-react';
import { Button, Chip } from '../components/ui';

export default function MemoryDetail() {
  const navigate = useNavigate();
  const { id } = useParams();

  // TODO: Fetch memory data from API
  const memory = {
    id,
    image: 'https://via.placeholder.com/800x600',
    date: '19 de febrero, 2026',
    time: '12:30 PM',
    location: 'Taquería de canasta, CDMX',
    description: 'En unos taquitos de canasta con ángel, hoy me pedí 5. No había de picadillo porque unos malditos se lo acabaron. Buenísimos como siempre los tacos.',
    tags: ['taquitos', 'canasta', 'CDMX', 'food', 'tacos'],
    people: [
      { id: '1', name: 'Ángel', avatar: null },
      { id: '2', name: 'Tú', avatar: null },
    ],
    sentiment: 'Positivo',
    activity: 'Comida',
  };

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
