// src/components/chat/ChatMessageMunicipio.tsx
import React from "react";
import { Message } from "@/types/chat";
import ChatButtons from "./ChatButtons";
import { motion } from "framer-motion";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";
import DOMPurify from "dompurify";

const AvatarBot: React.FC<{ isTyping: boolean }> = ({ isTyping }) => (
  <motion.div
    initial={{ scale: 0.8, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
    className={`flex-shrink-0 w-10 h-10 rounded-full bg-card flex items-center justify-center border-2 transition-all duration-200 ease-in-out ${
      isTyping
        ? "border-blue-500 shadow-lg shadow-blue-500/40 scale-105"
        : "border-border shadow-sm"
    }`}
  >
    <ChatbocLogoAnimated
      size={36}
      smiling={isTyping}
      movingEyes={isTyping}
      blinking
      pulsing
    />
  </motion.div>
);

const UserAvatar = () => (
  <motion.span
    className="flex-shrink-0 w-9 h-9 rounded-full bg-secondary flex items-center justify-center border border-border shadow-md dark:border-blue-700"
    initial={{ scale: 0.8, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ type: "spring", stiffness: 200, damping: 20 }}
  >
    <span className="text-2xl font-bold text-primary dark:text-blue-100">
      🧑‍💼
    </span>
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

  // Limpiamos HTML siempre
  const sanitizedHtml = DOMPurify.sanitize(message.text);
  const isBot = message.isBot;

  // Bubble: más pro y moderno (sombra más suave, colores modernos)
  const bubbleClass = isBot
    ? "bg-muted text-foreground rounded-b-2xl rounded-tr-2xl dark:bg-[#262c36] shadow-lg shadow-blue-900/5"
    : "bg-primary text-primary-foreground rounded-b-2xl rounded-tl-2xl dark:bg-blue-700/90 shadow-md shadow-blue-500/10";

  return (
    <div
      className={`flex items-end gap-2.5 ${
        isBot ? "justify-start" : "justify-end"
      }`}
    >
      {isBot && <AvatarBot isTyping={isTyping} />}

      <div className="flex flex-col">
        <motion.div
          className={`px-4 py-3 max-w-[320px] relative break-words ${bubbleClass}`}
          variants={{
            hidden: { opacity: 0, y: 14, scale: 0.97 },
            visible: { opacity: 1, y: 0, scale: 1 },
          }}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.29, ease: "easeOut" }}
        >
          <div
            className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-0"
            dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
          />
        </motion.div>

        {isBot && message.botones && message.botones.length > 0 && (
          <ChatButtons
            botones={message.botones}
            onButtonClick={onButtonClick}
            onInternalAction={onInternalAction}
          />
        )}
      </div>

      {!isBot && <UserAvatar />}
    </div>
  );
};

export default ChatMessageMunicipio;
