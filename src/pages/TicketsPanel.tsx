import React, { useEffect, useState, useCallback, FC } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Send, Ticket as TicketIcon, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, ApiError } from "@/utils/api";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// --- TIPOS DE DATOS (SIN CAMBIOS) ---
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
    // ... otros campos ...
}
interface TicketSummary extends Omit<Ticket, 'detalles' | 'comentarios'> {
    direccion?: string;
}
type CategorizedTickets = {
  [category: string]: TicketSummary[];
};

// --- MAPA DE ESTADOS (SIN CAMBIOS) ---
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


// --- COMPONENTE PRINCIPAL DEL PANEL ---
export default function TicketsPanel() {
    const [categorizedTickets, setCategorizedTickets] = useState<CategorizedTickets>({});
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchCategorizedTickets = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            // 1. LLAMAMOS A LA NUEVA API QUE AGRUPA POR CATEGORÍA
            const data = await apiFetch<CategorizedTickets>('/tickets/panel_por_categoria');
            setCategorizedTickets(data);
        } catch (err) {
            const errorMessage = err instanceof ApiError ? err.message : "Ocurrió un error al cargar el panel.";
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCategorizedTickets();
    }, [fetchCategorizedTickets]);

    // Al hacer clic en una tarjeta, obtenemos sus detalles completos para el modal
    const handleSelectTicket = useCallback(async (ticketSummary: TicketSummary) => {
        setSelectedTicket(null); // Resetea para la animación
        setIsModalOpen(true);
        try {
            const detailedTicket = await apiFetch<Ticket>(`/tickets/${ticketSummary.tipo}/${ticketSummary.id}`);
            setSelectedTicket(detailedTicket);
        } catch (err) {
            const errorMessage = err instanceof ApiError ? err.message : "No se pudo cargar el detalle del ticket.";
            setError(errorMessage); // Podríamos mostrar este error en un toast
            setIsModalOpen(false);
        }
    }, []);

    // Cuando el ticket se actualiza dentro del modal, refrescamos todo el panel
    const handleTicketUpdate = () => {
        fetchCategorizedTickets(); // Vuelve a cargar todos los datos para reflejar el cambio de estado/categoría
    };

    if (isLoading) return <div className="p-8 text-center"><Loader2 className="animate-spin text-primary mx-auto" /></div>;
    if (error) return <div className="p-8 text-center text-destructive">{error}</div>;

    return (
        <div className="flex flex-col h-[calc(100vh-80px)] bg-muted/40 p-4">
            <header className="mb-4">
                <h1 className="text-2xl font-bold text-foreground">Panel de Reclamos</h1>
            </header>

            <div className="flex-1 flex gap-6 overflow-x-auto pb-4 custom-scroll">
                {Object.keys(categorizedTickets).length === 0 ? (
                    <p>No hay tickets para mostrar.</p>
                ) : (
                    <>
                        {Object.entries(categorizedTickets).map(([category, tickets]) => (
                            <TicketColumn key={category} category={category} tickets={tickets} onSelectTicket={handleSelectTicket} />
                        ))}
                    </>
                )}
            </div>

            {/* --- DIÁLOGO MODAL PARA VER EL DETALLE DEL TICKET --- */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0 gap-0">
                    {selectedTicket ? (
                        <TicketDetail 
                            ticket={selectedTicket} 
                            onTicketUpdate={(updatedTicket) => {
                                // Actualiza el ticket en el modal y refresca el panel general en segundo plano
                                setSelectedTicket(updatedTicket);
                                handleTicketUpdate();
                            }} 
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-primary"/></div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}


// --- SUB-COMPONENTE PARA CADA COLUMNA DE CATEGORÍA ---
const TicketColumn: FC<{ category: string; tickets: TicketSummary[]; onSelectTicket: (ticket: TicketSummary) => void; }> = ({ category, tickets, onSelectTicket }) => (
    <div className="w-80 bg-card rounded-xl shadow-sm flex-shrink-0 flex flex-col">
        <div className="p-4 border-b border-border">
            <h2 className="font-semibold text-foreground">{category} <Badge variant="secondary">{tickets.length}</Badge></h2>
        </div>
        <div className="flex-1 p-2 space-y-2 overflow-y-auto custom-scroll">
            {tickets.map(ticket => (
                <div key={ticket.id} onClick={() => onSelectTicket(ticket)} className="bg-background p-3 rounded-lg border border-border cursor-pointer hover:border-primary transition-all">
                    <div className="flex justify-between items-center mb-1">
                        <span className="font-semibold text-primary text-sm">#{ticket.nro_ticket}</span>
                        <Badge className={cn("text-xs", ESTADOS[ticket.estado as TicketStatus]?.tailwind_class)}>{ESTADOS[ticket.estado as TicketStatus]?.label}</Badge>
                    </div>
                    <p className="font-medium text-foreground truncate">{ticket.asunto}</p>
                    <p className="text-xs text-muted-foreground truncate">{ticket.direccion}</p>
                    <p className="text-xs text-muted-foreground text-right mt-1">{fechaCorta(ticket.fecha)}</p>
                </div>
            ))}
        </div>
    </div>
);


// --- SUB-COMPONENTE PARA EL DETALLE DEL TICKET (ADAPTADO) ---
const TicketDetail: FC<{ ticket: Ticket; onTicketUpdate: (ticket: Ticket) => void }> = ({ ticket, onTicketUpdate }) => {
    const [newMessage, setNewMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const chatBottomRef = useRef<HTMLDivElement>(null);

    const handleSendMessage = async () => {
        // ... (lógica de enviar mensaje sin cambios)
    };
    const handleEstadoChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        // ... (lógica de cambiar estado sin cambios)
    };

    useEffect(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [ticket.comentarios]);

    return (
        <>
            <DialogHeader className="p-4 border-b border-border">
                <DialogTitle className="flex items-center gap-2">
                    <TicketIcon className="text-primary"/>
                    Ticket #{ticket.nro_ticket} - {ticket.asunto}
                </DialogTitle>
            </DialogHeader>
            <div className="flex-1 p-4 overflow-y-auto space-y-4 custom-scroll">
                {/* ... JSX del detalle del ticket, comentarios, etc. sin cambios ... */}
            </div>
            <footer className="border-t border-border p-3 flex gap-2 bg-card">
                 {/* ... JSX del input de respuesta sin cambios ... */}
            </footer>
        </>
    );
};