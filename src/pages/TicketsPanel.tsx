import React, { useEffect, useState, useCallback, FC, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Ticket as TicketIcon, ChevronDown, ChevronUp, User, ShieldCheck, X, Search, Filter, ListFilter, File, ArrowLeft, XCircle, BellRing, AlertTriangle, Paperclip, Sparkles, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, ApiError } from "@/utils/api";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useDebounce } from '@/hooks/useDebounce';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import AttachmentPreview from "@/components/chat/AttachmentPreview";
import { getAttachmentInfo, deriveAttachmentInfo, AttachmentInfo } from "@/utils/attachment";
import { formatDate } from "@/utils/fecha";
import { useDateSettings } from "@/hooks/useDateSettings";
import { LOCALE_OPTIONS } from "@/utils/localeOptions";
import useRequireRole from "@/hooks/useRequireRole";
import type { Role } from "@/utils/roles";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUser } from '@/hooks/useUser';
import TemplateSelector, { MessageTemplate } from "@/components/tickets/TemplateSelector";
import { formatPhoneNumberForWhatsApp } from "@/utils/phoneUtils";
import TicketList from "@/components/tickets/TicketList";
import { usePusher } from "@/hooks/usePusher";
import { useHotkeys } from "@/hooks/useHotkeys";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

const toast = (globalThis as any).toast || {
  success: (message: string) => console.log("TOAST SUCCESS:", message),
  error: (message: string) => console.error("TOAST ERROR:", message),
  info: (message: string) => console.info("TOAST INFO:", message)
};

// ----------- TIPOS Y ESTADOS -----------
export type TicketStatus = "nuevo" | "en_proceso" | "derivado" | "resuelto" | "cerrado" | "esperando_agente_en_vivo";
export type SlaStatus = "on_track" | "nearing_sla" | "breached" | null;
export type PriorityStatus = "low" | "medium" | "high" | null;

export interface Comment { id: number; comentario: string; fecha: string; es_admin: boolean; }
export interface Ticket {
  id: number; tipo: 'pyme' | 'municipio'; nro_ticket: number; asunto: string; estado: TicketStatus; fecha: string;
  detalles?: string; comentarios?: Comment[]; nombre_usuario?: string; email_usuario?: string; telefono?: string; direccion?: string; archivo_url?: string; categoria?: string;
  municipio_nombre?: string;
  latitud?: number | null;
  longitud?: number | null;
  sla_status?: SlaStatus;
  priority?: PriorityStatus;
  sla_deadline?: string;
}
export interface TicketSummary extends Omit<Ticket, 'detalles' | 'comentarios'> {
  direccion?: string;
  latitud?: number | null;
  longitud?: number | null;
  sla_status?: SlaStatus;
  priority?: PriorityStatus;
}

const ESTADOS_ORDEN_PRIORIDAD: TicketStatus[] = ["nuevo", "en_proceso", "esperando_agente_en_vivo", "derivado", "resuelto", "cerrado"];
export const ESTADOS: Record<TicketStatus, { label: string; tailwind_class: string, icon?: React.ElementType }> = {
  nuevo: { label: "Nuevo", tailwind_class: "bg-blue-500 hover:bg-blue-600 text-white border-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600", icon: TicketIcon },
  en_proceso: { label: "En Proceso", tailwind_class: "bg-yellow-500 hover:bg-yellow-600 text-black border-yellow-700 dark:bg-yellow-400 dark:hover:bg-yellow-500", icon: Loader2 },
  derivado: { label: "Derivado", tailwind_class: "bg-purple-500 hover:bg-purple-600 text-white border-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600" },
  resuelto: { label: "Resuelto", tailwind_class: "bg-green-500 hover:bg-green-600 text-white border-green-700 dark:bg-green-500 dark:hover:bg-green-600" },
  cerrado: { label: "Cerrado", tailwind_class: "bg-gray-500 hover:bg-gray-600 text-white border-gray-700 dark:bg-gray-600 dark:hover:bg-gray-700" },
  esperando_agente_en_vivo: { label: "Esperando agente", tailwind_class: "bg-red-500 hover:bg-red-600 text-white border-red-700 dark:bg-red-500 dark:hover:bg-red-600" }
};

