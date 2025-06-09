// src/components/chat/ChatMessage.tsx

import React from "react";
import { Message } from "@/types/chat";
import { motion } from "framer-motion";
import ChatButtons from "./ChatButtons"; // <-- 1. Importamos el nuevo componente

const LOGO_BOT = "/favicon/favicon-48x48.png";

const UserAvatar = () => (
    <motion.span /* ... tu código de UserAvatar sin cambios ... */ >
        <span className="text-2xl font-bold text-primary dark:text-blue-100">🧑‍💼</span>
    </motion.span>
);

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  if (!message || typeof message.text !== "string") {
    return ( <div className="text-xs text-destructive italic mt-2 px-3">❌ Mensaje inválido.</div> );
  }

  // Lógica de botones CTA (sin cambios)
  if (message.text === "__cta__") {
    // ... tu código para los botones de WhatsApp/Demo sin cambios ...
  }

  const isBot = message.isBot;
  const bubbleVariants = { /* ... tus variantes de animación sin cambios ... */ };

  // --- NUEVA FUNCIÓN PARA MANEJAR CLICS EN BOTONES ---
  const handleButtonClick = (payload: string) => {
    // Creamos un evento personalizado para que la página principal lo escuche
    window.dispatchEvent(new CustomEvent('sendChatMessage', { detail: payload }));
  }

  return (
    <div className={`flex items-end gap-2 px-3 mb-1 ${isBot ? "justify-start" : "justify-end"} font-['Inter','Segoe UI',Arial,sans-serif]`}>
        {isBot && ( <motion.span /* ... tu avatar de bot sin cambios ... */ /> )}
        <motion.div
            className={`max-w-[95vw] sm:max-w-[380px] md:max-w-[420px] w-full px-4 py-2 shadow-lg text-base leading-snug ${isBot ? "bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 text-blue-900 border border-blue-200 rounded-3xl rounded-bl-none dark:from-blue-900 dark:via-blue-950 dark:to-blue-900 dark:text-blue-100 dark:border-blue-800" : "bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-3xl rounded-br-none border border-blue-700 font-semibold dark:from-blue-700 dark:to-blue-900 dark:text-white dark:border-blue-900"} animate-fade-in`}
            style={{ wordBreak: "break-word", boxShadow: "0 4px 16px rgba(60,60,110,0.10)" }}
            variants={bubbleVariants}
            initial="hidden"
            animate="visible"
        >
            <div className="w-full prose prose-blue dark:prose-invert max-w-full" style={{ padding: 0, margin: 0, fontSize: '1em', lineHeight: 1.42, fontFamily: "inherit", overflowWrap: "break-word" }}
                 dangerouslySetInnerHTML={{ __html: message.text }}
            />

            {/* --- AQUÍ RENDERIZAMOS LOS BOTONES SI EXISTEN --- */}
            {message.isBot && message.botones && (
                <ChatButtons botones={message.botones} onButtonClick={handleButtonClick} />
            )}
            
            <div className={`text-xs mt-1 opacity-60 text-right select-none tracking-tight font-normal ${isBot ? "text-blue-700 dark:text-blue-200" : "text-white dark:text-gray-200"}`}>
                {typeof message.timestamp === "string" ? message.timestamp : new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
        </motion.div>
        {!isBot && ( <UserAvatar /> )}
    </div>
  );
};

export default ChatMessage;