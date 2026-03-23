import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function WrappedTimelapse({ data }) {
  const [photoIndex, setPhotoIndex] = useState(0);

  if (!data?.memoriesThisYear?.length) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <div className="text-center text-white">
          <p className="text-2xl font-bold">No hay recuerdos disponibles</p>
        </div>
      </div>
    );
  }

  const photos = data.memoriesThisYear
    .filter(m => m.image_url || m.thumbnail_url)
    .map(m => m.image_url || m.thumbnail_url);

  // Cambiar foto cada 1.5 segundos
  useEffect(() => {
    if (!photos.length) return;

    const interval = setInterval(() => {
      setPhotoIndex(prev => (prev + 1) % photos.length);
    }, 1500);

    return () => clearInterval(interval);
  }, [photos.length]);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900 relative overflow-hidden">
      {/* Background photos carousel */}
      <div className="absolute inset-0">
        {photos.map((photo, idx) => (
          <motion.img
            key={idx}
            src={photo}
            alt={`Memory ${idx}`}
            className="absolute inset-0 w-full h-full object-cover"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{
              opacity: idx === photoIndex ? 1 : 0,
              scale: idx === photoIndex ? 1 : 0.95,
            }}
            transition={{ duration: 0.8 }}
          />
        ))}

        {/* Overlay oscuro */}
        <div className="absolute inset-0 bg-black/60" />
      </div>

      {/* Text content */}
      <motion.div
        className="relative z-10 text-center text-white px-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
      >
        <motion.h1
          className="text-6xl sm:text-7xl font-black mb-6"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          Subiste
        </motion.h1>

        <motion.div
          className="mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <span className="text-8xl sm:text-9xl font-black bg-gradient-to-r from-primary via-pink-500 to-purple-500 bg-clip-text text-transparent">
            {data.totalMemories}
          </span>
        </motion.div>

        <motion.p
          className="text-3xl sm:text-4xl font-bold"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
        >
          recuerdos en 2026
        </motion.p>
      </motion.div>

      {/* Photo counter */}
      <motion.div
        className="absolute bottom-8 left-8 z-10 text-white/60 text-sm font-medium"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        {photoIndex + 1} / {photos.length}
      </motion.div>
    </div>
  );
}
