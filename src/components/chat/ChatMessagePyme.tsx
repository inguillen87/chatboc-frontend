// src/components/chat/ChatMessagePyme.tsx
import React from "react";
import { Message } from "@/types/chat";
import ChatButtons from "./ChatButtons";
import { motion } from "framer-motion";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";
import UserAvatarAnimated from "./UserAvatarAnimated";
import sanitizeMessageHtml from "@/utils/sanitizeMessageHtml";
import ProductCard from "@/components/product/ProductCard";
import { parseProductMessage, filterProducts } from "@/utils/productParser";
import { getCurrentTipoChat } from "@/utils/tipoChat";
import AttachmentPreview from "./AttachmentPreview";
import { getAttachmentInfo } from "@/utils/attachment";
import TypewriterText from "./TypewriterText";
import MessageBubble from "./MessageBubble";

// --- Avatares reutilizados ---
const AvatarBot: React.FC<{ isTyping: boolean }> = ({ isTyping }) => (
  <motion.div
    initial={{ scale: 0.8, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
    className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-[#245ca6] rounded-full shadow"
  >
    <ChatbocLogoAnimated
      size={24}
      smiling={isTyping}
      movingEyes={isTyping}
      blinking
      pulsing
    />
  </motion.div>
);

const UserAvatar = () => (
  <motion.span
    className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center border border-border shadow-md dark:border-blue-700"
    initial={{ scale: 0.8, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ type: "spring", stiffness: 200, damping: 20 }}
  >
    <UserAvatarAnimated size={24} talking={false} />
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

const ChatMessagePyme = React.forwardRef<HTMLDivElement, ChatMessageProps>( (
  {
    message,
    isTyping,
    onButtonClick,
    onInternalAction,
    tipoChat,
    query,
  },
  ref
) => {
  if (!message || typeof message.text !== "string") {
    return (
      <div className="text-xs text-destructive italic mt-2 px-3">
        ❌ Mensaje inválido o malformado.
      </div>
    );
  }


  // Evitar mostrar 'NaN' o valores falsos
  const safeText = message.text === "NaN" || message.text == null ? "" : message.text;
  // Limpiamos HTML sin cortar el texto
  const sanitizedHtml = sanitizeMessageHtml(safeText);
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
    ? "bg-[#192745] text-blue-100"
    : "bg-gradient-to-br from-blue-600 to-blue-800 text-white";
  const bubbleWidth = filteredProducts ? "max-w-[480px]" : "max-w-[95vw] md:max-w-2xl";

  return (
    <div
      ref={ref}
      className={`flex w-full ${isBot ? "justify-start" : "justify-end"} mb-2`}
    >
      <div className={`flex items-end gap-2 ${isBot ? "" : "flex-row-reverse"}`}>
        {isBot && <AvatarBot isTyping={isTyping} />}

        <MessageBubble className={`${bubbleWidth} ${bubbleClass}`}>        
          {filteredProducts ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredProducts.map((p, idx) => (
                <ProductCard key={idx} product={p} />
              ))}
            </div>
          ) : attachment ? (
            <AttachmentPreview attachment={attachment} />
          ) : (
            isBot ? (
              <TypewriterText
                html={sanitizedHtml}
                className="prose dark:prose-invert max-w-none text-sm [&_p]:my-0"
              />
            ) : (
              <span
                className="prose dark:prose-invert max-w-none text-sm [&_p]:my-0"
                dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
              />
            )
          )}
          {isBot && message.botones && message.botones.length > 0 && (
            <ChatButtons
              botones={message.botones}
              onButtonClick={onButtonClick}
              onInternalAction={onInternalAction}
            />
          )}
        </MessageBubble>

        {!isBot && <UserAvatar />}
      </div>
    </div>
  );
});

export default ChatMessagePyme;
