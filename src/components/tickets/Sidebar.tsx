import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileDown, RotateCcw, Search } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import TicketListItem from './TicketListItem';
import { useTenant } from '@/context/TenantContext';
import { useTickets } from '@/context/TicketContext';
import { apiClient } from '@/api/client';
import { exportToPdf, exportToExcel, exportAllToPdf } from '@/services/exportService';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from '@/lib/utils';
import { normalizeTicketStatus } from '@/utils/ticketStatus';

interface SidebarProps {
  className?: string;
  onTicketSelected?: () => void;
}

const ITEMS_PER_PAGE = 10;
const defaultFilters = {
  channel: 'all',
  status: 'all',
  area: 'all',
  agent: 'all',
  priority: 'all',
  sla: 'all',
  unread: 'all',
};

const Sidebar: React.FC<SidebarProps> = ({ className, onTicketSelected }) => {
  const { tenant } = useTenant();
  const { tickets, filteredTickets, ticketsByCategory, selectedTicket, selectTicket, filters, setFilters, filterOptions } = useTickets();
  const [searchTerm, setSearchTerm] = React.useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [visibleCounts, setVisibleCounts] = React.useState<{ [key: string]: number }>({});
  const [openCategories, setOpenCategories] = React.useState<string[]>([]);
  const [backendCategories, setBackendCategories] = React.useState<string[]>([]);
  const previousOpenCategoriesRef = React.useRef<string[] | null>(null);

  React.useEffect(() => {
    const fetchCategories = async () => {
      if (tenant?.slug) {
        try {
          const cats = await apiClient.adminGetTicketCategories(tenant.slug);
          setBackendCategories(cats.map((c: any) => c.nombre));
        } catch (e) {
          console.error("Failed to load ticket categories", e);
        }
      }
    };
    fetchCategories();
  }, [tenant?.slug]);

  const selectedCategory = React.useMemo(() => {
    if (!selectedTicket) {
      return null;
    }

    const status = normalizeTicketStatus(selectedTicket.estado);

    if (status === 'resuelto') {
      return 'Resueltos';
    }

    return selectedTicket.categoria || 'General';
  }, [selectedTicket]);

  const filteredTicketsByCategory = React.useMemo(() => {
    const baseCategories = { ...ticketsByCategory };

    // Agrupar 'solicitudes de llamada' si existen en una categoría específica o inferida
    // Si el ticket tiene un tipo especial o prefijo, se podría mover aquí.
    // Por ahora, asumimos que vienen como categoría 'Solicitud de Llamada' desde el backend
    // o las agrupamos manualmente si detectamos el patrón.

    // Ensure all backend categories exist even if empty
    backendCategories.forEach(cat => {
        if (!baseCategories[cat]) {
            baseCategories[cat] = [];
        }
    });

    // Crear grupo explícito para Solicitudes si no existe, o renombrarlo si es necesario
    // Detectamos tickets que parezcan solicitudes de llamada en otras categorías
    const callRequestTerms = ['solicitud de llamada', 'solicito llamada', 'pedir llamada', 'llamarme'];
    const callRequests: any[] = [];

    // Si ya existe la categoría, usémosla como base
    if (baseCategories['Solicitudes de Llamada']) {
        callRequests.push(...baseCategories['Solicitudes de Llamada']);
        delete baseCategories['Solicitudes de Llamada']; // Lo reinsertaremos después
    }

    // Buscar en otras categorías
    Object.keys(baseCategories).forEach(cat => {
        const remainingTickets: any[] = [];
        baseCategories[cat].forEach(ticket => {
            const subject = (ticket.asunto || '').toLowerCase();
            const content = (ticket.mensaje || '').toLowerCase(); // Dependiendo de la estructura del ticket

            if (callRequestTerms.some(term => subject.includes(term) || content.includes(term))) {
                callRequests.push(ticket);
            } else {
                remainingTickets.push(ticket);
            }
        });
        baseCategories[cat] = remainingTickets;
    });

    // Si encontramos solicitudes, las agregamos como categoría prioritaria (al principio si es posible, o simplemente la agregamos)
    if (callRequests.length > 0) {
        // Podemos insertarlo al principio creando un nuevo objeto
        const newCategories = { 'Solicitudes de Llamada': callRequests, ...baseCategories };
        // Asignar de nuevo a baseCategories (que es const, así que mejor retornamos newCategories)
        // Pero baseCategories es una copia local de ticketsByCategory, así que podemos mutar o reasignar referencias.
        // Dado que filteredTicketsByCategory retorna un objeto, retornaremos el nuevo objeto aquí.
        // Sin embargo, filteredTicketsByCategory se construye iterativamente abajo con el término de búsqueda.
        // Así que aquí solo estamos manipulando la "base" antes del filtro de búsqueda.
        // Ah, filteredTicketsByCategory es el useMemo completo.
        // Modifiquemos la lógica para retornar newCategories filtrado después.

        // Re-inject into baseCategories for the search logic below to work on it
        baseCategories['Solicitudes de Llamada'] = callRequests;
    }

    if (!debouncedSearchTerm) {
      return baseCategories;
    }
    const filtered: { [key: string]: any[] } = {};
    const term = debouncedSearchTerm.toLowerCase();

    // Iterate over merged categories
    for (const category in baseCategories) {
      const tickets = baseCategories[category].filter((ticket) => {
        const fields = [
          ticket.asunto,
          ticket.display_name,
          ticket.nombre_usuario,
          ticket.nro_ticket,
          ticket.telefono,
          ticket.email,
          ticket.dni,
          ticket.informacion_personal_vecino?.nombre,
          ticket.informacion_personal_vecino?.telefono,
          ticket.informacion_personal_vecino?.email,
          ticket.informacion_personal_vecino?.dni,
          ticket.direccion,
        ];

        return fields.some((field) =>
          String(field ?? '').toLowerCase().includes(term)
        );
      });
      if (tickets.length > 0) {
        filtered[category] = tickets;
      }
    }
    return filtered;
  }, [ticketsByCategory, backendCategories, debouncedSearchTerm]);

  React.useEffect(() => {
    const newVisibleCounts: { [key: string]: number } = {};
    for (const category in filteredTicketsByCategory) {
      newVisibleCounts[category] = ITEMS_PER_PAGE;
    }
    setVisibleCounts(newVisibleCounts);
  }, [filteredTicketsByCategory]);

  React.useEffect(() => {
    setOpenCategories((prev) =>
      prev.filter((category) => Boolean(filteredTicketsByCategory[category])),
    );
  }, [filteredTicketsByCategory]);

  React.useEffect(() => {
    if (!selectedCategory) {
      return;
    }

    if (!filteredTicketsByCategory[selectedCategory]) {
      return;
    }

    setOpenCategories((prev) =>
      prev.includes(selectedCategory) ? prev : [...prev, selectedCategory],
    );
  }, [filteredTicketsByCategory, selectedCategory]);

  React.useEffect(() => {
    if (!debouncedSearchTerm) {
      return;
    }

    if (previousOpenCategoriesRef.current === null) {
      previousOpenCategoriesRef.current = openCategories.length
        ? openCategories
        : selectedCategory
          ? [selectedCategory]
          : [];
    }

    const categories = Object.keys(filteredTicketsByCategory);

    if (categories.length === 0) {
      if (openCategories.length > 0) {
        setOpenCategories([]);
      }
      return;
    }

    const sameOrder =
      categories.length === openCategories.length &&
      categories.every((category, index) => category === openCategories[index]);

    if (sameOrder) {
      return;
    }

    setOpenCategories(categories);
  }, [debouncedSearchTerm, filteredTicketsByCategory, openCategories, selectedCategory]);

  React.useEffect(() => {
    if (debouncedSearchTerm) {
      return;
    }

    if (previousOpenCategoriesRef.current === null) {
      return;
    }

    const restored = previousOpenCategoriesRef.current;
    previousOpenCategoriesRef.current = null;

    if (restored.length > 0) {
      setOpenCategories(restored);
      return;
    }

    if (selectedCategory) {
      setOpenCategories([selectedCategory]);
    } else {
      setOpenCategories([]);
    }
  }, [debouncedSearchTerm, selectedCategory]);

  const handleLoadMore = (category: string) => {
    setVisibleCounts((prev) => ({
      ...prev,
      [category]: (prev[category] || ITEMS_PER_PAGE) + ITEMS_PER_PAGE,
    }));
  };

  const hasActiveFilters =
    Boolean(debouncedSearchTerm) ||
    filters.channel !== 'all' ||
    filters.status !== 'all' ||
    filters.area !== 'all' ||
    filters.agent !== 'all' ||
    filters.priority !== 'all' ||
    filters.sla !== 'all' ||
    filters.unread !== 'all';

  const resetFilters = () => {
    setSearchTerm('');
    setFilters(defaultFilters);
  };

  return (
    <aside
      className={cn(
        'flex h-full min-h-0 min-w-0 shrink-0 flex-col border-r border-border bg-muted/20',
        className,
      )}
    >
      <div className="shrink-0 space-y-4 border-b border-border/70 bg-background/80 p-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {tenant?.tipo === 'municipio' ? 'Reclamos' : 'Tickets'}
            </h1>
            <p className="text-xs text-muted-foreground">
              {filteredTickets.length.toLocaleString('es-AR')} de {tickets.length.toLocaleString('es-AR')} visibles
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <FileDown className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportToExcel(tickets)}>
                Exportar Todos (Excel)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportAllToPdf(tickets)}>
                Exportar Todos (PDF)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToPdf(selectedTicket, selectedTicket?.messages || [])} disabled={!selectedTicket}>
                Exportar Ticket Actual (PDF)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nro, asunto, nombre, DNI, teléfono..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={filters.channel}
            onChange={(e) => setFilters((prev) => ({ ...prev, channel: e.target.value }))}
          >
            <option value="all">Canal: todos</option>
            {filterOptions.channels.map((channel) => (
              <option key={channel} value={channel}>{channel}</option>
            ))}
          </select>
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
          >
            <option value="all">Estado: todos</option>
            {filterOptions.statuses.map((status) => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={filters.area}
            onChange={(e) => setFilters((prev) => ({ ...prev, area: e.target.value }))}
          >
            <option value="all">Área: todas</option>
            {filterOptions.areas.map((area) => (
              <option key={area} value={area}>{area}</option>
            ))}
          </select>
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={filters.agent}
            onChange={(e) => setFilters((prev) => ({ ...prev, agent: e.target.value }))}
          >
            <option value="all">Agente: todos</option>
            {filterOptions.agents.map((agent) => (
              <option key={agent.id} value={agent.id}>{agent.label}</option>
            ))}
          </select>
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm sm:col-span-2"
            value={filters.priority}
            onChange={(e) => setFilters((prev) => ({ ...prev, priority: e.target.value }))}
          >
            <option value="all">Prioridad: todas</option>
            {filterOptions.priorities.map((priority) => (
              <option key={priority} value={priority}>{priority}</option>
            ))}
          </select>
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={filters.sla}
            onChange={(e) => setFilters((prev) => ({ ...prev, sla: e.target.value }))}
          >
            <option value="all">SLA: todos</option>
            {filterOptions.slaStatuses.map((slaStatus) => (
              <option key={slaStatus} value={slaStatus}>{slaStatus}</option>
            ))}
          </select>
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={filters.unread}
            onChange={(e) => setFilters((prev) => ({ ...prev, unread: e.target.value }))}
          >
            {filterOptions.unreadModes.map((mode) => (
              <option key={mode.value} value={mode.value}>{mode.label}</option>
            ))}
          </select>
        </div>
        {hasActiveFilters ? (
          <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
            <span className="font-medium text-primary">Filtros activos</span>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-primary transition hover:bg-primary/10"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Limpiar
            </button>
          </div>
        ) : null}
      </div>
      <ScrollArea className="min-h-0 flex-1 overflow-hidden">
        {Object.keys(filteredTicketsByCategory).length === 0 ? (
          <div className="mx-4 mt-4 rounded-2xl border border-dashed border-border bg-background/70 p-5 text-center">
            <p className="text-sm font-semibold text-foreground">No hay casos para esta vista</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Ajustá búsqueda o filtros para volver a ver conversaciones.
            </p>
            {hasActiveFilters ? (
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={resetFilters}>
                Limpiar filtros
              </Button>
            ) : null}
          </div>
        ) : null}
        <Accordion
          type="multiple"
          className="w-full"
          value={openCategories}
          onValueChange={setOpenCategories}
        >
          {Object.entries(filteredTicketsByCategory).map(([category, tickets]) => (
            <AccordionItem value={category} key={category}>
              <AccordionTrigger className="px-4 font-semibold">
                {category} ({tickets.length})
              </AccordionTrigger>
              <AccordionContent>
                <div className="p-1 space-y-2">
                  {tickets.slice(0, visibleCounts[category] || ITEMS_PER_PAGE).map((ticket) => (
                    <TicketListItem
                      key={ticket.id}
                      ticket={ticket}
                      isSelected={selectedTicket?.id === ticket.id}
                      onClick={() => {
                        selectTicket(ticket.id);
                        onTicketSelected?.();
                      }}
                    />
                  ))}
                  {(visibleCounts[category] || ITEMS_PER_PAGE) < tickets.length && (
                    <div className="p-2">
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => handleLoadMore(category)}
                      >
                        Cargar más
                      </Button>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </ScrollArea>
    </aside>
  );
};

export default Sidebar;
