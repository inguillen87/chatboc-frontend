import React, { useEffect, useState, useCallback, FC, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Ticket as TicketIcon, ChevronDown, ChevronUp, User, ShieldCheck, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, ApiError } from "@/utils/api";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/utils/fecha";
import { useDateSettings } from "@/hooks/useDateSettings";
import { LOCALE_OPTIONS } from "@/utils/localeOptions";

// ----------- TIPOS Y ESTADOS -----------
type TicketStatus = "nuevo" | "en_proceso" | "derivado" | "resuelto" | "cerrado" | "esperando_agente_en_vivo";
interface Comment { id: number; comentario: string; fecha: string; es_admin: boolean; }
interface Ticket {
  id: number; tipo: 'pyme' | 'municipio'; nro_ticket: number; asunto: string; estado: TicketStatus; fecha: string;
  detalles?: string; comentarios?: Comment[]; nombre_usuario?: string; email_usuario?: string; telefono?: string; direccion?: string; archivo_url?: string; categoria?: string;
  municipio_nombre?: string; // <- Opción para relacionar con municipio
  latitud?: number | null;
  longitud?: number | null;
}
interface TicketSummary extends Omit<Ticket, 'detalles' | 'comentarios'> {
  direccion?: string;
  latitud?: number | null;
  longitud?: number | null;
}
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

