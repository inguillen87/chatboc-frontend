import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Paperclip, Send, PanelLeft, PanelRight, MessageSquare, PanelLeftClose, MessageCircle, Mic, MicOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Ticket, Message } from '@/types/tickets';
import ChatMessage from './ChatMessage';
import { AnimatePresence, motion } from 'framer-motion';
import PredefinedMessagesModal from './PredefinedMessagesModal';
import useSpeechRecognition from '@/hooks/useSpeechRecognition';
import { usePusher } from '@/hooks/usePusher';
import { getTicketById, sendMessage } from '@/services/ticketService';
import { toast } from 'sonner';
import { useUser } from '@/hooks/useUser';

interface ConversationPanelProps {
  ticket: Ticket | null;
  isMobile: boolean;
  isSidebarVisible: boolean;
  onToggleSidebar: () => void;
  onToggleDetails: () => void;
}

const ConversationPanel: React.FC<ConversationPanelProps> = ({ ticket, isMobile, isSidebarVisible, onToggleSidebar, onToggleDetails }) => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const { user } = useUser();
  const { supported, listening, transcript, start, stop } = useSpeechRecognition();
  const channel = usePusher(ticket ? `ticket-${ticket.tipo}-${ticket.id}` : null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (transcript) {
      setMessage(prev => prev ? `${prev} ${transcript}` : transcript);
    }
  }, [transcript]);

  useEffect(() => {
    const fetchMessages = async () => {
        if (ticket) {
            console.log(`Fetching messages for ticket ${ticket.id}`);
            try {
                const fullTicket = await getTicketById(ticket.id.toString());
                setMessages(fullTicket.messages || []);
            } catch (error) {
                toast.error("No se pudo cargar el historial de mensajes.");
                setMessages([]);
            }
        } else {
            setMessages([]);
        }
    };
    fetchMessages();
  }, [ticket]);

  useEffect(() => {
    if (channel) {
      channel.bind('nuevo-mensaje', (newMessage: Message) => {
        if (!messages.find(m => m.id === newMessage.id)) {
            setMessages(prevMessages => [...prevMessages, newMessage]);
        }
      });
    }
  }, [channel, messages]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!message.trim() || !ticket || !user) return;

    const tempId = `temp-${Date.now()}`;
    const newMessage: Message = {
        id: tempId,
        content: message,
        author: 'agent',
        agentName: user.name,
        timestamp: new Date().toISOString(),
    };

    setMessages(prevMessages => [...prevMessages, newMessage]);
    setMessage('');
    setIsSending(true);

    try {
        await sendMessage(ticket.id, ticket.tipo, newMessage.content);
    } catch (error) {
        toast.error("No se pudo enviar el mensaje.");
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, isInternalNote: true } : m));
    } finally {
        setIsSending(false);
    }
  };

  if (!ticket) {
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

  return (
    <motion.div
        key={ticket.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col h-screen bg-background"
    >
      <header className="p-4 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-4">
          {(isMobile || !isSidebarVisible) && (
            <Button variant="ghost" size="icon" onClick={onToggleSidebar}>
              {isSidebarVisible ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeft className="h-5 w-5" />}
            </Button>
          )}
          <div>
            <h2 className="text-lg font-semibold">{ticket.asunto}</h2>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="capitalize">{ticket.estado}</Badge>
              <Badge variant="secondary" className="capitalize">{ticket.categoria || 'General'}</Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline">Cerrar Ticket</Button>
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={onToggleDetails}>
              <PanelRight className="h-5 w-5" />
            </Button>
          )}
        </div>
      </header>

      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <AnimatePresence>
            <motion.div className="space-y-6">
            {(messages || []).map((msg, index) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <ChatMessage message={msg} user={ticket} />
              </motion.div>
            ))}
            </motion.div>
        </AnimatePresence>
      </ScrollArea>

      <footer className="p-4 border-t border-border shrink-0">
        <div className="relative">
          <Textarea
            placeholder={listening ? "Escuchando..." : "Escribe tu respuesta..."}
            className="pr-48"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={listening || isSending}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                }
            }}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
            {ticket && (
              <PredefinedMessagesModal onSelectMessage={handleSelectPredefinedMessage}>
                  <Button variant="ghost" size="icon" disabled={isSending}>
                      <MessageCircle className="h-5 w-5" />
                  </Button>
              </PredefinedMessagesModal>
            )}
            {supported && (
                 <Button variant="ghost" size="icon" onClick={listening ? stop : start} disabled={isSending}>
                    {listening ? <MicOff className="h-5 w-5 text-destructive" /> : <Mic className="h-5 w-5" />}
                </Button>
            )}
            <Button variant="ghost" size="icon" disabled={isSending}>
              <Paperclip className="h-5 w-5" />
            </Button>
            <Button onClick={handleSendMessage} disabled={isSending}>
              {isSending ? 'Enviando...' : <Send className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </footer>
    </motion.div>
  );
};

export default ConversationPanel;
