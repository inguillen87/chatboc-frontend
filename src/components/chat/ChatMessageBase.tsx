// src/components/chat/ChatMessageBase.tsx
import React, { useState, useMemo } from "react";
import { Message, SendPayload, StructuredContentItem } from "@/types/chat";
import ChatButtons from "./ChatButtons";
import CategorizedButtons from "./CategorizedButtons";
import AudioPlayer from "./AudioPlayer";
import { motion } from "framer-motion";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";
import sanitizeMessageHtml from "@/utils/sanitizeMessageHtml";
import { simplify } from "@/lib/simplify";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import AttachmentPreview from "./AttachmentPreview";
import { deriveAttachmentInfo, AttachmentInfo } from "@/utils/attachment";
import MessageBubble from "./MessageBubble";
import EventCard from './EventCard';
import SocialLinks from './SocialLinks';

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useUser } from "@/hooks/useUser";
import { User as UserIcon, ExternalLink } from "lucide-react";
import { getInitials, cn } from "@/lib/utils";
import UserAvatarAnimated from "./UserAvatarAnimated";
import { Badge } from "@/components/ui/badge";

type RawAttachment = { url: string; name: string; mimeType?: string; size?: number; thumbUrl?: string };

function normalizeAttachment(msg: any): RawAttachment | null {
  if (msg?.attachmentInfo && msg.attachmentInfo.url && msg.attachmentInfo.name) {
    return msg.attachmentInfo;
  }
  if (Array.isArray(msg?.attachments) && msg.attachments.length > 0) {
    const first = msg.attachments[0];
    if (first?.url && (first?.name || first?.filename)) {
      return {
        url: first.url,
        name: first.name || first.filename,
        mimeType: first.mimeType || first.mime_type,
        size: first.size,
        thumbUrl: first.thumbUrl || first.thumb_url,
      };
    }
  }
  return null;
}

// --- Avatares (reutilizados de ChatMessagePyme/Municipio) ---
const AvatarBot: React.FC<{ isTyping: boolean; logoUrl?: string; logoAnimation?: string }> = ({
  isTyping,
  logoUrl,
  logoAnimation,
}) => (
  <motion.div
    initial={{ scale: 0.8, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
    className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-muted rounded-full shadow"
  >
    {logoUrl ? (
      <img
        src={logoUrl}
        alt="Bot"
        className="w-6 h-6 rounded-full"
        style={{ animation: logoAnimation || undefined }}
      />
    ) : (
      <ChatbocLogoAnimated
        size={24}
        smiling={isTyping}
        movingEyes={isTyping}
        blinking
        pulsing
      />
    )}
  </motion.div>
);

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
      {user?.picture ? (
        <Avatar className="w-8 h-8 border">
          <AvatarImage src={user.picture} alt={user.name || "Avatar de usuario"} />
          <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
            {initials ? initials : <UserIcon size={16} />}
          </AvatarFallback>
        </Avatar>
      ) : (
        <UserAvatarAnimated size={32} blinking smiling />
      )}
    </motion.div>
  );
};

