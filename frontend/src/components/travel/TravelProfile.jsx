export default function TravelProfile({ profile }) {
  if (!profile) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-5">
        <h2 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">Tu perfil TravelMemo</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div>
            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">Memorias compartidas</p>
            <p className="mt-1 text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">{profile.shared_memories_count}</p>
          </div>
          <div>
            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">Lugares</p>
            <p className="mt-1 text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">{profile.places_count}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">Tus intereses</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(profile.preferred_types || []).map((item) => (
                <span key={item} className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">{item}</span>
              ))}
            </div>
          </div>
        </div>
        {(profile.top_types || []).length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">Top tipos</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {profile.top_types.map((item) => (
                <span key={item} className="rounded-full border border-border-light dark:border-border-dark px-2 py-1 text-xs text-text-primary-light dark:text-text-primary-dark">{item}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {profile.items.map((item) => (
          <article key={item.id} className="rounded-2xl overflow-hidden border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark">
            {item.public_photo_url && <img src={item.public_photo_url} alt={item.place_name} className="h-48 w-full object-cover" />}
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">{item.place_name}</h3>
                {item.context_badge && (
                  <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">{item.context_badge}</span>
                )}
              </div>
              {item.public_description && <p className="text-sm text-text-primary-light dark:text-text-primary-dark">{item.public_description}</p>}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
