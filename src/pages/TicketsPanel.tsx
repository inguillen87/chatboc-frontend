// Contenido COMPLETO y FINAL para: TicketsPanel.tsx

import React, { useEffect, useState, useCallback, FC, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, ArrowLeft, Send, Ticket as TicketIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, ApiError } from "@/utils/api";
import type { Ticket as TicketType, Comment } from "@/types";

const useIsMobile = (breakpoint = 768) => {
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < breakpoint : false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [breakpoint]);
  return isMobile;
};
const fechaCorta = (iso: string) => iso ? new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : "";
const ESTADOS: Record<string, { label: string; badge: string }> = {
    nuevo: { label: 'Nuevo', badge: 'bg-blue-500' },
    "en curso": { label: 'En Curso', badge: 'bg-yellow-500' },
    resuelto: { label: 'Resuelto', badge: 'bg-green-500' },
    cerrado: { label: 'Cerrado', badge: 'bg-gray-500' },
};

export default function TicketsPanel() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<TicketType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    const userRaw = localStorage.getItem("user");
    if (userRaw) {
      try {
        const user = JSON.parse(userRaw);
        if (user && user.id) {
          setUserId(user.id);
        } else {
          throw new Error("Datos de usuario inválidos en sesión.");
        }
      } catch {
        localStorage.clear();
        navigate("/login");
      }
    } else {
      navigate("/login");
    }
  }, [navigate]);

  const fetchTickets = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const fetchedTickets = await apiFetch<TicketType[]>(`/tickets/municipio?user_id=${userId}`);
      setTickets(fetchedTickets || []);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.body?.error || "Ocurrió un error al cargar los tickets.");
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchTickets();
    }
  }, [userId, fetchTickets]);

  const showList = !isMobile || !selectedTicket;
  const showDetail = !!selectedTicket;

  return (
    <div className="flex h-[calc(100vh-80px)] max-w-7xl mx-auto my-8 shadow-2xl rounded-2xl overflow-hidden border bg-white dark:bg-slate-950 dark:border-slate-800">
      {showList && (
        <aside className="w-full md:w-1/3 md:max-w-[400px] bg-slate-50 dark:bg-slate-900 border-r dark:border-slate-800 flex flex-col">
          <header className="px-6 py-5 flex items-center gap-3 border-b dark:border-slate-800">
            <CheckCircle2 className="text-blue-500 w-6 h-6" />
            <h2 className="font-bold text-xl text-slate-800 dark:text-slate-100">Tickets de Vecinos</h2>
          </header>
          {isLoading ? <div className="p-6 text-center text-slate-500">Cargando tickets...</div> :
            error ? <div className="p-6 text-red-500">{error}</div> :
              <TicketList tickets={tickets} selectedTicketId={selectedTicket?.id || null} onSelectTicket={setSelectedTicket} />
          }
        </aside>
      )}
      <main className="flex-1 bg-white dark:bg-slate-950">
        <AnimatePresence mode="wait">
          {showDetail && selectedTicket && userId ? (
            <motion.div key={selectedTicket.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <TicketDetail ticket={selectedTicket} userId={userId} onBack={() => setSelectedTicket(null)} />
            </motion.div>
          ) : (
            !isMobile && (
              <div className="h-full flex flex-col items-center justify-center text-slate-500">
                  <TicketIcon size={48} className="mb-4" />
                  <p>Selecciona un ticket para ver los detalles</p>
              </div>
            )
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

interface TicketListProps { tickets: TicketType[]; selectedTicketId: number | null; onSelectTicket: (ticket: TicketType) => void; }
const TicketList: FC<TicketListProps> = ({ tickets, selectedTicketId, onSelectTicket }) => (
    <div className="flex-1 overflow-y-auto">
      {tickets.length === 0 ? <p className="p-6 text-center text-slate-500">No hay tickets para mostrar.</p> :
        tickets.map((t) => (
          <div key={t.id} onClick={() => onSelectTicket(t)}
            className={`p-4 flex flex-col gap-1 border-b dark:border-slate-800 cursor-pointer transition-colors ${selectedTicketId === t.id ? "bg-blue-100 dark:bg-blue-900/70" : "hover:bg-blue-50 dark:hover:bg-blue-950/60"}`}>
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-800 dark:text-slate-200">#{t.nro_ticket}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold text-white shadow ${ESTADOS[t.estado]?.badge || 'bg-gray-400'}`}>{ESTADOS[t.estado]?.label || t.estado}</span>
            </div>
            <span className="text-sm text-slate-700 dark:text-slate-300 truncate font-medium">{t.pregunta}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{fechaCorta(t.fecha)}</span>
          </div>
        ))
      }
    </div>
);

interface TicketDetailProps { ticket: TicketType; userId: number; onBack: () => void; }
const TicketDetail: FC<TicketDetailProps> = ({ ticket, userId, onBack }) => {
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
            setComments(response.comentarios || []);
        } catch (err) { console.error(`Error cargando comentarios para ticket ${ticket.id}:`, err); } 
        finally { setIsLoading(false); }
    }, [ticket.id, userId]);

    useEffect(() => { fetchComments(); }, [fetchComments]);

    const handleSendMessage = async () => {
        if (!newMessage.trim()) return;
        setIsSending(true);
        try {
            await apiFetch(`/tickets/${ticket.id}/comentarios`, { method: 'POST', body: { user_id: userId, comentario: newMessage } });
            setNewMessage("");
            await fetchComments();
        } catch (err) { console.error("Error al enviar comentario:", err); } 
        finally { setIsSending(false); }
    };
    
    useEffect(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [comments]);

    return (
        <div className="flex flex-col h-full">
          <header className="flex items-center gap-3 p-4 border-b dark:border-slate-800 shrink-0">
            {isMobile && <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft /></Button>}
            <TicketIcon className="text-blue-500 w-6 h-6" />
            <div className="flex-1"><h3 className="font-bold text-lg truncate">Ticket #{ticket.nro_ticket}</h3></div>
          </header>
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50 dark:bg-slate-900/50">
              <div className="pb-4 border-b dark:border-slate-700"><p className="whitespace-pre-wrap text-slate-800 dark:text-slate-200">{ticket.pregunta}</p></div>
              {isLoading ? <p className="text-center text-slate-500">Cargando comentarios...</p> : comments.map(c => (
                <div key={c.id} className={`flex ${c.es_admin ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-md px-4 py-2 rounded-xl ${c.es_admin ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-700'}`}>{c.comentario}</div>
                </div>
              ))}
              <div ref={chatBottomRef} />
          </div>
          <footer className="border-t p-3 flex gap-2 bg-white dark:bg-slate-950 shrink-0">
              <Input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Escribe tu respuesta..." onKeyDown={e => e.key === 'Enter' && !isSending && handleSendMessage()} disabled={isSending} />
              <Button onClick={handleSendMessage} disabled={isSending || !newMessage.trim()}>{isSending ? <Loader2 className="animate-spin" /> : <Send />}</Button>
          </footer>
        </div>
    );
};