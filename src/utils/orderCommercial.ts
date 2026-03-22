export type CommercialTone = 'slate' | 'blue' | 'amber' | 'violet' | 'emerald' | 'rose';

const STAGE_LABELS: Record<string, string> = {
  cart_active: 'Carrito activo',
  awaiting_confirmation: 'Esperando confirmación',
  awaiting_payment: 'Esperando pago',
  confirmed: 'Confirmado',
  fulfillment: 'Preparación',
  in_transit: 'En tránsito',
  completed: 'Completado',
  post_sale: 'Postventa',
};

const STAGE_TONES: Record<string, CommercialTone> = {
  cart_active: 'slate',
  awaiting_confirmation: 'amber',
  awaiting_payment: 'violet',
  confirmed: 'blue',
  fulfillment: 'blue',
  in_transit: 'violet',
  completed: 'emerald',
  post_sale: 'rose',
};

export const getCommercialStageLabel = (stage?: string | null): string | null => {
  if (!stage) return null;
  return STAGE_LABELS[stage] || stage.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};

export const getCommercialStageTone = (stage?: string | null): CommercialTone => {
  if (!stage) return 'slate';
  return STAGE_TONES[stage] || 'slate';
};

export const getCommercialToneClassName = (tone: CommercialTone): string => {
  switch (tone) {
    case 'blue':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'amber':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'violet':
      return 'border-violet-200 bg-violet-50 text-violet-700';
    case 'emerald':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'rose':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    default:
      return 'border-slate-200 bg-slate-100 text-slate-700';
  }
};

export const normalizeChannelLabel = (channel?: string | null): string => {
  if (!channel) return 'Web';
  const normalized = channel.trim().toLowerCase();
  if (normalized === 'manual_admin') return 'Manual admin';
  if (normalized === 'phone') return 'Teléfono';
  if (normalized === 'web') return 'Web';
  if (normalized === 'whatsapp') return 'WhatsApp';
  return normalized.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};
