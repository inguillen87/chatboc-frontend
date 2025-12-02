// src/components/chat/ChatMessageMunicipio.tsx
import React from "react";
import { Message, SendPayload } from "@/types/chat";
import ChatButtons from "./ChatButtons";
import { motion } from "framer-motion";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";
// import UserAvatarAnimated from "./UserAvatarAnimated"; // No se usa directamente
import sanitizeMessageHtml from "@/utils/sanitizeMessageHtml";
import AttachmentPreview from "./AttachmentPreview";
import MessageBubble from "./MessageBubble";
import { deriveAttachmentInfo, AttachmentInfo } from "@/utils/attachment";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useUser } from "@/hooks/useUser";
import { User as UserIcon } from "lucide-react";
import { getInitials } from "@/lib/utils";
import { useDateSettings } from "@/hooks/useDateSettings";

const messageVariants = {
  initial: (isBot: boolean) => ({
    opacity: 0,
    x: isBot ? -40 : 40,
    scale: 0.95,
  }),
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 260, damping: 22, duration: 0.25 },
  },
  exit: (isBot: boolean) => ({
    opacity: 0,
    x: isBot ? -20 : 20,
    scale: 0.98,
    transition: { duration: 0.15, ease: "easeIn" },
  }),
};

const AvatarBot: React.FC<{ isTyping: boolean }> = ({ isTyping }) => (
  <motion.div
    initial={{ scale: 0.8, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
    className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-muted rounded-full shadow"
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

// --- UserAvatar modificado ---
const UserChatAvatar: React.FC = () => {
  const { user } = useUser();
  const initials = getInitials(user?.name);

  return (
    <motion.div
      className="flex-shrink-0 shadow-md"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
    >
      <Avatar className="w-8 h-8 border">
        <AvatarImage
          src={user?.picture || "/favicon/human-avatar.svg"}
          alt={user?.name || "Avatar de usuario"}
        />
        <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
          {initials ? (
            initials
          ) : (
            <UserIcon size={16} />
          )}
        </AvatarFallback>
      </Avatar>
    </motion.div>
  );
};

interface ChatMessageProps {
  message: Message;
  isTyping: boolean;
  onButtonClick: (valueToSend: SendPayload) => void;
  onInternalAction?: (action: string) => void;
  tipoChat?: "pyme" | "municipio"; 
  query?: string;
}

const ChatMessageMunicipio = React.forwardRef<HTMLDivElement, ChatMessageProps>( (
  {
    message,
    isTyping,
    onButtonClick,
    onInternalAction,
    // query: _query, 
  },
  ref
) => {
  if (!message) {
    return (
      <motion.div className="text-xs text-destructive italic mt-2 px-3" ref={ref}>
        ❌ Mensaje inválido.
      </motion.div>
    );
  }
  
  const isBot = message.isBot; // Define isBot here

  const safeText = typeof message.text === "string" && message.text !== "NaN" ? message.text : "";
  const sanitizedHtml = sanitizeMessageHtml(safeText);
  const { timezone, locale } = useDateSettings();

  const bubbleClass = isBot
    ? "bg-muted text-muted-foreground" // Bot's bubble color
    : "bg-primary text-primary-foreground"; // User's bubble color
  const bubbleWidth = "max-w-[85%] sm:max-w-[75%] md:max-w-[70%]"; // Responsive max-width for bubbles
  const bubbleAlignment = isBot ? "mr-auto" : "ml-auto"; // Aligns the entire message group (avatar + bubble)

  let processedAttachmentInfo: AttachmentInfo | null = null;

  if (message.attachmentInfo && message.attachmentInfo.url && message.attachmentInfo.name && message.attachmentInfo.mimeType) {
    processedAttachmentInfo = deriveAttachmentInfo(
      message.attachmentInfo.url,
      message.attachmentInfo.name,
      message.attachmentInfo.mimeType,
      message.attachmentInfo.size,
      message.attachmentInfo.thumbUrl ||
        message.attachmentInfo.thumb_url ||
        message.attachmentInfo.thumbnail_url ||
        message.attachmentInfo.thumbnailUrl
    );
  } else if (message.mediaUrl && isBot) {
    processedAttachmentInfo = deriveAttachmentInfo(message.mediaUrl, message.mediaUrl.split('/').pop() || "archivo_adjunto");
  }

  const showAttachment = !!(
    (processedAttachmentInfo && (processedAttachmentInfo.type !== 'other' || !!processedAttachmentInfo.extension)) ||
    message.locationData
  );

  return (
    <motion.div
      ref={ref}
      className={`flex w-full ${isBot ? "justify-start" : "justify-end"} mb-3`}
      custom={isBot}
      variants={messageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      layout
    >
      <div className={`flex items-end gap-2 ${bubbleAlignment} ${bubbleWidth}`}>
        {isBot && <AvatarBot isTyping={isTyping} />}

        <MessageBubble className={`${bubbleClass}`} isBot={isBot}> {/* Pass isBot to MessageBubble */}
          {showAttachment ? (
            <AttachmentPreview
                attachment={processedAttachmentInfo || undefined}
                locationData={message.locationData}
                fallbackText={!processedAttachmentInfo && !message.locationData ? sanitizedHtml : undefined}
            />
          ) : (
            sanitizedHtml && (
              <span
                className="prose dark:prose-invert max-w-none text-sm font-medium leading-relaxed [&_p]:my-1 [&_a]:text-primary [&_a:hover]:underline"
                dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
              />
            )
          )}
          {message.timestamp && (
            <div
              className={`text-xs mt-1.5 ${isBot ? 'text-muted-foreground/80' : 'text-primary-foreground/70'} ${
                isBot ? 'text-left' : 'text-right'
              }`}
            >
              {new Date(message.timestamp).toLocaleTimeString(locale, {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
                timeZone: timezone,
              })}
            </div>
          )}
          {isBot && message.botones && message.botones.length > 0 && (
            <ChatButtons
              botones={message.botones}
              onButtonClick={onButtonClick}
              onInternalAction={onInternalAction}
              className="mt-2" // Add margin to buttons if text and timestamp are present
            />
          )}
        </MessageBubble>

        {!isBot && <UserChatAvatar />}
      </div>
    </motion.div>
  );
});

export default ChatMessageMunicipio;