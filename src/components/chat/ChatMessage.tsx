import React from "react";
import { Message } from "@/types/chat";
import { motion } from "framer-motion";

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

  const ChatMessage: React.FC<{ message: Message }> = ({ message }) => {
  if (!message || typeof message.text !== "string") { return null; }

  const isBot = message.isBot;
    return (
      <div className="text-xs text-destructive italic mt-2 px-3">
        ❌ Mensaje inválido o malformado.
      </div>
    );
  }

  // CTA buttons - Ajustamos el estilo del botón alternativo
  if (message.text === "__cta__") {
    const user = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "null") : null;
    if (user?.token) return null;
    return (
      <div className="flex justify-center mt-4">
        <div className="text-center space-y-2">
          <button
            onClick={() => (window.location.href = "/demo")}
            className="px-4 py-2 text-base bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 shadow transition font-semibold"
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
            // MODIFICADO: Botón alternativo con colores temáticos y mayor redondez
            className="px-4 py-2 text-base border border-primary text-primary bg-background rounded-full hover:bg-primary/5 dark:hover:bg-primary/20 transition font-semibold"
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
          className="flex-shrink-0 w-10 h-10 rounded-full bg-card dark:bg-blue-950 flex items-center justify-center border border-border dark:border-blue-900 shadow-md"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
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
          px-4 py-2 shadow-lg
          text-base leading-snug
          ${isBot
            // MODIFICADO: Degradados más suaves y redondez para bot
            ? "bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 text-blue-900 border border-blue-200 rounded-3xl rounded-bl-none dark:from-blue-900 dark:via-blue-950 dark:to-blue-900 dark:text-blue-100 dark:border-blue-800"
            // MODIFICADO: Degradados más vivos y redondez para usuario, con texto blanco
            : "bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-3xl rounded-br-none border border-blue-700 font-semibold dark:from-blue-700 dark:to-blue-900 dark:text-white dark:border-blue-900"
          }
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
        <div className={`text-xs mt-1 opacity-60 text-right select-none tracking-tight font-normal ${isBot ? "text-blue-700 dark:text-blue-200" : "text-white dark:text-gray-200"}`}>
          {typeof message.timestamp === "string"
            ? message.timestamp
            : new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </motion.div>

      {/* User avatar */}
      {!isBot && (
        <UserAvatar />
      )}
    </div>
  );
};

export default ChatMessage;