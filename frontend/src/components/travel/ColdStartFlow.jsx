import { useState } from 'react';

const OPTIONS = ['food', 'coffee', 'park', 'nightlife', 'architecture', 'sports', 'museum'];

export default function ColdStartFlow({ onSubmit, isSaving }) {
  const [selected, setSelected] = useState([]);

  const toggle = (value) => {
    setSelected((prev) => prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value].slice(0, 5));
  };

  return (
    <div className="rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-5 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">Configura tu TravelMemo</h2>
        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">
          Elige entre 3 y 5 intereses para personalizar el feed inicial.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((option) => {
          const active = selected.includes(option);
          return (
            <button
              key={option}
              onClick={() => toggle(option)}
              className={`rounded-full px-3 py-2 text-sm font-medium border ${active ? 'bg-primary text-white border-primary' : 'border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark'}`}
            >
              {option}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => onSubmit(selected)}
        disabled={selected.length < 3 || isSaving}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
      >
        {isSaving ? 'Guardando...' : 'Guardar preferencias'}
      </button>
    </div>
  );
}
