import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, PanelLeft, MessageSquare, PanelLeftClose, MessageCircle, Mic, MicOff, X, FileText, ChevronDown, Info, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Ticket, TicketStatus, Message as TicketMessage, UnifiedConversationStreamItem } from '@/types/tickets';
import { Message as ChatMessageData, SendPayload, AttachmentInfo } from '@/types/chat';
import ChatMessage from './ChatMessage';
import DetailsPanel from './DetailsPanel';
import { AnimatePresence, motion } from 'framer-motion';
import PredefinedMessagesModal from './PredefinedMessagesModal';
import useSpeechRecognition from '@/hooks/useSpeechRecognition';
import { useSocket } from '@/context/SocketContext';
import { safeOn } from '@/utils/safeOn';
import {
  getTicketMessages,
  getTicketTimeline,
  requestTicketHistoryEmail,
  sendMessage,
  updateTicketStatus,
  type TicketHistoryDeliveryResult,
  isTicketHistoryDeliveryErrorResult,
  formatTicketHistoryDeliveryErrorMessage,
} from '@/services/ticketService';
import { toast } from 'sonner';
import { useUser } from '@/hooks/useUser';
import { useTickets } from '@/context/TicketContext';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import ScrollToBottomButton from '../ui/ScrollToBottomButton';
import AdjuntarArchivo from '../ui/AdjuntarArchivo';
import { apiFetch } from '@/utils/api';
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

