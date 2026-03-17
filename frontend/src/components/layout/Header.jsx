import { Menu, Moon, Sun, Users, RefreshCw, LogOut, Wand2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { connectionsAPI, peopleAPI } from '../../services/api';
import Button from '../ui/Button';
import { useState, useEffect, useCallback } from 'react';
import GeneratorModal from '../GeneratorModal';

export default function Header() {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [people, setPeople] = useState([]);

  const fetchPending = useCallback(async () => {
    if (!user) return;
    try {
      const data = await connectionsAPI.pending();
      setPendingCount(Array.isArray(data) ? data.length : 0);
    } catch {
      // silently ignore
    }
  }, [user]);

  useEffect(() => {
    fetchPending();
    const interval = setInterval(fetchPending, 60_000);
    window.addEventListener('connection-updated', fetchPending);
    return () => {
      clearInterval(interval);
      window.removeEventListener('connection-updated', fetchPending);
    };
  }, [fetchPending]);

  // Load people for the Magic Wand modal
  useEffect(() => {
    if (!user) return;
    peopleAPI.getAll()
      .then(data => {
        const named = (data || []).filter(p => !p.name.startsWith('Unknown Person'));
        setPeople(named);
      })
      .catch(console.error);
  }, [user]);

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

        {/* Right: Actions */}
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

          {/* People / Connections link (MERGED) */}
          <button
            onClick={() => navigate('/people')}
            className="group relative flex items-center gap-2 px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl hover:bg-primary/10 transition-colors"
            title="Ver personas y conexiones"
            aria-label="Ver personas"
          >
            <div className="relative w-8 h-8 rounded-full bg-primary flex items-center justify-center group-hover:bg-primary-hover transition-colors">
              <Users size={16} className="text-white" />
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 border border-surface-light dark:border-surface-dark">
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </div>
            <span className="hidden sm:block text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
              Personas
            </span>
          </button>

          {/* Magic Wand Button */}
          <button
            onClick={() => setGeneratorOpen(true)}
            title="Generador de Memorias Mágicas"
            className="w-10 h-10 rounded-full border border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center shadow-sm relative overflow-hidden group ml-1"
          >
            <Wand2 size={20} className="group-hover:rotate-12 transition-transform" />
            <div className="absolute inset-0 bg-white/20 w-1/2 -skew-x-12 -translate-x-full group-hover:animate-shine"></div>
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

      {/* Magic Generator Modal */}
      <GeneratorModal
        isOpen={generatorOpen}
        onClose={() => setGeneratorOpen(false)}
        people={people}
      />
    </header>
  );
}