// ----------- MAIN PANEL -----------
export default function TicketsPanel() {
  const { timezone, locale, updateSettings } = useDateSettings();
  const [categorizedTickets, setCategorizedTickets] = useState<CategorizedTickets>({});
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [detailedTicket, setDetailedTicket] = useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());

  const fetchAndSetTickets = useCallback(async () => {
    if (!safeLocalStorage.getItem('authToken')) return;
    try {
      const data = await apiFetch<CategorizedTickets>('/tickets/panel_por_categoria');
      setCategorizedTickets(data);
      setOpenCategories(prev => {
        const newSet = new Set(prev);
        Object.keys(data).forEach(cat => {
          if (!newSet.has(cat) && !['cerrado', 'resuelto'].includes(cat.toLowerCase())) {
            newSet.add(cat);
          }
        });
        return newSet;
      });
    } catch (err) {
      console.error('Error al actualizar el panel de tickets', err);
    }
  }, []);

  useEffect(() => {
    const fetchInitialData = async () => {
      if (!safeLocalStorage.getItem('authToken')) {
        setError('Sesión no válida. Por favor, inicie sesión de nuevo.');
        setIsLoading(false);
        return;
      }
      try {
        await fetchAndSetTickets();
      } catch (err) {
        const errorMessage = err instanceof ApiError ? err.message : 'Ocurrió un error al cargar el panel de tickets.';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchAndSetTickets();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchAndSetTickets]);

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
    const token = safeLocalStorage.getItem('authToken');
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
        <div className="mt-2 max-w-xs">
          <Select
            value={locale}
            onValueChange={(val) => {
              const opt = LOCALE_OPTIONS.find((o) => o.locale === val);
              if (opt) updateSettings(opt.timezone, opt.locale);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Idioma" />
            </SelectTrigger>
            <SelectContent>
              {LOCALE_OPTIONS.map((opt) => (
                <SelectItem key={opt.locale} value={opt.locale}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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

// --------- TicketCategoryAccordion ---------
const TicketCategoryAccordion: FC<{
  category: string;
  tickets: TicketSummary[];
  onSelectTicket: (ticket: TicketSummary) => void;
  isOpen: boolean;
  onToggle: () => void;
  selectedTicketId: number | null;
  detailedTicket: Ticket | null;
  onTicketDetailUpdate: (ticket: Ticket) => void;
}> = ({ category, tickets, onSelectTicket, isOpen, onToggle, selectedTicketId, detailedTicket, onTicketDetailUpdate }) => {
<<<<<<< jfa1vl-codex/corregir-error-de-timezone-no-definido
  // Ensure timezone and locale are defined before formatting dates
=======
<<<<<<< jfa1vl-codex/corregir-error-de-timezone-no-definido
  // Ensure timezone and locale are defined before formatting dates
=======
<<<<<<< jfa1vl-codex/corregir-error-de-timezone-no-definido
  // Ensure timezone and locale are defined before formatting dates
=======
<<<<<<< jfa1vl-codex/corregir-error-de-timezone-no-definido
  // Get timezone and locale for consistent date formatting
=======
<<<<<<< jfa1vl-codex/corregir-error-de-timezone-no-definido
  // Get timezone and locale for consistent date formatting
=======
>>>>>>> main
>>>>>>> main
>>>>>>> main
>>>>>>> main
>>>>>>> main
  const { timezone, locale } = useDateSettings();
  return (
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
                    "bg-background dark:bg-slate-800/50 p-3 rounded-lg border cursor-pointer transition-all shadow-sm",
                    "hover:border-primary dark:hover:border-primary hover:shadow-lg hover:-translate-y-1",
                    selectedTicketId === ticket.id ? "border-primary dark:border-primary ring-2 ring-primary/50 -translate-y-1" : "border-border dark:border-slate-700/50",
                    selectedTicketId === ticket.id ? "col-span-full" : ""
                  )}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-primary text-sm">#{ticket.nro_ticket}</span>
                    <Badge className={cn("text-xs border", ESTADOS[ticket.estado as TicketStatus]?.tailwind_class)}>{ESTADOS[ticket.estado as TicketStatus]?.label}</Badge>
                  </div>
                  <p className="font-medium text-foreground truncate" title={ticket.asunto}>{ticket.asunto}</p>
                  {ticket.direccion && <p className="text-xs text-muted-foreground truncate" title={ticket.direccion}>{ticket.direccion}</p>}
                  <p className="text-xs text-muted-foreground text-right mt-1">{formatDate(ticket.fecha, timezone, locale)}</p>
                </div>
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
                        <h3 className="text-lg font-bold text-foreground">Detalle del Ticket #{detailedTicket.nro_ticket}</h3>
                        <Button variant="ghost" size="icon" onClick={() => onSelectTicket(ticket)} aria-label="Cerrar detalle">
                          <X className="h-5 w-5" />
                        </Button>
                      </div>
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
};

const MAX_EVENTOS_RESUMIDOS = 4;

// --------- TicketTimeline ---------
const TicketTimeline: FC<{ ticket: Ticket; comentarios: Comment[] }> = ({ ticket, comentarios }) => {
  const { timezone, locale } = useDateSettings();
  const [verTodo, setVerTodo] = useState(false);

  // Armá la lista completa de eventos
  const eventos = [
    { fecha: ticket.fecha, descripcion: "Ticket creado", estado: "nuevo" },
    ...(comentarios.length
      ? comentarios.map((c) => ({
          fecha: c.fecha,
          descripcion: c.es_admin ? "Respuesta de administrador" : "Comentario de usuario",
          estado: ticket.estado,
        }))
      : []),
  ];

  // Mostrá los últimos MAX_EVENTOS_RESUMIDOS si no está expandido
  const mostrarEventos = verTodo ? eventos : eventos.slice(-MAX_EVENTOS_RESUMIDOS);

  return (
    <div className="mb-6">
      <h4 className="font-semibold mb-2">Actividad</h4>
      <ol className="border-l-2 border-primary/60 pl-3 space-y-2 text-xs">
        {mostrarEventos.map((ev, i) => (
          <li key={i} className="relative pl-3">
            <span className="absolute left-[-9px] top-1.5 w-3 h-3 rounded-full border-2 border-primary bg-card" />
            <div>
              <span className="font-medium">{ev.descripcion}</span>
              <span className="ml-2 text-muted-foreground">{formatDate(ev.fecha, timezone, locale)}</span>
            </div>
          </li>
        ))}
      </ol>
      {eventos.length > MAX_EVENTOS_RESUMIDOS && (
        <button
          className="mt-2 text-xs text-primary underline cursor-pointer"
          onClick={() => setVerTodo((v) => !v)}
        >
          {verTodo ? "Ver menos" : `Ver todo (${eventos.length})`}
        </button>
      )}
    </div>
  );
};

// --------- TicketMap robusto ---------
const buildFullAddress = (ticket: Ticket) => {
  let direccion = ticket.direccion || "";
  if (
    ticket.municipio_nombre &&
    !direccion.toLowerCase().includes(ticket.municipio_nombre.toLowerCase())
  ) {
    direccion += (direccion ? ", " : "") + ticket.municipio_nombre;
  }
  return direccion;
};

const TicketMap: FC<{ ticket: Ticket }> = ({ ticket }) => {
  const direccionCompleta = buildFullAddress(ticket);
  const hasCoords =
    typeof ticket.latitud === 'number' && typeof ticket.longitud === 'number';
  const mapSrc = hasCoords
    ? `https://www.google.com/maps?q=${ticket.latitud},${ticket.longitud}&output=embed`
    : `https://www.google.com/maps?q=${encodeURIComponent(direccionCompleta)}&output=embed`;
  return ticket.direccion || hasCoords ? (
    <div className="mb-6">
      <h4 className="font-semibold mb-2">Ubicación aproximada</h4>
      <div className="w-full rounded overflow-hidden" style={{ height: 180 }}>
        <iframe
          width="100%"
          height="180"
          style={{ border: 0 }}
          loading="lazy"
          allowFullScreen
          src={mapSrc}
        />
      </div>
      <div className="text-xs mt-1 text-muted-foreground truncate">{direccionCompleta}</div>
    </div>
  ) : null;
};

const CATEGORIAS_CHAT_EN_VIVO = [
  "atención en vivo",
  "chat en vivo",
  "soporte urgente"
];

const TicketDetail: FC<{ ticket: Ticket; onTicketUpdate: (ticket: Ticket) => void }> = ({ ticket, onTicketUpdate }) => {
  const { timezone, locale } = useDateSettings();
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [comentarios, setComentarios] = useState<Comment[]>(ticket.comentarios || []);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const ultimoMensajeIdRef = useRef<number>(0);

  const chatEnVivo = useMemo(() => {
    const categoriaNormalizada = (ticket.asunto || ticket.categoria || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    return (
      CATEGORIAS_CHAT_EN_VIVO.some((cat) =>
        categoriaNormalizada.includes(
          cat.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        )
      ) && ["esperando_agente_en_vivo", "en_proceso"].includes(ticket.estado)
    );
  }, [ticket.asunto, ticket.categoria, ticket.estado]);

  const fetchComentarios = useCallback(async () => {
    try {
      const data = await apiFetch(`/tickets/chat/${ticket.id}/mensajes?ultimo_mensaje_id=${ultimoMensajeIdRef.current}`);
      if (data.mensajes && data.mensajes.length > 0) {
        setComentarios((prev) => {
          const idsPrev = new Set(prev.map((m) => m.id));
          const nuevos = data.mensajes.filter((m) => !idsPrev.has(m.id));
          if (nuevos.length > 0) {
            ultimoMensajeIdRef.current = nuevos[nuevos.length - 1].id;
            return [
              ...prev,
              ...nuevos.map((msg) => ({
                id: msg.id,
                comentario: msg.texto,
                fecha: msg.fecha,
                es_admin: msg.es_admin,
              })),
            ];
          }
          return prev;
        });
      }
    } catch (e) {
      console.error("Error en polling de comentarios:", e);
    }
    // Siempre refrescar el ticket para detectar nueva ubicación u otros cambios
    try {
      const updated = await apiFetch<Ticket>(`/tickets/${ticket.tipo}/${ticket.id}`);
      onTicketUpdate({ ...ticket, ...updated });
    } catch (e) {
      console.error("Error al refrescar ticket:", e);
    }
  }, [ticket.id, ticket.tipo, onTicketUpdate]);

  // --- Polling SOLO en tickets "en vivo" ---
  useEffect(() => {
    // Resetea comentarios y último ID si cambia de ticket
    setComentarios(ticket.comentarios || []);
    ultimoMensajeIdRef.current =
      ticket.comentarios && ticket.comentarios.length
        ? ticket.comentarios[ticket.comentarios.length - 1].id
        : 0;

    if (pollingRef.current) clearInterval(pollingRef.current);

    if (!chatEnVivo) return;

    fetchComentarios();
    pollingRef.current = setInterval(fetchComentarios, 5000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [ticket.id, ticket.comentarios, chatEnVivo, fetchComentarios]);

  // --- Scroll SOLO si cambian los comentarios ---
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [comentarios.length]);

  // --- Envío de mensaje (igual que antes) ---
  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending) return;
    setIsSending(true);
    try {
      const updatedTicket = await apiFetch<Ticket>(`/tickets/${ticket.tipo}/${ticket.id}/responder`, {
        method: "POST",
        body: { comentario: newMessage }
      });
      setComentarios(updatedTicket.comentarios || []);
      setNewMessage("");
      // Si querés actualizar el ticket padre
      onTicketUpdate({ ...ticket, ...updatedTicket });
    } catch (error) {
      console.error("Error al enviar comentario", error);
    } finally {
      setIsSending(false);
    }
  };

  // --- Cambio de Estado ---
  const handleEstadoChange = async (nuevoEstado: TicketStatus) => {
    try {
      const updatedTicket = await apiFetch<Ticket>(
        `/tickets/${ticket.tipo}/${ticket.id}/estado`,
        { method: "PUT", body: { estado: nuevoEstado } }
      );
      const mergedTicket = { ...ticket, ...updatedTicket };
      if (!updatedTicket.comentarios && ticket.comentarios) {
        mergedTicket.comentarios = ticket.comentarios;
      }
      onTicketUpdate(mergedTicket);
    } catch (error) {
      // Manejo de error opcional
    }
  };

  // --- Scroll al final del chat ---
  useEffect(() => {
    const mainElement = chatBottomRef.current?.parentElement;
    if (
      mainElement &&
      mainElement.scrollHeight > mainElement.clientHeight &&
      comentarios &&
      comentarios.length > 0
    ) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [comentarios]);

  return (
    <div className="flex flex-col md:grid md:grid-cols-3 gap-4">
      {/* Chat principal */}
      <div className="md:col-span-2 flex flex-col h-[60vh] max-h-[600px] min-h-[300px] border rounded-md bg-background dark:bg-slate-700/50">
        {/* BOTÓN SOLO PARA TICKETS NORMALES */}
        {!chatEnVivo && (
          <div className="p-2 flex justify-end">
            <Button size="sm" variant="outline" onClick={fetchComentarios}>
              Actualizar mensajes
            </Button>
          </div>
        )}
        <main className="flex-1 p-4 space-y-4 overflow-y-auto custom-scroll">
          {comentarios && comentarios.length > 0 ? (
            comentarios.map((comment) => (
              <div key={comment.id} className={cn('flex items-end gap-2', comment.es_admin ? 'justify-end' : 'justify-start')}>
                {!comment.es_admin && <AvatarIcon type="user" />}
                <div className={cn("max-w-md rounded-lg px-4 py-2", comment.es_admin ? "bg-primary text-primary-foreground rounded-br-none" : "bg-muted text-foreground rounded-bl-none")}>
                  <p className="text-sm">{comment.comentario}</p>
                  <p className="text-xs opacity-70 text-right mt-1">{formatDate(comment.fecha, timezone, locale)}</p>
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
      {/* Sidebar mejorado */}
      <aside className="md:col-span-1 bg-muted/30 p-4 space-y-6 overflow-y-auto custom-scroll rounded-md border">
        <TicketTimeline ticket={ticket} comentarios={comentarios} />
        <TicketMap ticket={ticket} />
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Estado del Ticket</CardTitle></CardHeader>
          <CardContent>
            <Select onValueChange={handleEstadoChange} value={ticket.estado}>
              <SelectTrigger className="w-full bg-transparent border border-border dark:bg-transparent focus:ring-0"><SelectValue placeholder="Cambiar estado..." /></SelectTrigger>
              <SelectContent>
                {Object.entries(ESTADOS).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        {(ticket.nombre_usuario || ticket.email_usuario || ticket.telefono) && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Información del Usuario</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-1">
              {ticket.nombre_usuario && <p><strong>Nombre:</strong> {ticket.nombre_usuario}</p>}
              {ticket.email_usuario && <p><strong>Email:</strong> {ticket.email_usuario}</p>}
              {ticket.telefono && <p><strong>Teléfono:</strong> {ticket.telefono}</p>}
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


// --------- AvatarIcon ---------
const AvatarIcon: FC<{ type: 'user' | 'admin' }> = ({ type }) => (
  <div className={cn('h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0', type === 'admin' ? 'bg-primary/20 text-primary' : 'bg-muted-foreground/20 text-muted-foreground')}>
    {type === 'admin' ? <ShieldCheck className="h-5 w-5" /> : <User className="h-5 w-5" />}
  </div>
);
