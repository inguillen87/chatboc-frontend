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
            try {
                const fullTicket = await getTicketById(ticket.id.toString());
                setMessages(fullTicket.messages || []);
            } catch (error) {
                toast.error("No se pudo cargar el historial de mensajes.");
            }
        }
    };
    fetchMessages();
  }, [ticket]);

  useEffect(() => {
    if (channel) {
      channel.bind('nuevo-mensaje', (newMessage: Message) => {
        setMessages(prevMessages => [...prevMessages, newMessage]);
      });
    }
  }, [channel]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!message.trim() || !ticket) return;
    setIsSending(true);
    try {
        await sendMessage(ticket.id, ticket.tipo, message);
        setMessage('');
        // El mensaje se añadirá a la conversación a través de Pusher,
        // por lo que no es necesario añadirlo aquí manualmente.
    } catch (error) {
        toast.error("No se pudo enviar el mensaje.");
    } finally {
        setIsSending(false);
    }
  };

  if (!ticket) {
    // ... (código del placeholder sin cambios) ...
  }

  const handleSelectPredefinedMessage = (predefinedMessage: string) => {
    setMessage(prev => prev ? `${prev}\n${predefinedMessage}` : predefinedMessage);
  };

  return (
    <motion.div>
      {/* ... (código del header y scrollarea sin cambios) ... */}
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
            <PredefinedMessagesModal onSelectMessage={handleSelectPredefinedMessage}>
                <Button variant="ghost" size="icon" disabled={isSending}>
                    <MessageCircle className="h-5 w-5" />
                </Button>
            </PredefinedMessagesModal>
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