// --- Componente para renderizar StructuredContent ---
const StructuredContentDisplay: React.FC<{ items: StructuredContentItem[] }> = ({ items }) => {
  if (!items || items.length === 0) return null;

  return (
    <div className="mt-2 pt-2 border-t border-white/20 space-y-1.5">
      {items.map((item, index) => {
        let valueDisplay: React.ReactNode = item.value;
        const valueClasses: string[] = ["text-sm"];

        if (item.styleHint === 'bold') valueClasses.push("font-bold");
        if (item.styleHint === 'italic') valueClasses.push("italic");
        if (item.styleHint === 'highlight') valueClasses.push("bg-yellow-200 text-yellow-800 px-1 rounded");


        if (item.type === 'price' && typeof item.value === 'number') {
          valueDisplay = item.value.toLocaleString('es-AR', {
            style: 'currency',
            currency: item.currency || 'ARS',
          });
          valueClasses.push("font-semibold text-green-300"); // Ejemplo de estilo para precio
        } else if (item.type === 'quantity' && typeof item.value === 'number') {
          valueDisplay = `${item.value} ${item.unit || ''}`.trim();
          valueClasses.push("font-medium text-blue-300"); // Ejemplo de estilo para cantidad
        } else if (item.type === 'date' && typeof item.value === 'string') {
            try {
                valueDisplay = new Date(item.value).toLocaleDateString('es-AR', {
                    day: '2-digit', month: '2-digit', year: 'numeric'
                });
            } catch (e) { /* usa valor original si la fecha es inválida */ }
        } else if (item.type === 'url' || item.url) {
            valueDisplay = (
                <a
                    href={item.url || (typeof item.value === 'string' ? item.value : '#')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline inline-flex items-center gap-1"
                >
                    {typeof item.value === 'string' ? item.value : 'Enlace'} <ExternalLink size={12} />
                </a>
            );
        }

        return (
          <div key={index} className="grid grid-cols-3 gap-1 items-center">
            <span className="text-xs col-span-1 text-white/70">{item.label}:</span>
            <span className={cn("col-span-2", ...valueClasses)}>
              {valueDisplay}
            </span>
          </div>
        );
      })}
    </div>
  );
};


export interface ChatMessageBaseProps {
  message: Message;
  isTyping: boolean;
  onButtonClick: (valueToSend: SendPayload) => void;
  onInternalAction?: (action: string) => void;
  tipoChat?: "pyme" | "municipio"; // Puede usarse para alguna lógica residual muy específica
  botLogoUrl?: string;
  logoAnimation?: string;
}

const ChatMessageBase = React.forwardRef<HTMLDivElement, ChatMessageBaseProps>( (
  {
    message,
    isTyping,
    onButtonClick,
    onInternalAction,
    botLogoUrl,
    logoAnimation,
    // tipoChat, // tipoChat podría usarse si hay alguna variación mínima que no dependa del contenido del mensaje
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

  const isBot = message.isBot;

  const safeText = typeof message.text === "string" && message.text !== "NaN" ? message.text : "";
  const sanitizedHtml = sanitizeMessageHtml(safeText);
  const plainText = useMemo(() => safeText.replace(/<[^>]+>/g, ""), [safeText]);
  const simplified = useMemo(() => simplify(plainText), [plainText]);
  const [simple, setSimple] = useState<boolean>(() => {
    try {
      const p = JSON.parse(safeLocalStorage.getItem("chatboc_accessibility") || "{}");
      return !!p?.simplified;
    } catch {
      return true;
    }
  });

  const renderText = simple ? (
    <pre className="whitespace-pre-wrap text-justify max-w-none text-sm mb-2 chat-message">{simplified}</pre>
  ) : (
    <div
      className="whitespace-pre-wrap text-justify max-w-none text-sm [&_p]:my-0 mb-2 chat-message"
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );

  const textBlock = sanitizedHtml
    ? isBot
      ? (
          <>
            {renderText}
            <div className="mt-1 text-[12px] flex gap-2">
              <button className="underline" onClick={() => setSimple((s) => !s)}>
                {simple ? "Ver completo" : "Ver simple"}
              </button>
            </div>
          </>
        )
      : (
          renderText
        )
    : null;

  const listBlock = message.listItems && message.listItems.length > 0 ? (
    <ul className="mt-2 list-disc pl-4 space-y-1">
      {message.listItems.map((item, idx) => (
        <li key={idx}>
          <span
            dangerouslySetInnerHTML={{ __html: sanitizeMessageHtml(item) }}
          />
        </li>
      ))}
    </ul>
  ) : null;

  const textAndListBlock =
    (sanitizedHtml || listBlock) ? (
      <>
        {sanitizedHtml && textBlock}
        {listBlock}
      </>
    ) : null;

  let processedAttachmentInfo: AttachmentInfo | null = null;

  const normalized = normalizeAttachment(message);
  if (normalized) {
    processedAttachmentInfo = deriveAttachmentInfo(
      normalized.url,
      normalized.name,
      normalized.mimeType,
      normalized.size,
      normalized.thumbUrl
    );
  } else if (message.mediaUrl && isBot) {
    // Esto es para mediaUrl en mensajes de bot, no relevante para adjuntos de usuario ahora mismo
    processedAttachmentInfo = deriveAttachmentInfo(message.mediaUrl, message.mediaUrl.split('/').pop() || "archivo_adjunto");
  }

  const bubbleBaseClass = isBot ? "chat-bubble-bot" : "chat-bubble-user";
  let bubbleStyleClass = "";
  if (message.chatBubbleStyle === 'compact') {
    bubbleStyleClass = "py-1.5 px-2.5 text-sm"; // Estilo más compacto
  } else if (message.chatBubbleStyle === 'emphasis') {
    bubbleStyleClass = "border-2 border-yellow-500"; // Estilo con énfasis
  }

  // Determinar si se muestra la sección de adjuntos/mapa o el contenido estructurado
  const showAttachmentOrMap = !!(
    (processedAttachmentInfo && (processedAttachmentInfo.type !== 'other' || !!processedAttachmentInfo.extension)) ||
    message.locationData
  );

  const showStructuredContent = !!(message.structuredContent && message.structuredContent.length > 0);
  const showPosts = !!(message.posts && message.posts.length > 0);
  const showSocialLinks = message.socialLinks && Object.keys(message.socialLinks).length > 0;
  const now = new Date();
  const postsToShow = showPosts
    ? message.posts!
        .filter((post) => {
          if (post.tipo_post === 'evento') {
            const end = post.fecha_evento_fin
              ? new Date(post.fecha_evento_fin)
              : post.fecha_evento_inicio
                ? new Date(post.fecha_evento_inicio)
                : null;
            return !end || end >= now;
          }
          return true;
        })
        .sort((a, b) => {
          const aTime = new Date(a.fecha_evento_inicio || a.fecha_evento_fin || 0).getTime();
          const bTime = new Date(b.fecha_evento_inicio || b.fecha_evento_fin || 0).getTime();
          return aTime - bTime;
        })
        .slice(0, 6)
    : [];

  // Display hint puede usarse para aplicar un contenedor especial alrededor del mensaje, o pasar a MessageBubble
  // Por ahora, lo mantendremos simple.

  return (
    <motion.div
      ref={ref}
      className={`flex w-full ${isBot ? "justify-start" : "justify-end"} mb-2`}
      // layout // Podría causar problemas con scroll, evaluar
    >
      <div className={`flex items-end gap-2 ${isBot ? "" : "flex-row-reverse"}`}>
        {isBot && <AvatarBot isTyping={isTyping} logoUrl={botLogoUrl} logoAnimation={logoAnimation} />}

        <MessageBubble className={cn(bubbleBaseClass, bubbleStyleClass, message.isError && "bg-destructive/20 border border-destructive/50")}>
          {/* Icono de error */}
          {message.isError && (
            <div className="flex items-center gap-2 mb-2 text-destructive">
              <UserIcon size={16} className="text-destructive" />
              <span className="font-semibold">Error</span>
            </div>
          )}

          {/* Prioridad al texto si no hay otros contenidos especiales */}
          {!showAttachmentOrMap && !showStructuredContent && textAndListBlock}

          {/* Mostrar adjunto o mapa */}
          {showAttachmentOrMap && (
              <AttachmentPreview
                message={message} // Pasamos el mensaje completo para que AttachmentPreview decida
                attachmentInfo={processedAttachmentInfo}
                // Si hay adjunto pero también texto, el texto puede ser un caption o fallback
                fallbackText={sanitizedHtml && !showStructuredContent ? sanitizedHtml : undefined}
              />
          )}

          {/* Mostrar contenido estructurado */}
          {showStructuredContent && (
            <>
              {/* Si hay texto Y contenido estructurado, el texto puede ser una introducción */}
              {textAndListBlock && !showAttachmentOrMap && textAndListBlock}
              <StructuredContentDisplay items={message.structuredContent!} />
            </>
          )}

          {/* Audio Player */}
          {isBot && message.audioUrl && (
            <AudioPlayer src={message.audioUrl} />
          )}

          {/* Render Event/News Posts */}
          {postsToShow.length > 0 && (
            <div className="flex flex-col gap-3 mt-2">
              {postsToShow.map((post) => (
                <EventCard key={post.id} post={post} />
              ))}
            </div>
          )}

          {showSocialLinks && <SocialLinks links={message.socialLinks!} />}

          {/* Botones (categorized or flat) */}
          {isBot && message.categorias && message.categorias.length > 0 ? (
            <CategorizedButtons
              categorias={message.categorias}
              onButtonClick={onButtonClick}
              onInternalAction={onInternalAction}
            />
          ) : isBot && message.botones && message.botones.length > 0 ? (
            <ChatButtons
              botones={message.botones}
              onButtonClick={onButtonClick}
              onInternalAction={onInternalAction}
            />
          ) : null}
        </MessageBubble>

        {!isBot && <UserChatAvatar />}
      </div>
    </motion.div>
  );
});

ChatMessageBase.displayName = "ChatMessageBase";
export default ChatMessageBase;