// Helper to adapt ticket messages to the format ChatMessageBase expects
const adaptTicketMessageToChatMessage = (msg: TicketMessage, ticket: Ticket): ChatMessageData => {
  return {
    id: msg.id,
    text: msg.content,
    isBot: msg.author === 'agent',
    timestamp: new Date(msg.timestamp),
    // Adapt other fields as needed
    attachmentInfo: msg.attachments?.[0] ? {
        name: msg.attachments[0].filename,
        url: msg.attachments[0].url,
        thumbUrl:
          msg.attachments[0].thumbUrl ||
          msg.attachments[0].thumb_url ||
          msg.attachments[0].thumbnail_url ||
          msg.attachments[0].thumbnailUrl,
        mimeType: msg.attachments[0].mime_type,
        size: msg.attachments[0].size
    } : undefined,
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

type TicketAttachment = NonNullable<TicketMessage['attachments']>[number];

const normalizeAttachmentFromPayload = (raw: any): TicketAttachment | null => {
  if (!raw || typeof raw !== 'object') return null;

  const url =
    raw.url ||
    raw.archivo_url ||
    raw.file_url ||
    raw.media_url ||
    raw.download_url ||
    raw.public_url ||
    raw.thumbnail_url;
  const filename =
    raw.filename ||
    raw.name ||
    raw.nombre ||
    raw.original_filename ||
    raw.file_name ||
    'archivo';

  if (!url && !filename) return null;

  return {
    id: raw.id ?? raw.archivo_id ?? raw.attachment_id ?? url ?? filename,
    filename,
    url: url ? ensureAbsoluteUrl(String(url)) : '',
    mime_type: raw.mime_type || raw.mimeType || raw.content_type || raw.type,
    mimeType: raw.mimeType || raw.mime_type || raw.content_type || raw.type,
    size: raw.size,
    thumbUrl: raw.thumbUrl || raw.thumb_url || raw.thumbnail_url || raw.thumbnailUrl,
    thumb_url: raw.thumb_url || raw.thumbUrl || raw.thumbnail_url || raw.thumbnailUrl,
    thumbnail_url: raw.thumbnail_url || raw.thumb_url || raw.thumbUrl || raw.thumbnailUrl,
    thumbnailUrl: raw.thumbnailUrl || raw.thumbnail_url || raw.thumb_url || raw.thumbUrl,
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
  const isResponsePending = lastMessage ? !lastMessage.isBot : false;
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
    const fetchMessages = async () => {
      if (!selectedTicket) {
        setMessages([]);
        setTimelineItems([]);
        setTimelinePartial(false);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setTimelineItems([]);
      setTimelinePartial(false);

      try {
        const timeline = await getTicketTimeline(selectedTicket.id, selectedTicket.tipo);
        if (Array.isArray(timeline.unified_conversation_stream)) {
          setTimelineItems(timeline.unified_conversation_stream);
        }
        setTimelinePartial(false);
        if (Array.isArray(timeline.messages) && timeline.messages.length > 0) {
          setMessages(dedupeChatMessages(timeline.messages.map((msg) => adaptTicketMessageToChatMessage(msg, selectedTicket))));
          setIsLoading(false);
          return;
        }
      } catch (timelineError) {
        console.warn('No se pudo cargar timeline unificado, usando fallback de mensajes.', timelineError);
        setTimelineItems([]);
        setTimelinePartial(true);
      }

      if (selectedTicket.messages) {
        setMessages(dedupeChatMessages(selectedTicket.messages.map(msg => adaptTicketMessageToChatMessage(msg, selectedTicket))));
        setIsLoading(false);
        return;
      }

      try {
        const fetchedMessages = await getTicketMessages(selectedTicket.id, selectedTicket.tipo);
        setMessages(dedupeChatMessages(fetchedMessages.map(msg => adaptTicketMessageToChatMessage(msg, selectedTicket))));
      } catch (error) {
        toast.error('No se pudo cargar el historial de mensajes.');
        setMessages([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMessages();
  }, [selectedTicket]);

  const { socket } = useSocket();
  const realtimeOnline = Boolean(socket?.connected);

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

    const handleNewComment = (data: any) => {
       const payload = data?.payload && typeof data.payload === 'object' ? data.payload : data;
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

    safeOn(socket, 'new_comment', handleNewComment);
    safeOn(socket, 'new_chat_message', handleNewComment);
    safeOn(socket, 'conversation.message.created', handleNewComment);
    safeOn(socket, 'legacy.new_chat_message', handleNewComment);

    return () => {
        socket.off('new_comment', handleNewComment);
        socket.off('new_chat_message', handleNewComment);
        socket.off('conversation.message.created', handleNewComment);
        socket.off('legacy.new_chat_message', handleNewComment);
        socket.emit('leave', { room: ticketRoom });
    };
  }, [socket, selectedTicket]);

  useEffect(() => {
    if (!selectedTicket) return;
    if (socket?.connected) return;

    const interval = window.setInterval(async () => {
      try {
        const polledMessages = await getTicketMessages(selectedTicket.id, selectedTicket.tipo);
        setMessages((prev) => {
          const incoming = polledMessages.map((item) => adaptTicketMessageToChatMessage(item, selectedTicket));
          return dedupeChatMessages([...prev, ...incoming]);
        });
      } catch (pollError) {
        console.warn('Fallback polling de conversación falló', pollError);
      }
    }, 15000);

    return () => window.clearInterval(interval);
  }, [selectedTicket, socket?.connected]);

  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
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

    let attachmentData: AttachmentInfo | undefined = payload?.attachmentInfo;

    if (attachmentPreview) {
      // Create local preview attachment data for optimistic update
      // We don't have the real URL yet, but we have the blob URL from the preview
      attachmentData = {
        name: attachmentPreview.file.name,
        url: attachmentPreview.previewUrl, // Use blob URL for immediate display
        mimeType: attachmentPreview.file.type,
        size: attachmentPreview.file.size,
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
        attachmentPreview ? [attachmentPreview.file] : undefined, // Send raw file
        payload?.action
          ? [{ type: 'reply', reply: { id: payload.action, title: payload.action } }]
          : undefined,
      );
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
            'El estado se actualizó, pero el aviso por correo no se pudo entregar.',
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

  return (
    <motion.div
        key={selectedTicket.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background"
    >
      <header className="p-3 border-b border-border flex items-center justify-between shrink-0 h-16">
        <div className="flex items-center space-x-3">
          {canToggleSidebar && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleSidebar}
              aria-label={isSidebarVisible ? 'Ocultar lista de tickets' : 'Mostrar lista de tickets'}
            >
              {isSidebarVisible ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeft className="h-5 w-5" />}
            </Button>
          )}
          <Avatar>
            <AvatarImage src={selectedTicket.avatarUrl} />
            <AvatarFallback>{selectedTicket.name?.[0]}</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-md font-semibold">{selectedTicket.name}</h2>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="capitalize text-xs">
                {formatTicketStatusLabel(selectedTicket.estado)}
              </Badge>
              <Badge variant="secondary" className="capitalize text-xs">{selectedTicket.categoria || 'General'}</Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={realtimeOnline ? 'secondary' : 'outline'} className="hidden sm:inline-flex">
            {realtimeOnline ? 'Realtime activo' : 'Fallback polling'}
          </Badge>
          <Badge variant="outline" className="hidden sm:inline-flex capitalize">
            {activeChannel}
          </Badge>
          <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
            <Link to="/perfil/plantillas-respuesta">Templates</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
            <Link to="/notificaciones">Notificaciones</Link>
          </Button>
          {showDetailsToggle && (
            <Button
              variant={isDetailsVisible ? 'secondary' : 'outline'}
              size="sm"
              onClick={onToggleDetails}
              aria-label={isDetailsVisible ? 'Ocultar detalles del ticket' : 'Ver detalles del ticket'}
              aria-pressed={isDetailsVisible}
              className="flex items-center gap-2"
            >
              <Info className="h-4 w-4" />
              <span className="text-sm font-medium">Detalles</span>
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="capitalize" aria-label="Cambiar estado">
                {formatTicketStatusLabel(selectedTicket.estado)}
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
      </header>

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
        <div className="border-b border-border bg-muted/30 px-3 py-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-border/60 bg-background/80 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Actividad reciente</p>
              <p className="text-sm font-semibold text-foreground">
                {isLoading ? 'Sincronizando conversacion' : lastActivityLabel}
              </p>
              {!isLoading && lastMessageSnippet && (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{lastMessageSnippet}</p>
              )}
            </div>
            <div className="rounded-lg border border-border/60 bg-background/80 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Volumen</p>
              <p className="text-sm font-semibold text-foreground">
                {isLoading
                  ? 'Cargando...'
                  : `${messages.length} ${messages.length === 1 ? 'mensaje' : 'mensajes'}`}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {incomingMessagesCount} del vecino · {outgoingMessagesCount} del agente
              </p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/80 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Seguimiento</p>
              <Badge variant={isResponsePending ? 'destructive' : 'secondary'} className="mt-1 w-fit">
                {isResponsePending ? 'Respuesta pendiente' : 'Al día'}
              </Badge>
              <p className="mt-2 text-xs text-muted-foreground">
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
            <ScrollArea className="h-full p-4" ref={scrollAreaRef} onScroll={handleScroll}>
              {timelinePartial && (
                <div className="mb-3 rounded-lg border border-amber-300/60 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
                  Timeline parcial: se cargó conversación base y se reintentará actualizar eventos omnicanal.
                </div>
              )}
              {operationalTimelineItems.length > 0 && (
                <div className="mb-4 space-y-2 rounded-lg border border-border/60 bg-background/80 p-3">
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
                  title="No hay mensajes"
                  description="Esta conversación aún no tiene mensajes. ¡Envía el primero!"
                />
              ) : (
                <AnimatePresence>
                    <motion.div className="space-y-4">
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
            </ScrollArea>
            {showScrollToBottom && <ScrollToBottomButton onClick={scrollToBottom} />}
          </>
        )}
      </div>

      <footer className="shrink-0 border-t border-border bg-background/95 p-2">
        {attachmentPreview && (
          <div className="relative w-full p-2 bg-muted rounded-lg flex items-center gap-3 mb-2">
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
        <div className="relative">
          <Textarea
            placeholder={composerPlaceholder}
            className="pr-48 min-h-[40px]"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={listening || isSending}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                }
            }}
            maxLength={1000}
            aria-label="Message Input"
          />
          <div className="absolute bottom-2 right-2 flex items-center">
            {selectedTicket && (
              <PredefinedMessagesModal onSelectMessage={handleSelectPredefinedMessage}>
                  <Button variant="ghost" size="icon" disabled={isSending} aria-label="Predefined Messages">
                      <MessageCircle className="h-5 w-5" />
                  </Button>
              </PredefinedMessagesModal>
            )}
            {supported && (
                 <Button variant="ghost" size="icon" onClick={listening ? stop : start} disabled={isSending} aria-label={listening ? 'Stop Listening' : 'Start Listening'}>
                    {listening ? <MicOff className="h-5 w-5 text-destructive" /> : <Mic className="h-5 w-5" />}
                </Button>
            )}
            <AdjuntarArchivo onFileSelected={handleFileSelected} disabled={!!attachmentPreview || isSending} />
            <Button onClick={() => handleSendMessage()} disabled={isSending || (!message.trim() && !attachmentPreview)} aria-label="Send Message">
              {isSending ? 'Enviando...' : <Send className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </footer>
    </motion.div>
  );
};

export default ConversationPanel;
