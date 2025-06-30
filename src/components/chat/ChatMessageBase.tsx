// src/components/chat/ChatMessageBase.tsx
import React from "react";
import { Message, SendPayload, StructuredContentItem } from "@/types/chat";
import ChatButtons from "./ChatButtons";
import { motion } from "framer-motion";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";
import sanitizeMessageHtml from "@/utils/sanitizeMessageHtml";
import AttachmentPreview from "./AttachmentPreview";
import { deriveAttachmentInfo, AttachmentInfo } from "@/utils/attachment";
import MessageBubble from "./MessageBubble";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useUser } from "@/hooks/useUser";
import { User as UserIcon, ExternalLink } from "lucide-react";
import { getInitials, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// --- Avatares (reutilizados de ChatMessagePyme/Municipio) ---
const AvatarBot: React.FC<{ isTyping: boolean }> = ({ isTyping }) => (
  <motion.div
    initial={{ scale: 0.8, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
    className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-muted rounded-full shadow"
  >
    <ChatbocLogoAnimated
      size={24}
      smiling={isTyping}
      movingEyes={isTyping}
      blinking
      pulsing
    />
  </motion.div>
);

const UserChatAvatar: React.FC = () => {
  const { user } = useUser();
  const initials = getInitials(user?.name);

  return (
    <motion.div
      className="flex-shrink-0 shadow-md"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
    >
      <Avatar className="w-8 h-8 border">
        <AvatarImage src={user?.picture} alt={user?.name || "Avatar de usuario"} />
        <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
          {initials ? initials : <UserIcon size={16} />}
        </AvatarFallback>
      </Avatar>
    </motion.div>
  );
};

// --- Componente para renderizar StructuredContent ---
const StructuredContentDisplay: React.FC<{ items: StructuredContentItem[] }> = ({ items }) => {
  if (!items || items.length === 0) return null;

  return (
    <div className="mt-2 pt-2 border-t border-white/20 space-y-1.5">
      {items.map((item, index) => {
        let valueDisplay: React.ReactNode = item.value;
        const valueClasses: string[] = ["text-sm"];

        if (item.styleHint === 'bold') valueClasses.push("font-bold");
        if (item.styleHint === 'italic') valueClasses.push("italic");
        if (item.styleHint === 'highlight') valueClasses.push("bg-yellow-200 text-yellow-800 px-1 rounded");


        if (item.type === 'price' && typeof item.value === 'number') {
          valueDisplay = item.value.toLocaleString('es-AR', {
            style: 'currency',
            currency: item.currency || 'ARS',
          });
          valueClasses.push("font-semibold text-green-300"); // Ejemplo de estilo para precio
        } else if (item.type === 'quantity' && typeof item.value === 'number') {
          valueDisplay = `${item.value} ${item.unit || ''}`.trim();
          valueClasses.push("font-medium text-blue-300"); // Ejemplo de estilo para cantidad
        } else if (item.type === 'date' && typeof item.value === 'string') {
            try {
                valueDisplay = new Date(item.value).toLocaleDateString('es-AR', {
                    day: '2-digit', month: '2-digit', year: 'numeric'
                });
            } catch (e) { /* usa valor original si la fecha es inválida */ }
        } else if (item.type === 'url' || item.url) {
            valueDisplay = (
                <a
                    href={item.url || (typeof item.value === 'string' ? item.value : '#')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline inline-flex items-center gap-1"
                >
                    {typeof item.value === 'string' ? item.value : 'Enlace'} <ExternalLink size={12} />
                </a>
            );
        }

        return (
          <div key={index} className="grid grid-cols-3 gap-1 items-center">
            <span className="text-xs col-span-1 text-white/70">{item.label}:</span>
            <span className={cn("col-span-2", ...valueClasses)}>
              {valueDisplay}
            </span>
          </div>
        );
      })}
    </div>
  );
};


export interface ChatMessageBaseProps {
  message: Message;
  isTyping: boolean;
  onButtonClick: (valueToSend: SendPayload) => void;
  onInternalAction?: (action: string) => void;
  tipoChat?: "pyme" | "municipio"; // Puede usarse para alguna lógica residual muy específica
}

const ChatMessageBase = React.forwardRef<HTMLDivElement, ChatMessageBaseProps>( (
  {
    message,
    isTyping,
    onButtonClick,
    onInternalAction,
    // tipoChat, // tipoChat podría usarse si hay alguna variación mínima que no dependa del contenido del mensaje
  },
  ref
) => {
  if (!message) {
    return (
      <motion.div className="text-xs text-destructive italic mt-2 px-3" ref={ref}>
        ❌ Mensaje inválido.
      </motion.div>
    );
  }

  const isBot = message.isBot;

  const safeText = typeof message.text === "string" && message.text !== "NaN" ? message.text : "";
  const sanitizedHtml = sanitizeMessageHtml(safeText);

  let processedAttachmentInfo: AttachmentInfo | null = null;

  if (message.attachmentInfo?.url && message.attachmentInfo?.name) {
    processedAttachmentInfo = deriveAttachmentInfo(
      message.attachmentInfo.url,
      message.attachmentInfo.name,
      message.attachmentInfo.mimeType,
      message.attachmentInfo.size
    );
  } else if (message.mediaUrl && isBot) {
    processedAttachmentInfo = deriveAttachmentInfo(message.mediaUrl, message.mediaUrl.split('/').pop() || "archivo_adjunto");
  }

  const bubbleBaseClass = isBot ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground";
  let bubbleStyleClass = "";
  if (message.chatBubbleStyle === 'compact') {
    bubbleStyleClass = "py-1.5 px-2.5 text-sm"; // Estilo más compacto
  } else if (message.chatBubbleStyle === 'emphasis') {
    bubbleStyleClass = "border-2 border-yellow-500"; // Estilo con énfasis
  }

  const bubbleWidth = "max-w-[95vw] md:max-w-3xl";

  // Determinar si se muestra la sección de adjuntos/mapa o el contenido estructurado
  const showAttachmentOrMap = !!(
    (processedAttachmentInfo && (processedAttachmentInfo.type !== 'other' || !!processedAttachmentInfo.extension)) ||
    message.locationData
  );

  const showStructuredContent = !!(message.structuredContent && message.structuredContent.length > 0);

  // Display hint puede usarse para aplicar un contenedor especial alrededor del mensaje, o pasar a MessageBubble
  // Por ahora, lo mantendremos simple.

  return (
    <motion.div
      ref={ref}
      className={`flex w-full ${isBot ? "justify-start" : "justify-end"} mb-2`}
      // layout // Podría causar problemas con scroll, evaluar
    >
      <div className={`flex items-end gap-2 ${isBot ? "" : "flex-row-reverse"}`}>
        {isBot && <AvatarBot isTyping={isTyping} />}

        <MessageBubble className={cn(bubbleWidth, bubbleBaseClass, bubbleStyleClass)}>
          {/* Prioridad al texto si no hay otros contenidos especiales */}
          {(!showAttachmentOrMap && !showStructuredContent && sanitizedHtml) && (
            <span
              className="prose dark:prose-invert max-w-none text-sm [&_p]:my-0"
              dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
            />
          )}

          {/* Mostrar adjunto o mapa */}
          {showAttachmentOrMap && (
              <AttachmentPreview
                message={message} // Pasamos el mensaje completo para que AttachmentPreview decida
                attachmentInfo={processedAttachmentInfo}
                // Si hay adjunto pero también texto, el texto puede ser un caption o fallback
                fallbackText={sanitizedHtml && !showStructuredContent ? sanitizedHtml : undefined}
              />
          )}

          {/* Mostrar contenido estructurado */}
          {showStructuredContent && (
            <>
              {/* Si hay texto Y contenido estructurado, el texto puede ser una introducción */}
              {sanitizedHtml && !showAttachmentOrMap && (
                 <span
                    className="prose dark:prose-invert max-w-none text-sm [&_p]:my-0 mb-2 block"
                    dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                />
              )}
              <StructuredContentDisplay items={message.structuredContent!} />
            </>
          )}

          {/* Botones siempre al final si existen */}
          {isBot && message.botones && message.botones.length > 0 && (
            <ChatButtons
              botones={message.botones}
              onButtonClick={onButtonClick}
              onInternalAction={onInternalAction}
            />
          )}
        </MessageBubble>

        {!isBot && <UserChatAvatar />}
      </div>
    </motion.div>
  );
});

ChatMessageBase.displayName = "ChatMessageBase";
export default ChatMessageBase;
