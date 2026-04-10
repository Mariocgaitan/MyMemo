import { useEffect, useState } from 'react';
import { Compass, Loader2, Map, Bookmark, User, Tag } from 'lucide-react';
import { travelAPI } from '../services/api';
import { TravelProvider, useTravel } from '../contexts/TravelContext';
import ColdStartFlow from '../components/travel/ColdStartFlow';
import DiscoverFeed from '../components/travel/DiscoverFeed';
import MapExplore from '../components/travel/MapExplore';
import PlaceChips from '../components/travel/PlaceChips';
import SavedPlaces from '../components/travel/SavedPlaces';
import PlaceDetail from '../components/travel/PlaceDetail';
import TravelProfile from '../components/travel/TravelProfile';
import PromotionsSection from '../components/travel/PromotionsSection';

function TravelMemoContent() {
  const { location, preferences, setPreferences, feedState, loadFeed, loadMoreFeed } = useTravel();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeView, setActiveView] = useState('feed');
  const [selectedType, setSelectedType] = useState(null);
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [mapClusters, setMapClusters] = useState([]);
  const [profile, setProfile] = useState(null);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [selectedPlaceDetail, setSelectedPlaceDetail] = useState(null);
  const [placeDetailOpen, setPlaceDetailOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!location) return;
      try {
        setLoading(true);
        await loadFeed({ reset: true, typeFilter: selectedType });
        const [saved, map, profileData] = await Promise.all([
          travelAPI.getSavedPlaces(),
          travelAPI.getMapClusters({ lat: location.lat, lng: location.lng, radius_km: 12 }),
          travelAPI.getProfile(),
        ]);
        setSavedPlaces(saved?.places || []);
        setMapClusters(map?.clusters || []);
        setProfile(profileData || null);
      } catch (err) {
        setError('No se pudo cargar TravelMemo.');
      } finally {
        setLoading(false);
      }
    };

    load();
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

  const handleSaved = async () => {
    const [saved, profileData] = await Promise.all([
      travelAPI.getSavedPlaces(),
      travelAPI.getProfile(),
    ]);
    setSavedPlaces(saved?.places || []);
    setProfile(profileData || null);
  };

  const openPlaceDetail = async (placeId, publicMemoryId = null) => {
    const detail = await travelAPI.getPlaceDetail(placeId);
    setSelectedPlaceDetail(detail);
    setPlaceDetailOpen(true);
    if (publicMemoryId) {
      await travelAPI.createEvent({ event_type: 'click', place_id: placeId, public_memory_id: publicMemoryId });
    }
  };

  const handleSaveFromDetail = async (placeId) => {
    await travelAPI.savePlace(placeId);
    await handleSaved();
  };

  const needsColdStart = !preferences || !preferences.preferred_types || preferences.preferred_types.length < 3;

  return (
    <div className="min-h-[calc(100vh-80px)] bg-background-light dark:bg-background-dark pb-8">
      <div className="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-2">
          <Compass size={20} className="text-primary" />
          <h1 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">
            MyTravelMemo
          </h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 mt-6 space-y-4">
        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
          Espacio publico de momentos compartidos. Monetizacion y promociones estan diferidas.
        </p>

        <div className="flex gap-2">
          <button onClick={() => setActiveView('feed')} className={`rounded-xl px-4 py-2 text-sm font-medium ${activeView === 'feed' ? 'bg-primary text-white' : 'bg-surface-light dark:bg-surface-dark text-text-primary-light dark:text-text-primary-dark border border-border-light dark:border-border-dark'}`}>
            <span className="inline-flex items-center gap-2"><Compass size={14} /> Feed</span>
          </button>
          <button onClick={() => setActiveView('map')} className={`rounded-xl px-4 py-2 text-sm font-medium ${activeView === 'map' ? 'bg-primary text-white' : 'bg-surface-light dark:bg-surface-dark text-text-primary-light dark:text-text-primary-dark border border-border-light dark:border-border-dark'}`}>
            <span className="inline-flex items-center gap-2"><Map size={14} /> Mapa</span>
          </button>
          <button onClick={() => setActiveView('saved')} className={`rounded-xl px-4 py-2 text-sm font-medium ${activeView === 'saved' ? 'bg-primary text-white' : 'bg-surface-light dark:bg-surface-dark text-text-primary-light dark:text-text-primary-dark border border-border-light dark:border-border-dark'}`}>
            <span className="inline-flex items-center gap-2"><Bookmark size={14} /> Guardados</span>
          </button>
          <button onClick={() => setActiveView('profile')} className={`rounded-xl px-4 py-2 text-sm font-medium ${activeView === 'profile' ? 'bg-primary text-white' : 'bg-surface-light dark:bg-surface-dark text-text-primary-light dark:text-text-primary-dark border border-border-light dark:border-border-dark'}`}>
            <span className="inline-flex items-center gap-2"><User size={14} /> Perfil</span>
          </button>
          <button onClick={() => setActiveView('promotions')} className={`rounded-xl px-4 py-2 text-sm font-medium ${activeView === 'promotions' ? 'bg-primary text-white' : 'bg-surface-light dark:bg-surface-dark text-text-primary-light dark:text-text-primary-dark border border-border-light dark:border-border-dark'}`}>
            <span className="inline-flex items-center gap-2"><Tag size={14} /> Promociones</span>
          </button>
        </div>

        {needsColdStart && (
          <ColdStartFlow onSubmit={handleSavePreferences} isSaving={savingPrefs} />
        )}

        {activeView === 'feed' && (
          <>
            <PlaceChips selected={selectedType} onSelect={setSelectedType} />
            {loading && (
              <div className="flex items-center gap-2 text-text-secondary-light dark:text-text-secondary-dark">
                <Loader2 size={16} className="animate-spin" />
                Cargando feed...
              </div>
            )}
            {error && <div className="text-sm text-red-500">{error}</div>}
            {!loading && !error && (
              <DiscoverFeed
                items={feedState.items}
                loading={feedState.loading}
                hasMore={feedState.hasMore}
                onLoadMore={() => loadMoreFeed(selectedType)}
                onSaved={handleSaved}
                onOpenPlace={openPlaceDetail}
              />
            )}
          </>
        )}

        {activeView === 'map' && location && (
          <MapExplore clusters={mapClusters} center={location} onSelectPlace={openPlaceDetail} />
        )}

        {activeView === 'saved' && (
          <SavedPlaces places={savedPlaces} />
        )}

        {activeView === 'profile' && (
          <TravelProfile profile={profile} />
        )}

        {activeView === 'promotions' && (
          <PromotionsSection />
        )}
      </div>

      <PlaceDetail
        isOpen={placeDetailOpen}
        detail={selectedPlaceDetail}
        onClose={() => setPlaceDetailOpen(false)}
        onSave={handleSaveFromDetail}
      />
    </div>
  );
}

export default function TravelMemo() {
  return (
    <TravelProvider>
      <TravelMemoContent />
    </TravelProvider>
  );
}
