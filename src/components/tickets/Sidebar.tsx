import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ChevronDown,
  FileDown,
  FolderOpen,
  List,
  Search,
  SlidersHorizontal,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { normalizeTicketStatus } from '@/utils/ticketStatus';

interface SidebarProps {
  className?: string;
  onTicketSelected?: () => void;
  compact?: boolean;
}

const ITEMS_PER_PAGE = 10;
const QUEUE_ITEMS_PER_PAGE = 25;
const defaultFilters = {
  channel: 'all',
  status: 'all',
  area: 'all',
  agent: 'all',
  priority: 'all',
  sla: 'all',
  unread: 'all',
};

const FILTER_SELECT_CLASS_NAME =
  'h-8 w-full min-w-0 rounded-md border border-input bg-background px-2 text-xs';

const isUnreadQueueTicket = (ticket: any) =>
  Boolean(
    ticket.hasUnreadMessages ||
      ticket.collaboration_state?.has_unread ||
      Number(ticket.collaboration_state?.unread_count || 0) > 0 ||
      Number(ticket.collaboration_state?.unread_viewer_count || 0) > 0,
  );

const isRiskQueueTicket = (ticket: any) => {
  const sla = String(ticket.sla_status || '').toLowerCase();
  const priority = String(ticket.priority || '').toLowerCase();
  return (
    sla.includes('breach') ||
    sla.includes('venc') ||
    sla.includes('overdue') ||
    priority.includes('alta') ||
    priority.includes('urgent') ||
    priority.includes('urgente')
  );
};

const getQueueTimestamp = (ticket: any) => {
  const raw =
    ticket.updated_at ||
    ticket.fecha_actualizacion ||
    ticket.last_message_at ||
    ticket.ultimo_mensaje_at ||
    ticket.created_at ||
    ticket.fecha_creacion ||
    ticket.fecha;
  const parsed = raw ? Date.parse(String(raw)) : 0;
  return Number.isNaN(parsed) ? 0 : parsed;
};

const getQueueScore = (ticket: any) => {
  const status = normalizeTicketStatus(ticket.estado);
  const isResolved = status === 'resuelto' || String(ticket.estado).toLowerCase() === 'cerrado';
  return (
    (isUnreadQueueTicket(ticket) ? 100 : 0) +
    (isRiskQueueTicket(ticket) ? 50 : 0) +
    (!isResolved ? 10 : 0)
  );
};

