export default function PlaceDetail({ isOpen, detail, onClose, onSave }) {
  if (!isOpen || !detail) return null;

  const visitMessage = detail.visit_context || (detail.user_has_been_here ? 'Ya has estado aqui antes' : null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-5 shadow-xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">{detail.place.name}</h2>
            <p className="mt-1 text-sm text-text-secondary-light dark:text-text-secondary-dark">
              {[detail.place.city, detail.place.country].filter(Boolean).join(' · ') || 'Lugar compartido'}
            </p>
            <p className="mt-2 text-xs text-text-secondary-light dark:text-text-secondary-dark">
              {detail.place.memory_count} memorias publicas
            </p>
            {visitMessage && (
              <div className="mt-3 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {visitMessage}
                {detail.user_visit_count ? ` · ${detail.user_visit_count} visita${detail.user_visit_count === 1 ? '' : 's'}` : ''}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => onSave?.(detail.place.place_id)} className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-hover">
              Guardar
            </button>
            <button onClick={onClose} className="rounded-lg border border-border-light dark:border-border-dark px-3 py-2 text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
              Cerrar
            </button>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {detail.memories.map((memory) => (
            <article key={memory.id} className="rounded-2xl overflow-hidden border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark">
              {memory.public_photo_url && (
                <img src={memory.public_photo_url} alt={memory.place_name} className="h-48 w-full object-cover" />
              )}
              <div className="p-4 space-y-2">
                <p className="text-xs uppercase tracking-wide text-primary">{memory.emotion_label || 'Momento'}</p>
                {memory.context_badge && (
                  <div>
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">{memory.context_badge}</span>
                  </div>
                )}
                {memory.public_description && (
                  <p className="text-sm text-text-primary-light dark:text-text-primary-dark">{memory.public_description}</p>
                )}
                {memory.why_this && (
                  <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">{memory.why_this}</p>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
