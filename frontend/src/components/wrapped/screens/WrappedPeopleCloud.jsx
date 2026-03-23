import { motion } from 'framer-motion';

// Word Cloud generator - distributes words in a spiral pattern
function generateWordCloudPositions(words) {
  const width = 1000;
  const height = 600;
  const positions = [];
  const occupied = [];

  // Sort by size (larger words first)
  const sorted = [...words].sort((a, b) => b.frequency - a.frequency);

  // Spiral pattern starting from center
  for (let word of sorted) {
    let placed = false;
    const maxRadius = Math.max(width, height);
    
    // Try to place the word
    for (let angle = 0; angle < Math.PI * 2; angle += 0.1) {
      for (let radius = 50; radius < maxRadius; radius += 20) {
        const x = width / 2 + radius * Math.cos(angle);
        const y = height / 2 + radius * Math.sin(angle);

        // Check if position is valid and not occupied
        let collision = false;
        const textWidth = word.name.length * 15 * (0.5 + word.size / 3);
        const textHeight = 30 * (0.5 + word.size / 3);

        for (let occupied_pos of occupied) {
          const dx = occupied_pos.x - x;
          const dy = occupied_pos.y - y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const minDistance = (textWidth + occupied_pos.width) / 2 + 10;

          if (distance < minDistance) {
            collision = true;
            break;
          }
        }

        if (!collision && x > textWidth / 2 && x < width - textWidth / 2 && 
            y > textHeight / 2 && y < height - textHeight / 2) {
          positions.push({
            ...word,
            x: (x / width) * 100,
            y: (y / height) * 100,
            rotation: (Math.random() - 0.5) * 10, // -5 to +5 degrees
          });
          occupied.push({ x, y, width: textWidth, height: textHeight });
          placed = true;
          break;
        }
      }
      if (placed) break;
    }

    // Fallback if spiral placement fails
    if (!placed) {
      positions.push({
        ...word,
        x: Math.random() * 80 + 10,
        y: Math.random() * 80 + 10,
        rotation: (Math.random() - 0.5) * 10,
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
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900 p-8">
      <motion.div
        className="text-center mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-5xl sm:text-6xl font-black text-white mb-2">
          Tu gente
        </h1>
        <p className="text-white/60 text-lg">Los que comparten tus momentos</p>
      </motion.div>

      {/* Word Cloud Container */}
      <motion.div
        className="relative w-full max-w-5xl h-96 sm:h-[500px] flex items-center justify-center"
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
              className="absolute whitespace-nowrap"
              style={{
                left: `${person.x}%`,
                top: `${person.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
              variants={textVariants}
            >
              <motion.div
                className={`${sizeClass} bg-gradient-to-r ${color.from} ${color.to} bg-clip-text text-transparent cursor-default select-none transition-all`}
                style={{
                  rotate: person.rotation,
                }}
                whileHover={{
                  scale: 1.15,
                  filter: 'brightness(1.2)',
                  transition: { duration: 0.2 },
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
        className="mt-8 text-center text-white/60 text-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.8 }}
      >
        <p>{peopleCloud.length} personas en tus recuerdos este año</p>
      </motion.div>
    </div>
  );
}
