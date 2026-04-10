const DEFAULT_TYPES = ['food', 'coffee', 'park', 'nightlife', 'architecture', 'sports'];

export default function PlaceChips({ selected, onSelect, options = DEFAULT_TYPES }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <button
        onClick={() => onSelect(null)}
        className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium border ${selected === null ? 'bg-primary text-white border-primary' : 'border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark'}`}
      >
        Todo
      </button>
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onSelect(option)}
          className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium border ${selected === option ? 'bg-primary text-white border-primary' : 'border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark'}`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
