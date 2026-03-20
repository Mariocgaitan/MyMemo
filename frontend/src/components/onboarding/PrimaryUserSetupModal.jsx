import { useEffect, useRef, useState } from 'react';
import { UserRoundCheck, Camera, Upload, Loader2, AlertCircle } from 'lucide-react';
import { authAPI, peopleAPI } from '../../services/api';

export default function PrimaryUserSetupModal({ isOpen, initialName, onCompleted }) {
  const [name, setName] = useState(initialName || '');
  const [previewSrc, setPreviewSrc] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setName(initialName || '');
    setPreviewSrc(null);
    setImageBase64(null);
    setSaving(false);
    setErrorMsg('');
  }, [isOpen, initialName]);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPreviewSrc(ev.target.result);
      setImageBase64(ev.target.result);
      setErrorMsg('');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setErrorMsg('Escribe tu nombre para continuar.');
      return;
    }
    if (!imageBase64) {
      setErrorMsg('Sube una foto frontal para continuar.');
      return;
    }

    setSaving(true);
    setErrorMsg('');

    try {
      const created = await peopleAPI.trainFromPhoto(name.trim(), imageBase64);
      const person = created?.data;
      if (!person?.id) {
        throw new Error('No se pudo crear la persona principal');
      }

      await authAPI.setSelfPerson(person.id);
      if (onCompleted) onCompleted();
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || 'No se pudo completar la configuración.';
      setErrorMsg(String(detail));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />

      <div className="relative z-10 bg-surface-light dark:bg-surface-dark rounded-2xl shadow-xl p-6 w-full max-w-md border border-border-light dark:border-border-dark">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <UserRoundCheck size={24} className="text-primary" />
        </div>

        <h2 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark text-center">
          Configura tu perfil principal
        </h2>
        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark text-center mt-2 mb-5">
          Para mejorar asociaciones con amistades y reconocimiento facial, necesitamos tu nombre y una foto frontal.
        </p>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex flex-col items-center justify-center gap-2 py-5 rounded-xl border-2 border-dashed border-border-light dark:border-border-dark hover:border-primary transition-colors mb-4"
        >
          {previewSrc ? (
            <img src={previewSrc} alt="preview" className="h-28 w-28 rounded-full object-cover border-4 border-primary/30" />
          ) : (
            <>
              <Camera size={28} className="text-text-secondary-light dark:text-text-secondary-dark" />
              <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">Subir foto frontal</span>
            </>
          )}
          {previewSrc && (
            <span className="text-xs text-primary flex items-center gap-1">
              <Upload size={12} /> Cambiar foto
            </span>
          )}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />

        <input
          type="text"
          placeholder="Tu nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={saving}
          className="w-full px-4 py-3 rounded-xl border-2 border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-text-primary-light dark:text-text-primary-dark focus:border-primary focus:outline-none transition-colors"
        />

        {errorMsg && (
          <div className="mt-3 flex items-start gap-2 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">
            <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="w-full mt-5 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {saving && <Loader2 size={16} className="animate-spin" />}
          {saving ? 'Configurando...' : 'Guardar y continuar'}
        </button>
      </div>
    </div>
  );
}
