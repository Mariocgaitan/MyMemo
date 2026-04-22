import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTravel } from '../../contexts/TravelContext';
import { travelAPI } from '../../services/api';
import MapExplore from '../../components/travel/MapExplore';
import PlaceDetail from '../../components/travel/PlaceDetail';

export default function MapPage() {
  const { location } = useTravel();
  const [mapClusters, setMapClusters] = useState([]);
  const [selectedPlaceDetail, setSelectedPlaceDetail] = useState(null);
  const [placeDetailOpen, setPlaceDetailOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!location) return;
    travelAPI
      .getMapClusters({ lat: location.lat, lng: location.lng, radius_km: 500 })
      .then((data) => setMapClusters(data?.clusters || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [location]);

  const openPlaceDetail = async (placeId, publicMemoryId = null) => {
    const detail = await travelAPI.getPlaceDetail(placeId);
    setSelectedPlaceDetail(detail);
    setPlaceDetailOpen(true);
    if (publicMemoryId) {
      await travelAPI.createEvent({ event_type: 'click', place_id: placeId, public_memory_id: publicMemoryId });
    }
  };

  if (!location || loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-text-secondary-light dark:text-text-secondary-dark">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">Cargando mapa...</span>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      <MapExplore clusters={mapClusters} center={location} onSelectPlace={openPlaceDetail} />
      <PlaceDetail
        isOpen={placeDetailOpen}
        detail={selectedPlaceDetail}
        onClose={() => setPlaceDetailOpen(false)}
      />
    </div>
  );
}
