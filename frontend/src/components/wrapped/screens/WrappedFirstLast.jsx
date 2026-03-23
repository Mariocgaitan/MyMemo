import { motion } from 'framer-motion';

function formatDate(date) {
  return date.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function truncateText(text, maxLength = 50) {
  if (!text) return 'Sin descripción';
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
}

export default function WrappedFirstLast({ data }) {
  if (!data?.firstMemory || !data?.lastMemory) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <div className="text-center text-white">
          <p className="text-2xl font-bold">No hay recuerdos disponibles</p>
        </div>
      </div>
    );
  }

  const { firstMemory, lastMemory } = data;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: 0 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.6 } },
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900 p-8">
      <motion.div
        className="text-center mb-12"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-5xl sm:text-6xl font-black text-white mb-2">
          Tu viaje
        </h1>
        <p className="text-white/60 text-lg">Del primero al último</p>
      </motion.div>

      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 gap-8 w-full max-w-4xl"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* First Memory */}
        <motion.div
          className="flex flex-col"
          variants={itemVariants}
        >
          <div className="relative mb-4 rounded-2xl overflow-hidden h-64 sm:h-72">
            <motion.img
              src={firstMemory.image}
              alt="Primer recuerdo"
              className="w-full h-full object-cover"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6 }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />

            <div className="absolute bottom-0 left-0 right-0 p-4">
              <p className="text-white/60 text-sm mb-1">Tu primer recuerdo</p>
              <p className="text-white font-bold text-sm">
                {formatDate(firstMemory.date)}
              </p>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex-1">
            <p className="text-white/80 text-sm line-clamp-4">
              {truncateText(firstMemory?.description || firstMemory?.description_raw, 100)}
            </p>
          </div>
        </motion.div>

        {/* Last Memory */}
        <motion.div
          className="flex flex-col"
          variants={itemVariants}
        >
          <div className="relative mb-4 rounded-2xl overflow-hidden h-64 sm:h-72">
            <motion.img
              src={lastMemory.image}
              alt="Último recuerdo"
              className="w-full h-full object-cover"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />

            <div className="absolute bottom-0 left-0 right-0 p-4">
              <p className="text-white/60 text-sm mb-1">Tu último recuerdo</p>
              <p className="text-white font-bold text-sm">
                {formatDate(lastMemory.date)}
              </p>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex-1">
            <p className="text-white/80 text-sm line-clamp-4">
              {truncateText(lastMemory?.description || lastMemory?.description_raw, 100)}
            </p>
          </div>
        </motion.div>
      </motion.div>

      {/* Timeline indicator */}
      <motion.div
        className="mt-12 flex items-center gap-4 text-white/60 text-sm"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.6 }}
      >
        <div className="h-0.5 flex-1 bg-gradient-to-r from-transparent to-white/20" />
        <span>Tu línea del tiempo</span>
        <div className="h-0.5 flex-1 bg-gradient-to-l from-transparent to-white/20" />
      </motion.div>
    </div>
  );
}
