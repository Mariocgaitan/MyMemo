import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { travelAPI } from '../../services/api';
import SavedPlaces from '../../components/travel/SavedPlaces';

export default function SavedPage() {
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    travelAPI
      .getSavedPlaces()
      .then((data) => setPlaces(data?.places || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-text-secondary-light dark:text-text-secondary-dark">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">Cargando guardados...</span>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      <SavedPlaces places={places} />
    </div>
  );
}
