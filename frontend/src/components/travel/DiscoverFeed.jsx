import { MapPin } from 'lucide-react';

function PlaceCard({ item, onOpenPlace }) {
  const location = [item.place_city, item.place_country].filter(Boolean).join(', ');

  return (
    <article className="rounded-2xl overflow-hidden bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col">
      {/* Image */}
      <button
        className="block w-full overflow-hidden focus:outline-none"
        onClick={() => onOpenPlace?.(item.place_id, item.id)}
        tabIndex={-1}
        aria-hidden="true"
      >
        {item.public_photo_url ? (
          <div className="aspect-video bg-background-light dark:bg-background-dark overflow-hidden">
            <img
              src={item.public_photo_url}
              alt={item.place_name}
              className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
            />
          </div>
        ) : (
          <div className="aspect-video bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center">
            <MapPin size={28} className="text-primary/25" />
          </div>
        )}
      </button>

      {/* Body */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        {/* Location row */}
        {location && (
          <div className="flex items-center gap-1 text-xs text-text-secondary-light dark:text-text-secondary-dark">
            <MapPin size={11} className="shrink-0" />
            <span className="truncate">{location}</span>
            {typeof item.distance_km === 'number' && (
              <span className="ml-auto shrink-0 text-primary font-semibold">{item.distance_km} km</span>
            )}
          </div>
        )}

        {/* Place name */}
        <button
          onClick={() => onOpenPlace?.(item.place_id, item.id)}
          className="text-left group"
        >
          <h2 className="text-[15px] font-bold text-text-primary-light dark:text-text-primary-dark group-hover:text-primary transition-colors leading-snug">
            {item.place_name}
          </h2>
        </button>

        {/* Memory excerpt */}
        {item.public_description && (
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark leading-relaxed line-clamp-3">
            "{item.public_description}"
          </p>
        )}

        {/* Footer */}
        {item.emotion_label && (
          <div className="mt-auto pt-2">
            <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {item.emotion_label}
            </span>
          </div>
        )}
      </div>
    </article>
  );
}

export default function DiscoverFeed({ items, onLoadMore, hasMore, loading, onOpenPlace }) {
  if (!items || items.length === 0) {
    return (
      <div className="py-20 text-center px-6">
        <MapPin size={36} className="mx-auto text-primary/30 mb-3" />
        <p className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
          No hay momentos cerca todavía.
        </p>
        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1 opacity-60">
          Sé el primero en compartir un recuerdo.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {items.map((item) => (
          <PlaceCard key={item.id} item={item} onOpenPlace={onOpenPlace} />
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center pb-2">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="rounded-xl border border-border-light dark:border-border-dark px-8 py-2.5 text-sm font-medium text-text-primary-light dark:text-text-primary-dark hover:bg-background-light dark:hover:bg-background-dark transition-colors disabled:opacity-50"
          >
            {loading ? 'Cargando...' : 'Ver más'}
          </button>
        </div>
      )}
    </div>
  );
}
