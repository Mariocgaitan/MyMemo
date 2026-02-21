import { X } from 'lucide-react';
import clsx from 'clsx';

export default function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children,
  size = 'md',
  showCloseButton = true 
}) {
  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div 
          className={clsx(
            'relative w-full',
            sizes[size],
            'bg-background-light dark:bg-background-dark',
            'rounded-2xl shadow-2xl',
            'border border-border-light dark:border-border-dark',
            'max-h-[90vh] overflow-y-auto'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border-light dark:border-border-dark sticky top-0 bg-background-light dark:bg-background-dark z-10">
            <h2 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
              {title}
            </h2>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-surface-light dark:hover:bg-surface-dark transition-colors"
              >
                <X size={24} className="text-text-secondary-light dark:text-text-secondary-dark" />
              </button>
            )}
          </div>

          {/* Content */}
          <div className="p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
