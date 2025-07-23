import React from 'react';
import { motion } from 'framer-motion';
import { Paperclip, Send, Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

import { Ticket, Comment } from '@/pages/TicketsPanel';

interface TicketChatProps {
  ticket: Ticket;
}

const MessageBubble: React.FC<{ message: Comment }> = ({ message }) => {
  const isAgent = message.es_admin;
  return (
    <div className={cn("flex items-end gap-2.5", isAgent ? "justify-end" : "justify-start")}>
      {!isAgent && <Avatar className="h-8 w-8"><AvatarFallback>U</AvatarFallback></Avatar>}
      <div className={cn(
        "rounded-2xl px-4 py-2.5 shadow-md max-w-lg",
        isAgent ? "bg-primary text-primary-foreground rounded-br-lg" : "bg-card text-foreground border rounded-bl-lg"
      )}>
        <p className="break-words whitespace-pre-wrap">{message.comentario}</p>
        <p className={cn("text-xs opacity-70 mt-1.5", isAgent ? "text-right" : "text-left")}>{new Date(message.fecha).toLocaleTimeString()}</p>
      </div>
       {isAgent && <Avatar className="h-8 w-8"><AvatarImage src="/logo/chatboc_logo_original.png" /><AvatarFallback>A</AvatarFallback></Avatar>}
    </div>
  );
};

import { apiFetch } from '@/utils/api';

interface TicketChatProps {
  ticket: Ticket;
  onTicketUpdate: (updatedTicket: Ticket) => void;
}

export const TicketChat: React.FC<TicketChatProps> = ({ ticket, onTicketUpdate }) => {
    const [newMessage, setNewMessage] = React.useState('');
    const [isSending, setIsSending] = React.useState(false);

    const handleSendMessage = async () => {
        if (!newMessage.trim() || isSending) return;

        setIsSending(true);

        const optimisticComment: Comment = {
            id: Date.now(),
            comentario: newMessage,
            fecha: new Date().toISOString(),
            es_admin: true,
        };

        const updatedTicket = {
            ...ticket,
            comentarios: [...(ticket.comentarios || []), optimisticComment],
        };
        onTicketUpdate(updatedTicket);
        setNewMessage('');

        try {
            const result = await apiFetch<Ticket>(`/api/tickets/${ticket.id}/responder`, {
                method: 'POST',
                body: { comentario: newMessage },
                sendEntityToken: true,
            });
            onTicketUpdate(result);
        } catch (error) {
            console.error("Error al enviar mensaje:", error);
            // Revertir el cambio optimista si falla la API
            onTicketUpdate(ticket);
        } finally {
            setIsSending(false);
        }
    };

  return (
    <div className="flex flex-col h-full">
      <header className="p-4 border-b">
        <h2 className="text-lg font-semibold">{ticket.asunto}</h2>
      </header>
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {ticket.comentarios?.map(msg => <MessageBubble key={msg.id} message={msg} />)}
        </div>
      </ScrollArea>
      <footer className="p-4 border-t space-y-2">
        {/* Placeholder para Sugerencias de IA */}
        <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">Sugerencia 1</Button>
            <Button variant="outline" size="sm">Sugerencia 2</Button>
        </div>
        <div className="relative">
          <Textarea
            placeholder="Escribe tu mensaje..."
            className="pr-28"
            rows={1}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                }
            }}
            disabled={isSending}
          />
          <div className="absolute top-1/2 right-2 transform -translate-y-1/2 flex items-center space-x-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon"><Smile className="h-5 w-5" /></Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Emojis</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon"><Paperclip className="h-5 w-5" /></Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Adjuntar archivo</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                    <Button onClick={handleSendMessage} disabled={isSending}>
                        {isSending ? 'Enviando...' : <Send className="h-5 w-5" />}
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Enviar mensaje</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </footer>
    </div>
  );
};
