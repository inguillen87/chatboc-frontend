import React from 'react';
import { CreditCard, Lock, ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { MarketCheckoutOptions, MarketCheckoutPreview } from '@/types/market';

interface SecureCheckoutNoticeProps {
  checkoutOptions?: MarketCheckoutOptions | null;
  checkoutPreview?: MarketCheckoutPreview | null;
  blockedReason?: string | null;
  compact?: boolean;
}

const resolveCheckoutExperience = (
  checkoutOptions?: MarketCheckoutOptions | null,
  checkoutPreview?: MarketCheckoutPreview | null,
) =>
  checkoutOptions?.checkout_experience ??
  checkoutPreview?.checkout_experience ??
  checkoutPreview?.checkout_options?.checkout_experience ??
  null;

export default function SecureCheckoutNotice({
  checkoutOptions,
  checkoutPreview,
  blockedReason,
  compact = false,
}: SecureCheckoutNoticeProps) {
  const experience = resolveCheckoutExperience(checkoutOptions, checkoutPreview);
  const reasonCode = checkoutOptions?.reason_code ?? experience?.reason_code ?? null;
  const gatewayLabel =
    experience?.gateway?.provider_label ??
    checkoutOptions?.gateway_hint ??
    checkoutOptions?.gateway ??
    'Proveedor de pago';
  const isReady =
    experience?.ready ??
    checkoutOptions?.ready ??
    checkoutOptions?.payment_ready ??
    checkoutPreview?.payment_ready ??
    false;

  const message =
    blockedReason ??
    (reasonCode === 'plan_full_required'
      ? experience?.copy?.customer_locked
      : reasonCode === 'payment_gateway_not_configured'
        ? experience?.copy?.customer_pending_gateway
        : null) ??
    (isReady
      ? experience?.copy?.customer_ready ??
        'El pago se abre en checkout seguro y se confirma por webhook del proveedor.'
      : 'Checkout seguro disponible cuando el plan y el proveedor de pago esten configurados.');

  const toneClass = blockedReason
    ? 'border-amber-200 bg-amber-50 text-amber-900'
    : isReady
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : 'border-border bg-muted/30 text-foreground';

  return (
    <div className={`rounded-2xl border px-3 py-3 ${toneClass}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background/70 text-primary">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold leading-tight">Pago seguro externo</p>
            <Badge variant="outline" className="border-current/20 bg-background/70 text-[11px]">
              {gatewayLabel}
            </Badge>
          </div>
          <p className={compact ? 'text-xs leading-relaxed' : 'text-sm leading-relaxed'}>{message}</p>
          <div className="flex flex-wrap gap-2 text-[11px] font-medium">
            <span className="inline-flex items-center gap-1 rounded-full bg-background/70 px-2 py-1">
              <Lock className="h-3 w-3" />
              Sin tarjetas en chat
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-background/70 px-2 py-1">
              <CreditCard className="h-3 w-3" />
              Checkout seguro
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-background/70 px-2 py-1">
              <ShieldCheck className="h-3 w-3" />
              Estado por webhook
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
