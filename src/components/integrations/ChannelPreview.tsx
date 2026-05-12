import React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Globe, Mail, MessageSquare, Send, ShoppingBag } from "lucide-react";

interface ChannelPreviewProps {
  channel: "whatsapp" | "telegram" | "mercadolibre" | "tiendanube" | "web" | "email";
  message?: string;
  menuItems?: Array<{ label: string }>;
  product?: {
    name: string;
    price: string;
    image?: string;
  };
}

const ChannelPreview: React.FC<ChannelPreviewProps> = ({
  channel,
  message,
  menuItems = [],
  product,
}) => {
  const defaults = {
    whatsapp: {
      bg: "bg-[#e5ddd5]",
      bubbleIn: "bg-white text-black rounded-tr-lg rounded-bl-lg rounded-br-lg shadow-[0_1px_0.5px_rgba(0,0,0,0.13)]",
      bubbleOut: "bg-[#d9fdd3] text-black rounded-tl-lg rounded-bl-lg rounded-br-lg shadow-[0_1px_0.5px_rgba(0,0,0,0.13)]",
      icon: <MessageSquare className="h-3.5 w-3.5 text-white" />,
      headerColor: "bg-[#008069]",
      textColor: "text-white",
      label: "WhatsApp",
    },
    telegram: {
      bg: "bg-[#8da3c1]",
      bubbleIn: "bg-white text-black rounded-tr-xl rounded-bl-xl rounded-br-xl shadow-sm",
      bubbleOut: "bg-[#effdd6] text-black rounded-tl-xl rounded-bl-xl rounded-br-xl shadow-sm",
      icon: <Send className="h-3.5 w-3.5 text-white" />,
      headerColor: "bg-[#517da2]",
      textColor: "text-white",
      label: "Telegram",
    },
    mercadolibre: {
      bg: "bg-[#f5f5f5]",
      bubbleIn: "bg-white border text-black rounded-md shadow-sm",
      bubbleOut: "bg-white border text-black rounded-md shadow-sm",
      icon: <ShoppingBag className="h-3.5 w-3.5 text-black" />,
      headerColor: "bg-[#ffe600]",
      textColor: "text-[#333]",
      label: "Mercado Libre",
    },
    tiendanube: {
      bg: "bg-slate-50 border",
      bubbleIn: "bg-white text-slate-800 rounded-lg border shadow-sm",
      bubbleOut: "bg-white text-slate-800 rounded-lg border shadow-sm",
      icon: <ShoppingBag className="h-3.5 w-3.5 text-white" />,
      headerColor: "bg-[#2d3275]",
      textColor: "text-white",
      label: "Tiendanube",
    },
    email: {
      bg: "bg-white border",
      bubbleIn: "bg-gray-50 text-slate-800 rounded border p-3",
      bubbleOut: "bg-gray-50 text-slate-800 rounded border p-3",
      icon: <Mail className="h-3.5 w-3.5 text-slate-600" />,
      headerColor: "bg-gray-100 border-b",
      textColor: "text-slate-800",
      label: "Email",
    },
    web: {
      bg: "bg-white",
      bubbleIn: "bg-gray-100 text-black rounded-xl rounded-tl-none",
      bubbleOut: "bg-blue-600 text-white rounded-xl rounded-tr-none",
      icon: <Globe className="h-3.5 w-3.5 text-white" />,
      headerColor: "bg-blue-600",
      textColor: "text-white",
      label: "Web Chat",
    },
  };

  const theme = defaults[channel] || defaults.web;

  return (
    <Card
      className={cn(
        "mx-auto flex h-[460px] w-full max-w-[360px] flex-col overflow-hidden rounded-2xl border-0 font-sans text-sm shadow-xl ring-1 ring-black/5 transition-all hover:shadow-2xl",
        theme.bg,
      )}
    >
      <div className={cn("relative z-20 flex shrink-0 items-center gap-3 px-4 py-3 shadow-sm", theme.headerColor)}>
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full shadow-inner",
            channel === "mercadolibre" ? "bg-black/5" : "bg-black/10",
          )}
        >
          {theme.icon}
        </div>
        <div className="flex flex-col gap-1 leading-none">
          <span className={cn("text-sm font-bold", theme.textColor)}>{theme.label}</span>
          <span className={cn("text-[10px] opacity-90", theme.textColor)}>
            {channel === "email" ? "Responder a: cliente@email.com" : "En linea ahora"}
          </span>
        </div>
      </div>

      <div className="relative flex flex-1 flex-col space-y-4 overflow-hidden p-4">
        {channel === "whatsapp" && (
          <div className="absolute inset-0 z-0 opacity-[0.06] bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat" />
        )}

        <div className="relative z-10 flex-1 space-y-4">
          <div className="flex justify-start">
            <div className={cn("relative max-w-[85%] px-3 py-2 text-[13px] leading-relaxed", theme.bubbleIn)}>
              {message ||
                (channel === "email"
                  ? "Consulta sobre disponibilidad de stock..."
                  : "Hola, gracias por contactarnos. ¿En que podemos ayudarte hoy?")}
              <span className="mt-1 block text-right text-[10px] font-medium opacity-60">10:42 AM</span>
            </div>
          </div>

          {channel === "whatsapp" && menuItems.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {menuItems.slice(0, 3).map((item) => (
                <span
                  key={item.label}
                  className="rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-semibold text-[#075e54] shadow-sm"
                >
                  {item.label}
                </span>
              ))}
            </div>
          )}

          {(channel === "mercadolibre" || channel === "tiendanube") && product && (
            <div className="flex max-w-[90%] items-center gap-3 rounded-lg border bg-white p-3 shadow-sm">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-gray-100 text-[9px] font-medium tracking-wide text-gray-400">
                IMG
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{product.name}</p>
                <p className="text-sm font-semibold text-gray-700">{product.price}</p>
              </div>
            </div>
          )}

          {(channel === "whatsapp" || channel === "telegram" || channel === "web") && (
            <div className="flex justify-end">
              <div className={cn("relative max-w-[85%] px-3 py-2 text-[13px] leading-relaxed", theme.bubbleOut)}>
                Queria saber si tienen stock del modelo en rojo.
                <span className="mt-1 block text-right text-[10px] font-medium opacity-60">10:43 AM</span>
                {channel === "whatsapp" && <span className="absolute bottom-1 right-1 text-[9px]">✓✓</span>}
              </div>
            </div>
          )}

          {(channel === "whatsapp" || channel === "telegram") && (
            <div className="flex justify-start">
              <div className={cn("flex max-w-[60%] items-center gap-1.5 px-3 py-2", theme.bubbleIn)}>
                <span className="h-1.5 w-1.5 rounded-full bg-black/40" />
                <span className="h-1.5 w-1.5 rounded-full bg-black/40" />
                <span className="h-1.5 w-1.5 rounded-full bg-black/40" />
              </div>
            </div>
          )}
        </div>

        <div className="relative z-10 mt-auto pt-2">
          <div className="flex h-10 w-full items-center rounded-full bg-black/5 px-4 text-xs text-gray-500">
            Escribi un mensaje...
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ChannelPreview;
