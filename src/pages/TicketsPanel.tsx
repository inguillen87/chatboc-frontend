import React, { useEffect, useState, useCallback, FC, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, ArrowLeft, Send, Ticket as TicketIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, ApiError } from "@/utils/api";

// Definimos los tipos aquí para claridad
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
}

const ESTADOS: Record<string, { label: string; color: string; badge: string; }> = {
  nuevo: { label: "Nuevo", color: "text-blue-700", badge: "bg-blue-600" },
  en_proceso: { label: "En Proceso", color: "text-yellow-800", badge: "bg-yellow-500" },
  derivado: { label: "Derivado", color: "text-purple-700", badge: "bg-purple-500" },
  resuelto: { label: "Resuelto", color: "text-green-700", badge: "bg-green-600" },
  cerrado: { label: "Cerrado", color: "text-gray-500", badge: "bg-gray-400" },
};

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < breakpoint : false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [breakpoint]);
  return isMobile;
}

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
      const fetchedTickets = await apiFetch<Ticket[]>('/tickets/');
      setTickets(fetchedTickets || []);
    } catch (err) {
      const errorMessage = err instanceof ApiError ? err.message : "Ocurrió un error inesperado.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const handleSelectTicket = useCallback(async (ticket: Ticket) => {
    setSelectedTicket(null); // Para forzar re-renderizado
    try {
      const detailedTicket = await apiFetch<Ticket>(`/tickets/${ticket.tipo}/${ticket.id}`);
      setSelectedTicket(detailedTicket);
    } catch (err) {
      setError("No se pudo cargar el detalle del ticket.");
    }
  }, []);

  const handleTicketUpdate = (updatedTicket: Ticket) => {
    // Actualiza la lista de tickets general
    setTickets(prev => prev.map(t => t.id === updatedTicket.id ? { ...t, ...updatedTicket } : t));
    // Actualiza el ticket seleccionado para reflejar los nuevos comentarios/estado
    setSelectedTicket(prev => prev ? { ...prev, ...updatedTicket } : null);
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
          {isLoading ? <div className="p-4 text-center"><Loader2 className="animate-spin"/></div> :
            error ? <div className="p-4 text-destructive">{error}</div> :
              <TicketList tickets={tickets} selectedTicketId={selectedTicket?.id || null} onSelectTicket={handleSelectTicket} />
          }
        </aside>
      )}
      <main className="flex-1 bg-muted/30">
        <AnimatePresence mode="wait">
          {showDetail && selectedTicket && (
            <motion.div key={selectedTicket.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <TicketDetail ticket={selectedTicket} onBack={() => setSelectedTicket(null)} onTicketUpdate={handleTicketUpdate} />
            </motion.div>
          )}
          {!showDetail && !isMobile && (
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
  <div className="flex-1 overflow-y-auto">
    {tickets.length === 0 && <p className="p-4 text-center text-muted-foreground">No hay tickets para mostrar.</p>}
    {tickets.map((t) => (
      <div key={t.id}
        className={`p-4 flex flex-col gap-1 border-b border-border cursor-pointer transition-colors hover:bg-accent ${selectedTicketId === t.id ? "bg-secondary border-l-4 border-primary" : "bg-background"}`}
        onClick={() => onSelectTicket(t)}>
        <div className="flex justify-between items-center">
          <span className="font-semibold text-primary">#{t.nro_ticket}</span>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${(ESTADOS[t.estado] || ESTADOS.nuevo).color}`}>{ESTADOS[t.estado]?.label || t.estado}</span>
        </div>
        <span className="text-sm text-foreground truncate font-medium">{t.asunto}</span>
        <span className="text-xs text-muted-foreground">{fechaCorta(t.fecha)}</span>
      </div>
    ))}
  </div>
);

// Dentro de tu archivo TicketsPanel.tsx

const TicketDetail: FC<{ ticket: Ticket, onBack: () => void, onTicketUpdate: (ticket: Ticket) => void }> = ({ ticket, onBack, onTicketUpdate }) => {
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  
  // --- FIX 1: Añadimos las definiciones que faltaban ---
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    setIsSending(true);
    try {
      await apiFetch(`/tickets/${ticket.tipo}/${ticket.id}/responder`, {
        method: 'POST',
        body: { comentario: newMessage },
      });
      setNewMessage("");
      const updatedTicket = await apiFetch<Ticket>(`/tickets/${ticket.tipo}/${ticket.id}`);
      onTicketUpdate(updatedTicket);
    } catch (err) {
      console.error("❌ Error al enviar comentario:", err);
    } finally {
      setIsSending(false);
    }
  };

  // --- FIX 2: AÑADIMOS LA LÓGICA PARA CAMBIAR EL ESTADO ---
  const handleEstadoChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nuevoEstado = e.target.value;
    try {
      await apiFetch(`/tickets/${ticket.tipo}/${ticket.id}/estado`, {
        method: 'PUT',
        body: { estado: nuevoEstado },
      });
      onTicketUpdate({ ...ticket, estado: nuevoEstado as TicketStatus });
    } catch (err) {
      console.error("Error al cambiar estado:", err);
      // Opcional: mostrar un toast de error al usuario
    }
  };
  
  useEffect(() => {
    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [ticket.comentarios]);

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <header className="flex items-center gap-3 p-4 border-b border-border">
        {isMobile && <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft /></Button>}
        <TicketIcon className="text-primary w-6 h-6" />
        <div className="flex-1"><h3 className="font-bold text-lg truncate text-foreground">Ticket #{ticket.nro_ticket}</h3></div>
        
        {/* --- FIX 3: AÑADIMOS EL MENÚ DESPLEGABLE DE ESTADOS --- */}
        <div>
          <select
              value={ticket.estado}
              onChange={handleEstadoChange}
              className="bg-input border-border rounded-md px-2 py-1.5 text-sm font-semibold focus:ring-2 focus:ring-primary"
          >
              {Object.keys(ESTADOS).map(estado => (
                  <option key={estado} value={estado}>{ESTADOS[estado].label}</option>
              ))}
          </select>
        </div>
      </header>
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        <div className="pb-4 border-b border-border">
          <h4 className="font-semibold text-lg text-foreground">{ticket.asunto}</h4>
          <p className="whitespace-pre-wrap text-muted-foreground">{ticket.detalles}</p>
        </div>
        {ticket.comentarios?.map(c => (
          <div key={c.id} className={`flex ${c.es_admin ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-lg px-4 py-2 rounded-lg ${c.es_admin ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
              <p className="whitespace-pre-wrap">{c.comentario}</p>
              <span className="text-xs opacity-70 block text-right mt-1">{fechaCorta(c.fecha)}</span>
            </div>
          </div>
        ))}
        <div ref={chatBottomRef} />
      </div>
      <footer className="border-t border-border p-3 flex gap-2 bg-card">
        <Input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Escribe tu respuesta como agente..." onKeyDown={e => e.key === 'Enter' && handleSendMessage()} disabled={isSending} />
        <Button onClick={handleSendMessage} disabled={isSending || !newMessage.trim()}>{isSending ? <Loader2 className="animate-spin" /> : <Send />}</Button>
      </footer>
    </div>
  );
};