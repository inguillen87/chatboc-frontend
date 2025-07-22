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
import AttachmentPreview from "@/components/chat/AttachmentPreview";
import { getAttachmentInfo, deriveAttachmentInfo, AttachmentInfo } from "@/utils/attachment";
import { formatDate } from "@/utils/fecha";
import { useDateSettings } from "@/hooks/useDateSettings";
import { LOCALE_OPTIONS } from "@/utils/localeOptions";
import useRequireRole from "@/hooks/useRequireRole";
import type { Role } from "@/utils/roles";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUser } from '@/hooks/useUser';
import TemplateSelector from "@/components/tickets/TemplateSelector";
import { formatPhoneNumberForWhatsApp } from "@/utils/phoneUtils";

const toast = (globalThis as any).toast || {
  success: (message: string) => console.log("TOAST SUCCESS:", message),
  error: (message: string) => console.error("TOAST ERROR:", message),
  info: (message: string) => console.info("TOAST INFO:", message)
};

// Types and constants
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
  archivos_adjuntos?: any[];
  pregunta?: string;
}
export interface TicketSummary extends Omit<Ticket, 'detalles' | 'comentarios'> {
  direccion?: string;
  latitud?: number | null;
  longitud?: number | null;
  sla_status?: SlaStatus;
  priority?: PriorityStatus;
}
export interface GroupedTickets {
  categoryName: string;
  tickets: TicketSummary[];
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
  low: { label: "Baja", color: "text-gray-500 dark:text-gray-400", badgeClass: "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-500" },
  medium: { label: "Media", color: "text-blue-500 dark:text-blue-400", badgeClass: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-700 dark:text-blue-200 dark:border-blue-500" },
  high: { label: "Alta", color: "text-red-500 dark:text-red-400", badgeClass: "bg-red-100 text-red-700 border-red-300 dark:bg-red-700 dark:text-red-200 dark:border-red-500" },
};

// Components
const TicketListItem: FC<{ ticket: TicketSummary; isSelected: boolean; onSelect: () => void; }> = React.memo(({ ticket, isSelected, onSelect }) => {
    let cardClasses = "bg-card dark:bg-slate-800 border-border dark:border-slate-700/80 hover:border-slate-400 dark:hover:border-slate-500";
    if (isSelected) {
        cardClasses = "bg-primary/10 border-primary dark:bg-primary/20 dark:border-primary ring-1 ring-primary";
    } else if (ticket.sla_status === 'breached') {
        cardClasses = "bg-red-500/10 border-red-500/30 dark:bg-red-700/20 dark:border-red-600/40 hover:border-red-500";
    } else if (ticket.sla_status === 'nearing_sla') {
        cardClasses = "bg-yellow-500/10 border-yellow-500/30 dark:bg-yellow-700/20 dark:border-yellow-600/40 hover:border-yellow-500";
    }

    return (
        <motion.div
            layout
            onClick={onSelect}
            className={cn("p-3 rounded-lg border cursor-pointer mb-2 transition-all duration-200 ease-in-out", "hover:shadow-md dark:hover:bg-slate-700/60", cardClasses)}
            whileHover={{ y: -2 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
        >
            <div className="flex justify-between items-start mb-1">
                <span className="font-semibold text-primary text-xs truncate max-w-[80px] flex-shrink-0" title={`#${ticket.nro_ticket}`}>#{ticket.nro_ticket}</span>
                <Badge className={cn("text-xs border", ESTADOS[ticket.estado]?.tailwind_class)}>{ESTADOS[ticket.estado]?.label}</Badge>
            </div>
            <p className="font-medium text-foreground truncate text-xs" title={ticket.asunto}>{ticket.asunto}</p>
            {ticket.nombre_usuario && <p className="text-xs text-muted-foreground truncate mt-0.5" title={ticket.nombre_usuario}>{ticket.nombre_usuario}</p>}
        </motion.div>
    );
});

const TicketList: FC<{ groupedTickets: GroupedTickets[]; selectedTicketId: number | null; onTicketSelect: (ticket: TicketSummary) => void; }> = ({ groupedTickets, selectedTicketId, onTicketSelect }) => (
    <div className="w-full space-y-1">
        {groupedTickets.map(group => (
            <div key={group.categoryName} className="mb-4">
                <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-2 py-2 rounded-md bg-muted/50 dark:bg-slate-700/50">
                    <div className="flex items-center justify-between w-full">
                        <span>{group.categoryName}</span>
                        <Badge variant="secondary">{group.tickets.length}</Badge>
                    </div>
                </div>
                <div className="pt-1 space-y-1.5">
                    {group.tickets.map(ticket => (
                        <TicketListItem key={ticket.id} ticket={ticket} isSelected={selectedTicketId === ticket.id} onSelect={() => onTicketSelect(ticket)} />
                    ))}
                </div>
            </div>
        ))}
    </div>
);

const ChatPanel: FC<any> = ({ ticket, comentarios, onSendMessage, chatEnVivo, fetchComentarios }) => {
    const { timezone, locale } = useDateSettings();
    const [newMessage, setNewMessage] = useState("");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [isTemplateSelectorOpen, setIsTemplateSelectorOpen] = useState(false);
    const chatBottomRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { user } = useUser();

    useEffect(() => {
        const container = chatBottomRef.current?.parentElement;
        if (container && chatBottomRef.current) {
            const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
            if (atBottom) {
                setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
            }
        }
    }, [comentarios.length]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            setSelectedFile(event.target.files[0]);
        }
    };

    const handleSendMessage = async () => {
        if ((!newMessage.trim() && !selectedFile) || isSending) return;
        setIsSending(true);
        await onSendMessage(newMessage, selectedFile);
        setNewMessage("");
        setSelectedFile(null);
        setIsSending(false);
    };

    return (
        <div className="flex-1 flex flex-col bg-background dark:bg-slate-700/30">
            {!chatEnVivo && (
                <div className="p-2 flex justify-end border-b dark:border-slate-700">
                    <Button size="sm" variant="outline" onClick={() => fetchComentarios(true)} className="text-xs h-8">Actualizar mensajes</Button>
                </div>
            )}
            <ScrollArea className="flex-1 pr-2">
                <main className="space-y-3 p-4">
                    {comentarios && comentarios.length > 0 ? (
                        [...comentarios].reverse().map((comment) => (
                            <div key={comment.id} className={cn('flex items-end gap-2 text-sm', comment.es_admin ? 'justify-end' : 'justify-start')}>
                                {!comment.es_admin && <User className="h-8 w-8 rounded-full border p-1" />}
                                <div className={cn('max-w-lg md:max-w-md lg:max-w-lg rounded-xl px-3.5 py-2.5 shadow-sm', comment.es_admin ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-card dark:bg-slate-800 text-foreground border dark:border-slate-700/80 rounded-bl-sm')}>
                                    <p className="break-words whitespace-pre-wrap">{comment.comentario}</p>
                                    <p className={cn("text-xs opacity-70 mt-1.5", comment.es_admin ? "text-primary-foreground/80 text-right" : "text-muted-foreground text-right")}>
                                        {formatDate(comment.fecha, timezone, locale)}
                                    </p>
                                </div>
                                {comment.es_admin && <ShieldCheck className="h-8 w-8 rounded-full border p-1" />}
                            </div>
                        ))
                    ) : (
                        <div className="text-center text-muted-foreground py-10">No hay comentarios para este ticket.</div>
                    )}
                    <div ref={chatBottomRef} />
                </main>
            </ScrollArea>
            <footer className="border-t dark:border-slate-700/80 p-2 md:p-3 mt-2 flex flex-col gap-2 flex-shrink-0 bg-background dark:bg-slate-900">
                {selectedFile && (
                    <div className="p-2 border border-dashed dark:border-slate-600 rounded-md flex items-center justify-between bg-muted/50 dark:bg-slate-800/30">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground truncate">
                            <File className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate" title={selectedFile.name}>{selectedFile.name}</span>
                            <span className="text-xs opacity-70 whitespace-nowrap">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setSelectedFile(null)} className="h-7 w-7"><XCircle className="h-4 w-4" /></Button>
                    </div>
                )}
                <div className="flex gap-2 items-center">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
                    <Button variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} className="h-10 w-10 flex-shrink-0" title="Adjuntar archivo"><Paperclip className="h-5 w-5" /></Button>
                    <Button variant="outline" size="icon" onClick={() => setIsTemplateSelectorOpen(true)} className="h-10 w-10 flex-shrink-0" title="Usar plantilla de mensaje"><Sparkles className="h-5 w-5" /></Button>
                    <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                        placeholder="Escribe una respuesta..."
                        disabled={isSending}
                        className="h-10 bg-card dark:bg-slate-800 focus-visible:ring-primary/50"
                    />
                    <Button onClick={handleSendMessage} disabled={isSending || (!newMessage.trim() && !selectedFile)} aria-label="Enviar Mensaje" className="h-10">
                        {isSending ? <Loader2 className="animate-spin h-5 w-5" /> : <Send className="h-5 w-5" />}
                    </Button>
                </div>
            </footer>
            <TemplateSelector
                isOpen={isTemplateSelectorOpen}
                onClose={() => setIsTemplateSelectorOpen(false)}
                onSelectTemplate={(templateText) => {
                    setNewMessage(prev => prev ? `${prev} ${templateText}` : templateText);
                    setIsTemplateSelectorOpen(false);
                }}
            />
        </div>
    );
};

const DetailsPanel: FC<any> = ({ ticket, categoryNames }) => {
    const { timezone, locale } = useDateSettings();
    const { user } = useUser();
    if (!ticket) return null;

    return (
        <ScrollArea className="h-full p-3 md:p-4 space-y-4 bg-card dark:bg-slate-800/50">
            {(ticket.priority || ticket.sla_status) && (
              <Card className="shadow-sm">
                <CardHeader className="pb-3 pt-4 px-4"><CardTitle className="text-base font-semibold">Prioridad y SLA</CardTitle></CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-1.5 px-4 pb-4">
                  {ticket.priority && PRIORITY_INFO[ticket.priority] && (<p><strong>Prioridad:</strong> <span className={cn(PRIORITY_INFO[ticket.priority]?.color)}>{PRIORITY_INFO[ticket.priority]?.label}</span></p>)}
                  {ticket.sla_status && SLA_STATUS_INFO[ticket.sla_status] && (<p><strong>SLA:</strong> <span className={cn(SLA_STATUS_INFO[ticket.sla_status]?.color)}>{SLA_STATUS_INFO[ticket.sla_status]?.label}</span></p>)}
                  {ticket.sla_deadline && (<p><strong>Vencimiento SLA:</strong> {formatDate(ticket.sla_deadline, timezone, locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>)}
                </CardContent>
              </Card>
            )}

            {(ticket.nombre_usuario || ticket.email_usuario || ticket.telefono) && (
                <Card className="shadow-sm">
                    <CardHeader className="pb-3 pt-4 px-4"><CardTitle className="text-base font-semibold flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground"/> Información del Usuario</CardTitle></CardHeader>
                    <CardContent className="text-sm text-muted-foreground space-y-1.5 px-4 pb-4">
                        {ticket.nombre_usuario && <p><strong>Nombre:</strong> {ticket.nombre_usuario}</p>}
                        {ticket.email_usuario && <p><strong>Email:</strong> <a href={`mailto:${ticket.email_usuario}`} className="text-primary hover:underline">{ticket.email_usuario}</a></p>}
                        {ticket.telefono && (
                            <div className="flex items-center gap-2">
                                <p className="flex-shrink-0"><strong>Teléfono:</strong></p>
                                <a href={`tel:${ticket.telefono}`} className="text-primary hover:underline truncate" title={ticket.telefono}>{ticket.telefono}</a>
                                {(() => {
                                    const formattedPhone = formatPhoneNumberForWhatsApp(ticket.telefono);
                                    if (formattedPhone) {
                                        const adminName = user?.name || 'el equipo';
                                        const municipioName = ticket.municipio_nombre || 'el municipio';
                                        const messageText = `Hola ${ticket.nombre_usuario || ''}, te contactamos desde ${municipioName} (agente: ${adminName}) sobre tu ticket N°${ticket.nro_ticket || ''}.`;
                                        const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(messageText)}`;
                                        return <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" title="Enviar WhatsApp"><MessageSquare className="h-4 w-4 text-green-600 hover:text-green-700" /></a>;
                                    }
                                    return null;
                                })()}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            <Card className="shadow-sm">
                <CardHeader className="pb-3 pt-4 px-4"><CardTitle className="text-base font-semibold">Descripción del Reclamo</CardTitle></CardHeader>
                <CardContent className="px-4 pb-4 text-sm text-muted-foreground whitespace-pre-wrap break-words">{ticket.pregunta || ticket.detalles || "No hay descripción."}</CardContent>
            </Card>

            <Card className="shadow-sm">
                <CardHeader className="pb-3 pt-4 px-4"><CardTitle className="text-base font-semibold">Detalles del Ticket</CardTitle></CardHeader>
                 <CardContent className="text-sm text-muted-foreground space-y-1.5 px-4 pb-4">
                    <p><strong>Categoría:</strong> {categoryNames[ticket.categoria || ''] || ticket.categoria || "No especificada"}</p>
                    <p><strong>Tipo:</strong> {ticket.tipo}</p>
                    {ticket.municipio_nombre && <p><strong>Municipio:</strong> {ticket.municipio_nombre}</p>}
                    <p><strong>Creado:</strong> {formatDate(ticket.fecha, timezone, locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                 </CardContent>
            </Card>
        </ScrollArea>
    );
};


// Main component
export default function TicketsPanel() {
    useRequireRole(['admin', 'empleado'] as Role[]);
    const navigate = useNavigate();
    const { timezone, locale, updateSettings } = useDateSettings();
    const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
    const [detailedTicket, setDetailedTicket] = useState<Ticket | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [allTickets, setAllTickets] = useState<TicketSummary[]>([]);
    const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
    const [isLoadingCategories, setIsLoadingCategories] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [statusFilter, setStatusFilter] = useState<TicketStatus | "">("");
    const [categoryFilter, setCategoryFilter] = useState("");
    const [availableCategories, setAvailableCategories] = useState<string[]>([]);
    const { user } = useUser();

    const fetchInitialData = useCallback(async () => {
        setIsLoading(true);
        setIsLoadingCategories(true);
        try {
            const [ticketsData, categoriesData] = await Promise.all([
                apiFetch<{ tickets: TicketSummary[] }>('/tickets', { sendEntityToken: true }),
                apiFetch<{ categorias: { id: number; nombre: string }[] }>('/municipal/categorias', { sendEntityToken: true })
            ]);

            const categoryMapping: Record<string, string> = {};
            if (categoriesData?.categorias) {
                categoriesData.categorias.forEach(c => { categoryMapping[String(c.id)] = c.nombre; });
            }
            setCategoryNames(categoryMapping);
            setIsLoadingCategories(false);

            const ticketsWithDetails = ticketsData.tickets ? ticketsData.tickets.map(t => ({ ...t, sla_status: t.sla_status || null, priority: t.priority || null })) : [];
            setAllTickets(ticketsWithDetails);

            const allCats = new Set(ticketsWithDetails.map(t => t.categoria).filter(Boolean));
            const sortedCats = Array.from(allCats).sort((a, b) => (categoryMapping[a!] || a!).localeCompare(categoryMapping[b!] || b!));
            setAvailableCategories(sortedCats as string[]);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Error al cargar datos.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    const filteredAndSortedGroups = useMemo(() => {
        const filtered = allTickets.filter(t =>
            (statusFilter ? t.estado === statusFilter : true) &&
            (categoryFilter ? t.categoria === categoryFilter : true) &&
            (debouncedSearchTerm ? [t.id, t.nro_ticket, t.asunto, t.nombre_usuario, t.email_usuario, t.direccion, categoryNames[t.categoria || '']].some(f => f?.toString().toLowerCase().includes(debouncedSearchTerm.toLowerCase())) : true)
        );

        const sorted = filtered.sort((a, b) => {
            const priorityOrder = { high: 0, medium: 1, low: 2, null_priority: 3 };
            const slaOrder = { breached: 0, nearing_sla: 1, on_track: 2, null_sla: 3 };
            const prioA = priorityOrder[a.priority || 'null_priority'];
            const prioB = priorityOrder[b.priority || 'null_priority'];
            if (prioA !== prioB) return prioA - prioB;
            const slaA = slaOrder[a.sla_status || 'null_sla'];
            const slaB = slaOrder[b.sla_status || 'null_sla'];
            if (slaA !== slaB) return slaA - slaB;
            return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
        });

        const groups: { [key: string]: TicketSummary[] } = {};
        for (const ticket of sorted) {
            const categoryKey = ticket.categoria || 'Sin Categoría';
            if (!groups[categoryKey]) groups[categoryKey] = [];
            groups[categoryKey].push(ticket);
        }

        return Object.entries(groups).map(([categoryName, tickets]) => ({ categoryName: categoryNames[categoryName] || categoryName, tickets }))
            .sort((a, b) => a.categoryName.localeCompare(b.categoryName));
    }, [allTickets, debouncedSearchTerm, statusFilter, categoryFilter, categoryNames]);

    const loadAndSetDetailedTicket = useCallback(async (ticketSummary: TicketSummary) => {
        setSelectedTicketId(ticketSummary.id);
        setDetailedTicket(null);
        try {
            const data = await apiFetch<Ticket>(`/tickets/${ticketSummary.tipo}/${ticketSummary.id}`, { sendEntityToken: true });
            setDetailedTicket(data);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Error al cargar detalle.');
        }
    }, []);

    const handleSendMessage = async (message: string, file: File | null) => {
        if (!detailedTicket) return;
        const adminUserId = user?.id;
        if (!adminUserId) return;

        try {
            let requestBody: any;
            let headers: Record<string, string> = {};

            if (file) {
                const formData = new FormData();
                formData.append('archivos', file, file.name);
                if (message) formData.append('comentario', message);
                requestBody = formData;
            } else {
                requestBody = { comentario: message };
                headers['Content-Type'] = 'application/json';
            }

            const updatedTicket = await apiFetch<Ticket>(`/tickets/${detailedTicket.tipo}/${detailedTicket.id}/responder`, {
                method: "POST",
                body: requestBody,
                headers,
                sendEntityToken: true,
            });

            setDetailedTicket(updatedTicket);
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "No se pudo enviar el mensaje.");
        }
    };

    if (isLoading) return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-primary h-16 w-16" /></div>;
    if (error) return <div className="p-8 text-center text-destructive">{error}</div>;

    return (
        <div className="flex flex-col h-screen bg-muted/30 dark:bg-slate-900 text-foreground">
            <header className="p-4 border-b dark:border-slate-700 bg-card dark:bg-slate-800/50 shadow-sm flex-shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button variant="outline" size="icon" onClick={() => navigate(-1)} title="Volver"><ArrowLeft className="h-5 w-5" /></Button>
                        <div>
                            <h1 className="text-2xl font-bold text-foreground">Panel de Tickets</h1>
                            <p className="text-sm text-muted-foreground">Gestiona todos los reclamos y solicitudes.</p>
                        </div>
                    </div>
                </div>
                <div className="mt-4 flex items-center gap-3">
                    <div className="relative flex-grow">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Buscar..." className="pl-9 h-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <Select value={statusFilter} onValueChange={v => setStatusFilter(v as TicketStatus | "")}><SelectTrigger className="w-auto min-w-[180px] h-9"><SelectValue placeholder="Filtrar por estado" /></SelectTrigger><SelectContent>{Object.entries(ESTADOS).map(([k, {label}]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}</SelectContent></Select>
                    <Select value={categoryFilter} onValueChange={v => setCategoryFilter(v === "ALL" ? "" : v)}><SelectTrigger className="w-auto min-w-[180px] h-9"><SelectValue placeholder="Filtrar por categoría" /></SelectTrigger><SelectContent><SelectItem value="ALL">Todas</SelectItem>{availableCategories.map(c => <SelectItem key={c} value={c}>{categoryNames[c] || c}</SelectItem>)}</SelectContent></Select>
                </div>
            </header>

            <main className="grid md:grid-cols-3 flex-1 overflow-hidden" style={{ gridTemplateColumns: 'minmax(300px, 1fr) 2fr 1fr' }}>
                <div className="md:col-span-1 border-r dark:border-slate-700 bg-card dark:bg-slate-800/50 flex flex-col">
                    <ScrollArea className="flex-1 p-3">
                        <TicketList groupedTickets={filteredAndSortedGroups} selectedTicketId={selectedTicketId} onTicketSelect={loadAndSetDetailedTicket} />
                    </ScrollArea>
                </div>

                <div className="md:col-span-1 flex flex-col bg-background dark:bg-slate-900 overflow-hidden">
                    {detailedTicket ? (
                        <ChatPanel
                            ticket={detailedTicket}
                            comentarios={detailedTicket.comentarios || []}
                            onSendMessage={handleSendMessage}
                            chatEnVivo={["esperando_agente_en_vivo", "en_proceso"].includes(detailedTicket.estado)}
                            fetchComentarios={() => loadAndSetDetailedTicket(detailedTicket)}
                        />
                    ) : (
                        <div className="hidden md:flex flex-col items-center justify-center h-full p-8 text-center bg-muted/50 dark:bg-slate-800/20">
                            <TicketIcon className="h-16 w-16 text-muted-foreground/50" strokeWidth={1} />
                            <h2 className="mt-4 text-xl font-semibold text-foreground">Seleccione un Ticket</h2>
                            <p className="mt-1 text-muted-foreground">Elija un ticket de la lista para ver sus detalles.</p>
                        </div>
                    )}
                </div>

                <div className="md:col-span-1 hidden md:block border-l dark:border-slate-700">
                    <DetailsPanel ticket={detailedTicket} categoryNames={categoryNames} />
                </div>
            </main>
        </div>
    );
}
