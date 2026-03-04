import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, MapPin, Trash2, Loader2, Brain, CheckCircle, Edit2, User } from 'lucide-react';
import { Button, Chip } from '../components/ui';
import { memoryAPI } from '../services/api';

// ─── Delete Confirmation Modal ───────────────────────────────────────────────
function DeleteConfirmModal({ isOpen, onConfirm, onCancel, isDeleting }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Dialog */}
      <div className="relative z-10 bg-surface-light dark:bg-surface-dark rounded-2xl shadow-xl p-6 w-full max-w-sm border border-border-light dark:border-border-dark animate-slide-up">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <Trash2 size={24} className="text-red-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
              ¿Eliminar recuerdo?
            </h2>
            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">
              Esta acción es permanente. El recuerdo, la foto y los datos de IA serán eliminados.
            </p>
          </div>
          <div className="flex gap-3 w-full">
            <button
              onClick={onCancel}
              disabled={isDeleting}
              className="flex-1 py-3 rounded-xl border-2 border-border-light dark:border-border-dark font-semibold text-text-primary-light dark:text-text-primary-dark hover:border-primary transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isDeleting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Eliminando...
                </>
              ) : (
                'Eliminar'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AI Processing Banner ─────────────────────────────────────────────────────
function AIProcessingBanner({ jobs }) {
  const pending = jobs.filter(j => j.status === 'pending' || j.status === 'processing');
  const completed = jobs.filter(j => j.status === 'completed');
  const failed = jobs.filter(j => j.status === 'failed');

  if (pending.length === 0 && completed.length === 0) return null;

  const allDone = pending.length === 0;

  if (allDone && completed.length > 0) {
    // Briefly show "completed" — parent will reload memory data
    return (
      <div className="flex items-center gap-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
        <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-green-800 dark:text-green-300">
            ¡IA completada!
          </p>
          <p className="text-xs text-green-700 dark:text-green-400">
            Tags, sentimiento y resumen listos.
          </p>
        </div>
      </div>
    );
  }

  const jobLabels = {
    face_recognition: 'Reconocimiento facial',
    nlp_extraction: 'Análisis de texto (IA)',
  };

  return (
    <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl p-4">
      <Brain size={20} className="text-primary flex-shrink-0 animate-pulse" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
          Procesando con IA...
        </p>
        <div className="flex flex-wrap gap-2 mt-1">
          {pending.map(j => (
            <span key={j.id} className="flex items-center gap-1 text-xs text-text-secondary-light dark:text-text-secondary-dark">
              <Loader2 size={10} className="animate-spin" />
              {jobLabels[j.job_type] || j.job_type}
            </span>
          ))}
          {failed.map(j => (
            <span key={j.id} className="text-xs text-red-500">
              Error: {jobLabels[j.job_type] || j.job_type}
            </span>
          ))}
        </div>
      </div>
      <div className="w-2 h-2 rounded-full bg-primary animate-pulse flex-shrink-0" />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MemoryDetail() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [memory, setMemory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // AI processing polling
  const [jobs, setJobs] = useState([]);
  const [pollingActive, setPollingActive] = useState(false);
  const pollingRef = useRef(null);

  // Fetch memory data
  const fetchMemory = useCallback(async () => {
    try {
      const data = await memoryAPI.getById(id);
      setMemory(data);
    } catch (err) {
      setError('No se pudo cargar el recuerdo');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Fetch jobs and start/stop polling
  const fetchJobs = useCallback(async () => {
    try {
      const data = await memoryAPI.getJobs(id);
      const jobList = data.jobs || data || [];
      setJobs(jobList);

      const hasPending = jobList.some(j => j.status === 'pending' || j.status === 'processing');

      if (!hasPending) {
        // All done — stop polling and refresh memory to get AI data
        setPollingActive(false);
        clearInterval(pollingRef.current);
        // Reload memory data so tags/sentiment/summary appear
        fetchMemory();
      }
    } catch (err) {
      console.error('Error fetching jobs:', err);
    }
  }, [id, fetchMemory]);

  useEffect(() => {
    fetchMemory();
  }, [fetchMemory]);

  // Start polling after memory loads
  useEffect(() => {
    if (!memory) return;

    // Check jobs immediately
    fetchJobs();
  }, [memory?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Manage polling interval based on pollingActive
  useEffect(() => {
    if (pollingActive) {
      pollingRef.current = setInterval(fetchJobs, 5000);
    }
    return () => clearInterval(pollingRef.current);
  }, [pollingActive, fetchJobs]);

  // When jobs update: if any pending, ensure polling is on
  useEffect(() => {
    const hasPending = jobs.some(j => j.status === 'pending' || j.status === 'processing');
    if (hasPending && !pollingActive) {
      setPollingActive(true);
    }
  }, [jobs, pollingActive]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await memoryAPI.delete(id);
      setShowDeleteModal(false);
      navigate('/');
    } catch {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">Cargando recuerdo...</p>
        </div>
      </div>
    );
  }

  if (error || !memory) {
    return (
      <div className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center gap-4">
        <p className="text-text-secondary-light dark:text-text-secondary-dark">{error}</p>
        <Button onClick={() => navigate('/')}>Volver</Button>
      </div>
    );
  }

  // Helper to safely parse metadata string
  const getSafeMeta = () => {
    const raw = memory.ai_metadata;
    if (!raw) return {};
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch { return {}; }
    }
    return raw;
  };

  const meta = getSafeMeta();
  const nlp = meta.nlp || {};
  const faces = Array.isArray(meta.faces) ? meta.faces : [];

  const rawTags = Array.isArray(nlp.tags) ? nlp.tags : [];
  const rawThemes = Array.isArray(nlp.themes) ? nlp.themes : [];
  const rawCats = Array.isArray(meta.user_categories) ? meta.user_categories : [];

  // Combine all and strictly filter out objects that would crash React
  const allTags = [...new Set([...rawCats, ...rawThemes, ...rawTags])]
    .filter(t => typeof t === 'string' || typeof t === 'number');

  const sentiment = nlp.sentiment || null;
  const activity = nlp.activity || null;
  const summary = nlp.summary || null;

  const date = memory.created_at
    ? new Date(memory.created_at).toLocaleDateString('es-MX', {
      day: 'numeric', month: 'long', year: 'numeric'
    })
    : null;
  const time = memory.created_at
    ? new Date(memory.created_at).toLocaleTimeString('es-MX', {
      hour: '2-digit', minute: '2-digit'
    })
    : null;

  return (
    <>
      <div className="min-h-[calc(100vh-80px)] bg-background-light dark:bg-background-dark pb-8">
        {/* Header */}
        <div className="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-text-primary-light dark:text-text-primary-dark hover:text-primary transition-colors"
            >
              <ChevronLeft size={20} />
              <span className="font-medium">Volver</span>
            </button>
            <h1 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">
              Recuerdo
            </h1>
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigate(`/memory/${id}/edit`)}
                className="p-2 hover:bg-primary/10 rounded-lg transition-colors text-primary"
                aria-label="Editar recuerdo"
              >
                <Edit2 size={20} />
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                disabled={deleting}
                className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors text-red-500 disabled:opacity-40"
                aria-label="Eliminar recuerdo"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 mt-6 space-y-6">
          {/* AI Processing Banner — shown when jobs are pending */}
          {jobs.length > 0 && <AIProcessingBanner jobs={jobs} />}

          {/* Hero Image */}
          {memory.image_url && (
            <div className="aspect-[3/2] rounded-2xl overflow-hidden shadow-card">
              <img
                src={memory.image_url}
                alt="Recuerdo"
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Metadata */}
          <div className="space-y-2">
            {(date || time) && (
              <div className="flex items-center gap-2 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                {date && <span>{date}</span>}
                {date && time && <span>·</span>}
                {time && <span>{time}</span>}
              </div>
            )}
            {memory.location_name && (
              <div className="flex items-center gap-2 text-sm text-text-primary-light dark:text-text-primary-dark">
                <MapPin size={16} className="text-primary" />
                <span className="font-medium">{memory.location_name}</span>
              </div>
            )}
          </div>

          {/* Description */}
          {memory.description_raw && (
            <div className="bg-surface-light dark:bg-surface-dark rounded-2xl p-6 space-y-3">
              <p className="text-text-primary-light dark:text-text-primary-dark leading-relaxed">
                {memory.description_raw}
              </p>
              {summary && (
                <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark italic border-t border-border-light dark:border-border-dark pt-3">
                  {summary}
                </p>
              )}
            </div>
          )}

          {/* Tags */}
          {allTags.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
                Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {allTags.map((tag, i) => (
                  <Chip key={i} selected>{tag}</Chip>
                ))}
              </div>
            </div>
          )}

          {/* People */}
          {faces.filter(f => f?.person_name && f?.person_name !== 'Unknown Person').length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
                Personas
              </h3>
              <div className="flex gap-4 flex-wrap">
                {faces
                  .filter(f => f?.person_name && f?.person_name !== 'Unknown Person')
                  .map((face, i) => (
                    <div key={i} className="flex flex-col items-center gap-2">
                      <div className="w-16 h-16 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center">
                        {face?.thumbnail_url
                          ? <img
                              src={face.thumbnail_url}
                              alt={face.person_name}
                              className="w-full h-full object-cover"
                              onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
                            />
                          : null}
                        <User size={20} className="text-primary" style={{ display: face?.thumbnail_url ? 'none' : 'block' }} />
                      </div>
                      <span className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                        {face?.person_name}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* AI Insights */}
          {(sentiment || activity) && (
            <div className="grid grid-cols-2 gap-4">
              {sentiment && (
                <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-4">
                  <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                    Sentimiento
                  </p>
                  <p className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mt-1">
                    {sentiment === 'positive' ? 'Positivo' : sentiment === 'negative' ? 'Negativo' : 'Neutral'}
                  </p>
                </div>
              )}
              {activity && (
                <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-4">
                  <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                    Actividad
                  </p>
                  <p className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mt-1">
                    {activity}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
        isDeleting={deleting}
      />
    </>
  );
}
