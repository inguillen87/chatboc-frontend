import React, { useEffect, useState, useCallback, FC, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, ArrowLeft, Send, Ticket as TicketIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, ApiError } from "@/utils/api"; // Asegúrate de que ApiError está exportado en utils/api
import { Badge } from "@/components/ui/badge"; // Importamos Badge
import { cn } from "@/lib/utils"; // Importamos cn para combinar clases de Tailwind

// Definimos los tipos aquí para claridad (si no están ya en "@/types/chat" o similar)
type TicketStatus = "nuevo" | "en_proceso" | "derivado" | "resuelto" | "cerrado";
interface Comment { id: number; comentario: string; fecha: string; es_admin: boolean; }
interface Ticket {
    id: number;
    tipo: 'pyme' | 'municipio';
    nro_ticket: number;
    asunto: string;
    estado: TicketStatus;
    fecha: string; // Fecha de creación del ticket
    detalles?: string; // Detalles iniciales de la pregunta del cliente
    comentarios?: Comment[]; // Lista de comentarios
    // Añadir user_id si lo necesitas para mostrar el ID del cliente
    user_id?: number | null; 
    # Propiedades adicionales de PymeTicket
    rubro_id?: number | null;
    archivo_url?: string | null;
    telefono?: string | null;
    email?: string | null;
    dni?: string | null;
    estado_cliente?: string;
}

const ESTADOS: Record<TicketStatus, { label: string; color: string; badge: string; tailwind_class: string }> = {
    nuevo: { label: "Nuevo", color: "text-blue-700", badge: "bg-blue-600", tailwind_class: "bg-blue-500/20 text-blue-500 border-blue-500/30" },
    en_proceso: { label: "En Proceso", color: "text-yellow-800", badge: "bg-yellow-500", tailwind_class: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30" },
    derivado: { label: "Derivado", color: "text-purple-700", badge: "bg-purple-500", tailwind_class: "bg-purple-500/20 text-purple-500 border-purple-500/30" },
    resuelto: { label: "Resuelto", color: "text-green-700", badge: "bg-green-600", tailwind_class: "bg-green-500/20 text-green-500 border-green-500/30" },
    cerrado: { label: "Cerrado", color: "text-gray-500", badge: "bg-gray-400", tailwind_class: "bg-gray-500/20 text-gray-500 border-gray-500/30" },
};

// Hook para mobile detection (ya estaba bien)
function useIsMobile(breakpoint = 768) {
    const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < breakpoint : false);
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < breakpoint);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [breakpoint]);
    return isMobile;
}

