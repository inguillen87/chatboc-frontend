// src/components/chat/ChatMessageMunicipio.tsx
import React from "react";
import { Message, SendPayload } from "@/types/chat"; // Importa SendPayload
import ChatButtons from "./ChatButtons";
import { motion } from "framer-motion";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";
import UserAvatarAnimated from "./UserAvatarAnimated";
import sanitizeMessageHtml from "@/utils/sanitizeMessageHtml";
import AttachmentPreview from "./AttachmentPreview";
import TypewriterText from "./TypewriterText";
import MessageBubble from "./MessageBubble";

const AvatarBot: React.FC<{ isTyping: boolean }> = ({ isTyping }) => (
  <motion.div
    initial={{ scale: 0.8, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
    className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-[#245ca6] rounded-full shadow"
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
    className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center border border-border shadow-md dark:border-blue-700"
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
  onButtonClick: (valueToSend: SendPayload) => void; // <-- MODIFICADO: Acepta SendPayload
  onInternalAction?: (action: string) => void;
  tipoChat?: "pyme" | "municipio";
  query?: string;
}

const ChatMessageMunicipio = React.forwardRef<HTMLDivElement, ChatMessageProps>( (
  {
    message,
    isTyping,
    onButtonClick,
    onInternalAction,
    query: _query, // not used but kept for prop consistency
  },
  ref
) => {
  // Seguridad ante mensajes rotos
  if (!message || typeof message.text !== "string") {
    return (
      <div className="text-xs text-destructive italic mt-2 px-3">
        ❌ Mensaje inválido o malformado.
      </div>
    );
  }

  // Evitar mostrar "NaN" o valores falsos
  const safeText = message.text === "NaN" || message.text == null ? "" : message.text;
  // Limpiamos HTML sin cortar el texto
  const sanitizedHtml = sanitizeMessageHtml(safeText);

  const isBot = message.isBot;

  const bubbleClass = isBot
    ? "bg-[#192745] text-blue-100"
    : "bg-gradient-to-br from-blue-600 to-blue-800 text-white";

  return (
    <div
      ref={ref}
      className={`flex w-full ${isBot ? "justify-start" : "justify-end"} mb-2`}
    >
      <div className={`flex items-end gap-2 ${isBot ? "" : "flex-row-reverse"}`}>
        {isBot && <AvatarBot isTyping={isTyping} />}

        <MessageBubble className={`max-w-[95vw] md:max-w-2xl ${bubbleClass}`}>
          {/* Renderiza AttachmentPreview solo si hay mediaUrl o locationData */}
          {(message.mediaUrl || message.locationData) ? (
            <AttachmentPreview
                mediaUrl={message.mediaUrl}
                locationData={message.locationData}
                fallbackText={message.text} // Usa el texto del mensaje como fallback si no se muestra el adjunto
            />
          ) : (
            isBot ? (
              <TypewriterText
                html={sanitizedHtml}
                className="prose dark:prose-invert max-w-none text-sm [&_p]:my-0"
              />
            ) : (
              <span
                className="prose dark:prose-invert max-w-none text-sm [&_p]:my-0"
                dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
              />
            )
          )}
          {isBot && message.botones && message.botones.length > 0 && (
            <ChatButtons
              botones={message.botones}
              onButtonClick={onButtonClick} // Pasa el onButtonClick modificado
              onInternalAction={onInternalAction}
            />
          )}
        </MessageBubble>

        {!isBot && <UserAvatar />}
      </div>
    </div>
  );
});

export default ChatMessageMunicipio;