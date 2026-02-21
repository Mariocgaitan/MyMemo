import { forwardRef } from 'react';
import clsx from 'clsx';

const variants = {
  primary: `
    bg-primary hover:bg-primary-hover 
    text-white font-semibold
    shadow-lg hover:shadow-xl
    hover:-translate-y-0.5 active:translate-y-0
    disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
  `,
  secondary: `
    border-2 border-secondary dark:border-secondary-light
    text-secondary dark:text-secondary-light font-semibold
    hover:bg-secondary hover:text-white
    dark:hover:bg-secondary-light dark:hover:text-background-dark
    disabled:opacity-50 disabled:cursor-not-allowed
  `,
  outline: `
    border-2 border-border-light dark:border-border-dark
    text-text-primary-light dark:text-text-primary-dark
    hover:border-primary hover:text-primary
    disabled:opacity-50 disabled:cursor-not-allowed
  `,
  ghost: `
    text-text-primary-light dark:text-text-primary-dark
    hover:bg-background-light dark:hover:bg-background-dark
    disabled:opacity-50 disabled:cursor-not-allowed
  `,
};

const sizes = {
  sm: 'px-4 py-2 text-sm rounded-lg',
  md: 'px-6 py-3 text-base rounded-xl',
  lg: 'px-8 py-4 text-lg rounded-xl',
  icon: 'p-2 rounded-lg',
};

const Button = forwardRef(({ 
  children, 
  variant = 'primary', 
  size = 'md',
  className,
  disabled,
  loading,
  fullWidth,
  ...props 
}, ref) => {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2',
        'transition-all duration-normal',
        'focus-outline',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {loading ? (
        <>
          <svg 
            className="animate-spin h-5 w-5" 
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24"
          >
            <circle 
              className="opacity-25" 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="4"
            />
            <path 
              className="opacity-75" 
              fill="currentColor" 
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>Cargando...</span>
        </>
      ) : children}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;
