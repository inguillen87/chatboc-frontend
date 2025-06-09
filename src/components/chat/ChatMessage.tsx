import React from "react";
import { Message } from "@/types/chat";
import { motion } from "framer-motion";
import ChatButtons from "./ChatButtons"; // <-- La importación sigue siendo necesaria

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
  if (!message || typeof message.text !== "string") {
    return (
      <div className="text-xs text-destructive italic mt-2 px-3">
        ❌ Mensaje inválido o malformado.
      </div>
    );
  }

  // Lógica de botones CTA (sin cambios)
  if (message.text === "__cta__") {
    const user = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "null") : null;
    if (user?.token) return null;
    return (
      <div className="flex justify-center mt-4">
        <div className="text-center space-y-2">
          {/* ... tu JSX para los botones CTA sin cambios ... */}
        </div>
      </div>
    );
  }

  const isBot = message.isBot;
  const bubbleVariants = { /* ... tus animaciones sin cambios ... */ };

  // --- NUEVA FUNCIÓN PARA MANEJAR CLICS EN BOTONES DINÁMICOS ---
  const handleButtonClick = (payload: string) => {
    // Creamos un evento personalizado para que la página principal lo escuche y llame a su propio handleSend
    window.dispatchEvent(new CustomEvent('sendChatMessage', { detail: payload }));
  }

  return (
    <div className={`flex items-end gap-2 px-3 mb-1 ${isBot ? "justify-start" : "justify-end"} font-['Inter','Segoe UI',Arial,sans-serif]`}>
      {isBot && (
        <motion.span className="flex-shrink-0 w-10 h-10 rounded-full bg-card dark:bg-blue-950 flex items-center justify-center border border-border dark:border-blue-900 shadow-md" /* ... */ >
          <img src={LOGO_BOT} alt="Chatboc" className="w-8 h-8 object-contain" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.10))" }} />
        </motion.span>
      )}

      <motion.div
        className={`max-w-[95vw] sm:max-w-[380px] md:max-w-[420px] w-full px-4 py-3 shadow-lg text-base leading-snug ${isBot ? "bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 text-blue-900 rounded-3xl rounded-bl-none dark:from-blue-900 dark:to-blue-900 dark:text-blue-100 dark:border-blue-800" : "bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-3xl rounded-br-none"}`}
        variants={bubbleVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="w-full prose prose-blue dark:prose-invert max-w-full" dangerouslySetInnerHTML={{ __html: message.text }} />

        {/* AQUÍ ESTÁ LA LÓGICA CORRECTA PARA MOSTRAR LOS BOTONES */}
        {message.isBot && message.botones && (
          <ChatButtons botones={message.botones} onButtonClick={handleButtonClick} />
        )}
        
        <div className={`text-xs mt-2 opacity-60 text-right select-none ${isBot ? "text-blue-700 dark:text-blue-200" : "text-white/80"}`}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </motion.div>

      {!isBot && ( <UserAvatar /> )}
    </div>
  );
};

export default ChatMessage;