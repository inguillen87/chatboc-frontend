import React, { useEffect, useState, useCallback, FC, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Ticket as TicketIcon, ChevronDown, ChevronUp, User, ShieldCheck, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, ApiError } from "@/utils/api";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
// No necesitamos Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription aquí.
// Pero las mantengo comentadas si las necesitas para otros componentes.
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// --- TIPOS DE DATOS ---
type TicketStatus = "nuevo" | "en_proceso" | "derivado" | "resuelto" | "cerrado";
interface Comment { id: number; comentario: string; fecha: string; es_admin: boolean; }
interface Ticket {
    id: number;
    tipo: 'pyme' | 'municipio';
    nro_ticket: number;
    asunto: string;
    estado: TicketStatus;
    fecha: string;
    detalles?: string;
    comentarios?: Comment[];
    nombre_usuario?: string;
    email_usuario?: string;
    telefono?: string;
    direccion?: string;
    archivo_url?: string;
}
interface TicketSummary extends Omit<Ticket, 'detalles' | 'comentarios'> {
    direccion?: string;
}
type CategorizedTickets = { [category: string]: TicketSummary[]; };

// --- MAPA DE ESTADOS ---
const ESTADOS: Record<TicketStatus, { label: string; tailwind_class: string }> = {
    nuevo: { label: "Nuevo", tailwind_class: "bg-blue-500/20 text-blue-500 border-blue-500/30" },
    en_proceso: { label: "En Proceso", tailwind_class: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30" },
    derivado: { label: "Derivado", tailwind_class: "bg-purple-500/20 text-purple-500 border-purple-500/30" },
    resuelto: { label: "Resuelto", tailwind_class: "bg-green-500/20 text-green-500 border-green-500/30" },
    cerrado: { label: "Cerrado", tailwind_class: "bg-gray-500/20 text-gray-500 border-gray-500/30" },
};

function fechaCorta(iso: string) {
    if (!iso) return "";
    const d = new Date(iso);
    return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export default function TicketsPanel() {
    const [categorizedTickets, setCategorizedTickets] = useState<CategorizedTickets>({});
    const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null); // Nuevo estado para el ID del ticket seleccionado
    const [detailedTicket, setDetailedTicket] = useState<Ticket | null>(null); // Nuevo estado para el ticket con detalles
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
                setOpenCategories(new Set(Object.keys(data)));
            } catch (err) {
                const errorMessage = err instanceof ApiError ? err.message : "Ocurrió un error al cargar el panel de tickets.";
                setError(errorMessage);
            } finally {
                setIsLoading(false);
            }
        };
        fetchInitialData();
    }, []);

    const toggleCategory = (category: string) => {
        setOpenCategories(prev => {
            const newSet = new Set(prev);
            newSet.has(category) ? newSet.delete(category) : newSet.add(category);
            return newSet;
        });
    };

    // Nueva función para cargar los detalles del ticket y establecerlo como el ticket a mostrar
    const loadAndSetDetailedTicket = useCallback(async (ticketSummary: TicketSummary) => {
        const token = localStorage.getItem('authToken');
        if (!token) {
            setError("Error de autenticación. Por favor, recargue la página.");
            return;
        }
        // Si el ticket ya está abierto, lo cerramos
        if (selectedTicketId === ticketSummary.id) {
            setSelectedTicketId(null);
            setDetailedTicket(null);
            return;
        }

        setSelectedTicketId(ticketSummary.id); // Establece el ID del ticket que queremos expandir
        setDetailedTicket(null); // Limpia los detalles anteriores mientras carga el nuevo
        setError(null); // Limpia errores anteriores

        try {
            // Se asume que el tipo en ticketSummary es correcto ('municipio' o 'pyme')
            const data = await apiFetch<Ticket>(`/tickets/${ticketSummary.tipo}/${ticketSummary.id}`);
            setDetailedTicket(data);
        } catch (err) {
            const errorMessage = err instanceof ApiError ? err.message : `No se pudo cargar el detalle del ticket ${ticketSummary.nro_ticket}.`;
            setError(errorMessage);
            setSelectedTicketId(null); // Si falla, colapsa la sección
        }
    }, [selectedTicketId]); // selectedTicketId en dependencias para saber si lo estamos cerrando o abriendo


    // Esta función se pasa al TicketDetail para que pueda actualizar el padre
    const handleTicketDetailUpdate = (updatedTicket: Ticket) => {
        setDetailedTicket(updatedTicket); // Actualiza el ticket detallado en el estado
        // Opcional: Si quieres refrescar la lista general de tickets después de una actualización
        // const fetchTickets = async () => { /* ... */ }; fetchTickets();
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
                {Object.keys(categorizedTickets).length === 0 && !isLoading ? (
                    <div className="text-center py-10 px-4 bg-card rounded-lg shadow-sm">
                        <TicketIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                        <h3 className="mt-2 text-sm font-medium text-foreground">No hay tickets activos</h3>
                        <p className="mt-1 text-sm text-muted-foreground">Cuando se genere un nuevo reclamo, aparecerá aquí.</p>
                    </div>
                ) : (
                    Object.entries(categorizedTickets).map(([category, tickets]) => (
                        <TicketCategoryAccordion
                            key={category}
                            category={category}
                            tickets={tickets}
                            onSelectTicket={loadAndSetDetailedTicket} // Usamos la nueva función aquí
                            isOpen={openCategories.has(category)}
                            onToggle={() => toggleCategory(category)}
                            selectedTicketId={selectedTicketId} // Pasamos el ID del ticket seleccionado
                            detailedTicket={detailedTicket} // Pasamos el ticket detallado
                            onTicketDetailUpdate={handleTicketDetailUpdate} // Pasamos la función de actualización
                            // Aquí ya no hay modal, por lo tanto no se abre/cierra Dialog
                        />
                    ))
                )}
            </div>
        </div>
    );
}

