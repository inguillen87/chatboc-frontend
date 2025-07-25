import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Paperclip, Send, PanelLeft, PanelRight, MessageSquare, PanelLeftClose, MessageCircle, Mic, MicOff, ArrowDown, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Ticket, Message } from '@/types/tickets';
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

interface ConversationPanelProps {
  isMobile: boolean;
  isSidebarVisible: boolean;
  onToggleSidebar: () => void;
  onToggleDetails: () => void;
}

const ConversationPanel: React.FC<ConversationPanelProps> = ({ isMobile, isSidebarVisible, onToggleSidebar, onToggleDetails }) => {
  const { selectedTicket, updateTicket } = useTickets();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
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
                setMessages(fetchedMessages);
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
      const callback = (newMessage: Message) => {
        console.log('New message received from Pusher:', newMessage);
        setMessages(prevMessages => {
            if (prevMessages.find(m => m.id === newMessage.id)) {
                return prevMessages;
            }
            return [...prevMessages, newMessage];
        });
      };
      channel.bind('nuevo-mensaje', callback);

      return () => {
        channel.unbind('nuevo-mensaje', callback);
      }
    }
  }, [channel]);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isAtBottom = scrollHeight - scrollTop <= clientHeight + 10;
    setShowScrollToBottom(!isAtBottom);
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !selectedTicket || !user) return;
    setIsSending(true);

    const buttons = [
      { type: 'reply' as const, reply: { id: 'acepto', title: 'Sí' } },
      { type: 'reply' as const, reply: { id: 'noacepto', title: 'No' } },
    ];

    try {
        await sendMessage(selectedTicket.id, selectedTicket.tipo, message, undefined, buttons);
        setMessage('');
    } catch (error) {
        toast.error("No se pudo enviar el mensaje.");
    } finally {
        setIsSending(false);
    }
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

  const handleFileUpload = async (file: File) => {
    if (!selectedTicket) return;

    const formData = new FormData();
    formData.append('archivo', file);

    try {
      const response = await sendMessage(selectedTicket.id, selectedTicket.tipo, '', formData);
      // The message will be updated via Pusher, so no need to manually add it here.
      toast.success('Archivo enviado con éxito');
    } catch (error) {
      toast.error('No se pudo enviar el archivo.');
    }
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
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={onToggleDetails} aria-label="Toggle Details">
              <PanelRight className="h-5 w-5" />
            </Button>
          )}
        </div>
      </header>

      <div className="flex-1 relative bg-gray-50/50 dark:bg-gray-900/50">
        <ScrollArea className="h-full p-4" ref={scrollAreaRef} onScroll={handleScroll}>
          <AnimatePresence>
              <motion.div className="space-y-6">
              {(messages || []).map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                >
                  <ChatMessage message={msg} user={selectedTicket} />
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
            <Button onClick={handleSendMessage} disabled={isSending || !message.trim()} aria-label="Send Message">
              {isSending ? 'Enviando...' : <Send className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </footer>
    </motion.div>
  );
};

export default ConversationPanel;
