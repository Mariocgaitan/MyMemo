import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';

/**
 * Returns a short, readable location label from whatever is stored in city.country.
 * The field may contain coordinates ("23.4, -99.1") or a real country name.
 * If it looks like coordinates, we just show a generic fallback.
 */
function getLocationLabel(country) {
  if (!country) return 'Lugar visitado';
  // Detect coordinate-like strings (digits, dots, commas, minus signs, spaces only)
  const isCoords = /^[-\d.,\s]+$/.test(country.trim());
  if (isCoords) return 'Lugar visitado';
  return country;
}

export default function WrappedCities({ data }) {
  if (!data?.cities || data.cities.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#141110] via-[#1E1A17] to-[#141110]">
        <p className="text-[#8C8078] text-sm">No hay datos de ubicaciones</p>
      </div>
    );
  }

  const { cities } = data;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.15 },
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

  // Warm sepia/amber gradient borders
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

  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-br from-[#141110] via-[#1E1A17] to-[#141110] overflow-hidden">
      {/* Header — compact */}
      <motion.div
        className="text-center pt-5 px-6 pb-3 flex-shrink-0"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl sm:text-5xl font-black text-[#EDE8E3] mb-1">Tu mundo</h1>
        <p className="text-[#8C8078] text-xs sm:text-base">
          Visitaste {sortedCities.length} lugar{sortedCities.length !== 1 ? 'es' : ''} distintos
        </p>
      </motion.div>

      {/* Cities Grid — fills all remaining space */}
      <motion.div
        className="flex-1 grid grid-cols-2 gap-2.5 px-4 pb-4 overflow-y-auto"
        style={{ alignContent: 'start' }}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {sortedCities.map((city, index) => (
          <motion.div
            key={city.name}
            className={`bg-gradient-to-br ${getGradient(index)} p-px rounded-xl`}
            variants={cardVariants}
          >
            <div className="bg-[#1E1A17] rounded-xl p-3 h-full flex flex-col justify-between">
              {/* City name */}
              <h3 className="text-[#EDE8E3] text-sm sm:text-base font-black leading-tight mb-1">
                {city.name}
              </h3>

              {/* Location label */}
              <div className="flex items-center gap-1 text-[#8C8078] text-[10px] sm:text-xs mb-2">
                <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                <span className="truncate">{getLocationLabel(city.country)}</span>
              </div>

              {/* Count badge */}
              <div className={`self-start px-2 py-0.5 rounded-full bg-gradient-to-r ${getGradient(index)} text-[#141110] text-xs font-black`}>
                {city.count} {city.count === 1 ? 'recuerdo' : 'recuerdos'}
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