// Función para formatear fecha (ya estaba bien)
function fechaCorta(iso: string) {
    if (!iso) return "";
    const d = new Date(iso);
    return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export default function TicketsPanel() {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const isMobile = useIsMobile();

    const fetchTickets = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Asumiendo que el endpoint /tickets/ devuelve tickets de AMBOS tipos (pyme y municipio)
            // o que tienes un endpoint específico para PymeTickets si este panel es solo para PYMES.
            // Para este ejemplo, asumo /tickets/ devuelve tickets de la PYME logueada si es un user de PYME.
            const fetchedTickets = await apiFetch<Ticket[]>('/tickets/'); 
            setTickets(fetchedTickets || []);
        } catch (err) {
            const errorMessage = err instanceof ApiError ? err.message : "Ocurrió un error inesperado al cargar tickets.";
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchTickets(); }, [fetchTickets]);

    const handleSelectTicket = useCallback(async (ticket: Ticket) => {
        setSelectedTicket(null); // Limpiar para que la animación de AnimatePresence se active
        try {
            // Endpoint para obtener el detalle con comentarios. 
            // `ticket.tipo` es crucial aquí para saber si es un PymeTicket o MunicipioTicket.
            const detailedTicket = await apiFetch<Ticket>(`/tickets/${ticket.tipo}/${ticket.id}`);
            setSelectedTicket(detailedTicket);
        } catch (err) {
            const errorMessage = err instanceof ApiError ? err.message : "No se pudo cargar el detalle del ticket.";
            setError(errorMessage);
            setSelectedTicket(null); // Asegurarse de que no quede un ticket a medio cargar
        }
    }, []);

    const handleTicketUpdate = (updatedTicket: Ticket) => {
        // Actualiza la lista de tickets general
        setTickets(prev => prev.map(t => t.id === updatedTicket.id ? { ...t, ...updatedTicket } : t));
        // Actualiza el ticket seleccionado para reflejar los nuevos comentarios/estado
        setSelectedTicket(updatedTicket); // Reemplaza completamente el ticket seleccionado
    };
    
    const showList = !isMobile || !selectedTicket;
    const showDetail = !!selectedTicket;

    return (
        <div className="flex h-[calc(100vh-80px)] max-w-7xl mx-auto my-8 shadow-2xl rounded-2xl overflow-hidden border border-border bg-card text-foreground">
            {showList && (
                <aside className="w-full md:w-1/3 md:max-w-[400px] bg-background border-r border-border flex flex-col">
                    <header className="px-6 py-5 flex items-center gap-2 border-b border-border">
                        <TicketIcon className="text-primary" /><h2 className="font-bold text-lg text-foreground">Panel de Tickets</h2>
                    </header>
                    {isLoading ? <div className="p-4 text-center"><Loader2 className="animate-spin text-primary"/></div> :
                        error ? <div className="p-4 text-destructive-foreground bg-destructive/10 rounded m-4 flex items-center gap-2"><div className="w-5 h-5"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x-circle"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg></div>{error}</div> :
                            <TicketList tickets={tickets} selectedTicketId={selectedTicket?.id || null} onSelectTicket={handleSelectTicket} />
                    }
                </aside>
            )}
            <main className="flex-1 bg-muted/30">
                <AnimatePresence mode="wait">
                    {showDetail && selectedTicket && (
                        <motion.div 
                            key={selectedTicket.id} 
                            initial={{ opacity: 0, x: isMobile ? '100%' : 0 }} 
                            animate={{ opacity: 1, x: 0 }} 
                            exit={{ opacity: 0, x: isMobile ? '100%' : 0 }} 
                            transition={{ duration: 0.2 }} 
                            className="h-full absolute inset-0 md:relative" // Ocupa todo el espacio en mobile
                        >
                            <TicketDetail ticket={selectedTicket} onBack={() => setSelectedTicket(null)} onTicketUpdate={handleTicketUpdate} />
                        </motion.div>
                    )}
                    {!showDetail && !isMobile && ( // Solo muestra el placeholder en desktop
                        <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-8">
                            <CheckCircle2 size={48} className="text-primary mb-4"/>
                            <h3 className="font-semibold text-lg">Panel de Gestión</h3>
                            <p>Seleccioná un ticket de la lista para ver sus detalles y responder.</p>
                        </div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}

const TicketList: FC<{ tickets: Ticket[], selectedTicketId: number | null, onSelectTicket: (ticket: Ticket) => void }> = ({ tickets, selectedTicketId, onSelectTicket }) => (
    <div className="flex-1 overflow-y-auto custom-scroll"> {/* Agregamos custom-scroll */}
        {tickets.length === 0 && <p className="p-4 text-center text-muted-foreground">No hay tickets para mostrar.</p>}
        {tickets.map((t) => (
            <div key={t.id}
                className={cn(
                    "p-4 flex flex-col gap-1 border-b border-border cursor-pointer transition-colors hover:bg-accent",
                    selectedTicketId === t.id ? "bg-secondary border-l-4 border-primary" : "bg-background"
                )}
                onClick={() => onSelectTicket(t)}>
                <div className="flex justify-between items-center">
                    <span className="font-semibold text-primary">#{t.nro_ticket}</span>
                    <Badge className={cn("px-3 py-1 rounded-full text-xs font-bold", ESTADOS[t.estado]?.tailwind_class || ESTADOS.nuevo.tailwind_class)}>
                        {ESTADOS[t.estado]?.label || t.estado}
                    </Badge>
                </div>
                <span className="text-sm text-foreground truncate font-medium">{t.asunto}</span>
                <span className="text-xs text-muted-foreground">{fechaCorta(t.fecha)}</span>
            </div>
        ))}
    </div>
);

const TicketDetail: FC<{ ticket: Ticket, onBack: () => void, onTicketUpdate: (ticket: Ticket) => void }> = ({ ticket, onBack, onTicketUpdate }) => {
    const [newMessage, setNewMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    
    // Referencia para el scroll del chat de comentarios
    const chatBottomRef = useRef<HTMLDivElement>(null);
    const isMobile = useIsMobile(); // Usa el hook localmente

    const handleSendMessage = async () => {
        if (!newMessage.trim()) return;
        setIsSending(true);
        try {
            // Asegúrate que tu backend tenga un endpoint POST /tickets/<tipo>/<id>/responder
            // que reciba el comentario y devuelva el ticket actualizado con el nuevo comentario
            await apiFetch(`/tickets/${ticket.tipo}/${ticket.id}/responder`, {
                method: 'POST',
                body: { comentario: newMessage, es_admin: true }, // Asumo que el agente envía como admin
            });
            setNewMessage("");
            // Vuelve a obtener los detalles del ticket para reflejar el nuevo comentario y el estado
            const updatedTicket = await apiFetch<Ticket>(`/tickets/${ticket.tipo}/${ticket.id}`);
            onTicketUpdate(updatedTicket); // Notifica al padre (TicketsPanel) del cambio
        } catch (err) {
            console.error("❌ Error al enviar comentario:", err);
            // Implementar un toast/alerta al usuario aquí
        } finally {
            setIsSending(false);
        }
    };

    const handleEstadoChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const nuevoEstado = e.target.value;
        try {
            // Asegúrate que tu backend tenga un endpoint PUT /tickets/<tipo>/<id>/estado
            // que reciba el nuevo estado y devuelva el ticket actualizado
            await apiFetch(`/tickets/${ticket.tipo}/${ticket.id}/estado`, {
                method: 'PUT',
                body: { estado: nuevoEstado },
            });
            // Actualiza el estado local y el estado del ticket en el componente padre
            onTicketUpdate({ ...ticket, estado: nuevoEstado as TicketStatus });
        } catch (err) {
            console.error("Error al cambiar estado:", err);
            // Implementar un toast/alerta al usuario aquí
        }
    };
    
    // Scroll al último comentario cuando los comentarios del ticket cambian
    useEffect(() => {
        if (chatBottomRef.current) {
            chatBottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
        }
    }, [ticket.comentarios]); // Depende de los comentarios del ticket

    return (
        <div className="flex flex-col h-full bg-background dark:bg-[#1f2937] text-foreground">
            <header className="flex items-center gap-3 p-4 border-b border-border bg-card dark:bg-[#1a202c]">
                {isMobile && <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5 text-muted-foreground"/></Button>}
                <TicketIcon className="text-primary w-6 h-6" />
                <div className="flex-1">
                    <h3 className="font-bold text-lg truncate text-foreground">Ticket #{ticket.nro_ticket}</h3>
                    <p className="text-xs text-muted-foreground">Tipo: {ticket.tipo === 'pyme' ? 'PYME' : 'Municipio'}</p>
                </div>
                
                {/* Menú desplegable para cambiar el estado */}
                <div>
                    <select
                        value={ticket.estado}
                        onChange={handleEstadoChange}
                        className="bg-input border-border rounded-md px-2 py-1.5 text-sm font-semibold focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-gray-100"
                    >
                        {Object.keys(ESTADOS).map(estadoKey => {
                            const estadoInfo = ESTADOS[estadoKey as TicketStatus];
                            return (
                                <option key={estadoKey} value={estadoKey}>
                                    {estadoInfo.label}
                                </option>
                            );
                        })}
                    </select>
                </div>
            </header>
            
            <div className="flex-1 p-4 overflow-y-auto space-y-4 custom-scroll"> {/* Agregamos custom-scroll */}
                <div className="pb-4 border-b border-border">
                    <h4 className="font-semibold text-lg text-foreground">{ticket.asunto}</h4>
                    <p className="whitespace-pre-wrap text-muted-foreground text-sm">{ticket.detalles}</p>
                    {/* Mostrar datos adicionales del cliente si es PymeTicket */}
                    {ticket.tipo === 'pyme' && (ticket.email || ticket.telefono || ticket.dni) && (
                        <div className="mt-3 text-xs text-muted-foreground">
                            <p><strong>Contacto Cliente:</strong></p>
                            {ticket.email && <p>Email: {ticket.email}</p>}
                            {ticket.telefono && <p>Teléfono: {ticket.telefono}</p>}
                            {ticket.dni && <p>DNI: {ticket.dni}</p>}
                            {ticket.estado_cliente && <p>Estado Cliente: {ticket.estado_cliente}</p>}
                        </div>
                    )}
                </div>
                {ticket.comentarios?.length === 0 && <p className="text-center text-muted-foreground text-sm">No hay comentarios aún.</p>}
                {ticket.comentarios?.map(c => (
                    <div key={c.id} className={`flex ${c.es_admin ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-lg px-4 py-2 rounded-lg ${
                            c.es_admin 
                                ? 'bg-primary text-primary-foreground dark:bg-blue-600' 
                                : 'bg-secondary text-secondary-foreground dark:bg-gray-700 dark:text-gray-100'
                        }`}>
                            <p className="whitespace-pre-wrap">{c.comentario}</p>
                            <span className="text-xs opacity-70 block text-right mt-1">{fechaCorta(c.fecha)}</span>
                        </div>
                    </div>
                ))}
                <div ref={chatBottomRef} /> {/* Elemento para el scroll */}
            </div>
            
            <footer className="border-t border-border p-3 flex gap-2 bg-card dark:bg-[#1a202c]">
                <Input 
                    value={newMessage} 
                    onChange={e => setNewMessage(e.target.value)} 
                    placeholder="Escribe tu respuesta como agente..." 
                    onKeyDown={e => e.key === 'Enter' && handleSendMessage()} 
                    disabled={isSending} 
                    className="bg-input border-input text-foreground dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
                />
                <Button 
                    onClick={handleSendMessage} 
                    disabled={isSending || !newMessage.trim()}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground dark:bg-blue-600 dark:hover:bg-blue-700"
                >
                    {isSending ? <Loader2 className="animate-spin w-4 h-4" /> : <Send className="w-4 h-4"/>}
                </Button>
            </footer>
        </div>
    );
};