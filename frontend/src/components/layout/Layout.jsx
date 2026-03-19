import Header from './Header';
import BottomTabBar from './BottomTabBar';

export default function Layout({ children, showFAB = false }) {
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col">
      <Header />
      
      <main className="relative flex-1 pb-20">
        {children}
      </main>

      {/* Bottom Tab Bar (navigation) */}
      <BottomTabBar />
    </div>
  );
}
