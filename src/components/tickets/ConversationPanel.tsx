import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Paperclip, Send, PanelLeft, PanelRight, MessageSquare, PanelLeftClose, MessageCircle, Mic, MicOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Ticket } from '@/types/tickets';
import ChatMessage from './ChatMessage';
import { AnimatePresence, motion } from 'framer-motion';
import PredefinedMessagesModal from './PredefinedMessagesModal';
import useSpeechRecognition from '@/hooks/useSpeechRecognition';

interface ConversationPanelProps {
  ticket: Ticket | null;
  isMobile: boolean;
  isSidebarVisible: boolean;
  onToggleSidebar: () => void;
  onToggleDetails: () => void;
}

const ConversationPanel: React.FC<ConversationPanelProps> = ({ ticket, isMobile, isSidebarVisible, onToggleSidebar, onToggleDetails }) => {
  const [message, setMessage] = useState('');
  const { supported, listening, transcript, start, stop } = useSpeechRecognition();

  useEffect(() => {
    if (transcript) {
      setMessage(prev => prev ? `${prev} ${transcript}` : transcript);
    }
  }, [transcript]);

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
            <h2 className="text-lg font-semibold">{ticket.title}</h2>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="capitalize">{ticket.status}</Badge>
              <Badge variant="secondary" className="capitalize">{ticket.priority}</Badge>
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

      <ScrollArea className="flex-1 p-4">
        <AnimatePresence>
            <motion.div className="space-y-6">
            {ticket.messages.map((message, index) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <ChatMessage message={message} user={ticket.user || ticket} />
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
            disabled={listening}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
            <PredefinedMessagesModal onSelectMessage={handleSelectPredefinedMessage}>
                <Button variant="ghost" size="icon">
                    <MessageCircle className="h-5 w-5" />
                </Button>
            </PredefinedMessagesModal>
            {supported && (
                 <Button variant="ghost" size="icon" onClick={listening ? stop : start}>
                    {listening ? <MicOff className="h-5 w-5 text-destructive" /> : <Mic className="h-5 w-5" />}
                </Button>
            )}
            <Button variant="ghost" size="icon">
              <Paperclip className="h-5 w-5" />
            </Button>
            <Button>
              <Send className="h-5 w-5 mr-2" />
              Enviar
            </Button>
          </div>
        </div>
      </footer>
    </motion.div>
  );
};

export default ConversationPanel;
