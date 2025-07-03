import React, { useEffect, useState, useCallback, FC, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Ticket as TicketIcon, ChevronDown, ChevronUp, User, ShieldCheck, X, Search, Filter, ListFilter, File, ArrowLeft, XCircle, BellRing, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"; // Import Radix ScrollArea
import { apiFetch, ApiError } from "@/utils/api";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
// import getOrCreateAnonId from "@/utils/anonId"; // No se usa en admin panel
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useDebounce } from '@/hooks/useDebounce';
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
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
// ----------- TIPOS Y ESTADOS -----------
// ... ACÁ VA TODO TU CÓDIGO IGUAL QUE LO TENÍAS ...

// (El resto del archivo es exactamente como lo pegaste)



// ----------- TIPOS Y ESTADOS -----------
type TicketStatus = "nuevo" | "en_proceso" | "derivado" | "resuelto" | "cerrado" | "esperando_agente_en_vivo";
type SlaStatus = "on_track" | "nearing_sla" | "breached" | null;
type PriorityStatus = "low" | "medium" | "high" | null;

interface Comment { id: number; comentario: string; fecha: string; es_admin: boolean; }
interface Ticket {
  id: number; tipo: 'pyme' | 'municipio'; nro_ticket: number; asunto: string; estado: TicketStatus; fecha: string;
  detalles?: string; comentarios?: Comment[]; nombre_usuario?: string; email_usuario?: string; telefono?: string; direccion?: string; archivo_url?: string; categoria?: string;
  municipio_nombre?: string;
  latitud?: number | null;
  longitud?: number | null;
  sla_status?: SlaStatus; // Nuevo campo
  priority?: PriorityStatus; // Nuevo campo
  sla_deadline?: string; // Nuevo campo opcional
}
interface TicketSummary extends Omit<Ticket, 'detalles' | 'comentarios'> {
  direccion?: string;
  latitud?: number | null;
  longitud?: number | null;
  sla_status?: SlaStatus; // Nuevo campo
  priority?: PriorityStatus; // Nuevo campo
}
// type CategorizedTickets = { [category: string]: TicketSummary[]; }; // Ahora sí lo vamos a usar o algo similar
interface GroupedTickets {
  categoryName: string;
  tickets: TicketSummary[];
}

const ESTADOS_ORDEN_PRIORIDAD: TicketStatus[] = ["nuevo", "en_proceso", "esperando_agente_en_vivo", "derivado", "resuelto", "cerrado"];
const ESTADOS: Record<TicketStatus, { label: string; tailwind_class: string, icon?: React.ElementType }> = {
  nuevo: { label: "Nuevo", tailwind_class: "bg-blue-500 hover:bg-blue-600 text-white border-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600", icon: TicketIcon },
  en_proceso: { label: "En Proceso", tailwind_class: "bg-yellow-500 hover:bg-yellow-600 text-black border-yellow-700 dark:bg-yellow-400 dark:hover:bg-yellow-500", icon: Loader2 },
  derivado: { label: "Derivado", tailwind_class: "bg-purple-500 hover:bg-purple-600 text-white border-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600" },
  resuelto: { label: "Resuelto", tailwind_class: "bg-green-500 hover:bg-green-600 text-white border-green-700 dark:bg-green-500 dark:hover:bg-green-600" },
  cerrado: { label: "Cerrado", tailwind_class: "bg-gray-500 hover:bg-gray-600 text-white border-gray-700 dark:bg-gray-600 dark:hover:bg-gray-700" },
  esperando_agente_en_vivo: { label: "Esperando agente", tailwind_class: "bg-red-500 hover:bg-red-600 text-white border-red-700 dark:bg-red-500 dark:hover:bg-red-600" }
};

const SLA_STATUS_INFO: Record<NonNullable<SlaStatus>, { label: string; color: string; icon?: React.ElementType }> = {
  on_track: { label: "En tiempo", color: "text-green-600 dark:text-green-400" },
  nearing_sla: { label: "Próximo a vencer", color: "text-yellow-600 dark:text-yellow-400" },
  breached: { label: "Vencido", color: "text-red-600 dark:text-red-400" },
};

