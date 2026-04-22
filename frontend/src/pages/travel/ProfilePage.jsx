import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { travelAPI } from '../../services/api';
import TravelProfile from '../../components/travel/TravelProfile';

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    travelAPI
      .getProfile()
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-text-secondary-light dark:text-text-secondary-dark">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">Cargando perfil...</span>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      <TravelProfile profile={profile} />
    </div>
  );
}
