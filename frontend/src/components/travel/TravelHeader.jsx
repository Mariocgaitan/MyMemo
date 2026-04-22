import { ArrowLeft, Compass } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TravelHeader() {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark px-4 py-3 shadow-sm">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Compass size={22} className="text-primary" />
          <span className="font-serif italic text-xl tracking-tight text-text-primary-light dark:text-text-primary-dark">
            TravelMemo
          </span>
        </div>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-sm text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark transition-colors px-3 py-1.5 rounded-lg hover:bg-background-light dark:hover:bg-background-dark"
        >
          <ArrowLeft size={15} />
          MyMemo
        </button>
      </div>
    </header>
  );
}
