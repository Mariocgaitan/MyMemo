import React, { useState, useRef } from 'react';
import { X, UserPlus, Upload, Loader2, CheckCircle, AlertCircle, Camera } from 'lucide-react';
import { peopleAPI } from '../services/api';

/**
 * TrainFaceModal — lets the user register a person by uploading a portrait.
 * The backend validates that exactly ONE face is present; the original photo
 * is never stored, only a small face-crop thumbnail.
 *
 * Props:
 *   isOpen   : boolean
 *   onClose  : () => void
 *   onCreated: (personResponse) => void  — called after successful creation
 */
export default function TrainFaceModal({ isOpen, onClose, onCreated }) {
  const [step, setStep] = useState('idle');        // idle | preview | saving | done | error
  const [name, setName] = useState('');
  const [previewSrc, setPreviewSrc] = useState(null);   // local <img> preview
  const [imageBase64, setImageBase64] = useState(null); // to send to backend
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  // ── Helpers ────────────────────────────────────────────────────────────────

  function reset() {
    setStep('idle');
    setName('');
    setPreviewSrc(null);
    setImageBase64(null);
    setErrorMsg('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  // ── File picker ────────────────────────────────────────────────────────────

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result; // e.g. "data:image/jpeg;base64,..."
      setPreviewSrc(dataUrl);
      setImageBase64(dataUrl); // backend validator strips the prefix
      setStep('preview');
    };
    reader.readAsDataURL(file);
    // Reset the input value so the same file can be re-selected if needed
    e.target.value = '';
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!name.trim()) {
      setErrorMsg('Por favor escribe un nombre para esta persona.');
      return;
    }
    if (!imageBase64) {
      setErrorMsg('Por favor selecciona una foto primero.');
      return;
    }

    setStep('saving');
    setErrorMsg('');

    try {
      const person = await peopleAPI.trainFromPhoto(name.trim(), imageBase64);
      setStep('done');
      onCreated(person.data);
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err) {
      const detail =
        err?.response?.data?.detail ||
        'Error al procesar la foto. Intenta con otra imagen.';
      setErrorMsg(detail);
      setStep('preview'); // go back so user can retry
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--bg-secondary, #1e1e2a)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2">
            <UserPlus size={18} className="text-blue-400" />
            <span className="font-semibold text-white text-sm">Añadir persona</span>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4">

          {/* Subtitle */}
          <p className="text-xs text-gray-400 leading-relaxed">
            Sube un retrato claro donde solo salga una persona. La foto no se guardará — solo se usará para registrar su rostro.
          </p>

          {/* Photo picker / preview */}
          {step === 'idle' ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-8 transition-colors hover:border-blue-400 hover:bg-blue-900/10"
              style={{ borderColor: 'rgba(255,255,255,0.15)' }}
            >
              <Camera size={32} className="text-gray-500" />
              <span className="text-sm text-gray-400">Seleccionar foto</span>
            </button>
          ) : (
            <div className="relative flex justify-center">
              <img
                src={previewSrc}
                alt="Vista previa"
                className="h-40 w-40 rounded-full object-cover shadow-lg"
                style={{ border: '3px solid rgba(99,102,241,0.6)' }}
              />
              {step !== 'saving' && step !== 'done' && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-1 right-1 rounded-full p-1.5 shadow transition-opacity hover:opacity-80"
                  style={{ background: 'rgba(0,0,0,0.6)' }}
                  title="Cambiar foto"
                >
                  <Upload size={13} className="text-white" />
                </button>
              )}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Name input — only when photo is loaded */}
          {(step === 'preview' || step === 'saving' || step === 'done') && (
            <input
              type="text"
              placeholder="Nombre de la persona…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              disabled={step === 'saving' || step === 'done'}
              className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none transition-colors"
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
              autoFocus
            />
          )}

          {/* Error message */}
          {errorMsg && (
            <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
              <span className="text-red-300">{errorMsg}</span>
            </div>
          )}

          {/* Success */}
          {step === 'done' && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)' }}>
              <CheckCircle size={14} className="text-green-400" />
              <span className="text-green-300">¡Persona registrada!</span>
            </div>
          )}
        </div>

        {/* Footer — save button */}
        {(step === 'preview' || step === 'saving') && (
          <div className="px-5 pb-5">
            <button
              onClick={handleSave}
              disabled={step === 'saving' || !name.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#6366f1,#4338ca)', color: 'white' }}
            >
              {step === 'saving' ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Analizando cara…
                </>
              ) : (
                <>
                  <UserPlus size={15} />
                  Guardar persona
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
