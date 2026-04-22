import { MapPin } from 'lucide-react';

export default function DiscoverFeed({ items, onLoadMore, hasMore, loading, onOpenPlace }) {
  if (!items || items.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-text-secondary-light dark:text-text-secondary-dark px-6">
        No hay momentos cerca todavía. Intenta más tarde.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border-light dark:divide-border-dark">
      {items.map((item) => (
        <article key={item.id} className="bg-surface-light dark:bg-surface-dark">
          {item.public_photo_url && (
            <div className="w-full aspect-[4/3] overflow-hidden">
              <img
                src={item.public_photo_url}
                alt={item.place_name}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="px-4 py-4 space-y-2">
            {item.emotion_label && (
              <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {item.emotion_label}
              </span>
            )}
            <button
              onClick={() => onOpenPlace?.(item.place_id, item.id)}
              className="block text-left w-full group"
            >
              <h2 className="text-base font-semibold text-text-primary-light dark:text-text-primary-dark group-hover:text-primary transition-colors">
                {item.place_name}
              </h2>
              <div className="flex items-center gap-1 mt-0.5 text-xs text-text-secondary-light dark:text-text-secondary-dark">
                <MapPin size={11} />
                <span>
                  {[item.place_city, item.place_country].filter(Boolean).join(', ')}
                  {typeof item.distance_km === 'number' ? ` · ${item.distance_km} km` : ''}
                </span>
              </div>
            </button>
            {item.public_description && (
              <p className="text-sm text-text-primary-light dark:text-text-primary-dark leading-relaxed">
                {item.public_description}
              </p>
            )}
          </div>
        </article>
      ))}

      {hasMore && (
        <div className="py-4 flex justify-center">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="rounded-xl border border-border-light dark:border-border-dark px-6 py-2.5 text-sm font-medium text-text-primary-light dark:text-text-primary-dark disabled:opacity-50"
          >
            {loading ? 'Cargando...' : 'Ver más'}
          </button>
        </div>
      )}
    </div>
  );
}
