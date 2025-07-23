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

    setIsSending(true);
    const tempId = Date.now();
    let optimisticComment: Comment;

    if (selectedFile) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const imageUrl = e.target?.result as string;
            optimisticComment = {
                id: tempId,
                comentario: `Archivo adjunto: ${selectedFile.name}`,
                fecha: new Date().toISOString(),
                es_admin: true,
                // Simulación de URL de imagen para la preview
                archivo_url: imageUrl,
            };
            setComentarios(prev => [...prev, optimisticComment]);
        };
        reader.readAsDataURL(selectedFile);
    } else {
        optimisticComment = {
            id: tempId,
            comentario: newMessage,
            fecha: new Date().toISOString(),
            es_admin: true,
        };
        setComentarios(prev => [...prev, optimisticComment]);
    }

    setNewMessage("");
    setSelectedFile(null);

    // Aquí iría la lógica real de subida a la API
    // Por ahora, solo simulamos la respuesta exitosa
    setTimeout(() => {
        setIsSending(false);
        // Lógica para actualizar el comentario con la URL real del backend
    }, 1500);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
        setSelectedFile(file);
    } else if (file) {
        toast.error("Solo se pueden subir imágenes por ahora.");
    }
  };

  const handleTemplateSelect = (template: string) => {
      setNewMessage(prev => prev ? `${prev}\n${template}` : template);
      chatInputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full bg-muted/20 dark:bg-background">
      <header className="p-3 border-b flex items-center justify-between bg-background dark:bg-muted/30">
        <div>
            <h2 className="text-lg font-bold truncate">{ticket.asunto}</h2>
            <p className="text-sm text-muted-foreground">Ticket #{ticket.nro_ticket}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9">
          <XCircle className="h-5 w-5" />
        </Button>
      </header>
      <ScrollArea className="flex-1 p-4" ref={chatContainerRef}>
        <div className="space-y-6">
          {comentarios.map((comment) => {
            const source = getMessageSource(comment);
            const attachment = getAttachmentInfo(comment.comentario);
            const isFromUser = source === 'user';
            return (
              <div key={comment.id} className={cn('flex items-end gap-3', isFromUser ? 'justify-start' : 'justify-end')}>
                {!isFromUser && <AvatarIcon type={source} />}
                <div className={cn("flex flex-col space-y-1 max-w-xl", isFromUser ? 'items-start' : 'items-end')}>
                  <div className={cn('rounded-2xl px-4 py-2.5 shadow-sm w-fit',
                    source === 'admin' ? 'bg-primary text-primary-foreground rounded-br-none' :
                    source === 'ia' ? 'bg-purple-100 text-purple-900 dark:bg-purple-900/50 dark:text-white rounded-br-none' :
                    'bg-background text-foreground border rounded-bl-none')}>
                    {comment.archivo_url ? (
                        <img src={comment.archivo_url} alt="Adjunto" className="max-w-xs rounded-lg" />
                    ) : attachment ? (
                        <AttachmentPreview attachment={attachment} />
                    ) : (
                        <p className="break-words whitespace-pre-wrap">{comment.comentario}</p>
                    )}
                  </div>
                  <p className={cn("text-xs text-muted-foreground px-1")}>
                    {new Date(comment.fecha).toLocaleTimeString(locale, { timeZone: timezone, hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                 {isFromUser && <AvatarIcon type="user" />}
              </div>
            );
          })}
        </div>
      </ScrollArea>
      <footer className="border-t bg-background dark:bg-muted/30 p-3 flex flex-col gap-2">
        {selectedFile && (
            <div className="p-2 border border-dashed rounded-md flex items-center justify-between bg-muted/50">
                <div className="flex items-center gap-2 text-sm text-muted-foreground truncate">
                    <img src={URL.createObjectURL(selectedFile)} alt="Preview" className="h-10 w-10 rounded-md object-cover" />
                    <span className="truncate" title={selectedFile.name}>{selectedFile.name}</span>
                    <span className="text-xs opacity-70 whitespace-nowrap">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSelectedFile(null)} className="h-7 w-7">
                    <XCircle className="h-4 w-4" />
                </Button>
            </div>
        )}
        <div className="flex gap-2 items-start">
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
             <TemplateSelector onTemplateSelect={handleTemplateSelect} />
          </TooltipProvider>
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
              className="pr-24 min-h-[40px] h-10"
              rows={1}
            />
            <Button
                onClick={handleSendMessage}
                disabled={isSending || (!newMessage.trim() && !selectedFile)}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 px-3"
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
