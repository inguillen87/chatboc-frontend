// src/components/chat/ChatMessagePyme.tsx
import React from "react";
import { Message } from "@/types/chat";
import ChatButtons from "./ChatButtons";
import { motion } from "framer-motion";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";
import DOMPurify from "dompurify";
import ProductCard from "@/components/product/ProductCard";
import { parseProductMessage, filterProducts } from "@/utils/productParser";
import { getCurrentTipoChat } from "@/utils/tipoChat";
import AttachmentPreview from "./AttachmentPreview";
import { getAttachmentInfo } from "@/utils/attachment";
import TypewriterText from "./TypewriterText";
import { truncateText } from "@/utils/truncateText";

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
    <ChatbocLogoAnimated
      size={36}
      smiling={isTyping}
      movingEyes={isTyping}
      blinking
      pulsing
    />
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


interface ChatMessageProps {
  message: Message;
  isTyping: boolean;
  onButtonClick: (valueToSend: string) => void;
  onInternalAction?: (action: string) => void;
  tipoChat?: "pyme" | "municipio";
  query?: string;
}

const ChatMessagePyme: React.FC<ChatMessageProps> = ({
  message,
  isTyping,
  onButtonClick,
  onInternalAction,
  tipoChat,
  query,
}) => {
  if (!message || typeof message.text !== "string") {
    return (
      <div className="text-xs text-destructive italic mt-2 px-3">
        ❌ Mensaje inválido o malformado.
      </div>
    );
  }


  // Evitar mostrar 'NaN' o valores falsos
  const safeText = message.text === "NaN" || message.text == null ? "" : message.text;
  // Limpiamos HTML y limitamos la longitud solo si es muy largo
  const sanitizedHtml = DOMPurify.sanitize(truncateText(safeText, 600));
  const shouldParseProducts = (tipoChat || getCurrentTipoChat()) === "pyme";
  const parsedProducts =
    shouldParseProducts && message.isBot
      ? parseProductMessage(message.text)
      : null;
  const filteredProducts =
    parsedProducts && query
      ? filterProducts(parsedProducts, query)
      : parsedProducts;
  const attachment = getAttachmentInfo(message.text);

  const isBot = message.isBot;
  const bubbleClass = isBot
    ? "bg-[#172137] text-blue-100 border border-[#1d375a] rounded-[1.2em] shadow-md"
    : "bg-gradient-to-tr from-blue-500 to-blue-700 text-white border border-blue-300 rounded-[1.2em] shadow-md";
  const bubbleWidth = filteredProducts ? "max-w-[480px]" : "max-w-[77vw] md:max-w-[420px]";

  return (
    <div className={`flex w-full ${isBot ? "justify-start" : "justify-end"} mb-2`}>
      <div className={`flex items-end gap-2 ${isBot ? "" : "flex-row-reverse"}`}>
        {isBot && <AvatarBot isTyping={isTyping} />}

        <div className="flex flex-col">
          <motion.div
            className={`px-4 py-2 ${bubbleWidth} relative break-words ${bubbleClass}`}
            style={{ fontWeight: 500, lineHeight: 1.4, wordBreak: 'break-word', whiteSpace: 'pre-line' }}
          variants={{
            hidden: { opacity: 0, y: 14, scale: 0.97 },
            visible: { opacity: 1, y: 0, scale: [1, 1.03, 1] },
          }}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          {filteredProducts ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredProducts.map((p, idx) => (
                <ProductCard key={idx} product={p} />
              ))}
            </div>
          ) : attachment ? (
            <AttachmentPreview attachment={attachment} />
          ) : (
            <div className="prose dark:prose-invert max-w-none text-sm [&_p]:my-0">
              {isBot ? (
                <TypewriterText html={sanitizedHtml} />
              ) : (
                <span dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
              )}
            </div>
          )}
        </motion.div>

        {isBot && message.botones && message.botones.length > 0 && (
          <ChatButtons
            botones={message.botones}
            onButtonClick={onButtonClick}
            onInternalAction={onInternalAction}
          />
        )}
      </div>

      {!isBot && <UserAvatar />}
    </div>
  </div>
  );
};

export default ChatMessagePyme;
