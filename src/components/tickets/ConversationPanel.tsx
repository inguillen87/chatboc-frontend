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
        // Evitar duplicados si la actualización optimista ya añadió el mensaje
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

    // Optimistic update
    setMessages(prevMessages => [...prevMessages, newMessage]);
    setMessage('');
    setIsSending(true);

    try {
        await sendMessage(ticket.id, ticket.tipo, newMessage.content);
        // El mensaje real llegará por Pusher, podríamos quitar el temp y reemplazarlo,
        // pero por ahora, para simplicidad, lo dejamos así.
    } catch (error) {
        toast.error("No se pudo enviar el mensaje.");
        // Marcar el mensaje como no enviado
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
    <motion.div>
        {/* ... (código del header y scrollarea sin cambios) ... */}
    </motion.div>
  );
};

export default ConversationPanel;
