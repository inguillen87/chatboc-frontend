import React, { useEffect, useState, useCallback, FC, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Ticket as TicketIcon, ChevronDown, ChevronUp, User, ShieldCheck, X, Search, Filter, ListFilter, File } from "lucide-react"; // Added Search, Filter, File
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, ApiError } from "@/utils/api";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
// import getOrCreateAnonId from "@/utils/anonId"; // No se usa en admin panel
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AttachmentPreview from "@/components/chat/AttachmentPreview";
import { getAttachmentInfo } from "@/utils/attachment";
import { formatDate } from "@/utils/fecha";
import { useDateSettings } from "@/hooks/useDateSettings";
import { LOCALE_OPTIONS } from "@/utils/localeOptions";
import useRequireRole from "@/hooks/useRequireRole";
import type { Role } from "@/utils/roles";
import { ScrollArea } from "@/components/ui/scroll-area";


// ----------- TIPOS Y ESTADOS -----------
type TicketStatus = "nuevo" | "en_proceso" | "derivado" | "resuelto" | "cerrado" | "esperando_agente_en_vivo";
interface Comment { id: number; comentario: string; fecha: string; es_admin: boolean; }
interface Ticket {
  id: number; tipo: 'pyme' | 'municipio'; nro_ticket: number; asunto: string; estado: TicketStatus; fecha: string;
  detalles?: string; comentarios?: Comment[]; nombre_usuario?: string; email_usuario?: string; telefono?: string; direccion?: string; archivo_url?: string; categoria?: string;
  municipio_nombre?: string;
  latitud?: number | null;
  longitud?: number | null;
}
interface TicketSummary extends Omit<Ticket, 'detalles' | 'comentarios'> {
  direccion?: string;
  latitud?: number | null;
  longitud?: number | null;
}
// type CategorizedTickets = { [category: string]: TicketSummary[]; }; // Ya no se usa directamente para el estado principal

const ESTADOS_ORDEN_PRIORIDAD: TicketStatus[] = ["nuevo", "en_proceso", "esperando_agente_en_vivo", "derivado", "resuelto", "cerrado"];
const ESTADOS: Record<TicketStatus, { label: string; tailwind_class: string, icon?: React.ElementType }> = {
  nuevo: { label: "Nuevo", tailwind_class: "bg-blue-500 hover:bg-blue-600 text-white border-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600", icon: TicketIcon },
  en_proceso: { label: "En Proceso", tailwind_class: "bg-yellow-500 hover:bg-yellow-600 text-black border-yellow-700 dark:bg-yellow-400 dark:hover:bg-yellow-500", icon: Loader2 },
  derivado: { label: "Derivado", tailwind_class: "bg-purple-500 hover:bg-purple-600 text-white border-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600" },
  resuelto: { label: "Resuelto", tailwind_class: "bg-green-500 hover:bg-green-600 text-white border-green-700 dark:bg-green-500 dark:hover:bg-green-600" },
  cerrado: { label: "Cerrado", tailwind_class: "bg-gray-500 hover:bg-gray-600 text-white border-gray-700 dark:bg-gray-600 dark:hover:bg-gray-700" },
  esperando_agente_en_vivo: { label: "Esperando agente", tailwind_class: "bg-red-500 hover:bg-red-600 text-white border-red-700 dark:bg-red-500 dark:hover:bg-red-600" }
};


// ----------- NUEVOS COMPONENTES -----------

