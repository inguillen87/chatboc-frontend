import React, { useEffect, useState, useCallback, FC, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Ticket as TicketIcon, ChevronDown, ChevronUp, User, ShieldCheck, X, Search, Filter, ListFilter, File, ArrowLeft, XCircle, BellRing, AlertTriangle, Paperclip, Sparkles, MessageSquare } from "lucide-react"; // Added Paperclip, Sparkles, MessageSquare
import { motion, AnimatePresence } from "framer-motion";
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
import { getAttachmentInfo, deriveAttachmentInfo, AttachmentInfo } from "@/utils/attachment"; // Added deriveAttachmentInfo & AttachmentInfo
import { formatDate } from "@/utils/fecha";
import { useDateSettings } from "@/hooks/useDateSettings";
import { LOCALE_OPTIONS } from "@/utils/localeOptions";
import useRequireRole from "@/hooks/useRequireRole";
import type { Role } from "@/utils/roles";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { useUser } from '@/hooks/useUser'; // Ensured this is present
import TemplateSelector, { MessageTemplate } from "@/components/tickets/TemplateSelector"; // Import TemplateSelector
import { formatPhoneNumberForWhatsApp } from "@/utils/phoneUtils"; // Import WhatsApp phone formatter
// TODO: Setup a toast component (e.g., Sonner or Shadcn's Toaster) and import its 'toast' function
// For example: import { toast } from "sonner";
// As a placeholder, we'll define a dummy toast object if not available globally.
// This should be replaced by actual toast integration.
const toast = (globalThis as any).toast || {
  success: (message: string) => console.log("TOAST SUCCESS:", message),
  error: (message: string) => console.error("TOAST ERROR:", message),
  info: (message: string) => console.info("TOAST INFO:", message)
};


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
  sla_status?: SlaStatus;
  priority?: PriorityStatus;
  sla_deadline?: string;
}
interface TicketSummary extends Omit<Ticket, 'detalles' | 'comentarios'> {
  direccion?: string;
  latitud?: number | null;
  longitud?: number | null;
  sla_status?: SlaStatus;
  priority?: PriorityStatus;
}
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
        <p className={cn("text-xs text-muted-foreground", !slaInfo && "ml-auto")}>{formatDate(ticket.fecha, timezone, locale)}</p>
      </div>
    </motion.div>
  );
};

interface TicketDetailViewProps {
  ticket: Ticket;
  onTicketUpdate: (updatedTicket: Ticket) => void;
  onClose: () => void;
  categoryNames: Record<string, string>; // Added categoryNames prop
}

export default function TicketsPanel() {
  useRequireRole(['admin', 'empleado'] as Role[]);
  const navigate = useNavigate();
  const { timezone, locale, updateSettings } = useDateSettings();
  const [groupedTickets, setGroupedTickets] = useState<GroupedTickets[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [detailedTicket, setDetailedTicket] = useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTermInput, setSearchTermInput] = useState("");
  const debouncedSearchTerm = useDebounce(searchTermInput, 300);
  const [searchTerm, setSearchTerm] = useState("");
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

      const data = await apiFetch<any>(url, { sendEntityToken: true });

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
  }, [statusFilter, categoryFilter, groupedTickets.length, categoryNames]);

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
      .then((data) => { // Expecting data to be Array<{id, nombre}> directly
        const mapping: Record<string, string> = {};
        if (Array.isArray(data)) {
          data.forEach((c) => {
            mapping[String(c.id)] = c.nombre;
          });
        } else {
          // This case should ideally not happen if backend is consistent and returns array
          console.error('[TicketsPanel] Categories data from /municipal/categorias is not an array:', data);
        }
        setCategoryNames(mapping);
      })
      .catch((err) => {
        console.error("[TicketsPanel] Error fetching municipal categories:", err);
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
          (ticket.categoria && (categoryNames[ticket.categoria] || ticket.categoria).toLowerCase().includes(searchTerm.toLowerCase())) ||
          (ticket.direccion && ticket.direccion.toLowerCase().includes(searchTerm.toLowerCase()))
        );
      }

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
  }, [groupedTickets, searchTerm, categoryNames]);


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
    setGroupedTickets(prevGroups => {
      return prevGroups.map(group => ({
        ...group,
        tickets: group.tickets.map(t =>
          t.id === updatedTicket.id
          ? { ...t, ...updatedTicket, sla_status: updatedTicket.sla_status || null, priority: updatedTicket.priority || null }
          : t
        )
      }));
    });
  };

  const closeDetailPanel = () => {
    setSelectedTicketId(null);
    setDetailedTicket(null);
  }

  if (isLoading && groupedTickets.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/30 dark:bg-slate-900">
        <Loader2 className="animate-spin text-primary h-16 w-16" />
      </div>
    );
  }

  if (error && groupedTickets.length === 0 && !isLoading) {
    return <div className="p-8 text-center text-destructive bg-destructive/10 rounded-md min-h-screen flex flex-col justify-center items-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" /> {/* Changed Icon */}
        <h2 className="text-xl font-semibold mb-2">Error al cargar tickets</h2>
        <p>{error}</p>
        <Button onClick={fetchInitialData} className="mt-4">Reintentar</Button>
      </div>;
  }

