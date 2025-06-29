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

const messageVariants = {
  initial: (isBot: boolean) => ({
    opacity: 0,
    x: isBot ? -40 : 40, // Slightly reduced for subtlety
    scale: 0.95,
  }),
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 260, damping: 22, duration: 0.25 }, // Slightly faster spring
  },
  exit: (isBot: boolean) => ({
    opacity: 0,
    x: isBot ? -20 : 20, // Reduced exit travel
    scale: 0.98,
    transition: { duration: 0.15, ease: "easeIn" }, // Faster exit
  }),
};


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
      <motion.div className="text-xs text-destructive italic mt-2 px-3" ref={ref}>
        ❌ Mensaje inválido.
      </motion.div>
    );
  }

  const isBot = message.isBot; // Define isBot here for use in variants and logic

  const safeText = typeof message.text === "string" && message.text !== "NaN" ? message.text : "";
  const sanitizedHtml = sanitizeMessageHtml(safeText);

  let processedAttachmentInfo: AttachmentInfo | null = null;

  if (message.attachmentInfo && message.attachmentInfo.url && message.attachmentInfo.name && message.attachmentInfo.mimeType) {
    processedAttachmentInfo = deriveAttachmentInfo(
      message.attachmentInfo.url,
      message.attachmentInfo.name,
      message.attachmentInfo.mimeType,
      message.attachmentInfo.size
    );
  } else if (message.mediaUrl && isBot) { // Fallback for bot messages with mediaUrl
    processedAttachmentInfo = deriveAttachmentInfo(message.mediaUrl, message.mediaUrl.split('/').pop() || "archivo_adjunto");
  }
  
  const bubbleClass = isBot
    ? "bg-muted text-muted-foreground"
    : "bg-primary text-primary-foreground";
  const bubbleWidth = "max-w-[95vw] md:max-w-3xl"; 
  const bubbleExtra = "";

  const showAttachment = !!(
    (processedAttachmentInfo && (processedAttachmentInfo.type !== 'other' || !!processedAttachmentInfo.extension)) ||
    message.locationData
  );

  return (
    <motion.div
      ref={ref}
      className={`flex w-full ${isBot ? "justify-start" : "justify-end"} mb-2`}
      custom={isBot}
      variants={messageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      layout // Added layout prop
    >
      <div className={`flex items-end gap-2 ${isBot ? "" : "flex-row-reverse"}`}>
        {isBot && <AvatarBot isTyping={isTyping} />}

        <MessageBubble className={`${bubbleWidth} ${bubbleClass} ${bubbleExtra}`}>
          {showAttachment ? (
              <AttachmentPreview
                message={message} // Pass the full message object
                attachmentInfo={processedAttachmentInfo} // Pass derived info
                fallbackText={(!processedAttachmentInfo && !message.locationData) ? sanitizedHtml : undefined}
              />
            ) : (
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
    </motion.div>
  );
});

export default ChatMessagePyme;
