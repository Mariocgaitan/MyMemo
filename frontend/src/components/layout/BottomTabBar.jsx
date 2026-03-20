import { useLocation, useNavigate } from 'react-router-dom';
import { Map, Clock, Plus, Search, Users } from 'lucide-react';

export default function BottomTabBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { id: 'map', path: '/', icon: Map, label: 'Mapa' },
    { id: 'timeline', path: '/timeline', icon: Clock, label: 'Timeline' },
    { id: 'create', path: '/create', icon: Plus, label: 'Agregar', center: true },
    { id: 'search', path: '/search', icon: Search, label: 'Buscar' },
    { id: 'people', path: '/people', icon: Users, label: 'Personas' },
  ];

  const isActive = (path) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-surface-light dark:bg-surface-dark border-t border-border-light dark:border-border-dark shadow-2xl safe-bottom">
      <div className="max-w-7xl mx-auto px-0 py-2 flex items-center justify-around">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              data-onboarding-tab={tab.id}
              className={`
                flex flex-col items-center justify-center gap-1 
                ${tab.center ? 'px-6 py-3' : 'px-4 py-3 flex-1'}
                rounded-2xl transition-all duration-200
                ${
                  active
                    ? 'text-primary'
                    : 'text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark'
                }
                ${tab.center ? 'bg-primary/10 hover:bg-primary/20 scale-110' : 'hover:bg-background-light dark:hover:bg-background-dark'}
              `}
              title={tab.label}
              aria-label={tab.label}
            >
              <Icon
                size={tab.center ? 24 : 20}
                strokeWidth={2}
                className={tab.center ? 'text-primary' : ''}
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
