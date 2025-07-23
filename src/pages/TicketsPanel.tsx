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
import ClientInfoPanel from "@/components/tickets/ClientInfoPanel";
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
  const [categoryFilter, setCategoryFilter] = useState<string | "">("");

  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const statusSelectRef = useRef<HTMLButtonElement>(null);

  const fetchInitialData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{tickets: TicketSummary[]}>("/tickets", { sendEntityToken: true });
      setAllTickets(data.tickets);
    } catch (err) {
      const errorMessage = err instanceof ApiError ? err.message : "Error al cargar los tickets. Por favor, intente de nuevo más tarde.";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
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

  const categories = useMemo(() => {
    const allCategories = allTickets.map(t => t.categoria).filter(Boolean);
    return [...new Set(allCategories)];
  }, [allTickets]);

  const groupedTickets = useMemo(() => {
    let filtered = allTickets;
    if (statusFilter) filtered = filtered.filter(t => t.estado === statusFilter);
    if (priorityFilter) filtered = filtered.filter(t => t.priority === priorityFilter);
    if (categoryFilter) filtered = filtered.filter(t => t.categoria === categoryFilter);
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
    const safeFiltered = Array.isArray(filtered) ? filtered : [];
    const sorted = safeFiltered.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
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
              <Input placeholder="Buscar tickets..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              <div className="flex space-x-2">
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as TicketStatus | "")}>
                  <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos los estados</SelectItem>
                    {Object.entries(ESTADOS).map(([key, { label }]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as PriorityStatus | "")}>
                  <SelectTrigger><SelectValue placeholder="Prioridad" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas las prioridades</SelectItem>
                    {Object.entries(PRIORITY_INFO).map(([key, { label }]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as string | "")}>
                  <SelectTrigger><SelectValue placeholder="Categoría" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas las categorías</SelectItem>
                    {categories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2">
                <TicketList groupedTickets={groupedTickets} selectedTicketId={selectedTicketId} onTicketSelect={loadAndSetDetailedTicket} onToggleSelection={() => {}} isSelectionEnabled={false} />
              </div>
            </ScrollArea>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={50}>
          <AnimatePresence>
            {detailedTicket ? (
              <motion.div key={detailedTicket.id} className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <TicketChat ticket={detailedTicket} onTicketUpdate={handleTicketDetailUpdate} onClose={() => setSelectedTicketId(null)} chatInputRef={chatInputRef} />
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full"><TicketIcon className="h-20 w-20 text-muted-foreground/40" /><h2>Seleccione un Ticket</h2></div>
            )}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => fetchInitialData()} className="h-9" disabled={isLoading}>
          {isLoading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Filter className="h-4 w-4" />}
          <span className="ml-2 hidden sm:inline">Actualizar</span>
        </Button>
      </div>
    </header>

  <main className="flex flex-1 overflow-hidden min-h-0">
      {/* Panel de Lista de Tickets (Izquierda) */}
      <div
        className={cn(
          "w-full md:w-2/5 lg:w-1/3 xl:w-1/4 border-r dark:border-slate-700 bg-card dark:bg-slate-800/50 flex flex-col h-full min-h-0 transition-all duration-300 ease-in-out",
          selectedTicketId ? "hidden md:flex" : "flex"
        )}
      >
        <ScrollArea className="flex-1 p-3">
          {isLoading && allTickets.length === 0 && !error ? (
            <div className="p-4 text-center text-sm text-muted-foreground flex items-center justify-center h-full">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando tickets...
            </div>
          ) : isLoading && allTickets.length > 0 ? (
            <div className="p-2 text-center text-xs text-muted-foreground flex items-center justify-center">
              <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> Actualizando lista...
            </div>
          ) : !isLoading && filteredAndSortedGroups.length === 0 && !error ? (
            <div className="text-center py-10 px-4 h-full flex flex-col justify-center items-center">
              <TicketIcon className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-base font-medium text-foreground">No hay tickets</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchTerm || statusFilter || categoryFilter
                  ? "Ningún ticket coincide con tus filtros."
                  : "Cuando se genere un nuevo reclamo, aparecerá aquí."}
              </p>
            </div>
          ) : filteredAndSortedGroups.length > 0 ? (
            <div className="w-full space-y-1">
              {filteredAndSortedGroups.map(group => (
                <div key={group.categoryName} className="mb-4">
                  <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-2 py-2 rounded-md bg-muted/50 dark:bg-slate-700/50">
                    <div className="flex items-center justify-between w-full">
                      <span>{group.categoryName}</span>
                      <Badge variant="secondary">{group.tickets.length}</Badge>
                    </div>
                  </div>
                  <div className="pt-1 space-y-1.5">
                    {group.tickets.map(ticket => (
                      <TicketListItem
                        key={ticket.id}
                        ticket={ticket}
                        isSelected={selectedTicketId === ticket.id}
                        onSelect={() => loadAndSetDetailedTicket(ticket)}
                        timezone={timezone}
                        locale={locale}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </ScrollArea>
      </div>

      {/* Panel Central (Chat) y Panel Derecho (Detalles) */}
      <div className="flex-1 flex flex-col bg-background dark:bg-slate-900 overflow-hidden">
        <AnimatePresence>
          {selectedTicketId && detailedTicket ? (
            <motion.div
              key={selectedTicketId}
              className="flex-1 flex overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <TicketDetail_Refactored
                ticket={detailedTicket}
                onTicketUpdate={handleTicketDetailUpdate}
                onClose={closeDetailPanel}
                categoryNames={categoryNames}
              />
            </motion.div>
          ) : (
            <div className="hidden md:flex flex-col items-center justify-center h-full p-8 text-center bg-muted/50 dark:bg-slate-800/20">
                <TicketIcon className="h-16 w-16 text-muted-foreground/50" strokeWidth={1} />
                <h2 className="mt-4 text-xl font-semibold text-foreground">Seleccione un Ticket</h2>
                <p className="mt-1 text-muted-foreground">Elija un ticket de la lista para ver sus detalles, historial y responder.</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </main>
  </div>
);
}

const TicketTimeline: FC<{ ticket: Ticket; comentarios: Comment[] }> = ({ ticket, comentarios }) => {
  const { timezone, locale } = useDateSettings();
  const [verTodo, setVerTodo] = useState(false);

  const eventos = useMemo(() => [
    { fecha: ticket.fecha, descripcion: "Ticket creado", esAdmin: false },
    ...(comentarios || []).map((c) => ({
          fecha: c.fecha,
          descripcion: c.es_admin ? "Respuesta de Chatboc" : "Comentario de usuario",
          esAdmin: c.es_admin,
        })),
  ].sort((a,b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()), [ticket.fecha, comentarios]);


  const MAX_EVENTOS_RESUMIDOS = 3;
  const eventosVisibles = verTodo ? eventos : eventos.slice(-MAX_EVENTOS_RESUMIDOS);

  if(eventos.length === 0 && ticket.fecha) {
    eventosVisibles.push({ fecha: ticket.fecha, descripcion: "Ticket creado", esAdmin: false });
  }
  if(eventosVisibles.length === 0) return null;


  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-base font-semibold">Historial de Actividad</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 text-xs">
        {eventosVisibles.length > 0 ? (
        <ol className="relative border-l border-border dark:border-slate-700 ml-1">
          {eventosVisibles.map((ev, i) => (
            <li key={i} className="mb-3 ml-4">
              <div className={cn(
                  "absolute w-3 h-3 rounded-full mt-1.5 -left-1.5 border border-white dark:border-slate-800",
                  ev.esAdmin ? "bg-primary" : "bg-muted-foreground/50"
              )} />
              <time className="text-xs font-normal leading-none text-muted-foreground/80">
                {formatDate(ev.fecha, timezone, locale)}
              </time>
              <p className="text-sm font-medium text-foreground whitespace-pre-wrap break-words">{ev.descripcion}</p>
            </li>
          ))}
        </ol>
        ) : (
          <p className="text-sm text-muted-foreground">No hay actividad registrada.</p>
        )}
        {eventos.length > MAX_EVENTOS_RESUMIDOS && (
          <Button
            variant="link"
            size="sm"
            className="mt-1 text-xs px-0 h-auto py-0"
            onClick={() => setVerTodo((v) => !v)}
          >
            {verTodo ? "Ver menos" : `Ver ${eventos.length - MAX_EVENTOS_RESUMIDOS} más...`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

const buildFullAddress = (ticket: Ticket) => {
  const direccion = ticket.direccion || "";
  if (
    ticket.tipo !== "pyme" &&
    ticket.municipio_nombre &&
    !direccion.toLowerCase().includes(ticket.municipio_nombre.toLowerCase())
  ) {
    return `${direccion ? `${direccion}, ` : ""}${ticket.municipio_nombre}`;
  }
  return direccion;
};

const TicketMap: FC<{ ticket: Ticket }> = ({ ticket }) => {
  const direccionCompleta = buildFullAddress(ticket);
  const hasCoords =
    typeof ticket.latitud === 'number' && typeof ticket.longitud === 'number';

  if (!ticket.direccion && !hasCoords) return null;

  const mapSrc = hasCoords
    ? `https://www.google.com/maps?q=${ticket.latitud},${ticket.longitud}&output=embed&z=15`
    : `https://www.google.com/maps?q=${encodeURIComponent(direccionCompleta)}&output=embed&z=15`;

  return (
    <Card className="shadow-sm">
        <CardHeader  className="pb-3 pt-4 px-4">
            <CardTitle className="text-base font-semibold">Ubicación</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
            <div className="w-full rounded-md overflow-hidden aspect-video border dark:border-slate-700">
                <iframe
                title="Ticket Location Map"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                src={mapSrc}
                />
            </div>
            {direccionCompleta && <div className="text-xs mt-2 text-muted-foreground truncate" title={direccionCompleta}>{direccionCompleta}</div>}
        </CardContent>
    </Card>
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

        <div className={cn(
            "flex-1 grid grid-cols-1 overflow-hidden h-full min-h-0",
            isDetailOpen ? "md:grid-cols-3" : "md:grid-cols-2"
        )}>
            {/* Panel de Chat (Centro) */}
            <div className="col-span-1 md:col-span-2 flex flex-col p-2 md:p-4 bg-background dark:bg-slate-700/30 md:border-r dark:border-slate-700">
                {!chatEnVivo && (
                    <div className="p-2 flex justify-end">
                        <Button size="sm" variant="outline" onClick={() => fetchComentarios(true)} className="text-xs h-8">
                            Actualizar mensajes
                        </Button>
                    </div>
                )}
                <ScrollArea className="flex-1 pr-2">
                    <main className="space-y-3 p-1">
                        {comentarios && comentarios.length > 0 ? (
                            [...comentarios].reverse().map((comment) => {
                                const attachment = getAttachmentInfo(comment.comentario);
                                return (
                                    <div
                                        key={comment.id}
                                        className={cn(
                                            'flex items-end gap-2 text-sm',
                                            comment.es_admin ? 'justify-end' : 'justify-start'
                                        )}
                                    >
                                        {!comment.es_admin && <AvatarIcon type="user" />}
                                        <div
                                            className={cn(
                                                'max-w-lg md:max-w-md lg:max-w-lg rounded-xl px-3.5 py-2.5 shadow-sm',
                                                comment.es_admin
                                                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                                                    : 'bg-card dark:bg-slate-800 text-foreground border dark:border-slate-700/80 rounded-bl-sm',
                                                typeof comment.id === 'string' && comment.id.startsWith('client-file-') && comment.es_admin
                                                    ? 'bg-primary/80 border border-primary/50'
                                                    : typeof comment.id === 'string' && comment.id.startsWith('client-file-')
                                                        ? 'bg-muted border border-border'
                                                        : ''
                                            )}
                                        >
                                            {attachment ? (
                                                <AttachmentPreview attachment={attachment} />
                                            ) : (
                                                <p className="break-words whitespace-pre-wrap">{comment.comentario}</p>
                                            )}
                                            <p className={cn(
                                                "text-xs opacity-70 mt-1.5",
                                                comment.es_admin ? "text-primary-foreground/80 text-right" : "text-muted-foreground text-right"
                                            )}>
                                                {formatDate(comment.fecha, timezone, locale)}
                                            </p>
                                        </div>
                                        {comment.es_admin && <AvatarIcon type="admin" />}
                                    </div>
                                );
                            })
                        ) : (
                            <div className="text-center text-muted-foreground py-10">
                                No hay comentarios para este ticket.
                            </div>
                        )}
                        <div ref={chatBottomRef} />
                    </main>
                </ScrollArea>
                <footer className="border-t dark:border-slate-700/80 p-2 md:p-3 mt-2 flex flex-col gap-2 flex-shrink-0 sticky bottom-0 bg-background dark:bg-slate-900">
                    {selectedFile && (
                        <div className="p-2 border border-dashed dark:border-slate-600 rounded-md flex items-center justify-between bg-muted/50 dark:bg-slate-800/30">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground truncate">
                                <File className="h-4 w-4 flex-shrink-0" />
                                <span className="truncate" title={selectedFile.name}>{selectedFile.name}</span>
                                <span className="text-xs opacity-70 whitespace-nowrap">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setSelectedFile(null)} className="h-7 w-7">
                                <XCircle className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                    <div className="flex gap-2 items-center">
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
                        <Button variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} className="h-10 w-10 flex-shrink-0" title="Adjuntar archivo">
                            <Paperclip className="h-5 w-5" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => setIsTemplateSelectorOpen(true)} className="h-10 w-10 flex-shrink-0" title="Usar plantilla de mensaje">
                            <Sparkles className="h-5 w-5" />
                        </Button>
                        <Input
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey && (newMessage.trim() || selectedFile)) {
                                    e.preventDefault();
                                    handleSendMessage();
                                }
                            }}
                            placeholder="Escribe una respuesta..."
                            disabled={isSending}
                            className="h-10 bg-card dark:bg-slate-800 focus-visible:ring-primary/50"
                        />
                        <Button
                            onClick={handleSendMessage}
                            disabled={isSending || (!newMessage.trim() && !selectedFile)}
                            aria-label="Enviar Mensaje" className="h-10"
                        >
                            {isSending ? <Loader2 className="animate-spin h-5 w-5" /> : <Send className="h-5 w-5" />}
                        </Button>
                    </div>
                </footer>
            </div>

            {/* Panel de Detalles (Derecha) */}
            {isDetailOpen && (
            <div className="col-span-1 hidden md:flex flex-col h-full min-h-0">
                <ScrollArea className="h-full p-3 md:p-4 bg-card dark:bg-slate-800/50 border-t md:border-t-0 md:border-l dark:border-slate-700">
                    <Accordion type="multiple" className="space-y-2">
                        {(ticket.priority || ticket.sla_status) && (
                          <AccordionItem value="priority" className="rounded-lg border shadow-sm">
                            <AccordionTrigger className="px-4 py-3 text-left text-base font-semibold">Prioridad y SLA</AccordionTrigger>
                            <AccordionContent className="px-4 pb-4 text-sm text-muted-foreground space-y-1.5">
                              {ticket.priority && PRIORITY_INFO[ticket.priority] && (
                                <p><strong>Prioridad:</strong> <span className={cn(PRIORITY_INFO[ticket.priority]?.color)}>{PRIORITY_INFO[ticket.priority]?.label}</span></p>
                              )}
                              {ticket.sla_status && SLA_STATUS_INFO[ticket.sla_status] && (
                                <p><strong>SLA:</strong> <span className={cn(SLA_STATUS_INFO[ticket.sla_status]?.color)}>{SLA_STATUS_INFO[ticket.sla_status]?.label}</span></p>
                              )}
                              {ticket.sla_deadline && (
                                <p><strong>Vencimiento SLA:</strong> {formatDate(ticket.sla_deadline, timezone, locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                              )}
                            </AccordionContent>
                          </AccordionItem>
                        )}

                        {(ticket.nombre_usuario || ticket.email_usuario || ticket.telefono) && (
                            <AccordionItem value="usuario" className="rounded-lg border shadow-sm">
                                <AccordionTrigger className="px-4 py-3 text-left text-base font-semibold flex items-center gap-2">
                                    <User className="h-4 w-4 text-muted-foreground"/> Información del Usuario
                                </AccordionTrigger>
                                <AccordionContent className="px-4 pb-4 text-sm text-muted-foreground space-y-1.5">
                                    {ticket.nombre_usuario && <p><strong>Nombre:</strong> {ticket.nombre_usuario}</p>}
                                    {ticket.email_usuario && <p><strong>Email:</strong> <a href={`mailto:${ticket.email_usuario}`} className="text-primary hover:underline">{ticket.email_usuario}</a></p>}
                                    {ticket.telefono && (
                                        <div className="flex items-center gap-2">
                                            <p className="flex-shrink-0"><strong>Teléfono:</strong></p>
                                            <a href={`tel:${ticket.telefono}`} className="text-primary hover:underline truncate" title={ticket.telefono}>{ticket.telefono}</a>
                                            {(() => {
                                                const formattedPhone = formatPhoneNumberForWhatsApp(ticket.telefono);
                                                if (formattedPhone) {
                                                    const adminName = user?.name || 'el equipo del municipio';
                                                    const municipioName = ticket.municipio_nombre || 'el municipio';
                                                    const messageText = `Hola ${ticket.nombre_usuario || 'vecino/a'}, le contactamos desde ${municipioName} (agente: ${adminName}) en relación a su ticket N°${ticket.nro_ticket || '[Nro Ticket]'}.`;
                                                    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(messageText)}`;
                                                    return (
                                                        <a
                                                            href={whatsappUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            title="Enviar mensaje de WhatsApp"
                                                            className="ml-1 flex-shrink-0"
                                                        >
                                                            <MessageSquare className="h-4 w-4 text-green-600 hover:text-green-700 cursor-pointer" />
                                                        </a>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </div>
                                    )}
                                </AccordionContent>
                            </AccordionItem>
                        )}

                        <AccordionItem value="historial" className="rounded-lg border shadow-sm">
                            <AccordionTrigger className="px-4 py-3 text-left text-base font-semibold">Historial de Actividad</AccordionTrigger>
                            <AccordionContent className="px-0 pb-0">
                                <TicketTimeline ticket={ticket} comentarios={comentarios} />
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="descripcion" className="rounded-lg border shadow-sm">
                            <AccordionTrigger className="px-4 py-3 text-left text-base font-semibold">Descripción del Reclamo</AccordionTrigger>
                            <AccordionContent className="px-4 pb-4 text-sm text-muted-foreground whitespace-pre-wrap break-words">
                                {ticket.pregunta || ticket.detalles || "No hay descripción detallada disponible."}
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="ubicacion" className="rounded-lg border shadow-sm">
                            <AccordionTrigger className="px-4 py-3 text-left text-base font-semibold">Ubicación</AccordionTrigger>
                            <AccordionContent className="px-0 pb-0">
                                <TicketMap ticket={ticket} />
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="archivos" className="rounded-lg border shadow-sm">
                            <AccordionTrigger className="px-4 py-3 text-left text-base font-semibold">Archivos Adjuntos</AccordionTrigger>
                            <AccordionContent className="px-4 pb-4 space-y-2">
                                {(ticket.archivos_adjuntos && ticket.archivos_adjuntos.length > 0) ? (
                                    ticket.archivos_adjuntos.map((adj, index) => {
                                        const attachmentInfoForPreview: AttachmentInfo = deriveAttachmentInfo(
                                            adj.url,
                                            adj.name,
                                            adj.mimeType,
                                            adj.size
                                        );
                                        if (attachmentInfoForPreview.url.startsWith('/')) {
                                            const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/api$/, '');
                                            if (apiUrl) {
                                                attachmentInfoForPreview.url = `${apiUrl}${attachmentInfoForPreview.url}`;
                                            }
                                        }
                                        return (
                                            <AttachmentPreview key={adj.id || index} attachment={attachmentInfoForPreview} />
                                        );
                                    })
                                ) : (
                                    <p className="text-sm text-muted-foreground">No hay archivos adjuntos para este ticket.</p>
                                )}
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="detalles" className="rounded-lg border shadow-sm">
                            <AccordionTrigger className="px-4 py-3 text-left text-base font-semibold">Detalles del Ticket</AccordionTrigger>
                            <AccordionContent className="px-4 pb-4 text-sm text-muted-foreground space-y-1.5">
                                <p><strong>Categoría:</strong> {categoryNames[ticket.categoria || ''] || ticket.categoria || "No especificada"}</p>
                                <p><strong>Tipo:</strong> {ticket.tipo}</p>
                                {ticket.municipio_nombre && <p><strong>Municipio:</strong> {ticket.municipio_nombre}</p>}
                                <p><strong>Creado:</strong> {formatDate(ticket.fecha, timezone, locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </ScrollArea>
            </div>
            )}
        </div>
      </div>
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
