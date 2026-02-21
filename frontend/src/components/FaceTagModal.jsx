import { useState, useEffect } from 'react';
import { Modal, Input, Button } from './ui';
import { User, Loader } from 'lucide-react';
import { memoryAPI, peopleAPI } from '../services/api';

export default function FaceTagModal({ 
  isOpen, 
  onClose, 
  memoryId,
  onComplete,
  prefilledNames = [] // Names from manual tagging
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
      
      // Poll job status until face_recognition completes
      const maxAttempts = 30; // 30 seconds max
      let attempts = 0;
      let jobCompleted = false;
      
      while (attempts < maxAttempts && !jobCompleted) {
        try {
          const jobs = await memoryAPI.getJobs(memoryId);
          const faceJob = jobs.find(job => job.job_type === 'face_recognition');
          
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
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
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
      
      // Fetch detected faces from backend
      const detectedFaces = await peopleAPI.getAll({ memory_id: memoryId });
      
      setFaces(detectedFaces);
      
      // Pre-fill names: use prefilled manual names first, then existing person name if not "Unknown"
      const initialNames = {};
      detectedFaces.forEach((face, index) => {
        if (prefilledNames[index]) {
          // Use manually entered name
          initialNames[face.id] = prefilledNames[index];
        } else if (face.name && !face.name.startsWith('Unknown Person')) {
          // Use existing recognized name
          initialNames[face.id] = face.name;
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
      
      // Update names for each person
      for (const [personId, name] of Object.entries(faceNames)) {
        if (name && name.trim()) {
          await peopleAPI.rename(personId, name.trim());
        }
      }
      
      console.log('Saved face names:', faceNames);
      
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleSkip}
      title="¿Quién está en la foto?"
      size="lg"
    >
      <div className="space-y-6">
        <p className="text-text-secondary-light dark:text-text-secondary-dark">
          La IA está procesando las caras en tu foto. Nombra a cada persona para que pueda reconocerlas en el futuro.
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
            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-2">
              {prefilledNames.length > 0 && `Personas mencionadas: ${prefilledNames.join(', ')}`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {faces.map((face, index) => (
              <div key={face.id} className="space-y-3">
                {/* Face thumbnail or placeholder */}
                <div className="aspect-square rounded-xl overflow-hidden bg-surface-light dark:bg-surface-dark border-2 border-border-light dark:border-border-dark flex items-center justify-center">
                  {face.thumbnail_url ? (
                    <img 
                      src={face.thumbnail_url} 
                      alt={`Face ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User size={48} className="text-text-secondary-light dark:text-text-secondary-dark" />
                  )}
                </div>
                
                {/* Name input */}
                <Input
                  placeholder="Nombre..."
                  value={faceNames[face.id] || ''}
                  onChange={(e) => setFaceNames(prev => ({
                    ...prev,
                    [face.id]: e.target.value
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
          <Button
            variant="secondary"
            onClick={handleSkip}
            disabled={saving}
          >
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
