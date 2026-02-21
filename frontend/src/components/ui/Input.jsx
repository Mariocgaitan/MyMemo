import { forwardRef } from 'react';
import clsx from 'clsx';

const Input = forwardRef(({ 
  label,
  error,
  helperText,
  className,
  containerClassName,
  startIcon,
  endIcon,
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
      
      <div className="relative">
        {startIcon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary-light dark:text-text-secondary-dark">
            {startIcon}
          </div>
        )}
        
        <input
          ref={ref}
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
            'disabled:opacity-50 disabled:cursor-not-allowed',
            startIcon && 'pl-12',
            endIcon && 'pr-12',
            className
          )}
          {...props}
        />
        
        {endIcon && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary-light dark:text-text-secondary-dark">
            {endIcon}
          </div>
        )}
      </div>
      
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

Input.displayName = 'Input';

export default Input;
