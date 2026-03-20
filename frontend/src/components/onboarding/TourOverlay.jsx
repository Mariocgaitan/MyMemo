import { useEffect, useMemo, useState } from 'react';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default function TourOverlay({
  open,
  steps,
  onComplete,
  onSkip,
  storageKey,
  allowSkip = true,
}) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);

  const step = steps[index] || null;

  useEffect(() => {
    if (!open) return;
    setIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open || !step?.targetSelector) {
      setRect(null);
      return;
    }

    const updateRect = () => {
      const el = document.querySelector(step.targetSelector);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
      });
    };

    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);

    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [open, step]);

  const cardStyle = useMemo(() => {
    if (!rect) {
      return {
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const cardWidth = Math.min(window.innerWidth - 24, 360);
    const spaceBelow = window.innerHeight - (rect.top + rect.height);
    const preferBelow = spaceBelow >= 220;
    const top = preferBelow ? rect.top + rect.height + 12 : rect.top - 196;
    const left = clamp(rect.left + rect.width / 2 - cardWidth / 2, 12, window.innerWidth - cardWidth - 12);

    return {
      width: `${cardWidth}px`,
      left: `${left}px`,
      top: `${clamp(top, 12, window.innerHeight - 200)}px`,
    };
  }, [rect]);

  if (!open || !step) return null;

  const markComplete = () => {
    if (storageKey) localStorage.setItem(storageKey, '1');
    if (onComplete) onComplete();
  };

  const handleNext = () => {
    if (index >= steps.length - 1) {
      markComplete();
      return;
    }
    setIndex((v) => v + 1);
  };

  const handleSkip = () => {
    if (storageKey) localStorage.setItem(storageKey, '1');
    if (onSkip) onSkip();
  };

  return (
    <div className="fixed inset-0 z-[1200]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[1px]" />

      {rect && (
        <div
          className="absolute rounded-2xl border-2 border-primary/90 pointer-events-none"
          style={{
            top: `${rect.top - 6}px`,
            left: `${rect.left - 6}px`,
            width: `${rect.width + 12}px`,
            height: `${rect.height + 12}px`,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
          }}
        />
      )}

      <div
        className="absolute bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-2xl shadow-2xl p-4"
        style={cardStyle}
      >
        <p className="text-xs font-semibold text-primary mb-1">
          Paso {index + 1} de {steps.length}
        </p>
        <h3 className="text-base font-bold text-text-primary-light dark:text-text-primary-dark mb-2">
          {step.title}
        </h3>
        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-4">
          {step.text}
        </p>

        <div className="w-full h-1 bg-border-light dark:bg-border-dark rounded-full mb-4 overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${((index + 1) / steps.length) * 100}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setIndex((v) => Math.max(0, v - 1))}
            disabled={index === 0}
            className="px-3 py-2 rounded-lg text-sm border border-border-light dark:border-border-dark disabled:opacity-40"
          >
            Anterior
          </button>

          <div className="flex items-center gap-2">
            {allowSkip && (
              <button
                type="button"
                onClick={handleSkip}
                className="px-3 py-2 rounded-lg text-sm text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark"
              >
                Saltar
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              className="px-3 py-2 rounded-lg text-sm bg-primary text-white hover:bg-primary-hover"
            >
              {index === steps.length - 1 ? 'Terminar' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
