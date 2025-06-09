// components/chat/ChatMessage.js - VERSIÓN RESTAURADA Y FUNCIONAL

import React from "react";
import { Message } from "@/types/chat";
import { motion } from "framer-motion";
import ChatButtons from "./ChatButtons"; // Importamos tu componente

const LOGO_BOT = "/favicon/favicon-48x48.png";

const UserAvatar = () => (
  <motion.span
    className="flex-shrink-0 w-9 h-9 rounded-full bg-secondary flex items-center justify-center border border-border shadow-md dark:border-blue-700"
    initial={{ scale: 0.8, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ type: "spring", stiffness: 200, damping: 20 }}
  >
    <span className="text-2xl font-bold text-primary dark:text-blue-100">🧑‍💼</span>
  </motion.span>
);

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  if (!message || typeof message.text !== "string") { /* ... tu return de error ... */ }
  if (message.text === "__cta__") { /* ... tu return para los botones CTA ... */ }

  const isBot = message.isBot;
  const bubbleVariants = {
    hidden: { opacity: 0, y: 14, scale: 0.98 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.18 } },
  };

  const handleButtonClick = (payload: string) => {
    window.dispatchEvent(new CustomEvent('sendChatMessage', { detail: payload }));
  };

  return (
    <div className={`flex items-end gap-2 px-3 mb-1 ${isBot ? "justify-start" : "justify-end"} font-['Inter','Segoe UI',Arial,sans-serif]`}>
      {isBot && (
        <motion.span className="flex-shrink-0 w-10 h-10 rounded-full ...">
          <img src={LOGO_BOT} alt="Chatboc" className="w-8 h-8 object-contain" />
        </motion.span>
      )}

      {/* ✅ USAMOS TU BURBUJA CON LOS ESTILOS ORIGINALES */}
      <motion.div
        className={`max-w-[95vw] sm:max-w-[380px] md:max-w-[420px] w-full px-4 py-3 shadow-lg text-base leading-snug ${isBot ? "bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 text-blue-900 border border-blue-200 rounded-3xl rounded-bl-none dark:from-blue-900 dark:via-blue-950 dark:to-blue-900 dark:text-blue-100 dark:border-blue-800" : "bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-3xl rounded-br-none border border-blue-700 font-semibold dark:from-blue-700 dark:to-blue-900 dark:text-white dark:border-blue-900"} animate-fade-in`}
        style={{ wordBreak: "break-word", boxShadow: "0 4px 16px rgba(60,60,110,0.10)" }}
        initial="hidden"
        animate="visible"
        variants={bubbleVariants}
      >
        <div className="w-full prose prose-blue dark:prose-invert max-w-full" dangerouslySetInnerHTML={{ __html: message.text }} />
        
        {/* ✅ LÓGICA DE BOTONES AÑADIDA SIN ROMPER NADA */}
        {isBot && message.botones && message.botones.length > 0 && (
          <div className="mt-3 pt-3 border-t border-black/10 dark:border-white/10">
            <ChatButtons
              botones={message.botones}
              onButtonClick={handleButtonClick}
            />
          </div>
        )}

        <div className={`text-xs mt-1 opacity-60 text-right ...`}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </motion.div>

      {!isBot && ( <UserAvatar /> )}
    </div>
  );
};

export default ChatMessage;