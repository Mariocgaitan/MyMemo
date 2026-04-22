import { useLocation, useNavigate } from 'react-router-dom';
import { Compass, Map, Bookmark, User } from 'lucide-react';

const tabs = [
  { id: 'feed', path: '/travel/feed', icon: Compass, label: 'Descubrir' },
  { id: 'map', path: '/travel/map', icon: Map, label: 'Mapa' },
  { id: 'saved', path: '/travel/saved', icon: Bookmark, label: 'Guardados' },
  { id: 'profile', path: '/travel/profile', icon: User, label: 'Perfil' },
];

export default function TravelBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname.startsWith(path);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-surface-light dark:bg-surface-dark border-t border-border-light dark:border-border-dark shadow-2xl safe-bottom">
      <div className="max-w-2xl mx-auto px-0 py-2 flex items-center justify-around">
        {tabs.map(({ id, path, icon: Icon, label }) => {
          const active = isActive(path);
          return (
            <button
              key={id}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center justify-center gap-1 px-4 py-2 flex-1 rounded-2xl transition-all duration-200 ${
                active
                  ? 'text-primary'
                  : 'text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark'
              }`}
              aria-label={label}
            >
              <Icon size={20} strokeWidth={2} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
