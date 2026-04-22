import { Outlet } from 'react-router-dom';
import { TravelProvider } from '../../contexts/TravelContext';
import TravelHeader from './TravelHeader';
import TravelBottomNav from './TravelBottomNav';

export default function TravelLayout() {
  return (
    <TravelProvider>
      <div className="min-h-screen bg-background-light dark:bg-background-dark">
        <TravelHeader />
        <main className="max-w-2xl mx-auto pb-20">
          <Outlet />
        </main>
        <TravelBottomNav />
      </div>
    </TravelProvider>
  );
}
