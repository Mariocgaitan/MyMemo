export default function ShareModal({
  isOpen,
  onConfirm,
  onCancel,
  isSubmitting,
  preview,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-5 shadow-xl">
        <h2 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
          Compartir en TravelMemo
        </h2>
        <p className="mt-1 text-sm text-text-secondary-light dark:text-text-secondary-dark">
          Se publicara solo contenido permitido para TravelMemo.
        </p>

        <div className="mt-4 rounded-xl border border-border-light dark:border-border-dark p-3 space-y-2 text-sm">
          <p className="text-text-primary-light dark:text-text-primary-dark">
            Foto: {preview?.hasPhoto ? 'si' : 'no'}
          </p>
          <p className="text-text-primary-light dark:text-text-primary-dark">
            Lugar: {preview?.locationName || 'sin lugar'}
          </p>
          <p className="text-text-primary-light dark:text-text-primary-dark line-clamp-2">
            Descripcion: {preview?.description || 'sin descripcion'}
          </p>
          <p className="text-text-primary-light dark:text-text-primary-dark">
            Emocion IA: {preview?.emotionLabel || 'pendiente'}
          </p>
        </div>

        <div className="mt-4 rounded-xl bg-primary/5 p-3 text-xs text-text-secondary-light dark:text-text-secondary-dark">
          No se publican caras detectadas, tags privados ni tu timeline exacto.
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 rounded-lg border border-border-light dark:border-border-dark px-3 py-2 text-sm font-medium text-text-primary-light dark:text-text-primary-dark disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {isSubmitting ? 'Publicando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
