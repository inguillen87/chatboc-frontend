// src/components/chat/ChatMessageMunicipio.tsx
import React from "react";
import { Message, SendPayload } from "@/types/chat"; // Importa SendPayload
import ChatButtons from "./ChatButtons";
import { motion } from "framer-motion";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";
import DOMPurify from "dompurify";
import AttachmentPreview from "./AttachmentPreview";
import TypewriterText from "./TypewriterText";

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
    <span className="text-xl font-bold text-primary dark:text-blue-100">🧑‍💼</span>
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

const ChatMessageMunicipio: React.FC<ChatMessageProps> = ({
  message,
  isTyping,
  onButtonClick,
  onInternalAction,
  query: _query, // not used but kept for prop consistency
}) => {
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
  const sanitizedHtml = DOMPurify.sanitize(safeText);

  const isBot = message.isBot;

  const bubbleClass = isBot
    ? "bg-[#192745] text-blue-100"
    : "bg-gradient-to-br from-blue-600 to-blue-800 text-white";

  return (
    <div className={`flex w-full ${isBot ? "justify-start" : "justify-end"} mb-2`}>
      <div className={`flex items-end gap-2 ${isBot ? "" : "flex-row-reverse"}`}>
        {isBot && <AvatarBot isTyping={isTyping} />}

        <motion.div
          className={`max-w-[94vw] md:max-w-2xl rounded-2xl shadow-md px-5 py-3 font-medium text-base leading-relaxed whitespace-pre-line break-words ${bubbleClass}`}
          variants={{
            hidden: { opacity: 0, y: 14, scale: 0.97 },
            visible: { opacity: 1, y: 0, scale: [1, 1.03, 1] },
          }}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.29, ease: "easeOut" }}
        >
          {/* Renderiza AttachmentPreview solo si hay mediaUrl o locationData */}
          {(message.mediaUrl || message.locationData) ? (
            <AttachmentPreview 
                mediaUrl={message.mediaUrl} 
                locationData={message.locationData} 
                fallbackText={message.text} // Usa el texto del mensaje como fallback si no se muestra el adjunto
            />
          ) : (
            <div className="prose dark:prose-invert max-w-none text-sm [&_p]:my-0">
              {isBot ? (
                <TypewriterText html={sanitizedHtml} />
              ) : (
                <span dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
              )}
            </div>
          )}
          {isBot && message.botones && message.botones.length > 0 && (
            <ChatButtons
              botones={message.botones}
              onButtonClick={onButtonClick} // Pasa el onButtonClick modificado
              onInternalAction={onInternalAction}
            />
          )}
        </motion.div>

        {!isBot && <UserAvatar />}
      </div>
    </div>
  );
};

export default ChatMessageMunicipio;