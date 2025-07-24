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
import { getTicketMessages, sendMessage } from '@/services/ticketService';
import { toast } from 'sonner';
import { useUser } from '@/hooks/useUser';
import { useTickets } from '@/context/TicketContext';

interface ConversationPanelProps {
  isMobile: boolean;
  isSidebarVisible: boolean;
  onToggleSidebar: () => void;
  onToggleDetails: () => void;
}

const ConversationPanel: React.FC<ConversationPanelProps> = ({ isMobile, isSidebarVisible, onToggleSidebar, onToggleDetails }) => {
  const { selectedTicket } = useTickets();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
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
            console.log(`[CONVERSATION_PANEL] Fetching messages for ticket ${selectedTicket.id}`);
            try {
                const fetchedMessages = await getTicketMessages(selectedTicket.id, selectedTicket.tipo);
                console.log(`[CONVERSATION_PANEL] Fetched ${fetchedMessages.length} messages.`);
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
      console.log(`[CONVERSATION_PANEL] Subscribed to Pusher channel: ${channelName}`);
      channel.bind('nuevo-mensaje', (newMessage: Message) => {
        console.log('[CONVERSATION_PANEL] Received new message from Pusher:', newMessage);
        setMessages(prevMessages => {
            if (prevMessages.find(m => m.id === newMessage.id)) {
                console.log('[CONVERSATION_PANEL] Duplicate message detected. Ignoring.');
                return prevMessages;
            }
            return [...prevMessages, newMessage];
        });
      });
    }
  }, [channel, channelName]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!message.trim() || !selectedTicket || !user) return;
    console.log(`[CONVERSATION_PANEL] Sending message to ticket ${selectedTicket.id}: "${message}"`);
    setIsSending(true);
    try {
        await sendMessage(selectedTicket.id, selectedTicket.tipo, message);
        console.log('[CONVERSATION_PANEL] Message sent successfully via API.');
        setMessage('');
    } catch (error) {
        console.error('[CONVERSATION_PANEL] Error sending message:', error);
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

  return (
    <motion.div>
        {/* ... (código del componente sin cambios) ... */}
    </motion.div>
  );
};

export default ConversationPanel;
