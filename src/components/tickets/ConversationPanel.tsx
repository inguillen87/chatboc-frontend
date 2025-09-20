import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, PanelLeft, MessageSquare, PanelLeftClose, MessageCircle, Mic, MicOff, X, FileText, ChevronDown, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Ticket, TicketStatus, Message as TicketMessage } from '@/types/tickets';
import { Message as ChatMessageData, SendPayload, AttachmentInfo } from '@/types/chat';
import ChatMessage from './ChatMessage';
import { AnimatePresence, motion } from 'framer-motion';
import PredefinedMessagesModal from './PredefinedMessagesModal';
import useSpeechRecognition from '@/hooks/useSpeechRecognition';
import { usePusher } from '@/hooks/usePusher';
import { getTicketMessages, sendMessage, updateTicketStatus } from '@/services/ticketService';
import { toast } from 'sonner';
import { useUser } from '@/hooks/useUser';
import { useTickets } from '@/context/TicketContext';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import ScrollToBottomButton from '../ui/ScrollToBottomButton';
import AdjuntarArchivo from '../ui/AdjuntarArchivo';
import { apiFetch } from '@/utils/api';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

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
}

const ConversationPanel: React.FC<ConversationPanelProps> = ({
  isMobile,
  isSidebarVisible,
  isDetailsVisible,
  onToggleSidebar,
  onToggleDetails,
  canToggleSidebar = false,
  showDetailsToggle = false,
}) => {
  const { selectedTicket, updateTicket } = useTickets();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [attachmentPreview, setAttachmentPreview] = useState<{ file: File; previewUrl: string } | null>(null);
  const { user } = useUser();
  const { supported, listening, transcript, start, stop } = useSpeechRecognition();
  const channelName = selectedTicket ? `ticket-${selectedTicket.tipo}-${selectedTicket.id}` : null;
  const channel = usePusher(channelName);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const statusOptions: TicketStatus[] = ['nuevo', 'abierto', 'en_proceso', 'en-espera', 'resuelto', 'cerrado'];
  const formatStatus = (s: string) => s.replace(/[_-]/g, ' ');

  useEffect(() => {
    if (transcript) {
      setMessage(prev => prev ? `${prev} ${transcript}` : transcript);
    }
  }, [transcript]);

  useEffect(() => {
    const fetchMessages = async () => {
        if (!selectedTicket) {
            setMessages([]);
            return;
        }

        // Usar los mensajes existentes si vienen con el ticket
        if (selectedTicket.messages) {
            setMessages(selectedTicket.messages.map(msg => adaptTicketMessageToChatMessage(msg, selectedTicket)));
            return;
        }

        try {
            const fetchedMessages = await getTicketMessages(selectedTicket.id, selectedTicket.tipo);
            setMessages(fetchedMessages.map(msg => adaptTicketMessageToChatMessage(msg, selectedTicket)));
        } catch (error) {
            toast.error("No se pudo cargar el historial de mensajes.");
            setMessages([]);
        }
    };
    fetchMessages();
  }, [selectedTicket]);

  useEffect(() => {
    if (channel) {
      const callback = (newMessage: TicketMessage) => {
        setMessages(prevMessages => {
            if (prevMessages.find(m => m.id === newMessage.id)) {
                return prevMessages;
            }
            return [...prevMessages, adaptTicketMessageToChatMessage(newMessage, selectedTicket!)];
        });
      };
      channel.bind('nuevo-mensaje', callback);

      return () => {
        channel.unbind('nuevo-mensaje', callback);
      }
    }
  }, [channel, selectedTicket]);

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
      toast.info("Subiendo archivo...");
      const formData = new FormData();
      formData.append('file', attachmentPreview.file);

      try {
        const response = await apiFetch<{
          url: string;
          thumbUrl?: string;
          thumbnail_url?: string;
          name: string;
          mimeType: string;
          size: number;
        }>('/archivos/upload/chat_attachment', {
          method: 'POST',
          body: formData,
        });
        attachmentData = {
          url: response.url,
          thumbUrl: response.thumbUrl || response.thumbnail_url,
          name: response.name,
          mimeType: response.mimeType,
          size: response.size,
        };
        toast.success("Archivo subido con éxito.");
      } catch (error) {
        console.error("Error uploading file:", error);
        toast.error("Error al subir el archivo.");
        setAttachmentPreview(null); // Clear preview on error
        setIsSending(false);
        return;
      }
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
    setAttachmentPreview(null);


    try {
        await sendMessage(
            selectedTicket.id,
            selectedTicket.tipo,
            text,
            attachmentData,
            payload?.action ? [{ type: 'reply', reply: { id: payload.action, title: payload.action } }] : undefined
        );
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
      <div className="flex h-full flex-col items-center justify-center bg-background p-4 text-center">
        <MessageSquare className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">Selecciona un ticket</h2>
        <p className="text-muted-foreground">Elige un ticket de la lista para ver la conversación.</p>
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
      toast.success(`Estado actualizado a ${formatStatus(newStatus)}`);
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
              <Badge variant="outline" className="capitalize text-xs">{selectedTicket.estado}</Badge>
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
                {formatStatus(selectedTicket.estado)}
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {statusOptions.map((status) => (
                <DropdownMenuItem
                  key={status}
                  className="capitalize"
                  onClick={() => handleStatusChange(status)}
                >
                  {formatStatus(status)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {showDetailsToggle && !isMobile && canToggleSidebar && (
        <div className="px-3 pb-2 md:px-4 md:pb-3">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={isDetailsVisible ? 'outline' : 'secondary'}
              onClick={() => {
                if (isDetailsVisible) {
                  onToggleDetails();
                }
              }}
            >
              Conversación
            </Button>
            <Button
              type="button"
              variant={isDetailsVisible ? 'secondary' : 'outline'}
              onClick={() => {
                if (!isDetailsVisible) {
                  onToggleDetails();
                }
              }}
            >
              Información
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 relative bg-gray-50/50 dark:bg-gray-900/50">
        <ScrollArea className="h-full p-4" ref={scrollAreaRef} onScroll={handleScroll}>
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
        </ScrollArea>
        {showScrollToBottom && <ScrollToBottomButton onClick={scrollToBottom} />}
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
