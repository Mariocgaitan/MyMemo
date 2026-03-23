import { motion } from 'framer-motion';
import { Share2, Download, Heart } from 'lucide-react';
import { useState } from 'react';
import html2canvas from 'html2canvas';

export default function WrappedEnd({ data, onClose }) {
  const [isExporting, setIsExporting] = useState(false);
  const [exported, setExported] = useState(false);

  const totalMemories = data?.totalMemories || 0;
  const activeDays = data?.stats?.activeDays || 0;
  const topPerson = data?.topPerson?.name || 'alguien especial';

  const messages = [
    `${totalMemories} recuerdos guardados.`,
    `${activeDays} días de momentos.`,
    `Compartidos con ${topPerson}.`,
    '¡Gracias por confiar tus historias a MyMemo!',
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: 'easeOut',
      },
    },
  };

  const floatingVariants = {
    animate: {
      y: [0, -20, 0],
      transition: {
        duration: 3,
        repeat: Infinity,
        ease: 'easeInOut',
      },
    },
  };

  const handleExport = async () => {
    setIsExporting(true);

    try {
      // Get the wrapped modal content
      const element = document.querySelector('.wrapped-export-container');

      if (!element) {
        console.error('Export container not found');
        setIsExporting(false);
        return;
      }

      const canvas = await html2canvas(element, {
        backgroundColor: '#000000',
        scale: 2,
        useCORS: true,
      });

      // Create download link
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `MyMemo-Wrapped-${new Date().getFullYear()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setExported(true);
      setTimeout(() => {
        setExported(false);
      }, 2000);
    } catch (error) {
      console.error('Error exporting:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'MyMemo Wrapped',
          text: `Revisé mi año en MyMemo: ${totalMemories} recuerdos guardados.`,
          url: window.location.href,
        });
      } catch (error) {
        console.log('Share error:', error);
      }
    }
  };

  // Confetti pieces
  const confetti = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    delay: Math.random() * 0.5,
    duration: 2 + Math.random() * 1,
    left: Math.random() * 100,
  }));

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#141110] via-[#1E1A17] to-[#141110] p-8 relative overflow-hidden">
      {/* Confetti animation */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {confetti.map((piece) => (
          <motion.div
            key={piece.id}
            className="absolute w-2 h-2 bg-gradient-to-r from-[#C9A97A] to-[#8B6F47] rounded-full"
            style={{
              left: `${piece.left}%`,
              top: '-10px',
            }}
            animate={{
              y: window.innerHeight + 20,
              x: (Math.random() - 0.5) * 100,
              rotate: Math.random() * 360,
              opacity: [1, 0],
            }}
            transition={{
              duration: piece.duration,
              delay: piece.delay,
              ease: 'easeIn',
            }}
          />
        ))}
      </div>

      {/* Content */}
      <motion.div
        className="relative z-10 text-center max-w-2xl"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Heart animation */}
        <motion.div
          className="mb-6"
          variants={floatingVariants}
          animate="animate"
        >
          <Heart className="w-16 h-16 mx-auto text-pink-500 fill-pink-500" />
        </motion.div>

        {/* Main title */}
        <motion.h1
          className="text-6xl sm:text-7xl font-black text-white mb-4"
          variants={itemVariants}
        >
          Gracias
        </motion.h1>

        <motion.p
          className="text-xl sm:text-2xl text-white/70 mb-12"
          variants={itemVariants}
        >
          Por documentar tu vida en MyMemo
        </motion.p>

        {/* Stats messages */}
        <motion.div
          className="space-y-3 mb-12"
          variants={containerVariants}
        >
          {messages.map((message, index) => (
            <motion.p
              key={index}
              className="text-lg text-white/80 font-medium"
              variants={itemVariants}
            >
              {message}
            </motion.p>
          ))}
        </motion.div>

        {/* Action buttons */}
        <motion.div
          className="flex flex-col sm:flex-row gap-4 justify-center"
          variants={itemVariants}
        >
          <motion.button
            onClick={handleExport}
            disabled={isExporting || exported}
            className={`px-6 py-3 rounded-full font-bold flex items-center gap-2 transition-all ${
              exported
                ? 'bg-[#4A7C59] text-white'
                : 'bg-gradient-to-r from-[#C9A97A] to-[#8B6F47] text-white hover:shadow-lg hover:shadow-[#8B6F47]/40'
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Download className="w-5 h-5" />
            {isExporting ? 'Descargando...' : exported ? '¡Descargado!' : 'Descargar'}
          </motion.button>

          <motion.button
            onClick={handleShare}
            className="px-6 py-3 rounded-full font-bold flex items-center gap-2 bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Share2 className="w-5 h-5" />
            Compartir
          </motion.button>

          <motion.button
            onClick={() => onClose?.()} 
            className="px-6 py-3 rounded-full font-bold bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Cerrar
          </motion.button>
        </motion.div>

        {/* Footer message */}
        <motion.p
          className="text-white/50 text-sm mt-12"
          variants={itemVariants}
        >
          Vuelve el próximo año para ver cómo tu historia continúa
        </motion.p>
      </motion.div>
    </div>
  );
}
