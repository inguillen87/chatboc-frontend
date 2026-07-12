import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, PanelLeft, MessageSquare, PanelLeftClose, MessageCircle, Mic, MicOff, X, FileText, ChevronDown, Info, Loader2, Sparkles, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Ticket,
  TicketStatus,
  Message as TicketMessage,
  TicketRealtimeState,
  TicketRealtimeViewer,
  UnifiedConversationStreamItem,
} from '@/types/tickets';
import { Message as ChatMessageData, SendPayload, AttachmentInfo } from '@/types/chat';
import ChatMessage from './ChatMessage';
import DetailsPanel from './DetailsPanel';
import CaseStrip from './CaseStrip';
import { AnimatePresence, motion } from 'framer-motion';
import PredefinedMessagesModal from './PredefinedMessagesModal';
import useSpeechRecognition from '@/hooks/useSpeechRecognition';
import { useSocket } from '@/context/SocketContext';
import { safeOn } from '@/utils/safeOn';
import {
  getTicketMessages,
  getTicketTimeline,
  isLegacyHtmlGatewayError,
  requestTicketHistoryEmail,
  sendMessage,
  summarizeTicketFetchError,
  updateTicketStatus,
  updateTicketReadState,
  normalizeTicketReplyDelivery,
  type TicketHistoryDeliveryResult,
  type TicketReplyDeliveryStatus,
  isTicketHistoryDeliveryErrorResult,
  formatTicketHistoryDeliveryErrorMessage,
} from '@/services/ticketService';
import { toast } from 'sonner';
import { useUser } from '@/hooks/useUser';
import { useTickets } from '@/context/TicketContext';
import { IdentityAvatar } from '@/components/identity/IdentityAvatar';
import ScrollToBottomButton from '../ui/ScrollToBottomButton';
import AdjuntarArchivo from '../ui/AdjuntarArchivo';
import { apiFetch } from '@/utils/api';
import { cn } from '@/lib/utils';
import { CHATBOC_ORBIT_AVATAR } from '@/utils/brandAssets';
import {
  coalesceNumber,
  coalesceString,
  normalizeUploadResponse,
  UploadResponsePayload,
  UploadResponseLike,
} from '@/utils/uploadResponse';
import { ensureAbsoluteUrl } from '@/utils/chatButtons';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ALLOWED_TICKET_STATUSES, formatTicketStatusLabel } from '@/utils/ticketStatus';
import { buildOperationalReplyDraft, deriveTicketOperationalGuidance } from './ticketOperationalGuidance';
import { resolveConsentedAvatar } from '@/utils/avatarConsent';
import { restoreComposerDraftAfterSendFailure } from './conversationDraftRecovery';
import { isTicketAiDraftEvent, TICKET_AI_DRAFT_EVENT_NAME } from './aiDraftEvents';
import {
  deriveAttachmentInfoFromPayload,
  getAttachmentDeliveryUrl,
  getAttachmentPreviewUrl,
} from '@/utils/attachment';

type UploadResponse = UploadResponseLike;