return (
  <div className="flex flex-col min-h-screen bg-muted/30 dark:bg-slate-900 text-foreground pb-10">
    <header className="p-4 border-b dark:border-slate-700 bg-card dark:bg-slate-800/50 shadow-sm">
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
            <Accordion type="single" collapsible className="space-y-2"> {/* Changed type to single and added collapsible */}
              {filteredAndSortedGroups.map(group => (
                <AccordionItem key={group.categoryName} value={String(group.categoryName)}>
                  <AccordionTrigger className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1 py-2 hover:no-underline">
                    {group.categoryName} ({group.tickets.length})
                  </AccordionTrigger>
                  <AccordionContent className="space-y-2 pt-1">
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
              categoryNames={categoryNames} // Pass categoryNames prop
          />
        ) : selectedTicketId && !detailedTicket && !error ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin text-primary h-10 w-10" />
          </div>
        ): error && selectedTicketId ? (
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

  if(eventos.length === 0 && ticket.fecha) {
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

const TicketDetail_Refactored: FC<TicketDetailViewProps> = ({ ticket, onTicketUpdate, onClose, categoryNames }) => { // Added categoryNames to destructuring
  const { timezone, locale } = useDateSettings();
  const { user } = useUser();
  const [newMessage, setNewMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [comentarios, setComentarios] = useState<Comment[]>(ticket.comentarios || []);
  const [isTemplateSelectorOpen, setIsTemplateSelectorOpen] = useState(false); // State for modal
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
            ].sort((a,b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
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
            // Use ticket.comentarios (from prop) as the fallback, it's more stable reference here
            onTicketUpdate({ ...ticket, ...updatedTicketData, comentarios: updatedTicketData.comentarios || ticket.comentarios });
        } catch (e) {
            console.error("Error al refrescar ticket:", e);
        }
    }
  }, [ticket.id, ticket.tipo, onTicketUpdate, isAnonimo, chatEnVivo, ticket.comentarios, ticket.asunto, ticket.categoria, ticket.estado]); // Refined dependencies

  useEffect(() => {
    const initialComments = ticket.comentarios ? [...ticket.comentarios].sort((a,b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()) : [];
    setComentarios(initialComments);
    ultimoMensajeIdRef.current = initialComments.length > 0 ? initialComments[initialComments.length - 1].id : 0;

    if (pollingRef.current) clearInterval(pollingRef.current);
    if (!chatEnVivo) return;

    fetchComentarios(true); // Initial fetch and ticket refresh
    pollingRef.current = setInterval(() => {
        // For regular polling, we primarily want new messages.
        // A full ticket refresh might not be needed every 5s if messages endpoint is efficient.
        // However, the current `fetchComentarios` will refresh ticket if chatEnVivo is true.
        // To make it less aggressive, one could pass `fetchComentarios(false)`
        // and ensure critical ticket updates are pushed or handled differently.
        // For now, keeping `fetchComentarios(true)` but with faster interval.
        fetchComentarios(true);
    }, 5000); // Reduced polling interval to 5 seconds
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [ticket.id, ticket.comentarios, chatEnVivo, fetchComentarios]);


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
    const adminUserId = user?.id;

    if ((!newMessage.trim() && !selectedFile) || isSending || isAnonimo || !adminUserId) {
      if (!adminUserId && !isAnonimo) {
        console.error("Error: adminUserId no disponible para enviar mensaje.");
      }
      return;
    }

    setIsSending(true);
    const tempId = Date.now();
    const currentMessageText = newMessage.trim();
    const currentSelectedFile = selectedFile; // Capture before clearing state
    const previousAttachments = ticket.archivos_adjuntos ? [...ticket.archivos_adjuntos] : []; // Capture previous attachments

    // Optimistic update:
    let optimisticCommentText = currentMessageText;
    if (currentSelectedFile) {
        const filePlaceholder = `Archivo adjunto: ${currentSelectedFile.name} (subiendo...)`;
        if (!currentMessageText) { // If only file
            optimisticCommentText = filePlaceholder;
        } else { // If text and file
            optimisticCommentText = `${currentMessageText}\n${filePlaceholder}`;
        }
    }

    const optimisticComment: Comment = {
        id: tempId,
        comentario: optimisticCommentText,
        fecha: new Date().toISOString(),
        es_admin: true,
    };
    // Add optimistic comment only if there's text or a file being sent
    if (optimisticCommentText || currentSelectedFile) {
        setComentarios(prev => [...prev, optimisticComment].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()));
    }

    setNewMessage("");
    setSelectedFile(null);

    try {
        let requestBody: any;
        let headers: Record<string, string> = {}; // apiFetch will add auth token

        if (currentSelectedFile) {
            const formData = new FormData();
            formData.append('archivos', currentSelectedFile, currentSelectedFile.name);
            if (currentMessageText) {
                formData.append('comentario', currentMessageText);
            }
            // The backend uses current_user.id for the user_id of the comment and attachment.
            // No need to explicitly send user_id in FormData for this endpoint.
            requestBody = formData;
            // When using FormData, do not set the 'Content-Type' header manually.
            // The browser will automatically set it to 'multipart/form-data'
            // with the correct 'boundary' parameter.
        } else {
            // Only text message
            requestBody = {
                mensaje: currentMessageText,
                user_id: adminUserId // Backend expects user_id for JSON, but derives from token for comment user.
                                     // The provided backend code for JSON payload for /responder does not use user_id from payload.
                                     // It uses current_user.id for `servicio_tickets.crear_comentario`.
                                     // Let's send `comentario` as per backend for JSON.
            };
            if (currentMessageText) { // Only send 'comentario' if there is text.
                 requestBody = { comentario: currentMessageText };
            } else {
                // Should not happen due to initial check, but as a safeguard:
                setIsSending(false);
                return;
            }
            headers['Content-Type'] = 'application/json';
        }

        const updatedTicket = await apiFetch<Ticket>(`/tickets/${ticket.tipo}/${ticket.id}/responder`, {
            method: "POST",
            body: requestBody,
            headers: headers, // Pass headers for JSON case
            sendEntityToken: true, // apiFetch handles token
        });

      const serverComentariosActuales = updatedTicket.comentarios
          ? [...updatedTicket.comentarios]
          : [];

      let nuevosComentariosParaMostrar = [...serverComentariosActuales];

      if (currentSelectedFile) {
        // Identificar el archivo recién subido para crear un comentario sintético para él.
        // Esto asume que `updatedTicket.archivos_adjuntos` está actualizado.
        const prevAttachmentIds = new Set(ticket.archivos_adjuntos?.map(att => att.id) || []);
        const newAttachments = updatedTicket.archivos_adjuntos?.filter(att => !prevAttachmentIds.has(att.id)) || [];
        console.log('[handleSendMessage] Newly identified attachments:', JSON.stringify(newAttachments, null, 2));

        newAttachments.forEach(newFileAttachment => {
          let fileUrlForComment = newFileAttachment.url;
          if (newFileAttachment.url && newFileAttachment.url.startsWith('/')) {
            // Ensure VITE_API_URL is defined and doesn't end with /api if the URL already has a leading /
            const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/api$/, '');
            fileUrlForComment = `${apiUrl}${newFileAttachment.url}`;
            console.log(`[handleSendMessage] Constructed absolute URL for synthetic comment: ${fileUrlForComment}`);
          } else if (newFileAttachment.url) {
            console.log(`[handleSendMessage] Using provided URL for synthetic comment (assumed absolute or will be handled by browser): ${fileUrlForComment}`);
          } else {
            console.error('[handleSendMessage] New attachment found but has no URL:', newFileAttachment);
            return; // Skip this attachment if no URL
          }

          const fileComment: Comment = {
            id: `client-file-${newFileAttachment.id || Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            comentario: fileUrlForComment,
            fecha: newFileAttachment.fecha || new Date().toISOString(),
            es_admin: true,
          };
          console.log('[handleSendMessage] Synthetic fileComment created:', JSON.stringify(fileComment, null, 2));
          nuevosComentariosParaMostrar.push(fileComment);
        });
      }

      console.log('[handleSendMessage] All comments to display (after adding synthetic, before sort):', JSON.stringify(nuevosComentariosParaMostrar, null, 2));
      nuevosComentariosParaMostrar.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
      console.log('[handleSendMessage] Final sorted comments for display:', JSON.stringify(nuevosComentariosParaMostrar, null, 2));

      setComentarios(nuevosComentariosParaMostrar);

      if (nuevosComentariosParaMostrar.length > 0) {
          const lastComment = nuevosComentariosParaMostrar.find(c => typeof c.id === 'number' && c.id > ultimoMensajeIdRef.current);
          if (lastComment) { // Asegurar que solo actualizamos con IDs numéricos de comentarios reales
            ultimoMensajeIdRef.current = lastComment.id;
          } else if (serverComentariosActuales.length > 0 && typeof serverComentariosActuales[serverComentariosActuales.length -1].id === 'number') {
            // Fallback si no hay un "nuevo" comentario real pero sí hay comentarios del servidor
            ultimoMensajeIdRef.current = serverComentariosActuales[serverComentariosActuales.length -1].id;
          }
      }

      // Actualizar el ticket principal. Los comentarios aquí son los del servidor.
      // La UI de comentarios ya se actualizó con los sintéticos si los hubo.
      onTicketUpdate({ ...ticket, ...updatedTicket, comentarios: serverComentariosActuales });

      // Log for diagnosing backend response
      if (currentSelectedFile) {
        console.log('Updated Ticket Data (after file upload):', JSON.stringify(updatedTicket, null, 2));
        console.log('Previous attachments (before this send):', JSON.stringify(previousAttachments, null, 2));
      }

    } catch (error) {
      const displayError = error instanceof ApiError ? error.message : "No se pudo enviar el mensaje. Intente de nuevo.";
      toast.error(displayError);
      console.error("Error al enviar comentario:", error); // Keep console log for debugging

      // Revertir la UI eliminando el comentario optimista
      setComentarios(prev => prev.filter(c => c.id !== tempId));

      // Restaurar el texto y el archivo seleccionado para que el usuario no los pierda
      setNewMessage(currentMessageText);
      if (currentSelectedFile) {
        setSelectedFile(currentSelectedFile); // Restaurar el archivo seleccionado
        toast.info(`El archivo "${currentSelectedFile.name}" no fue enviado. Por favor, adjúntelo de nuevo si es necesario.`);
      }
    } finally {
      // No limpiar newMessage y selectedFile aquí si falló, para que el usuario pueda reintentar.
      // Se limpian al inicio del try si la preparación es exitosa.
      // Ah, ya se limpian al inicio del try, entonces si hay error, se restauran.
      // Si no hay error, ya están limpios.
      setIsSending(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleEstadoChange = async (nuevoEstado: TicketStatus) => {
    if (isAnonimo) return;
    const originalState = ticket.estado;
    onTicketUpdate({ ...ticket, estado: nuevoEstado });
    try {
      const updatedTicketData = await apiFetch<Ticket>(
        `/tickets/${ticket.tipo}/${ticket.id}/estado`,
        { method: "PUT", body: { estado: nuevoEstado, user_id: user?.id }, sendEntityToken: true }
      );
      const serverComentarios = updatedTicketData.comentarios ? [...updatedTicketData.comentarios].sort((a,b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()) : comentarios;
      const mergedTicket = { ...ticket, ...updatedTicketData, comentarios: serverComentarios};
      onTicketUpdate(mergedTicket);
      toast.success(`Estado del ticket actualizado a "${mergedTicket.estado}".`);
    } catch (error) {
      const displayError = error instanceof ApiError ? error.message : "No se pudo cambiar el estado. Intente de nuevo.";
      toast.error(displayError);
      console.error("Error al cambiar estado", error); // Keep console log
      onTicketUpdate({ ...ticket, estado: originalState, comentarios: comentarios }); // Revert optimistic update
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
                                    : 'bg-card dark:bg-slate-800 text-foreground border dark:border-slate-700/80 rounded-bl-sm',
                                // Conditional styling for synthetic file comments
                                typeof comment.id === 'string' && comment.id.startsWith('client-file-') && comment.es_admin
                                    ? 'bg-primary/80 border border-primary/50' // Slightly different style for admin file messages
                                    : typeof comment.id === 'string' && comment.id.startsWith('client-file-')
                                        ? 'bg-muted border border-border' // Style for non-admin (though currently files are admin-sent)
                                        : ''
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
                <footer className="border-t dark:border-slate-700/80 p-2 md:p-3 mt-2 flex flex-col gap-2 flex-shrink-0">
                    {selectedFile && (
                        <div className="p-2 border border-dashed dark:border-slate-600 rounded-md flex items-center justify-between bg-muted/50 dark:bg-slate-800/30">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground truncate">
                                <File className="h-4 w-4 flex-shrink-0" />
                                <span className="truncate" title={selectedFile.name}>{selectedFile.name}</span>
                                <span className="text-xs opacity-70 whitespace-nowrap">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setSelectedFile(null)} className="h-7 w-7">
                                <XCircle className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                    <div className="flex gap-2 items-center">
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
                        <Button variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} className="h-10 w-10 flex-shrink-0" title="Adjuntar archivo">
                            <Paperclip className="h-5 w-5" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => setIsTemplateSelectorOpen(true)} className="h-10 w-10 flex-shrink-0" title="Usar plantilla de mensaje">
                            <Sparkles className="h-5 w-5" />
                        </Button>
                        <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey && (newMessage.trim() || selectedFile)) {
                                e.preventDefault();
                                handleSendMessage();
                            }
                        }}
                        placeholder="Escribe una respuesta..."
                        disabled={isSending}
                        className="h-10 bg-card dark:bg-slate-800 focus-visible:ring-primary/50"
                        />
                        <Button
                            onClick={handleSendMessage}
                            disabled={isSending || (!newMessage.trim() && !selectedFile)}
                            aria-label="Enviar Mensaje" className="h-10"
                        >
                            {isSending ? <Loader2 className="animate-spin h-5 w-5" /> : <Send className="h-5 w-5" />}
                        </Button>
                    </div>
                </footer>
            </div>

            <ScrollArea className="w-full md:w-[320px] lg:w-[360px] p-3 md:p-4 space-y-4 bg-card dark:bg-slate-800/50 md:border-l-0 border-t md:border-t-0 dark:border-slate-700">
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
                    {ticket.telefono && (
                        <div className="flex items-center gap-2">
                            <p className="flex-shrink-0"><strong>Teléfono:</strong></p>
                            <a href={`tel:${ticket.telefono}`} className="text-primary hover:underline truncate" title={ticket.telefono}>{ticket.telefono}</a>
                            {(() => {
                                const formattedPhone = formatPhoneNumberForWhatsApp(ticket.telefono);
                                if (formattedPhone) {
                                    const adminName = user?.name || 'el equipo del municipio';
                                    const municipioName = ticket.municipio_nombre || 'el municipio';
                                    // Using more generic placeholders if specific ticket details are not crucial for an initial WhatsApp message
                                    const messageText = `Hola ${ticket.nombre_usuario || 'vecino/a'}, le contactamos desde ${municipioName} (agente: ${adminName}) en relación a su ticket N°${ticket.nro_ticket || '[Nro Ticket]'}.`;
                                    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(messageText)}`;
                                    return (
                                    <a
                                        href={whatsappUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title="Enviar mensaje de WhatsApp"
                                        className="ml-1 flex-shrink-0"
                                    >
                                        <MessageSquare className="h-4 w-4 text-green-600 hover:text-green-700 cursor-pointer" />
                                    </a>
                                    );
                                }
                                return null;
                            })()}
                        </div>
                    )}
                    </CardContent>
                </Card>
                )}

                <TicketTimeline ticket={ticket} comentarios={comentarios} />

                <Card className="shadow-sm">
                    <CardHeader className="pb-3 pt-4 px-4">
                        <CardTitle className="text-base font-semibold">Descripción del Reclamo</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 text-sm text-muted-foreground whitespace-pre-wrap break-words">
                        {ticket.pregunta || ticket.detalles || "No hay descripción detallada disponible."}
                    </CardContent>
                </Card>

                <TicketMap ticket={ticket} />

                <Card className="shadow-sm">
                    <CardHeader className="pb-3 pt-4 px-4">
                        <CardTitle className="text-base font-semibold">Archivos Adjuntos al Ticket</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-2">
                        {(ticket.archivos_adjuntos && ticket.archivos_adjuntos.length > 0) ? (
                            ticket.archivos_adjuntos.map((adj, index) => {
                                // Construct AttachmentInfo for AttachmentPreview
                                // The backend provides 'name', 'url', 'mimeType', 'size' for each adjunto.
                                // deriveAttachmentInfo can determine 'type' and 'extension'.
                                const attachmentInfoForPreview: AttachmentInfo = deriveAttachmentInfo(
                                    adj.url, // adj.url is typically relative like /tickets/archivos/filename.ext
                                    adj.name,
                                    adj.mimeType,
                                    adj.size
                                );
                                // If VITE_API_URL is set and URL is relative, make it absolute for preview
                                // This helps if no proxy is set up for /tickets/archivos
                                if (attachmentInfoForPreview.url.startsWith('/')) {
                                    const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/api$/, '');
                                    if (apiUrl) { // Only prepend if VITE_API_URL is defined
                                        attachmentInfoForPreview.url = `${apiUrl}${attachmentInfoForPreview.url}`;
                                    }
                                }
                                return (
                                    <AttachmentPreview key={adj.id || index} attachment={attachmentInfoForPreview} />
                                );
                            })
                        ) : (
                            <p className="text-sm text-muted-foreground">No hay archivos adjuntos para este ticket.</p>
                        )}
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                     <CardHeader className="pb-3 pt-4 px-4"><CardTitle className="text-base font-semibold">Detalles del Ticket</CardTitle></CardHeader>
                     <CardContent className="text-sm text-muted-foreground space-y-1.5 px-4 pb-4">
                        <p><strong>Categoría:</strong> {categoryNames[ticket.categoria || ''] || ticket.categoria || "No especificada"}</p>
                        <p><strong>Tipo:</strong> {ticket.tipo}</p>
                        {ticket.municipio_nombre && <p><strong>Municipio:</strong> {ticket.municipio_nombre}</p>}
                        <p><strong>Creado:</strong> {formatDate(ticket.fecha, timezone, locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                     </CardContent>
                </Card>
            </ScrollArea>
        </div>
        <TemplateSelector
            isOpen={isTemplateSelectorOpen}
            onClose={() => setIsTemplateSelectorOpen(false)}
            onSelectTemplate={(templateText) => {
                let finalText = templateText;

                const placeholderMap: Record<string, () => string> = {
                    '{nombre_usuario}': () => ticket?.nombre_usuario || 'Cliente',
                    '{ticket_asunto}': () => ticket?.asunto || '',
                    '{ticket_estado}': () => ticket?.estado || '',
                    '{ticket_id}': () => String(ticket?.id || ''),
                    '{ticket_nro_ticket}': () => String(ticket?.nro_ticket || ''),
                    '{ticket_direccion}': () => ticket?.direccion || 'N/A',
                    '{admin_nombre}': () => user?.name || 'nuestro equipo', // Added admin name
                    // Add more placeholders here as needed
                };

                if (ticket || user) { // Ensure there's some data to replace with
                    for (const placeholder in placeholderMap) {
                        // Check if placeholder actually exists in template to avoid unnecessary replace calls
                        if (finalText.includes(placeholder)) {
                             finalText = finalText.replace(new RegExp(placeholder.replace(/\{/g, '\\{').replace(/\}/g, '\\}'), 'g'), placeholderMap[placeholder]());
                        }
                    }
                }

                setNewMessage(prev => prev ? `${prev} ${finalText}` : finalText); // Append or set
                setIsTemplateSelectorOpen(false);
            }}
            // Pass current ticket data if TemplateSelector is to be context-aware
            // currentTicket={ticket}
        />
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
