import { motion } from 'framer-motion';
import { Camera, Calendar, TrendingUp } from 'lucide-react';

export default function WrappedStats({ data }) {
  if (!data?.stats) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#141110] via-[#1E1A17] to-[#141110]">
        <p className="text-white/60">No hay datos disponibles</p>
      </div>
    );
  }

  const { stats } = data;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1,
      },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.9 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.6,
        ease: 'easeOut',
      },
    },
  };

  const numberVariants = {
    hidden: { opacity: 0, scale: 0 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.8,
        delay: 0.3,
        ease: 'easeOut',
      },
    },
  };

  const cards = [
    {
      icon: Camera,
      title: 'Fotos',
      value: stats.totalMemories || 0,
      color: 'from-[#C9A97A] to-[#8B6F47]',
      bgColor: 'bg-[#8B6F47]/10',
      borderColor: 'border-[#8B6F47]/20',
    },
    {
      icon: Calendar,
      title: 'Días activos',
      value: stats.activeDays || 0,
      color: 'from-[#F0E8DC] to-[#C9A97A]',
      bgColor: 'bg-[#C9A97A]/10',
      borderColor: 'border-[#C9A97A]/20',
    },
    {
      icon: TrendingUp,
      title: 'Promedio por semana',
      value: stats.averagePerWeek?.toFixed(1) || 0,
      color: 'from-[#8B6F47] to-[#7A5F3A]',
      bgColor: 'bg-[#7A5F3A]/10',
      borderColor: 'border-[#7A5F3A]/20',
    },
  ];

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#141110] via-[#1E1A17] to-[#141110] p-4 sm:p-8">
      <motion.div
        className="text-center mb-12"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-3xl sm:text-5xl font-black text-[#EDE8E3] mb-1">
          Los números
        </h1>
        <p className="text-[#8C8078] text-sm sm:text-lg">De tu año en MyMemo</p>
      </motion.div>

      <motion.div
        className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-5xl"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {cards.map((card, index) => {
          const Icon = card.icon;

          return (
            <motion.div
              key={index}
              className={`${card.bgColor} border ${card.borderColor} rounded-2xl p-8 text-center backdrop-blur-sm`}
              variants={cardVariants}
            >
              <motion.div
                className="mb-4 flex justify-center"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
              >
                <div className={`p-3 rounded-full bg-gradient-to-br ${card.color}`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </motion.div>

              <motion.div
                className="mb-3"
                variants={numberVariants}
              >
                <p className={`text-5xl sm:text-6xl font-black bg-gradient-to-r ${card.color} bg-clip-text text-transparent`}>
                  {card.value}
                </p>
              </motion.div>

              <p className="text-white/70 font-medium">{card.title}</p>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Motivational message */}
      <motion.div
        className="mt-12 text-center max-w-2xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.8 }}
      >
        <p className="text-white/60 text-lg leading-relaxed">
          {stats.totalMemories > 50
            ? '¡Increíble! Has capturado momentos especiales constantemente.'
            : stats.totalMemories > 20
              ? 'Buen trabajo preservando tus recuerdos.'
              : 'Cada recuerdo cuenta. Sigue creando.'}
        </p>
      </motion.div>
    </div>
  );
}
