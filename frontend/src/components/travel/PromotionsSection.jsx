import { Tag } from 'lucide-react';

/**
 * Stage D — Promotions placeholder.
 * Returns a "coming soon" view until the business portal is built (Post-V1).
 * The backend endpoint GET /travel/promotions already exists and returns
 * { items: [], coming_soon: true } so this component will wire up trivially
 * when campaigns go live.
 */
export default function PromotionsSection() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <Tag size={28} className="text-primary" />
      </div>
      <h2 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">
        Promociones y ofertas
      </h2>
      <p className="max-w-xs text-sm text-text-secondary-light dark:text-text-secondary-dark">
        Próximamente podrás ver descuentos y momentos destacados de lugares cerca de ti.
        Los lugares solo pueden aparecer aquí si ya tienen memorias auténticas de la comunidad.
      </p>
      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
        Próximamente
      </span>
    </div>
  );
}