const Sidebar: React.FC<SidebarProps> = ({ className, onTicketSelected, compact = false }) => {
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
    pagination,
    hasMoreTickets,
    loadingMoreTickets,
    loadMoreTickets,
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
  const [listMode, setListMode] = React.useState<'queue' | 'categories'>('queue');
  const [queueVisibleCount, setQueueVisibleCount] = React.useState(
    QUEUE_ITEMS_PER_PAGE,
  );
  const previousOpenCategoriesRef = React.useRef<string[] | null>(null);
  const searchInputId = React.useId();
  const filterPanelId = React.useId();

  React.useEffect(() => {
    if (compact) {
      setListMode('queue');
    }
  }, [compact]);

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
    // Ensure all backend categories exist even if empty
    backendCategories.forEach((cat) => {
      if (!baseCategories[cat]) {
        baseCategories[cat] = [];
      }
    });
    // Keep call requests grouped so operators can answer them without scanning every category.
    const callRequestTerms = [
      'solicitud de llamada',
      'solicito llamada',
      'pedir llamada',
      'llamarme',
    ];
    const callRequests: any[] = [];
    if (baseCategories['Solicitudes de Llamada']) {
      callRequests.push(...baseCategories['Solicitudes de Llamada']);
      delete baseCategories['Solicitudes de Llamada'];
    }
    Object.keys(baseCategories).forEach((cat) => {
      const remainingTickets: any[] = [];
      baseCategories[cat].forEach((ticket) => {
        const subject = (ticket.asunto || '').toLowerCase();
        const content = (ticket.mensaje || '').toLowerCase();

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
    if (callRequests.length > 0) {
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
    setQueueVisibleCount(QUEUE_ITEMS_PER_PAGE);
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

  const secondaryFilterLabels = React.useMemo(
    () =>
      [
        filters.channel !== 'all' ? `Canal: ${filters.channel}` : null,
        filters.status !== 'all' ? `Estado: ${filters.status}` : null,
        filters.area !== 'all' ? `Area: ${filters.area}` : null,
        filters.agent !== 'all' ? `Agente: ${filters.agent}` : null,
        filters.priority !== 'all' ? `Prioridad: ${filters.priority}` : null,
        filters.sla !== 'all' ? `SLA: ${filters.sla}` : null,
        filters.unread !== 'all' ? `Lectura: ${filters.unread}` : null,
      ].filter(Boolean) as string[],
    [filters],
  );
  const secondaryFilterCount = secondaryFilterLabels.length;
  const hasSecondaryFilters = secondaryFilterCount > 0;
  const secondaryFilterCountLabel =
    secondaryFilterCount === 1
      ? '1 activo'
      : `${secondaryFilterCount} activos`;
  const hasActiveFilters = Boolean(debouncedSearchTerm) || hasSecondaryFilters;
  const isDefaultFilterSet = React.useMemo(
    () =>
      Object.entries(defaultFilters).every(
        ([key, value]) => filters[key as keyof typeof defaultFilters] === value,
      ),
    [filters],
  );
  const secondaryFilterButtonLabel = hasSecondaryFilters
    ? `Filtros secundarios, ${secondaryFilterCountLabel}`
    : 'Filtros secundarios';
  const visibleSecondaryFilterLabels = secondaryFilterLabels.slice(0, 3);
  const hiddenSecondaryFilterCount = Math.max(
    0,
    secondaryFilterLabels.length - visibleSecondaryFilterLabels.length,
  );

  const resetFilters = () => {
    setSearchTerm('');
    setFilters(defaultFilters);
  };

  const categoryEntries = Object.entries(filteredTicketsByCategory) as [
    string,
    any[],
  ][];
  const sortedCategoryEntries = [...categoryEntries].sort(
    ([, leftTickets], [, rightTickets]) =>
      Number(rightTickets.length > 0) - Number(leftTickets.length > 0),
  );
  const visibleCategoryEntries = sortedCategoryEntries.filter(
    ([, categoryTickets]) => showEmptyCategories || categoryTickets.length > 0,
  );
  const emptyCategoryCount = categoryEntries.filter(
    ([, categoryTickets]) => categoryTickets.length === 0,
  ).length;
  const totalBackendTickets = pagination?.total_items ?? tickets.length;
  const queueEntries = visibleCategoryEntries
    .flatMap(([category, categoryTickets]) =>
      categoryTickets.map((ticket) => ({ category, ticket })),
    )
    .sort((left, right) => {
      const scoreDelta = getQueueScore(right.ticket) - getQueueScore(left.ticket);
      if (scoreDelta !== 0) return scoreDelta;
      return getQueueTimestamp(right.ticket) - getQueueTimestamp(left.ticket);
    });
  const visibleQueueEntries = queueEntries.slice(0, queueVisibleCount);
  const hasMoreQueueItems = visibleQueueEntries.length < queueEntries.length;
  const filterPopover = (
    <Popover open={advancedFiltersOpen} onOpenChange={setAdvancedFiltersOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={advancedFiltersOpen || hasSecondaryFilters ? 'secondary' : 'outline'}
          className="h-7 shrink-0 rounded-[8px] px-2.5 text-xs font-semibold"
          aria-label={secondaryFilterButtonLabel}
          aria-expanded={advancedFiltersOpen}
          aria-controls={filterPanelId}
        >
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          <span className="hidden sm:inline">Filtros</span>
          {hasSecondaryFilters ? (
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[11px] font-bold text-primary">
              {secondaryFilterCount}
            </span>
          ) : null}
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 transition-transform',
              advancedFiltersOpen && 'rotate-180',
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        id={filterPanelId}
        data-testid="sidebar-filter-panel"
        aria-label="Filtros secundarios de reclamos"
        align={compact ? 'end' : 'start'}
        side={compact ? 'bottom' : 'right'}
        sideOffset={8}
        className="w-[min(23rem,calc(100vw-2rem))] rounded-[8px] border-border/80 bg-popover/95 p-3 shadow-2xl backdrop-blur"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-foreground">Filtros secundarios</p>
            <p className="text-[11px] text-muted-foreground">
              {hasSecondaryFilters
                ? secondaryFilterCountLabel
                : 'Sin filtros secundarios'}
            </p>
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
        {compact ? (
          <div
            className="mb-2 grid grid-cols-4 gap-1.5"
            role="group"
            aria-label="Vistas rapidas de la bandeja"
            data-testid="sidebar-compact-primary-filters"
          >
            <Button
              type="button"
              size="sm"
              variant={
                !debouncedSearchTerm && isDefaultFilterSet
                  ? 'secondary'
                  : 'outline'
              }
              className="h-7 rounded-lg px-2 text-xs"
              aria-pressed={!debouncedSearchTerm && isDefaultFilterSet}
              onClick={resetFilters}
            >
              Todos
            </Button>
            <Button
              type="button"
              size="sm"
              variant={filters.unread === 'unread' ? 'secondary' : 'outline'}
              className="h-7 rounded-lg px-2 text-xs"
              aria-pressed={filters.unread === 'unread'}
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
              className="h-7 rounded-lg px-2 text-xs"
              aria-pressed={filters.sla === 'risk'}
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  sla: prev.sla === 'risk' ? 'all' : 'risk',
                }))
              }
            >
              Riesgo
            </Button>
            <Button
              type="button"
              size="sm"
              variant={filters.agent === 'unassigned' ? 'secondary' : 'outline'}
              className="h-7 rounded-lg px-2 text-xs"
              aria-pressed={filters.agent === 'unassigned'}
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  agent: prev.agent === 'unassigned' ? 'all' : 'unassigned',
                }))
              }
            >
              Sin resp.
            </Button>
          </div>
        ) : null}
        <fieldset className="grid max-h-[min(66vh,25rem)] grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
          <legend className="sr-only">Filtros secundarios de reclamos</legend>
          <div className="min-w-0">
            <label className="sr-only" htmlFor={`${filterPanelId}-channel`}>
              Filtrar por canal
            </label>
            <select
              id={`${filterPanelId}-channel`}
              className={FILTER_SELECT_CLASS_NAME}
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
          </div>
          <div className="min-w-0">
            <label className="sr-only" htmlFor={`${filterPanelId}-status`}>
              Filtrar por estado
            </label>
            <select
              id={`${filterPanelId}-status`}
              className={FILTER_SELECT_CLASS_NAME}
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
          </div>
          <div className="min-w-0">
            <label className="sr-only" htmlFor={`${filterPanelId}-area`}>
              Filtrar por area
            </label>
            <select
              id={`${filterPanelId}-area`}
              className={FILTER_SELECT_CLASS_NAME}
              value={filters.area}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, area: e.target.value }))
              }
            >
              <option value="all">Area: todas</option>
              {filterOptions.areas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label className="sr-only" htmlFor={`${filterPanelId}-agent`}>
              Filtrar por agente
            </label>
            <select
              id={`${filterPanelId}-agent`}
              className={FILTER_SELECT_CLASS_NAME}
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
          </div>
          <div className="min-w-0 sm:col-span-2">
            <label className="sr-only" htmlFor={`${filterPanelId}-priority`}>
              Filtrar por prioridad
            </label>
            <select
              id={`${filterPanelId}-priority`}
              className={FILTER_SELECT_CLASS_NAME}
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
          </div>
          <div className="min-w-0">
            <label className="sr-only" htmlFor={`${filterPanelId}-sla`}>
              Filtrar por SLA
            </label>
            <select
              id={`${filterPanelId}-sla`}
              className={FILTER_SELECT_CLASS_NAME}
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
          </div>
          <div className="min-w-0">
            <label className="sr-only" htmlFor={`${filterPanelId}-unread`}>
              Filtrar por lectura
            </label>
            <select
              id={`${filterPanelId}-unread`}
              className={FILTER_SELECT_CLASS_NAME}
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
        </fieldset>
      </PopoverContent>
    </Popover>
  );

  return (
    <aside
      className={cn(
        'flex h-full min-h-0 min-w-0 shrink-0 flex-col border-r border-border bg-muted/20',
        className,
      )}
    >
      <div className={cn(
        'shrink-0 border-b border-border/70 bg-background/80',
        compact ? 'space-y-1.5 p-2' : 'space-y-2 p-2.5',
      )}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className={cn('truncate font-bold tracking-tight', compact ? 'text-sm' : 'text-lg')}>
              {tenant?.tipo === 'municipio' ? 'Reclamos' : 'Tickets'}
            </h1>
            <p className={cn('truncate text-muted-foreground', compact ? 'text-[11px]' : 'text-xs')}>
              {filteredTickets.length.toLocaleString('es-AR')} filtrados -{' '}
              {tickets.length.toLocaleString('es-AR')} de{' '}
              {totalBackendTickets.toLocaleString('es-AR')} cargados
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
        <div className="flex items-center gap-1.5">
          <div className="relative min-w-0 flex-1">
            <label className="sr-only" htmlFor={searchInputId}>
              Buscar reclamos por numero, asunto, nombre, DNI o telefono
            </label>
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
            <Input
              id={searchInputId}
              placeholder={compact ? 'Buscar reclamo...' : 'Buscar por nro, asunto, nombre, DNI, telefono...'}
              className={cn('h-8 pl-8', compact ? 'text-xs' : 'text-sm')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {compact ? filterPopover : null}
        </div>

        {!compact ? (
        <div className="flex items-center gap-1.5">
          <div
            className="grid min-w-0 flex-1 grid-cols-4 gap-1.5"
            role="group"
            aria-label="Vistas rapidas de la bandeja"
            data-testid="sidebar-primary-filters"
          >
            <Button
              type="button"
              size="sm"
              variant={
                !debouncedSearchTerm && isDefaultFilterSet
                  ? 'secondary'
                  : 'outline'
              }
              className="h-7 rounded-lg px-2 text-xs"
              aria-pressed={!debouncedSearchTerm && isDefaultFilterSet}
              onClick={resetFilters}
            >
              Todos
            </Button>
            <Button
              type="button"
              size="sm"
              variant={filters.unread === 'unread' ? 'secondary' : 'outline'}
              className="h-7 rounded-lg px-2 text-xs"
              aria-pressed={filters.unread === 'unread'}
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
              className="h-7 rounded-lg px-2 text-xs"
              aria-pressed={filters.sla === 'risk'}
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  sla: prev.sla === 'risk' ? 'all' : 'risk',
                }))
              }
            >
              Riesgo
            </Button>
            <Button
              type="button"
              size="sm"
              variant={filters.agent === 'unassigned' ? 'secondary' : 'outline'}
              className="h-7 rounded-lg px-2 text-xs"
              aria-pressed={filters.agent === 'unassigned'}
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  agent: prev.agent === 'unassigned' ? 'all' : 'unassigned',
                }))
              }
            >
              Sin resp.
            </Button>
          </div>

          {filterPopover}
        </div>
        ) : null}
        {hasSecondaryFilters && !compact ? (
          <div
            aria-label="Filtros activos aplicados"
            data-testid="sidebar-active-filter-chips"
            className="-mx-0.5 flex min-w-0 gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {visibleSecondaryFilterLabels.map((label) => (
              <span
                key={label}
                className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[11px] font-semibold leading-none text-primary"
              >
                {label}
              </span>
            ))}
            {hiddenSecondaryFilterCount > 0 ? (
              <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-1 text-[11px] font-semibold leading-none text-muted-foreground">
                +{hiddenSecondaryFilterCount}
              </span>
            ) : null}
            <button
              type="button"
              onClick={resetFilters}
              className="shrink-0 rounded-full border border-border bg-background px-2 py-1 text-[11px] font-semibold leading-none text-muted-foreground transition hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              Limpiar
            </button>
          </div>
        ) : null}
        <div
          className="grid grid-cols-2 gap-1 rounded-lg border border-border/70 bg-muted/60 p-1"
          data-testid="sidebar-list-mode-toggle"
        >
          <Button
            type="button"
            variant={listMode === 'queue' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 gap-1.5 rounded-md px-2 text-xs"
            aria-pressed={listMode === 'queue'}
            onClick={() => setListMode('queue')}
          >
            <List className="h-3.5 w-3.5" />
            Cola
          </Button>
          <Button
            type="button"
            variant={listMode === 'categories' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 gap-1.5 rounded-md px-2 text-xs"
            aria-pressed={listMode === 'categories'}
            onClick={() => setListMode('categories')}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Rubros
          </Button>
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1 overflow-hidden bg-background/30">
        {visibleCategoryEntries.length === 0 ? (
          <div className="mx-3 mt-3 rounded-[8px] border border-dashed border-border bg-background/70 p-4 text-center">
            <p className="text-sm font-semibold text-foreground">
              No hay casos para esta vista
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Ajusta busqueda o filtros para volver a ver conversaciones.
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
        {listMode === 'queue' && queueEntries.length > 0 ? (
          <div className="space-y-2 px-2 py-2" data-testid="sidebar-ticket-queue">
            {visibleQueueEntries.map(({ ticket, category }) => (
              <div key={`${category}-${ticket.id}`} className="min-w-0">
                <TicketListItem
                  ticket={ticket}
                  isSelected={selectedTicket?.id === ticket.id}
                  onClick={() => {
                    selectTicket(ticket.id);
                    onTicketSelected?.();
                  }}
                />
              </div>
            ))}
            {hasMoreQueueItems ? (
              <div className="px-1 pb-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 w-full rounded-[8px] text-xs font-semibold"
                  onClick={() =>
                    setQueueVisibleCount((current) => current + QUEUE_ITEMS_PER_PAGE)
                  }
                >
                  Ver mas en esta vista
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
        {listMode === 'categories' ? (
          <>
            <Accordion
              type="multiple"
              className="w-full"
              value={openCategories}
              onValueChange={setOpenCategories}
            >
              {visibleCategoryEntries.map(([category, tickets]) => (
                <AccordionItem value={category} key={category}>
                  <AccordionTrigger className="px-3 py-2.5 font-semibold">
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
                            Cargar mas
                          </Button>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            {emptyCategoryCount > 0 ? (
              <div className="border-t border-border/60 px-3 py-2">
                <button
                  type="button"
                  onClick={() => setShowEmptyCategories((current) => !current)}
                  className="inline-flex w-full items-center justify-center rounded-lg border border-border/70 bg-background/75 px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  {showEmptyCategories
                    ? 'Ocultar rubros vacios'
                    : `Mostrar ${emptyCategoryCount.toLocaleString('es-AR')} rubros vacios`}
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </ScrollArea>
      {hasMoreTickets ? (
        <div className="shrink-0 border-t border-border/70 bg-background/90 p-2">
          <Button
            type="button"
            variant="outline"
            className="h-8 w-full rounded-[8px] text-xs font-semibold"
            onClick={loadMoreTickets}
            disabled={loadingMoreTickets}
          >
            {loadingMoreTickets ? 'Cargando mas reclamos...' : 'Cargar mas reclamos'}
          </Button>
          <p className="mt-1 text-center text-[11px] leading-4 text-muted-foreground">
            {tickets.length.toLocaleString('es-AR')} de {totalBackendTickets.toLocaleString('es-AR')} cargados desde el backend.
          </p>
        </div>
      ) : null}
    </aside>
  );
};

export default Sidebar;
