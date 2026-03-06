import { Menu, Moon, Sun, Users, RefreshCw, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../ui/Button';

export default function Header() {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleClearCache = async () => {
    if (window.confirm("¿Forzar actualización profunda borrando todos los cachés? (Arregla problemas de PWA)")) {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (let r of regs) await r.unregister();
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        for (let k of keys) await caches.delete(k);
      }
      window.location.reload(true);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark px-6 py-4 shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Left: Logo */}
        <div className="flex items-center gap-4">
          <button
            className="lg:hidden p-2 hover:bg-background-light dark:hover:bg-background-dark rounded-lg transition-colors"
            aria-label="Abrir menú"
          >
            <Menu className="text-text-secondary-light dark:text-text-secondary-dark" size={24} />
          </button>

          <h1
            onClick={() => navigate('/')}
            className="font-serif italic text-2xl tracking-tight text-text-primary-light dark:text-text-primary-dark cursor-pointer hover:text-primary transition-colors select-none"
          >
            MyMemo
          </h1>
        </div>

        {/* Right: Dark mode + People nav */}
        <div className="flex items-center gap-3">
          {/* Nuke Cache button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClearCache}
            title="Limpiar Caché"
            aria-label="Limpiar Caché"
          >
            <RefreshCw className="text-red-500 overflow-visible" size={18} />
          </Button>

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

          {/* People link */}
          <button
            onClick={() => navigate('/people')}
            className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-primary/10 transition-colors group"
            aria-label="Ver personas"
          >
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center group-hover:bg-primary-hover transition-colors">
              <Users size={16} className="text-white" />
            </div>
            <span className="hidden sm:block text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
              Personas
            </span>
          </button>

          {/* User info + logout */}
          {user && (
            <div className="flex items-center gap-2 pl-2 border-l border-border-light dark:border-border-dark">
              <span className="hidden sm:block text-sm text-text-secondary-light dark:text-text-secondary-dark max-w-[120px] truncate">
                {user.name || user.email}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
              >
                <LogOut size={18} className="text-text-secondary-light dark:text-text-secondary-dark" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

