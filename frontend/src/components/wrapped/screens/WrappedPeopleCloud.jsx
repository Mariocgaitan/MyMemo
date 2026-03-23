import { motion } from 'framer-motion';

// Ordered Word Cloud generator - distributes words in a clean spiral without overlap
function generateWordCloudPositions(words) {
  const positions = [];
  
  // Sort by frequency (largest first)
  const sorted = [...words].sort((a, b) => b.frequency - a.frequency);
  
  // Clean spiral layout - positions calculated mathematically to avoid overlap
  const totalWords = sorted.length;
  const centerX = 50;
  const centerY = 50;
  
  for (let i = 0; i < totalWords; i++) {
    const word = sorted[i];
    
    // Golden angle spiral - mathematically proven to distribute points evenly
    const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ~2.39996 radians
    const angle = i * goldenAngle;
    
    // Radius increases with position to create clean spiral
    // Keep radius tight to prevent text from going outside container
    // Reduce from 45% to 35% max radius
    const radiusMultiplier = Math.sqrt(i + 1) * 1.2;
    const radius = Math.min(25 + radiusMultiplier, 35); // Max 35% from center (reduced from 45%)
    
    // Calculate position as percentage
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    
    positions.push({
      ...word,
      x: Math.max(8, Math.min(92, x)), // Tighter clamp: 8-92% (was 5-95%)
      y: Math.max(8, Math.min(92, y)),
      rotation: angle * (180 / Math.PI) % 360, // Rotate text to face outward slightly
      spiralIndex: i,
    });
  }
  
  return positions;
}

export default function WrappedPeopleCloud({ data }) {
  if (!data?.peopleCloud || data.peopleCloud.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#141110] via-[#1E1A17] to-[#141110] p-8">
        <h1 className="text-4xl font-black text-white mb-4">Sin datos</h1>
        <p className="text-white/60 text-center max-w-sm">
          No hemos registrado personas en tus recuerdos este año. ¡Empieza a etiquetar personas en tus fotos!
        </p>
      </div>
    );
  }

  const { peopleCloud } = data;
  const positions = generateWordCloudPositions(peopleCloud);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.03,
        delayChildren: 0.2,
      },
    },
  };

  const textVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.4,
        ease: 'easeOut',
      },
    },
  };

  // Color palette warm sepia/amber — matching the site's tobacco/analog palette
  const colors = [
    { from: 'from-[#C9A97A]', to: 'to-[#8B6F47]' },
    { from: 'from-[#F0E8DC]', to: 'to-[#C9A97A]' },
    { from: 'from-[#8B6F47]', to: 'to-[#7A5F3A]' },
    { from: 'from-[#D4B896]', to: 'to-[#8B6F47]' },
    { from: 'from-[#EDE8E3]', to: 'to-[#C9A97A]' },
    { from: 'from-[#C9A97A]', to: 'to-[#F0E8DC]' },
    { from: 'from-[#A8845C]', to: 'to-[#8B6F47]' },
    { from: 'from-[#F0E8DC]', to: 'to-[#8B6F47]' },
  ];

  const getColor = (index) => colors[index % colors.length];

  // Size mapping based on frequency
  const maxFreq = Math.max(...peopleCloud.map(p => p.frequency));
  const minFreq = Math.min(...peopleCloud.map(p => p.frequency));

  const getSizeClass = (frequency) => {
    const ratio = (frequency - minFreq) / (maxFreq - minFreq + 1);
    if (ratio >= 0.75) return 'text-2xl sm:text-3xl font-black';
    if (ratio >= 0.5) return 'text-xl sm:text-2xl font-bold';
    if (ratio >= 0.25) return 'text-base sm:text-xl font-bold';
    return 'text-sm sm:text-base font-semibold';
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#141110] via-[#1E1A17] to-[#141110] p-4 sm:p-6">
      <motion.div
        className="text-center mb-6 flex-shrink-0"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white mb-2">
          Tu gente
        </h1>
        <p className="text-white/60 text-sm sm:text-base md:text-lg">Los que comparten tus momentos</p>
      </motion.div>

      {/* Word Cloud Container - Expandido */}
      <motion.div
        className="relative w-full flex-1 min-h-0 flex items-center justify-center overflow-hidden"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {positions.map((person, index) => {
          const color = getColor(index);
          const sizeClass = getSizeClass(person.frequency);

          return (
            <motion.div
              key={person.id}
              className="absolute flex items-center justify-center will-change-transform overflow-hidden"
              style={{
                left: `${person.x}%`,
                top: `${person.y}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: Math.floor(person.frequency),
              }}
              variants={textVariants}
            >
              <motion.div
                className={`${sizeClass} bg-gradient-to-r ${color.from} ${color.to} bg-clip-text text-transparent cursor-default select-none transition-all drop-shadow-lg font-black whitespace-nowrap px-2`}
                whileHover={{
                  scale: 1.2,
                  filter: 'brightness(1.4) drop-shadow(0 0 15px rgba(255,255,255,0.6))',
                  transition: { duration: 0.25 },
                }}
                whileTap={{
                  scale: 1.1,
                }}
              >
                {person.name}
              </motion.div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Stats footer */}
      <motion.div
        className="mt-4 flex-shrink-0 text-center text-white/60 text-xs sm:text-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.8 }}
      >
        <p>{peopleCloud.length} personas en tus recuerdos este año</p>
      </motion.div>
    </div>
  );
}
