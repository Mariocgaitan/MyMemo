import { forwardRef } from 'react';
import clsx from 'clsx';

const Textarea = forwardRef(({ 
  label,
  error,
  helperText,
  className,
  containerClassName,
  rows = 4,
  ...props 
}, ref) => {
  return (
    <div className={clsx('space-y-2', containerClassName)}>
      {label && (
        <label 
          htmlFor={props.id}
          className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark"
        >
          {label}
        </label>
      )}
      
      <textarea
        ref={ref}
        rows={rows}
        className={clsx(
          'w-full px-4 py-3 rounded-xl',
          'bg-surface-light dark:bg-surface-dark',
          'border-2',
          error 
            ? 'border-error-light dark:border-error-dark' 
            : 'border-border-light dark:border-border-dark',
          'text-text-primary-light dark:text-text-primary-dark',
          'placeholder:text-text-tertiary-light placeholder:dark:text-text-tertiary-dark',
          'focus:border-primary focus:ring-2 focus:ring-primary/20',
          'transition-all duration-normal outline-none',
          'resize-none',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
        {...props}
      />
      
      {(error || helperText) && (
        <p className={clsx(
          'text-sm',
          error 
            ? 'text-error-light dark:text-error-dark' 
            : 'text-text-secondary-light dark:text-text-secondary-dark'
        )}>
          {error || helperText}
        </p>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';

export default Textarea;
