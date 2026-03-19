import { Moon, Sun, RefreshCw, LogOut } from 'lucide-react';
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
    <header className="sticky top-0 z-40 bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark px-6 py-4 shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Left: Logo */}
        <h1
          onClick={() => navigate('/')}
          className="font-serif italic text-2xl tracking-tight text-text-primary-light dark:text-text-primary-dark cursor-pointer hover:text-primary transition-colors select-none"
        >
          MyMemo
        </h1>

        {/* Right: Actions (minimal) */}
        <div className="flex items-center gap-3">
          {/* Nuke Cache button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClearCache}
            title="Limpiar Caché"
            aria-label="Limpiar Caché"
          >
            <RefreshCw className="text-red-500" size={18} />
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

          {/* Logout */}
          {user && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <LogOut size={18} className="text-text-secondary-light dark:text-text-secondary-dark" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

