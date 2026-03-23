import { useMemo } from 'react';
import { motion } from 'framer-motion';

/**
 * Distributes words in a centered grid with slight random offsets.
 * Words are sorted by frequency (largest first) and placed in rows,
 * ensuring no wild rotations and proper mobile sizing.
 */
function generateCloudPositions(words) {
  if (!words.length) return [];

  const sorted = [...words].sort((a, b) => b.frequency - a.frequency);
  const total = sorted.length;

  // Small random rotations: only -8, -4, 0, 4, 8 degrees
  const rotations = [-8, -4, 0, 0, 4, 8];

  // Seed rotation so it's stable across renders
  return sorted.map((word, i) => ({
    ...word,
    rotation: rotations[i % rotations.length],
  }));
}

export default function WrappedPeopleCloud({ data }) {
  if (!data?.peopleCloud || data.peopleCloud.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#141110] via-[#1E1A17] to-[#141110] p-8">
        <h1 className="text-3xl font-black text-[#EDE8E3] mb-4">Sin datos</h1>
        <p className="text-[#8C8078] text-center max-w-sm text-sm">
          No hemos registrado personas en tus recuerdos este año. ¡Empieza a etiquetar personas en tus fotos!
        </p>
      </div>
    );
  }

  const { peopleCloud } = data;
  const positions = useMemo(() => generateCloudPositions(peopleCloud), [peopleCloud]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05, delayChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.7 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.4, ease: 'easeOut' },
    },
  };

  // Warm sepia/amber palette
  const colors = [
    'from-[#F0E8DC] to-[#C9A97A]',
    'from-[#C9A97A] to-[#8B6F47]',
    'from-[#D4B896] to-[#A8845C]',
    'from-[#EDE8E3] to-[#D4B896]',
    'from-[#C9A97A] to-[#F0E8DC]',
    'from-[#A8845C] to-[#C9A97A]',
    'from-[#8B6F47] to-[#C9A97A]',
    'from-[#F0E8DC] to-[#A8845C]',
  ];

  const maxFreq = Math.max(...peopleCloud.map(p => p.frequency));
  const minFreq = Math.min(...peopleCloud.map(p => p.frequency));

  const getSizeClass = (frequency) => {
    const ratio = maxFreq === minFreq ? 0.5 : (frequency - minFreq) / (maxFreq - minFreq);
    if (ratio >= 0.8) return 'text-3xl sm:text-4xl font-black';
    if (ratio >= 0.6) return 'text-2xl sm:text-3xl font-black';
    if (ratio >= 0.4) return 'text-xl sm:text-2xl font-bold';
    if (ratio >= 0.2) return 'text-base sm:text-xl font-bold';
    return 'text-sm sm:text-base font-semibold';
  };

  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-br from-[#141110] via-[#1E1A17] to-[#141110] overflow-hidden">
      {/* Header — compact on mobile */}
      <motion.div
        className="text-center pt-6 px-6 flex-shrink-0"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl sm:text-5xl font-black text-[#EDE8E3] mb-1">Tu gente</h1>
        <p className="text-[#8C8078] text-xs sm:text-base">Los que comparten tus momentos</p>
      </motion.div>

      {/* Word Cloud — flex-wrap centered layout */}
      <motion.div
        className="flex-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 sm:gap-x-5 sm:gap-y-3 px-4 py-4 overflow-hidden content-center"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {positions.map((person, index) => {
          const sizeClass = getSizeClass(person.frequency);
          const colorClass = colors[index % colors.length];

          return (
            <motion.span
              key={person.id}
              className={`${sizeClass} bg-gradient-to-r ${colorClass} bg-clip-text text-transparent font-black select-none whitespace-nowrap`}
              style={{ transform: `rotate(${person.rotation}deg)` }}
              variants={itemVariants}
              whileHover={{ scale: 1.15, transition: { duration: 0.2 } }}
              whileTap={{ scale: 1.05 }}
            >
              {person.name}
            </motion.span>
          );
        })}
      </motion.div>

      {/* Footer */}
      <motion.div
        className="flex-shrink-0 text-center pb-4 text-[#8C8078] text-xs sm:text-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.8 }}
      >
        <p>{peopleCloud.length} personas en tus recuerdos este año</p>
      </motion.div>
    </div>
  );
}
