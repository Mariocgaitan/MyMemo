import React, { useState, useRef, useEffect } from 'react';
import { X, Search, Wand2, Image as ImageIcon, Calendar, Users, Loader2, ArrowRight, Check, ArrowLeft } from 'lucide-react';
import { memoryAPI, peopleAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';

const GENERATOR_BATCH_SIZE = 30;
const GENERATOR_MAX_TOTAL_TO_CHECK = 300;
const GENERATOR_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes (testing)

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
  const photoTimestampRef = useRef(new Map());

  const clearMatchedPreviews = () => {
    for (const item of matchedFiles) {
      if (item?.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
    }
  };

  useEffect(() => {
    return () => {
      for (const item of matchedFiles) {
        if (item?.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      }
    };
  }, [matchedFiles]);

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

  const parseInputDateStartLocal = (dateStr) => {
    const [y, m, d] = String(dateStr || '').split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
  };

  const parseInputDateEndLocal = (dateStr) => {
    const [y, m, d] = String(dateStr || '').split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
  };

  const parseExifDateTime = (s) => {
    // EXIF format: "YYYY:MM:DD HH:MM:SS"
    const m = String(s || '').match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
    if (!m) return null;
    const [, y, mo, d, h, mi, se] = m.map(Number);
    return new Date(y, mo - 1, d, h, mi, se, 0).getTime();
  };

  const readExifTimestamp = async (file) => {
    try {
      if (!file || !file.type?.includes('jpeg')) return null;
      // Read only header chunk: EXIF APP1 lives near the beginning of JPEGs.
      const buffer = await file.slice(0, 256 * 1024).arrayBuffer();
      const view = new DataView(buffer);

      // JPEG SOI
      if (view.getUint16(0, false) !== 0xFFD8) return null;

      let offset = 2;
      while (offset + 4 < view.byteLength) {
        if (view.getUint8(offset) !== 0xFF) break;
        const marker = view.getUint8(offset + 1);
        offset += 2;

        if (marker === 0xDA || marker === 0xD9) break; // SOS or EOI

        const length = view.getUint16(offset, false);
        if (length < 2 || offset + length > view.byteLength) break;

        // APP1 Exif
        if (marker === 0xE1) {
          const exifStart = offset + 2;
          const exifHeader = String.fromCharCode(
            view.getUint8(exifStart),
            view.getUint8(exifStart + 1),
            view.getUint8(exifStart + 2),
            view.getUint8(exifStart + 3)
          );

          if (exifHeader === 'Exif') {
            const tiff = exifStart + 6; // skip "Exif\0\0"
            const little = view.getUint16(tiff, false) === 0x4949;
            const get16 = (p) => view.getUint16(p, little);
            const get32 = (p) => view.getUint32(p, little);

            const ifd0 = tiff + get32(tiff + 4);
            const readAsciiAt = (valPtr, count) => {
              const pos = count <= 4 ? valPtr : (tiff + get32(valPtr));
              let out = '';
              for (let i = 0; i < count - 1 && pos + i < view.byteLength; i++) {
                const c = view.getUint8(pos + i);
                if (!c) break;
                out += String.fromCharCode(c);
              }
              return out;
            };

            const readIfdForDate = (ifdPtr) => {
              if (!ifdPtr || ifdPtr >= view.byteLength) return null;
              const entries = get16(ifdPtr);
              for (let i = 0; i < entries; i++) {
                const e = ifdPtr + 2 + i * 12;
                if (e + 12 > view.byteLength) break;
                const tag = get16(e);
                const type = get16(e + 2);
                const count = get32(e + 4);
                const valuePtr = e + 8;
                // DateTimeOriginal / DateTimeDigitized / DateTime
                if ((tag === 0x9003 || tag === 0x9004 || tag === 0x0132) && type === 2 && count >= 19) {
                  const raw = readAsciiAt(valuePtr, count);
                  const ts = parseExifDateTime(raw);
                  if (ts) return ts;
                }
              }
              return null;
            };

            // Try DateTime in IFD0
            const ifd0Date = readIfdForDate(ifd0);
            if (ifd0Date) return ifd0Date;

            // Find ExifIFD pointer (tag 0x8769) then read DateTimeOriginal
            const entries = get16(ifd0);
            for (let i = 0; i < entries; i++) {
              const e = ifd0 + 2 + i * 12;
              if (e + 12 > view.byteLength) break;
              const tag = get16(e);
              if (tag === 0x8769) {
                const exifIfd = tiff + get32(e + 8);
                const exifDate = readIfdForDate(exifIfd);
                if (exifDate) return exifDate;
              }
            }
          }
        }

        offset += length;
      }
    } catch {
      // ignore EXIF parsing errors
    }

    return null;
  };

  const getBestPhotoTimestamp = async (file) => {
    if (photoTimestampRef.current.has(file)) {
      return photoTimestampRef.current.get(file);
    }

    const exifTs = await readExifTimestamp(file);
    const ts = exifTs || file.lastModified || Date.now();
    photoTimestampRef.current.set(file, ts);
    return ts;
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
    if (isProcessing) return;

    const files = Array.from(e.target.files);
    if (!files.length) return;

    if (selectedPeople.length === 0) {
      alert('Por favor selecciona al menos una persona.');
      return;
    }

    setStep('processing');
    setIsProcessing(true);
    setProgressText('Analizando tus fotos localmente...');
    // Give mobile browser a moment to close gallery UI and paint loading state.
    await new Promise(resolve => setTimeout(resolve, 50));
    photoTimestampRef.current = new Map();
    clearMatchedPreviews();
    setMatchedFiles([]);
    setCurrentIndex(0);
    
    try {
      const runStartedAt = Date.now();

      // 1. Filter by Date (prefer EXIF capture date; fallback to file mtime)
      let filtered = files;
      if (startDate && endDate) {
        const startTs = parseInputDateStartLocal(startDate);
        const endTs = parseInputDateEndLocal(endDate);

        if (startTs && endTs) {
          filtered = [];
          for (let idx = 0; idx < files.length; idx++) {
            if (Date.now() - runStartedAt > GENERATOR_TIMEOUT_MS) {
              setProgressText('Tiempo máximo alcanzado durante el filtro de fechas.');
              setStep('no_matches');
              return;
            }
            if (idx % 20 === 0) {
              setProgressText(`Filtrando fecha ${idx + 1}/${files.length}...`);
              await new Promise(resolve => setTimeout(resolve, 0));
            }
            const f = files[idx];
            const ts = await getBestPhotoTimestamp(f);
            if (ts >= startTs && ts <= endTs) {
              filtered.push(f);
            }
          }
        }
      }

      if (filtered.length === 0) {
        setStep('no_matches');
        return;
      }

      setProgressText(`Buscando rostros en ${filtered.length} fotos del periodo...`);

      // Shuffle the cluster so the discovery is random / serendipitous
      const shuffled = [...filtered].sort(() => 0.5 - Math.random());
      
      // Process in chunks tuned for current test capacity.
      const clusterToProcess = shuffled.slice(0, GENERATOR_MAX_TOTAL_TO_CHECK);
      
      let foundMatches = [];

      // Loop through batches
      for (let i = 0; i < clusterToProcess.length; i += GENERATOR_BATCH_SIZE) {
        if (Date.now() - runStartedAt > GENERATOR_TIMEOUT_MS) {
          setProgressText('Tiempo máximo alcanzado durante el análisis.');
          break;
        }

        const batch = clusterToProcess.slice(i, i + GENERATOR_BATCH_SIZE);
        setProgressText(`Escaneando fotos ${i} - ${Math.min(i + GENERATOR_BATCH_SIZE, clusterToProcess.length)} (Encontradas: ${foundMatches.length})...`);
        
        // Convert batch to base64 sequentially to avoid RAM spikes and UI freezing on mobile
        const scaledItems = [];
        for (let idx = 0; idx < batch.length; idx++) {
          const file = batch[idx];
          try {
            // Yield event loop to let React render the progress text and keep spinner moving
            await new Promise(resolve => setTimeout(resolve, 50));
            const b64 = await scaleImageToCanvas(file);
            scaledItems.push({ photo_id: String(i + idx), image_base64: b64, originalFile: file });
          } catch (err) {
            console.error('Error scaling image', err);
          }
        }
        
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
                   previewUrl: URL.createObjectURL(sourceItem.originalFile),
                   captureTs: photoTimestampRef.current.get(sourceItem.originalFile) || sourceItem.originalFile.lastModified,
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
        prefilledDate: currentMatch.captureTs ? new Date(currentMatch.captureTs).toISOString() : null,
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
          Selecciona a quién quieres encontrar y una fecha/periodo. Luego abre tu galería y <b>selecciona todas las fotos que puedas de ese día</b>. (Por privacidad, Google y Apple no nos permiten leer tu galería sin que tú selecciones las fotos a mano). Nosotros buscaremos mágicamente el recuerdo. <b>Tus fotos nunca se guardan.</b>
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
          onClick={() => {
            if (!fileInputRef.current) return;
            // Force change event even if user picks the same files again.
            fileInputRef.current.value = '';
            fileInputRef.current.click();
          }}
          disabled={selectedPeople.length === 0}
          className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ImageIcon size={18} />
          Seleccionar tu Galería Completa
        </button>
        <p className="text-xs text-center text-text-secondary-light mt-3 px-4">
          💡 Tip: Usa el gesto de <b>arrastrar el dedo</b> en tu galería para seleccionar rápidamente cientos de fotos de ese día.
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
          {(currentMatch.captureTs || currentMatch.file.lastModified) && (
            <div className="absolute top-3 left-3 bg-black/70 text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1 backdrop-blur-sm">
              <Calendar size={12} />
              {new Date(currentMatch.captureTs || currentMatch.file.lastModified).toLocaleDateString()}
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
