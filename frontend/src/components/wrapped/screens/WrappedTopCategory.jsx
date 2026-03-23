import { motion } from 'framer-motion';
import Masonry from 'react-masonry-css';
import '../masonry.css';

export default function WrappedTopCategory({ data }) {
  if (!data?.topCategory || !data?.topCategoryMemories) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <p className="text-white/60">No hay datos de categorías</p>
      </div>
    );
  }

  const { topCategory, topCategoryMemories } = data;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.2,
      },
    },
  };

  const imageVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.5,
        ease: 'easeOut',
      },
    },
  };

  const breakpoints = {
    default: 5,
    1536: 5,
    1280: 4,
    1024: 3,
    768: 2,
    640: 1,
  };

  // Get top 15 photos in this category
  const photos = topCategoryMemories.slice(0, 15);

  const categoryColors = {
    viaje: 'from-blue-500 to-cyan-500',
    comida: 'from-orange-500 to-red-500',
    familia: 'from-pink-500 to-rose-500',
    amistad: 'from-purple-500 to-pink-500',
    trabajo: 'from-gray-500 to-slate-600',
    deporte: 'from-green-500 to-emerald-500',
    arte: 'from-indigo-500 to-purple-500',
    natureza: 'from-green-600 to-emerald-600',
  };

  const gradient = categoryColors[topCategory.name?.toLowerCase()] || 'from-violet-500 to-purple-500';

  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-br from-gray-900 via-black to-gray-900 p-8 overflow-y-auto">
      <motion.div
        className="text-center mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="mb-4 flex justify-center">
          <motion.div
            className={`px-6 py-2 rounded-full bg-gradient-to-r ${gradient} inline-block`}
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <span className="text-white font-bold text-lg">{topCategory.name}</span>
          </motion.div>
        </div>

        <h1 className="text-5xl sm:text-6xl font-black text-white mb-2">
          Tu tema favorito
        </h1>
        <p className="text-white/60 text-lg">Este año en MyMemo</p>
        <p className="text-white/80 text-3xl font-bold mt-4">
          {topCategory.count} <span className="text-white/60 text-lg">momentos</span>
        </p>
      </motion.div>

      {/* Hero image */}
      <motion.div
        className="mb-10 flex justify-center"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <div className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
          <img
            src={topCategory.mainPhoto}
            alt={topCategory.name}
            className="w-full h-80 object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
      </motion.div>

      {/* Photo grid */}
      <motion.div
        className="flex-1"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <h3 className="text-white/80 text-lg font-semibold mb-4">
          Tus momentos en {topCategory.name.toLowerCase()}
        </h3>

        <Masonry
          breakpointCols={breakpoints}
          className="masonry-grid gap-4"
          columnClassName="masonry-grid-column"
        >
          {photos.map((photo, index) => (
            <motion.div
              key={`${topCategory.id}-${index}`}
              className="overflow-hidden rounded-lg"
              variants={imageVariants}
              whileHover={{
                scale: 1.05,
                transition: { duration: 0.2 },
              }}
            >
              <img
                src={photo}
                alt={`Recuerdo: ${topCategory.name}`}
                className="w-full h-auto object-cover cursor-pointer"
              />
            </motion.div>
          ))}
        </Masonry>
      </motion.div>
    </div>
  );
}
