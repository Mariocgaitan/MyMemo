import clsx from 'clsx';

export default function Card({ 
  children, 
  className,
  hover = false,
  onClick,
  ...props 
}) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'bg-surface-light dark:bg-surface-dark',
        'rounded-2xl shadow-card',
        'overflow-hidden',
        hover && 'transition-all duration-normal hover:shadow-card-hover hover:-translate-y-1 cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
