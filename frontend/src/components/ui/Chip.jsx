import { X } from 'lucide-react';
import clsx from 'clsx';

export default function Chip({ 
  children,
  selected = false,
  onRemove,
  onClick,
  variant = 'default',
  className,
  ...props 
}) {
  const variants = {
    default: selected
      ? 'bg-primary text-white hover:bg-primary-hover'
      : 'bg-surface-light dark:bg-surface-dark border-2 border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark hover:border-primary',
    dashed: 'border-2 border-dashed border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:border-primary hover:text-primary',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-2',
        'px-4 py-2 rounded-full',
        'text-sm font-medium',
        'transition-all duration-normal',
        'hover:scale-105 active:scale-95',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
      {selected && onRemove && (
        <X 
          size={14} 
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="cursor-pointer hover:scale-110"
        />
      )}
    </button>
  );
}
