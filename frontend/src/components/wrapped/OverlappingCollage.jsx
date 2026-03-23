import { motion } from 'framer-motion';

/**
 * Componente reutilizable para crear collages con solapamiento dinámico
 * Distribuye imágenes de forma orgánica con rotaciones y escalas variadas
 */
export default function OverlappingCollage({ 
  photos = [], 
  maxPhotos = 15,
  containerClassName = "flex-1 relative overflow-hidden",
  imageClassName = "rounded-lg",
  onImageHover = null,
  staggerDelay = 0.04,
}) {
  if (!photos || photos.length === 0) {
    return null;
  }

  // Limitar cantidad de fotos
  const displayPhotos = photos.slice(0, maxPhotos);

  /**
   * Algoritmo avanzado de distribución de fotos
   * Crea collages orgánicos dinámicos con solapamiento visual inteligente
   */
  const generateCollageLayout = (photosCount) => {
    // Patrones predefinidos para distribuciones óptimas según cantidad
    const layoutPatterns = {
      // 1-5 fotos: distribución central con solapamiento controlado
      small: (count) => {
        const angles = [];
        for (let i = 0; i < count; i++) {
          angles.push({
            x: 50 + Math.cos((i / count) * Math.PI * 2) * 25,
            y: 50 + Math.sin((i / count) * Math.PI * 2) * 25,
            rotation: (i / count) * 360 * 0.5,
            scale: 0.8 + (i * 0.15),
            zIndex: count - i,
            size: 100 + (i * 15),
          });
        }
        return angles;
      },

      // 6-12 fotos: distribución en espiral suave
      medium: (count) => {
        const positions = [];
        const centerX = 50;
        const centerY = 50;
        const spiralTightness = 0.8;
        
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 4; // 2 vueltas
          const radius = 25 + (i / count) * 15;
          
          positions.push({
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius,
            rotation: angle * 20 + (Math.random() - 0.5) * 8,
            scale: 0.7 + Math.random() * 0.45,
            zIndex: Math.floor(Math.random() * count),
            size: 90 + Math.random() * 50,
          });
        }
        return positions;
      },

      // 13+ fotos: grid dinámico con mucho solapamiento
      large: (count) => {
        const gridSize = Math.ceil(Math.sqrt(count));
        const positions = [];

        for (let i = 0; i < count; i++) {
          const row = Math.floor(i / gridSize);
          const col = i % gridSize;
          
          // Grid base
          const baseX = (col / gridSize) * 80 + 10;
          const baseY = (row / gridSize) * 80 + 10;
          
          // Offsets aleatorios para crear solapamiento
          const offsetX = (Math.random() - 0.5) * 25;
          const offsetY = (Math.random() - 0.5) * 25;

          positions.push({
            x: Math.max(5, Math.min(95, baseX + offsetX)),
            y: Math.max(5, Math.min(95, baseY + offsetY)),
            rotation: (Math.random() - 0.5) * 20,
            scale: 0.6 + Math.random() * 0.6,
            zIndex: Math.floor(Math.random() * count),
            size: 80 + Math.random() * 70,
          });
        }
        return positions;
      },
    };

    // Seleccionar patrón según cantidad
    let pattern;
    if (photosCount <= 5) {
      pattern = layoutPatterns.small(photosCount);
    } else if (photosCount <= 12) {
      pattern = layoutPatterns.medium(photosCount);
    } else {
      pattern = layoutPatterns.large(photosCount);
    }

    return pattern;
  };

  const layout = generateCollageLayout(displayPhotos.length);

  return (
    <div className={containerClassName}>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="absolute inset-4 sm:inset-6" style={{ perspective: '1200px' }}>
          {displayPhotos.map((photo, index) => {
            const layoutItem = layout[index];
            const size = layoutItem.size || 120;

            return (
              <motion.div
                key={`${photo}-${index}`}
                className={`absolute ${imageClassName} overflow-hidden shadow-2xl border border-white/30 cursor-pointer backdrop-blur-sm hover:border-white/60`}
                initial={{
                  opacity: 0,
                  scale: 0.2,
                  rotate: layoutItem.rotation + 45,
                  x: -100,
                  y: -100,
                }}
                animate={{
                  opacity: 0.85,
                  scale: layoutItem.scale,
                  rotate: layoutItem.rotation,
                  x: 0,
                  y: 0,
                }}
                transition={{
                  delay: index * staggerDelay,
                  duration: 0.8,
                  ease: [0.34, 1.56, 0.64, 1], // Bounce-like easing
                  opacity: { delay: index * staggerDelay, duration: 0.6 },
                }}
                whileHover={{
                  scale: layoutItem.scale * 1.15,
                  zIndex: 100,
                  opacity: 1,
                  y: -12,
                  filter: 'brightness(1.1)',
                  boxShadow: '0 25px 50px rgba(0,0,0,0.9)',
                  transition: { duration: 0.3 },
                }}
                whileTap={{
                  scale: layoutItem.scale * 1.08,
                }}
                style={{
                  left: `${layoutItem.x}%`,
                  top: `${layoutItem.y}%`,
                  width: `${size}px`,
                  height: `${size}px`,
                  zIndex: layoutItem.zIndex,
                  transformOrigin: 'center',
                  transform: `translate(-50%, -50%)`,
                }}
                onMouseEnter={() => onImageHover?.(index)}
              >
                {/* Imagen */}
                <img
                  src={photo}
                  alt={`Collage item ${index + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                />

                {/* Overlay gradiente premium */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
