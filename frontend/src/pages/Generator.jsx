import React, { useState, useRef, useEffect } from 'react';
import { X, Search, Wand2, Image as ImageIcon, Calendar, Users, Loader2, ArrowRight, Check, ArrowLeft } from 'lucide-react';
import { memoryAPI, peopleAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';

export default function Generator() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  const [step, setStep] = useState('config'); // 'config' | 'processing' | 'found' | 'no_matches'
  
  // Config
  const [people, setPeople] = useState([]);
  const [selectedPeople, setSelectedPeople] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Processing & Memory
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [matchedFiles, setMatchedFiles] = useState([]); // Array of { file, previewUrl }
  const [currentIndex, setCurrentIndex] = useState(0);

  // References to keep state in async closures
  const filesRef = useRef([]);

  // Fetch people on mount
  useEffect(() => {
    peopleAPI.getAll()
      .then(data => {
        const named = (data || []).filter(p => !p.name.startsWith('Unknown Person'));
        setPeople(named);
      })
      .catch(console.error);
  }, []);

  // --------- Helpers ---------
  const handleTogglePerson = (id) => {
    setSelectedPeople(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  /**
   * Resizes an image file locally using Canvas. Returns Base64.
   */
  const scaleImageToCanvas = (file, maxDim = 800) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        // Convert to highly compressed JPEG to save bandwidth/RAM
        const b64 = canvas.toDataURL('image/jpeg', 0.6);
        resolve(b64);
      };
      img.onerror = () => reject(new Error('Canvas conversion failed'));
      img.src = url;
    });
  };

  /**
   * Main Handler: When the user selects "The entire gallery"
   */
  const handleFilesSelected = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    if (selectedPeople.length === 0) {
      alert('Por favor selecciona al menos una persona.');
      return;
    }

    setStep('processing');
    setIsProcessing(true);
    setProgressText('Analizando tus fotos localmente...');
    
    try {
      // 1. Filter by Date (Binary Search simulation / Fast filtering)
      let filtered = files;
      if (startDate && endDate) {
        const startTs = new Date(startDate).getTime();
        const endTs = new Date(endDate).getTime() + 86400000; // include full end day
        // Standard fast filter. For an array of 5,000 files in JS, standard filter() takes ~2ms.
        filtered = files.filter(f => f.lastModified >= startTs && f.lastModified <= endTs);
      }

      if (filtered.length === 0) {
        setStep('no_matches');
        return;
      }

      setProgressText(`Buscando rostros en ${filtered.length} fotos del periodo...`);

      // Shuffle the cluster so the discovery is random / serendipitous
      const shuffled = [...filtered].sort(() => 0.5 - Math.random());
      
      // We will process in batches of 5 to not hang the browser
      const BATCH_SIZE = 5;
      const MAX_TOTAL_TO_CHECK = 300; // Limit to protect browser RAM on huge galleries
      const clusterToProcess = shuffled.slice(0, MAX_TOTAL_TO_CHECK);
      
      let foundMatches = [];

      // Loop through batches
      for (let i = 0; i < clusterToProcess.length; i += BATCH_SIZE) {
        const batch = clusterToProcess.slice(i, i + BATCH_SIZE);
        setProgressText(`Escaneando fotos ${i} - ${Math.min(i + BATCH_SIZE, clusterToProcess.length)} (Encontradas: ${foundMatches.length})...`);
        
        // Convert batch to base64
        const scaledPromises = batch.map(async (file, idx) => {
          try {
            const b64 = await scaleImageToCanvas(file);
            return { photo_id: String(i + idx), image_base64: b64, originalFile: file };
          } catch (err) {
            return null;
          }
        });
        
        const scaledItems = (await Promise.all(scaledPromises)).filter(Boolean);
        if (scaledItems.length === 0) continue;

        // Call backend (Stateless RAM check)
        const payload = {
          target_person_ids: selectedPeople,
          images: scaledItems.map(item => ({ photo_id: item.photo_id, image_base64: item.image_base64 }))
        };

        try {
          const res = await memoryAPI.evaluateMatch(selectedPeople, payload.images);
          
          if (res.matched_photo_ids && res.matched_photo_ids.length > 0) {
             for (const mid of res.matched_photo_ids) {
               const sourceItem = scaledItems.find(s => s.photo_id === mid);
               if (sourceItem) {
                 foundMatches.push({
                   file: sourceItem.originalFile,
                   previewUrl: URL.createObjectURL(sourceItem.originalFile)
                 });
               }
             }
             
             // If we found at least one match, we can stop the brute-force and show it!
             // UX decision: Stop early to give instant gratification.
             if (foundMatches.length > 0) {
               break; 
             }
          }
        } catch (apiErr) {
          console.error('[evaluateMatch] API Error:', apiErr);
          // continue to next batch on error
        }
      }

      if (foundMatches.length > 0) {
        setMatchedFiles(foundMatches);
        setStep('found');
      } else {
        setStep('no_matches');
      }

    } catch (e) {
      console.error(e);
      setStep('no_matches');
    } finally {
      setIsProcessing(false);
      // clean up memory of file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const currentMatch = matchedFiles[currentIndex];

  const handleCreateMemory = () => {
    // Navigate to Create Memory page with the pre-selected file
    // and pre-filled tagged people
    if (!currentMatch) return;
    navigate('/create', {
      state: {
        prefilledFile: currentMatch.file,
        prefilledDate: currentMatch.file.lastModified ? new Date(currentMatch.file.lastModified).toISOString() : null,
        prefilledPeople: people.filter(p => selectedPeople.includes(p.id)).map(p => p.name)
      }
    });
  };

  // --------- Renderers ---------
  const renderConfig = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
          <Wand2 className="text-primary" size={24} />
        </div>
        <h3 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
          Generador de Memorias
        </h3>
        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark leading-relaxed px-4">
          Selecciona a quién quieres encontrar y el año/fecha. Luego, te pediremos que abras tu galería de fotos. Nosotros buscaremos mágicamente el recuerdo. <b>Tus fotos nunca se guardan, solo pasan por tu celular.</b>
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-2">
            <Users size={16} className="text-primary" /> ¿A quién buscas? (Obligatorio)
          </label>
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border border-border-light dark:border-border-dark rounded-xl bg-surface-light dark:bg-surface-dark">
            {people.map(p => (
              <button
                key={p.id}
                onClick={() => handleTogglePerson(p.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                  selectedPeople.includes(p.id)
                    ? 'border-primary bg-primary text-white'
                    : 'border-border-light dark:border-border-dark text-text-secondary-light hover:border-primary/50'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-2">
            <Calendar size={16} className="text-primary" /> Periodo (Opcional)
          </label>
          <div className="flex gap-2">
            <input
              type="date"
              className="flex-1 px-3 py-2 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl text-sm"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
            <span className="self-center text-text-secondary-light">a</span>
            <input
              type="date"
              className="flex-1 px-3 py-2 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl text-sm"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="pt-2">
        <input
          type="file"
          ref={fileInputRef}
          multiple
          accept="image/*"
          className="hidden"
          onChange={handleFilesSelected}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={selectedPeople.length === 0}
          className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ImageIcon size={18} />
          Seleccionar tu Galería Completa
        </button>
        <p className="text-xs text-center text-text-secondary-light mt-2">
          (Puedes seleccionar cientos de fotos, nosotros las filtramos.)
        </p>
      </div>
    </div>
  );

  const renderProcessing = () => (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-primary/20 rounded-full"></div>
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
        <Wand2 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary" size={20} />
      </div>
      <h3 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark text-center">
        Magia en proceso...
      </h3>
      <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark text-center px-4 animate-pulse">
        {progressText}
      </p>
    </div>
  );

  const renderFound = () => {
    if (!currentMatch) return null;
    return (
      <div className="space-y-4">
        <div className="text-center space-y-1">
          <h3 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-500">
            ¡Encontramos un recuerdo!
          </h3>
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            ¿Es este el momento que estabas buscando?
          </p>
        </div>

        <div className="relative rounded-2xl overflow-hidden bg-black/5 aspect-[4/5] flex items-center justify-center">
          <img 
            src={currentMatch.previewUrl} 
            alt="Match" 
            className="w-full h-full object-contain"
          />
          {currentMatch.file.lastModified && (
            <div className="absolute top-3 left-3 bg-black/70 text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1 backdrop-blur-sm">
              <Calendar size={12} />
              {new Date(currentMatch.file.lastModified).toLocaleDateString()}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          {currentIndex < matchedFiles.length - 1 ? (
            <button
              onClick={() => setCurrentIndex(c => c + 1)}
              className="flex-1 py-3 px-4 rounded-xl border-2 border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark font-semibold hover:bg-surface-light dark:hover:bg-surface-dark transition-colors"
            >
              No, buscar otro
            </button>
          ) : (
            <button
              onClick={() => { setStep('config'); window.alert('Se revisó el clúster pero no hay más copias instantáneas listas. Selecciona tu galería de nuevo.'); }}
              className="flex-1 py-3 px-4 rounded-xl border-2 border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark font-semibold hover:bg-surface-light dark:hover:bg-surface-dark transition-colors"
            >
              Cerrar
            </button>
          )}

          <button
            onClick={handleCreateMemory}
            className="flex-1 py-3 px-4 rounded-xl bg-primary text-white font-semibold flex items-center justify-center gap-2 hover:bg-primary-hover transition-colors shadow-lg shadow-primary/30"
          >
            <Check size={18} /> Crear Memoria
          </button>
        </div>
      </div>
    );
  };

  const renderNoMatches = () => (
    <div className="flex flex-col items-center justify-center py-8 space-y-4">
      <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center">
        <Search size={28} />
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
          No hubo suerte
        </h3>
        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark px-4">
          Buscamos entre las fotos que seleccionaste, pero no pudimos encontrar un rostro claro que coincida con todas las personas a la vez.
        </p>
      </div>
      <button
        onClick={() => setStep('config')}
        className="mt-4 px-6 py-2.5 bg-primary/10 text-primary font-semibold rounded-xl hover:bg-primary/20 transition-colors"
      >
        Intentar con otras fechas
      </button>
    </div>
  );

  return (
    <div className="max-w-xl mx-auto p-6 space-y-8 animate-fade-in pb-24">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/')}
          className="p-2 -ml-2 hover:bg-surface-light dark:hover:bg-surface-dark rounded-xl transition-colors"
        >
          <ArrowLeft className="text-text-secondary-light dark:text-text-secondary-dark" size={24} />
        </button>
        <h2 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
          Generador de Memorias
        </h2>
      </div>

      <div className="bg-surface-light dark:bg-surface-dark rounded-3xl p-6 shadow-sm border border-border-light dark:border-border-dark flex flex-col min-h-[400px]">
        {step === 'config' && renderConfig()}
        {step === 'processing' && renderProcessing()}
        {step === 'found' && renderFound()}
        {step === 'no_matches' && renderNoMatches()}
      </div>
    </div>
  );
}
