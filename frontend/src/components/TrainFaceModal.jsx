import React, { useState, useRef } from 'react';
import { X, UserPlus, Camera, Upload, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { peopleAPI } from '../services/api';

/**
 * TrainFaceModal — lets the user register a person by uploading a portrait.
 * The backend validates that exactly ONE face is present; the original photo
 * is never stored, only a small face-crop thumbnail.
 *
 * Props:
 *   isOpen   : boolean
 *   onClose  : () => void
 *   onCreated: (personResponse) => void
 */
export default function TrainFaceModal({ isOpen, onClose, onCreated }) {
    const [step, setStep] = useState('idle');   // idle | preview | saving | done
    const [name, setName] = useState('');
    const [previewSrc, setPreviewSrc] = useState(null);
    const [imageBase64, setImageBase64] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const fileInputRef = useRef(null);

    if (!isOpen) return null;

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

    function handleFileChange(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        setErrorMsg('');
        const reader = new FileReader();
        reader.onload = (ev) => {
            setPreviewSrc(ev.target.result);
            setImageBase64(ev.target.result);
            setStep('preview');
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    }

    async function handleSave() {
        if (!name.trim()) { setErrorMsg('Por favor escribe un nombre.'); return; }
        if (!imageBase64) { setErrorMsg('Por favor selecciona una foto primero.'); return; }
        setStep('saving');
        setErrorMsg('');
        try {
            const res = await peopleAPI.trainFromPhoto(name.trim(), imageBase64);
            setStep('done');
            onCreated(res.data);
            setTimeout(handleClose, 1500);
        } catch (err) {
            const detail = err?.response?.data?.detail || 'Error al procesar la foto. Intenta con otra imagen.';
            setErrorMsg(detail);
            setStep('preview');
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
            <div className="relative z-10 bg-surface-light dark:bg-surface-dark rounded-2xl shadow-xl p-6 w-full max-w-sm border border-border-light dark:border-border-dark">

                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark flex items-center gap-2">
                        <UserPlus size={20} className="text-primary" />
                        Añadir persona
                    </h2>
                    <button onClick={handleClose} className="p-1 rounded-lg hover:bg-primary/10 text-text-secondary-light dark:text-text-secondary-dark transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Subtitle */}
                <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-4 leading-relaxed">
                    Sube un retrato donde solo salga una persona. La foto no se guardará — solo se usará para registrar su rostro.
                </p>

                {/* Photo area */}
                {step === 'idle' ? (
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed border-border-light dark:border-border-dark hover:border-primary transition-colors text-text-secondary-light dark:text-text-secondary-dark hover:text-primary"
                    >
                        <Camera size={32} />
                        <span className="text-sm font-medium">Seleccionar foto</span>
                    </button>
                ) : (
                    <div className="relative flex justify-center mb-1">
                        <img
                            src={previewSrc}
                            alt="Vista previa"
                            className="h-36 w-36 rounded-full object-cover border-4 border-primary/30"
                        />
                        {step !== 'saving' && step !== 'done' && (
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute bottom-0 right-[calc(50%-54px)] bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-full p-1.5 shadow hover:bg-primary/10 transition-colors"
                                title="Cambiar foto"
                            >
                                <Upload size={13} className="text-primary" />
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

                {/* Name input — visible once photo is selected */}
                {(step === 'preview' || step === 'saving' || step === 'done') && (
                    <div className="mt-4">
                        {/* font-size: 16px prevents iOS auto-zoom on input focus */}
                        <input
                            type="text"
                            placeholder="Nombre de la persona…"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                            disabled={step === 'saving' || step === 'done'}
                            style={{ fontSize: '16px' }}
                            className="w-full px-4 py-3 rounded-xl border-2 border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-text-primary-light dark:text-text-primary-dark focus:border-primary focus:outline-none transition-colors"
                            autoFocus
                        />
                    </div>
                )}

                {/* Error */}
                {errorMsg && (
                    <div className="mt-3 flex items-start gap-2 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">
                        <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                        <span>{errorMsg}</span>
                    </div>
                )}

                {/* Success */}
                {step === 'done' && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-xl px-3 py-2">
                        <CheckCircle size={15} />
                        <span>¡Persona registrada!</span>
                    </div>
                )}

                {/* Actions */}
                {(step === 'preview' || step === 'saving') && (
                    <div className="flex gap-3 mt-5">
                        <button
                            onClick={handleClose}
                            className="flex-1 py-3 rounded-xl border-2 border-border-light dark:border-border-dark font-semibold text-text-primary-light dark:text-text-primary-dark hover:border-primary transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={step === 'saving' || !name.trim()}
                            className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {step === 'saving' ? (
                                <><Loader2 size={16} className="animate-spin" /> Analizando…</>
                            ) : (
                                <><UserPlus size={16} /> Guardar</>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
