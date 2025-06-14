// TicketsPanel optimizado con mejoras reales para municipios con alto volumen
import React, { useEffect, useState, useCallback, FC, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Ticket as TicketIcon, ChevronDown, ChevronUp, User, ShieldCheck, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, ApiError } from "@/utils/api";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import TicketCategoryAccordion from "@/components/TicketCategoryAccordion";

// --- TIPOS Y ESTADOS ---
type TicketStatus = "nuevo" | "en_proceso" | "derivado" | "resuelto" | "cerrado" | "esperando_agente_en_vivo";
interface Comment { id: number; comentario: string; fecha: string; es_admin: boolean; }
interface Ticket {
    id: number; tipo: 'pyme' | 'municipio'; nro_ticket: number; asunto: string; estado: TicketStatus; fecha: string;
    detalles?: string; comentarios?: Comment[]; nombre_usuario?: string; email_usuario?: string; telefono?: string; direccion?: string; archivo_url?: string;
}
interface TicketSummary extends Omit<Ticket, 'detalles' | 'comentarios'> { direccion?: string; }
type CategorizedTickets = { [category: string]: TicketSummary[]; };

const ESTADOS_ORDEN_PRIORIDAD: TicketStatus[] = ["nuevo", "en_proceso", "esperando_agente_en_vivo", "derivado", "resuelto", "cerrado"];
const ESTADOS: Record<TicketStatus, { label: string; tailwind_class: string }> = {
    nuevo: { label: "Nuevo", tailwind_class: "bg-blue-600 text-white border-blue-800 dark:bg-blue-400 dark:text-black" },
    en_proceso: { label: "En Proceso", tailwind_class: "bg-yellow-600 text-white border-yellow-800 dark:bg-yellow-300 dark:text-black" },
    derivado: { label: "Derivado", tailwind_class: "bg-purple-600 text-white border-purple-800 dark:bg-purple-400 dark:text-black" },
    resuelto: { label: "Resuelto", tailwind_class: "bg-green-600 text-white border-green-800 dark:bg-green-300 dark:text-black" },
    cerrado: { label: "Cerrado", tailwind_class: "bg-gray-600 text-white border-gray-800 dark:bg-gray-400 dark:text-black" },
    esperando_agente_en_vivo: { label: "Esperando agente", tailwind_class: "bg-red-600 text-white border-red-800 dark:bg-red-400 dark:text-black" }
};

function fechaCorta(iso: string) {
    if (!iso) return "";
    const d = new Date(iso);
    return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export default function TicketsPanel() {
    const [categorizedTickets, setCategorizedTickets] = useState<CategorizedTickets>({});
    const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
    const [detailedTicket, setDetailedTicket] = useState<Ticket | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());

    useEffect(() => {
        const fetchInitialData = async () => {
            if (!localStorage.getItem('authToken')) {
                setError("Sesión no válida. Por favor, inicie sesión de nuevo.");
                setIsLoading(false);
                return;
            }
            try {
                const data = await apiFetch<CategorizedTickets>('/tickets/panel_por_categoria');
                setCategorizedTickets(data);
                const prioritarias = Object.keys(data).filter(c => !["cerrado", "resuelto"].includes(c.toLowerCase()));
                setOpenCategories(new Set(prioritarias));
            } catch (err) {
                const errorMessage = err instanceof ApiError ? err.message : "Ocurrió un error al cargar el panel de tickets.";
                setError(errorMessage);
            } finally {
                setIsLoading(false);
            }
        };
        fetchInitialData();
    }, []);

    const sortedCategories = Object.entries(categorizedTickets).sort(([a], [b]) => {
        const indexA = ESTADOS_ORDEN_PRIORIDAD.indexOf(a.toLowerCase() as TicketStatus);
        const indexB = ESTADOS_ORDEN_PRIORIDAD.indexOf(b.toLowerCase() as TicketStatus);
        return indexA - indexB;
    });

    const toggleCategory = (category: string) => {
        setOpenCategories(prev => {
            const newSet = new Set(prev);
            newSet.has(category) ? newSet.delete(category) : newSet.add(category);
            return newSet;
        });
    };

    const loadAndSetDetailedTicket = useCallback(async (ticketSummary: TicketSummary) => {
        const token = localStorage.getItem('authToken');
        if (!token) {
            setError("Error de autenticación. Por favor, recargue la página.");
            return;
        }
        if (selectedTicketId === ticketSummary.id) {
            setSelectedTicketId(null);
            setDetailedTicket(null);
            return;
        }
        setSelectedTicketId(ticketSummary.id);
        setDetailedTicket(null);
        setError(null);

        try {
            const data = await apiFetch<Ticket>(`/tickets/${ticketSummary.tipo}/${ticketSummary.id}`);
            setDetailedTicket(data);
        } catch (err) {
            const errorMessage = err instanceof ApiError ? err.message : `No se pudo cargar el detalle del ticket ${ticketSummary.nro_ticket}.`;
            setError(errorMessage);
            setSelectedTicketId(null);
        }
    }, [selectedTicketId]);

    const handleTicketDetailUpdate = (updatedTicket: Ticket) => {
        setDetailedTicket(updatedTicket);
    };

    if (isLoading) return <div className="p-8 text-center"><Loader2 className="animate-spin text-primary mx-auto h-10 w-10" /></div>;
    if (error && !selectedTicketId) return <div className="p-8 text-center text-destructive bg-destructive/10 rounded-md">{error}</div>;

    return (
        <div className="flex flex-col min-h-screen bg-muted/20 dark:bg-slate-900 text-foreground p-4 sm:p-6 md:p-8">
            <header className="mb-6 max-w-7xl mx-auto w-full">
                <h1 className="text-3xl font-bold text-foreground">Panel de Reclamos y Tickets</h1>
                <p className="text-muted-foreground mt-1">Gestioná todos los tickets de tus usuarios en un solo lugar.</p>
            </header>
            <div className="w-full max-w-7xl mx-auto space-y-4">
                {sortedCategories.length === 0 && !isLoading ? (
                    <div className="text-center py-10 px-4 bg-card rounded-lg shadow-sm">
                        <TicketIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                        <h3 className="mt-2 text-sm font-medium text-foreground">No hay tickets activos</h3>
                        <p className="mt-1 text-sm text-muted-foreground">Cuando se genere un nuevo reclamo, aparecerá aquí.</p>
                    </div>
                ) : (
                    sortedCategories.map(([category, tickets]) => (
                        <TicketCategoryAccordion
                            key={category}
                            category={category}
                            tickets={tickets}
                            onSelectTicket={loadAndSetDetailedTicket}
                            isOpen={openCategories.has(category)}
                            onToggle={() => toggleCategory(category)}
                            selectedTicketId={selectedTicketId}
                            detailedTicket={detailedTicket}
                            onTicketDetailUpdate={handleTicketDetailUpdate}
                        />
                    ))
                )}
            </div>
        </div>
    );
}