const PRIORITY_INFO: Record<NonNullable<PriorityStatus>, { label: string; color: string; badgeClass?: string }> = {
  low: { label: "Baja", color: "text-gray-500 dark:text-gray-400", badgeClass: "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-500" },
  medium: { label: "Media", color: "text-blue-500 dark:text-blue-400", badgeClass: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-700 dark:text-blue-200 dark:border-blue-500" },
  high: { label: "Alta", color: "text-red-500 dark:text-red-400", badgeClass: "bg-red-100 text-red-700 border-red-300 dark:bg-red-700 dark:text-red-200 dark:border-red-500" },
};


// ----------- NUEVOS COMPONENTES -----------

const TicketListItem: FC<{
  ticket: TicketSummary;
  isSelected: boolean;
  onSelect: () => void;
  timezone: string;
  locale: string;
}> = ({ ticket, isSelected, onSelect, timezone, locale }) => {
  const slaInfo = ticket.sla_status ? SLA_STATUS_INFO[ticket.sla_status] : null;
  const priorityInfo = ticket.priority ? PRIORITY_INFO[ticket.priority] : null;

  let cardClasses = "bg-card dark:bg-slate-800 border-border dark:border-slate-700/80 hover:border-slate-400 dark:hover:border-slate-500";
  if (isSelected) {
    cardClasses = "bg-primary/10 border-primary dark:bg-primary/20 dark:border-primary ring-1 ring-primary";
  } else if (ticket.sla_status === 'breached') {
    cardClasses = "bg-red-500/10 border-red-500/30 dark:bg-red-700/20 dark:border-red-600/40 hover:border-red-500";
  } else if (ticket.sla_status === 'nearing_sla') {
    cardClasses = "bg-yellow-500/10 border-yellow-500/30 dark:bg-yellow-700/20 dark:border-yellow-600/40 hover:border-yellow-500";
  }

  return (
    <motion.div
      layout
      onClick={onSelect}
      className={cn(
        "p-3 rounded-lg border cursor-pointer mb-2 transition-all duration-200 ease-in-out",
        "hover:shadow-md dark:hover:bg-slate-700/60",
        cardClasses
      )}
      whileHover={{ y: -2 }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
    >
      <div className="flex justify-between items-start mb-1">
        <span className="font-semibold text-primary text-sm truncate max-w-[100px] flex-shrink-0" title={`#${ticket.nro_ticket}`}>#{ticket.nro_ticket}</span>
        <div className="flex flex-col items-end gap-1">
          <Badge className={cn("text-xs border", ESTADOS[ticket.estado]?.tailwind_class)}>{ESTADOS[ticket.estado]?.label}</Badge>
          {priorityInfo && (
            <Badge variant="outline" className={cn("text-xs border", priorityInfo.badgeClass)}>
              Prioridad: {priorityInfo.label}
            </Badge>
          )}
        </div>
      </div>
      <p className="font-medium text-foreground truncate text-sm" title={ticket.asunto}>{ticket.asunto}</p>
      {ticket.nombre_usuario && <p className="text-xs text-muted-foreground truncate mt-0.5" title={ticket.nombre_usuario}>{ticket.nombre_usuario}</p>}

      <div className="flex justify-between items-center mt-1.5">
        {slaInfo && (
            <span className={cn("text-xs font-medium", slaInfo.color)}>
                SLA: {slaInfo.label}
            </span>
        )}
        {!slaInfo && <div />} {/* Placeholder to keep date to the right */}
        <p className="text-xs text-muted-foreground">{formatDate(ticket.fecha, timezone, locale)}</p>
      </div>
    </motion.div>
  );
};

interface TicketDetailViewProps {
  ticket: Ticket; // Ahora Ticket puede incluir sla_status y priority
  onTicketUpdate: (updatedTicket: Ticket) => void;
  onClose: () => void;
}


// ----------- MAIN PANEL (Refactorizado) -----------
export default function TicketsPanel() {
  useRequireRole(['admin', 'empleado'] as Role[]);
  const navigate = useNavigate();
  const { timezone, locale, updateSettings } = useDateSettings();
  const [groupedTickets, setGroupedTickets] = useState<GroupedTickets[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [detailedTicket, setDetailedTicket] = useState<Ticket | null>(null); // Ahora Ticket puede incluir sla_status y priority
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTermInput, setSearchTermInput] = useState("");
  const debouncedSearchTerm = useDebounce(searchTermInput, 300);
  const [searchTerm, setSearchTerm] = useState(""); // Este será el término debounced
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "">("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});

  useEffect(() => {
    setSearchTerm(debouncedSearchTerm);
  }, [debouncedSearchTerm]);

  const fetchAndSetTickets = useCallback(async (isManualRefresh = false) => {
    if (!safeLocalStorage.getItem('authToken')) return;

    if (groupedTickets.length === 0 || isManualRefresh) {
      setIsLoading(true);
    }

    try {
      let url = '/tickets/panel_por_categoria';
      const params: string[] = [];
      if (statusFilter) params.push(`estado=${encodeURIComponent(statusFilter)}`);
      if (categoryFilter) params.push(`categoria=${encodeURIComponent(categoryFilter)}`);
      if (params.length) url += `?${params.join('&')}`;

      // El backend debe devolver TicketSummary[] que incluya sla_status y priority
      const data = await apiFetch<any>(url, { sendEntityToken: true });

      // Normalizar para admitir diferentes formatos (objeto o array de grupos)
      let normalized: { [category: string]: TicketSummary[] } = {};

      if (Array.isArray(data)) {
        data.forEach((group: any) => {
          const key =
            group.category || group.categoryName || group.categoria || "";
          if (key !== undefined && Array.isArray(group.tickets)) {
            normalized[key] = group.tickets as TicketSummary[];
          }
        });
      } else if (typeof data === "object" && data !== null) {
        normalized = data as { [category: string]: TicketSummary[] };
      } else {
        console.error(
          "API response for tickets has unexpected format:",
          data
        );
        setError("La respuesta del servidor para los tickets no es válida.");
        setGroupedTickets([]);
        setIsLoading(false);
        return;
      }

      const processedGroups: GroupedTickets[] = Object.entries(normalized).map(([categoryName, tickets]) => ({
        categoryName:
          categoryName === 'null' || categoryName === ''
            ? 'Sin Categoría'
            : categoryNames[categoryName] || categoryName,
        tickets: Array.isArray(tickets)
          ? tickets.map(ticket => ({
              ...ticket,
              sla_status: ticket.sla_status || null,
              priority: ticket.priority || null,
            }))
          : [],
      }));

      processedGroups.sort((a, b) => {
        if (a.categoryName === 'Sin Categoría') return 1;
        if (b.categoryName === 'Sin Categoría') return -1;
        return a.categoryName.localeCompare(b.categoryName);
      });

      setGroupedTickets(processedGroups);

      const categoriesFromCurrentResponse = Object.keys(normalized).map(cat =>
        cat === 'null' || cat === '' ? 'Sin Categoría' : cat
      );
      setAvailableCategories(prev => {
        const newCategories = Array.from(new Set([...prev, ...categoriesFromCurrentResponse]));
        return newCategories.sort((a,b) => {
          if (a === 'Sin Categoría') return 1;
          if (b === 'Sin Categoría') return -1;
          return a.localeCompare(b);
        });
      });

      setError(null);
    } catch (err) {
      console.error('Error al actualizar el panel de tickets', err);
      const message = err instanceof ApiError ? err.message : 'Ocurrió un error al actualizar el panel de tickets.';
      setError(message);
      setGroupedTickets([]);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, categoryFilter, groupedTickets.length]); // groupedTickets.length para el manejo de isLoading

  const fetchInitialData = useCallback(async () => {
    if (!safeLocalStorage.getItem('authToken')) {
      setError('Sesión no válida. Por favor, inicie sesión de nuevo.');
      setIsLoading(false);
      return;
    }
    await fetchAndSetTickets(true);
  }, [fetchAndSetTickets]);

  useEffect(() => {
    apiFetch<{ id: number; nombre: string }[]>('/municipal/categorias', { sendEntityToken: true })
      .then((data) => {
        const mapping: Record<string, string> = {};
        data.forEach((c) => {
          mapping[String(c.id)] = c.nombre;
        });
        setCategoryNames(mapping);
      })
      .catch(() => {
        setCategoryNames({});
      });
  }, []);


  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && !selectedTicketId) {
        fetchAndSetTickets(false);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchAndSetTickets, selectedTicketId]);

  const filteredAndSortedGroups = useMemo(() => {
    return groupedTickets.map(group => {
      let filteredTickets = group.tickets;

      if (searchTerm) {
        filteredTickets = filteredTickets.filter(ticket =>
          ticket.id.toString().includes(searchTerm) ||
          ticket.nro_ticket.toString().includes(searchTerm) ||
          ticket.asunto.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (ticket.nombre_usuario && ticket.nombre_usuario.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (ticket.email_usuario && ticket.email_usuario.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (ticket.categoria && ticket.categoria.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (ticket.direccion && ticket.direccion.toLowerCase().includes(searchTerm.toLowerCase()))
        );
      }

      // Ordenar tickets: primero por prioridad (Alta > Media > Baja > null),
      // luego por estado de SLA (Vencido > Próximo a Vencer > En Tiempo > null),
      // luego por estado del ticket, y finalmente por fecha.
      const sortedTickets = filteredTickets.sort((a, b) => {
        const priorityOrder: Record<PriorityStatus | 'null_priority', number> = { high: 0, medium: 1, low: 2, null_priority: 3 };
        const slaOrder: Record<SlaStatus | 'null_sla', number> = { breached: 0, nearing_sla: 1, on_track: 2, null_sla: 3 };

        const priorityAVal = a.priority || 'null_priority';
        const priorityBVal = b.priority || 'null_priority';
        if (priorityOrder[priorityAVal] !== priorityOrder[priorityBVal]) {
          return priorityOrder[priorityAVal] - priorityOrder[priorityBVal];
        }

        const slaAVal = a.sla_status || 'null_sla';
        const slaBVal = b.sla_status || 'null_sla';
        if (slaOrder[slaAVal] !== slaOrder[slaBVal]) {
          return slaOrder[slaAVal] - slaOrder[slaBVal];
        }

        const estadoPriorityA = ESTADOS_ORDEN_PRIORIDAD.indexOf(a.estado);
        const estadoPriorityB = ESTADOS_ORDEN_PRIORIDAD.indexOf(b.estado);
        if (estadoPriorityA !== estadoPriorityB) return estadoPriorityA - estadoPriorityB;

        return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
      });

      return { ...group, tickets: sortedTickets };
    }).filter(group => group.tickets.length > 0);
  }, [groupedTickets, searchTerm, statusFilter]);


  const loadAndSetDetailedTicket = useCallback(async (ticketSummary: TicketSummary) => {
    if (!safeLocalStorage.getItem('authToken')) {
      setError("Error de autenticación.");
      return;
    }
    setSelectedTicketId(ticketSummary.id);
    setDetailedTicket(null); 
    setError(null);

    try {
      const apiOptions = { sendEntityToken: true };
      // El backend debe devolver el objeto Ticket completo incluyendo sla_status, priority, sla_deadline
      const data = await apiFetch<Ticket>(`/tickets/${ticketSummary.tipo}/${ticketSummary.id}`, apiOptions);
      setDetailedTicket(data);
    } catch (err) {
      const errorMessage = err instanceof ApiError ? err.message : `No se pudo cargar el detalle del ticket ${ticketSummary.nro_ticket}.`;
      setError(errorMessage); 
      setSelectedTicketId(null); 
    }
  }, []);

  const handleTicketDetailUpdate = (updatedTicket: Ticket) => {
    setDetailedTicket(updatedTicket);
    // Actualizar el ticket en la lista principal (groupedTickets)
    setGroupedTickets(prevGroups => {
      return prevGroups.map(group => ({
        ...group,
        tickets: group.tickets.map(t =>
          t.id === updatedTicket.id
          ? { ...t, ...updatedTicket, sla_status: updatedTicket.sla_status || null, priority: updatedTicket.priority || null } // asegurar que los nuevos campos estén
          : t
        )
      }));
    });
  };

  const closeDetailPanel = () => {
    setSelectedTicketId(null);
    setDetailedTicket(null);
  }

  if (isLoading && groupedTickets.length === 0) { // Cambiado de allTickets a groupedTickets
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/30 dark:bg-slate-900">
        <Loader2 className="animate-spin text-primary h-16 w-16" />
      </div>
    );
  }

  if (error && groupedTickets.length === 0 && !isLoading) { // Cambiado de allTickets a groupedTickets
    return <div className="p-8 text-center text-destructive bg-destructive/10 rounded-md min-h-screen flex flex-col justify-center items-center">
        <TicketIcon className="mx-auto h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Error al cargar tickets</h2>
        <p>{error}</p>
        <Button onClick={fetchInitialData} className="mt-4">Reintentar</Button>
      </div>;
  }

return (
  <div className="flex flex-col min-h-screen bg-muted/30 dark:bg-slate-900 text-foreground pb-10">
    <header className="p-4 border-b dark:border-slate-700 bg-card dark:bg-slate-800/50 shadow-sm">
      {/* ... header igual que antes ... */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)} title="Volver a la página anterior">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Panel de Tickets</h1>
            <p className="text-sm text-muted-foreground">Gestiona todos los reclamos y solicitudes.</p>
          </div>
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
            placeholder="Buscar por ID, Nro, asunto, usuario, email, categoría, dirección..."
            className="pl-9 h-9"
            value={searchTermInput}
            onChange={(e) => setSearchTermInput(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as TicketStatus | "")}>
          <SelectTrigger className="w-auto min-w-[180px] h-9">
            <div className="flex items-center gap-2">
              <ListFilter className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Filtrar por estado" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos los estados</SelectItem>
            {Object.entries(ESTADOS).map(([key, { label }]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value === "ALL_CATEGORIES" ? "" : value)}>
          <SelectTrigger className="w-auto min-w-[180px] h-9">
            <div className="flex items-center gap-2">
              <ListFilter className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Filtrar por categoría" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL_CATEGORIES">Todas las categorías</SelectItem>
            {availableCategories.map((category) => (
              <SelectItem key={category} value={category}>
                {category === 'Sin Categoría' ? 'Sin Categoría' : categoryNames[category] || category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => fetchAndSetTickets(true)} className="h-9" disabled={isLoading && groupedTickets.length === 0}>
          {(isLoading && groupedTickets.length === 0)
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Filter className="h-4 w-4" />}
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
          {isLoading && groupedTickets.length === 0 && !error ? (
            <div className="p-4 text-center text-sm text-muted-foreground flex items-center justify-center h-full">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando tickets...
            </div>
          ) : isLoading && groupedTickets.length > 0 ? (
            <div className="p-2 text-center text-xs text-muted-foreground flex items-center justify-center">
              <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> Actualizando lista...
            </div>
          ) : !isLoading && filteredAndSortedGroups.length === 0 && !error ? (
            <div className="text-center py-10 px-4 h-full flex flex-col justify-center items-center">
              <TicketIcon className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-base font-medium text-foreground">No hay tickets</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchTerm || statusFilter || categoryFilter
                  ? "Ningún ticket coincide con tus filtros."
                  : "Cuando se genere un nuevo reclamo, aparecerá aquí."}
              </p>
            </div>
          ) : filteredAndSortedGroups.length > 0 ? (
            <Accordion type="multiple" className="space-y-2">
              {filteredAndSortedGroups.map(group => (
                <AccordionItem key={group.categoryName} value={String(group.categoryName)}>
                  <AccordionTrigger className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1 py-2">
                    {group.categoryName} ({group.tickets.length})
                  </AccordionTrigger>
                  <AccordionContent className="space-y-2">
                    {group.tickets.map(ticket => (
                      <TicketListItem
                        key={ticket.id}
                        ticket={ticket}
                        isSelected={selectedTicketId === ticket.id}
                        onSelect={() => loadAndSetDetailedTicket(ticket)}
                        timezone={timezone}
                        locale={locale}
                      />
                    ))}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : null}
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
              <Button variant="outline" onClick={() => {
                const ticketToReload = groupedTickets.flatMap(g => g.tickets).find(t => t.id === selectedTicketId);
                if (ticketToReload) loadAndSetDetailedTicket(ticketToReload);
              }}>Reintentar</Button>
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
  const chatBottomRef = useRef<HTMLDivElement>(null); // Still useful for knowing when new content is added visually
  const scrollAreaRef = useRef<React.ElementRef<typeof ScrollAreaPrimitive.Root>>(null);
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
    const rootElement = scrollAreaRef.current;
    if (!rootElement) return;

    const viewportElement = rootElement.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;

    if (viewportElement && chatBottomRef.current) { // chatBottomRef helps confirm content is there
        const { scrollTop, scrollHeight, clientHeight } = viewportElement;

        // AUTO_SCROLL_THRESHOLD: Only scroll if user is within this many pixels from the bottom.
        // This prevents snapping the view if the user has scrolled up significantly.
        const AUTO_SCROLL_THRESHOLD = 250; // Increased threshold
        const isNearBottom = scrollHeight - scrollTop - clientHeight < AUTO_SCROLL_THRESHOLD;

        if (isNearBottom) {
            setTimeout(() => {
                viewportElement.scrollTo({ top: viewportElement.scrollHeight, behavior: 'smooth' });
            }, 100); // Keep timeout to allow DOM update and rendering
        }
    }
  }, [comentarios.length]); // Only trigger on new comments

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
                <ScrollArea ref={scrollAreaRef} className="flex-1 pr-2">
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
                {/* Sección de Prioridad y SLA en Detalles del Ticket */}
                {(ticket.priority || ticket.sla_status) && (
                  <Card className="shadow-sm">
                    <CardHeader className="pb-3 pt-4 px-4">
                      <CardTitle className="text-base font-semibold">Prioridad y SLA</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground space-y-1.5 px-4 pb-4">
                      {ticket.priority && PRIORITY_INFO[ticket.priority] && (
                        <p><strong>Prioridad:</strong> <span className={cn(PRIORITY_INFO[ticket.priority]?.color)}>{PRIORITY_INFO[ticket.priority]?.label}</span></p>
                      )}
                      {ticket.sla_status && SLA_STATUS_INFO[ticket.sla_status] && (
                        <p><strong>SLA:</strong> <span className={cn(SLA_STATUS_INFO[ticket.sla_status]?.color)}>{SLA_STATUS_INFO[ticket.sla_status]?.label}</span></p>
                      )}
                      {ticket.sla_deadline && (
                        <p><strong>Vencimiento SLA:</strong> {formatDate(ticket.sla_deadline, timezone, locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                      )}
                    </CardContent>
                  </Card>
                )}

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
        ? 'bg-primary/10 text-primary border-primary/30' // Ensure these classes match your theme for admin
        : 'bg-muted text-muted-foreground border-border' // Ensure these classes match your theme for user
    )}>
    {type === 'admin' ? <ShieldCheck className="h-4 w-4" /> : <User className="h-4 w-4" />}
  </div>
);