const formatRelativeTime = (input?: Date | null) => {
  if (!input) {
    return 'Sin actividad reciente';
  }

  const timestamp = input instanceof Date ? input : new Date(input);

  if (Number.isNaN(timestamp.getTime())) {
    return 'Sin actividad reciente';
  }

  const now = Date.now();
  const diffInSeconds = Math.round((timestamp.getTime() - now) / 1000);
  const absSeconds = Math.abs(diffInSeconds);

  if (typeof Intl !== 'undefined' && typeof Intl.RelativeTimeFormat !== 'undefined') {
    const rtf = new Intl.RelativeTimeFormat('es-AR', { numeric: 'auto' });

    if (absSeconds < 60) {
      return rtf.format(diffInSeconds, 'second');
    }

    const diffInMinutes = Math.round(diffInSeconds / 60);
    if (Math.abs(diffInMinutes) < 60) {
      return rtf.format(diffInMinutes, 'minute');
    }

    const diffInHours = Math.round(diffInMinutes / 60);
    if (Math.abs(diffInHours) < 24) {
      return rtf.format(diffInHours, 'hour');
    }

    const diffInDays = Math.round(diffInHours / 24);
    if (Math.abs(diffInDays) < 7) {
      return rtf.format(diffInDays, 'day');
    }

    const diffInWeeks = Math.round(diffInDays / 7);
    if (Math.abs(diffInWeeks) < 4) {
      return rtf.format(diffInWeeks, 'week');
    }
  }

  try {
    return new Intl.DateTimeFormat('es-AR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(timestamp);
  } catch {
    return timestamp.toLocaleString('es-AR');
  }
};

export const formatReplyDeliveryChannel = (channel: string) => {
  const normalized = channel.trim().toLowerCase();
  if (normalized === 'whatsapp') return 'WhatsApp';
  if (normalized === 'sms') return 'SMS';
  if (normalized === 'email') return 'Email';
  if (normalized === 'live_socket' || normalized === 'socket') return 'Chat en vivo';
  return 'CRM';
};

const BACKOFFICE_VIEWER_ROLES = new Set([
  'admin',
  'agent',
  'empleado',
  'employee',
  'manager',
  'operator',
  'operador',
  'platform_admin',
  'super_admin',
  'superadmin',
  'supervisor',
  'tenant_admin',
]);
const PUBLIC_RECIPIENT_VIEWER_ROLES = new Set([
  'anonymous',
  'citizen',
  'ciudadano',
  'cliente',
  'customer',
  'lead',
  'neighbor',
  'public_pin',
  'user',
  'usuario',
]);

export const isPublicTicketRecipientViewer = (viewer?: TicketRealtimeViewer | null) => {
  if (!viewer) return false;

  const role = String(viewer.viewer_role || '').trim().toLowerCase().replaceAll('-', '_');
  if (BACKOFFICE_VIEWER_ROLES.has(role) || role.startsWith('admin_')) return false;
  if (PUBLIC_RECIPIENT_VIEWER_ROLES.has(role)) return true;

  const viewerKey = String(viewer.viewer_key || viewer.viewer_id || '').trim().toLowerCase();
  return Boolean(viewer.viewer_anon_id) || viewerKey.startsWith('anon:') || viewerKey.startsWith('pin:');
};

export const hasPublicRecipientPresence = (state?: TicketRealtimeState | null) =>
  Boolean(
    state?.active_viewers?.some((viewer) => {
      const effectiveStatus = String(
        viewer.effective_presence_status || viewer.presence_status || 'active',
      ).toLowerCase();
      return effectiveStatus === 'active' && isPublicTicketRecipientViewer(viewer);
    }),
  );

export const applyPublicRecipientReadConfirmation = (
  delivery: TicketReplyDeliveryStatus | null,
  viewer: TicketRealtimeViewer | null | undefined,
  lastReadCommentIdInput: unknown,
): TicketReplyDeliveryStatus | null => {
  if (!delivery || !isPublicTicketRecipientViewer(viewer)) return delivery;

  const lastReadCommentId = Number(lastReadCommentIdInput || 0);
  const latestReplyCommentId = delivery.latest_reply_comment_id ?? delivery.reply_comment_ids.at(-1);
  if (
    !Number.isInteger(lastReadCommentId) ||
    lastReadCommentId <= 0 ||
    !latestReplyCommentId ||
    lastReadCommentId < latestReplyCommentId
  ) {
    return delivery;
  }

  return {
    ...delivery,
    recipient_presence_confirmed: true,
    recipient_read_confirmed: true,
    ...(delivery.external_dispatch
      ? {}
      : {
          mode: 'real_message',
          channel: 'live_socket',
          status: 'sent',
          reason: 'recipient_read_confirmed',
          reply_status: 'sent_to_live_chat',
        }),
    operator_message: 'Lectura del ciudadano confirmada para el ultimo mensaje.',
  };
};

export const getReplyDeliveryView = (delivery: TicketReplyDeliveryStatus) => {
  const channel = formatReplyDeliveryChannel(delivery.channel);
  const failed = delivery.reason.includes('failed') || delivery.status.includes('error');

  if (delivery.recipient_read_confirmed && delivery.status === 'sent') {
    return {
      tone: 'success' as const,
      title: 'Leido por el ciudadano',
      detail: 'El read-state publico confirma lectura del ultimo mensaje enviado.',
    };
  }

  if (delivery.external_dispatch) {
    return {
      tone: 'success' as const,
      title: 'Mensaje enviado',
      detail: `Canal confirmado: ${channel}. Tambien quedo registrado en el CRM.`,
    };
  }

  if (
    delivery.recipient_room_emitted &&
    delivery.recipient_presence_confirmed &&
    delivery.reply_status === 'sent_to_live_chat'
  ) {
    return {
      tone: 'success' as const,
      title: 'Entregado en chat en vivo',
      detail: 'Habia presencia publica activa en la sala del ticket; la lectura aun no fue confirmada.',
    };
  }

  if (delivery.socket_emitted) {
    return {
      tone: failed ? 'warning' as const : 'muted' as const,
      title: failed ? 'Emitido y guardado, entrega sin confirmar' : 'Emitido y guardado',
      detail: delivery.operator_message || 'El socket emitio el evento, pero no habia presencia publica activa confirmada.',
    };
  }

  if (failed) {
    return {
      tone: 'warning' as const,
      title: 'Guardado, entrega sin confirmar',
      detail: delivery.operator_message || 'El mensaje quedo en CRM, pero no se confirmo el canal externo.',
    };
  }

  return {
    tone: 'muted' as const,
    title: 'Guardado en CRM',
    detail: delivery.operator_message || 'No se confirmo WhatsApp ni chat en vivo para esta accion.',
  };
};

export const getComposerChannelView = ({
  channel,
  recipientPresenceConfirmed,
  lastReplyDelivery,
}: {
  channel?: string | null;
  recipientPresenceConfirmed: boolean;
  lastReplyDelivery?: TicketReplyDeliveryStatus | null;
}) => {
  const normalized = (channel || '').trim().toLowerCase();
  const lastDeliveryFailed = Boolean(
    lastReplyDelivery &&
      (lastReplyDelivery.reason.includes('failed') || lastReplyDelivery.status.includes('error')),
  );

  if (lastDeliveryFailed) {
    return {
      tone: 'warning' as const,
      label: 'Entrega externa a revisar',
      detail: 'El ultimo mensaje quedo guardado, pero el canal externo no confirmo entrega.',
    };
  }

  if (normalized === 'whatsapp') {
    return {
      tone: 'success' as const,
      label: 'Salida WhatsApp',
      detail: 'La respuesta intenta salir por WhatsApp y queda auditada en el CRM.',
    };
  }

  if (['web', 'widget', 'web_demo_widget', 'live_socket', 'socket'].includes(normalized)) {
    if (recipientPresenceConfirmed) {
      return {
        tone: 'success' as const,
        label: 'Ciudadano activo en el ticket',
        detail: 'La presencia publica esta activa; la respuesta se emite y queda en el historial.',
      };
    }

    return {
      tone: 'muted' as const,
      label: 'Entrega web por confirmar',
      detail: 'No hay presencia publica activa confirmada; el mensaje quedara guardado aunque el socket emita.',
    };
  }

  if (normalized === 'email') {
    return {
      tone: 'muted' as const,
      label: 'Respuesta por email',
      detail: 'Usa el contacto asociado y conserva la conversacion en la ficha.',
    };
  }

  if (normalized === 'phone') {
    return {
      tone: 'muted' as const,
      label: 'Registro de llamada',
      detail: 'Deja constancia operativa para que el equipo no pierda contexto.',
    };
  }

  return {
    tone: 'muted' as const,
    label: 'Registro CRM',
    detail: 'No hay canal externo confirmado; la respuesta queda como actividad del ticket.',
  };
};

// Helper to adapt ticket messages to the format ChatMessageBase expects
const adaptTicketMessageToChatMessage = (msg: TicketMessage, ticket: Ticket): ChatMessageData => {
  const attachments = (msg.attachments || [])
    .map((attachment, index) => deriveAttachmentInfoFromPayload(attachment, attachment.filename || `archivo_${index + 1}`))
    .filter((attachment): attachment is NonNullable<typeof attachment> => Boolean(attachment));
  const primaryAttachment = attachments[0];

  return {
    id: msg.id,
    text: msg.content,
    isBot: msg.author === 'agent',
    timestamp: new Date(msg.timestamp),
    // Adapt other fields as needed
    attachmentInfo: primaryAttachment,
    attachments,
    // Add other fields if they exist in your new TicketMessage type
  };
};

const normalizeMessageFingerprint = (msg: ChatMessageData): string => {
  const text =
    typeof msg.text === 'string'
      ? msg.text.replace(/\s+/g, ' ').trim().toLowerCase()
      : '';
  return `${msg.isBot ? 'agent' : 'user'}:${text}`;
};

const normalizeMessageTimestamp = (msg: ChatMessageData): number => {
  const timestamp =
    msg.timestamp instanceof Date
      ? msg.timestamp
      : new Date(msg.timestamp || Date.now());
  return Number.isNaN(timestamp.getTime()) ? Date.now() : timestamp.getTime();
};

const dedupeChatMessages = (items: ChatMessageData[]): ChatMessageData[] => {
  const seenIds = new Set<string>();
  const accepted: ChatMessageData[] = [];

  for (const item of items) {
    const id = item.id !== undefined && item.id !== null ? String(item.id) : '';
    if (id && seenIds.has(id)) {
      continue;
    }

    const fingerprint = normalizeMessageFingerprint(item);
    const isNearDuplicate = Boolean(fingerprint) && accepted.some((candidate) => {
      if (normalizeMessageFingerprint(candidate) !== fingerprint) {
        return false;
      }
      return Math.abs(normalizeMessageTimestamp(candidate) - normalizeMessageTimestamp(item)) <= 90_000;
    });

    if (isNearDuplicate) {
      continue;
    }

    if (id) seenIds.add(id);
    accepted.push(item);
  }

  return accepted;
};

export const shouldShowOperationalTimelineInChat = ({
  eventCount,
  isMobile,
  isDetailsVisible,
}: {
  eventCount: number;
  isMobile: boolean;
  isDetailsVisible: boolean;
}) => eventCount > 0 && (isMobile || !isDetailsVisible);

type TicketAttachment = NonNullable<TicketMessage['attachments']>[number];

const normalizeAttachmentFromPayload = (raw: any): TicketAttachment | null => {
  if (!raw || typeof raw !== 'object') return null;

  const deliveryUrl =
    getAttachmentDeliveryUrl(raw) ||
    raw.archivo_url ||
    raw.public_url ||
    raw.thumbnail_url;
  const previewUrl = getAttachmentPreviewUrl(raw);
  const filename =
    raw.filename ||
    raw.name ||
    raw.nombre ||
    raw.original_filename ||
    raw.file_name ||
    'archivo';

  if (!deliveryUrl && !filename) return null;

  return {
    id: raw.id ?? raw.archivo_id ?? raw.attachment_id ?? deliveryUrl ?? filename,
    filename,
    url: deliveryUrl ? ensureAbsoluteUrl(String(deliveryUrl)) : '',
    downloadUrl: raw.downloadUrl,
    download_url: raw.download_url,
    storage_url: raw.storage_url,
    storage_provider: raw.storage_provider,
    storage_access: raw.storage_access,
    is_private: raw.is_private,
    mime_type: raw.mime_type || raw.mimeType || raw.content_type || raw.type,
    mimeType: raw.mimeType || raw.mime_type || raw.content_type || raw.type,
    size: raw.size,
    thumbUrl: previewUrl ? ensureAbsoluteUrl(String(previewUrl)) : undefined,
    thumb_url: previewUrl ? ensureAbsoluteUrl(String(previewUrl)) : undefined,
    thumbnail_url: previewUrl ? ensureAbsoluteUrl(String(previewUrl)) : undefined,
    thumbnailUrl: previewUrl ? ensureAbsoluteUrl(String(previewUrl)) : undefined,
  };
};

const collectAttachmentsFromPayload = (raw: any): TicketMessage['attachments'] => {
  if (!raw || typeof raw !== 'object') return [];
  const sources = [
    raw.attachments,
    raw.archivos_adjuntos,
    raw.adjuntos,
    raw.archivo_adjunto,
    raw.attachment,
  ];

  return sources.flatMap((source) => {
    if (!source) return [];
    const values = Array.isArray(source) ? source : [source];
    return values
      .map(normalizeAttachmentFromPayload)
      .filter((attachment): attachment is TicketAttachment => Boolean(attachment));
  });
};

const normalizeTicketMessageFromPayload = (raw: any): TicketMessage | null => {
  if (!raw || typeof raw !== 'object') return null;

  const source =
    raw.comment ||
    raw.comentario_obj ||
    raw.mensaje_obj ||
    raw.message ||
    raw.mensaje ||
    raw.payload ||
    raw;
  const content =
    source.comentario ??
    source.mensaje ??
    source.text ??
    source.content ??
    source.body ??
    '';
  const attachments = collectAttachmentsFromPayload(source);

  if (!String(content || '').trim() && attachments.length === 0) {
    return null;
  }

  const id =
    source.id ??
    source.comment_id ??
    source.comentario_id ??
    source.message_id ??
    source.sid ??
    `${source.fecha || source.timestamp || source.created_at || Date.now()}:${content}`;
  const isAdmin =
    source.es_admin === true ||
    source.esAdmin === true ||
    source.is_admin === true ||
    source.isAdmin === true ||
    source.actor === 'agent' ||
    source.author === 'agent' ||
    source.author_type === 'agent';

  return {
    id,
    content: String(content || ''),
    timestamp: source.fecha || source.timestamp || source.created_at || new Date().toISOString(),
    author: isAdmin ? 'agent' : 'user',
    attachments,
  };
};

const extractResponseTicketMessages = (response: any): TicketMessage[] => {
  if (!response || typeof response !== 'object') return [];

  const candidates: any[] = [
    response.comment,
    response.comentario,
    response.message,
    response.mensaje,
  ];

  for (const key of ['comments', 'comentarios', 'messages', 'mensajes']) {
    const value = response[key];
    if (Array.isArray(value)) {
      candidates.push(...value);
    }
  }

  const ticketPayload = response.ticket && typeof response.ticket === 'object' ? response.ticket : null;
  if (ticketPayload) {
    for (const key of ['comments', 'comentarios', 'messages', 'mensajes']) {
      const value = ticketPayload[key];
      if (Array.isArray(value)) {
        candidates.push(...value);
      }
    }
  }

  return candidates
    .map(normalizeTicketMessageFromPayload)
    .filter((msg): msg is TicketMessage => Boolean(msg));
};


interface ConversationPanelProps {
  isMobile: boolean;
  isSidebarVisible: boolean;
  isDetailsVisible: boolean;
  onToggleSidebar: () => void;
  onToggleDetails: () => void;
  canToggleSidebar?: boolean;
  showDetailsToggle?: boolean;
  desktopView?: 'chat' | 'details';
  setDesktopView?: (view: 'chat' | 'details') => void;
}

const EmptyState: React.FC<{ icon: React.ElementType; title: string; description: string }> = ({
  icon: Icon,
  title,
  description,
}) => (
  <div className="flex h-full flex-col items-center justify-center text-center">
    <Icon className="mb-4 h-12 w-12 text-muted-foreground" />
    <h3 className="font-semibold">{title}</h3>
    <p className="text-sm text-muted-foreground">{description}</p>
  </div>
);

const ConversationPanel: React.FC<ConversationPanelProps> = ({
  isMobile,
  isSidebarVisible,
  isDetailsVisible,
  onToggleSidebar,
  onToggleDetails,
  canToggleSidebar = false,
  showDetailsToggle = false,
  desktopView,
  setDesktopView,
}) => {
  const { selectedTicket, updateTicket } = useTickets();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [timelineItems, setTimelineItems] = useState<UnifiedConversationStreamItem[]>([]);
  const [timelinePartial, setTimelinePartial] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [lastReplyDelivery, setLastReplyDelivery] = useState<TicketReplyDeliveryStatus | null>(null);
  const [recipientPresenceActive, setRecipientPresenceActive] = useState(
    hasPublicRecipientPresence(selectedTicket?.realtime_state),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [attachmentPreview, setAttachmentPreview] = useState<{ file: File; previewUrl: string } | null>(null);
  const { user } = useUser();
  const { supported, listening, transcript, start, stop } = useSpeechRecognition();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const statusOptions = ALLOWED_TICKET_STATUSES;
  const lastMessage = useMemo(() => (messages.length > 0 ? messages[messages.length - 1] : null), [messages]);
  const { incomingMessagesCount, attachmentsCount } = useMemo(() => {
    let incoming = 0;
    let attachments = 0;

    for (const msg of messages) {
      if (!msg.isBot) {
        incoming += 1;
      }

      if (msg.attachmentInfo) {
        attachments += 1;
      }
    }

    return { incomingMessagesCount: incoming, attachmentsCount: attachments };
  }, [messages]);
  const outgoingMessagesCount = messages.length - incomingMessagesCount;
  const lastMessageSnippet = useMemo(() => {
    if (!lastMessage) {
      return '';
    }

    if (typeof lastMessage.text === 'string' && lastMessage.text.trim()) {
      const plain = lastMessage.text
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (plain) {
        return plain.length > 120 ? `${plain.slice(0, 117)}…` : plain;
      }
    }

    if (lastMessage.attachmentInfo?.name) {
      return `Archivo: ${lastMessage.attachmentInfo.name}`;
    }

    return '';
  }, [lastMessage]);
  const lastActivityLabel = useMemo(() => {
    if (!lastMessage?.timestamp) {
      return 'Sin actividad reciente';
    }

    const value = lastMessage.timestamp instanceof Date
      ? lastMessage.timestamp
      : new Date(lastMessage.timestamp);

    if (Number.isNaN(value.getTime())) {
      return 'Sin actividad reciente';
    }

    return formatRelativeTime(value);
  }, [lastMessage]);
  const operationalTimelineItems = useMemo(
    () =>
      timelineItems.filter((item) => {
        const streamType = String(item.stream_type || '').toLowerCase();
        const source = String(item.source || '').toLowerCase();
        return (
          streamType !== 'message' &&
          streamType !== 'comentario' &&
          source !== 'chat_history' &&
          source !== 'timeline_comment'
        );
      }),
    [timelineItems],
  );
  const showOperationalTimelineInChat = shouldShowOperationalTimelineInChat({
    eventCount: operationalTimelineItems.length,
    isMobile,
    isDetailsVisible,
  });
  const isResponsePending = lastMessage ? !lastMessage.isBot : false;
  const operationalGuidance = useMemo(
    () => (selectedTicket ? deriveTicketOperationalGuidance(selectedTicket) : null),
    [selectedTicket],
  );
  const replyDraft = useMemo(
    () => (selectedTicket && operationalGuidance ? buildOperationalReplyDraft(selectedTicket, operationalGuidance) : ''),
    [operationalGuidance, selectedTicket],
  );
  const canApplyReplyDraft = Boolean(replyDraft && !message.trim() && !listening && !isSending);
  const applyReplyDraft = useCallback(() => {
    if (!replyDraft || isSending || listening) return;
    setMessage((prev) => (prev.trim() ? prev : replyDraft));
  }, [isSending, listening, replyDraft]);
  const notifyDeliveryIssue = useCallback(
    (result: TicketHistoryDeliveryResult, contextMessage: string) => {
      if (isTicketHistoryDeliveryErrorResult(result)) {
        toast.warning(
          formatTicketHistoryDeliveryErrorMessage(result, contextMessage),
        );
      }
    },
    [],
  );

  const activeChannel = selectedTicket?.channel || 'other';
  const composerPlaceholder = listening
    ? 'Escuchando...'
    : attachmentPreview
      ? 'Añadí contexto para el adjunto...'
      : activeChannel === 'whatsapp'
        ? 'Responder conversación de WhatsApp...'
        : activeChannel === 'email'
          ? 'Responder por email...'
          : activeChannel === 'phone'
            ? 'Registrar respuesta de llamada...'
            : 'Escribí tu respuesta...';

  useEffect(() => {
    if (transcript) {
      setMessage(prev => prev ? `${prev} ${transcript}` : transcript);
    }
  }, [transcript]);

  useEffect(() => {
    let cancelled = false;
    let loadingFallbackTimer: number | null = null;

    const finishLoading = () => {
      if (loadingFallbackTimer) {
        window.clearTimeout(loadingFallbackTimer);
        loadingFallbackTimer = null;
      }
      if (!cancelled) {
        setIsLoading(false);
      }
    };

    const fetchMessages = async () => {
      if (!selectedTicket) {
        if (!cancelled) {
          setMessages([]);
          setTimelineItems([]);
          setTimelinePartial(false);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setTimelineItems([]);
      setTimelinePartial(false);
      loadingFallbackTimer = window.setTimeout(() => {
        if (cancelled) return;
        setTimelinePartial(true);
        setIsLoading(false);
      }, 12000);

      try {
        const timeline = await getTicketTimeline(selectedTicket.id, selectedTicket.tipo, {
          quiet: true,
          ticket: selectedTicket,
          tenantSlug: selectedTicket.tenant_slug,
        });
        if (cancelled) return;
        if (Array.isArray(timeline.unified_conversation_stream)) {
          setTimelineItems(timeline.unified_conversation_stream);
        }
        if (timeline.realtime_state) {
          setRecipientPresenceActive(hasPublicRecipientPresence(timeline.realtime_state));
        }
        setTimelinePartial(false);
        if (Array.isArray(timeline.messages) && timeline.messages.length > 0) {
          setMessages(dedupeChatMessages(timeline.messages.map((msg) => adaptTicketMessageToChatMessage(msg, selectedTicket))));
          finishLoading();
          return;
        }
      } catch (timelineError) {
        if (cancelled) return;
        if (!isLegacyHtmlGatewayError(timelineError)) {
          console.warn('Timeline unificado no disponible; usando fallback de mensajes.', {
            ticketId: selectedTicket.id,
            ...summarizeTicketFetchError(timelineError),
          });
        }
        setTimelineItems([]);
        setTimelinePartial(true);
      }

      if (selectedTicket.messages) {
        if (cancelled) return;
        setMessages(dedupeChatMessages(selectedTicket.messages.map(msg => adaptTicketMessageToChatMessage(msg, selectedTicket))));
        finishLoading();
        return;
      }

      try {
        const fetchedMessages = await getTicketMessages(selectedTicket.id, selectedTicket.tipo, {
          quiet: true,
          ticket: selectedTicket,
          tenantSlug: selectedTicket.tenant_slug,
        });
        if (cancelled) return;
        setMessages(dedupeChatMessages(fetchedMessages.map(msg => adaptTicketMessageToChatMessage(msg, selectedTicket))));
      } catch (error) {
        if (cancelled) return;
        if (!isLegacyHtmlGatewayError(error)) {
          toast.error('No se pudo cargar el historial de mensajes.');
          console.warn('Historial de mensajes no disponible.', {
            ticketId: selectedTicket.id,
            ...summarizeTicketFetchError(error),
          });
        }
        setTimelinePartial(true);
        setMessages([]);
      } finally {
        finishLoading();
      }
    };
    fetchMessages();
    return () => {
      cancelled = true;
      if (loadingFallbackTimer) {
        window.clearTimeout(loadingFallbackTimer);
      }
    };
  }, [selectedTicket]);

  const { socket } = useSocket();
  const realtimeOnline = Boolean(socket?.connected);
  const pollingFailureCountRef = useRef(0);
  const pollingPausedUntilRef = useRef(0);
  const lastReadStateSyncRef = useRef<string | null>(null);
  const messageRef = useRef(message);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    messageRef.current = message;
  }, [message]);

  useEffect(() => {
    if (!selectedTicket) return;

    const handleAiDraft = (event: Event) => {
      if (!isTicketAiDraftEvent(event)) return;
      if (String(event.detail.ticketId) !== String(selectedTicket.id)) return;

      if (messageRef.current.trim()) {
        toast.info('El composer ya tiene texto. No sobreescribi el borrador actual.');
        return;
      }

      const draft = event.detail.draft.trim();
      setMessage(draft);
      messageRef.current = draft;
      window.requestAnimationFrame(() => composerRef.current?.focus());
      toast.success('Borrador IA cargado en la conversacion.');
    };

    window.addEventListener(TICKET_AI_DRAFT_EVENT_NAME, handleAiDraft);
    return () => window.removeEventListener(TICKET_AI_DRAFT_EVENT_NAME, handleAiDraft);
  }, [selectedTicket?.id]);

  useEffect(() => {
    pollingFailureCountRef.current = 0;
    pollingPausedUntilRef.current = 0;
    lastReadStateSyncRef.current = null;
    setRecipientPresenceActive(hasPublicRecipientPresence(selectedTicket?.realtime_state));
  }, [selectedTicket?.id]);

  useEffect(() => {
    if (!selectedTicket || messages.length === 0) return;

    const latestMessageId = [...messages]
      .map((item) => item.id)
      .filter((id): id is string | number => typeof id === 'string' || typeof id === 'number')
      .filter((id) => {
        const value = String(id);
        if (!value || value.startsWith('sent-') || value.startsWith('temp-')) return false;
        if (typeof id === 'number' && id > 1_000_000_000_000) return false;
        return true;
      })
      .at(-1);

    if (latestMessageId === undefined) return;

    const syncKey = `${selectedTicket.tipo}:${selectedTicket.id}:${latestMessageId}`;
    if (lastReadStateSyncRef.current === syncKey) return;
    lastReadStateSyncRef.current = syncKey;

    updateTicketReadState(selectedTicket.id, selectedTicket.tipo, latestMessageId)
      .then((state) => {
        if (state) {
          setRecipientPresenceActive(hasPublicRecipientPresence(state));
        }
        updateTicket(selectedTicket.id, {
          hasUnreadMessages: false,
          realtime_state: state || selectedTicket.realtime_state,
          collaboration_state: {
            ...(selectedTicket.collaboration_state || {}),
            has_unread: false,
            unread_viewer_count: 0,
          },
        } as Partial<Ticket>);
      })
      .catch((error) => {
        if (!isLegacyHtmlGatewayError(error)) {
          console.warn('No se pudo sincronizar lectura del ticket.', {
            ticketId: selectedTicket.id,
            ...summarizeTicketFetchError(error),
          });
        }
      });
  }, [messages, selectedTicket, updateTicket]);

  useEffect(() => {
    if (!socket || !selectedTicket) return;

    const ticketRoom =
      typeof selectedTicket.socket_room === 'string' && selectedTicket.socket_room.trim()
        ? selectedTicket.socket_room.trim()
        : `ticket-${selectedTicket.tipo}-${selectedTicket.id}`;

    // Join the ticket-specific room if the backend requires it
    // Based on user feedback: "Socket join por tenant/ticket"
    // We emit an event to join the room. The event name is hypothetical or generic 'join'.
    // If the backend handles 'subscribe_ticket_updates' globally for the tenant, this might be redundant but safe.
    socket.emit('join', { room: ticketRoom });

    const unwrapSocketPayload = (data: any) =>
      data?.payload && typeof data.payload === 'object' ? data.payload : data;
    const eventMatchesSelectedTicket = (payload: any) => {
      const incomingTicketId =
        payload?.ticket_id ??
        payload?.ticketId ??
        payload?.ticket?.id ??
        payload?.comment?.ticket_id ??
        payload?.message?.ticket_id;
      return Number(incomingTicketId) === Number(selectedTicket.id);
    };

    const handleNewComment = (data: any) => {
       const payload = unwrapSocketPayload(data);
       const incomingTicketId =
         payload?.ticket_id ??
         payload?.ticketId ??
         payload?.ticket?.id ??
         payload?.comment?.ticket_id ??
         payload?.message?.ticket_id;
       if (Number(incomingTicketId) === Number(selectedTicket.id)) {

           const ticketMessage = normalizeTicketMessageFromPayload(payload);
           if (!ticketMessage) return;

           setMessages(prevMessages => {
               // Evitar duplicados si el mensaje ya existe (por optimismo o retransmisión)
               if (prevMessages.some(m => m.id === ticketMessage.id)) {
                   return prevMessages;
               }
               // Si hay un mensaje optimista pendiente (id temporal grande), podríamos reemplazarlo aquí
               // pero simple deduplicación es un buen comienzo.
               return dedupeChatMessages([...prevMessages, adaptTicketMessageToChatMessage(ticketMessage, selectedTicket)]);
           });
       }
    };

    const handlePresenceChanged = (data: any) => {
      const payload = unwrapSocketPayload(data);
      if (!eventMatchesSelectedTicket(payload)) return;

      const activeViewers = Array.isArray(payload?.summary?.active_viewers)
        ? payload.summary.active_viewers
        : [];
      setRecipientPresenceActive(
        hasPublicRecipientPresence({
          viewers: [],
          active_viewers: activeViewers,
          read_states: [],
        }),
      );
    };

    const handleMessageRead = (data: any) => {
      const payload = unwrapSocketPayload(data);
      if (!eventMatchesSelectedTicket(payload) || !isPublicTicketRecipientViewer(payload?.viewer)) return;

      const lastReadCommentId = Number(
        payload?.last_read_comment_id ?? payload?.viewer?.last_read_comment_id ?? 0,
      );
      if (!Number.isInteger(lastReadCommentId) || lastReadCommentId <= 0) return;

      setRecipientPresenceActive(true);
      setLastReplyDelivery((current) =>
        applyPublicRecipientReadConfirmation(current, payload.viewer, lastReadCommentId),
      );
    };

    safeOn(socket, 'new_comment', handleNewComment);
    safeOn(socket, 'new_chat_message', handleNewComment);
    safeOn(socket, 'conversation.message.created', handleNewComment);
    safeOn(socket, 'legacy.new_chat_message', handleNewComment);
    safeOn(socket, 'ticket.presence.changed', handlePresenceChanged);
    safeOn(socket, 'conversation.message.read', handleMessageRead);

    return () => {
        socket.off('new_comment', handleNewComment);
        socket.off('new_chat_message', handleNewComment);
        socket.off('conversation.message.created', handleNewComment);
        socket.off('legacy.new_chat_message', handleNewComment);
        socket.off('ticket.presence.changed', handlePresenceChanged);
        socket.off('conversation.message.read', handleMessageRead);
        socket.emit('leave', { room: ticketRoom });
    };
  }, [socket, selectedTicket]);

  useEffect(() => {
    if (!selectedTicket) return;
    if (socket?.connected) return;

    const interval = window.setInterval(async () => {
      if (Date.now() < pollingPausedUntilRef.current) return;

      try {
        const polledMessages = await getTicketMessages(selectedTicket.id, selectedTicket.tipo, {
          quiet: true,
          ticket: selectedTicket,
          tenantSlug: selectedTicket.tenant_slug,
        });
        pollingFailureCountRef.current = 0;
        pollingPausedUntilRef.current = 0;
        setMessages((prev) => {
          const incoming = polledMessages.map((item) => adaptTicketMessageToChatMessage(item, selectedTicket));
          return dedupeChatMessages([...prev, ...incoming]);
        });
      } catch (pollError) {
        pollingFailureCountRef.current += 1;
        const backoffMs = Math.min(120000, 15000 * Math.max(1, pollingFailureCountRef.current));
        pollingPausedUntilRef.current = Date.now() + backoffMs;

        if (
          !isLegacyHtmlGatewayError(pollError) &&
          (pollingFailureCountRef.current === 1 || pollingFailureCountRef.current % 4 === 0)
        ) {
          console.warn('Fallback polling de conversacion pausado temporalmente', {
            ticketId: selectedTicket.id,
            pausedMs: backoffMs,
            ...summarizeTicketFetchError(pollError),
          });
        }
      }
    }, 15000);

    return () => window.clearInterval(interval);
  }, [selectedTicket, socket?.connected]);

  const scrollToBottom = useCallback(() => {
    const node = scrollAreaRef.current;
    if (node) {
      if (typeof node.scrollTo === 'function') {
        node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
      } else {
        node.scrollTop = node.scrollHeight;
      }
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isAtBottom = scrollHeight - scrollTop <= clientHeight + 10;
    setShowScrollToBottom(!isAtBottom);
  };

  const handleFileSelected = (file: File) => {
    const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : "";
    setAttachmentPreview({ file, previewUrl });
    // Revoke the object URL when the component unmounts or the preview changes
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  };

  const handleSendMessage = async (payload?: Partial<SendPayload>) => {
    const text = payload?.text || message;
    if (!text.trim() && !payload?.attachmentInfo && !attachmentPreview) return;
    if (!selectedTicket || !user) return;

    setIsSending(true);
    setLastReplyDelivery(null);

    const draftMessage = message;
    const draftAttachmentPreview = attachmentPreview;
    let attachmentData: AttachmentInfo | undefined = payload?.attachmentInfo;

    if (draftAttachmentPreview) {
      // Create local preview attachment data for optimistic update
      // We don't have the real URL yet, but we have the blob URL from the preview
      attachmentData = {
        name: draftAttachmentPreview.file.name,
        url: draftAttachmentPreview.previewUrl, // Use blob URL for immediate display
        mimeType: draftAttachmentPreview.file.type,
        size: draftAttachmentPreview.file.size,
        isUploading: true, // Optional: UI could show a spinner on the image
      };
    }

    // Optimistic update
    const optimisticMessage: ChatMessageData = {
        id: Date.now(), // Temporary ID
        text: text,
        isBot: true, // Messages from agents are treated as "bot" messages in this context
        timestamp: new Date(),
        attachmentInfo: attachmentData,
    };
    setMessages(prev => [...prev, optimisticMessage]);
    setMessage('');
    setAttachmentPreview(null); // Clear input immediately

    try {
      const response = await sendMessage(
        selectedTicket.id,
        selectedTicket.tipo,
        text,
        draftAttachmentPreview ? [draftAttachmentPreview.file] : undefined, // Send raw file
        payload?.action
          ? [{ type: 'reply', reply: { id: payload.action, title: payload.action } }]
          : undefined,
        {
          ticket: selectedTicket,
          tenantSlug: selectedTicket.tenant_slug,
        },
      );
      const replyDelivery = normalizeTicketReplyDelivery((response as any)?.delivery);
      setLastReplyDelivery(replyDelivery);
      if (replyDelivery) {
        setRecipientPresenceActive(replyDelivery.recipient_presence_confirmed);
      }
      const responseMessages = extractResponseTicketMessages(response)
        .map((msg) => adaptTicketMessageToChatMessage(msg, selectedTicket));
      setMessages((prev) => {
        const withoutOptimistic = prev.filter((item) => item.id !== optimisticMessage.id);
        if (responseMessages.length > 0) {
          return dedupeChatMessages([...withoutOptimistic, ...responseMessages]);
        }
        return dedupeChatMessages([
          ...withoutOptimistic,
          {
            ...optimisticMessage,
            id: `sent-${selectedTicket.tipo}-${selectedTicket.id}-${Date.now()}`,
            attachmentInfo: optimisticMessage.attachmentInfo
              ? { ...optimisticMessage.attachmentInfo, isUploading: false }
              : undefined,
          },
        ]);
      });
      requestTicketHistoryEmail({
        tipo: selectedTicket.tipo,
        ticketId: selectedTicket.id,
        options: {
          reason: 'message_update',
          actor: 'agent',
        },
      })
        .then((result) => {
          notifyDeliveryIssue(
            result,
            'El mensaje fue enviado, pero el correo automático de seguimiento falló.',
          );
        })
        .catch((error) => {
          console.error('Error triggering ticket update email after message:', error);
        });
    } catch (error) {
      toast.error("No se pudo enviar el mensaje.");
      setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id)); // Rollback on error
      restoreComposerDraftAfterSendFailure({
        payload,
        draftMessage,
        draftAttachmentPreview,
        setMessage,
        setAttachmentPreview,
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleButtonClick = (payload: SendPayload) => {
    handleSendMessage(payload);
  };

  useEffect(() => {
    if (isDetailsVisible && desktopView === 'details' && setDesktopView) {
      setDesktopView('chat');
    }
  }, [desktopView, isDetailsVisible, setDesktopView]);

  if (!selectedTicket) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-muted/20 p-4 text-center">
        <img src={CHATBOC_ORBIT_AVATAR} alt="Chatboc Logo" className="w-24 h-24 mb-4" />
        <h2 className="text-2xl font-bold text-foreground">Bienvenido al Panel de Tickets</h2>
        <p className="text-lg text-muted-foreground">Seleccioná un ticket de la lista para comenzar a trabajar.</p>
      </div>
    );
  }

  const handleSelectPredefinedMessage = (predefinedMessage: string) => {
    setMessage(prev => prev ? `${prev}\n${predefinedMessage}` : predefinedMessage);
  };

  const handleStatusChange = async (newStatus: TicketStatus) => {
    if (!selectedTicket) return;
    try {
      await updateTicketStatus(selectedTicket.id, selectedTicket.tipo, newStatus);
      updateTicket(selectedTicket.id, { estado: newStatus });
      toast.success(`Estado actualizado a ${formatTicketStatusLabel(newStatus)}`);
      requestTicketHistoryEmail({
        tipo: selectedTicket.tipo,
        ticketId: selectedTicket.id,
        options: {
          reason: 'status_change',
          estado: newStatus,
          actor: 'agent',
          notifyChannels: ['email', 'sms'],
        },
      })
        .then((result) => {
          notifyDeliveryIssue(
            result,
            'El estado se actualizo, pero el aviso por correo no se pudo entregar.',
          );
        })
        .catch((error) => {
          console.error('Error triggering ticket update email after status change:', error);
        });
    } catch (error) {
      console.error('Error updating ticket status:', error);
      toast.error('No se pudo actualizar el estado.');
    }
  };
  const conversationTitle = selectedTicket.categoria || selectedTicket.asunto || selectedTicket.name || 'Conversacion';
  const conversationSubtitle = [
    selectedTicket.nro_ticket || `#${selectedTicket.id}`,
    selectedTicket.name,
  ].filter(Boolean).join(' - ');
  const conversationAvatar = resolveConsentedAvatar(
    selectedTicket as unknown as Record<string, unknown>,
    selectedTicket.user as unknown as Record<string, unknown> | null | undefined,
  );
  const conversationAvatarUrl = conversationAvatar.avatarUrl;
  const conversationAvatarSource =
    conversationAvatar.source || selectedTicket.avatar_source || (conversationAvatarUrl ? 'imagen consentida' : 'iniciales');
  const replyDeliveryView = lastReplyDelivery ? getReplyDeliveryView(lastReplyDelivery) : null;
  const composerChannelView = getComposerChannelView({
    channel: activeChannel,
    recipientPresenceConfirmed: recipientPresenceActive,
    lastReplyDelivery,
  });

  return (
    <motion.div
        key={selectedTicket.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background"
    >
      <header className="shrink-0 border-b border-border px-3 py-2">
        <div className="flex min-h-12 flex-col gap-2 min-[760px]:flex-row min-[760px]:items-center min-[760px]:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            {canToggleSidebar && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={onToggleSidebar}
                aria-label={isSidebarVisible ? 'Ocultar lista de tickets' : 'Mostrar lista de tickets'}
              >
                {isSidebarVisible ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeft className="h-5 w-5" />}
              </Button>
            )}
            <IdentityAvatar
              name={selectedTicket.display_name || selectedTicket.name || conversationTitle}
              avatarUrl={conversationAvatarUrl}
              source={conversationAvatarSource}
              consented={conversationAvatar.consented}
              size="md"
            />
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-foreground sm:text-base" title={conversationTitle}>
                {conversationTitle}
              </h2>
              <p className="mt-0.5 truncate text-xs text-muted-foreground" title={conversationSubtitle}>
                {conversationSubtitle}
              </p>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="capitalize text-xs">
                  {formatTicketStatusLabel(selectedTicket.estado)}
                </Badge>
                <Badge variant="secondary" className="max-w-[12rem] truncate capitalize text-xs">{selectedTicket.categoria || 'General'}</Badge>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5 min-[760px]:justify-end">
            <Badge variant={realtimeOnline ? 'secondary' : 'outline'} className="hidden lg:inline-flex">
              {realtimeOnline ? 'Realtime activo' : 'Fallback polling'}
            </Badge>
            <Badge variant="outline" className="hidden lg:inline-flex capitalize">
              {activeChannel}
            </Badge>
            <Button asChild variant="ghost" size="sm" className="hidden xl:inline-flex">
              <Link to="/perfil/plantillas-respuesta">Templates</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="hidden xl:inline-flex">
              <Link to="/notificaciones">Notificaciones</Link>
            </Button>
            {showDetailsToggle && (
              <Button
                variant={isDetailsVisible ? 'secondary' : 'outline'}
                size="sm"
                onClick={onToggleDetails}
                aria-label={isDetailsVisible ? 'Ocultar detalles del ticket' : 'Ver detalles del ticket'}
                aria-pressed={isDetailsVisible}
                className="h-9 gap-2 px-2.5"
              >
                <Info className="h-4 w-4" />
                <span className="hidden text-sm font-medium sm:inline">Detalles</span>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 max-w-[10rem] justify-between capitalize" aria-label="Cambiar estado">
                  <span className="truncate">{formatTicketStatusLabel(selectedTicket.estado)}</span>
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {statusOptions.map((status) => (
                  <DropdownMenuItem
                    key={status}
                    className="capitalize"
                    onClick={() => handleStatusChange(status as TicketStatus)}
                  >
                    {formatTicketStatusLabel(status)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <CaseStrip
        ticket={selectedTicket}
        isDetailsVisible={isDetailsVisible}
        onOpenDetails={showDetailsToggle ? onToggleDetails : undefined}
      />

      {!isMobile && !isDetailsVisible && setDesktopView && (
        <div className="p-2 border-b border-border">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={desktopView === 'chat' ? 'secondary' : 'ghost'}
              onClick={() => setDesktopView('chat')}
            >
              Conversación
            </Button>
            <Button
              variant={desktopView === 'details' ? 'secondary' : 'ghost'}
              onClick={() => setDesktopView('details')}
            >
              Información
            </Button>
          </div>
        </div>
      )}

      {!isMobile && isDetailsVisible && (
        <div className="border-b border-border bg-muted/25 px-3 py-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-border/60 bg-background/80 px-2.5 py-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Actividad reciente</p>
              <p className="text-sm font-semibold text-foreground">
                {isLoading ? 'Sincronizando conversacion' : lastActivityLabel}
              </p>
              {!isLoading && lastMessageSnippet && (
                <p className="hidden max-w-[16rem] truncate text-xs text-muted-foreground xl:block">{lastMessageSnippet}</p>
              )}
            </div>
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-border/60 bg-background/80 px-2.5 py-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Volumen</p>
              <p className="text-sm font-semibold text-foreground">
                {isLoading
                  ? 'Cargando...'
                  : `${messages.length} ${messages.length === 1 ? 'mensaje' : 'mensajes'}`}
              </p>
              <p className="hidden text-xs text-muted-foreground xl:block">
                {incomingMessagesCount} del vecino · {outgoingMessagesCount} del agente
              </p>
            </div>
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-border/60 bg-background/80 px-2.5 py-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Seguimiento</p>
              <Badge variant={isResponsePending ? 'destructive' : 'secondary'} className="w-fit">
                {isResponsePending ? 'Respuesta pendiente' : 'Al día'}
              </Badge>
              <p className="hidden text-xs text-muted-foreground xl:block">
                {attachmentsCount > 0
                  ? `${attachmentsCount} ${attachmentsCount === 1 ? 'adjunto' : 'adjuntos'} compartidos`
                  : 'Sin adjuntos'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="relative min-h-0 flex-1 bg-muted/20">
        {desktopView === 'details' && !isMobile ? (
          <DetailsPanel />
        ) : (
          <>
            <div className="h-full overflow-y-auto p-4 pb-8" ref={scrollAreaRef} onScroll={handleScroll}>
              {timelinePartial && (
                <div className="mb-3 rounded-lg border border-amber-300/60 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
                  Timeline parcial: se cargó conversación base y se reintentará actualizar eventos omnicanal.
                </div>
              )}
              {showOperationalTimelineInChat && (
                <div
                  className="mb-4 space-y-2 rounded-lg border border-border/60 bg-background/80 p-3"
                  data-testid="ticket-operational-timeline"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actividad del reclamo</p>
                    <Badge variant="outline" className="text-[11px]">
                      {operationalTimelineItems.length} eventos
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {operationalTimelineItems.slice(-5).map((item) => (
                      <div key={item.id} className="rounded-md border border-border/50 bg-muted/30 px-2 py-1.5">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{item.source || item.stream_type || 'evento'}</p>
                        <p className="text-sm text-foreground">{item.preview_text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {isLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title={timelinePartial ? 'Historial en sincronizacion' : 'No hay mensajes'}
                  description={
                    timelinePartial
                      ? 'El historial completo todavia no respondio. Podes contestar igual; la conversacion se actualiza cuando vuelva el timeline.'
                      : 'Esta conversacion aun no tiene mensajes. Envia el primero.'
                  }
                />
              ) : (
                <AnimatePresence>
                    <motion.div className="space-y-4 pb-4">
                    {messages.map((msg, index) => (
                      <motion.div
                        key={msg.id || index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                      >
                        <ChatMessage
                          message={msg}
                          isTyping={false}
                          onButtonClick={handleButtonClick}
                          tipoChat={selectedTicket.tipo}
                        />
                      </motion.div>
                    ))}
                    </motion.div>
                </AnimatePresence>
              )}
            </div>
            {showScrollToBottom && <ScrollToBottomButton onClick={scrollToBottom} />}
          </>
        )}
      </div>

      <footer className="shrink-0 border-t border-border/80 bg-card/95 p-3 shadow-[0_-10px_28px_rgba(15,23,42,0.08)]">
        <div
          data-testid="ticket-composer-channel-status"
          className={cn(
            'mb-2 flex flex-col gap-1 rounded-lg border px-2.5 py-2 text-xs sm:flex-row sm:items-center sm:justify-between',
            composerChannelView.tone === 'success'
              ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
              : composerChannelView.tone === 'warning'
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200'
                : 'border-border/70 bg-muted/40 text-muted-foreground',
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            {composerChannelView.tone === 'warning' ? (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            ) : (
              <MessageCircle className="h-4 w-4 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="font-semibold uppercase tracking-wide">{composerChannelView.label}</p>
              <p className="mt-0.5 truncate leading-5 sm:max-w-[44rem]" title={composerChannelView.detail}>
                {composerChannelView.detail}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="w-fit shrink-0 rounded-full px-2 text-[11px]">
            {formatReplyDeliveryChannel(activeChannel)}
          </Badge>
        </div>
        {attachmentPreview && (
          <div className="relative mb-2 flex w-full items-center gap-3 rounded-lg bg-muted p-2">
            {attachmentPreview.previewUrl ? (
              <img src={attachmentPreview.previewUrl} alt="Preview" className="w-14 h-14 rounded-md object-cover" />
            ) : (
              <div className="w-14 h-14 flex-shrink-0 flex items-center justify-center bg-secondary rounded-md">
                <FileText className="w-7 h-7 text-secondary-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{attachmentPreview.file.name}</p>
              <p className="text-xs text-muted-foreground">{(attachmentPreview.file.size / 1024).toFixed(1)} KB</p>
            </div>
            <Button variant="ghost" size="icon" className="absolute top-1 right-1 w-6 h-6" onClick={() => setAttachmentPreview(null)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
        {operationalGuidance && replyDraft ? (
          <div className="mb-2 rounded-lg border border-primary/20 bg-primary/5 p-2.5">
            <div className="flex flex-col gap-2 min-[560px]:flex-row min-[560px]:items-center min-[560px]:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">Borrador asistido</p>
                  <Badge variant={operationalGuidance.source === 'backend' ? 'secondary' : 'outline'} className="h-5 rounded-full px-2 text-[11px]">
                    {operationalGuidance.source === 'backend' ? 'backend' : 'operativo'}
                  </Badge>
                </div>
                <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{replyDraft}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0 rounded-[8px] px-3 text-xs font-semibold"
                onClick={applyReplyDraft}
                disabled={!canApplyReplyDraft}
              >
                Usar sugerencia
              </Button>
            </div>
          </div>
        ) : null}
        {lastReplyDelivery && replyDeliveryView ? (
          <div
            data-testid="ticket-reply-delivery-status"
            role="status"
            aria-live="polite"
            className={cn(
              'mb-2 rounded-lg border p-2.5',
              replyDeliveryView.tone === 'success'
                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
                : replyDeliveryView.tone === 'warning'
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200'
                  : 'border-border/70 bg-muted/40 text-muted-foreground',
            )}
          >
            <div className="flex min-w-0 items-start gap-2">
              {replyDeliveryView.tone === 'success' ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : replyDeliveryView.tone === 'warning' ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <MessageCircle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide">{replyDeliveryView.title}</p>
                  <Badge variant="outline" className="h-5 rounded-full px-2 text-[11px]">
                    {formatReplyDeliveryChannel(lastReplyDelivery.channel)}
                  </Badge>
                  {lastReplyDelivery.recipient_read_confirmed ? (
                    <Badge variant="secondary" className="h-5 rounded-full px-2 text-[11px]">
                      leido
                    </Badge>
                  ) : lastReplyDelivery.recipient_presence_confirmed ? (
                    <Badge variant="secondary" className="h-5 rounded-full px-2 text-[11px]">
                      entregado
                    </Badge>
                  ) : lastReplyDelivery.socket_emitted ? (
                    <Badge variant="secondary" className="h-5 rounded-full px-2 text-[11px]">
                      socket emitido
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-xs leading-5">{replyDeliveryView.detail}</p>
              </div>
            </div>
          </div>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end" data-testid="ticket-composer">
          <Textarea
            ref={composerRef}
            placeholder={composerPlaceholder}
            className="min-h-[52px] max-h-36 flex-1 resize-none rounded-[8px] border-border/80 bg-background pr-3 text-sm leading-5 shadow-sm focus-visible:ring-primary/40"
            rows={1}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={listening || isSending}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSendMessage();
                }
            }}
            maxLength={1000}
            aria-label="Responder ticket"
          />
          <div className="flex w-full shrink-0 items-center justify-between gap-1 rounded-[8px] border border-border/70 bg-muted/30 p-1 sm:w-auto sm:justify-end">
            <div className="flex items-center gap-1">
              {selectedTicket && (
                <PredefinedMessagesModal onSelectMessage={handleSelectPredefinedMessage}>
                  <Button variant="ghost" size="icon" className="h-10 w-10" disabled={isSending} aria-label="Insertar mensaje predefinido">
                    <MessageCircle className="h-5 w-5" />
                  </Button>
                </PredefinedMessagesModal>
              )}
              {supported && (
                <Button variant="ghost" size="icon" className="h-10 w-10" onClick={listening ? stop : start} disabled={isSending} aria-label={listening ? 'Detener dictado' : 'Iniciar dictado'}>
                    {listening ? <MicOff className="h-5 w-5 text-destructive" /> : <Mic className="h-5 w-5" />}
                </Button>
              )}
              <AdjuntarArchivo onFileSelected={handleFileSelected} disabled={!!attachmentPreview || isSending} />
            </div>
            <Button className="h-10 min-w-10 rounded-[8px] px-3" onClick={() => void handleSendMessage()} disabled={isSending || (!message.trim() && !attachmentPreview)} aria-label="Enviar mensaje">
              {isSending ? 'Enviando...' : <Send className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </footer>
    </motion.div>
  );
};

export default ConversationPanel;
