import React, { useEffect, useState, useCallback, FC, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, ArrowLeft, Send, Ticket } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, ApiError } from "@/utils/api";
import type { Ticket as TicketType, TicketStatus, Comment } from "@/types";

const ESTADOS: Record<TicketStatus, { label: string; color: string; bg: string; badge: string; }> = {
  nuevo: { label: "Nuevo", color: "bg-blue-100 text-blue-700", badge: "bg-blue-600", bg: "bg-blue-50" },
  "en curso": { label: "En Curso", color: "bg-yellow-100 text-yellow-800", badge: "bg-yellow-500", bg: "bg-yellow-50" },
  derivado: { label: "Derivado", color: "bg-purple-100 text-purple-700", badge: "bg-purple-500", bg: "bg-purple-50" },
  resuelto: { label: "Resuelto", color: "bg-green-100 text-green-700", badge: "bg-green-600", bg: "bg-green-50" },
  cerrado: { label: "Cerrado", color: "bg-gray-200 text-gray-500", badge: "bg-gray-400", bg: "bg-gray-100" },
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
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<TicketType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const isMobile = useIsMobile();

  // Al montar, leo el userId desde localStorage:
  useEffect(() => {
    const userRaw = localStorage.getItem("user");
    if (userRaw) {
      try {
        const user = JSON.parse(userRaw);
        if (user.id) setUserId(user.id);
      } catch (e) {
        setUserId(null);
      }
    }
  }, []);

  const fetchTickets = useCallback(async () => {
    if (!userId) return; // No hacemos nada si no hay userId
    setIsLoading(true);
    setError(null);
    try {
      // CÓMO DEBE QUEDAR
      const fetchedTickets = await apiFetch<TicketType[]>(`/tickets/?user_id=${userId}`);
      setTickets(fetchedTickets || []); // Guardamos la respuesta directamente
    } catch (err) {
      const errorMessage = err instanceof ApiError ? err.message : "Ocurrió un error inesperado.";
      setError(errorMessage);
      console.error("❌ Error cargando tickets:", err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const showList = !isMobile || !selectedTicket;
  const showDetail = !!selectedTicket;

  return (
    // MODIFICADO: Fondo, texto y borde principales
    <div className="flex h-[calc(100vh-80px)] max-w-6xl mx-auto my-8 shadow-2xl rounded-2xl overflow-hidden border border-border bg-card text-foreground">
      {showList && (
        <aside className="w-full md:w-1/3 md:max-w-[400px] bg-background border-r border-border flex flex-col">
          <header className="px-6 py-5 flex items-center gap-2 border-b border-border">
            <CheckCircle2 className="text-primary" /><h2 className="font-bold text-lg text-foreground">Tickets de Vecinos</h2>
          </header>
          {isLoading ? <div className="p-4 text-center text-muted-foreground">Cargando tickets...</div> :
            error ? <div className="p-4 text-destructive">{error}</div> :
              <TicketList tickets={tickets} selectedTicketId={selectedTicket?.id || null} onSelectTicket={setSelectedTicket} />
          }
        </aside>
      )}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          {showDetail && selectedTicket && userId && (
            <motion.div key={selectedTicket.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <TicketDetail ticket={selectedTicket} onBack={() => setSelectedTicket(null)} userId={userId} onTicketUpdate={(updatedTicket) => {
                setTickets(prev => prev.map(t => t.id === updatedTicket.id ? updatedTicket : t));
                setSelectedTicket(updatedTicket);
              }} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

interface TicketListProps {
  tickets: TicketType[];
  selectedTicketId: number | null;
  onSelectTicket: (ticket: TicketType) => void;
}
const TicketList: FC<TicketListProps> = ({ tickets, selectedTicketId, onSelectTicket }) => (
  <div className="flex-1 overflow-y-auto">
    {tickets.length === 0 && <p className="p-4 text-center text-muted-foreground">No hay tickets para mostrar.</p>}
    {tickets.map((t) => (
      <motion.div key={t.id} layoutId={`ticket-container-${t.id}`}
        className={`p-4 flex flex-col gap-1 border-b border-border cursor-pointer transition-colors hover:bg-accent ${selectedTicketId === t.id ? "bg-secondary border-l-4 border-primary" : "bg-background"}`}
        onClick={() => onSelectTicket(t)}>
        <div className="flex justify-between items-center">
          <span className="font-semibold text-primary">#{t.nro_ticket}</span>
          <span className={`px-3 py-1 rounded-full text-xs font-bold text-primary-foreground shadow ${ESTADOS[t.estado]?.badge || 'bg-muted'}`}>{ESTADOS[t.estado]?.label || t.estado}</span>
        </div>
        <span className="text-sm text-foreground truncate font-medium">{t.asunto || t.pregunta}</span>
        <span className="text-xs text-muted-foreground">{fechaCorta(t.fecha)}</span>
      </motion.div>
    ))}
  </div>
);

interface TicketDetailProps {
  ticket: TicketType;
  userId: number;
  onBack: () => void;
  onTicketUpdate: (ticket: TicketType) => void;
}
const TicketDetail: FC<TicketDetailProps> = ({ ticket, userId, onBack, onTicketUpdate }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const fetchComments = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch<{ comentarios: Comment[] }>(`/tickets/${ticket.id}/comentarios?user_id=${userId}`);
      setComments(response.comentarios);
    } catch (err) {
      console.error(`❌ Error cargando comentarios para el ticket ${ticket.id}:`, err);
    } finally {
      setIsLoading(false);
    }
  }, [ticket.id, userId]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    setIsSending(true);
    try {
      await apiFetch(`/tickets/${ticket.id}/comentarios`, {
        method: 'POST',
        body: { user_id: userId, comentario: newMessage },
      });
      setNewMessage("");
      await fetchComments();
    } catch (err) {
      console.error("❌ Error al enviar comentario:", err);
    } finally {
      setIsSending(false);
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  return (
    // MODIFICADO: Fondo del detalle del ticket
    <div className="flex flex-col h-full bg-background text-foreground">
      <header className="flex items-center gap-3 p-5 border-b border-border">
        {isMobile && <button className="p-2 text-foreground" onClick={onBack}><ArrowLeft /></button>}
        <Ticket className="text-primary w-7 h-7" />
        <div className="flex-1"><h3 className="font-bold text-lg truncate text-foreground">Ticket #{ticket.nro_ticket}</h3></div>
      </header>
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        <div className="pb-4 border-b border-border">
          <h4 className="font-semibold text-lg text-foreground">{ticket.asunto || "Detalle"}</h4>
          <p className="whitespace-pre-wrap text-muted-foreground">{ticket.pregunta}</p>
        </div>
        {isLoading ? <p className="text-center text-muted-foreground">Cargando comentarios...</p> : comments.map(c => (
          <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${c.es_admin ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-lg px-4 py-2 rounded-lg ${c.es_admin ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
              {c.comentario}
            </div>
          </motion.div>
        ))}
        <div ref={chatBottomRef} />
      </div>
      <footer className="border-t border-border p-3 flex gap-2 bg-card">
        <Input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Escribe tu respuesta..." onKeyDown={e => e.key === 'Enter' && handleSendMessage()} disabled={isSending}
          className="bg-input border-input text-foreground placeholder:text-muted-foreground" />
        <Button onClick={handleSendMessage} disabled={isSending || !newMessage.trim()} className="bg-primary hover:bg-primary/90 text-primary-foreground">{isSending ? <Loader2 className="animate-spin" /> : <Send />}</Button>
      </footer>
    </div>
  );
};