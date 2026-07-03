import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileDown,
  FolderOpen,
  List,
  Search,
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
import TicketFilterPopover from './TicketFilterPopover';
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
import {
  getQueueScore,
  getQueueTimestamp,
  isRiskQueueTicket,
  isUnreadQueueTicket,
  isUnassignedQueueTicket,
} from '@/utils/ticketOperationalQueue';

interface SidebarProps {
  className?: string;
  onTicketSelected?: () => void;
  compact?: boolean;
  showFilterControl?: boolean;
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

const Sidebar: React.FC<SidebarProps> = ({
  className,
  onTicketSelected,
  compact = false,
  showFilterControl = true,
}) => {
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
  const [listMode, setListMode] = React.useState<'queue' | 'categories'>('queue');
  const [queueVisibleCount, setQueueVisibleCount] = React.useState(
    QUEUE_ITEMS_PER_PAGE,
  );
  const previousOpenCategoriesRef = React.useRef<string[] | null>(null);
  const searchInputId = React.useId();

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
  const queueUnreadCount = queueEntries.filter(({ ticket }) => isUnreadQueueTicket(ticket)).length;
  const queueRiskCount = queueEntries.filter(({ ticket }) => isRiskQueueTicket(ticket)).length;
  const queueUnassignedCount = queueEntries.filter(({ ticket }) => isUnassignedQueueTicket(ticket)).length;
  const visibleQueueEntries = queueEntries.slice(0, queueVisibleCount);
  const hasMoreQueueItems = visibleQueueEntries.length < queueEntries.length;
  const queueCaseCountLabel =
    queueEntries.length === 1
      ? '1 caso'
      : `${queueEntries.length.toLocaleString('es-AR')} casos`;
  const visibleRubrosCountLabel =
    visibleCategoryEntries.length === 1
      ? '1 visible'
      : `${visibleCategoryEntries.length.toLocaleString('es-AR')} visibles`;
  const visibleTicketCountLabel =
    filteredTickets.length === 1
      ? '1 visible'
      : `${filteredTickets.length.toLocaleString('es-AR')} visibles`;
  const listSummaryLabel =
    listMode === 'queue'
      ? `Cola priorizada: ${queueCaseCountLabel}`
      : `Rubros: ${visibleRubrosCountLabel}`;
  const filterSummaryLabel = hasSecondaryFilters
    ? secondaryFilterCountLabel
    : debouncedSearchTerm
      ? 'Busqueda activa'
      : 'Sin filtros';
  const activeFilterSummary = [
    debouncedSearchTerm ? `Busqueda: ${debouncedSearchTerm}` : null,
    ...secondaryFilterLabels,
  ].filter(Boolean) as string[];
  const showVisibleSummaryBar = !compact;
  const listSummaryTitle = activeFilterSummary.length
    ? activeFilterSummary.join(' | ')
    : 'Sin filtros activos';
  const listModeToggle = (
    <div
      className={cn(
        'grid grid-cols-2 gap-1 rounded-lg border border-border/70 bg-muted/60 p-1',
        compact && 'shrink-0 bg-background/75 p-0.5',
      )}
      data-testid="sidebar-list-mode-toggle"
      data-layout={compact ? 'toolbar' : 'inline'}
    >
      <Button
        type="button"
        variant={listMode === 'queue' ? 'secondary' : 'ghost'}
        size="sm"
        className={cn('h-7 gap-1.5 rounded-md px-2 text-xs', compact && 'w-7 px-0')}
        aria-pressed={listMode === 'queue'}
        title="Ver cola priorizada"
        onClick={() => setListMode('queue')}
      >
        <List className="h-3.5 w-3.5" />
        <span className={compact ? 'sr-only' : undefined}>Cola</span>
      </Button>
      <Button
        type="button"
        variant={listMode === 'categories' ? 'secondary' : 'ghost'}
        size="sm"
        className={cn('h-7 gap-1.5 rounded-md px-2 text-xs', compact && 'w-7 px-0')}
        aria-pressed={listMode === 'categories'}
        title="Ver rubros"
        onClick={() => setListMode('categories')}
      >
        <FolderOpen className="h-3.5 w-3.5" />
        <span className={compact ? 'sr-only' : undefined}>Rubros</span>
      </Button>
    </div>
  );
  const filterControl = showFilterControl ? (
    <TicketFilterPopover
      compact={compact}
      hasSearchTerm={Boolean(debouncedSearchTerm)}
      onReset={resetFilters}
    />
  ) : null;

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
        {compact ? (
          <div
            className="flex min-w-0 items-center gap-1.5"
            data-testid="sidebar-search-controls"
          >
            <h1 className="sr-only">
              {tenant?.tipo === 'municipio' ? 'Reclamos' : 'Tickets'}
            </h1>
            <div className="relative min-w-0 flex-1" role="search">
              <label className="sr-only" htmlFor={searchInputId}>
                Buscar reclamos por numero, asunto, nombre, DNI o telefono
              </label>
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
              <Input
                id={searchInputId}
                placeholder="Buscar reclamo..."
                className="h-8 pl-8 text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div
              className="flex shrink-0 items-center gap-1"
              data-testid="sidebar-compact-toolbar"
            >
              <span
                data-testid="sidebar-compact-summary"
                className="hidden shrink-0 rounded-full border border-border/70 bg-muted/70 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground min-[380px]:inline-flex"
              >
                {filteredTickets.length.toLocaleString('es-AR')}/{totalBackendTickets.toLocaleString('es-AR')}
              </span>
              {listModeToggle}
              {filterControl}
              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 shrink-0 px-0"
                  aria-label="Limpiar filtros activos"
                  title="Limpiar filtros"
                  onClick={resetFilters}
                >
                  <X className="h-4 w-4" />
                </Button>
              ) : null}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 px-0"
                    title="Exportar"
                  >
                    <FileDown className="h-4 w-4" />
                    <span className="sr-only">Exportar</span>
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
            <p data-testid="sidebar-ticket-summary" className="sr-only">
              {filteredTickets.length.toLocaleString('es-AR')} filtrados -{' '}
              {tickets.length.toLocaleString('es-AR')} de{' '}
              {totalBackendTickets.toLocaleString('es-AR')} cargados
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold tracking-tight">
                  {tenant?.tipo === 'municipio' ? 'Reclamos' : 'Tickets'}
                </h1>
                <p
                  data-testid="sidebar-ticket-summary"
                  className="truncate text-xs text-muted-foreground"
                >
                  {filteredTickets.length.toLocaleString('es-AR')} filtrados -{' '}
                  {tickets.length.toLocaleString('es-AR')} de{' '}
                  {totalBackendTickets.toLocaleString('es-AR')} cargados
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2"
                    title="Exportar"
                  >
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
            <div
              className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1.5"
              data-testid="sidebar-search-controls"
            >
              <div className="relative min-w-0" role="search">
                <label className="sr-only" htmlFor={searchInputId}>
                  Buscar reclamos por numero, asunto, nombre, DNI o telefono
                </label>
                <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                <Input
                  id={searchInputId}
                  placeholder="Buscar por nro, asunto o vecino..."
                  className="h-8 pl-8 text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              {filterControl}
              {listModeToggle}
            </div>
          </>
        )}
      </div>
      <div
        className={cn(
          'flex shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-background/70 px-2.5 py-1.5',
          compact && 'px-2 py-1',
          !showVisibleSummaryBar && 'sr-only',
        )}
        data-testid="sidebar-list-summary-bar"
        title={listSummaryTitle}
      >
        <p
          className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden text-[11px] leading-5 text-muted-foreground"
          aria-label={`${listSummaryLabel}. ${filterSummaryLabel}. ${visibleTicketCountLabel}.`}
        >
          <span
            className={cn(
              'max-w-[48%] truncate rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 font-semibold text-primary',
              compact && 'sr-only',
            )}
          >
            {listSummaryLabel}
          </span>
          <span
            className={cn(
              'max-w-[32%] truncate rounded-full border px-2 py-0.5 font-semibold',
              hasActiveFilters
                ? 'border-amber-300/60 bg-amber-500/10 text-amber-700 dark:text-amber-200'
                : 'border-border/70 bg-muted/60 text-muted-foreground',
            )}
          >
            {filterSummaryLabel}
          </span>
          <span className="shrink-0 rounded-full border border-border/70 bg-muted/60 px-2 py-0.5 font-semibold text-muted-foreground">
            {visibleTicketCountLabel}
          </span>
        </p>
        {hasActiveFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 gap-1 rounded-md px-2 text-[11px] font-semibold"
            aria-label="Limpiar filtros de la vista"
            title="Limpiar filtros"
            onClick={resetFilters}
          >
            <X className="h-3.5 w-3.5" />
            <span className={cn(compact && 'sr-only')}>Limpiar</span>
          </Button>
        ) : null}
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
          <div className={cn(compact ? 'space-y-1.5 px-2 py-1.5' : 'space-y-1.5 px-2 py-2')} data-testid="sidebar-ticket-queue">
            <p data-testid="sidebar-queue-summary" className="sr-only">
              Cola priorizada: {queueEntries.length.toLocaleString('es-AR')} en cola;
              {queueUnreadCount.toLocaleString('es-AR')} no leidos;
              {queueRiskCount.toLocaleString('es-AR')} en riesgo;
              {queueUnassignedCount.toLocaleString('es-AR')} sin responsable.
            </p>
            {visibleQueueEntries.map(({ ticket, category }) => (
              <div key={`${category}-${ticket.id}`} className="min-w-0">
                <TicketListItem
                  ticket={ticket}
                  isSelected={selectedTicket?.id === ticket.id}
                  compact
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
            <p data-testid="sidebar-category-summary" className="sr-only">
              Vista por rubro: {visibleCategoryEntries.length.toLocaleString('es-AR')} rubros visibles; vacios ocultos por defecto.
            </p>
            <Accordion
              type="multiple"
              className="w-full"
              value={openCategories}
              onValueChange={setOpenCategories}
            >
              {visibleCategoryEntries.map(([category, tickets]) => (
                <AccordionItem value={category} key={category}>
                  <AccordionTrigger className={cn('px-3 font-semibold', compact ? 'py-2 text-sm' : 'py-2.5')}>
                    {category} ({tickets.length})
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className={cn(compact ? 'space-y-1.5 px-2 pb-1.5' : 'space-y-2 px-2 pb-2')}>
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
                              compact={compact}
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
