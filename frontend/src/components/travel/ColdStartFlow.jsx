import { useState } from 'react';
import { CATEGORIES } from './PlaceChips';

export default function ColdStartFlow({ onSubmit, isSaving }) {
  const [selected, setSelected] = useState([]);

  const toggle = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id].slice(0, 6)
    );
  };

  return (
    <div className="rounded-2xl border border-primary/20 bg-surface-light dark:bg-surface-dark p-5 space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">Personaliza tu feed</p>
        <h2 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">¿Qué te gusta hacer?</h2>
        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">
          Elige al menos 3 para ver recomendaciones de personas con tus mismos gustos.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(({ id, label }) => {
          const active = selected.includes(id);
          return (
            <button
              key={id}
              onClick={() => toggle(id)}
              className={`rounded-full px-3 py-2 text-sm font-medium border transition-all ${
                active
                  ? 'bg-primary text-white border-primary scale-105'
                  : 'border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => onSubmit(selected)}
        disabled={selected.length < 3 || isSaving}
        className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-40 transition-colors"
      >
        {isSaving ? 'Guardando...' : `Continuar con ${selected.length} intereses`}
      </button>
    </div>
  );
}
