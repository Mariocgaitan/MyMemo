const CATEGORIES = [
  { id: 'comida',  label: 'Comida'  },
  { id: 'cafe',    label: 'Café'    },
  { id: 'salidas', label: 'Salidas' },
  { id: 'deporte', label: 'Deporte' },
  { id: 'arte',    label: 'Arte'    },
  { id: 'pareja',  label: 'Pareja'  },
  { id: 'familia', label: 'Familia' },
  { id: 'fiesta',  label: 'Fiesta'  },
];

export { CATEGORIES };

export default function PlaceChips({ selected, onSelect }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      <button
        onClick={() => onSelect(null)}
        className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
          selected === null
            ? 'bg-primary text-white border-primary'
            : 'border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:border-primary/50'
        }`}
      >
        Todo
      </button>
      {CATEGORIES.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => onSelect(id)}
          className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
            selected === id
              ? 'bg-primary text-white border-primary'
              : 'border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:border-primary/50'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
