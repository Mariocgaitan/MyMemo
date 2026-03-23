import { motion } from 'framer-motion';
import Masonry from 'react-masonry-css';
import '../masonry.css';

export default function WrappedTopPerson({ data }) {
  if (!data?.topPerson || !data?.topPersonMemories) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <p className="text-white/60">No hay datos de personas</p>
      </div>
    );
  }

  const { topPerson, topPersonMemories } = data;

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

  // Get top 15 photos with this person
  const photos = topPersonMemories.slice(0, 15);

  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-br from-gray-900 via-black to-gray-900 p-8 overflow-y-auto">
      <motion.div
        className="text-center mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-5xl sm:text-6xl font-black text-white mb-4">
          {topPerson.name}
        </h1>
        <p className="text-white/60 text-lg">Tu persona favorita este año</p>
        <p className="text-white/80 text-3xl font-bold mt-2">
          {topPerson.count} <span className="text-white/60 text-lg">recuerdos juntos</span>
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
            src={topPerson.mainPhoto}
            alt={topPerson.name}
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
          Momentos compartidos
        </h3>

        <Masonry
          breakpointCols={breakpoints}
          className="masonry-grid gap-4"
          columnClassName="masonry-grid-column"
        >
          {photos.map((photo, index) => (
            <motion.div
              key={`${topPerson.id}-${index}`}
              className="overflow-hidden rounded-lg"
              variants={imageVariants}
              whileHover={{
                scale: 1.05,
                transition: { duration: 0.2 },
              }}
            >
              <img
                src={photo}
                alt={`Recuerdo con ${topPerson.name}`}
                className="w-full h-auto object-cover cursor-pointer"
              />
            </motion.div>
          ))}
        </Masonry>
      </motion.div>
    </div>
  );
}
