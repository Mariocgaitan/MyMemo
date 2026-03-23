import { motion } from 'framer-motion';

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

  const textVariants = {
    hidden: { opacity: 0, scale: 0 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.5,
        ease: 'easeOut',
      },
    },
  };

  // Gradient colors for variety
  const gradients = [
    'from-pink-400 to-red-400',
    'from-purple-400 to-pink-400',
    'from-blue-400 to-purple-400',
    'from-cyan-400 to-blue-400',
    'from-green-400 to-cyan-400',
    'from-yellow-400 to-green-400',
    'from-orange-400 to-yellow-400',
    'from-red-400 to-orange-400',
  ];

  const getGradient = (index) => gradients[index % gradients.length];

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

      {/* Cloud container */}
      <motion.div
        className="relative w-full max-w-4xl h-96 sm:h-[500px] flex items-center justify-center"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {peopleCloud.map((person, index) => {
          const sizeClass = [
            'text-2xl sm:text-3xl',    // small
            'text-3xl sm:text-4xl',    // medium
            'text-4xl sm:text-5xl',    // large
            'text-5xl sm:text-6xl',    // xlarge
          ][person.size] || 'text-3xl sm:text-4xl';

          const fontWeightClass = [
            'font-medium',
            'font-semibold',
            'font-bold',
            'font-black',
          ][person.size] || 'font-bold';

          const xPercent = person.x * 100;
          const yPercent = person.y * 100;

          return (
            <motion.div
              key={person.id}
              className="absolute whitespace-nowrap"
              style={{
                left: `${xPercent}%`,
                top: `${yPercent}%`,
                transform: 'translate(-50%, -50%)',
              }}
              variants={textVariants}
            >
              <motion.div
                className={`${sizeClass} ${fontWeightClass} bg-gradient-to-r ${getGradient(index)} bg-clip-text text-transparent cursor-default select-none`}
                style={{
                  rotate: person.rotation,
                }}
                whileHover={{
                  scale: 1.2,
                  transition: { duration: 0.3 },
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
