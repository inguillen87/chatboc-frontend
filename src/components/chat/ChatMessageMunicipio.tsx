// src/components/chat/ChatMessageMunicipio.tsx
import React from "react";
import { Message, SendPayload } from "@/types/chat"; // Importa SendPayload
import ChatButtons from "./ChatButtons";
import { motion } from "framer-motion";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";
import UserAvatarAnimated from "./UserAvatarAnimated";
import sanitizeMessageHtml from "@/utils/sanitizeMessageHtml";
import AttachmentPreview from "./AttachmentPreview";
import MessageBubble from "./MessageBubble";
import { getAttachmentInfo, AttachmentInfo } from "@/utils/attachment"; // Importar getAttachmentInfo y AttachmentInfo


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
  onButtonClick: (valueToSend: SendPayload) => void; // <-- MODIFICADO: Acepta SendPayload
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
    query: _query, // not used but kept for prop consistency
  },
  ref
) => {
  // Seguridad ante mensajes rotos
  if (!message || typeof message.text !== "string") {
    return (
      <div className="text-xs text-destructive italic mt-2 px-3">
        ❌ Mensaje inválido o malformado.
      </div>
    );
  }

  // Evitar mostrar "NaN" o valores falsos
  const safeText = message.text === "NaN" || message.text == null ? "" : message.text;
  // Limpiamos HTML sin cortar el texto
  const sanitizedHtml = sanitizeMessageHtml(safeText);

  const isBot = message.isBot;

  const bubbleClass = isBot
    ? "bg-[#192745] text-blue-100"
    : "bg-gradient-to-br from-blue-600 to-blue-800 text-white";

  let attachmentForPreviewObj: AttachmentInfo | undefined = undefined;
  let showAttachmentComponent = false;

  if (message.attachmentInfo && message.attachmentInfo.url && message.attachmentInfo.name) {
    const ext = message.attachmentInfo.name.split('.').pop()?.toLowerCase() ||
                (message.attachmentInfo.mimeType ? message.attachmentInfo.mimeType.split('/')[1] : '') ||
                '';

    let type: AttachmentInfo['type'] = 'other';
    // TODO: Centralizar esta lógica de determinación de tipo en utils/attachment.ts
    // y hacerla más robusta (usar mimeType primero).
    if (message.attachmentInfo.mimeType?.startsWith('image/')) {
        type = 'image';
    } else if (message.attachmentInfo.mimeType === 'application/pdf' || ext === 'pdf') {
        type = 'pdf';
    } else if (message.attachmentInfo.mimeType?.includes('spreadsheet') ||
               message.attachmentInfo.mimeType?.includes('csv') ||
               ['xls', 'xlsx', 'csv'].includes(ext) ) {
        type = 'spreadsheet';
    }
    // Aquí se podrían añadir más tipos (docx, etc.)

    attachmentForPreviewObj = {
      url: message.attachmentInfo.url,
      name: message.attachmentInfo.name,
      extension: ext,
      type: type,
    };
    showAttachmentComponent = true;
  } else if (message.mediaUrl) {
    const parsedFromMediaUrl = getAttachmentInfo(message.mediaUrl);
    if(parsedFromMediaUrl){
        attachmentForPreviewObj = parsedFromMediaUrl;
        showAttachmentComponent = true;
    }
  } else if (message.locationData) {
    showAttachmentComponent = true; // AttachmentPreview maneja locationData internamente
  }

  return (
    <div
      ref={ref}
      className={`flex w-full ${isBot ? "justify-start" : "justify-end"} mb-2`}
    >
      <div className={`flex items-end gap-2 ${isBot ? "" : "flex-row-reverse"}`}>
        {isBot && <AvatarBot isTyping={isTyping} />}

        <MessageBubble className={`max-w-[95vw] md:max-w-2xl ${bubbleClass}`}>
          {showAttachmentComponent ? (
            <AttachmentPreview
                attachment={attachmentForPreviewObj}
                locationData={message.locationData}
                // No es necesario pasar mediaUrl si attachmentForPreviewObj ya lo contiene.
                // fallbackText se usa si attachmentForPreviewObj es solo para location y no hay texto que mostrar.
                fallbackText={(!attachmentForPreviewObj || (attachmentForPreviewObj && !attachmentForPreviewObj.url)) && message.locationData ? "" : safeText}
            />
          ) : (
            <span
              className="prose dark:prose-invert max-w-none text-sm [&_p]:my-0"
              dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
            />
          )}
          {isBot && message.botones && message.botones.length > 0 && (
            <ChatButtons
              botones={message.botones}
              onButtonClick={onButtonClick} // Pasa el onButtonClick modificado
              onInternalAction={onInternalAction}
            />
          )}
        </MessageBubble>

        {!isBot && <UserAvatar />}
      </div>
    </div>
  );
});

export default ChatMessageMunicipio;