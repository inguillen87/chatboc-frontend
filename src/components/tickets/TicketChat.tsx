import React, { useState, useEffect, useRef, useCallback, FC } from 'react';
import { Ticket, Comment } from '@/types/tickets';
import { Button } from '@/components/ui/button';
import { Loader2, Send, Paperclip, XCircle, Sparkles, Bot, User, Shield } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useDateSettings } from '@/hooks/useDateSettings';
import { useUser } from '@/hooks/useUser';
import { apiFetch } from '@/utils/api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import AttachmentPreview from '@/components/chat/AttachmentPreview';
import { getAttachmentInfo } from "@/utils/attachment";
import TemplateSelector from './TemplateSelector';

const toast = (globalThis as any).toast || {
  success: (message: string) => console.log("TOAST SUCCESS:", message),
  error: (message: string) => console.error("TOAST ERROR:", message),
};

interface TicketChatProps {
  ticket: Ticket;
  onTicketUpdate: (ticket: Ticket) => void;
  onClose: () => void;
  chatInputRef: React.RefObject<HTMLTextAreaElement>;
}

const getMessageSource = (comment: Comment) => {
  if (comment.es_admin) {
    // Aquí se podría añadir una lógica más sofisticada para detectar si es IA o no
    // Por ahora, asumimos que si el comentario contiene "IA:", es de la IA.
    const isAdminCommentFromIA = comment.comentario.startsWith("IA:");
    return isAdminCommentFromIA ? 'ia' : 'admin';
  }
  return 'user';
};

const AvatarIcon: FC<{ type: 'user' | 'admin' | 'ia' }> = ({ type }) => {
    const iconMap = {
        user: <User className="h-5 w-5" />,
        admin: <Shield className="h-5 w-5" />,
        ia: <Bot className="h-5 w-5" />,
    };
    const colorMap = {
        user: 'bg-muted text-muted-foreground',
        admin: 'bg-primary text-primary-foreground',
        ia: 'bg-purple-500 text-white',
    };
    return (
        <Avatar className={cn('h-9 w-9 flex items-center justify-center', colorMap[type])}>
            {iconMap[type]}
        </Avatar>
    );
};

const TicketChat: FC<TicketChatProps> = ({ ticket, onTicketUpdate, onClose, chatInputRef }) => {
  const { timezone, locale } = useDateSettings();
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [comentarios, setComentarios] = useState<Comment[]>(ticket.comentarios || []);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: "smooth" });
  }, []);

  useEffect(() => {
    setComentarios(ticket.comentarios ? [...ticket.comentarios].sort((a,b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()) : []);
    setTimeout(() => scrollToBottom(), 100);
  }, [ticket.id, ticket.comentarios, scrollToBottom]);

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !selectedFile) || isSending) return;
    // ... (lógica de envío de mensaje)
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // ... (lógica de cambio de archivo)
  };
  
  const handleTemplateSelect = (template: string) => {
      setNewMessage(prev => prev ? `${prev}\n${template}` : template);
      chatInputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="p-3 border-b flex items-center justify-between">
        <h2 className="text-md font-semibold truncate">{ticket.asunto}</h2>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <XCircle className="h-5 w-5" />
        </Button>
      </header>
      <ScrollArea className="flex-1 p-4" ref={chatContainerRef}>
        <div className="space-y-4">
          {comentarios.map((comment) => {
            const source = getMessageSource(comment);
            const attachment = getAttachmentInfo(comment.comentario);
            const isFromUser = source === 'user';
            return (
              <div key={comment.id} className={cn('flex items-end gap-2.5', isFromUser ? 'justify-start' : 'justify-end')}>
                {isFromUser && <AvatarIcon type="user" />}
                <div className="flex flex-col space-y-1 max-w-lg">
                  <div className={cn('rounded-2xl px-4 py-2.5 shadow-sm', 
                    source === 'admin' ? 'bg-primary text-primary-foreground rounded-br-lg' :
                    source === 'ia' ? 'bg-purple-100 text-purple-900 dark:bg-purple-900/50 dark:text-white rounded-br-lg' :
                    'bg-card text-foreground border rounded-bl-lg')}>
                    {attachment ? (
                        <AttachmentPreview attachment={attachment} />
                    ) : (
                        <p className="break-words whitespace-pre-wrap">{comment.comentario}</p>
                    )}
                  </div>
                  <p className={cn("text-xs text-muted-foreground", !isFromUser ? "text-right" : "text-left")}>
                    {new Date(comment.fecha).toLocaleTimeString(locale, { timeZone: timezone, hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {!isFromUser && <AvatarIcon type={source} />}
              </div>
            );
          })}
        </div>
      </ScrollArea>
      <footer className="border-t p-3 flex flex-col gap-2">
        {/* ... (código de adjuntos) */}
        <div className="flex gap-2 items-start">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} className="h-10 w-10 flex-shrink-0">
                    <Paperclip className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Adjuntar archivo</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TemplateSelector onTemplateSelect={handleTemplateSelect} />
          <div className="flex-1 relative">
            <Textarea
              ref={chatInputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
              }}
              placeholder="Escribe una respuesta..."
              disabled={isSending}
              className="pr-20 min-h-[40px] h-10"
              rows={1}
            />
            <Button
                onClick={handleSendMessage}
                disabled={isSending || (!newMessage.trim() && !selectedFile)}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8"
                size="sm"
            >
                {isSending ? <Loader2 className="animate-spin h-4 w-4" /> : "Enviar"}
                <Send className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default TicketChat;
