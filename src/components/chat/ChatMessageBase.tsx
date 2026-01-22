// src/components/chat/ChatMessageBase.tsx
import React, { useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Boton, Message, SendPayload, StructuredContentItem } from "@/types/chat";
import ChatButtons from "./ChatButtons";
import CategorizedButtons from "./CategorizedButtons";
import AudioPlayer from "./AudioPlayer";
import { motion } from "framer-motion";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";
import sanitizeMessageHtml from "@/utils/sanitizeMessageHtml"; // Still used for list items if they contain HTML
import { simplify } from "@/lib/simplify";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import AttachmentPreview from "./AttachmentPreview";
import { deriveAttachmentInfo, AttachmentInfo } from "@/utils/attachment";
import MessageBubble from "./MessageBubble";
import EventCard from './EventCard';
import SocialLinks from './SocialLinks';
import { useTenant } from "@/context/TenantContext";
import { buildTenantAwareUrl } from "@/utils/tenantUrls";
import openExternalLink from "@/utils/openExternalLink";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useUser } from "@/hooks/useUser";
import { User as UserIcon, ExternalLink } from "lucide-react";
import { getInitials, cn } from "@/lib/utils";
import UserAvatarAnimated from "./UserAvatarAnimated";
import InteractiveMenu from "./InteractiveMenu";
import { extractSmartHint } from "@/utils/smartHints";

type RawAttachment = {
  url: string;
  name: string;
  mimeType?: string;
  size?: number;
  thumbUrl?: string;
  thumb_url?: string;
  thumbnail_url?: string;
  thumbnailUrl?: string;
};

function normalizeAttachments(msg: any): RawAttachment[] {
  const results: RawAttachment[] = [];

  if (msg?.attachmentInfo && msg.attachmentInfo.url && msg.attachmentInfo.name) {
    const a = msg.attachmentInfo;
    results.push({
      url: a.url,
      name: a.name,
      mimeType: a.mimeType || a.mime_type,
      size: a.size,
      thumbUrl: a.thumbUrl || a.thumb_url || a.thumbnail_url || a.thumbnailUrl,
    });
  }

  const attachmentsList = msg?.attachments || msg?.adjuntos;

  if (Array.isArray(attachmentsList) && attachmentsList.length > 0) {
    attachmentsList.forEach((att: any) => {
      if (att?.url && (att?.name || att?.filename)) {
        // Avoid duplicates if attachmentInfo was already added and matches
        const isDuplicate = results.some(r => r.url === att.url);
        if (!isDuplicate) {
          results.push({
            url: att.url,
            name: att.name || att.filename,
            mimeType: att.mimeType || att.mime_type,
            size: att.size,
            thumbUrl: att.thumbUrl || att.thumb_url || att.thumbnail_url || att.thumbnailUrl,
          });
        }
      }
    });
  }
  return results;
}

// Helper to preprocess markdown (e.g. converting phone numbers to links)
const preprocessMarkdown = (text: string): string => {
  if (!text) return "";

  // Regex for phone numbers (avoiding negative lookbehind for Safari compatibility)
  // Group 1: Existing wa.me links (to skip)
  // Group 2: Full match of (boundary + phone)
  // Group 3: Boundary character (start of string or non-alphanumeric)
  // Group 4: The phone number itself
  const phonePattern = "(?:\\+?\\d{1,3}[-.\\s]?)?(?:\\(?\\d{2,4}\\)?[-.\\s]?){2,}\\d{3,4}";
  const regex = new RegExp(`(https:\\/\\/wa\\.me\\/\\S+)|((^|[^a-zA-Z0-9])(${phonePattern})(?!\\d))`, 'g');

  let processed = text.replace(regex, (match, existingLink, fullGroup2, boundary, rawNumber) => {
     if (existingLink) return match;

     // Validation/Cleanup
     const sanitizedNumber = rawNumber.replace(/[^\d]/g, '');
     if (sanitizedNumber.length < 9) return match;

     const hadPlus = rawNumber.includes('+');
     let fullNumber = sanitizedNumber;
     if (!hadPlus) fullNumber = `54${sanitizedNumber}`;

     const prefix = boundary || "";
     return `${prefix}[${rawNumber}](https://wa.me/${fullNumber})`;
  });

  return processed;
};

const FALLBACK_URL_BASE = "https://chatboc.local";

