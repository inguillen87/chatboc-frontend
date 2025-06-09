// src/components/chat/ChatMessage.tsx
import React from "react";
import { Message } from "@/types/chat";
import { motion } from "framer-motion";
import ChatButtons from "./ChatButtons"; // Importamos el componente

const LOGO_BOT = "/favicon/favicon-48x48.png";

// ... (Tu UserAvatar sin cambios)

interface ChatMessageProps { message: Message; }

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  if (!message || typeof message.text !== "string") {
    return <div className="text-xs text-destructive italic mt-2 px-3">❌ Mensaje inválido.</div>;
  }
  if (message.text === "__cta__") {
    // ... (Tu lógica de botones CTA sin cambios)
  }

  const isBot = message.isBot;
  const bubbleVariants = { /* ... tus animaciones sin cambios ... */ };

  return (
    <div className={`flex items-end gap-2 px-3 mb-1 ${isBot ? "justify-start" : "justify-end"} font-['Inter','Segoe UI',Arial,sans-serif]`}>
      {isBot && ( <motion.span /* ... tu avatar de bot sin cambios ... */ /> )}
      
      <motion.div
        className={`max-w-[95vw] sm:max-w-[380px] md:max-w-[420px] w-full px-4 py-3 shadow-lg text-base leading-snug ${isBot ? "bg-gradient-to-br from-blue-50 to-blue-200 text-blue-900 rounded-3xl rounded-bl-none dark:from-blue-900 dark:to-blue-900 dark:text-blue-100 dark:border-blue-800" : "bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-3xl rounded-br-none"}`}
        variants={bubbleVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="w-full prose prose-blue dark:prose-invert max-w-full"
             dangerouslySetInnerHTML={{ __html: message.text }} />
        
        {/* AQUÍ ESTÁ LA LÓGICA CORRECTA PARA MOSTRAR LOS BOTONES */}
        {message.isBot && message.botones && <ChatButtons botones={message.botones} />}

        <div className={`text-xs mt-2 opacity-60 text-right select-none ${isBot ? "text-blue-700 dark:text-blue-200" : "text-white/80"}`}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </motion.div>

      {!isBot && ( <UserAvatar /> )}
    </div>
  );
};

export default ChatMessage;