import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, PanelLeft, MessageSquare, PanelLeftClose, MessageCircle, Mic, MicOff, X, FileText, ChevronDown, Info, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Ticket, TicketStatus, Message as TicketMessage } from '@/types/tickets';
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
  const isResponsePending = lastMessage ? !lastMessage.isBot : false;

  useEffect(() => {
    if (transcript) {
      setMessage(prev => prev ? `${prev} ${transcript}` : transcript);
    }
  }, [transcript]);

  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedTicket) {
        setMessages([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      // Usar los mensajes existentes si vienen con el ticket
      if (selectedTicket.messages) {
        setMessages(selectedTicket.messages.map(msg => adaptTicketMessageToChatMessage(msg, selectedTicket)));
        setIsLoading(false);
        return;
      }

      try {
        const fetchedMessages = await getTicketMessages(selectedTicket.id, selectedTicket.tipo);
        setMessages(fetchedMessages.map(msg => adaptTicketMessageToChatMessage(msg, selectedTicket)));
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

  useEffect(() => {
    if (!socket || !selectedTicket) return;

    // Join the ticket-specific room if the backend requires it
    // Based on user feedback: "Socket join por tenant/ticket"
    // We emit an event to join the room. The event name is hypothetical or generic 'join'.
    // If the backend handles 'subscribe_ticket_updates' globally for the tenant, this might be redundant but safe.
    socket.emit('join', { room: `ticket-${selectedTicket.tipo}-${selectedTicket.id}` });

    const handleNewComment = (data: any) => {
       // Check if the comment belongs to the current ticket
       if (data.ticket_id === selectedTicket.id && data.comment) {
           const newMsg = data.comment;

           const ticketMessage: TicketMessage = {
               id: newMsg.id,
               content: newMsg.comentario || newMsg.mensaje || newMsg.text,
               timestamp: newMsg.fecha || new Date().toISOString(),
               author: (newMsg.es_admin || newMsg.esAdmin || newMsg.isAdmin) ? 'agent' : 'user',
               attachments: newMsg.attachments || newMsg.archivos_adjuntos || newMsg.archivo_adjunto ? [newMsg.archivo_adjunto] : [],
           };

           setMessages(prevMessages => {
               // Evitar duplicados si el mensaje ya existe (por optimismo o retransmisión)
               if (prevMessages.some(m => m.id === ticketMessage.id)) {
                   return prevMessages;
               }
               // Si hay un mensaje optimista pendiente (id temporal grande), podríamos reemplazarlo aquí
               // pero simple deduplicación es un buen comienzo.
               return [...prevMessages, adaptTicketMessageToChatMessage(ticketMessage, selectedTicket)];
           });
       }
    };

    safeOn(socket, 'new_comment', handleNewComment);

    return () => {
        socket.off('new_comment', handleNewComment);
        socket.emit('leave', { room: `ticket-${selectedTicket.tipo}-${selectedTicket.id}` });
    };
  }, [socket, selectedTicket]);

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
      await sendMessage(
        selectedTicket.id,
        selectedTicket.tipo,
        text,
        attachmentPreview ? [attachmentPreview.file] : undefined, // Send raw file
        payload?.action
          ? [{ type: 'reply', reply: { id: payload.action, title: payload.action } }]
          : undefined,
      );
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
      // Message will be updated via Pusher with the real ID
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

  if (!selectedTicket) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-muted/20 p-4 text-center">
        <img src="/chatboc_logo_clean_transparent.png" alt="Chatboc Logo" className="w-24 h-24 mb-4" />
        <h2 className="text-2xl font-bold text-foreground">Bienvenido al Panel de Tickets</h2>
        <p className="text-lg text-muted-foreground">Selecciona un ticket de la lista para comenzar a trabajar.</p>
      </div>
    );
  }

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

  useEffect(() => {
    if (isDetailsVisible && desktopView === 'details' && setDesktopView) {
      setDesktopView('chat');
    }
  }, [desktopView, isDetailsVisible, setDesktopView]);

  return (
    <motion.div
        key={selectedTicket.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="flex h-full min-w-0 flex-col bg-background"
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
          {showDetailsToggle && (
            <Button
              variant={isDetailsVisible ? 'secondary' : 'ghost'}
              size="icon"
              onClick={onToggleDetails}
              aria-label={isDetailsVisible ? 'Ocultar detalles' : 'Mostrar detalles'}
            >
              <Info className="h-5 w-5" />
            </Button>
          )}
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
              <p className="text-sm font-semibold text-foreground">{lastActivityLabel}</p>
              {lastMessageSnippet && (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{lastMessageSnippet}</p>
              )}
            </div>
            <div className="rounded-lg border border-border/60 bg-background/80 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Volumen</p>
              <p className="text-sm font-semibold text-foreground">
                {messages.length}{' '}
                {messages.length === 1 ? 'mensaje' : 'mensajes'}
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

      <div className="flex-1 relative bg-muted/20">
        {desktopView === 'details' && !isMobile ? (
          <DetailsPanel />
        ) : (
          <>
            <ScrollArea className="h-full p-4" ref={scrollAreaRef} onScroll={handleScroll}>
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

      <footer className="p-2 border-t border-border shrink-0">
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
            placeholder={listening ? "Escuchando..." : attachmentPreview ? "Añade un comentario..." : "Escribe tu respuesta..."}
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
