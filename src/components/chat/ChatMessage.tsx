import React from "react";
import { Message } from "@/types/chat";
import { motion } from "framer-motion";

// Ruta al logo PNG, AJUSTA según tu estructura
const LOGO_BOT = "/favicon/favicon-48x48.png";

// Avatar por defecto para usuario (puede ser un emoji, inicial, o imagen)
const UserAvatar = () => (
  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center border border-gray-300 shadow">
    <span className="text-xl font-bold text-gray-500 dark:text-gray-300">🧑</span>
  </span>
);

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  // Mensaje inválido
  if (!message || typeof message.text !== "string") {
    return (
      <div className="text-xs text-red-600 italic mt-2 px-3">
        ❌ Mensaje inválido o malformado.
      </div>
    );
  }

  // CTA especial
  if (message.text === "__cta__") {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    if (user?.token) return null;
    return (
      <div className="flex justify-center mt-4">
        <div className="text-center space-y-2">
          <button
            onClick={() => (window.location.href = "/demo")}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-medium shadow"
          >
            Usar Chatboc en mi empresa
          </button>
          <button
            onClick={() =>
              window.open(
                "https://wa.me/5492613168608?text=Hola! Estoy probando Chatboc y quiero implementarlo en mi empresa.",
                "_blank"
              )
            }
            className="px-4 py-2 text-sm border border-blue-600 text-blue-600 rounded-xl hover:bg-blue-50 transition font-medium"
          >
            Hablar por WhatsApp
          </button>
        </div>
      </div>
    );
  }

  // Sugerencias
  if (message.text === "__sugerencia__" && message.originalQuestion) {
    return (
      <div className="flex justify-start px-2 mt-2">
        {/* ... tu lógica original de sugerencia ... */}
      </div>
    );
  }

  const isBot = message.isBot;

  // --- ANIMACIONES VARIANTS ---
  const bubbleVariants = {
    hidden: { opacity: 0, y: 10, scale: 0.98 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.18 } },
  };

  const avatarVariants = {
    hidden: { opacity: 0, scale: 0.85 },
    visible: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 200 } },
  };

  return (
    <div
      className={`
        flex items-end gap-2 px-2 mt-2
        ${isBot ? "justify-start" : "justify-end"}
      `}
    >
      {/* Avatar Bot */}
      {isBot && (
        <motion.span
          className="flex-shrink-0 w-9 h-9 rounded-full bg-white dark:bg-blue-900 flex items-center justify-center border border-blue-300 shadow"
          initial="hidden"
          animate="visible"
          variants={avatarVariants}
        >
          <img
            src={LOGO_BOT}
            alt="Chatboc"
            className="w-7 h-7 object-contain"
            style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.10))" }}
          />
        </motion.span>
      )}

      {/* Mensaje */}
      <motion.div
        className={`
          max-w-[78vw] sm:max-w-[70%] p-3 rounded-2xl shadow
          text-sm break-words
          ${isBot
            ? "bg-blue-100 text-gray-900 rounded-bl-none dark:bg-blue-900 dark:text-blue-50 border border-blue-200 dark:border-blue-800"
            : "bg-blue-600 text-white rounded-br-none border border-blue-700"}
        `}
        style={{ wordBreak: "break-word" }}
        initial="hidden"
        animate="visible"
        variants={bubbleVariants}
      >
        <div dangerouslySetInnerHTML={{ __html: message.text }} />
        <div className="text-xs mt-1 opacity-70 text-right">
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </motion.div>

      {/* Avatar Usuario */}
      {!isBot && (
        <motion.span
          className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center border border-gray-300 shadow"
          initial="hidden"
          animate="visible"
          variants={avatarVariants}
        >
          <UserAvatar />
        </motion.span>
      )}
    </div>
  );
};

export default ChatMessage;
