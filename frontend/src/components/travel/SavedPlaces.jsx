export default function SavedPlaces({ places = [] }) {
  if (places.length === 0) {
    return (
      <div className="rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-5 text-sm text-text-secondary-light dark:text-text-secondary-dark">
        No hay lugares guardados todavia.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {places.map((place) => (
        <div key={place.place_id} className="rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4">
          <h3 className="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">{place.place_name}</h3>
          <p className="mt-1 text-sm text-text-secondary-light dark:text-text-secondary-dark">
            {[place.city, place.country].filter(Boolean).join(' · ') || 'Lugar guardado'}
          </p>
          <p className="mt-2 text-xs text-text-secondary-light dark:text-text-secondary-dark">
            {place.memory_count} memorias publicas
          </p>
        </div>
      ))}
    </div>
  );
}
