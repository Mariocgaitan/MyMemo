import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Header from './Header';

export default function Layout({ children, showFAB = false }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      <Header />
      
      <main className="relative">
        {children}
      </main>

      {/* Floating Action Button */}
      {showFAB && (
        <button
          onClick={() => navigate('/create')}
          className="fixed bottom-6 right-6 z-[9999] w-16 h-16 bg-primary hover:bg-primary-hover text-white rounded-full shadow-2xl hover:shadow-3xl flex items-center justify-center transition-all duration-normal hover:scale-110 active:scale-95"
          aria-label="Crear nuevo recuerdo"
        >
          <Plus size={32} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
