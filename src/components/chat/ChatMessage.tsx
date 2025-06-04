import React from "react";
import { Message } from "@/types/chat";
import { motion } from "framer-motion";

const LOGO_BOT = "/favicon/favicon-48x48.png";

const UserAvatar = () => (
  <span className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-blue-100 to-blue-300 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center border border-blue-200 dark:border-blue-700 shadow-md">
    <span className="text-2xl font-bold text-blue-600 dark:text-blue-100">🧑‍💼</span>
  </span>
);

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  if (!message || typeof message.text !== "string") {
    return (
      <div className="text-xs text-red-600 italic mt-2 px-3">
        ❌ Mensaje inválido o malformado.
      </div>
    );
  }

  // CTA buttons
  if (message.text === "__cta__") {
    const user = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "null") : null;
    if (user?.token) return null;
    return (
      <div className="flex justify-center mt-4">
        <div className="text-center space-y-2">
          <button
            onClick={() => (window.location.href = "/demo")}
            className="px-4 py-2 text-base bg-gradient-to-br from-blue-600 to-blue-500 text-white rounded-xl hover:scale-105 shadow transition font-semibold"
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
            className="px-4 py-2 text-base border border-blue-500 text-blue-600 bg-white/80 dark:bg-gray-900/80 rounded-xl hover:bg-blue-50 hover:scale-105 transition font-semibold"
          >
            Hablar por WhatsApp
          </button>
        </div>
      </div>
    );
  }

  const isBot = message.isBot;

  // Animations
  const bubbleVariants = {
    hidden: { opacity: 0, y: 14, scale: 0.98 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.18 } },
  };
  const avatarVariants = {
    hidden: { opacity: 0, scale: 0.85 },
    visible: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 210 } },
  };

  return (
    <div
      className={`
        flex items-end gap-2 px-3 mb-1
        ${isBot ? "justify-start" : "justify-end"}
        font-['Inter','Segoe UI',Arial,sans-serif]
      `}
    >
      {/* Bot avatar */}
      {isBot && (
        <motion.span
          className="flex-shrink-0 w-10 h-10 rounded-full bg-white dark:bg-blue-950 flex items-center justify-center border border-blue-200 dark:border-blue-900 shadow-md"
          initial="hidden"
          animate="visible"
          variants={avatarVariants}
        >
          <img
            src={LOGO_BOT}
            alt="Chatboc"
            className="w-8 h-8 object-contain"
            style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.10))" }}
          />
        </motion.span>
      )}

      {/* Message bubble */}
      <motion.div
        className={`
          max-w-[95vw] sm:max-w-[380px] md:max-w-[420px] w-full
          px-4 py-2 rounded-2xl shadow-lg
          text-base leading-snug
          ${isBot
            ? "bg-gradient-to-br from-blue-50 via-white to-blue-100 dark:from-blue-900 dark:to-blue-800 dark:via-blue-950 text-blue-900 dark:text-blue-100 border border-blue-100 dark:border-blue-900 rounded-bl-none"
            : "bg-gradient-to-br from-blue-600 to-blue-500 text-white rounded-br-none border border-blue-700 font-semibold"}
          animate-fade-in
        `}
        style={{ wordBreak: "break-word", boxShadow: "0 4px 16px rgba(60,60,110,0.10)" }}
        initial="hidden"
        animate="visible"
        variants={bubbleVariants}
      >
        <div
          className="w-full prose prose-blue dark:prose-invert max-w-full"
          style={{
            padding: 0,
            margin: 0,
            fontSize: '1em',
            lineHeight: 1.42,
            fontFamily: "inherit",
            overflowWrap: "break-word"
          }}
          dangerouslySetInnerHTML={{ __html: message.text }}
        />
        <div className="text-xs mt-1 opacity-60 text-right select-none tracking-tight font-normal">
          {typeof message.timestamp === "string"
            ? message.timestamp
            : new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </motion.div>

      {/* User avatar */}
      {!isBot && (
        <motion.span
          className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-blue-200 to-blue-400 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center border border-blue-200 dark:border-blue-700 shadow-md"
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
