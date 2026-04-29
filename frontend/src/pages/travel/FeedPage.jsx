import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTravel } from '../../contexts/TravelContext';
import { travelAPI } from '../../services/api';
import ColdStartFlow from '../../components/travel/ColdStartFlow';
import PlaceChips from '../../components/travel/PlaceChips';
import DiscoverFeed from '../../components/travel/DiscoverFeed';
import PlaceDetail from '../../components/travel/PlaceDetail';

export default function FeedPage() {
  const { location, preferences, setPreferences } = useTravel();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [places, setPlaces] = useState([]);
  const [selectedPlaceDetail, setSelectedPlaceDetail] = useState(null);
  const [placeDetailOpen, setPlaceDetailOpen] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const loadDiscover = async (typeFilter = null) => {
    if (!location) return;
    setLoading(true);
    setError(null);
    try {
      const data = await travelAPI.getDiscover({
        lat: location.lat,
        lng: location.lng,
        radius_km: 3,
        ...(typeFilter ? { type_filter: typeFilter } : {}),
      });
      setPlaces(data?.places || []);
    } catch {
      setError('No se pudo cargar el feed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDiscover(selectedType);
  }, [location, selectedType]);

  const handleSavePreferences = async (preferredTypes) => {
    try {
      setSavingPrefs(true);
      await setPreferences({ preferred_types: preferredTypes });
    } finally {
      setSavingPrefs(false);
    }
  };

  const openPlaceDetail = async (googlePlaceId, publicMemoryId = null) => {
    try {
      const detail = await travelAPI.getPlaceDetail(googlePlaceId);
      setSelectedPlaceDetail(detail);
      setPlaceDetailOpen(true);
      if (publicMemoryId) {
        await travelAPI.createEvent({ event_type: 'click', place_id: googlePlaceId, public_memory_id: publicMemoryId });
      }
    } catch {
      // Place not in our catalog yet — show minimal detail
      const found = places.find(p => p.google_place_id === googlePlaceId);
      if (found) {
        setSelectedPlaceDetail({
          place: {
            place_id: found.google_place_id,
            name: found.name,
            city: null,
            country: null,
            memory_count: found.memory_count,
          },
          memories: [],
          user_has_been_here: false,
          user_visit_count: 0,
          visit_context: null,
        });
        setPlaceDetailOpen(true);
      }
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
          <span className="text-sm">Buscando lugares...</span>
        </div>
      )}

      {error && <p className="px-4 text-sm text-red-500">{error}</p>}

      {!loading && !error && (
        <DiscoverFeed places={places} onOpenPlace={openPlaceDetail} />
      )}

      <PlaceDetail
        isOpen={placeDetailOpen}
        detail={selectedPlaceDetail}
        onClose={() => setPlaceDetailOpen(false)}
      />
    </div>
  );
}

