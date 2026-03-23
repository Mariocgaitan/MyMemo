import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import { searchAPI } from '../../../services/api';

/**
 * Picks the best city-level name from Google reverse geocode results.
 * Google returns results from most-specific to most-general.
 * We want roughly index 2-3: neighborhood or city, never street or country.
 */
function pickBestResult(results = []) {
  if (!results.length) return null;

  // Skip index 0 (usually street address), try 1-4 for city/neighborhood level
  for (const r of results.slice(1, 5)) {
    const addr = (r.formatted_address || '').trim();
    // Good candidates: readable parts, not starting with a number (= street address)
    const parts = addr.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 1 && !/^\d/.test(parts[0]) && parts[0].length > 2) {
      return parts[0]; // e.g. "Polanco", "Cancún", "Guadalajara"
    }
  }

  // Fallback: first readable segment from any result
  for (const r of results) {
    const addr = (r.formatted_address || '').trim();
    const firstPart = addr.split(',')[0]?.trim();
    if (firstPart && !/^\d/.test(firstPart) && firstPart.length > 2) {
      return firstPart;
    }
  }

  return null;
}

export default function WrappedCities({ data }) {
  // Map: "lat,lng" -> resolved location name
  const [locationNames, setLocationNames] = useState({});
  const [geocoding, setGeocoding] = useState(false);

  const { cities } = data || {};

  useEffect(() => {
    if (!cities?.length) return;

    // Geocode ALL cities that have valid lat/lng coordinates.
    // We always use the numeric lat/lng from the DB, regardless of what location_name says.
    const toGeocode = cities.filter(c => c.latitude != null && c.longitude != null);
    if (!toGeocode.length) return;

    setGeocoding(true);

    Promise.allSettled(
      toGeocode.map(async (city) => {
        const coordKey = `${city.latitude},${city.longitude}`;
        try {
          const resp = await searchAPI.reverseGeocodePlace(city.latitude, city.longitude);
          const results = resp?.results || [];
          const name = pickBestResult(results);
          return { key: coordKey, name };
        } catch {
          return { key: coordKey, name: null };
        }
      })
    ).then((settled) => {
      const map = {};
      settled.forEach((result) => {
        if (result.status === 'fulfilled' && result.value?.key) {
          map[result.value.key] = result.value.name;
        }
      });
      setLocationNames(map);
      setGeocoding(false);
    });
  }, [cities]);

  if (!cities || cities.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#141110] via-[#1E1A17] to-[#141110]">
        <p className="text-[#8C8078] text-sm">No hay datos de ubicaciones</p>
      </div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.1 },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: 'easeOut' },
    },
  };

  const gradients = [
    'from-[#C9A97A] to-[#8B6F47]',
    'from-[#8B6F47] to-[#7A5F3A]',
    'from-[#F0E8DC] to-[#C9A97A]',
    'from-[#D4B896] to-[#8B6F47]',
    'from-[#A8845C] to-[#7A5F3A]',
    'from-[#EDE8E3] to-[#C9A97A]',
  ];

  const getGradient = (index) => gradients[index % gradients.length];

  const sortedCities = [...cities].sort((a, b) => b.count - a.count);

  /**
   * Returns the best display name for a city, in priority order:
   * 1. Google-geocoded result (using lat,lng as key)
   * 2. Raw location_name if it looks like a real name (not coordinates)
   * 3. country field if it looks readable
   * 4. "Lugar visitado" as last resort
   */
  const getDisplayName = (city) => {
    const coordKey = `${city.latitude},${city.longitude}`;
    const geocoded = locationNames[coordKey];
    if (geocoded) return geocoded;

    // Still geocoding — show a light placeholder
    if (geocoding && city.latitude != null) return '…';

    // Fallback: use location_name if it looks like a real name
    const name = city.name || '';
    const isOnlyCoords = /^[-\d.,\s°NnSsEeWw]+$/.test(name.trim());
    if (!isOnlyCoords && name.length > 2) return name.split(',')[0].trim();

    // Fallback: country field
    const country = city.country || '';
    const countryIsCoords = /^[-\d.,\s°NnSsEeWw]+$/.test(country.trim());
    if (!countryIsCoords && country.length > 2 && country !== 'Ubicación') return country;

    return 'Lugar visitado';
  };

  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-br from-[#141110] via-[#1E1A17] to-[#141110] overflow-hidden">
      {/* Header */}
      <motion.div
        className="text-center pt-5 px-6 pb-3 flex-shrink-0"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl sm:text-5xl font-black text-[#EDE8E3] mb-1">Tu mundo</h1>
        <p className="text-[#8C8078] text-xs sm:text-base">
          Visitaste {sortedCities.length} lugar{sortedCities.length !== 1 ? 'es' : ''} distintos
          {geocoding && <span className="ml-2 text-[#C9A97A] animate-pulse">· resolviendo ubicaciones…</span>}
        </p>
      </motion.div>

      {/* Cities Grid */}
      <motion.div
        className="flex-1 grid grid-cols-2 gap-2.5 px-4 pb-4 overflow-y-auto"
        style={{ alignContent: 'start' }}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {sortedCities.map((city, index) => {
          const displayName = getDisplayName(city);

          return (
            <motion.div
              key={city.name}
              className={`bg-gradient-to-br ${getGradient(index)} p-px rounded-xl`}
              variants={cardVariants}
            >
              <div className="bg-[#1E1A17] rounded-xl p-3 h-full flex flex-col justify-between">
                <h3 className="text-[#EDE8E3] text-sm sm:text-base font-black leading-tight mb-1 line-clamp-2">
                  {displayName}
                </h3>

                <div className="flex items-center gap-1 text-[#8C8078] text-[10px] sm:text-xs mb-2">
                  <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                  <span className="truncate">Ubicación</span>
                </div>

                <div className={`self-start px-2 py-0.5 rounded-full bg-gradient-to-r ${getGradient(index)} text-[#141110] text-xs font-black`}>
                  {city.count} {city.count === 1 ? 'recuerdo' : 'recuerdos'}
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
