// src/components/chat/ChatMessagePyme.tsx
import React from "react";
import { Message, SendPayload } from "@/types/chat"; // Import SendPayload
import ChatButtons from "./ChatButtons";
import { motion } from "framer-motion";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";
import UserAvatarAnimated from "./UserAvatarAnimated";
import sanitizeMessageHtml from "@/utils/sanitizeMessageHtml";

// import { getCurrentTipoChat } from "@/utils/tipoChat"; // No se usa getCurrentTipoChat aquí
import AttachmentPreview from "./AttachmentPreview";
import { deriveAttachmentInfo, AttachmentInfo } from "@/utils/attachment"; // Usar deriveAttachmentInfo
import MessageBubble from "./MessageBubble";

// --- Avatares reutilizados ---
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

const UserAvatar = () => (
  <motion.span
    className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center border border-border shadow-md"
    initial={{ scale: 0.8, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ type: "spring", stiffness: 200, damping: 20 }}
  >
    <UserAvatarAnimated size={24} talking={false} />
  </motion.span>
);


interface ChatMessageProps {
  message: Message;
  isTyping: boolean;
  onButtonClick: (valueToSend: SendPayload) => void; // Actualizado a SendPayload
  onInternalAction?: (action: string) => void;
  tipoChat?: "pyme" | "municipio"; // tipoChat es una prop, no se usa getCurrentTipoChat aquí
  query?: string;
}

const ChatMessagePyme = React.forwardRef<HTMLDivElement, ChatMessageProps>( (
  {
    message,
    isTyping,
    onButtonClick,
    onInternalAction,
    // tipoChat, // tipoChat no se usa directamente en la lógica de Pyme para renderizar adjuntos
    // query, // query no se usa directamente aquí
  },
  ref
) => {
  if (!message) { // Chequeo simplificado
    return (
      <div className="text-xs text-destructive italic mt-2 px-3">
        ❌ Mensaje inválido.
      </div>
    );
  }

  const safeText = typeof message.text === "string" && message.text !== "NaN" ? message.text : "";
  const sanitizedHtml = sanitizeMessageHtml(safeText);

  let processedAttachmentInfo: AttachmentInfo | null = null;

  if (message.attachmentInfo && message.attachmentInfo.url && message.attachmentInfo.name && message.attachmentInfo.mimeType) {
    // Si tenemos attachmentInfo del backend, lo usamos como fuente de verdad.
    processedAttachmentInfo = deriveAttachmentInfo(
      message.attachmentInfo.url,
      message.attachmentInfo.name,
      message.attachmentInfo.mimeType,
      message.attachmentInfo.size
    );
  } else if (message.mediaUrl && message.isBot) {
    // Fallback MUY CAUTELOSO a mediaUrl SOLO SI ES BOT (para no interpretar URLs de usuario como archivos)
    // y asumiendo que mediaUrl siempre apunta a un archivo directo si lo envía el bot.
    // Aquí, el 'name' y 'mimeType' serían adivinados por deriveAttachmentInfo a partir de la URL.
    // Esto es menos ideal que tener attachmentInfo completo.
    processedAttachmentInfo = deriveAttachmentInfo(message.mediaUrl, message.mediaUrl.split('/').pop() || "archivo_adjunto");
  }
  // NO hay fallback a parsear `safeText` para URLs, para evitar falsos positivos.

  const isBot = message.isBot;
  const bubbleClass = isBot
    ? "bg-muted text-muted-foreground"
    : "bg-primary text-primary-foreground";
  const bubbleWidth = "max-w-[95vw] md:max-w-2xl";
  const bubbleExtra = "";

  // Determinar si se debe mostrar el AttachmentPreview o el texto.
  // Se muestra AttachmentPreview si hay un processedAttachmentInfo y no es de tipo 'other' sin extensión
  // (lo que podría ser una URL genérica que deriveAttachmentInfo no pudo clasificar pero tampoco es un archivo claro).
  // O si hay locationData (para mapas).
  const showAttachment = !!(
    (processedAttachmentInfo && (processedAttachmentInfo.type !== 'other' || !!processedAttachmentInfo.extension)) ||
    message.locationData
  );

  return (
    <div
      ref={ref}
      className={`flex w-full ${isBot ? "justify-start" : "justify-end"} mb-2`}
    >
      <div className={`flex items-end gap-2 ${isBot ? "" : "flex-row-reverse"}`}>
        {isBot && <AvatarBot isTyping={isTyping} />}

        <MessageBubble className={`${bubbleWidth} ${bubbleClass} ${bubbleExtra}`}>
          {showAttachment ? (
            <AttachmentPreview
              attachment={processedAttachmentInfo || undefined} // Pasar undefined si es null
              locationData={message.locationData}
              // Si hay adjunto, el texto principal del mensaje podría ser un título o descripción.
              // Si no hay texto y sí adjunto, AttachmentPreview lo maneja.
              // Si hay texto Y adjunto, el texto se muestra si AttachmentPreview no lo hace.
              // Aquí se asume que si hay adjunto, el `safeText` es un acompañamiento o puede ser ignorado si el preview es suficiente.
              // Para simplificar: si hay adjunto, el texto principal se ignora aquí, AttachmentPreview decide.
              // Si se quiere mostrar el texto Y el adjunto, la estructura de AttachmentPreview o aquí cambiaría.
              // Por ahora: si hay adjunto, el texto principal se considera cubierto por el nombre del archivo en AttachmentPreview o es irrelevante.
              // Si no hay adjunto, y fallbackText se usa, es el `sanitizedHtml`.
              fallbackText={!processedAttachmentInfo && !message.locationData ? sanitizedHtml : undefined}
            />
          ) : (
            // Solo mostrar texto si no hay un adjunto válido para AttachmentPreview
            sanitizedHtml && <span
              className="prose dark:prose-invert max-w-none text-sm [&_p]:my-0"
              dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
            />
          )}
          {isBot && message.botones && message.botones.length > 0 && (
            <ChatButtons
              botones={message.botones}
              onButtonClick={onButtonClick}
              onInternalAction={onInternalAction}
            />
          )}
        </MessageBubble>

        {!isBot && <UserAvatar />}
      </div>
    </div>
  );
});

export default ChatMessagePyme;
