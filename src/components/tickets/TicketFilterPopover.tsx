import React from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useTickets } from '@/context/TicketContext';

const FILTER_SELECT_CLASS_NAME =
  'h-8 w-full min-w-0 rounded-md border border-input bg-background px-2 text-xs';
const QUICK_FILTER_BUTTON_CLASS_NAME =
  'h-7 min-w-0 rounded-md px-1.5 text-[11px] font-semibold';

const defaultFilters = {
  channel: 'all',
  status: 'all',
  area: 'all',
  agent: 'all',
  priority: 'all',
  sla: 'all',
  unread: 'all',
};

type TicketFilterKey = keyof typeof defaultFilters;
type SelectOption = { value: string; label: string };
type AgentOption = { id: string; label: string };

interface TicketFilterPopoverProps {
  compact?: boolean;
  hasSearchTerm?: boolean;
  onReset?: () => void;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
  triggerTestId?: string;
  panelTestId?: string;
  className?: string;
}

const resolveFilters = (filters: Partial<typeof defaultFilters> | undefined) => ({
  ...defaultFilters,
  ...(filters ?? {}),
});

const optionList = <T,>(items: T[] | undefined): T[] => (Array.isArray(items) ? items : []);

export const TicketFilterPopover: React.FC<TicketFilterPopoverProps> = ({
  compact = false,
  hasSearchTerm = false,
  onReset,
  align,
  side,
  triggerTestId,
  panelTestId = 'sidebar-filter-panel',
  className,
}) => {
  const { filters, setFilters, filterOptions } = useTickets();
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = React.useState(false);
  const filterPanelId = React.useId();
  const resolvedFilters = React.useMemo(() => resolveFilters(filters), [filters]);

  const secondaryFilterLabels = React.useMemo(
    () =>
      [
        resolvedFilters.channel !== 'all' ? `Canal: ${resolvedFilters.channel}` : null,
        resolvedFilters.status !== 'all' ? `Estado: ${resolvedFilters.status}` : null,
        resolvedFilters.area !== 'all' ? `Area: ${resolvedFilters.area}` : null,
        resolvedFilters.agent !== 'all' ? `Agente: ${resolvedFilters.agent}` : null,
        resolvedFilters.priority !== 'all' ? `Prioridad: ${resolvedFilters.priority}` : null,
        resolvedFilters.sla !== 'all' ? `SLA: ${resolvedFilters.sla}` : null,
        resolvedFilters.unread !== 'all' ? `Lectura: ${resolvedFilters.unread}` : null,
      ].filter(Boolean) as string[],
    [resolvedFilters],
  );
  const secondaryFilterCount = secondaryFilterLabels.length;
  const hasSecondaryFilters = secondaryFilterCount > 0;
  const secondaryFilterCountLabel =
    secondaryFilterCount === 1 ? '1 activo' : `${secondaryFilterCount} activos`;
  const hasActiveFilters = Boolean(hasSearchTerm) || hasSecondaryFilters;
  const secondaryFilterButtonLabel = hasSecondaryFilters
    ? `Filtros secundarios, ${secondaryFilterCountLabel}`
    : 'Filtros secundarios';
  const visibleSecondaryFilterLabels = secondaryFilterLabels.slice(0, 3);
  const hiddenSecondaryFilterCount = Math.max(
    0,
    secondaryFilterLabels.length - visibleSecondaryFilterLabels.length,
  );

  const resetFilters = React.useCallback(() => {
    if (onReset) {
      onReset();
      return;
    }
    setFilters(defaultFilters);
  }, [onReset, setFilters]);

  const patchFilter = React.useCallback(
    (patch: Partial<typeof defaultFilters>) => {
      setFilters((prev) => ({
        ...defaultFilters,
        ...prev,
        ...patch,
      }));
    },
    [setFilters],
  );

  const quickFilterControls = (
    <div
      className="mb-2 grid grid-cols-4 gap-1 rounded-md border border-border/70 bg-muted/50 p-1"
      role="group"
      aria-label="Filtros rapidos de reclamos"
      data-testid={compact ? 'sidebar-compact-primary-filters' : 'sidebar-filter-shortcuts'}
    >
      <Button
        type="button"
        size="sm"
        variant={!hasSearchTerm && !hasSecondaryFilters ? 'secondary' : 'outline'}
        className={QUICK_FILTER_BUTTON_CLASS_NAME}
        aria-pressed={!hasSearchTerm && !hasSecondaryFilters}
        onClick={resetFilters}
      >
        Todos
      </Button>
      <Button
        type="button"
        size="sm"
        variant={resolvedFilters.unread === 'unread' ? 'secondary' : 'outline'}
        className={QUICK_FILTER_BUTTON_CLASS_NAME}
        aria-pressed={resolvedFilters.unread === 'unread'}
        onClick={() => patchFilter({ unread: 'unread' })}
      >
        No leidos
      </Button>
      <Button
        type="button"
        size="sm"
        variant={resolvedFilters.sla === 'risk' ? 'secondary' : 'outline'}
        className={QUICK_FILTER_BUTTON_CLASS_NAME}
        aria-pressed={resolvedFilters.sla === 'risk'}
        onClick={() =>
          patchFilter({
            sla: resolvedFilters.sla === 'risk' ? 'all' : 'risk',
          })
        }
      >
        Riesgo
      </Button>
      <Button
        type="button"
        size="sm"
        variant={resolvedFilters.agent === 'unassigned' ? 'secondary' : 'outline'}
        className={QUICK_FILTER_BUTTON_CLASS_NAME}
        aria-pressed={resolvedFilters.agent === 'unassigned'}
        onClick={() =>
          patchFilter({
            agent: resolvedFilters.agent === 'unassigned' ? 'all' : 'unassigned',
          })
        }
      >
        Sin resp.
      </Button>
    </div>
  );

  const selectValue = (key: TicketFilterKey, value: string) => {
    patchFilter({ [key]: value } as Partial<typeof defaultFilters>);
  };

  return (
    <Popover open={advancedFiltersOpen} onOpenChange={setAdvancedFiltersOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={advancedFiltersOpen || hasSecondaryFilters ? 'secondary' : 'outline'}
          className={cn('h-7 shrink-0 rounded-[8px] px-2.5 text-xs font-semibold', className)}
          aria-label={secondaryFilterButtonLabel}
          aria-expanded={advancedFiltersOpen}
          aria-controls={filterPanelId}
          data-testid={triggerTestId}
        >
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          <span className={cn('hidden sm:inline', compact && 'sr-only')}>Filtros</span>
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
        data-testid={panelTestId}
        aria-label="Filtros secundarios de reclamos"
        align={align ?? (compact ? 'end' : 'start')}
        side={side ?? (compact ? 'bottom' : 'right')}
        sideOffset={8}
        className="w-[min(23rem,calc(100vw-2rem))] rounded-[8px] border-border/80 bg-popover/95 p-3 shadow-2xl backdrop-blur"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-foreground">Filtros secundarios</p>
            <p className="text-[11px] text-muted-foreground">
              {hasSecondaryFilters ? secondaryFilterCountLabel : 'Sin filtros secundarios'}
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
        {quickFilterControls}
        {hasSecondaryFilters ? (
          <div
            aria-label="Filtros activos aplicados"
            data-testid="sidebar-filter-active-chips"
            className="my-2 flex min-w-0 flex-wrap gap-1.5"
          >
            {visibleSecondaryFilterLabels.map((label) => (
              <span
                key={label}
                className="max-w-full truncate rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[11px] font-semibold leading-none text-primary"
              >
                {label}
              </span>
            ))}
            {hiddenSecondaryFilterCount > 0 ? (
              <span className="rounded-full border border-border bg-muted px-2 py-1 text-[11px] font-semibold leading-none text-muted-foreground">
                +{hiddenSecondaryFilterCount}
              </span>
            ) : null}
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
              value={resolvedFilters.channel}
              onChange={(event) => selectValue('channel', event.target.value)}
            >
              <option value="all">Canal: todos</option>
              {optionList<string>(filterOptions?.channels).map((channel) => (
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
              value={resolvedFilters.status}
              onChange={(event) => selectValue('status', event.target.value)}
            >
              <option value="all">Estado: todos</option>
              {optionList<SelectOption>(filterOptions?.statuses).map((status) => (
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
              value={resolvedFilters.area}
              onChange={(event) => selectValue('area', event.target.value)}
            >
              <option value="all">Area: todas</option>
              {optionList<string>(filterOptions?.areas).map((area) => (
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
              value={resolvedFilters.agent}
              onChange={(event) => selectValue('agent', event.target.value)}
            >
              <option value="all">Agente: todos</option>
              {optionList<AgentOption>(filterOptions?.agents).map((agent) => (
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
              value={resolvedFilters.priority}
              onChange={(event) => selectValue('priority', event.target.value)}
            >
              <option value="all">Prioridad: todas</option>
              {optionList<string>(filterOptions?.priorities).map((priority) => (
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
              value={resolvedFilters.sla}
              onChange={(event) => selectValue('sla', event.target.value)}
            >
              <option value="all">SLA: todos</option>
              <option value="risk">SLA: riesgo</option>
              {optionList<string>(filterOptions?.slaStatuses)
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
              value={resolvedFilters.unread}
              onChange={(event) => selectValue('unread', event.target.value)}
            >
              {optionList<SelectOption>(filterOptions?.unreadModes).map((mode) => (
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
};

export default TicketFilterPopover;
