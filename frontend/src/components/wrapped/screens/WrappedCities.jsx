import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';

export default function WrappedCities({ data }) {
  if (!data?.cities || data.cities.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <p className="text-white/60">No hay datos de ubicaciones</p>
      </div>
    );
  }

  const { cities } = data;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.5,
        ease: 'easeOut',
      },
    },
  };

  // Color gradients for cities
  const gradients = [
    'from-red-500 to-orange-500',
    'from-blue-500 to-cyan-500',
    'from-purple-500 to-pink-500',
    'from-green-500 to-emerald-500',
    'from-yellow-500 to-orange-500',
    'from-indigo-500 to-blue-500',
  ];

  const getGradient = (index) => gradients[index % gradients.length];

  // Sort cities by memory count
  const sortedCities = [...cities].sort((a, b) => b.count - a.count);

  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-br from-gray-900 via-black to-gray-900 p-8 overflow-y-auto">
      <motion.div
        className="text-center mb-10"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-5xl sm:text-6xl font-black text-white mb-2">
          Tu mundo
        </h1>
        <p className="text-white/60 text-lg">Los lugares que visitaste</p>
      </motion.div>

      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 gap-6 flex-1"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {sortedCities.map((city, index) => (
          <motion.div
            key={city.name}
            className={`bg-gradient-to-br ${getGradient(index)} p-0.5 rounded-2xl`}
            variants={cardVariants}
          >
            <div className="bg-black rounded-2xl p-6 h-full flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-white text-2xl font-black mb-1">
                      {city.name}
                    </h3>
                    <div className="flex items-center gap-2 text-white/60 text-sm">
                      <MapPin className="w-4 h-4" />
                      <span>{city.country || 'Ubicación'}</span>
                    </div>
                  </div>

                  <div
                    className={`text-3xl font-black bg-gradient-to-r ${getGradient(index)} bg-clip-text text-transparent`}
                  >
                    {city.count}
                  </div>
                </div>

                {city.latitude && city.longitude && (
                  <div className="text-white/50 text-xs space-y-1">
                    <p>
                      <span className="text-white/70">Lat:</span> {city.latitude.toFixed(4)}
                    </p>
                    <p>
                      <span className="text-white/70">Lng:</span> {city.longitude.toFixed(4)}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-white/60 text-sm">
                  {city.count === 1 ? '1 recuerdo' : `${city.count} recuerdos`}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Summary */}
      <motion.div
        className="mt-10 text-center text-white/60 text-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.8 }}
      >
        <p>Viajaste a {sortedCities.length} lugar{sortedCities.length !== 1 ? 'es' : ''} distintos este año</p>
      </motion.div>
    </div>
  );
}
