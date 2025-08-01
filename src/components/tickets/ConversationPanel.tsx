import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, PanelLeft, MessageSquare, PanelLeftClose, MessageCircle, Mic, MicOff, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Ticket, Message as TicketMessage } from '@/types/tickets';
import { Message as ChatMessageData, SendPayload } from '@/types/chat';
import ChatMessage from './ChatMessage';
import { AnimatePresence, motion } from 'framer-motion';
import PredefinedMessagesModal from './PredefinedMessagesModal';
import useSpeechRecognition from '@/hooks/useSpeechRecognition';
import { usePusher } from '@/hooks/usePusher';
import { getTicketMessages, sendMessage } from '@/services/ticketService';
import { toast } from 'sonner';
import { useUser } from '@/hooks/useUser';
import { useTickets } from '@/context/TicketContext';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import ScrollToBottomButton from '../ui/ScrollToBottomButton';
import AdjuntarArchivo from '../ui/AdjuntarArchivo';

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
        size: msg.attachments[0].size
    } : undefined,
    // Add other fields if they exist in your new TicketMessage type
  };
};


interface ConversationPanelProps {
  isMobile: boolean;
  isSidebarVisible: boolean;
  onToggleSidebar: () => void;
  onToggleDetails: () => void;
}

const ConversationPanel: React.FC<ConversationPanelProps> = ({ isMobile, isSidebarVisible, onToggleSidebar, onToggleDetails }) => {
  const { selectedTicket, updateTicket } = useTickets();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const { user } = useUser();
  const { supported, listening, transcript, start, stop } = useSpeechRecognition();
  const channelName = selectedTicket ? `ticket-${selectedTicket.tipo}-${selectedTicket.id}` : null;
  const channel = usePusher(channelName);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (transcript) {
      setMessage(prev => prev ? `${prev} ${transcript}` : transcript);
    }
  }, [transcript]);

  useEffect(() => {
    const fetchMessages = async () => {
        if (selectedTicket) {
            try {
                const fetchedMessages = await getTicketMessages(selectedTicket.id, selectedTicket.tipo);
                setMessages(fetchedMessages.map(msg => adaptTicketMessageToChatMessage(msg, selectedTicket)));
            } catch (error) {
                toast.error("No se pudo cargar el historial de mensajes.");
                setMessages([]);
            }
        } else {
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

  const handleSendMessage = async (payload?: Partial<SendPayload>) => {
    const text = payload?.text || message;
    if (!text.trim() && !payload?.attachmentInfo) return;
    if (!selectedTicket || !user) return;

    setIsSending(true);

    // Optimistic update
    const optimisticMessage: ChatMessageData = {
        id: Date.now(), // Temporary ID
        text: text,
        isBot: true, // Messages from agents are treated as "bot" messages in this context
        timestamp: new Date(),
        attachmentInfo: payload?.attachmentInfo,
    };
    setMessages(prev => [...prev, optimisticMessage]);
    setMessage('');


    try {
        await sendMessage(
            selectedTicket.id,
            selectedTicket.tipo,
            text,
            payload?.attachmentInfo,
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
      <div className="flex flex-col h-screen bg-background items-center justify-center text-center p-4">
        <MessageSquare className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">Selecciona un ticket</h2>
        <p className="text-muted-foreground">Elige un ticket de la lista para ver la conversación.</p>
      </div>
    );
  }

  const handleSelectPredefinedMessage = (predefinedMessage: string) => {
    setMessage(prev => prev ? `${prev}\n${predefinedMessage}` : predefinedMessage);
  };

  const handleCloseTicket = () => {
    if(!selectedTicket) return;
    updateTicket(selectedTicket.id, { ...selectedTicket, estado: 'resuelto' });
    toast.success('Ticket cerrado con éxito');
  }

  const handleFileUpload = async (fileData: { url: string; name: string; mimeType?: string; size?: number; }) => {
    if (!selectedTicket) return;

    handleSendMessage({
        text: `Archivo adjunto: ${fileData.name}`,
        attachmentInfo: {
            name: fileData.name,
            url: fileData.url,
            mimeType: fileData.mimeType,
            size: fileData.size,
        },
    });
  };

  return (
    <motion.div
        key={selectedTicket.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col h-screen bg-background"
    >
      <header className="p-3 border-b border-border flex items-center justify-between shrink-0 h-16">
        <div className="flex items-center space-x-3">
          {(isMobile || !isSidebarVisible) && (
            <Button variant="ghost" size="icon" onClick={onToggleSidebar} aria-label="Toggle Sidebar">
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
          <Button variant="outline" size="sm" onClick={handleCloseTicket} aria-label="Cerrar Ticket">
            <X className="h-4 w-4 mr-2" />
            Cerrar Ticket
          </Button>
        </div>
      </header>

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
        <div className="relative">
          <Textarea
            placeholder={listening ? "Escuchando..." : "Escribe tu respuesta..."}
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
            <AdjuntarArchivo onUpload={handleFileUpload} />
            <Button onClick={() => handleSendMessage()} disabled={isSending || !message.trim()} aria-label="Send Message">
              {isSending ? 'Enviando...' : <Send className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </footer>
    </motion.div>
  );
};

export default ConversationPanel;
