import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTravel } from '../../contexts/TravelContext';
import { travelAPI } from '../../services/api';
import ColdStartFlow from '../../components/travel/ColdStartFlow';
import PlaceChips from '../../components/travel/PlaceChips';
import DiscoverFeed from '../../components/travel/DiscoverFeed';
import PlaceDetail from '../../components/travel/PlaceDetail';

export default function FeedPage() {
  const { location, preferences, setPreferences, feedState, loadFeed, loadMoreFeed } = useTravel();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [selectedPlaceDetail, setSelectedPlaceDetail] = useState(null);
  const [placeDetailOpen, setPlaceDetailOpen] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    if (!location) return;
    setLoading(true);
    loadFeed({ reset: true, typeFilter: selectedType })
      .catch(() => setError('No se pudo cargar el feed.'))
      .finally(() => setLoading(false));
  }, [location, selectedType]);

  const handleSavePreferences = async (preferredTypes) => {
    try {
      setSavingPrefs(true);
      await setPreferences({ preferred_types: preferredTypes });
      await loadFeed({ reset: true, typeFilter: selectedType });
    } finally {
      setSavingPrefs(false);
    }
  };

  const openPlaceDetail = async (placeId, publicMemoryId = null) => {
    const detail = await travelAPI.getPlaceDetail(placeId);
    setSelectedPlaceDetail(detail);
    setPlaceDetailOpen(true);
    if (publicMemoryId) {
      await travelAPI.createEvent({ event_type: 'click', place_id: placeId, public_memory_id: publicMemoryId });
    }
  };

  const needsColdStart = !preferences || !preferences.preferred_types || preferences.preferred_types.length < 3;

  return (
    <div className="py-5 space-y-4">
      {needsColdStart && (
        <div className="px-4">
          <ColdStartFlow onSubmit={handleSavePreferences} isSaving={savingPrefs} />
        </div>
      )}

      <div className="px-4">
        <PlaceChips selected={selectedType} onSelect={setSelectedType} />
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-text-secondary-light dark:text-text-secondary-dark">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Cargando feed...</span>
        </div>
      )}

      {error && <p className="px-4 text-sm text-red-500">{error}</p>}

      {!loading && !error && (
        <DiscoverFeed
          items={feedState.items}
          loading={feedState.loading}
          hasMore={feedState.hasMore}
          onLoadMore={() => loadMoreFeed(selectedType)}
          onOpenPlace={openPlaceDetail}
        />
      )}

      <PlaceDetail
        isOpen={placeDetailOpen}
        detail={selectedPlaceDetail}
        onClose={() => setPlaceDetailOpen(false)}
      />
    </div>
  );
}
