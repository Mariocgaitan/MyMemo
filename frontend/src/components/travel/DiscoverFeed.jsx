import { MapPin, Star, Users, Sparkles } from 'lucide-react';

function PlaceCard({ place, onOpenPlace }) {
  const hasMemories = place.has_memories && place.memory_count > 0;
  const preview = place.preview_memory;
  const photoUrl = preview?.public_photo_url || null; // only MyMemo photos

  return (
    <article
      className={`rounded-2xl overflow-hidden bg-surface-light dark:bg-surface-dark border transition-shadow duration-200 flex flex-col cursor-pointer hover:shadow-md
        ${hasMemories
          ? 'border-primary/30 shadow-sm shadow-primary/10'
          : 'border-border-light dark:border-border-dark shadow-sm'
        }`}
      onClick={() => onOpenPlace?.(place.google_place_id, preview?.id || null)}
    >
      {/* Image: only MyMemo photos, otherwise gradient placeholder */}
      {photoUrl ? (
        <div className="aspect-video overflow-hidden bg-background-light dark:bg-background-dark">
          <img
            src={photoUrl}
            alt={place.name}
            className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
          />
        </div>
      ) : (
        <div className="aspect-video bg-gradient-to-br from-primary/10 via-primary/5 to-surface-light dark:to-surface-dark flex items-center justify-center">
          <MapPin size={28} className="text-primary/20" />
        </div>
      )}

      <div className="p-4 flex flex-col gap-2 flex-1">
        {/* Distance + open status */}
        <div className="flex items-center gap-1 text-xs text-text-secondary-light dark:text-text-secondary-dark">
          <MapPin size={10} className="shrink-0" />
          <span className="truncate">{place.address || 'Lugar cercano'}</span>
          {place.distance_km != null && (
            <span className="ml-auto shrink-0 text-primary font-semibold">{place.distance_km} km</span>
          )}
        </div>

        {/* Name */}
        <h2 className="text-[15px] font-bold text-text-primary-light dark:text-text-primary-dark leading-snug">
          {place.name}
        </h2>

        {/* Memory quote */}
        {preview?.public_description && (
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark leading-relaxed line-clamp-2">
            "{preview.public_description}"
          </p>
        )}

        {/* Personalization reason */}
        {place.why_this && (
          <p className="text-xs text-primary/70 italic leading-snug">
            {place.why_this}
          </p>
        )}

        {/* Footer row */}
        <div className="mt-auto pt-1 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {place.rating && (
              <div className="flex items-center gap-0.5 text-xs text-amber-500">
                <Star size={11} fill="currentColor" />
                <span className="font-medium">{place.rating}</span>
              </div>
            )}
            {hasMemories ? (
              <div className="flex items-center gap-1 text-xs text-primary font-medium">
                <Users size={11} />
                {place.similar_users_count > 0
                  ? `${place.similar_users_count} personas similares`
                  : `${place.memory_count} ${place.memory_count === 1 ? 'recuerdo' : 'recuerdos'}`
                }
              </div>
            ) : (
              <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark opacity-60">
                Sé el primero
              </span>
            )}
          </div>
          {hasMemories && (
            <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              <Sparkles size={10} />
              MyMemo
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

export default function DiscoverFeed({ places, onOpenPlace }) {
  if (!places || places.length === 0) {
    return (
      <div className="py-20 text-center px-6">
        <MapPin size={36} className="mx-auto text-primary/30 mb-3" />
        <p className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
          No hay lugares cercanos.
        </p>
        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1 opacity-60">
          Intenta ampliar el radio o cambiar de filtro.
        </p>
      </div>
    );
  }

  const withMemories = places.filter(p => p.has_memories);
  const without = places.filter(p => !p.has_memories);

  return (
    <div className="px-4 space-y-6">
      {withMemories.length > 0 && (
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">
            Para ti · de la comunidad
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {withMemories.map(p => (
              <PlaceCard key={p.google_place_id} place={p} onOpenPlace={onOpenPlace} />
            ))}
          </div>
        </section>
      )}

      {without.length > 0 && (
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary-light dark:text-text-secondary-dark mb-3">
            Descubre por tu zona
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {without.map(p => (
              <PlaceCard key={p.google_place_id} place={p} onOpenPlace={onOpenPlace} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

