import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Header from './Header';
import BottomTabBar from './BottomTabBar';
import TourOverlay from '../onboarding/TourOverlay';

export default function Layout({ children, showFAB = false }) {
  const location = useLocation();
  const { user } = useAuth();
  const [showMainTutorial, setShowMainTutorial] = useState(false);

  const mainTutorialKey = useMemo(
    () => `mymemo:onboarding:main:${user?.id || 'anon'}`,
    [user]
  );

  const mainSteps = useMemo(() => ([
    {
      title: 'Bienvenido a MyMemo',
      text: 'Te mostramos rapidamente como moverte por la app.',
    },
    {
      title: 'Tu vista principal',
      text: 'Aqui ves tus recuerdos por zona. Al acercar el mapa, los grupos se separan.',
      targetSelector: '[data-onboarding-tab="map"]',
    },
    {
      title: 'Recuerdos por fecha',
      text: 'En Timeline revisas tu historial en orden temporal.',
      targetSelector: '[data-onboarding-tab="timeline"]',
    },
    {
      title: 'Guardar un recuerdo',
      text: 'Usa el boton central para crear un recuerdo nuevo rapidamente.',
      targetSelector: '[data-onboarding-tab="create"]',
    },
    {
      title: 'Busqueda rapida',
      text: 'Encuentra recuerdos por texto, lugar, tags o personas.',
      targetSelector: '[data-onboarding-tab="search"]',
    },
    {
      title: 'Gestiona personas',
      text: 'Entrena rostros y mejora la precision de reconocimiento.',
      targetSelector: '[data-onboarding-tab="people"]',
    },
  ]), []);

  useEffect(() => {
    const alreadyCompleted = localStorage.getItem(mainTutorialKey) === '1';
    if (!alreadyCompleted && location.pathname === '/') {
      const t = setTimeout(() => setShowMainTutorial(true), 300);
      return () => clearTimeout(t);
    }
  }, [location.pathname, mainTutorialKey]);

  useEffect(() => {
    const openTutorial = () => setShowMainTutorial(true);
    window.addEventListener('mymemo:open-main-tutorial', openTutorial);
    return () => window.removeEventListener('mymemo:open-main-tutorial', openTutorial);
  }, []);

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col">
      <Header />
      
      <main className="relative flex-1 pb-20">
        {children}
      </main>

      {/* Bottom Tab Bar (navigation) */}
      <BottomTabBar />

      <TourOverlay
        open={showMainTutorial}
        steps={mainSteps}
        storageKey={mainTutorialKey}
        onComplete={() => setShowMainTutorial(false)}
        onSkip={() => setShowMainTutorial(false)}
      />
    </div>
  );
}
