import { motion } from 'framer-motion';
import OverlappingCollage from '../OverlappingCollage';

export default function WrappedTopPerson({ data }) {
  if (!data?.topPerson) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#141110] via-[#1E1A17] to-[#141110] p-8">
        <h1 className="text-4xl font-black text-white mb-4">Sin datos</h1>
        <p className="text-white/60 text-center max-w-sm">
          No hemos encontrado una persona destacada en tus recuerdos. ¡Etiqueta personas para verlas aquí!
        </p>
      </div>
    );
  }

  const { topPerson, topPersonMemories } = data;

  // Get top 15 photos with this person
  const photos = topPersonMemories.slice(0, 15);

  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-br from-[#141110] via-[#1E1A17] to-[#141110] overflow-hidden">
      {/* Header */}
      <motion.div
        className="text-center pt-8 px-8 flex-shrink-0"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-2xl sm:text-4xl font-black text-[#EDE8E3] mb-2">
          {topPerson.name}
        </h1>
        <p className="text-[#8C8078] text-xs sm:text-base">Tu persona favorita este año</p>
        <p className="text-[#C9A97A] text-xl sm:text-3xl font-bold mt-2">
          {topPerson.count} <span className="text-[#8C8078] text-sm sm:text-lg">recuerdos juntos</span>
        </p>
      </motion.div>

      {/* Overlapping Collage with Dynamic Layout */}
      <OverlappingCollage
        photos={photos}
        maxPhotos={15}
        containerClassName="flex-1 relative overflow-hidden"
        imageClassName="rounded-xl shadow-2xl"
        staggerDelay={0.03}
      />

      {/* Bottom accent */}
      <motion.div
        className="flex-shrink-0 text-center pb-6 px-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.8 }}
      >
        <p className="text-white/40 text-xs sm:text-sm">Flota sobre las fotos para verlas mejor</p>
      </motion.div>
    </div>
  );
}
