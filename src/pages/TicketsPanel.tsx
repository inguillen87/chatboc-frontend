import React, { useEffect, useState, useCallback, FC, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Ticket as TicketIcon, ChevronDown, ChevronUp, User, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, ApiError } from "@/utils/api";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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

function fechaCorta(iso: string) { if (!iso) return ""; const d = new Date(iso); return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`; }

export default function TicketsPanel() {
    const [categorizedTickets, setCategorizedTickets] = useState<CategorizedTickets>({});
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
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

    const handleSelectTicket = useCallback(async (ticketSummary: TicketSummary) => {
        const token = localStorage.getItem('authToken');
        if (!token) {
            setError("Error de autenticación. Por favor, recargue la página.");
            return;
        }

        setSelectedTicket(null);
        setIsModalOpen(true);
        try {
            const detailedTicket = await apiFetch<Ticket>(`/tickets/${ticketSummary.tipo}/${ticketSummary.id}`);
            setSelectedTicket(detailedTicket);
        } catch (err) {
            const errorMessage = err instanceof ApiError ? err.message : `No se pudo cargar el detalle del ticket.`;
            setError(errorMessage);
            setIsModalOpen(false);
        }
    }, []);

    const handleTicketUpdate = (updatedTicket: Ticket) => {
        setSelectedTicket(updatedTicket);
        const fetchTickets = async () => {
            try {
                const data = await apiFetch<CategorizedTickets>('/tickets/panel_por_categoria');
                setCategorizedTickets(data);
            } catch (error) {
                console.error("No se pudo refrescar la lista de tickets.", error);
            }
        }
        fetchTickets();
    };
    
    if (isLoading) return <div className="p-8 text-center"><Loader2 className="animate-spin text-primary mx-auto h-10 w-10" /></div>;
    if (error) return <div className="p-8 text-center text-destructive bg-destructive/10 rounded-md">{error}</div>;

    return (
        <div className="flex flex-col min-h-screen bg-muted/20 dark:bg-slate-900 text-foreground p-4 sm:p-6 md:p-8">
            <header className="mb-6 max-w-7xl mx-auto w-full">
                <h1 className="text-3xl font-bold text-foreground">Panel de Reclamos y Tickets</h1>
                <p className="text-muted-foreground mt-1">Gestioná todos los tickets de tus usuarios en un solo lugar.</p>
            </header>
            <div className="w-full max-w-7xl mx-auto space-y-4">
                {Object.keys(categorizedTickets).length === 0 && !isLoading ? (
                    <div className="text-center py-10 px-4 bg-card rounded-lg shadow-sm"><TicketIcon className="mx-auto h-12 w-12 text-muted-foreground" /><h3 className="mt-2 text-sm font-medium text-foreground">No hay tickets activos</h3><p className="mt-1 text-sm text-muted-foreground">Cuando se genere un nuevo reclamo, aparecerá aquí.</p></div>
                ) : (
                    Object.entries(categorizedTickets).map(([category, tickets]) => (
                        <TicketCategoryAccordion key={category} category={category} tickets={tickets} onSelectTicket={handleSelectTicket} isOpen={openCategories.has(category)} onToggle={() => toggleCategory(category)} />
                    ))
                )}
            </div>
            
            {/* --- ESTRUCTURA DEL DIÁLOGO CORREGIDA --- */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
                    {selectedTicket ? (
                        <>
                            <DialogHeader className="p-4 border-b border-border sticky top-0 bg-card z-10">
                                <DialogTitle className="flex items-center gap-3">
                                    <TicketIcon className="text-primary h-6 w-6"/>
                                    <span className="truncate">Ticket #{selectedTicket.nro_ticket} - {selectedTicket.asunto}</span>
                                </DialogTitle>
                                <DialogDescription className="pt-2 text-left">
                                    Gestioná el historial completo del ticket, responde al usuario y cambia su estado desde este panel.
                                </DialogDescription>
                            </DialogHeader>
                            <TicketDetail ticket={selectedTicket} onTicketUpdate={handleTicketUpdate} />
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="animate-spin text-primary w-8 h-8"/>
                            <span className="sr-only">Cargando detalle del ticket...</span>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

// --- SUB-COMPONENTE ACORDEÓN (Sin cambios) ---
const TicketCategoryAccordion: FC<{ category: string; tickets: TicketSummary[]; onSelectTicket: (ticket: TicketSummary) => void; isOpen: boolean; onToggle: () => void; }> = ({ category, tickets, onSelectTicket, isOpen, onToggle }) => (
    <motion.div layout className="bg-card dark:bg-slate-800/80 border border-border dark:border-slate-700 rounded-xl shadow-md overflow-hidden" initial={{ borderRadius: 12 }}>
        <motion.header layout initial={false} onClick={onToggle} className="p-4 flex justify-between items-center cursor-pointer hover:bg-muted/50 dark:hover:bg-slate-700/50 transition-colors">
            <div className="flex items-center gap-3"><h2 className="font-semibold text-lg text-foreground">{category}</h2><Badge variant="secondary" className="dark:bg-slate-600 dark:text-slate-200">{tickets.length}</Badge></div>
            {isOpen ? <ChevronUp className="text-muted-foreground" /> : <ChevronDown className="text-muted-foreground" />}
        </motion.header>
        <AnimatePresence>
            {isOpen && (
                <motion.section key="content" initial="collapsed" animate="open" exit="collapsed" variants={{ open: { opacity: 1, height: "auto" }, collapsed: { opacity: 0, height: 0 } }} transition={{ duration: 0.3, ease: "easeInOut" }} className="overflow-hidden">
                    <div className="p-2 sm:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 border-t border-border dark:border-slate-700">
                        {tickets.map(ticket => (
                            <div key={ticket.id} onClick={() => onSelectTicket(ticket)} className="bg-background dark:bg-slate-800/50 p-3 rounded-lg border border-border dark:border-slate-700/50 cursor-pointer hover:border-primary dark:hover:border-primary transition-all shadow-sm hover:shadow-lg hover:-translate-y-1">
                                <div className="flex justify-between items-center mb-1"><span className="font-semibold text-primary text-sm">#{ticket.nro_ticket}</span><Badge className={cn("text-xs border", ESTADOS[ticket.estado as TicketStatus]?.tailwind_class)}>{ESTADOS[ticket.estado as TicketStatus]?.label}</Badge></div>
                                <p className="font-medium text-foreground truncate" title={ticket.asunto}>{ticket.asunto}</p>
                                {ticket.direccion && <p className="text-xs text-muted-foreground truncate" title={ticket.direccion}>{ticket.direccion}</p>}
                                <p className="text-xs text-muted-foreground text-right mt-1">{fechaCorta(ticket.fecha)}</p>
                            </div>
                        ))}
                    </div>
                </motion.section>
            )}
        </AnimatePresence>
    </motion.div>
);

// --- SUB-COMPONENTE DETALLE (Sin DialogHeader) ---
const TicketDetail: FC<{ ticket: Ticket; onTicketUpdate: (ticket: Ticket) => void }> = ({ ticket, onTicketUpdate }) => {
    const [newMessage, setNewMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const chatBottomRef = useRef<HTMLDivElement>(null);

    const handleSendMessage = async () => {
        if (!newMessage.trim() || isSending) return;
        setIsSending(true);
        try {
            const updatedTicket = await apiFetch<Ticket>(`/tickets/${ticket.tipo}/${ticket.id}/responder`, { method: 'POST', body: { comentario: newMessage } });
            onTicketUpdate(updatedTicket);
            setNewMessage("");
        } catch (error) { console.error("Error al enviar comentario", error); } finally { setIsSending(false); }
    };
    
    const handleEstadoChange = async (nuevoEstado: TicketStatus) => {
        try {
            const updatedTicket = await apiFetch<Ticket>(`/tickets/${ticket.tipo}/${ticket.id}/estado`, { method: 'PUT', body: { estado: nuevoEstado } });
            onTicketUpdate(updatedTicket);
        } catch (error) { console.error("Error al cambiar estado", error); }
    };

    useEffect(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [ticket.comentarios]);

    return (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 overflow-hidden">
            <div className="md:col-span-2 flex flex-col overflow-hidden">
                <main className="flex-1 p-4 space-y-4 overflow-y-auto custom-scroll">
                    {ticket.comentarios?.map((comment) => (
                        <div key={comment.id} className={cn('flex items-end gap-2', comment.es_admin ? 'justify-end' : 'justify-start')}>
                            {!comment.es_admin && <AvatarIcon type="user" />}
                            <div className={cn("max-w-md rounded-lg px-4 py-2", comment.es_admin ? "bg-primary text-primary-foreground rounded-br-none" : "bg-muted text-foreground rounded-bl-none")}>
                                <p className="text-sm">{comment.comentario}</p>
                                <p className="text-xs opacity-70 text-right mt-1">{fechaCorta(comment.fecha)}</p>
                            </div>
                            {comment.es_admin && <AvatarIcon type="admin" />}
                        </div>
                    ))}
                    <div ref={chatBottomRef} />
                </main>
                <footer className="border-t border-border p-3 flex gap-2 bg-card">
                    <Input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="Escribe una respuesta como administrador..." disabled={isSending} className="bg-background"/>
                    <Button onClick={handleSendMessage} disabled={isSending || !newMessage.trim()} aria-label="Enviar Mensaje">{isSending ? <Loader2 className="animate-spin" /> : <Send />}</Button>
                </footer>
            </div>
            <aside className="md:col-span-1 border-l border-border bg-muted/30 p-4 space-y-6 overflow-y-auto custom-scroll">
                <Card><CardHeader className="pb-2"><CardTitle className="text-base">Estado del Ticket</CardTitle></CardHeader><CardContent><Select onValueChange={handleEstadoChange} defaultValue={ticket.estado}><SelectTrigger className="w-full"><SelectValue placeholder="Cambiar estado..." /></SelectTrigger><SelectContent>{Object.entries(ESTADOS).map(([key, {label}]) => (<SelectItem key={key} value={key}>{label}</SelectItem>))}</SelectContent></Select></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-base">Detalles del Reclamo</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground space-y-1"><p>{ticket.detalles || "No se proveyeron detalles adicionales."}</p></CardContent></Card>
                {ticket.nombre_usuario && (<Card><CardHeader className="pb-2"><CardTitle className="text-base">Información del Usuario</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground space-y-1"><p><strong>Nombre:</strong> {ticket.nombre_usuario}</p><p><strong>Email:</strong> {ticket.email_usuario}</p></CardContent></Card>)}
            </aside>
        </div>
    );
};

const AvatarIcon: FC<{ type: 'user' | 'admin' }> = ({ type }) => ( <div className={cn('h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0', type === 'admin' ? 'bg-primary/20 text-primary' : 'bg-muted-foreground/20 text-muted-foreground')}>{type === 'admin' ? <ShieldCheck className="h-5 w-5" /> : <User className="h-5 w-5" />}</div>);