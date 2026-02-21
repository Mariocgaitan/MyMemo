import { Menu, Moon, Sun, User } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import Button from '../ui/Button';

export default function Header() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark px-6 py-4 shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Left: Logo and Menu */}
        <div className="flex items-center gap-4">
          <button 
            className="lg:hidden p-2 hover:bg-background-light dark:hover:bg-background-dark rounded-lg transition-colors"
            aria-label="Abrir menú"
          >
            <Menu className="text-text-secondary-light dark:text-text-secondary-dark" size={24} />
          </button>
          
          <h1 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark flex items-center gap-2">
            🗺️ <span>LifeLog AI</span>
          </h1>
        </div>

        {/* Right: Dark mode toggle and User */}
        <div className="flex items-center gap-4">
          {/* Dark mode toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
          >
            {theme === 'light' ? (
              <Moon className="text-text-secondary-light dark:text-text-secondary-dark" size={20} />
            ) : (
              <Sun className="text-text-secondary-light dark:text-text-secondary-dark" size={20} />
            )}
          </Button>

          {/* User avatar */}
          <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <User size={18} className="text-white" />
            </div>
            <span className="hidden sm:block text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
              Mario
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
