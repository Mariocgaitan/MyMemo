import { motion } from 'framer-motion';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export default function WrappedTimeline({ data }) {
  if (!data?.timeline || data.timeline.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <p className="text-white/60">No hay datos de línea de tiempo</p>
      </div>
    );
  }

  const { timeline, maxMonthCount } = data;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.2,
      },
    },
  };

  const monthVariants = {
    hidden: { opacity: 0, scale: 0, y: 10 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: 'easeOut',
      },
    },
  };

  // Calculate size based on proportion
  const getSize = (count) => {
    if (maxMonthCount === 0) return 'text-2xl';
    const ratio = count / maxMonthCount;

    if (ratio >= 0.8) return 'text-6xl sm:text-7xl';
    if (ratio >= 0.6) return 'text-5xl sm:text-6xl';
    if (ratio >= 0.4) return 'text-4xl sm:text-5xl';
    if (ratio >= 0.2) return 'text-3xl sm:text-4xl';
    return 'text-xl sm:text-2xl';
  };

  const getColor = (count) => {
    if (count === 0) return 'text-white/20';
    if (count >= maxMonthCount * 0.8) return 'text-pink-400';
    if (count >= maxMonthCount * 0.6) return 'text-purple-400';
    if (count >= maxMonthCount * 0.4) return 'text-blue-400';
    if (count >= maxMonthCount * 0.2) return 'text-cyan-400';
    return 'text-white/40';
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
          Tu año
        </h1>
        <p className="text-white/60 text-lg">Mes a mes, visualizado</p>
      </motion.div>

      {/* Timeline */}
      <motion.div
        className="w-full max-w-5xl"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Grid of months */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-8 sm:gap-6">
          {timeline.map((month, index) => {
            const count = month.count || 0;

            return (
              <motion.div
                key={month.month}
                className="flex flex-col items-center gap-3"
                variants={monthVariants}
              >
                {/* Month circle with count */}
                <motion.div
                  className={`flex items-center justify-center font-black ${getSize(count)} ${getColor(count)} transition-colors duration-300`}
                  whileHover={{
                    scale: 1.15,
                    transition: { duration: 0.3 },
                  }}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{
                    duration: 0.5,
                    delay: index * 0.08 + 0.2,
                  }}
                >
                  {count === 0 ? '○' : count}
                </motion.div>

                {/* Month label */}
                <div className="text-white/70 text-xs sm:text-sm font-medium text-center">
                  {MONTHS[index]}
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Legend */}
      <motion.div
        className="mt-12 text-center text-white/60 text-sm max-w-2xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 1 }}
      >
        <p>
          El tamaño de cada número representa cuántos recuerdos guardaste ese mes.
          Tu mes más activo fue <span className="text-pink-400 font-semibold">
            {MONTHS[timeline.indexOf(timeline.reduce((max, m) => (m.count > max.count ? m : max)))]}
          </span>.
        </p>
      </motion.div>
    </div>
  );
}
