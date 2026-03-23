import { motion } from 'framer-motion';

// Word Cloud generator - distributes words in a spiral pattern
function generateWordCloudPositions(words) {
  const width = 1200;
  const height = 700;
  const positions = [];
  const occupied = [];

  // Sort by size (larger words first)
  const sorted = [...words].sort((a, b) => b.frequency - a.frequency);

  // Spiral pattern starting from center
  for (let word of sorted) {
    let placed = false;
    const maxRadius = Math.max(width, height) * 0.6; // Ajustar radio máximo
    
    // Try to place the word
    for (let angle = 0; angle < Math.PI * 2; angle += 0.08) {
      for (let radius = 30; radius < maxRadius; radius += 25) {
        const x = width / 2 + radius * Math.cos(angle);
        const y = height / 2 + radius * Math.sin(angle);

        // Check if position is valid and not occupied
        let collision = false;
        // Calcular tamaño más conservador para evitar cortes
        const textWidth = word.name.length * 12 * (0.6 + word.frequency / 10);
        const textHeight = 35 * (0.6 + word.frequency / 10);

        for (let occupied_pos of occupied) {
          const dx = occupied_pos.x - x;
          const dy = occupied_pos.y - y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const minDistance = (textWidth + occupied_pos.width) / 2 + 15;

          if (distance < minDistance) {
            collision = true;
            break;
          }
        }

        // Aumentar márgenes para evitar cortes en bordes
        const margin = 60;
        if (!collision && x > textWidth / 2 + margin && x < width - textWidth / 2 - margin && 
            y > textHeight / 2 + margin && y < height - textHeight / 2 - margin) {
          positions.push({
            ...word,
            x: (x / width) * 100,
            y: (y / height) * 100,
            rotation: (Math.random() - 0.5) * 8, // -4 a +4 grados
          });
          occupied.push({ x, y, width: textWidth, height: textHeight });
          placed = true;
          break;
        }
      }
      if (placed) break;
    }

    // Fallback if spiral placement fails - posiciones con más margen
    if (!placed) {
      positions.push({
        ...word,
        x: Math.random() * 70 + 15,
        y: Math.random() * 70 + 15,
        rotation: (Math.random() - 0.5) * 8,
      });
    }
  }

  return positions;
}

export default function WrappedPeopleCloud({ data }) {
  if (!data?.peopleCloud || data.peopleCloud.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900 p-8">
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

  // Color palette for word cloud
  const colors = [
    { from: 'from-pink-400', to: 'to-red-500' },
    { from: 'from-purple-400', to: 'to-pink-500' },
    { from: 'from-blue-400', to: 'to-purple-500' },
    { from: 'from-cyan-400', to: 'to-blue-500' },
    { from: 'from-emerald-400', to: 'to-cyan-500' },
    { from: 'from-yellow-400', to: 'to-emerald-500' },
    { from: 'from-orange-400', to: 'to-yellow-500' },
    { from: 'from-red-400', to: 'to-orange-500' },
  ];

  const getColor = (index) => colors[index % colors.length];

  // Size mapping based on frequency
  const maxFreq = Math.max(...peopleCloud.map(p => p.frequency));
  const minFreq = Math.min(...peopleCloud.map(p => p.frequency));

  const getSizeClass = (frequency) => {
    const ratio = (frequency - minFreq) / (maxFreq - minFreq + 1);
    if (ratio >= 0.75) return 'text-5xl sm:text-6xl font-black';
    if (ratio >= 0.5) return 'text-4xl sm:text-5xl font-bold';
    if (ratio >= 0.25) return 'text-3xl sm:text-4xl font-bold';
    return 'text-2xl sm:text-3xl font-semibold';
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900 p-4 sm:p-6">
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
        className="relative w-full flex-1 min-h-0 flex items-center justify-center"
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
              className="absolute whitespace-nowrap will-change-transform"
              style={{
                left: `${person.x}%`,
                top: `${person.y}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: Math.floor(person.frequency),
              }}
              variants={textVariants}
            >
              <motion.div
                className={`${sizeClass} bg-gradient-to-r ${color.from} ${color.to} bg-clip-text text-transparent cursor-default select-none transition-all drop-shadow-lg font-black`}
                style={{
                  rotate: person.rotation,
                }}
                whileHover={{
                  scale: 1.15,
                  filter: 'brightness(1.3) drop-shadow(0 0 10px rgba(255,255,255,0.5))',
                  transition: { duration: 0.2 },
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
