import { X, MapPin, Bookmark, Users } from 'lucide-react';

export default function PlaceDetail({ isOpen, detail, onClose, onSave }) {
  if (!isOpen || !detail) return null;

  const visitMessage = detail.visit_context || (detail.user_has_been_here ? 'Ya has estado aquí' : null);
  const locationLine = [detail.place.city, detail.place.country].filter(Boolean).join(', ');
  const memoryCount = detail.place.memory_count || detail.memories?.length || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet: bottom sheet on mobile, centered modal on desktop */}
      <div className="relative z-10 w-full max-w-2xl rounded-t-3xl sm:rounded-2xl bg-surface-light dark:bg-surface-dark shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-border-light dark:border-border-dark">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark leading-tight truncate">
                {detail.place.name}
              </h2>
              {locationLine && (
                <div className="flex items-center gap-1 mt-1 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  <MapPin size={13} className="shrink-0" />
                  <span>{locationLine}</span>
                </div>
              )}

              <div className="flex items-center gap-3 mt-2">
                {memoryCount > 0 && (
                  <div className="flex items-center gap-1 text-xs text-text-secondary-light dark:text-text-secondary-dark">
                    <Users size={12} />
                    <span>{memoryCount} {memoryCount === 1 ? 'recuerdo' : 'recuerdos'} compartidos</span>
                  </div>
                )}
                {visitMessage && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                    {visitMessage}
                    {detail.user_visit_count > 1 ? ` · ${detail.user_visit_count}x` : ''}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {onSave && (
                <button
                  onClick={() => onSave(detail.place.place_id)}
                  className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
                >
                  <Bookmark size={14} />
                  Guardar
                </button>
              )}
              <button
                onClick={onClose}
                className="rounded-xl border border-border-light dark:border-border-dark p-2 text-text-secondary-light dark:text-text-secondary-dark hover:bg-background-light dark:hover:bg-background-dark transition-colors"
                aria-label="Cerrar"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Memories list */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {detail.memories && detail.memories.length > 0 ? (
            detail.memories.map((memory) => (
              <article
                key={memory.id}
                className="rounded-xl overflow-hidden border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark"
              >
                {memory.public_photo_url && (
                  <div className="aspect-video overflow-hidden">
                    <img
                      src={memory.public_photo_url}
                      alt={memory.place_name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="p-4 space-y-2">
                  {memory.emotion_label && (
                    <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      {memory.emotion_label}
                    </span>
                  )}
                  {memory.public_description && (
                    <p className="text-sm text-text-primary-light dark:text-text-primary-dark leading-relaxed">
                      "{memory.public_description}"
                    </p>
                  )}
                </div>
              </article>
            ))
          ) : (
            <p className="text-center text-sm text-text-secondary-light dark:text-text-secondary-dark py-6">
              No hay recuerdos públicos aún.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

