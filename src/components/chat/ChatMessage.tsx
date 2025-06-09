// src/components/chat/ChatMessage.tsx
import React from "react";
import { Message } from "@/types/chat";
import { motion } from "framer-motion";
import ChatButtons from "./ChatButtons"; // ✅ Importamos tu componente

const LOGO_BOT = "/favicon/favicon-48x48.png";
const UserAvatar = () => { /* ... tu componente UserAvatar sin cambios ... */ };

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  // ... tu lógica para mensajes inválidos y CTA sin cambios ...

  const isBot = message.isBot;
  const bubbleVariants = { /* ... */ };

  const handleButtonClick = (payload: string) => {
    // ✅ DETECTIVE #1: ¿Llega el clic hasta aquí?
    console.log(`[ChatMessage] Botón clickeado. Payload: "${payload}". Despachando evento...`);
    window.dispatchEvent(new CustomEvent('sendChatMessage', { detail: payload }));
  };

  return (
    <div className={`flex items-end ...`}>
      {/* ... tu JSX del avatar del bot ... */}

      <motion.div className={`max-w-[95vw] ...`}>
        <div className="w-full prose ..." dangerouslySetInnerHTML={{ __html: message.text }} />

        {/* ✅ Lógica de botones AHORA USA TU COMPONENTE */}
        {isBot && message.botones && message.botones.length > 0 && (
          <ChatButtons
            botones={message.botones}
            onButtonClick={handleButtonClick}
          />
        )}
        
        <div className={`text-xs mt-2 ...`}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </motion.div>

      {/* ... tu JSX del avatar del usuario ... */}
    </div>
  );
};

export default ChatMessage;