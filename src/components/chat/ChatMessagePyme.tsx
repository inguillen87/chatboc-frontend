// src/components/chat/ChatMessagePyme.tsx
import React from "react";
import { Message } from "@/types/chat";
import ChatButtons from "./ChatButtons";
import { motion } from "framer-motion";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";
import DOMPurify from "dompurify";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import ProductCard from "@/components/product/ProductCard";
import { parseProductMessage } from "@/utils/productParser";
import { getCurrentTipoChat } from "@/utils/tipoChat";

// --- Avatares reutilizados ---
const AvatarBot: React.FC<{ isTyping: boolean }> = ({ isTyping }) => (
  <motion.div
    initial={{ scale: 0.8, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
    className={`flex-shrink-0 w-10 h-10 rounded-full bg-card flex items-center justify-center border-2 transition-all duration-200 ease-in-out ${
      isTyping
        ? "border-blue-500 shadow-lg shadow-blue-500/40 scale-105"
        : "border-border shadow-sm"
    }`}
  >
    <ChatbocLogoAnimated size={36} smiling={isTyping} movingEyes={isTyping} />
  </motion.div>
);

const UserAvatar = () => (
  <motion.span
    className="flex-shrink-0 w-9 h-9 rounded-full bg-secondary flex items-center justify-center border border-border shadow-md dark:border-blue-700"
    initial={{ scale: 0.8, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ type: "spring", stiffness: 200, damping: 20 }}
  >
    <span className="text-2xl font-bold text-primary dark:text-blue-100">
      🧑‍💼
    </span>
  </motion.span>
);

// --- CTA flotante (solo demo/usuarios sin loguear) ---
const CallToActionMessage = () => {
  const user =
    typeof window !== "undefined"
      ? JSON.parse(safeLocalStorage.getItem("user") || "null")
      : null;
  if (user?.token) return null;

  return (
    <div className="flex justify-center my-4">
      <div className="text-center space-y-3 p-4 bg-muted/50 rounded-2xl">
        <button
          onClick={() => (window.location.href = "/demo")}
          className="w-full px-4 py-2 text-base bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 shadow transition font-semibold"
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
          className="w-full px-4 py-2 text-base border border-primary text-primary bg-background rounded-full hover:bg-primary/5 dark:hover:bg-primary/20 transition font-semibold"
        >
          Hablar por WhatsApp
        </button>
      </div>
    </div>
  );
};

interface ChatMessageProps {
  message: Message;
  isTyping: boolean;
  onButtonClick: (valueToSend: string) => void;
  tipoChat?: "pyme" | "municipio";
}

const ChatMessagePyme: React.FC<ChatMessageProps> = ({
  message,
  isTyping,
  onButtonClick,
  tipoChat,
}) => {
  if (!message || typeof message.text !== "string") {
    return (
      <div className="text-xs text-destructive italic mt-2 px-3">
        ❌ Mensaje inválido o malformado.
      </div>
    );
  }

  // CTA flotante (cuando es demo)
  if (message.text === "__cta__") {
    return <CallToActionMessage />;
  }

  // Limpiamos HTML
  const sanitizedHtml = DOMPurify.sanitize(message.text);
  const shouldParseProducts = (tipoChat || getCurrentTipoChat()) === "pyme";
  const parsedProducts = shouldParseProducts
    ? parseProductMessage(message.text)
    : null;

  const isBot = message.isBot;
  const bubbleClass = isBot
    ? "bg-muted text-foreground rounded-b-2xl rounded-tr-2xl dark:bg-[#232e40] shadow-lg shadow-blue-900/5"
    : "bg-primary text-primary-foreground rounded-b-2xl rounded-tl-2xl dark:bg-blue-700/90 shadow-md shadow-blue-500/10";

  return (
    <div
      className={`flex items-end gap-2.5 ${
        isBot ? "justify-start" : "justify-end"
      }`}
    >
      {isBot && <AvatarBot isTyping={isTyping} />}

      <div className="flex flex-col">
        <motion.div
          className={`px-4 py-3 max-w-[320px] relative break-words ${bubbleClass}`}
          variants={{
            hidden: { opacity: 0, y: 14, scale: 0.97 },
            visible: { opacity: 1, y: 0, scale: 1 },
          }}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          {parsedProducts ? (
            <div className="grid gap-2">
              {parsedProducts.map((p, idx) => (
                <ProductCard key={idx} product={p} />
              ))}
            </div>
          ) : (
            <div
              className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-0"
              dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
            />
          )}
        </motion.div>

        {isBot && message.botones && message.botones.length > 0 && (
          <ChatButtons
            botones={message.botones}
            onButtonClick={onButtonClick}
          />
        )}
      </div>

      {!isBot && <UserAvatar />}
    </div>
  );
};

export default ChatMessagePyme;
