import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import { searchAPI } from '../../../services/api';

/**
 * Picks the best city-level name from Google reverse geocode results.
 * Google returns results from most-specific (street) to most-general (country).
 * We want roughly index 2-3: neighborhood or city, never street or country.
 *
 * Strategy: prefer a result whose formatted_address contains a comma
 * and is neither too short (country-only) nor too long (full street).
 */
function pickBestResult(results = []) {
  if (!results.length) return null;

  // Try to find a result that is city/neighborhood-level.
  // Usually Google returns: 0=street, 1=route/postal, 2=locality/sublocality, 3=city, 4=state/country
  // We prefer index 2 or 3, but fallback gracefully.
  const candidates = results.slice(1, 4); // skip the most specific (street)
  for (const r of candidates) {
    const addr = r.formatted_address || '';
    const parts = addr.split(',').map(p => p.trim());
    // Good candidates: 2-3 parts, first part is the neighborhood or city name (not a number = street number)
    if (parts.length >= 2 && parts.length <= 4 && !/^\d/.test(parts[0])) {
      return parts[0]; // e.g. "Polanco" or "Ciudad de México"
    }
  }

  // Fallback: use the first result's first comma segment if readable
  const fallback = (results[2] || results[1] || results[0])?.formatted_address || '';
  const firstPart = fallback.split(',')[0].trim();
  return /^\d/.test(firstPart) ? fallback.split(',')[1]?.trim() || 'Lugar visitado' : firstPart;
}

/**
 * Returns true if a string looks like raw coordinates (no letters).
 */
function isCoordinates(str) {
  return /^[-\d.,\s]+$/.test((str || '').trim());
}

export default function WrappedCities({ data }) {
  const [locationNames, setLocationNames] = useState({});
  const [geocoding, setGeocoding] = useState(false);

  const { cities } = data || {};

  // Batch reverse-geocode cities that have coordinates but a coordinate-like name
  useEffect(() => {
    if (!cities?.length) return;

    const toGeocode = cities.filter(
      c => c.latitude && c.longitude && (!c.name || isCoordinates(c.name) || isCoordinates(c.country))
    );

    if (!toGeocode.length) return;

    setGeocoding(true);

    Promise.allSettled(
      toGeocode.map(async (city) => {
        try {
          const resp = await searchAPI.reverseGeocodePlace(city.latitude, city.longitude);
          const results = resp?.results || [];
          const name = pickBestResult(results);
          return { key: city.name, name: name || city.name };
        } catch {
          return { key: city.name, name: city.name };
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
   * Gets the best display name for a city:
   * 1. Reverse-geocoded result (if available)
   * 2. Raw location_name if it's not coordinate-like
   * 3. "Lugar visitado" fallback
   */
  const getDisplayName = (city) => {
    const geocoded = locationNames[city.name];
    if (geocoded) return geocoded;
    if (!isCoordinates(city.name)) return city.name;
    if (!isCoordinates(city.country) && city.country) return city.country;
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
                {/* City name */}
                <h3 className="text-[#EDE8E3] text-sm sm:text-base font-black leading-tight mb-1 line-clamp-2">
                  {displayName}
                </h3>

                {/* Location icon */}
                <div className="flex items-center gap-1 text-[#8C8078] text-[10px] sm:text-xs mb-2">
                  <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                  <span className="truncate">Ubicación</span>
                </div>

                {/* Count badge */}
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
