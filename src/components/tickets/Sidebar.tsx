import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ChevronDown,
  FileDown,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import TicketListItem from './TicketListItem';
import { useTenant } from '@/context/TenantContext';
import { useTickets } from '@/context/TicketContext';
import { apiClient } from '@/api/client';
import {
  exportToPdf,
  exportToExcel,
  exportAllToPdf,
} from '@/services/exportService';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  const {
    tickets,
    filteredTickets,
    ticketsByCategory,
    selectedTicket,
    selectTicket,
    filters,
    setFilters,
    filterOptions,
  } = useTickets();
  const [searchTerm, setSearchTerm] = React.useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [visibleCounts, setVisibleCounts] = React.useState<{
    [key: string]: number;
  }>({});
  const [openCategories, setOpenCategories] = React.useState<string[]>([]);
  const [backendCategories, setBackendCategories] = React.useState<string[]>(
    [],
  );
  const [showEmptyCategories, setShowEmptyCategories] = React.useState(false);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = React.useState(false);
  const previousOpenCategoriesRef = React.useRef<string[] | null>(null);

  React.useEffect(() => {
    const fetchCategories = async () => {
      if (tenant?.slug) {
        try {
          const cats = await apiClient.adminGetTicketCategories(tenant.slug);
          setBackendCategories(cats.map((c: any) => c.nombre));
        } catch (e) {
          console.error('Failed to load ticket categories', e);
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
    backendCategories.forEach((cat) => {
      if (!baseCategories[cat]) {
        baseCategories[cat] = [];
      }
    });

    // Crear grupo explícito para Solicitudes si no existe, o renombrarlo si es necesario
    // Detectamos tickets que parezcan solicitudes de llamada en otras categorías
    const callRequestTerms = [
      'solicitud de llamada',
      'solicito llamada',
      'pedir llamada',
      'llamarme',
    ];
    const callRequests: any[] = [];

    // Si ya existe la categoría, usémosla como base
    if (baseCategories['Solicitudes de Llamada']) {
      callRequests.push(...baseCategories['Solicitudes de Llamada']);
      delete baseCategories['Solicitudes de Llamada']; // Lo reinsertaremos después
    }

    // Buscar en otras categorías
    Object.keys(baseCategories).forEach((cat) => {
      const remainingTickets: any[] = [];
      baseCategories[cat].forEach((ticket) => {
        const subject = (ticket.asunto || '').toLowerCase();
        const content = (ticket.mensaje || '').toLowerCase(); // Dependiendo de la estructura del ticket

        if (
          callRequestTerms.some(
            (term) => subject.includes(term) || content.includes(term),
          )
        ) {
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
      const newCategories = {
        'Solicitudes de Llamada': callRequests,
        ...baseCategories,
      };
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
          String(field ?? '')
            .toLowerCase()
            .includes(term),
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
  }, [
    debouncedSearchTerm,
    filteredTicketsByCategory,
    openCategories,
    selectedCategory,
  ]);

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

  const activeFilterLabels = React.useMemo(
    () =>
      [
        debouncedSearchTerm ? `Busqueda: ${debouncedSearchTerm}` : null,
        filters.channel !== 'all' ? `Canal: ${filters.channel}` : null,
        filters.status !== 'all' ? `Estado: ${filters.status}` : null,
        filters.area !== 'all' ? `Area: ${filters.area}` : null,
        filters.agent !== 'all' ? `Agente: ${filters.agent}` : null,
        filters.priority !== 'all' ? `Prioridad: ${filters.priority}` : null,
        filters.sla !== 'all' ? `SLA: ${filters.sla}` : null,
        filters.unread !== 'all' ? `Lectura: ${filters.unread}` : null,
      ].filter(Boolean) as string[],
    [debouncedSearchTerm, filters],
  );

  const resetFilters = () => {
    setSearchTerm('');
    setFilters(defaultFilters);
  };

  const categoryEntries = Object.entries(filteredTicketsByCategory) as [
    string,
    any[],
  ][];
  const visibleCategoryEntries = categoryEntries.filter(
    ([, categoryTickets]) => showEmptyCategories || categoryTickets.length > 0,
  );
  const emptyCategoryCount = categoryEntries.filter(
    ([, categoryTickets]) => categoryTickets.length === 0,
  ).length;

  return (
    <aside
      className={cn(
        'flex h-full min-h-0 min-w-0 shrink-0 flex-col border-r border-border bg-muted/20',
        className,
      )}
    >
      <div className="shrink-0 space-y-3 border-b border-border/70 bg-background/80 p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold tracking-tight">
              {tenant?.tipo === 'municipio' ? 'Reclamos' : 'Tickets'}
            </h1>
            <p className="text-xs text-muted-foreground">
              {filteredTickets.length.toLocaleString('es-AR')} de{' '}
              {tickets.length.toLocaleString('es-AR')} visibles
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 px-2">
                <FileDown className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Exportar</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportToExcel(tickets)}>
                Exportar Todos (Excel)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportAllToPdf(tickets)}>
                Exportar Todos (PDF)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  exportToPdf(selectedTicket, selectedTicket?.messages || [])
                }
                disabled={!selectedTicket}
              >
                Exportar Ticket Actual (PDF)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nro, asunto, nombre, DNI, teléfono..."
            className="h-9 pl-8 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={
              filters.unread === 'all' && filters.sla === 'all'
                ? 'secondary'
                : 'outline'
            }
            className="h-8 rounded-lg px-2 text-xs"
            onClick={() =>
              setFilters((prev) => ({ ...prev, unread: 'all', sla: 'all' }))
            }
          >
            Todos
          </Button>
          <Button
            type="button"
            size="sm"
            variant={filters.unread === 'unread' ? 'secondary' : 'outline'}
            className="h-8 rounded-lg px-2 text-xs"
            onClick={() =>
              setFilters((prev) => ({ ...prev, unread: 'unread' }))
            }
          >
            No leidos
          </Button>
          <Button
            type="button"
            size="sm"
            variant={filters.sla === 'risk' ? 'secondary' : 'outline'}
            className="h-8 rounded-lg px-2 text-xs"
            onClick={() =>
              setFilters((prev) => ({
                ...prev,
                sla: prev.sla === 'risk' ? 'all' : 'risk',
              }))
            }
          >
            Riesgo
          </Button>
        </div>

        <div className="space-y-2">
            <Button
              type="button"
              variant={advancedFiltersOpen || activeFilterLabels.length > 0 ? 'secondary' : 'outline'}
              className="h-8 w-full justify-between rounded-[8px] px-2.5 text-xs font-semibold"
              aria-expanded={advancedFiltersOpen}
              aria-controls="sidebar-inline-filters"
              onClick={() => setAdvancedFiltersOpen((current) => !current)}
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                <span>Filtros avanzados</span>
                {activeFilterLabels.length > 0 ? (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary">
                    {activeFilterLabels.length}
                  </span>
                ) : null}
              </span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 transition-transform',
                  advancedFiltersOpen && 'rotate-180',
                )}
              />
            </Button>
          {advancedFiltersOpen ? (
          <div
            id="sidebar-inline-filters"
            data-testid="sidebar-inline-filters"
            className="rounded-[8px] border border-border/80 bg-background/70 p-2 shadow-sm"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-foreground">Filtro operativo</p>
              </div>
              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 shrink-0 px-2 text-xs"
                  onClick={resetFilters}
                >
                  Limpiar
                </Button>
              ) : null}
            </div>
            <div className="grid max-h-32 grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                value={filters.channel}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, channel: e.target.value }))
                }
              >
                <option value="all">Canal: todos</option>
                {filterOptions.channels.map((channel) => (
                  <option key={channel} value={channel}>
                    {channel}
                  </option>
                ))}
              </select>
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                value={filters.status}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, status: e.target.value }))
                }
              >
                <option value="all">Estado: todos</option>
                {filterOptions.statuses.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                value={filters.area}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, area: e.target.value }))
                }
              >
                <option value="all">Área: todas</option>
                {filterOptions.areas.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                value={filters.agent}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, agent: e.target.value }))
                }
              >
                <option value="all">Agente: todos</option>
                {filterOptions.agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.label}
                  </option>
                ))}
              </select>
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-xs sm:col-span-2"
                value={filters.priority}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, priority: e.target.value }))
                }
              >
                <option value="all">Prioridad: todas</option>
                {filterOptions.priorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                value={filters.sla}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, sla: e.target.value }))
                }
              >
                <option value="all">SLA: todos</option>
                <option value="risk">SLA: riesgo</option>
                {filterOptions.slaStatuses
                  .filter((slaStatus) => slaStatus !== 'risk')
                  .map((slaStatus) => (
                    <option key={slaStatus} value={slaStatus}>
                      {slaStatus}
                    </option>
                  ))}
              </select>
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                value={filters.unread}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, unread: e.target.value }))
                }
              >
                {filterOptions.unreadModes.map((mode) => (
                  <option key={mode.value} value={mode.value}>
                    {mode.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          ) : null}
        </div>
        {hasActiveFilters ? (
          <div className="flex flex-wrap items-center gap-1.5 rounded-[8px] border border-primary/20 bg-primary/5 px-2 py-1.5 text-xs">
            {activeFilterLabels.slice(0, 3).map((label) => (
              <span
                key={label}
                className="max-w-[10rem] truncate rounded-full bg-background/80 px-2 py-1 font-medium text-primary shadow-sm"
                title={label}
              >
                {label}
              </span>
            ))}
            {activeFilterLabels.length > 3 ? (
              <span className="rounded-full bg-primary/10 px-2 py-1 font-semibold text-primary">
                +{activeFilterLabels.length - 3}
              </span>
            ) : null}
            <button
              type="button"
              onClick={resetFilters}
              className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-primary transition hover:bg-primary/10"
            >
              <X className="h-3.5 w-3.5" />
              Limpiar
            </button>
          </div>
        ) : null}
      </div>
      <ScrollArea className="min-h-0 flex-1 overflow-hidden bg-background/30">
        {emptyCategoryCount > 0 ? (
          <div className="border-b border-border/60 px-3 py-2">
            <button
              type="button"
              onClick={() => setShowEmptyCategories((current) => !current)}
              className="inline-flex w-full items-center justify-center rounded-lg border border-border/70 bg-background/75 px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              {showEmptyCategories
                ? 'Ocultar rubros vacíos'
                : `Mostrar ${emptyCategoryCount.toLocaleString('es-AR')} rubros vacíos`}
            </button>
          </div>
        ) : null}
        {visibleCategoryEntries.length === 0 ? (
          <div className="mx-3 mt-3 rounded-[8px] border border-dashed border-border bg-background/70 p-4 text-center">
            <p className="text-sm font-semibold text-foreground">
              No hay casos para esta vista
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Ajustá búsqueda o filtros para volver a ver conversaciones.
            </p>
            {hasActiveFilters ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={resetFilters}
              >
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
          {visibleCategoryEntries.map(([category, tickets]) => (
            <AccordionItem value={category} key={category}>
              <AccordionTrigger className="px-3 py-3 font-semibold">
                {category} ({tickets.length})
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 px-2 pb-2">
                  {tickets.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">
                      Sin casos abiertos en este rubro.
                    </p>
                  ) : (
                    tickets
                      .slice(0, visibleCounts[category] || ITEMS_PER_PAGE)
                      .map((ticket) => (
                        <TicketListItem
                          key={ticket.id}
                          ticket={ticket}
                          isSelected={selectedTicket?.id === ticket.id}
                          onClick={() => {
                            selectTicket(ticket.id);
                            onTicketSelected?.();
                          }}
                        />
                      ))
                  )}
                  {(visibleCounts[category] || ITEMS_PER_PAGE) <
                    tickets.length && (
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