const normaliseUrlForKey = (url: string) => {
  try {
    const parsed = new URL(url, url.startsWith("http") ? undefined : FALLBACK_URL_BASE);
    return parsed.href.replace(/\/+$/, "").toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
};

const stableSerialize = (value: unknown): string => {
  const cache = new WeakSet<object>();

  const normalise = (input: unknown): unknown => {
    if (input === null) return null;
    if (typeof input === "bigint") return input.toString();
    if (typeof input !== "object") return input;

    if (cache.has(input as object)) {
      return "[Circular]";
    }

    cache.add(input as object);

    if (Array.isArray(input)) {
      const arr = input.map((item) => normalise(item));
      cache.delete(input as object);
      return arr;
    }

    if (input instanceof Date) {
      cache.delete(input as object);
      return input.toISOString();
    }

    if (typeof (input as { toJSON?: () => unknown }).toJSON === "function") {
      try {
        const jsonValue = (input as { toJSON: () => unknown }).toJSON();
        cache.delete(input as object);
        return normalise(jsonValue);
      } catch {
        cache.delete(input as object);
        return "[Invalid toJSON]";
      }
    }

    const sortedKeys = Object.keys(input as Record<string, unknown>).sort();
    const normalisedEntries: Record<string, unknown> = {};

    sortedKeys.forEach((key) => {
      normalisedEntries[key] = normalise((input as Record<string, unknown>)[key]);
    });

    cache.delete(input as object);

    return normalisedEntries;
  };

  try {
    return JSON.stringify(normalise(value));
  } catch {
    return String(value);
  }
};


const buttonKey = (button: Boton): string => {
  const keyParts: string[] = [];

  if (typeof button.action === "string" && button.action.trim()) {
    keyParts.push(`action:${button.action.trim().toLowerCase()}`);
  }

  if (typeof button.action_id === "string" && button.action_id.trim()) {
    keyParts.push(`action_id:${button.action_id.trim().toLowerCase()}`);
  }

  if (typeof button.accion_interna === "string" && button.accion_interna.trim()) {
    keyParts.push(`internal:${button.accion_interna.trim().toLowerCase()}`);
  }

  if (typeof button.url === "string" && button.url.trim()) {
    keyParts.push(`url:${normaliseUrlForKey(button.url)}`);
  }

  if (typeof button.texto === "string" && button.texto.trim()) {
    keyParts.push(`text:${button.texto.trim().toLowerCase()}`);
  }

  if (typeof button.payload !== "undefined") {
    keyParts.push(`payload:${stableSerialize(button.payload)}`);
  }

  if (!keyParts.length) {
    return Math.random().toString(36);
  }

  return keyParts.join("|");
};


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
  const { cleanText } = extractSmartHint(safeText);
  // Preprocess for phone numbers etc, before Markdown rendering
  const processedText = useMemo(() => isBot ? preprocessMarkdown(cleanText) : cleanText, [isBot, cleanText]);

  const { currentSlug } = useTenant();

  const resolveUrl = useMemo(
    () => (url?: string | null) => (url ? buildTenantAwareUrl(url, currentSlug) : undefined),
    [currentSlug],
  );

  const { combinedButtons } = useMemo(() => {
    // Only use existing buttons, no longer extracting from text
    const existing = Array.isArray(message.botones) ? message.botones : [];

    const seen = new Set<string>();
    const combined: Boton[] = [];

    const register = (button: Boton) => {
      if (!button) return;
      const key = buttonKey(button);
      if (seen.has(key)) return;
      seen.add(key);
      combined.push(button);
    };

    existing.forEach((btn) => register(btn));

    return { combinedButtons: combined };
  }, [message.botones]);

  // Use simplified text logic based on the raw text (stripped of markdown/html if possible,
  // but for now passing the markdown might be okay-ish or we try to strip it).
  // simplify() might need plain text.
  // ReactMarkdown doesn't give us plain text easily.
  // We'll trust simplify() to handle it or just pass cleanText.
  const [simple, setSimple] = useState<boolean>(() => {
    try {
      const p = JSON.parse(safeLocalStorage.getItem("chatboc_accessibility") || "{}");
      return !!p?.simplified;
    } catch {
      return true;
    }
  });

  // Calculate simplified version
  const simplifiedText = useMemo(() => {
      // Remove basic markdown symbols for simplified view if possible
      // This is a rough approximation
      const noMarkdown = cleanText.replace(/(\*\*|__)(.*?)\1/g, "$2") // Bold
                                  .replace(/(\*|_)(.*?)\1/g, "$2") // Italic
                                  .replace(/\[(.*?)\]\(.*?\)/g, "$1") // Links
                                  .replace(/<[^>]+>/g, ""); // HTML
      return simplify(noMarkdown);
  }, [cleanText]);

  const renderText = simple ? (
    <pre className="whitespace-pre-wrap text-justify max-w-none text-sm mb-2 chat-message font-sans">{simplifiedText}</pre>
  ) : (
    <div className="prose dark:prose-invert max-w-none text-sm mb-2 chat-message break-words [&>p]:my-1 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, ...props }) => (
            <a
              {...props}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
              onClick={(e) => {
                  // If we want to capture clicks or track, do it here
              }}
            />
          ),
          table: ({ node, ...props }) => (
              <div className="overflow-x-auto my-2 border rounded border-white/10">
                  <table {...props} className="min-w-full divide-y divide-white/10" />
              </div>
          ),
          thead: ({ node, ...props }) => <thead {...props} className="bg-white/5" />,
          tbody: ({ node, ...props }) => <tbody {...props} className="divide-y divide-white/10" />,
          tr: ({ node, ...props }) => <tr {...props} />,
          th: ({ node, ...props }) => <th {...props} className="px-3 py-2 text-left text-xs font-medium text-white/70 uppercase tracking-wider" />,
          td: ({ node, ...props }) => <td {...props} className="px-3 py-2 whitespace-normal text-sm" />,
          ul: ({ node, ...props }) => <ul {...props} className="list-disc pl-4 space-y-1 my-2" />,
          ol: ({ node, ...props }) => <ol {...props} className="list-decimal pl-4 space-y-1 my-2" />,
        }}
      >
        {processedText}
      </ReactMarkdown>
    </div>
  );

  const textBlock = processedText
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
    (processedText || listBlock) ? (
      <>
        {processedText && textBlock}
        {listBlock}
      </>
    ) : null;

  const normalizedAttachments = normalizeAttachments(message);
  let processedAttachments: AttachmentInfo[] = [];

  if (normalizedAttachments.length > 0) {
    processedAttachments = normalizedAttachments.map(att =>
      deriveAttachmentInfo(att.url, att.name, att.mimeType, att.size, att.thumbUrl)
    );
  } else if (message.mediaUrl && isBot) {
     processedAttachments.push(deriveAttachmentInfo(message.mediaUrl, message.mediaUrl.split('/').pop() || "archivo_adjunto"));
  }

  // Separate audio from other attachments to use AudioPlayer
  // If multiple audios, maybe we render multiple players? For now, let's pick the first valid audio source.
  const audioAttachment = processedAttachments.find(a => a.type === 'audio');

  const audioSrc = useMemo(() => {
    if (message.audioUrl) {
      return message.audioUrl;
    }
    if (audioAttachment) {
      return audioAttachment.url;
    }
    return null;
  }, [message.audioUrl, audioAttachment]);

  const nonAudioAttachments = processedAttachments.filter(a => a.type !== 'audio');

  const bubbleBaseClass = isBot ? "chat-bubble-bot" : "chat-bubble-user";
  let bubbleStyleClass = "";
  if (message.chatBubbleStyle === 'compact') {
    bubbleStyleClass = "py-1.5 px-2.5 text-sm"; // Estilo más compacto
  } else if (message.chatBubbleStyle === 'emphasis') {
    bubbleStyleClass = "border-2 border-yellow-500"; // Estilo con énfasis
  }

  // Determinar si se muestra la sección de adjuntos/mapa o el contenido estructurado
  const showAttachmentOrMap = !!(
    (nonAudioAttachments.length > 0) ||
    message.locationData
  );

  const showStructuredContent = !!(message.structuredContent && message.structuredContent.length > 0);
  const showMenuSections = !!((message.menu_sections && message.menu_sections.length > 0) || message.interactive_list);
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
          {!showAttachmentOrMap && !showStructuredContent && !audioSrc && textAndListBlock}

          {/* Mostrar adjunto o mapa (no audio) */}
          {showAttachmentOrMap && (
            <div className="flex flex-col gap-2">
               {nonAudioAttachments.map((att, idx) => (
                  <AttachmentPreview
                    key={`${att.url}-${idx}`}
                    message={message}
                    attachmentInfo={att}
                    fallbackText={idx === 0 && processedText && !showStructuredContent && !audioSrc ? processedText : undefined}
                  />
               ))}

               {/* Fallback for Map if no attachments but location data exists */}
               {(!nonAudioAttachments.length && message.locationData) && (
                 <AttachmentPreview
                    message={message}
                    attachmentInfo={null}
                    fallbackText={processedText && !showStructuredContent && !audioSrc ? processedText : undefined}
                 />
               )}
            </div>
          )}

          {/* Mostrar contenido estructurado */}
          {showStructuredContent && (
            <>
              {/* Si hay texto Y contenido estructurado, el texto puede ser una introducción */}
              {textAndListBlock && !showAttachmentOrMap && !audioSrc && textAndListBlock}
              <StructuredContentDisplay items={message.structuredContent!} />
            </>
          )}

          {/* Interactive Menus / Lists */}
          {showMenuSections && (
            <>
                {/* Intro text if present */}
                {textAndListBlock && !showAttachmentOrMap && !audioSrc && !showStructuredContent && textAndListBlock}
                <InteractiveMenu
                    sections={message.menu_sections}
                    config={message.interactive_list}
                    onSelect={(item) => onButtonClick({
                        text: item.title,
                        action: 'interactive_list_reply',
                        payload: { id: item.id }
                    })}
                />
            </>
          )}

          {/* Audio Player Unificado */}
          {audioSrc && (
            <>
              {/* Si hay texto Y audio, el texto puede ser una introducción/transcripción */}
              {textAndListBlock}
              <AudioPlayer src={audioSrc} />
            </>
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

          {/* Botones */}
          {isBot && message.categorias && message.categorias.length > 0 ? (
            <>
              <CategorizedButtons
                categorias={message.categorias}
                onButtonClick={onButtonClick}
                onInternalAction={onInternalAction}
              />
              {combinedButtons.length > 0 && (
                 <ChatButtons
                  botones={combinedButtons}
                  onButtonClick={onButtonClick}
                  onInternalAction={onInternalAction}
                />
              )}
            </>
          ) : isBot && combinedButtons.length > 0 ? (
            <ChatButtons
              botones={combinedButtons}
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
