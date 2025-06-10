import React from "react";
import { Message } from "@/types/chat";
import { motion } from "framer-motion";
import ChatButtons from "./ChatButtons"; // Importamos el nuevo componente

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
            className="px-4 py-2 text-base border border-primary text-primary bg-background rounded-full hover:bg-primary/5 dark:hover:bg-primary/20 transition font-semibold"
          >
            Hablar por WhatsApp
          </button>
        </div>
      </div>
    );
  }

  const isBot = message.isBot;
  const bubbleVariants = {
    hidden: { opacity: 0, y: 10, scale: 0.98 },
    visible: { opacity: 1, y: 0, scale: 1 },
  };

  return (
    <div
      className={`flex items-end gap-2.5 ${isBot ? "justify-start" : "justify-end"}`}
    >
      {isBot && (
        <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
            className="flex-shrink-0 w-10 h-10 rounded-full bg-card flex items-center justify-center border border-border shadow-sm"
        >
          <img src={LOGO_BOT} alt="Chatboc" className="w-7 h-7" />
        </motion.div>
      )}

      <div className="flex flex-col">
        <motion.div
          className={`px-4 py-3 max-w-[320px] shadow-md ${
            isBot
              ? "bg-muted text-foreground rounded-r-2xl rounded-tl-2xl"
              : "bg-primary text-primary-foreground rounded-l-2xl rounded-tr-2xl"
          }`}
          variants={bubbleVariants}
          transition={{ duration: 0.3, ease: "easeOut" }}
          initial="hidden"
          animate="visible"
        >
          <div
            className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-0"
            dangerouslySetInnerHTML={{ __html: message.text }}
          />
        </motion.div>

        {/* --- LÓGICA PARA MOSTRAR BOTONES DINÁMICOS --- */}
        {message.isBot && message.botones && message.botones.length > 0 && (
          <ChatButtons botones={message.botones} />
        )}
      </div>

      {!isBot && <UserAvatar />}
    </div>
  );
};

export default ChatMessage;