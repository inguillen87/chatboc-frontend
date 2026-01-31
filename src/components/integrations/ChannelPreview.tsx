import React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { MessageSquare, Globe, ShoppingBag, Send } from 'lucide-react';

interface ChannelPreviewProps {
  channel: 'whatsapp' | 'telegram' | 'mercadolibre' | 'tiendanube' | 'web';
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
      bubbleIn: "bg-white text-black rounded-tr-lg rounded-bl-lg rounded-br-lg",
      bubbleOut: "bg-[#dcf8c6] text-black rounded-tl-lg rounded-bl-lg rounded-br-lg",
      icon: <MessageSquare className="w-4 h-4 text-white" />,
      headerColor: "bg-[#075e54]",
      textColor: "text-white"
    },
    telegram: {
      bg: "bg-[#8da3c1]", // Telegram default background pattern usually
      bubbleIn: "bg-white text-black rounded-tr-xl rounded-bl-xl rounded-br-xl",
      bubbleOut: "bg-[#effdd6] text-black rounded-tl-xl rounded-bl-xl rounded-br-xl",
      icon: <Send className="w-4 h-4 text-white" />,
      headerColor: "bg-[#517da2]",
      textColor: "text-white"
    },
    mercadolibre: {
        bg: "bg-[#f5f5f5]",
        bubbleIn: "bg-white border text-black rounded-md shadow-sm",
        icon: <ShoppingBag className="w-4 h-4 text-black" />,
        headerColor: "bg-[#ffe600]",
        textColor: "text-black"
    },
    tiendanube: {
        bg: "bg-white border",
        bubbleIn: "bg-gray-100 text-black rounded-md",
        icon: <ShoppingBag className="w-4 h-4 text-white" />,
        headerColor: "bg-[#2d3275]",
        textColor: "text-white"
    },
    web: {
        bg: "bg-white",
        bubbleIn: "bg-gray-100 text-black rounded-xl rounded-tl-none",
        bubbleOut: "bg-blue-600 text-white rounded-xl rounded-tr-none",
        icon: <Globe className="w-4 h-4 text-white" />,
        headerColor: "bg-blue-600",
        textColor: "text-white"
    }
  };

  const theme = defaults[channel] || defaults.web;

  return (
    <Card className={cn("w-64 h-48 overflow-hidden flex flex-col shadow-md border-0 ring-1 ring-black/5 font-sans text-sm", theme.bg)}>
      {/* Header */}
      <div className={cn("px-3 py-2 flex items-center gap-2 shadow-sm shrink-0", theme.headerColor)}>
        <div className="w-6 h-6 rounded-full bg-black/10 flex items-center justify-center">
            {theme.icon}
        </div>
        <span className={cn("font-medium text-xs", theme.textColor)}>
            {channel === 'mercadolibre' ? 'Pregunta sobre...' : channel === 'tiendanube' ? 'Confirmación de Pedido' : 'Chatboc Asistente'}
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 p-3 space-y-3 overflow-hidden relative">
         {/* Background Patterns */}
         {channel === 'whatsapp' && <div className="absolute inset-0 opacity-5 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat" />}

         <div className="relative z-10 space-y-3">
             {/* Incoming Message (Bot/System) */}
             <div className="flex justify-start">
                 <div className={cn("px-3 py-2 max-w-[85%] text-xs shadow-sm relative", theme.bubbleIn)}>
                     {message || "¡Hola! Gracias por tu compra. Tu pedido #1234 está siendo preparado."}
                     <span className="text-[9px] opacity-60 block text-right mt-1">10:42 AM</span>
                 </div>
             </div>

             {/* Outgoing Message (User) - Only for Chat channels */}
             {(channel === 'whatsapp' || channel === 'telegram' || channel === 'web') && (
                 <div className="flex justify-end">
                     <div className={cn("px-3 py-2 max-w-[85%] text-xs shadow-sm relative", theme.bubbleOut)}>
                         Genial, ¿cuándo llega?
                         <span className="text-[9px] opacity-60 block text-right mt-1">10:43 AM</span>
                     </div>
                 </div>
             )}

             {/* Product Card Preview (ML/TN) */}
             {(channel === 'mercadolibre' || channel === 'tiendanube') && product && (
                 <div className="bg-white p-2 rounded border flex gap-2 items-center shadow-sm">
                     <div className="w-10 h-10 bg-gray-200 rounded shrink-0 flex items-center justify-center text-[8px] text-gray-500">IMG</div>
                     <div className="flex-1 min-w-0">
                         <p className="font-medium truncate text-xs">{product.name}</p>
                         <p className="text-xs text-muted-foreground">{product.price}</p>
                     </div>
                 </div>
             )}
         </div>
      </div>
    </Card>
  );
};

export default ChannelPreview;
