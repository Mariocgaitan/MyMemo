import { useState } from 'react';
import { Bookmark, Flag, MapPin } from 'lucide-react';
import { travelAPI } from '../../services/api';

export default function DiscoverFeed({ items, onLoadMore, hasMore, loading, onSaved, onOpenPlace }) {
  const [busyPlace, setBusyPlace] = useState(null);
  const [busyReport, setBusyReport] = useState(null);

  const handleSave = async (placeId) => {
    setBusyPlace(placeId);
    try {
      await travelAPI.savePlace(placeId);
      onSaved?.(placeId);
    } finally {
      setBusyPlace(null);
    }
  };

  const handleReport = async (item) => {
    const reason = window.prompt('Motivo del reporte:');
    if (!reason) return;
    setBusyReport(item.id);
    try {
      await travelAPI.reportPublicMemory(item.id, reason);
    } finally {
      setBusyReport(null);
    }
  };

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <article key={item.id} className="rounded-2xl overflow-hidden border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark shadow-card">
          {item.public_photo_url && (
            <button className="block w-full" onClick={() => onOpenPlace?.(item.place_id, item.id)}>
              <img src={item.public_photo_url} alt={item.place_name} className="h-56 w-full object-cover" />
            </button>
          )}
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-primary">{item.emotion_label || 'Momento'}</p>
                <button onClick={() => onOpenPlace?.(item.place_id, item.id)} className="text-left text-lg font-semibold text-text-primary-light dark:text-text-primary-dark hover:text-primary">
                  {item.place_name}
                </button>
                <div className="mt-1 flex items-center gap-1 text-xs text-text-secondary-light dark:text-text-secondary-dark">
                  <MapPin size={12} />
                  <span>{item.place_city || item.place_country || 'Lugar compartido'}{typeof item.distance_km === 'number' ? ` · ${item.distance_km} km` : ''}</span>
                </div>
                {item.context_badge && (
                  <div className="mt-2">
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">{item.context_badge}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleSave(item.place_id)} disabled={busyPlace === item.place_id} className="rounded-lg border border-border-light dark:border-border-dark p-2 text-text-secondary-light dark:text-text-secondary-dark">
                  <Bookmark size={16} />
                </button>
                <button onClick={() => handleReport(item)} disabled={busyReport === item.id} className="rounded-lg border border-border-light dark:border-border-dark p-2 text-text-secondary-light dark:text-text-secondary-dark">
                  <Flag size={16} />
                </button>
              </div>
            </div>
            {item.public_description && (
              <p className="text-sm text-text-primary-light dark:text-text-primary-dark">{item.public_description}</p>
            )}
            {item.why_this && (
              <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">{item.why_this}</p>
            )}
          </div>
        </article>
      ))}

      {hasMore && (
        <button onClick={onLoadMore} disabled={loading} className="w-full rounded-xl border border-border-light dark:border-border-dark px-4 py-3 text-sm font-medium text-text-primary-light dark:text-text-primary-dark disabled:opacity-50">
          {loading ? 'Cargando...' : 'Cargar mas'}
        </button>
      )}
    </div>
  );
}
