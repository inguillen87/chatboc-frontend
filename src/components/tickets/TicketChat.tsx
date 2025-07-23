import React, { useState, useEffect, useRef, useCallback, FC } from 'react';
import { Ticket, Comment } from '@/pages/TicketsPanel';
import { Button } from '@/components/ui/button';
import { Loader2, Send, Paperclip, XCircle, Sparkles } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useDateSettings } from '@/hooks/useDateSettings';
import { useUser } from '@/hooks/useUser';
import { apiFetch } from '@/utils/api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import AttachmentPreview from '@/components/chat/AttachmentPreview';
import { getAttachmentInfo, deriveAttachmentInfo, AttachmentInfo } from "@/utils/attachment";

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

const AvatarIcon: FC<{ type: 'user' | 'admin' }> = ({ type }) => (
    <div className={cn('h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0', type === 'admin' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
      {type === 'admin' ? <AvatarImage src="/logo/chatboc_logo_original.png" /> : <AvatarImage src="/favicon/human-avatar.svg" />}
      <AvatarFallback>{type === 'admin' ? 'A' : 'U'}</AvatarFallback>
    </div>
);

const TicketChat: FC<TicketChatProps> = ({ ticket, onTicketUpdate, onClose, chatInputRef }) => {
  const { timezone, locale } = useDateSettings();
  const { user } = useUser();
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
    const optimisticComment: Comment = {
        id: tempId,
        comentario: newMessage,
        fecha: new Date().toISOString(),
        es_admin: true,
    };

    if (selectedFile) {
        // Handle file upload logic here
    } else {
        setComentarios(prev => [...prev, optimisticComment]);
    }

    setNewMessage("");
    setSelectedFile(null);

    try {
      const updatedTicket = await apiFetch<Ticket>(`/tickets/${ticket.tipo}/${ticket.id}/responder`, {
          method: "POST",
          body: { comentario: newMessage },
          sendEntityToken: true
      });
      onTicketUpdate(updatedTicket);
    } catch (error) {
      toast.error("No se pudo enviar el mensaje.");
      setComentarios(prev => prev.filter(c => c.id !== tempId));
    } finally {
      setIsSending(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    }
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
            const attachment = getAttachmentInfo(comment.comentario);
            return (
              <div key={comment.id} className={cn('flex items-end gap-2.5', comment.es_admin ? 'justify-end' : 'justify-start')}>
                {!comment.es_admin && <AvatarIcon type="user" />}
                <div className="flex flex-col space-y-1 max-w-lg">
                  <div className={cn('rounded-2xl px-4 py-2.5 shadow-md', comment.es_admin ? 'bg-primary text-primary-foreground rounded-br-lg' : 'bg-card text-foreground border rounded-bl-lg')}>
                    {attachment ? (
                        <AttachmentPreview attachment={attachment} />
                    ) : (
                        <p className="break-words whitespace-pre-wrap">{comment.comentario}</p>
                    )}
                  </div>
                  <p className={cn("text-xs text-muted-foreground", comment.es_admin ? "text-right" : "text-left")}>
                    {new Date(comment.fecha).toLocaleTimeString(locale, { timeZone: timezone, hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {comment.es_admin && <AvatarIcon type="admin" />}
              </div>
            );
          })}
        </div>
      </ScrollArea>
      <footer className="border-t p-3 flex flex-col gap-2">
        {selectedFile && (
            <div className="p-2 border border-dashed rounded-md flex items-center justify-between bg-muted/50">
                <div className="flex items-center gap-2 text-sm text-muted-foreground truncate">
                    <Paperclip className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate" title={selectedFile.name}>{selectedFile.name}</span>
                    <span className="text-xs opacity-70 whitespace-nowrap">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSelectedFile(null)} className="h-7 w-7">
                    <XCircle className="h-4 w-4" />
                </Button>
            </div>
        )}
        <div className="flex gap-2 items-start">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
          <Button variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} className="h-10 w-10 flex-shrink-0" title="Adjuntar archivo">
              <Paperclip className="h-5 w-5" />
          </Button>
          <Button variant="outline" size="icon" className="h-10 w-10 flex-shrink-0" title="Usar plantilla de mensaje">
              <Sparkles className="h-5 w-5" />
          </Button>
          <div className="flex-1 relative">
            <Textarea
              ref={chatInputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                  }
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
