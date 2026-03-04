import { useState, useEffect } from 'react';
import { Modal, Input, Button } from './ui';
import { User, Loader } from 'lucide-react';
import { memoryAPI, peopleAPI } from '../services/api';

/**
 * FaceCrop — shows a face using the best available source:
 *  1. CSS crop from the full memory image using bbox coordinates (most accurate)
 *  2. Pre-cropped S3 thumbnail (fallback for legacy memories without bbox)
 *  3. User silhouette icon (last resort)
 */
function FaceCrop({ imageUrl, bbox, imageW, imageH, thumbnailUrl, size = 120 }) {
  const containerClass =
    'rounded-xl overflow-hidden bg-surface-light dark:bg-surface-dark border-2 border-border-light dark:border-border-dark flex-shrink-0 relative';

  // Priority 1 — CSS crop from original image using bbox
  const hasCrop = bbox && bbox.top != null && imageW && imageH && imageUrl;
  if (hasCrop) {
    const { top, right, bottom, left } = bbox;
    const faceW = Math.max(right - left, 1);
    const faceH = Math.max(bottom - top, 1);
    const scale = size / Math.max(faceW, faceH);
    const scaledW = imageW * scale;
    const scaledH = imageH * scale;
    const offsetX = -left * scale;
    const offsetY = -top * scale;

    return (
      <div style={{ width: size, height: size }} className={containerClass}>
        <img
          src={imageUrl}
          alt="cara"
          style={{
            position: 'absolute',
            width: scaledW,
            height: scaledH,
            left: offsetX,
            top: offsetY,
          }}
        />
      </div>
    );
  }

  // Priority 2 — S3 face thumbnail
  if (thumbnailUrl) {
    return (
      <div style={{ width: size, height: size }} className={containerClass}>
        <img src={thumbnailUrl} alt="cara" className="w-full h-full object-cover" />
      </div>
    );
  }

  // Priority 3 — silhouette placeholder
  return (
    <div
      style={{ width: size, height: size }}
      className={`${containerClass} flex items-center justify-center`}
    >
      <User size={size * 0.45} className="text-text-secondary-light dark:text-text-secondary-dark" />
    </div>
  );
}

export default function FaceTagModal({
  isOpen,
  onClose,
  memoryId,
  onComplete,
  prefilledNames = [],
  memoryImageUrl = null,   // <-- pass the image_url of the memory for crop
}) {
  const [faces, setFaces] = useState([]);
  const [faceNames, setFaceNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [processingStatus, setProcessingStatus] = useState('waiting');

  useEffect(() => {
    if (isOpen && memoryId) {
      fetchFaces();
    }
  }, [isOpen, memoryId]);

  const fetchFaces = async () => {
    try {
      setLoading(true);
      setProcessingStatus('waiting');

      // Poll job status until face_recognition completes (max 30s)
      const maxAttempts = 30;
      let attempts = 0;
      let jobCompleted = false;

      while (attempts < maxAttempts && !jobCompleted) {
        try {
          const jobs = await memoryAPI.getJobs(memoryId);
          const faceJob = (jobs.jobs || jobs || []).find(j => j.job_type === 'face_recognition');

          if (faceJob) {
            if (faceJob.status === 'completed') {
              jobCompleted = true;
              setProcessingStatus('completed');
            } else if (faceJob.status === 'failed') {
              setProcessingStatus('failed');
              setError('El procesamiento de caras falló');
              setLoading(false);
              return;
            } else {
              setProcessingStatus('processing');
            }
          }

          if (!jobCompleted) {
            await new Promise(r => setTimeout(r, 1000));
            attempts++;
          }
        } catch (err) {
          console.error('Error polling job status:', err);
          break;
        }
      }

      if (!jobCompleted) {
        setProcessingStatus('timeout');
        setError('El procesamiento está tomando más tiempo del esperado');
      }

      // Fetch the memory to get ai_metadata.faces (which includes bbox now)
      let detectedFaces = [];
      try {
        const memData = await memoryAPI.getById(memoryId);
        detectedFaces = memData?.ai_metadata?.faces || [];
      } catch {
        // Fallback: fetch people list
        const people = await peopleAPI.getAll({ memory_id: memoryId });
        detectedFaces = (people || []).map(p => ({ person_id: p.id, name: p.name }));
      }

      setFaces(detectedFaces);

      // Pre-fill names from manual entry, then from recognized names
      const initialNames = {};
      detectedFaces.forEach((face, index) => {
        if (prefilledNames[index]) {
          initialNames[face.person_id] = prefilledNames[index];
        } else if (face.name && !face.name.startsWith('Unknown Person')) {
          initialNames[face.person_id] = face.name;
        }
      });
      setFaceNames(initialNames);

    } catch (err) {
      console.error('Error fetching faces:', err);
      setError('No se pudieron cargar las caras detectadas');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      for (const [personId, name] of Object.entries(faceNames)) {
        if (name && name.trim()) {
          await peopleAPI.rename(personId, name.trim());
        }
      }
      onComplete?.(faceNames);
      onClose();
    } catch (err) {
      console.error('Error saving face names:', err);
      setError('Error al guardar los nombres');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    onComplete?.({});
    onClose();
  };

  const hasBbox = faces.some(f => f.bbox && f.image_w);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleSkip}
      title="¿Quién está en la foto?"
      size="lg"
    >
      <div className="space-y-6">
        <p className="text-text-secondary-light dark:text-text-secondary-dark">
          {hasBbox
            ? 'Puedes ver cada cara detectada. Ponle nombre para reconocerla en el futuro.'
            : 'La IA está procesando las caras en tu foto. Nombra a cada persona para reconocerlas en el futuro.'}
        </p>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader className="animate-spin text-primary mb-4" size={48} />
            <p className="text-text-secondary-light dark:text-text-secondary-dark">
              {processingStatus === 'waiting' ? 'Esperando procesamiento...' :
                processingStatus === 'processing' ? 'Detectando caras en la foto...' :
                  'Cargando resultados...'}
            </p>
          </div>
        ) : faces.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 bg-surface-light dark:bg-surface-dark rounded-xl">
            <User size={48} className="text-text-secondary-light dark:text-text-secondary-dark mb-4" />
            <p className="text-text-primary-light dark:text-text-primary-dark font-medium">
              No se detectaron caras en esta foto
            </p>
            {prefilledNames.length > 0 && (
              <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-2">
                Personas mencionadas: {prefilledNames.join(', ')}
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {faces.map((face, index) => (
              <div key={face.person_id || index} className="space-y-3">
                {/* Face crop (if bbox available) or person thumbnail */}
                <div className="flex justify-center">
                  <FaceCrop
                    imageUrl={memoryImageUrl}
                    bbox={face.bbox}
                    imageW={face.image_w}
                    imageH={face.image_h}
                    thumbnailUrl={face.thumbnail_url}
                    size={120}
                  />
                </div>

                {/* Name input */}
                <Input
                  placeholder="Nombre..."
                  value={faceNames[face.person_id] || ''}
                  onChange={e => setFaceNames(prev => ({
                    ...prev,
                    [face.person_id]: e.target.value
                  }))}
                />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-xl p-4">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        <div className="flex gap-3 justify-end pt-4 border-t border-border-light dark:border-border-dark">
          <Button variant="secondary" onClick={handleSkip} disabled={saving}>
            {faces.length === 0 ? 'Cerrar' : 'Omitir por ahora'}
          </Button>

          {faces.length > 0 && (
            <Button
              onClick={handleSave}
              disabled={saving || Object.keys(faceNames).length === 0}
              loading={saving}
            >
              {saving ? 'Guardando...' : 'Guardar nombres'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
