import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ArrowRightLeft, MessageCircle, Phone, ShoppingBag } from 'lucide-react';
import type { MarketCommercialState, MarketCustomerProfile } from '@/types/market';
import {
  getCommercialStageLabel,
  getCommercialStageTone,
  getCommercialToneClassName,
  normalizeChannelLabel,
} from '@/utils/orderCommercial';

interface CommercialStateCardProps {
  customerProfile?: MarketCustomerProfile | null;
  commercialState?: MarketCommercialState | null;
}

const getChannelIcon = (channel?: string | null) => {
  switch ((channel || '').toLowerCase()) {
    case 'whatsapp':
      return MessageCircle;
    case 'phone':
      return Phone;
    default:
      return ShoppingBag;
  }
};

export default function CommercialStateCard({
  customerProfile,
  commercialState,
}: CommercialStateCardProps) {
  const stageLabel = getCommercialStageLabel(commercialState?.stage);
  const channelLabel = normalizeChannelLabel(commercialState?.channel || customerProfile?.channel_group || null);
  const ChannelIcon = getChannelIcon(commercialState?.channel || customerProfile?.channel_group);
  const supportsHandoff = Boolean(commercialState?.supports_handoff);
  const continuationAvailable = Boolean(commercialState?.continuation_available);
  const contactName = customerProfile?.name?.trim() || null;
  const contactPhone = customerProfile?.phone?.trim() || customerProfile?.whatsapp?.trim() || null;

  if (!stageLabel && !channelLabel && !contactName && !contactPhone) return null;

  return (
    <div className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Continuidad comercial
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Estado omnicanal y perfil comercial reutilizable del checkout actual.
          </p>
        </div>
        {stageLabel ? (
          <Badge variant="outline" className={getCommercialToneClassName(getCommercialStageTone(commercialState?.stage))}>
            {stageLabel}
          </Badge>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <ChannelIcon className="h-3.5 w-3.5" />
            Canal actual
          </div>
          <p className="mt-2 text-sm font-semibold text-foreground">{channelLabel}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <ArrowRightLeft className="h-3.5 w-3.5" />
            Handoff
          </div>
          <p className="mt-2 text-sm font-semibold text-foreground">
            {supportsHandoff ? 'Disponible para continuidad entre canales' : 'Sin handoff informado'}
          </p>
          {continuationAvailable ? (
            <p className="mt-1 text-xs text-muted-foreground">Podés retomar esta compra sin perder contexto.</p>
          ) : null}
        </div>
      </div>

      {(contactName || contactPhone) ? (
        <div className="mt-4 rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
          <p className="font-medium text-foreground">{contactName || 'Contacto comercial'}</p>
          {contactPhone ? <p className="mt-1 text-muted-foreground">{contactPhone}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
