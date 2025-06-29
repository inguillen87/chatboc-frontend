// src/components/chat/ChatMessagePyme.tsx
import React from "react";
import { Message } from "@/types/chat";
import ChatButtons from "./ChatButtons";
import { motion } from "framer-motion";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";
import UserAvatarAnimated from "./UserAvatarAnimated";
import sanitizeMessageHtml from "@/utils/sanitizeMessageHtml";

import { getCurrentTipoChat } from "@/utils/tipoChat";
import AttachmentPreview from "./AttachmentPreview";
import { getAttachmentInfo } from "@/utils/attachment";
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
  onButtonClick: (valueToSend: string) => void;
  onInternalAction?: (action: string) => void;
  tipoChat?: "pyme" | "municipio";
  query?: string;
}

const ChatMessagePyme = React.forwardRef<HTMLDivElement, ChatMessageProps>( (
  {
    message,
    isTyping,
    onButtonClick,
    onInternalAction,
    tipoChat,
    query,
  },
  ref
) => {
  if (!message || typeof message.text !== "string") {
    return (
      <div className="text-xs text-destructive italic mt-2 px-3">
        ❌ Mensaje inválido o malformado.
      </div>
    );
  }


  // Evitar mostrar 'NaN' o valores falsos
  const safeText = message.text === "NaN" || message.text == null ? "" : message.text;
  // Limpiamos HTML sin cortar el texto
  const sanitizedHtml = sanitizeMessageHtml(safeText);

  let attachmentForPreview: ReturnType<typeof getAttachmentInfo> = null;

  if (message.attachmentInfo && message.attachmentInfo.url && message.attachmentInfo.name) {
    const ext = message.attachmentInfo.name.split('.').pop()?.toLowerCase() || '';
    // Aquí podríamos llamar a una función mejorada en utils/attachment.ts que determine el 'type'
    // basado en mimeType o extensión de forma más robusta.
    // Por ahora, derivamos 'type' de forma simple como lo hace getAttachmentInfo.
    let type: 'image' | 'pdf' | 'spreadsheet' | 'other' = 'other';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) type = 'image';
    else if (ext === 'pdf') type = 'pdf';
    else if (['xls', 'xlsx', 'csv'].includes(ext)) type = 'spreadsheet';

    attachmentForPreview = {
      url: message.attachmentInfo.url,
      name: message.attachmentInfo.name,
      extension: ext,
      type: type, // Se necesitaría una función para mapear mimeType a AttachmentType si se usa mimeType
    };
  } else if (message.mediaUrl) { // Fallback a mediaUrl si existe
    attachmentForPreview = getAttachmentInfo(message.mediaUrl);
  } else { // Fallback a parsear el texto del mensaje (comportamiento original de Pyme)
    attachmentForPreview = getAttachmentInfo(safeText);
  }

  const isBot = message.isBot;
  const bubbleClass = isBot
    ? "bg-muted text-muted-foreground"
    : "bg-primary text-primary-foreground";
  const bubbleWidth = "max-w-[95vw] md:max-w-2xl";
  const bubbleExtra = "";

  return (
    <div
      ref={ref}
      className={`flex w-full ${isBot ? "justify-start" : "justify-end"} mb-2`}
    >
      <div className={`flex items-end gap-2 ${isBot ? "" : "flex-row-reverse"}`}>
        {isBot && <AvatarBot isTyping={isTyping} />}

        <MessageBubble className={`${bubbleWidth} ${bubbleClass} ${bubbleExtra}`}>
          {attachmentForPreview ? (
            <AttachmentPreview attachment={attachmentForPreview} />
          ) : (
            <span
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
