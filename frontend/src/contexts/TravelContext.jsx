import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { travelAPI } from '../services/api';

const TravelContext = createContext(null);

export function TravelProvider({ children }) {
  const [location, setLocation] = useState(null);
  const [locationGranted, setLocationGranted] = useState(false);
  const [preferences, setPreferencesState] = useState(null);
  const [feedState, setFeedState] = useState({ items: [], cursor: null, loading: false, hasMore: false });

  useEffect(() => {
    travelAPI.getPreferences().then(setPreferencesState).catch(() => setPreferencesState(null));
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocationGranted(true);
      },
      () => {
        setLocationGranted(false);
        setLocation({ lat: 19.4326, lng: -99.1332 });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 }
    );
  }, []);

  const loadFeed = async ({ reset = true, cursor = null, typeFilter = null } = {}) => {
    if (!location) return;
    setFeedState((prev) => ({ ...prev, loading: true }));
    try {
      const data = await travelAPI.getFeed({ lat: location.lat, lng: location.lng, cursor, type_filter: typeFilter });
      setFeedState((prev) => ({
        items: reset ? (data.items || []) : [...prev.items, ...(data.items || [])],
        cursor: data.next_cursor || null,
        hasMore: Boolean(data.next_cursor),
        loading: false,
      }));
    } catch {
      setFeedState((prev) => ({ ...prev, loading: false }));
    }
  };

  const loadMoreFeed = async (typeFilter = null) => {
    if (!feedState.cursor || feedState.loading) return;
    await loadFeed({ reset: false, cursor: feedState.cursor, typeFilter });
  };

  const invalidateFeed = async () => {
    await loadFeed({ reset: true });
  };

  const setPreferences = async (payload) => {
    const updated = await travelAPI.updatePreferences(payload);
    setPreferencesState(updated);
    return updated;
  };

  const value = useMemo(() => ({
    location,
    locationGranted,
    preferences,
    setPreferences,
    feedState,
    loadFeed,
    loadMoreFeed,
    invalidateFeed,
  }), [location, locationGranted, preferences, feedState]);

  return <TravelContext.Provider value={value}>{children}</TravelContext.Provider>;
}

export function useTravel() {
  const context = useContext(TravelContext);
  if (!context) throw new Error('useTravel must be used inside TravelProvider');
  return context;
}