const TicketListItem: FC<{
  ticket: TicketSummary;
  isSelected: boolean;
  onSelect: () => void;
  timezone: string;
  locale: string;
}> = ({ ticket, isSelected, onSelect, timezone, locale }) => {
  // const EstadoIcon = ESTADOS[ticket.estado]?.icon; // Podría usarse si se quiere un icono junto al estado
  return (
    <motion.div
      layout
      onClick={onSelect}
      className={cn(
        "p-3 rounded-lg border cursor-pointer mb-2 transition-all duration-200 ease-in-out",
        "hover:shadow-md dark:hover:bg-slate-700/60",
        isSelected
          ? "bg-primary/10 border-primary dark:bg-primary/20 dark:border-primary ring-1 ring-primary"
          : "bg-card dark:bg-slate-800 border-border dark:border-slate-700/80 hover:border-slate-400 dark:hover:border-slate-500"
      )}
      whileHover={{ y: -2 }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
    >
      <div className="flex justify-between items-center mb-1">
        <span className="font-semibold text-primary text-sm truncate max-w-[100px]" title={`#${ticket.nro_ticket}`}>#{ticket.nro_ticket}</span>
        <Badge className={cn("text-xs border", ESTADOS[ticket.estado]?.tailwind_class)}>{ESTADOS[ticket.estado]?.label}</Badge>
      </div>
      <p className="font-medium text-foreground truncate text-sm" title={ticket.asunto}>{ticket.asunto}</p>
      {ticket.nombre_usuario && <p className="text-xs text-muted-foreground truncate" title={ticket.nombre_usuario}>{ticket.nombre_usuario}</p>}
      <p className="text-xs text-muted-foreground text-right mt-1">{formatDate(ticket.fecha, timezone, locale)}</p>
    </motion.div>
  );
};

interface TicketDetailViewProps {
  ticket: Ticket;
  onTicketUpdate: (updatedTicket: Ticket) => void;
  onClose: () => void; 
}


// ----------- MAIN PANEL (Refactorizado) -----------
export default function TicketsPanel() {
  useRequireRole(['admin', 'empleado'] as Role[]);
  const { timezone, locale, updateSettings } = useDateSettings();
  const [allTickets, setAllTickets] = useState<TicketSummary[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [detailedTicket, setDetailedTicket] = useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "">("");
  const [categoryFilter, setCategoryFilter] = useState(""); // Se mantiene por si se usa, aunque el foco está en statusFilter

  const fetchAndSetTickets = useCallback(async () => {
    if (!safeLocalStorage.getItem('authToken')) return;
    setIsLoading(true);
    try {
      // Asumimos que el backend puede filtrar por estado y categoría si se proveen.
      // El endpoint /tickets/panel_por_categoria devuelve un objeto CategorizedTickets.
      // Necesitamos aplanar esto o usar un endpoint que devuelva TicketSummary[].
      // Opción 1: Usar /tickets/panel_por_categoria y aplanar/filtrar en cliente.
      // Opción 2: (Preferido si existe) Usar un endpoint como /tickets/panel?estado=...&categoria=...
      // Por ahora, vamos con la Opción 1 si /tickets/panel no existe o no funciona como esperamos.

      let url = '/tickets/panel_por_categoria'; // Usamos el endpoint existente
      const params: string[] = [];
      // Estos filtros en la URL son para /tickets/panel_por_categoria, pueden no ser necesarios si filtramos en cliente después
      if (statusFilter) params.push(`estado=${encodeURIComponent(statusFilter)}`);
      if (categoryFilter) params.push(`categoria=${encodeURIComponent(categoryFilter)}`);
      if (params.length) url += `?${params.join('&')}`;
      
      const data = await apiFetch<{[category: string]: TicketSummary[]}>(url, { sendEntityToken: true });
      
      // Aplanar y aplicar filtros de cliente si es necesario
      let fetchedTickets: TicketSummary[] = [];
      for (const categoryKey in data) {
        fetchedTickets = fetchedTickets.concat(data[categoryKey]);
      }

      // Si statusFilter o categoryFilter se usaron en la URL, el backend ya filtró.
      // Si no, y queremos filtrar en cliente adicionalmente (ej. el endpoint no soporta todos los filtros):
      // if (statusFilter) {
      //   fetchedTickets = fetchedTickets.filter(t => t.estado === statusFilter);
      // }
      // if (categoryFilter && !params.some(p => p.startsWith('categoria='))) { // si no se filtró por backend
      //  fetchedTickets = fetchedTickets.filter(t => t.categoria?.toLowerCase().includes(categoryFilter.toLowerCase()));
      // }

      setAllTickets(fetchedTickets);
      setError(null);
    } catch (err) {
      console.error('Error al actualizar el panel de tickets', err);
      const message = err instanceof ApiError ? err.message : 'Ocurrió un error al actualizar el panel de tickets.';
      setError(message);
      setAllTickets([]);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, categoryFilter]);

  const fetchInitialData = useCallback(async () => { // useCallback para evitar que se re-cree en cada render
    if (!safeLocalStorage.getItem('authToken')) {
      setError('Sesión no válida. Por favor, inicie sesión de nuevo.');
      setIsLoading(false);
      return;
    }
    await fetchAndSetTickets();
  }, [fetchAndSetTickets]);


  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]); // Dependencia fetchInitialData (que tiene fetchAndSetTickets)

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && !selectedTicketId) {
        fetchAndSetTickets();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchAndSetTickets, selectedTicketId]);
  
  const filteredAndSortedTickets = useMemo(() => {
    let ticketsToDisplay = [...allTickets];
    if (searchTerm) {
      ticketsToDisplay = ticketsToDisplay.filter(ticket => 
        ticket.asunto.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.nro_ticket.toString().includes(searchTerm) ||
        (ticket.nombre_usuario && ticket.nombre_usuario.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (ticket.email_usuario && ticket.email_usuario.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    // Si statusFilter no fue manejado por el backend (porque usamos panel_por_categoria y luego aplanamos)
    // lo aplicaríamos aquí. Pero si panel_por_categoria ya lo hizo, no es necesario.
    // La implementación actual de fetchAndSetTickets ya usa statusFilter en la URL.

    return ticketsToDisplay.sort((a, b) => {
      const priorityA = ESTADOS_ORDEN_PRIORIDAD.indexOf(a.estado);
      const priorityB = ESTADOS_ORDEN_PRIORIDAD.indexOf(b.estado);
      if (priorityA !== priorityB) return priorityA - priorityB;
      return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
    });
  }, [allTickets, searchTerm]);


  const loadAndSetDetailedTicket = useCallback(async (ticketSummary: TicketSummary) => {
    if (!safeLocalStorage.getItem('authToken')) {
      setError("Error de autenticación.");
      return;
    }
    setSelectedTicketId(ticketSummary.id);
    setDetailedTicket(null); 
    setError(null);

    try {
      const data = await apiFetch<Ticket>(`/tickets/${ticketSummary.tipo}/${ticketSummary.id}`, {
        sendEntityToken: true,
      });
      setDetailedTicket(data);
    } catch (err) {
      const errorMessage = err instanceof ApiError ? err.message : `No se pudo cargar el detalle del ticket ${ticketSummary.nro_ticket}.`;
      setError(errorMessage); 
      setSelectedTicketId(null); 
    }
  }, []); 

  const handleTicketDetailUpdate = (updatedTicket: Ticket) => {
    setDetailedTicket(updatedTicket);
    setAllTickets(prevTickets => prevTickets.map(t => t.id === updatedTicket.id ? { ...t, ...updatedTicket } : t));
  };

  const closeDetailPanel = () => {
    setSelectedTicketId(null);
    setDetailedTicket(null);
  }

  if (isLoading && allTickets.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-muted/30 dark:bg-slate-900">
        <Loader2 className="animate-spin text-primary h-16 w-16" />
      </div>
    );
  }
  
  if (error && allTickets.length === 0 && !isLoading) {
    return <div className="p-8 text-center text-destructive bg-destructive/10 rounded-md h-screen flex flex-col justify-center items-center">
        <TicketIcon className="mx-auto h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Error al cargar tickets</h2>
        <p>{error}</p>
        <Button onClick={fetchInitialData} className="mt-4">Reintentar</Button>
      </div>;
  }

  return (
    <div className="flex flex-col h-screen bg-muted/30 dark:bg-slate-900 text-foreground overflow-hidden">
      <header className="p-4 border-b dark:border-slate-700 bg-card dark:bg-slate-800/50 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Panel de Tickets</h1>
            <p className="text-sm text-muted-foreground">Gestiona todos los reclamos y solicitudes.</p>
          </div>
          <div className="flex items-center gap-2">
            <Select
                value={locale}
                onValueChange={(val) => {
                const opt = LOCALE_OPTIONS.find((o) => o.locale === val);
                if (opt) updateSettings(opt.timezone, opt.locale);
                }}
            >
                <SelectTrigger className="w-[150px] text-xs h-9">
                <SelectValue placeholder="Idioma/Zona" />
                </SelectTrigger>
                <SelectContent>
                {LOCALE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.locale} value={opt.locale} className="text-xs">
                    {opt.label}
                    </SelectItem>
                ))}
                </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
            <div className="relative flex-grow">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Buscar por ID, asunto, usuario, email..."
                    className="pl-9 h-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as TicketStatus | "")}>
                <SelectTrigger className="w-auto min-w-[180px] h-9">
                    <div className="flex items-center gap-2">
                        <ListFilter className="h-4 w-4 text-muted-foreground"/>
                        <SelectValue placeholder="Filtrar por estado" />
                    </div>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="">Todos los estados</SelectItem>
                    {Object.entries(ESTADOS).map(([key, {label}]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Input 
                placeholder="Categoría..."
                className="w-[180px] h-9"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
            />
            <Button variant="outline" onClick={fetchAndSetTickets} className="h-9" disabled={isLoading && allTickets.length === 0}>
                {isLoading && allTickets.length === 0 ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4"/>}
                <span className="ml-2 hidden sm:inline">Actualizar</span>
            </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className={cn(
            "w-full md:w-2/5 lg:w-1/3 xl:w-1/4 border-r dark:border-slate-700 bg-card dark:bg-slate-800/50 flex flex-col",
            selectedTicketId && "hidden md:flex" 
        )}>
          <ScrollArea className="flex-1 p-3">
            {isLoading && allTickets.length > 0 && (
                 <div className="p-4 text-center text-sm text-muted-foreground flex items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin mr-2"/> Actualizando...
                 </div>
            )}
            {!isLoading && filteredAndSortedTickets.length === 0 ? (
              <div className="text-center py-10 px-4 h-full flex flex-col justify-center items-center">
                <TicketIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-base font-medium text-foreground">No hay tickets</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {searchTerm || statusFilter || categoryFilter ? "Ningún ticket coincide con tus filtros." : "Cuando se genere un nuevo reclamo, aparecerá aquí."}
                </p>
              </div>
            ) : (
              <AnimatePresence>
                {filteredAndSortedTickets.map(ticket => (
                  <TicketListItem
                    key={ticket.id}
                    ticket={ticket}
                    isSelected={selectedTicketId === ticket.id}
                    onSelect={() => loadAndSetDetailedTicket(ticket)}
                    timezone={timezone}
                    locale={locale}
                  />
                ))}
              </AnimatePresence>
            )}
          </ScrollArea>
        </div>

        <div className={cn(
            "flex-1 flex flex-col bg-muted/20 dark:bg-slate-900 overflow-y-auto",
             !selectedTicketId && "hidden md:flex md:items-center md:justify-center" 
        )}>
          {selectedTicketId && detailedTicket ? (
            <TicketDetail_Refactored 
                ticket={detailedTicket} 
                onTicketUpdate={handleTicketDetailUpdate}
                onClose={closeDetailPanel} 
            />
          ) : selectedTicketId && !detailedTicket && !error ? ( 
            <div className="flex items-center justify-center h-full">
              <Loader2 className="animate-spin text-primary h-10 w-10" />
            </div>
          ): error && selectedTicketId ? ( // Error específico al cargar detalle
            <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                <XCircle className="h-12 w-12 text-destructive mb-3"/>
                <h3 className="text-lg font-semibold text-destructive">Error al cargar detalle</h3>
                <p className="text-sm text-muted-foreground mb-3">{error}</p>
                <Button variant="outline" onClick={() => loadAndSetDetailedTicket(allTickets.find(t=>t.id === selectedTicketId)!)}>Reintentar</Button>
            </div>
          ) : ( 
            <div className="text-center p-8">
                <TicketIcon className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4" />
                <p className="text-lg text-muted-foreground">Selecciona un ticket para ver sus detalles.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const TicketTimeline: FC<{ ticket: Ticket; comentarios: Comment[] }> = ({ ticket, comentarios }) => {
  const { timezone, locale } = useDateSettings();
  const [verTodo, setVerTodo] = useState(false);

  const eventos = useMemo(() => [ 
    { fecha: ticket.fecha, descripcion: "Ticket creado", esAdmin: false }, 
    ...(comentarios || []).map((c) => ({
          fecha: c.fecha,
          descripcion: c.es_admin ? "Respuesta de Chatboc" : "Comentario de usuario", 
          esAdmin: c.es_admin,
        })),
  ].sort((a,b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()), [ticket.fecha, comentarios]);


  const MAX_EVENTOS_RESUMIDOS = 3;
  const eventosVisibles = verTodo ? eventos : eventos.slice(-MAX_EVENTOS_RESUMIDOS);

  if(eventos.length === 0 && ticket.fecha) { // Si solo está el evento de creación
    eventosVisibles.push({ fecha: ticket.fecha, descripcion: "Ticket creado", esAdmin: false });
  }
  if(eventosVisibles.length === 0) return null;


  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-base font-semibold">Historial de Actividad</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 text-xs">
        {eventosVisibles.length > 0 ? (
        <ol className="relative border-l border-border dark:border-slate-700 ml-1">
          {eventosVisibles.map((ev, i) => (
            <li key={i} className="mb-3 ml-4">
              <div className={cn(
                  "absolute w-3 h-3 rounded-full mt-1.5 -left-1.5 border border-white dark:border-slate-800",
                  ev.esAdmin ? "bg-primary" : "bg-muted-foreground/50"
              )} />
              <time className="text-xs font-normal leading-none text-muted-foreground/80">
                {formatDate(ev.fecha, timezone, locale)}
              </time>
              <p className="text-sm font-medium text-foreground whitespace-pre-wrap break-words">{ev.descripcion}</p>
            </li>
          ))}
        </ol>
        ) : (
          <p className="text-sm text-muted-foreground">No hay actividad registrada.</p>
        )}
        {eventos.length > MAX_EVENTOS_RESUMIDOS && (
          <Button
            variant="link"
            size="sm"
            className="mt-1 text-xs px-0 h-auto py-0"
            onClick={() => setVerTodo((v) => !v)}
          >
            {verTodo ? "Ver menos" : `Ver ${eventos.length - MAX_EVENTOS_RESUMIDOS} más...`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

const buildFullAddress = (ticket: Ticket) => {
  const direccion = ticket.direccion || "";
  if (
    ticket.tipo !== "pyme" &&
    ticket.municipio_nombre &&
    !direccion.toLowerCase().includes(ticket.municipio_nombre.toLowerCase())
  ) {
    return `${direccion ? `${direccion}, ` : ""}${ticket.municipio_nombre}`;
  }
  return direccion;
};

const TicketMap: FC<{ ticket: Ticket }> = ({ ticket }) => {
  const direccionCompleta = buildFullAddress(ticket);
  const hasCoords =
    typeof ticket.latitud === 'number' && typeof ticket.longitud === 'number';
  
  if (!ticket.direccion && !hasCoords) return null;

  const mapSrc = hasCoords
    ? `https://www.google.com/maps?q=${ticket.latitud},${ticket.longitud}&output=embed&z=15`
    : `https://www.google.com/maps?q=${encodeURIComponent(direccionCompleta)}&output=embed&z=15`;
  
  return (
    <Card className="shadow-sm">
        <CardHeader  className="pb-3 pt-4 px-4">
            <CardTitle className="text-base font-semibold">Ubicación</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
            <div className="w-full rounded-md overflow-hidden aspect-video border dark:border-slate-700">
                <iframe
                title="Ticket Location Map"
                width="100%"
                height="100%" 
                style={{ border: 0 }}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade" 
                src={mapSrc}
                />
            </div>
            {direccionCompleta && <div className="text-xs mt-2 text-muted-foreground truncate" title={direccionCompleta}>{direccionCompleta}</div>}
        </CardContent>
    </Card>
  );
};

const CATEGORIAS_CHAT_EN_VIVO = [ 
  "atención en vivo",
  "chat en vivo",
  "soporte urgente"
];

const TicketDetail_Refactored: FC<TicketDetailViewProps> = ({ ticket, onTicketUpdate, onClose }) => {
  const { timezone, locale } = useDateSettings();
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [comentarios, setComentarios] = useState<Comment[]>(ticket.comentarios || []);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const ultimoMensajeIdRef = useRef<number>(0);

  const token = safeLocalStorage.getItem('authToken');
  const isAnonimo = !token; 

  const chatEnVivo = useMemo(() => {
    const categoriaNormalizada = (ticket.asunto || ticket.categoria || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return CATEGORIAS_CHAT_EN_VIVO.some(cat => categoriaNormalizada.includes(cat.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""))) && 
           ["esperando_agente_en_vivo", "en_proceso"].includes(ticket.estado);
  }, [ticket.asunto, ticket.categoria, ticket.estado]);

  const fetchComentarios = useCallback(async (forceTicketRefresh = false) => {
    if (isAnonimo) return; 
    try {
      const data = await apiFetch<{mensajes: any[]}>(`/tickets/chat/${ticket.id}/mensajes?ultimo_mensaje_id=${ultimoMensajeIdRef.current}`, {
        sendEntityToken: true, 
      });
      if (data.mensajes && data.mensajes.length > 0) {
        setComentarios((prev) => {
          const idsPrev = new Set(prev.map((m) => m.id));
          const nuevos = data.mensajes.filter((m: any) => !idsPrev.has(m.id));
          if (nuevos.length > 0) {
            ultimoMensajeIdRef.current = nuevos[nuevos.length - 1].id;
            return [
              ...prev,
              ...nuevos.map((msg: any) => ({
                id: msg.id,
                comentario: msg.texto,
                fecha: msg.fecha,
                es_admin: msg.es_admin,
              })),
            ].sort((a,b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()); // Asegurar orden
          }
          return prev;
        });
      }
    } catch (e) {
      console.error("Error en polling de comentarios:", e);
    }
    if (forceTicketRefresh || chatEnVivo) { 
        try {
            const updatedTicketData = await apiFetch<Ticket>(`/tickets/${ticket.tipo}/${ticket.id}`, { sendEntityToken: true });
            // Mantener los comentarios actuales si el ticket refrescado no los trae o trae una lista parcial
            const currentComentarios = comentarios;
            onTicketUpdate({ ...ticket, ...updatedTicketData, comentarios: updatedTicketData.comentarios || currentComentarios });
        } catch (e) {
            console.error("Error al refrescar ticket:", e);
        }
    }
  }, [ticket.id, ticket.tipo, onTicketUpdate, isAnonimo, chatEnVivo, comentarios]); 

  useEffect(() => {
    // Cuando el ticket cambia, reseteamos los comentarios y el último ID.
    const initialComments = ticket.comentarios ? [...ticket.comentarios].sort((a,b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()) : [];
    setComentarios(initialComments);
    ultimoMensajeIdRef.current = initialComments.length > 0 ? initialComments[initialComments.length - 1].id : 0;
  
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (!chatEnVivo) return;
  
    fetchComentarios(true); // Carga inicial y refresco del ticket
    pollingRef.current = setInterval(() => fetchComentarios(true), 10000); 
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [ticket.id, ticket.comentarios, chatEnVivo, fetchComentarios]); // ticket.comentarios como dep para resetear si cambia externamente
  

  useEffect(() => { 
    const container = chatBottomRef.current?.parentElement;
    if (container && chatBottomRef.current) {
        const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150; 
        if (atBottom) {
             setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }
    }
  }, [comentarios.length]); 

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending || isAnonimo) return;
    setIsSending(true);
    const tempId = Date.now(); 
    const optimisticComment: Comment = {
        id: tempId,
        comentario: newMessage,
        fecha: new Date().toISOString(),
        es_admin: true,
    };
    setComentarios(prev => [...prev, optimisticComment].sort((a,b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()));
    const currentMessage = newMessage;
    setNewMessage("");

    try {
      const updatedTicket = await apiFetch<Ticket>(`/tickets/${ticket.tipo}/${ticket.id}/responder`, {
        method: "POST",
        body: { comentario: currentMessage },
        sendEntityToken: true,
      });
      const serverComentarios = updatedTicket.comentarios ? [...updatedTicket.comentarios].sort((a,b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()) : [];
      setComentarios(serverComentarios); 
      if (serverComentarios.length > 0) {
        ultimoMensajeIdRef.current = serverComentarios[serverComentarios.length -1].id;
      }
      onTicketUpdate({ ...ticket, ...updatedTicket, comentarios: serverComentarios });
    } catch (error) {
      console.error("Error al enviar comentario", error);
      setComentarios(prev => prev.filter(c => c.id !== tempId)); 
      setNewMessage(currentMessage); 
      // TODO: Mostrar error al usuario con un toast
    } finally {
      setIsSending(false);
    }
  };

  const handleEstadoChange = async (nuevoEstado: TicketStatus) => {
    if (isAnonimo) return;
    const originalState = ticket.estado;
    onTicketUpdate({ ...ticket, estado: nuevoEstado }); 
    try {
      const updatedTicketData = await apiFetch<Ticket>(
        `/tickets/${ticket.tipo}/${ticket.id}/estado`,
        { method: "PUT", body: { estado: nuevoEstado }, sendEntityToken: true }
      );
      const serverComentarios = updatedTicketData.comentarios ? [...updatedTicketData.comentarios].sort((a,b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()) : comentarios;
      const mergedTicket = { ...ticket, ...updatedTicketData, comentarios: serverComentarios};
      onTicketUpdate(mergedTicket);
    } catch (error) {
      console.error("Error al cambiar estado", error);
      onTicketUpdate({ ...ticket, estado: originalState, comentarios: comentarios }); 
      // TODO: Mostrar error al usuario
    }
  };
  
  return (
    <div className="flex flex-col h-full">
        <div className="p-4 border-b dark:border-slate-700 bg-card dark:bg-slate-800/50 shadow-sm">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 sm:gap-3">
                    <Button variant="ghost" size="icon" className="md:hidden mr-1" onClick={onClose}>
                        <ChevronDown className="h-5 w-5 transform rotate-90"/> 
                    </Button>
                    <h2 className="text-lg font-semibold text-foreground truncate max-w-[calc(100vw-200px)] sm:max-w-md md:max-w-lg" title={ticket.asunto}>
                        #{ticket.nro_ticket} - {ticket.asunto}
                    </h2>
                </div>
                <div className="flex items-center gap-2">
                    <Select onValueChange={(val) => handleEstadoChange(val as TicketStatus)} value={ticket.estado}>
                        <SelectTrigger className="w-auto min-w-[140px] h-9 text-sm">
                             <SelectValue placeholder="Cambiar estado..." />
                        </SelectTrigger>
                        <SelectContent>
                        {Object.entries(ESTADOS).map(([key, { label }]) => (
                            <SelectItem key={key} value={key} className="text-sm">{label}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                     <Button variant="ghost" size="icon" className="hidden md:inline-flex" onClick={onClose} title="Cerrar panel de detalle">
                        <X className="h-5 w-5" />
                    </Button>
                </div>
            </div>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            <div className="flex-1 flex flex-col p-2 md:p-4 bg-background dark:bg-slate-700/30 md:border-r dark:border-slate-700">
                {!chatEnVivo && (
                    <div className="p-2 flex justify-end">
                        <Button size="sm" variant="outline" onClick={() => fetchComentarios(true)} className="text-xs h-8">
                        Actualizar mensajes
                        </Button>
                    </div>
                )}
                <ScrollArea className="flex-1 pr-2">
                    <main className="space-y-3 p-1">
                    {comentarios && comentarios.length > 0 ? (
                        comentarios.map((comment) => {
                        const attachment = getAttachmentInfo(comment.comentario);
                        return (
                            <div
                            key={comment.id}
                            className={cn(
                                'flex items-end gap-2 text-sm',
                                comment.es_admin ? 'justify-end' : 'justify-start'
                            )}
                            >
                            {!comment.es_admin && <AvatarIcon type="user" />}
                            <div
                                className={cn(
                                'max-w-lg md:max-w-md lg:max-w-lg rounded-xl px-3.5 py-2.5 shadow-sm', 
                                comment.es_admin
                                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                                    : 'bg-card dark:bg-slate-800 text-foreground border dark:border-slate-700/80 rounded-bl-sm'
                                )}
                            >
                                {attachment ? (
                                <AttachmentPreview attachment={attachment} />
                                ) : (
                                <p className="break-words whitespace-pre-wrap">{comment.comentario}</p>
                                )}
                                <p className={cn(
                                    "text-xs opacity-70 mt-1.5",
                                    comment.es_admin ? "text-primary-foreground/80 text-right" : "text-muted-foreground text-right"
                                    )}>
                                {formatDate(comment.fecha, timezone, locale)}
                                </p>
                            </div>
                            {comment.es_admin && <AvatarIcon type="admin" />}
                            </div>
                        );
                        })
                    ) : (
                        <div className="text-center text-muted-foreground py-10">
                        No hay comentarios para este ticket.
                        </div>
                    )}
                    <div ref={chatBottomRef} />
                    </main>
                </ScrollArea>
                <footer className="border-t dark:border-slate-700/80 p-2 md:p-3 mt-2 flex gap-2 items-center">
                    <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && newMessage.trim()) {
                            e.preventDefault(); // Evitar nueva línea en algunos browsers
                            handleSendMessage();
                        }
                    }}
                    placeholder="Escribe una respuesta..."
                    disabled={isSending}
                    className="h-10 bg-card dark:bg-slate-800 focus-visible:ring-primary/50"
                    />
                    <Button onClick={handleSendMessage} disabled={isSending || !newMessage.trim()} aria-label="Enviar Mensaje" className="h-10">
                    {isSending ? <Loader2 className="animate-spin h-5 w-5" /> : <Send className="h-5 w-5" />}
                    </Button>
                </footer>
            </div>

            <ScrollArea className="w-full md:w-[320px] lg:w-[360px] p-3 md:p-4 space-y-4 bg-card dark:bg-slate-800/50 md:border-l-0 border-t md:border-t-0 dark:border-slate-700">
                {(ticket.nombre_usuario || ticket.email_usuario || ticket.telefono) && (
                <Card className="shadow-sm">
                    <CardHeader className="pb-3 pt-4 px-4">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground"/> Información del Usuario
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground space-y-1.5 px-4 pb-4">
                    {ticket.nombre_usuario && <p><strong>Nombre:</strong> {ticket.nombre_usuario}</p>}
                    {ticket.email_usuario && <p><strong>Email:</strong> <a href={`mailto:${ticket.email_usuario}`} className="text-primary hover:underline">{ticket.email_usuario}</a></p>}
                    {ticket.telefono && <p><strong>Teléfono:</strong> <a href={`tel:${ticket.telefono}`} className="text-primary hover:underline">{ticket.telefono}</a></p>}
                    </CardContent>
                </Card>
                )}
                
                <TicketTimeline ticket={ticket} comentarios={comentarios} />
                <TicketMap ticket={ticket} />

                {ticket.archivo_url && (
                <Card className="shadow-sm">
                    <CardHeader className="pb-3 pt-4 px-4"><CardTitle className="text-base font-semibold">Archivo Adjunto</CardTitle></CardHeader>
                    <CardContent className="px-4 pb-4">
                    <Button asChild variant="outline" size="sm">
                        <a href={ticket.archivo_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                            <File className="h-4 w-4"/> Descargar Archivo
                        </a>
                    </Button>
                    </CardContent>
                </Card>
                )}

                <Card className="shadow-sm">
                     <CardHeader className="pb-3 pt-4 px-4"><CardTitle className="text-base font-semibold">Detalles Adicionales</CardTitle></CardHeader>
                     <CardContent className="text-sm text-muted-foreground space-y-1.5 px-4 pb-4">
                        <p><strong>Categoría:</strong> {ticket.categoria || "No especificada"}</p>
                        <p><strong>Tipo:</strong> {ticket.tipo}</p>
                        {ticket.municipio_nombre && <p><strong>Municipio:</strong> {ticket.municipio_nombre}</p>}
                        <p><strong>Creado:</strong> {formatDate(ticket.fecha, timezone, locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                     </CardContent>
                </Card>
            </ScrollArea>
        </div>
    </div>
  );
};

const AvatarIcon: FC<{ type: 'user' | 'admin' }> = ({ type }) => (
  <div className={cn(
      'h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold border-2 shadow-sm', 
      type === 'admin' 
        ? 'bg-primary/10 text-primary border-primary/30' 
        : 'bg-muted text-muted-foreground border-border'
    )}>
    {type === 'admin' ? <ShieldCheck className="h-4 w-4" /> : <User className="h-4 w-4" />}
  </div>
);

// Added XCircle for error display
import { XCircle } from "lucide-react";
