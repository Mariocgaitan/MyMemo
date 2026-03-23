import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { memoryAPI, peopleAPI, categoriesAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useWrappedData } from './useWrappedData';
import WrappedTimelapse from './screens/WrappedTimelapse';
import WrappedFirstLast from './screens/WrappedFirstLast';
import WrappedStats from './screens/WrappedStats';
import WrappedPeopleCloud from './screens/WrappedPeopleCloud';
import WrappedTopPerson from './screens/WrappedTopPerson';
import WrappedTopCategory from './screens/WrappedTopCategory';
import WrappedCities from './screens/WrappedCities';
import WrappedTimeline from './screens/WrappedTimeline';
import WrappedEnd from './screens/WrappedEnd';

const TOTAL_SCREENS = 9;

export default function WrappedModal({ isOpen, onClose }) {
  const [currentScreen, setCurrentScreen] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rawData, setRawData] = useState({ memories: [], people: [], categories: [] });

  const { user } = useAuth();
  const wrappedData = useWrappedData(rawData.memories, rawData.people, rawData.categories, user?.self_person_id);

  // Fetch datos cuando se abre el modal
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch en paralelo
        const [memoriesResp, peopleResp, categoriesResp] = await Promise.all([
          memoryAPI.getAllPages({ pageSize: 500 }),
          peopleAPI.getAll(),
          categoriesAPI.getAll(),
        ]);

        const rawMemories = memoriesResp.memories || [];
        const rawPeople = peopleResp || [];
        const rawCategories = categoriesResp || [];

        setRawData({
          memories: rawMemories,
          people: rawPeople,
          categories: rawCategories,
        });
      } catch (err) {
        console.error('Error loading wrapped data:', err);
        setError('Error al cargar los datos del wrapped');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen]);

  // Pantallas en orden
  const screens = [
    <WrappedTimelapse key="1" data={wrappedData} />,
    <WrappedFirstLast key="2" data={wrappedData} />,
    <WrappedStats key="3" data={wrappedData} />,
    <WrappedPeopleCloud key="4" data={wrappedData} />,
    <WrappedTopPerson key="5" data={wrappedData} />,
    <WrappedTopCategory key="6" data={wrappedData} />,
    <WrappedCities key="7" data={wrappedData} />,
    <WrappedTimeline key="8" data={wrappedData} />,
    <WrappedEnd key="9" data={wrappedData} onClose={onClose} />,
  ];

  const goNext = () => {
    if (currentScreen < TOTAL_SCREENS - 1) {
      setCurrentScreen(currentScreen + 1);
    }
  };

  const goPrev = () => {
    if (currentScreen > 0) {
      setCurrentScreen(currentScreen - 1);
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      className="fixed inset-0 z-[2000] bg-[#141110] overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 z-50 p-2 rounded-full hover:bg-white/10 text-white transition-colors"
        aria-label="Cerrar"
      >
        <X size={24} />
      </button>

      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-white/10">
        <motion.div
          className="h-full bg-gradient-to-r from-[#C9A97A] to-[#8B6F47]"
          initial={{ width: '0%' }}
          animate={{ width: `${((currentScreen + 1) / TOTAL_SCREENS) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Step indicator */}
      <div className="absolute top-6 left-6 text-white/60 text-sm font-medium">
        {currentScreen + 1} / {TOTAL_SCREENS}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="text-center">
            <div className="mb-4 inline-block">
              <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
            <p className="text-white text-lg">Cargando tu Wrapped...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-red-500/10 border border-red-500 rounded-xl px-6 py-4 max-w-sm">
            <p className="text-red-500 text-center">{error}</p>
            <button
              onClick={onClose}
              className="mt-4 w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {!loading && !error && wrappedData && (
        <>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentScreen}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full h-full"
            >
              {screens[currentScreen]}
            </motion.div>
          </AnimatePresence>

          {/* Navigation buttons */}
          <div className="absolute bottom-8 left-0 right-0 flex items-center justify-between px-8">
            <motion.button
              onClick={goPrev}
              disabled={currentScreen === 0}
              className={`p-3 rounded-full transition-all ${
                currentScreen === 0
                  ? 'bg-white/10 text-white/30 cursor-not-allowed'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
              whileHover={currentScreen > 0 ? { scale: 1.1 } : {}}
              whileTap={currentScreen > 0 ? { scale: 0.95 } : {}}
            >
              <ChevronLeft size={20} />
            </motion.button>

            <motion.button
              onClick={goNext}
              disabled={currentScreen === TOTAL_SCREENS - 1}
              className={`p-3 rounded-full transition-all ${
                currentScreen === TOTAL_SCREENS - 1
                  ? 'bg-white/10 text-white/30 cursor-not-allowed'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
              whileHover={currentScreen < TOTAL_SCREENS - 1 ? { scale: 1.1 } : {}}
              whileTap={currentScreen < TOTAL_SCREENS - 1 ? { scale: 0.95 } : {}}
            >
              <ChevronRight size={20} />
            </motion.button>
          </div>
        </>
      )}
    </motion.div>
  );
}