// --- SUB-COMPONENTE DETALLE DEL TICKET ---
const TicketDetail: FC<{ ticket: Ticket; onTicketUpdate: (ticket: Ticket) => void }> = ({ ticket, onTicketUpdate }) => {
    const [newMessage, setNewMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const chatBottomRef = useRef<HTMLDivElement>(null);

   
    // --- POLLING: CONTROLAR LA FRECUENCIA ---
    useEffect(() => {
  if (!ticket || !ticket.id || !ticket.tipo) return;

  // 💡 SOLO hacemos polling si el ticket necesita atención activa
const requiereActualizacion = ticket.estado === "esperando_agente_en_vivo";

  if (!requiereActualizacion) return;

  let mounted = true;
  const POLLING_INTERVAL = 10000;

  const fetchComentarios = async () => {
    try {
      const data = await apiFetch(`/tickets/chat/${ticket.id}/mensajes`);
      if (mounted && data?.mensajes) {
        onTicketUpdate({
          ...ticket,
          comentarios: data.mensajes.map((msg) => ({
            id: msg.id,
            comentario: msg.texto,
            fecha: msg.fecha,
            es_admin: msg.es_admin,
          })),
        });
      }
    } catch (e) {
      console.error("Error en polling de comentarios:", e);
    }
  };

  const interval = setInterval(fetchComentarios, POLLING_INTERVAL);
  fetchComentarios();

  return () => {
    mounted = false;
    clearInterval(interval);
  };
}, [ticket?.id, ticket?.estado, ticket?.tipo, onTicketUpdate]);



    // --- Envío de Mensaje ---
    const handleSendMessage = async () => {
        if (!newMessage.trim() || isSending) return;
        setIsSending(true);
        try {
            const updatedTicket = await apiFetch<Ticket>(`/tickets/${ticket.tipo}/${ticket.id}/responder`, { method: 'POST', body: { comentario: newMessage } });
            onTicketUpdate(updatedTicket);
            setNewMessage("");
        } catch (error) {
            console.error("Error al enviar comentario", error);
        } finally {
            setIsSending(false);
        }
    };

    // --- Cambio de Estado ---
    const handleEstadoChange = async (nuevoEstado: TicketStatus) => {
        try {
            const updatedTicket = await apiFetch<Ticket>(`/tickets/${ticket.tipo}/${ticket.id}/estado`, { method: 'PUT', body: { estado: nuevoEstado } });
            onTicketUpdate(updatedTicket);
        } catch (error) {
            console.error("Error al cambiar estado", error);
        }
    };

    // --- Scroll al final del chat ---
    useEffect(() => {
        // Solo intenta scrollear si el ref existe, hay comentarios y la altura del scroll es mayor que la altura del cliente
        // Esto previene scrolls innecesarios o saltos cuando no hay nada que scrollear.
        const mainElement = chatBottomRef.current?.parentElement;
        if (mainElement && mainElement.scrollHeight > mainElement.clientHeight && ticket.comentarios && ticket.comentarios.length > 0) {
            chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [ticket.comentarios]);

    return (
        // Contenedor principal de TicketDetail: Grid con 3 columnas en desktop, flex-col por defecto en móvil.
        // AÑADIDO: min-h-0 para flex-basis y overflow-y-auto en el contenedor del chat
        <div className="flex flex-col md:grid md:grid-cols-3 gap-4">
            {/* Contenedor del chat principal (columna 1 y 2 en desktop) */}
            {/* CAMBIO CLAVE AQUÍ: Asegura que el div del chat tenga una altura explícita para que main flex-1 funcione con overflow */}
            <div className="md:col-span-2 flex flex-col h-[60vh] max-h-[600px] min-h-[300px] border rounded-md bg-background dark:bg-slate-700/50">
                {/* Área de mensajes del chat con scrolling */}
                <main className="flex-1 p-4 space-y-4 overflow-y-auto custom-scroll">
                    {ticket.comentarios && ticket.comentarios.length > 0 ? (
                        ticket.comentarios.map((comment) => (
                            <div key={comment.id} className={cn('flex items-end gap-2', comment.es_admin ? 'justify-end' : 'justify-start')}>
                                {!comment.es_admin && <AvatarIcon type="user" />}
                                <div className={cn("max-w-md rounded-lg px-4 py-2", comment.es_admin ? "bg-primary text-primary-foreground rounded-br-none" : "bg-muted text-foreground rounded-bl-none")}>
                                    <p className="text-sm">{comment.comentario}</p>
                                    <p className="text-xs opacity-70 text-right mt-1">{fechaCorta(comment.fecha)}</p>
                                </div>
                                {comment.es_admin && <AvatarIcon type="admin" />}
                            </div>
                        ))
                    ) : (
                        <div className="text-center text-muted-foreground py-10">
                            No hay comentarios para este ticket.
                        </div>
                    )}
                    <div ref={chatBottomRef} />
                </main>
                {/* Footer del chat con input para mensajes */}
                <footer className="border-t border-border p-3 flex gap-2 bg-card rounded-b-md">
                    <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) handleSendMessage();
                        }}
                        placeholder="Escribe una respuesta como administrador..."
                        disabled={isSending}
                        className="bg-background"
                    />
                    <Button onClick={handleSendMessage} disabled={isSending || !newMessage.trim()} aria-label="Enviar Mensaje">
                        {isSending ? <Loader2 className="animate-spin" /> : <Send />}
                    </Button>
                </footer>
            </div>
            {/* Sidebar de detalles del ticket (columna 3 en desktop) */}
            <aside className="md:col-span-1 bg-muted/30 p-4 space-y-6 overflow-y-auto custom-scroll rounded-md border">
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base">Estado del Ticket</CardTitle></CardHeader>
                    <CardContent>
                        <Select onValueChange={handleEstadoChange} value={ticket.estado}>
                            <SelectTrigger className="w-full"><SelectValue placeholder="Cambiar estado..." /></SelectTrigger>
                            <SelectContent>
                                {Object.entries(ESTADOS).map(([key, { label }]) => (
                                    <SelectItem key={key} value={key}>{label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base">Detalles del Reclamo</CardTitle></CardHeader>
                    <CardContent className="text-sm text-muted-foreground space-y-1">
                        {ticket.detalles
                            ? ticket.detalles.split('\n').map((line, i) => <p key={i}>{line}</p>)
                            : <p>No se proveyeron detalles adicionales.</p>
                        }
                    </CardContent>
                </Card>
                {(ticket.nombre_usuario || ticket.email_usuario || ticket.telefono || ticket.direccion) && (
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-base">Información del Usuario</CardTitle></CardHeader>
                        <CardContent className="text-sm text-muted-foreground space-y-1">
                            {ticket.nombre_usuario && <p><strong>Nombre:</strong> {ticket.nombre_usuario}</p>}
                            {ticket.email_usuario && <p><strong>Email:</strong> {ticket.email_usuario}</p>}
                            {ticket.telefono && <p><strong>Teléfono:</strong> {ticket.telefono}</p>}
                            {ticket.direccion && <p><strong>Dirección:</strong> {ticket.direccion}</p>}
                        </CardContent>
                    </Card>
                )}
                {ticket.archivo_url && (
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-base">Archivo adjunto</CardTitle></CardHeader>
                        <CardContent>
                            <a href={ticket.archivo_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                                Descargar archivo
                            </a>
                        </CardContent>
                    </Card>
                )}
            </aside>
        </div>
    );
};


// --- AVATAR ICON COMPONENT ---
const AvatarIcon: FC<{ type: 'user' | 'admin' }> = ({ type }) => (
    <div className={cn('h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0', type === 'admin' ? 'bg-primary/20 text-primary' : 'bg-muted-foreground/20 text-muted-foreground')}>
        {type === 'admin' ? <ShieldCheck className="h-5 w-5" /> : <User className="h-5 w-5" />}
    </div>
);