// src/components/chat/ChatMessage.tsx

import React from "react";
import { Message } from "@/types/chat"; // Asegúrate que tu tipo Message incluya `botones`
import { motion } from "framer-motion";
import ChatButtons from "./ChatButtons"; // ✅ 1. IMPORTAMOS TU NUEVO COMPONENTE

const LOGO_BOT = "/favicon/favicon-48x48.png";

// ... (El componente UserAvatar no necesita cambios)
const UserAvatar = () => (
  <motion.span /* ... */ >
    <span className="text-2xl font-bold text-primary dark:text-blue-100">🧑‍💼</span>
  </motion.span>
);


interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  // ... (Toda la lógica inicial para mensajes inválidos y CTA no necesita cambios)
  if (!message || typeof message.text !== "string") { /* ... */ }
  if (message.text === "__cta__") { /* ... */ }

  const isBot = message.isBot;
  const bubbleVariants = { /* ... */ };

  // Esta función se mantiene aquí para pasársela como prop a ChatButtons
  const handleButtonClick = (payload: string) => {
    window.dispatchEvent(new CustomEvent('sendChatMessage', { detail: payload }));
  };

  return (
    <div className={`flex items-end gap-2 px-3 mb-1 ${isBot ? "justify-start" : "justify-end"} font-['Inter','Segoe UI',Arial,sans-serif]`}>
      {isBot && ( <motion.span /* ... Avatar del Bot ... */ > <img src={LOGO_BOT} /> </motion.span> )}

      <motion.div
        className={`max-w-[95vw] sm:max-w-[380px] md:max-w-[420px] w-full px-4 py-3 shadow-lg text-base leading-snug ${isBot ? "bg-gradient-to-br from-blue-50 to-blue-200 ..." : "bg-gradient-to-br from-blue-500 to-blue-700 ..."}`}
        // ... (el resto de tus estilos y props de motion.div)
      >
        <div className="w-full prose ..." dangerouslySetInnerHTML={{ __html: message.text }} />

        {/* ▼▼▼ AQUÍ ESTÁ LA MAGIA ▼▼▼ */}
        {/* Usamos tu componente ChatButtons en lugar de la lógica manual */}
        {isBot && message.botones && message.botones.length > 0 && (
          <div className="mt-3 pt-3 border-t border-black/10 dark:border-white/10">
            <ChatButtons
              botones={message.botones.map(b => ({ texto: b.title, payload: b.payload }))} // ✅ 2. Adaptamos los datos aquí
              onButtonClick={handleButtonClick}
            />
          </div>
        )}
        {/* ▲▲▲ FIN DE LA SECCIÓN DE BOTONES ▲▲▲ */}

        <div className={`text-xs mt-2 opacity-60 ...`}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </motion.div>

      {!isBot && ( <UserAvatar /> )}
    </div>
  );
};

export default ChatMessage;