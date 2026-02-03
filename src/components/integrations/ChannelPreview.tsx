import React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { MessageSquare, Globe, ShoppingBag, Send, Mail } from 'lucide-react';

interface ChannelPreviewProps {
  channel: 'whatsapp' | 'telegram' | 'mercadolibre' | 'tiendanube' | 'web' | 'email';
  message?: string;
  product?: {
    name: string;
    price: string;
    image?: string;
  };
}

const ChannelPreview: React.FC<ChannelPreviewProps> = ({ channel, message, product }) => {
  const defaults = {
    whatsapp: {
      bg: "bg-[#e5ddd5]",
      bubbleIn: "bg-white text-black rounded-tr-lg rounded-bl-lg rounded-br-lg shadow-[0_1px_0.5px_rgba(0,0,0,0.13)]",
      bubbleOut: "bg-[#d9fdd3] text-black rounded-tl-lg rounded-bl-lg rounded-br-lg shadow-[0_1px_0.5px_rgba(0,0,0,0.13)]",
      icon: <MessageSquare className="w-3.5 h-3.5 text-white" />,
      headerColor: "bg-[#008069]",
      textColor: "text-white",
      label: "WhatsApp"
    },
    telegram: {
      bg: "bg-[#8da3c1]", // Telegram default background pattern
      bubbleIn: "bg-white text-black rounded-tr-xl rounded-bl-xl rounded-br-xl shadow-sm",
      bubbleOut: "bg-[#effdd6] text-black rounded-tl-xl rounded-bl-xl rounded-br-xl shadow-sm",
      icon: <Send className="w-3.5 h-3.5 text-white" />,
      headerColor: "bg-[#517da2]",
      textColor: "text-white",
      label: "Telegram"
    },
    mercadolibre: {
        bg: "bg-[#f5f5f5]",
        bubbleIn: "bg-white border text-black rounded-md shadow-sm",
        icon: <ShoppingBag className="w-3.5 h-3.5 text-black" />,
        headerColor: "bg-[#ffe600]",
        textColor: "text-[#333]",
        label: "Mercado Libre"
    },
    tiendanube: {
        bg: "bg-slate-50 border",
        bubbleIn: "bg-white text-slate-800 rounded-lg border shadow-sm",
        icon: <ShoppingBag className="w-3.5 h-3.5 text-white" />,
        headerColor: "bg-[#2d3275]",
        textColor: "text-white",
        label: "Tiendanube"
    },
    email: {
        bg: "bg-white border",
        bubbleIn: "bg-gray-50 text-slate-800 rounded border p-3",
        icon: <Mail className="w-3.5 h-3.5 text-slate-600" />,
        headerColor: "bg-gray-100 border-b",
        textColor: "text-slate-800",
        label: "Email"
    },
    web: {
        bg: "bg-white",
        bubbleIn: "bg-gray-100 text-black rounded-xl rounded-tl-none",
        bubbleOut: "bg-blue-600 text-white rounded-xl rounded-tr-none",
        icon: <Globe className="w-3.5 h-3.5 text-white" />,
        headerColor: "bg-blue-600",
        textColor: "text-white",
        label: "Web Chat"
    }
  };

  const theme = defaults[channel] || defaults.web;

  return (
    <Card className={cn("w-full max-w-[360px] mx-auto overflow-hidden flex flex-col border-0 ring-1 ring-black/5 font-sans text-sm h-[460px] rounded-2xl shadow-xl transition-all hover:shadow-2xl", theme.bg)}>
      {/* Header */}
      <div className={cn("px-4 py-3 flex items-center gap-3 shadow-sm shrink-0 relative z-20", theme.headerColor)}>
        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shadow-inner", channel === 'mercadolibre' ? 'bg-black/5' : 'bg-black/10')}>
            {theme.icon}
        </div>
        <div className="flex flex-col leading-none gap-1">
             <span className={cn("font-bold text-sm", theme.textColor)}>
                {theme.label}
            </span>
            <span className={cn("text-[10px] opacity-90", theme.textColor)}>
                {channel === 'email' ? 'Responder a: cliente@email.com' : 'En línea ahora'}
            </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-4 space-y-4 overflow-hidden relative flex flex-col">
         {/* Background Patterns */}
         {channel === 'whatsapp' && <div className="absolute inset-0 opacity-[0.06] bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat z-0" />}

         <div className="relative z-10 space-y-4 flex-1">
             {/* Incoming Message (Bot/System) */}
             <div className="flex justify-start">
                 <div className={cn("px-3 py-2 max-w-[85%] text-[13px] leading-relaxed relative", theme.bubbleIn)}>
                     {message || (channel === 'email' ? "Consulta sobre disponibilidad de stock..." : "¡Hola! 👋 Gracias por contactarnos. ¿En qué podemos ayudarte hoy?")}
                     <span className="text-[10px] opacity-60 block text-right mt-1 font-medium">10:42 AM</span>
                 </div>
             </div>

             {/* Product Card Preview (ML/TN) */}
             {(channel === 'mercadolibre' || channel === 'tiendanube') && product && (
                 <div className="bg-white p-3 rounded-lg border flex gap-3 items-center shadow-sm max-w-[90%]">
                     <div className="w-12 h-12 bg-gray-100 rounded-md shrink-0 flex items-center justify-center text-[9px] text-gray-400 font-medium tracking-wide">IMG</div>
                     <div className="flex-1 min-w-0">
                         <p className="font-medium truncate text-sm text-gray-900">{product.name}</p>
                         <p className="text-sm font-semibold text-gray-700">{product.price}</p>
                     </div>
                 </div>
             )}

             {/* Outgoing Message (User) */}
             {(channel === 'whatsapp' || channel === 'telegram' || channel === 'web') && (
                 <div className="flex justify-end">
                     <div className={cn("px-3 py-2 max-w-[85%] text-[13px] leading-relaxed relative", theme.bubbleOut)}>
                         Quería saber si tienen stock del modelo en rojo.
                         <span className="text-[10px] opacity-60 block text-right mt-1 font-medium">10:43 AM</span>
                         {channel === 'whatsapp' && <span className="absolute bottom-1 right-1 text-[9px]">✓✓</span>}
                     </div>
                 </div>
             )}

             {(channel === 'whatsapp' || channel === 'telegram') && (
                 <div className="flex justify-start">
                     <div className={cn("px-3 py-2 max-w-[60%] flex items-center gap-1.5", theme.bubbleIn)}>
                         <span className="h-1.5 w-1.5 rounded-full bg-black/40" />
                         <span className="h-1.5 w-1.5 rounded-full bg-black/40" />
                         <span className="h-1.5 w-1.5 rounded-full bg-black/40" />
                     </div>
                 </div>
             )}
         </div>

         {/* Footer / Input placeholder */}
         <div className="mt-auto pt-2 relative z-10">
            <div className="h-10 bg-black/5 rounded-full w-full flex items-center px-4 text-xs text-gray-500">
                Escribe un mensaje...
            </div>
         </div>
      </div>
    </Card>
  );
};

export default ChannelPreview;