// --- SUB-COMPONENTE ACORDEÓN DE CATEGORÍAS ---
// Este componente ahora también maneja la expansión de tickets individuales
const TicketCategoryAccordion: FC<{
    category: string;
    tickets: TicketSummary[];
    onSelectTicket: (ticket: TicketSummary) => void;
    isOpen: boolean;
    onToggle: () => void;
    selectedTicketId: number | null; // El ID del ticket que está abierto para detalle
    detailedTicket: Ticket | null; // El objeto completo del ticket detallado
    onTicketDetailUpdate: (ticket: Ticket) => void; // Función para actualizar el detalle
}> = ({ category, tickets, onSelectTicket, isOpen, onToggle, selectedTicketId, detailedTicket, onTicketDetailUpdate }) => (
    <motion.div layout className="bg-card dark:bg-slate-800/80 border border-border dark:border-slate-700 rounded-xl shadow-md overflow-hidden" initial={{ borderRadius: 12 }}>
        <motion.header layout initial={false} onClick={onToggle} className="p-4 flex justify-between items-center cursor-pointer hover:bg-muted/50 dark:hover:bg-slate-700/50 transition-colors">
            <div className="flex items-center gap-3">
                <h2 className="font-semibold text-lg text-foreground">{category}</h2>
                <Badge variant="secondary" className="dark:bg-slate-600 dark:text-slate-200">{tickets.length}</Badge>
            </div>
            {isOpen ? <ChevronUp className="text-muted-foreground" /> : <ChevronDown className="text-muted-foreground" />}
        </motion.header>
        <AnimatePresence>
            {isOpen && (
                <motion.section key="content" initial="collapsed" animate="open" exit="collapsed" variants={{ open: { opacity: 1, height: "auto" }, collapsed: { opacity: 0, height: 0 } }} transition={{ duration: 0.3, ease: "easeInOut" }} className="overflow-hidden">
                    <div className="p-2 sm:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 border-t border-border dark:border-slate-700">
                        {tickets.map(ticket => (
                            <React.Fragment key={ticket.id}>
                                <div
                                    onClick={() => onSelectTicket(ticket)}
                                    className={cn(
                                        "bg-background dark:bg-slate-800/50 p-3 rounded-lg border border-border dark:border-slate-700/50 cursor-pointer transition-all shadow-sm",
                                        selectedTicketId === ticket.id ? "border-primary dark:border-primary ring-2 ring-primary/50 -translate-y-1" : "hover:border-primary dark:hover:border-primary hover:shadow-lg hover:-translate-y-1",
                                        // Para que ocupe una columna completa si es el ticket abierto
                                        selectedTicketId === ticket.id ? "col-span-full" : ""
                                    )}
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-semibold text-primary text-sm">#{ticket.nro_ticket}</span>
                                        <Badge className={cn("text-xs border", ESTADOS[ticket.estado as TicketStatus]?.tailwind_class)}>{ESTADOS[ticket.estado as TicketStatus]?.label}</Badge>
                                    </div>
                                    <p className="font-medium text-foreground truncate" title={ticket.asunto}>{ticket.asunto}</p>
                                    {ticket.direccion && <p className="text-xs text-muted-foreground truncate" title={ticket.direccion}>{ticket.direccion}</p>}
                                    <p className="text-xs text-muted-foreground text-right mt-1">{fechaCorta(ticket.fecha)}</p>
                                </div>
                                {/* Si este ticket está seleccionado, muestra sus detalles */}
                                <AnimatePresence>
                                    {selectedTicketId === ticket.id && detailedTicket && (
                                        <motion.div
                                            key={`detail-${ticket.id}`}
                                            initial="collapsed"
                                            animate="open"
                                            exit="collapsed"
                                            variants={{ open: { opacity: 1, height: "auto" }, collapsed: { opacity: 0, height: 0 } }}
                                            transition={{ duration: 0.3, ease: "easeInOut" }}
                                            className="col-span-full bg-card dark:bg-slate-800/80 rounded-lg p-4 border border-border dark:border-slate-700 shadow-md mt-2"
                                        >
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="text-lg font-bold">Detalle del Ticket #{detailedTicket.nro_ticket}</h3>
                                                <Button variant="ghost" size="icon" onClick={() => onSelectTicket(ticket)} aria-label="Cerrar detalle">
                                                    <X className="h-5 w-5" />
                                                </Button>
                                            </div>
                                            {/* Aquí renderizamos el componente TicketDetail */}
                                            <TicketDetail ticket={detailedTicket} onTicketUpdate={onTicketDetailUpdate} />
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </React.Fragment>
                        ))}
                    </div>
                </motion.section>
            )}
        </AnimatePresence>
    </motion.div>
);

// --- SUB-COMPONENTE DETALLE DEL TICKET (Mismo código, pero ahora se usa dentro del acordeón) ---
const TicketDetail: FC<{ ticket: Ticket; onTicketUpdate: (ticket: Ticket) => void }> = ({ ticket, onTicketUpdate }) => {
    const [newMessage, setNewMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const chatBottomRef = useRef<HTMLDivElement>(null);

    // --- POLLING cada 5 segundos ---
    useEffect(() => {
        if (!ticket || !ticket.id || !ticket.tipo) return;

        let mounted = true;

        const fetchComentarios = async () => {
            try {
                if (ticket.tipo === "municipio") {
                    // Esta llamada es para refrescar los comentarios
                    const data = await apiFetch(`/tickets/chat/${ticket.id}/mensajes`);
                    if (mounted && data && data.mensajes) {
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
                }
                // Si querés agregar polling para "pyme", agregalo acá
            } catch (e) {
                console.error("Error en polling de comentarios:", e);
            }
        };

        // Inicia el polling solo si estamos viendo el detalle de un ticket específico
        const interval = setInterval(fetchComentarios, 5000);
        fetchComentarios(); // Fetch inicial al montar el componente

        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, [ticket?.id, ticket?.tipo, onTicketUpdate]); // Agregamos onTicketUpdate para evitar advertencias de React


    // --- Envío de Mensaje ---
    const handleSendMessage = async () => {
        if (!newMessage.trim() || isSending) return;
        setIsSending(true);
        try {
            const updatedTicket = await apiFetch<Ticket>(`/tickets/${ticket.tipo}/${ticket.id}/responder`, { method: 'POST', body: { comentario: newMessage } });
            onTicketUpdate(updatedTicket); // Actualiza el ticket en el estado del padre
            setNewMessage("");
        } catch (error) {
            console.error("Error al enviar comentario", error);
            // Podrías agregar un setError aquí para mostrar un mensaje al usuario
        } finally {
            setIsSending(false);
        }
    };

    // --- Cambio de Estado ---
    const handleEstadoChange = async (nuevoEstado: TicketStatus) => {
        try {
            const updatedTicket = await apiFetch<Ticket>(`/tickets/${ticket.tipo}/${ticket.id}/estado`, { method: 'PUT', body: { estado: nuevoEstado } });
            onTicketUpdate(updatedTicket); // Actualiza el ticket en el estado del padre
        } catch (error) {
            console.error("Error al cambiar estado", error);
            // Podrías agregar un setError aquí para mostrar un mensaje al usuario
        }
    };

    // --- Scroll al final del chat ---
    useEffect(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [ticket.comentarios]); // Se dispara cada vez que los comentarios se actualizan

    return (
        // Usamos flex-grow y un grid de 3 columnas para la disposición del detalle
        <div className="flex-grow grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Contenedor principal del chat, ahora con altura relativa para permitir scroll */}
            <div className="md:col-span-2 flex flex-col h-[60vh] max-h-[600px] min-h-[300px]"> {/* Altura ajustada: usa vh con min/max para flexibilidad */}
                <main className="flex-1 p-4 space-y-4 overflow-y-auto custom-scroll border rounded-md bg-background dark:bg-slate-700/50">
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