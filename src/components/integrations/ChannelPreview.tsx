import React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Globe, Mail, MessageSquare, Send, ShoppingBag } from 'lucide-react';

export type PreviewChannel = 'whatsapp' | 'telegram' | 'mercadolibre' | 'tiendanube' | 'web' | 'email';

interface ChannelPreviewProps {
  channel: PreviewChannel;
  message?: string;
}

const channels = {
  whatsapp: { label: 'WhatsApp', color: 'bg-[#008069] text-white', icon: MessageSquare },
  telegram: { label: 'Telegram', color: 'bg-[#346b96] text-white', icon: Send },
  mercadolibre: { label: 'Mercado Libre', color: 'bg-[#ffe600] text-[#333]', icon: ShoppingBag },
  tiendanube: { label: 'Tiendanube', color: 'bg-[#2d3275] text-white', icon: ShoppingBag },
  email: { label: 'Email', color: 'bg-slate-100 text-slate-900', icon: Mail },
  web: { label: 'Web Chat', color: 'bg-blue-700 text-white', icon: Globe },
};

/** A transport illustration contains only the operator's explicit draft. */
const ChannelPreview: React.FC<ChannelPreviewProps> = ({ channel, message }) => {
  const theme = channels[channel] || channels.web;
  const Icon = theme.icon;
  return <Card className="mx-auto flex min-h-[280px] w-full max-w-[360px] min-w-0 flex-col overflow-hidden rounded-2xl text-sm">
    <div className={cn('flex items-center gap-3 px-4 py-3', theme.color)}>
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-semibold">{theme.label}</p>
        <p className="text-xs">Simulación de transporte</p>
      </div>
    </div>
    <div className="flex flex-1 flex-col gap-4 bg-muted/30 p-4">
      {message?.trim() ? <div className="min-w-0 rounded-xl border bg-card p-3 text-card-foreground">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Borrador de prueba</p>
        <p className="whitespace-pre-wrap break-words">{message}</p>
      </div> : <p className="text-sm leading-relaxed text-muted-foreground">
        Todavía no hay un mensaje de prueba en el borrador.
      </p>}
      <p className="mt-auto text-xs leading-relaxed text-muted-foreground">
        Esta simulación no envía mensajes ni confirma conexión, entrega o lectura.
      </p>
    </div>
  </Card>;
};

export default ChannelPreview;