const SLA_STATUS_INFO: Record<NonNullable<SlaStatus>, { label: string; color: string; icon?: React.ElementType }> = {
  on_track: { label: "En tiempo", color: "text-green-600 dark:text-green-400" },
  nearing_sla: { label: "Próximo a vencer", color: "text-yellow-600 dark:text-yellow-400" },
  breached: { label: "Vencido", color: "text-red-600 dark:text-red-400" },
};

const PRIORITY_INFO: Record<NonNullable<PriorityStatus>, { label: string; color: string; badgeClass?: string }> = {
  low: { label: "Baja", color: "text-gray-500 dark:text-gray-400" },
  medium: { label: "Media", color: "text-blue-500 dark:text-blue-400" },
  high: { label: "Alta", color: "text-red-500 dark:text-red-400" },
};

export default function TicketsPanel() {
  useRequireRole(['admin', 'empleado'] as Role[]);
  const navigate = useNavigate();
  const { timezone, locale, updateSettings } = useDateSettings();
  const { user } = useUser();
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [detailedTicket, setDetailedTicket] = useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allTickets, setAllTickets] = useState<TicketSummary[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "">("");
  const [priorityFilter, setPriorityFilter] = useState<PriorityStatus | "">("");

  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const statusSelectRef = useRef<HTMLButtonElement>(null);

  const fetchInitialData = useCallback(async () => {
    // ... (fetch and error handling logic remains the same)
  }, []);

  const channel = usePusher('tickets');

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Pusher event listeners
  useEffect(() => {
    if (!channel) return;

    const newTicketListener = (newTicket: TicketSummary) => {
      setAllTickets(prev => [newTicket, ...prev]);
      toast.info(`Nuevo ticket recibido: #${newTicket.nro_ticket}`);
    };

    const newCommentListener = ({ ticketId, comment }: { ticketId: number, comment: Comment }) => {
      if (detailedTicket && detailedTicket.id === ticketId) {
        // This state update is now local to TicketChat component
      }
      setAllTickets(prev => prev.map(t => t.id === ticketId ? { ...t, detalles: comment.comentario } : t));
    };

    channel.bind('new_ticket', newTicketListener);
    channel.bind('new_comment', newCommentListener);

    return () => {
      channel.unbind('new_ticket', newTicketListener);
      channel.unbind('new_comment', newCommentListener);
    };
  }, [channel, detailedTicket]);

  const groupedTickets = useMemo(() => {
    let filtered = allTickets;
    if (statusFilter) filtered = filtered.filter(t => t.estado === statusFilter);
    if (priorityFilter) filtered = filtered.filter(t => t.priority === priorityFilter);
    if (debouncedSearchTerm) {
         filtered = filtered.filter(ticket => {
              const term = debouncedSearchTerm.toLowerCase();
              const contains = (str: string | null | undefined) => str && str.toLowerCase().includes(term);
              return ticket.id.toString().includes(term) ||
                     ticket.nro_ticket.toString().includes(term) ||
                     contains(ticket.asunto) ||
                     contains(ticket.nombre_usuario) ||
                     contains(ticket.detalles);
          });
    }
    const sorted = filtered.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    const groups: { [key in TicketStatus]?: TicketSummary[] } = {};
    for (const ticket of sorted) {
        if (!groups[ticket.estado]) groups[ticket.estado] = [];
        groups[ticket.estado]!.push(ticket);
    }
    return ESTADOS_ORDEN_PRIORIDAD
        .map(status => ({ categoryName: ESTADOS[status].label, tickets: groups[status] || [] }))
        .filter(group => group.tickets.length > 0);
  }, [allTickets, debouncedSearchTerm, statusFilter, priorityFilter]);

  const loadAndSetDetailedTicket = useCallback(async (ticketSummary: TicketSummary) => {
    setSelectedTicketId(ticketSummary.id);
    setDetailedTicket(null);
    try {
      const data = await apiFetch<Ticket>(`/tickets/${ticketSummary.tipo}/${ticketSummary.id}`, { sendEntityToken: true });
      setDetailedTicket(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al cargar detalle.');
      setSelectedTicketId(null);
    }
  }, []);

  const handleTicketDetailUpdate = (updatedTicket: Ticket) => {
    setDetailedTicket(updatedTicket);
    setAllTickets(prev => prev.map(t => t.id === updatedTicket.id ? { ...t, ...updatedTicket } : t));
  };

  const handleTicketPropertyChange = async (ticketId: number, ticketType: 'pyme' | 'municipio', property: 'estado' | 'priority', value: TicketStatus | PriorityStatus) => {
    const originalTickets = [...allTickets];
    setAllTickets(prev => prev.map(t => t.id === ticketId ? { ...t, [property]: value } : t));
    if (detailedTicket && detailedTicket.id === ticketId) {
      setDetailedTicket({ ...detailedTicket, [property]: value });
    }
    try {
      const endpoint = property === 'estado' ? 'estado' : 'prioridad';
      const updatedTicketData = await apiFetch<Ticket>(`/tickets/${ticketType}/${ticketId}/${endpoint}`, { method: "PUT", body: { [property]: value, user_id: user?.id }, sendEntityToken: true });
      handleTicketDetailUpdate(updatedTicketData);
      toast.success(`Ticket ${property} actualizado.`);
    } catch (error) {
      toast.error(`No se pudo actualizar la propiedad ${property}.`);
      setAllTickets(originalTickets);
    }
  };

  useHotkeys({
    'n': () => {
      const firstNewTicket = allTickets.find(t => t.estado === 'nuevo');
      if (firstNewTicket) loadAndSetDetailedTicket(firstNewTicket);
      else toast.info("No hay tickets nuevos.");
    },
    'r': () => chatInputRef.current?.focus(),
    's': () => statusSelectRef.current?.click(),
  }, [allTickets, loadAndSetDetailedTicket]);

  if (isLoading && allTickets.length === 0) return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-primary h-16 w-16" /></div>;
  if (error) return <div className="p-8 text-center text-destructive">{error}</div>;

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="flex items-center justify-between p-3 border-b dark:border-slate-700">
        {/* Header content */}
      </header>
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={25} minSize={20}>
          <div className="flex flex-col h-full bg-muted/30">
            <div className="p-3 border-b dark:border-slate-700 space-y-3">
              {/* Filter controls */}
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2">
                <TicketList groupedTickets={groupedTickets} selectedTicketId={selectedTicketId} onTicketSelect={loadAndSetDetailedTicket} onToggleSelection={() => {}} isSelectionEnabled={false} />
              </div>
            </ScrollArea>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={75}>
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={60}>
              <AnimatePresence>
                {detailedTicket ? (
                  <motion.div key={detailedTicket.id} className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <TicketChat ticket={detailedTicket} onTicketUpdate={handleTicketDetailUpdate} onClose={() => setSelectedTicketId(null)} chatInputRef={chatInputRef} />
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full"><TicketIcon className="h-20 w-20 text-muted-foreground/40" /><h2>Seleccione un Ticket</h2></div>
                )}
              </AnimatePresence>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={40}>
              <AnimatePresence>
                {detailedTicket ? (
                  <motion.div key={detailedTicket.id + "-details"} className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <TicketDetails ticket={detailedTicket} categoryNames={{}} comentarios={detailedTicket.comentarios || []} onTicketPropertyChange={handleTicketPropertyChange} statusSelectRef={statusSelectRef} />
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full"><User className="h-20 w-20 text-muted-foreground/40" /><h2>Detalles del Ticket</h2></div>
                )}
              </AnimatePresence>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

interface TicketChatProps {
  ticket: Ticket;
  onTicketUpdate: (ticket: Ticket) => void;
  onClose: () => void;
  chatInputRef: React.RefObject<HTMLTextAreaElement>;
}

const TicketChat: FC<TicketChatProps> = ({ ticket, onTicketUpdate, onClose, chatInputRef }) => {
  const { timezone, locale } = useDateSettings();
  const { user } = useUser();
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [comentarios, setComentarios] = useState<Comment[]>(ticket.comentarios || []);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: "smooth" });
  }, []);

  useEffect(() => {
    setComentarios(ticket.comentarios ? [...ticket.comentarios].sort((a,b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()) : []);
    setTimeout(() => scrollToBottom(), 100);
  }, [ticket.id, ticket.comentarios, scrollToBottom]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending) return;
    setIsSending(true);
    const tempId = Date.now();
    const optimisticComment: Comment = { id: tempId, comentario: newMessage, fecha: new Date().toISOString(), es_admin: true };
    setComentarios(prev => [...prev, optimisticComment]);
    setNewMessage("");
    try {
      const updatedTicket = await apiFetch<Ticket>(`/tickets/${ticket.tipo}/${ticket.id}/responder`, { method: "POST", body: { comentario: newMessage }, sendEntityToken: true });
      onTicketUpdate(updatedTicket);
    } catch (error) {
      toast.error("No se pudo enviar el mensaje.");
      setComentarios(prev => prev.filter(c => c.id !== tempId));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-3 border-b flex items-center justify-between">
        <h2 className="text-md font-semibold truncate">{ticket.asunto}</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4" ref={chatContainerRef}>
        <div className="space-y-4">
          {comentarios.map((comment) => (
            <div key={comment.id} className={cn('flex items-end gap-2.5', comment.es_admin ? 'justify-end' : 'justify-start')}>
              {!comment.es_admin && <AvatarIcon type="user" />}
              <div className="flex flex-col space-y-1 max-w-lg">
                <div className={cn('rounded-2xl px-4 py-2.5 shadow-md', comment.es_admin ? 'bg-primary text-primary-foreground rounded-br-lg' : 'bg-card text-foreground border rounded-bl-lg')}>
                  <p className="break-words whitespace-pre-wrap">{comment.comentario}</p>
                </div>
                <p className={cn("text-xs text-muted-foreground", comment.es_admin ? "text-right" : "text-left")}>{formatDate(comment.fecha, timezone, locale, { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              {comment.es_admin && <AvatarIcon type="admin" />}
            </div>
          ))}
        </div>
      </div>
      <div className="border-t p-3 bg-card">
        <div className="relative">
          <Textarea ref={chatInputRef} value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }}} placeholder="Escribe tu mensaje..." disabled={isSending} className="pr-24 min-h-[48px] rounded-full resize-none" rows={1} />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
            <Button size="icon" onClick={handleSendMessage} disabled={isSending || !newMessage.trim()} className="rounded-full"><Send className="h-5 w-5" /></Button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface TicketDetailsProps {
  ticket: Ticket;
  categoryNames: Record<string, string>;
  comentarios: Comment[];
  onTicketPropertyChange: (ticketId: number, ticketType: 'pyme' | 'municipio', property: 'estado' | 'priority', value: TicketStatus | PriorityStatus) => void;
  statusSelectRef: React.RefObject<HTMLButtonElement>;
}

const TicketDetails: FC<TicketDetailsProps> = ({ ticket, categoryNames, comentarios, onTicketPropertyChange, statusSelectRef }) => {
  const { timezone, locale } = useDateSettings();
  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${type} copiado`);
  };

  return (
    <div className="h-full bg-card/50 dark:bg-slate-800/50 border-l">
      <ScrollArea className="h-full">
        <div className="p-4 space-y-4">
          <Card>
            <CardHeader><CardTitle>Usuario</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-3">
               {/* User details */}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Detalles del Ticket</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-3">
              <div className="flex justify-between items-center">
                <span>Prioridad</span>
                <Select value={ticket.priority || 'low'} onValueChange={(p: PriorityStatus) => onTicketPropertyChange(ticket.id, ticket.tipo, 'priority', p)}>
                  <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(PRIORITY_INFO).map(([key, { label }]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex justify-between items-center">
                <span>Estado</span>
                <Select value={ticket.estado} onValueChange={(s: TicketStatus) => onTicketPropertyChange(ticket.id, ticket.tipo, 'estado', s)}>
                  <SelectTrigger ref={statusSelectRef} className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(ESTADOS).map(([key, { label }]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {/* Other details */}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
};

const AvatarIcon: FC<{ type: 'user' | 'admin' }> = ({ type }) => (
  <div className={cn('h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0', type === 'admin' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
    {type === 'admin' ? <ShieldCheck className="h-4 w-4" /> : <User className="h-4 w-4" />}
  </div>
);

// Dummy components to avoid breaking the code, should be replaced by actual components
const TicketMap: FC<any> = () => null;
