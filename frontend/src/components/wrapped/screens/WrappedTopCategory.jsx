import { motion } from 'framer-motion';
import OverlappingCollage from '../OverlappingCollage';

export default function WrappedTopCategory({ data }) {
  if (!data?.topCategory) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900 p-8">
        <h1 className="text-4xl font-black text-white mb-4">Sin datos</h1>
        <p className="text-white/60 text-center max-w-sm">
          No hemos encontrado una categoría destacada en tus recuerdos. ¡Asigna categorías a tus fotos para verlas aquí!
        </p>
      </div>
    );
  }

  const { topCategory, topCategoryMemories } = data;

  // Get top 15 photos in this category
  const photos = topCategoryMemories.slice(0, 15);

  // Category color mapping
  const categoryColors = {
    viaje: { gradient: 'from-blue-500 to-cyan-500', accent: 'bg-blue-500/20' },
    comida: { gradient: 'from-orange-500 to-red-500', accent: 'bg-orange-500/20' },
    familia: { gradient: 'from-pink-500 to-rose-500', accent: 'bg-pink-500/20' },
    amistad: { gradient: 'from-purple-500 to-pink-500', accent: 'bg-purple-500/20' },
    trabajo: { gradient: 'from-gray-500 to-slate-600', accent: 'bg-gray-500/20' },
    deporte: { gradient: 'from-green-500 to-emerald-500', accent: 'bg-green-500/20' },
    arte: { gradient: 'from-indigo-500 to-purple-500', accent: 'bg-indigo-500/20' },
    natureza: { gradient: 'from-green-600 to-emerald-600', accent: 'bg-green-600/20' },
  };

  const categoryColor = categoryColors[topCategory.name?.toLowerCase()] || {
    gradient: 'from-violet-500 to-purple-500',
    accent: 'bg-violet-500/20',
  };

  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-br from-gray-900 via-black to-gray-900 overflow-hidden">
      {/* Header */}
      <motion.div
        className="text-center pt-8 px-8 flex-shrink-0"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* Category badge */}
        <motion.div
          className="mb-4 flex justify-center"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className={`px-4 py-2 rounded-full bg-gradient-to-r ${categoryColor.gradient} inline-block`}>
            <span className="text-white font-bold text-sm sm:text-base">{topCategory.name}</span>
          </div>
        </motion.div>

        <h1 className="text-4xl sm:text-5xl font-black text-white mb-2">
          Tu tema favorito
        </h1>
        <p className="text-white/60 text-sm sm:text-base">Este año en MyMemo</p>
        <p className="text-white/80 text-2xl sm:text-3xl font-bold mt-3">
          {topCategory.count} <span className="text-white/60 text-base sm:text-lg">momentos</span>
        </p>
      </motion.div>

      {/* Overlapping Collage with Dynamic Layout */}
      <div className={`flex-1 relative overflow-hidden ${categoryColor.accent}`}>
        <OverlappingCollage
          photos={photos}
          maxPhotos={15}
          containerClassName="absolute inset-0"
          imageClassName="rounded-xl shadow-2xl border border-white/20"
          staggerDelay={0.03}
        />
      </div>

      {/* Bottom accent */}
      <motion.div
        className="flex-shrink-0 text-center pb-6 px-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.8 }}
      >
        <p className="text-white/40 text-xs sm:text-sm">Flota sobre las fotos para verlas mejor</p>
      </motion.div>
    </div>
  );
}
