import CuadrillaFieldModal from './CuadrillaFieldModal';
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import Sidebar from './Sidebar';
import TicketFilterPopover from './TicketFilterPopover';
import ConversationPanel from './ConversationPanel';
import DetailsPanel from './DetailsPanel';
import { Toaster } from '@/components/ui/sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { AnimatePresence, motion } from 'framer-motion';
import { useTickets } from '@/context/TicketContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  Info,
  ListChecks,
  LogIn,
  MessageSquare,
  PanelLeft,
  Radio,
  RefreshCw,
  Settings2,
  UserRound,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Ticket } from '@/types/tickets';
import { formatTicketStatusLabel, normalizeTicketStatus } from '@/utils/ticketStatus';
import { getNextOperationalTicket, isUnassignedQueueTicket } from '@/utils/ticketOperationalQueue';
import { useTenant } from '@/context/TenantContext';
import { backofficeService, type BackofficeInboxSummaryResponse } from '@/services/backofficeService';
import { resolveTenantSlug } from '@/utils/api';
import {
  isTicketInboxSourceModel,
  type TicketInboxSourceModel,
} from '@/services/ticketService';

type MobileView = 'tickets' | 'chat' | 'details';
type MobileTransitionDirection = -1 | 0 | 1;

const MOBILE_VIEW_SEQUENCE = ['tickets', 'chat', 'details'] as const;
const getMobileTabId = (view: MobileView) => `tickets-mobile-tab-${view}`;
const getMobilePanelId = (view: MobileView) => `tickets-mobile-panel-${view}`;
const TICKET_LOADING_GRACE_MS = 12000;
const INBOX_SUMMARY_DEFER_MS = 1600;
const DESKTOP_DETAIL_MIN_WIDTH = 1280;
const EMBEDDED_DETAIL_MIN_WIDTH = 1180;
const DESKTOP_TICKET_LIST_COLUMN = 'minmax(340px, 420px)';
const EMBEDDED_TICKET_LIST_COLUMN = 'minmax(300px, 340px)';
const DESKTOP_DETAIL_COLUMN = 'minmax(320px, 380px)';
const EMBEDDED_DETAIL_COLUMN = 'minmax(320px, 360px)';

const shouldShowDesktopDetailsByDefault = (embedded: boolean) =>
  typeof window === 'undefined' ||
  window.innerWidth >= (embedded ? EMBEDDED_DETAIL_MIN_WIDTH : DESKTOP_DETAIL_MIN_WIDTH);

const getDirectionBetweenViews = (
  from: MobileView,
  to: MobileView,
): MobileTransitionDirection => {
  if (from === to) {
    return 0;
  }

  const fromIndex = MOBILE_VIEW_SEQUENCE.indexOf(from);
  const toIndex = MOBILE_VIEW_SEQUENCE.indexOf(to);

  if (fromIndex === -1 || toIndex === -1) {
    return 0;
  }

  return (toIndex > fromIndex ? 1 : -1) as MobileTransitionDirection;
};

const normalizeQueryValue = (value: string | null) => {
  const trimmed = value?.trim();
  return trimmed || null;
};

const normalizeTicketQueryNumber = (value: string | null): number | null => {
  const normalized = normalizeQueryValue(value);
  if (!normalized) return null;
  const parsed = Number(normalized.replace(/^#/, '').replace(/^M-/i, '').replace(/^P-/i, ''));
  return Number.isFinite(parsed) ? parsed : null;
};

const formatDeskDeepLinkFocus = (value: string | null) =>
  value ? value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() : null;

const readTicketDeskQuery = (searchParams: URLSearchParams) => {
  const focus = normalizeQueryValue(searchParams.get('focus') ?? searchParams.get('ui_hint') ?? searchParams.get('source'));
  const rawSourceModel = normalizeQueryValue(
    searchParams.get('source_model') ?? searchParams.get('sourceModel'),
  );
  const sourceModel = isTicketInboxSourceModel(rawSourceModel) ? rawSourceModel : null;
  const ticketId = normalizeTicketQueryNumber(
    searchParams.get('ticket_id') ??
      searchParams.get('ticketId') ??
      searchParams.get('record_id') ??
      searchParams.get('recordId') ??
      searchParams.get('id'),
  );

  return {
    key: searchParams.toString(),
    focus,
    ticketId,
    sourceModel,
    invalidSourceModel: rawSourceModel !== null && sourceModel === null,
    filters: {
      channel: normalizeQueryValue(searchParams.get('canal') ?? searchParams.get('channel')),
      status: normalizeQueryValue(searchParams.get('estado') ?? searchParams.get('status')),
      area: normalizeQueryValue(searchParams.get('area') ?? searchParams.get('categoria') ?? searchParams.get('category')),
      agent: normalizeQueryValue(searchParams.get('agent') ?? searchParams.get('assignee') ?? searchParams.get('assigned_agent')),
      priority: normalizeQueryValue(searchParams.get('priority') ?? searchParams.get('prioridad')),
      sla: normalizeQueryValue(searchParams.get('sla') ?? searchParams.get('sla_status')),
      unread: normalizeQueryValue(searchParams.get('unread') ?? searchParams.get('no_leidos')),
    },
  };
};

const mobileViewVariants = {
  enter: (direction: MobileTransitionDirection) => ({
    opacity: 0,
    x: direction === 0 ? 0 : direction > 0 ? 48 : -48,
  }),
  center: {
    opacity: 1,
    x: 0,
  },
  exit: (direction: MobileTransitionDirection) => ({
    opacity: 0,
    x: direction === 0 ? 0 : direction > 0 ? -48 : 48,
  }),
};

const mobileViewTransition = {
  duration: 0.24,
  ease: 'easeInOut' as const,
};

const hasUnreadTicket = (ticket: Ticket) =>
  Boolean(
    ticket.hasUnreadMessages ||
      ticket.collaboration_state?.has_unread ||
      Number(ticket.collaboration_state?.unread_count || 0) > 0 ||
      Number(ticket.collaboration_state?.unread_viewer_count || 0) > 0,
  );

const isResolvedTicket = (ticket: Ticket) => {
  const status = normalizeTicketStatus(ticket.estado);
  return status === 'resuelto' || String(ticket.estado).toLowerCase() === 'cerrado';
};

const isRiskTicket = (ticket: Ticket) => {
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

const resolveTicketQueueLabel = (ticket: Ticket) =>
  ticket.asunto ||
  ticket.categoria_principal ||
  ticket.categoria ||
  ticket.title ||
  ticket.description ||
  'Sin asunto';

const resolveTicketCrmQueue = (ticket: Ticket | null | undefined) => {
  if (!ticket) return null;
  const explicit = ticket.crm_queue && typeof ticket.crm_queue === 'object' ? ticket.crm_queue : null;
  if (explicit?.label || explicit?.reason || explicit?.state) {
    return {
      state: explicit.state || 'ready',
      score: Number(explicit.score || 0),
      label: explicit.label || 'Atender caso',
      reason: explicit.reason || 'El CRM recomienda revisar este caso.',
      next_team_action: explicit.next_team_action || 'open_ticket',
      badges: Array.isArray(explicit.badges) ? explicit.badges : [],
    };
  }

  const unread = hasUnreadTicket(ticket);
  const risk = isRiskTicket(ticket);
  const unassigned = isUnassignedQueueTicket(ticket);
  const state = unread ? 'customer_waiting' : risk ? 'sla_attention' : unassigned ? 'unassigned' : 'ready';
  return {
    state,
    score: (unread ? 100 : 0) + (risk ? 50 : 0) + (unassigned ? 25 : 0),
    label: unread ? 'Responder ahora' : risk ? 'Revisar SLA' : unassigned ? 'Asignar responsable' : 'Mesa al dia',
    reason: unread
      ? 'Hay actividad ciudadana o de cliente sin lectura completa del equipo.'
      : risk
        ? 'El caso esta vencido, por vencer o marcado como prioridad alta.'
        : unassigned
          ? 'El caso esta abierto y necesita un operador responsable.'
          : 'No hay senales criticas activas para este caso.',
    next_team_action: unread ? 'reply_from_crm' : risk ? 'review_sla_and_update' : unassigned ? 'assign_owner' : 'monitor_ticket',
    badges: [
      unread ? { id: 'unread', label: 'Sin leer', tone: 'live' } : null,
      risk ? { id: 'sla_risk', label: 'SLA riesgo', tone: 'warning' } : null,
      unassigned ? { id: 'unassigned', label: 'Sin responsable', tone: 'warning' } : null,
    ].filter(Boolean) as Array<{ id?: string; label?: string; tone?: string }>,
  };
};

const TicketOpsStat = ({
  label,
  value,
  helper,
  tone,
  icon: Icon,
  onClick,
  compact = false,
}: {
  label: string;
  value: number;
  helper: string;
  tone: 'blue' | 'amber' | 'emerald' | 'violet';
  icon: React.ElementType;
  onClick?: () => void;
  compact?: boolean;
}) => {
  const toneClass = {
    blue: 'border-blue-500/20 bg-blue-500/10 text-blue-500',
    amber: 'border-amber-500/20 bg-amber-500/10 text-amber-500',
    emerald: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500',
    violet: 'border-violet-500/20 bg-violet-500/10 text-violet-500',
  }[tone];

  const Comp = onClick ? 'button' : 'div';

  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'inline-flex min-w-0 shrink-0 items-center rounded-full border border-border/70 bg-background/75 text-left shadow-sm',
        compact ? 'gap-1.5 px-2 py-1' : 'gap-2 px-2.5 py-1.5',
        onClick && 'transition hover:border-primary/50 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
      )}
    >
      <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full border', compact ? 'h-6 w-6' : 'h-7 w-7', toneClass)}>
        <Icon className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      </span>
      <span className="min-w-0">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className={cn('font-bold tabular-nums tracking-tight text-foreground', compact ? 'text-[13px]' : 'text-sm')}>
            {value.toLocaleString('es-AR')}
          </span>
          <span className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {label}
          </span>
        </span>
        <span className={cn('max-w-[9.5rem] truncate text-[11px] leading-4 text-muted-foreground', compact ? 'sr-only' : 'block')}>
          {helper}
        </span>
      </span>
    </Comp>
  );
};

const TicketPanelState = ({
  testId,
  title,
  description,
  icon: Icon,
  tone = 'default',
  role = 'status',
  children,
}: {
  testId: string;
  title: string;
  description: string;
  icon: React.ElementType;
  tone?: 'default' | 'warning' | 'destructive';
  role?: 'status' | 'alert';
  children?: React.ReactNode;
}) => {
  const toneClass = {
    default: 'border-primary/25 bg-primary/10 text-primary',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300',
    destructive: 'border-destructive/30 bg-destructive/10 text-destructive',
  }[tone];

  return (
    <Card
      data-testid={testId}
      className="w-full border border-border/70 bg-card/95 p-4 shadow-sm"
      role={role}
      aria-live="polite"
      aria-label={title}
    >
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border', toneClass)}>
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground sm:text-base">{title}</h2>
            <p className={cn('mt-1 max-w-2xl text-sm leading-5', tone === 'destructive' ? 'text-destructive' : 'text-muted-foreground')}>
              {description}
            </p>
          </div>
        </div>
        {children ? <div className="min-w-0 shrink-0 sm:max-w-[60%]">{children}</div> : null}
      </div>
    </Card>
  );
};

const TicketWorkspaceColumnHeader = ({
  id,
  step,
  title,
  description,
}: {
  id: string;
  step: number;
  title: string;
  description: string;
}) => (
  <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border/70 bg-muted/35 px-3">
    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
      {step}
    </span>
    <div className="min-w-0">
      <h3 id={id} className="truncate text-xs font-semibold text-foreground">
        {title}
      </h3>
      <p className="sr-only">{description}</p>
    </div>
  </div>
);

interface NewTicketsPanelProps {
  embedded?: boolean;
}

const NewTicketsPanel: React.FC<NewTicketsPanelProps> = ({ embedded = false }) => {
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();
  const {
    loading,
    error,
    errorDetails,
    tickets,
    filteredTickets,
    selectedTicket,
    selectTicket,
    ticketTargetResolution,
    resolveTicketTarget,
    clearTicketTarget,
    filters,
    setFilters,
    refreshTickets,
    realtimeActivity,
    clearRealtimeActivity,
  } = useTickets();
  const { currentSlug, tenant } = useTenant();
  const [inboxSummary, setInboxSummary] = React.useState<BackofficeInboxSummaryResponse | null>(null);
  const [loadingTimedOut, setLoadingTimedOut] = React.useState(false);

  // Mobile-specific state
  const [mobileView, setMobileViewState] = React.useState<MobileView>('tickets');
  const mobileViewRef = React.useRef<MobileView>('tickets');
  const mobileTabRefs = React.useRef<Record<MobileView, HTMLButtonElement | null>>({
    tickets: null,
    chat: null,
    details: null,
  });
  const [mobileTransitionDirection, setMobileTransitionDirection] =
    React.useState<MobileTransitionDirection>(0);
  const setActiveMobileView = React.useCallback(
    (nextView: MobileView) => {
      const nextDirection = getDirectionBetweenViews(mobileViewRef.current, nextView);
      setMobileTransitionDirection(nextDirection);

      if (mobileViewRef.current === nextView) {
        return;
      }

      mobileViewRef.current = nextView;
      setMobileViewState(nextView);
    },
    [setMobileViewState],
  );

  // Desktop-specific state
  const [isSidebarVisible, setIsSidebarVisible] = React.useState(!isMobile);
  const [isDetailsVisible, setIsDetailsVisible] = React.useState(
    () => !isMobile && shouldShowDesktopDetailsByDefault(embedded),
  );
  const [desktopView, setDesktopView] = React.useState<'chat' | 'details'>('chat');
  const [deepLinkFocus, setDeepLinkFocus] = React.useState<string | null>(null);

  const lastMobileTicketId = React.useRef<string | number | null>(null);
  const appliedDeskQueryKeyRef = React.useRef<string>('');
  const selectedDeskQueryTicketRef = React.useRef<string>('');

  React.useEffect(() => {
    mobileViewRef.current = mobileView;
  }, [mobileView]);

  React.useEffect(() => {
    if (isMobile) {
      setIsSidebarVisible(false);
      setIsDetailsVisible(false);
      return;
    }

    setIsSidebarVisible(true);
    setIsDetailsVisible(shouldShowDesktopDetailsByDefault(embedded));
  }, [embedded, isMobile]);

  React.useEffect(() => {
    if (!loading) {
      setLoadingTimedOut(false);
      return;
    }

    const timer = window.setTimeout(() => setLoadingTimedOut(true), TICKET_LOADING_GRACE_MS);
    return () => window.clearTimeout(timer);
  }, [loading]);

  React.useEffect(() => {
    let cancelled = false;
    const tenantSlug = resolveTenantSlug(currentSlug || tenant?.slug, undefined, { persist: false });
    if (!tenantSlug || tenantSlug === 'default') {
      setInboxSummary(null);
      return;
    }
    if (loading) {
      return;
    }

    const scope = tenant?.tipo === 'municipio' || tenant?.tipo === 'colegio' ? tenant.tipo : 'pyme';
    const timer = window.setTimeout(() => {
      backofficeService
        .getInboxSummary({ tenantSlug, scope })
        .then((response) => {
          if (!cancelled) setInboxSummary(response);
        })
        .catch(() => {
          if (!cancelled) setInboxSummary(null);
        });
    }, INBOX_SUMMARY_DEFER_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [currentSlug, loading, tenant?.slug, tenant?.tipo]);

  // Sync mobile view with ticket selection
  React.useEffect(() => {
    if (!isMobile) {
      return;
    }

    if (!selectedTicket) {
      lastMobileTicketId.current = null;
      setActiveMobileView('tickets');
      return;
    }

    const currentTicketId = selectedTicket.id;

    if (lastMobileTicketId.current === null) {
      lastMobileTicketId.current = currentTicketId;
      return;
    }

    if (currentTicketId !== lastMobileTicketId.current) {
      lastMobileTicketId.current = currentTicketId;
      setActiveMobileView('chat');
    }
  }, [selectedTicket, isMobile, setActiveMobileView]);

  const handleMobileTicketSelection = React.useCallback(() => {
    if (isMobile) {
      setActiveMobileView('chat');
    }
  }, [isMobile, setActiveMobileView]);

  const applyQuickFilter = React.useCallback(
    (nextFilters: Partial<typeof filters>) => {
      setFilters((current) => ({
        ...current,
        ...nextFilters,
      }));
    },
    [setFilters],
  );

  const applyRecommendedView = React.useCallback(
    (query?: Record<string, unknown>) => {
      if (!query) return;
      const nextFilters: Partial<typeof filters> = {};
      const channel = query.channel ?? query.canal;
      const status = query.status ?? query.estado;
      const area = query.area ?? query.category ?? query.categoria;
      const assigned = query.assigned ?? query.responsable;
      let agent = query.agent ?? query.assignee ?? query.assigned_agent;
      const priority = query.priority ?? query.prioridad;
      const sla = query.sla ?? query.sla_status;
      const unread = query.unread ?? query.no_leidos;

      if (
        (agent === undefined || agent === null || agent === '') &&
        assigned !== undefined &&
        ['none', 'unassigned', 'sin_responsable'].includes(String(assigned).trim().toLowerCase())
      ) {
        agent = 'unassigned';
      }

      if (channel !== undefined) nextFilters.channel = String(channel);
      if (status !== undefined) nextFilters.status = String(status);
      if (area !== undefined) nextFilters.area = String(area);
      if (agent !== undefined) nextFilters.agent = String(agent);
      if (priority !== undefined) nextFilters.priority = String(priority);
      if (sla !== undefined) nextFilters.sla = String(sla);
      if (unread !== undefined) nextFilters.unread = unread === true || unread === 'true' ? 'unread' : String(unread);

      if (Object.keys(nextFilters).length > 0) {
        applyQuickFilter(nextFilters);
      }
    },
    [applyQuickFilter],
  );

  const ticketDeskQuery = React.useMemo(() => readTicketDeskQuery(searchParams), [searchParams]);
  const resolveDeskTicketTarget = React.useCallback((
    ticketId: number,
    sourceModel: TicketInboxSourceModel | null,
  ) => sourceModel
    ? resolveTicketTarget(ticketId, sourceModel)
    : resolveTicketTarget(ticketId), [resolveTicketTarget]);

  React.useEffect(() => {
    if (!ticketDeskQuery.key || appliedDeskQueryKeyRef.current === ticketDeskQuery.key) return;

    const nextFilters = Object.entries(ticketDeskQuery.filters).reduce<Partial<typeof filters>>((acc, [key, value]) => {
      if (typeof value !== 'string' || !value) return acc;
      if (key === 'unread') {
        acc.unread = ['true', '1', 'yes', 'si'].includes(value.toLowerCase()) ? 'unread' : value;
        return acc;
      }
      acc[key as keyof typeof filters] = value;
      return acc;
    }, {});

    if (ticketDeskQuery.focus === 'open_geocoding_queue' && !nextFilters.sla) {
      nextFilters.sla = 'risk';
    }

    if (Object.keys(nextFilters).length > 0) {
      setFilters((current) => {
        const changed = Object.entries(nextFilters).some(([key, value]) => current[key as keyof typeof current] !== value);
        return changed ? { ...current, ...nextFilters } : current;
      });
    }

    setDeepLinkFocus(ticketDeskQuery.focus);
    appliedDeskQueryKeyRef.current = ticketDeskQuery.key;
  }, [setFilters, ticketDeskQuery, filters]);

  React.useEffect(() => {
    if (!ticketDeskQuery.ticketId) {
      selectedDeskQueryTicketRef.current = '';
      clearTicketTarget();
      return;
    }

    if (ticketDeskQuery.invalidSourceModel) {
      selectedDeskQueryTicketRef.current = '';
      clearTicketTarget();
      return;
    }

    const querySelectionKey = `${ticketDeskQuery.key}:${ticketDeskQuery.ticketId}:${ticketDeskQuery.sourceModel ?? 'legacy'}`;
    if (selectedDeskQueryTicketRef.current === querySelectionKey) return;
    selectedDeskQueryTicketRef.current = querySelectionKey;
    void resolveDeskTicketTarget(ticketDeskQuery.ticketId, ticketDeskQuery.sourceModel).then((ticket) => {
      if (!ticket) return;
      if (isMobile) setActiveMobileView('chat');
      else setDesktopView('chat');
    });
  }, [clearTicketTarget, isMobile, resolveDeskTicketTarget, setActiveMobileView, ticketDeskQuery]);

  React.useEffect(
    () => () => {
      selectedDeskQueryTicketRef.current = '';
      clearTicketTarget();
    },
    [clearTicketTarget],
  );

  const resetOperationalFilters = React.useCallback(() => {
    setFilters((current) => ({
      ...current,
      channel: 'all',
      status: 'all',
      area: 'all',
      agent: 'all',
      priority: 'all',
      sla: 'all',
      unread: 'all',
    }));
  }, [setFilters]);

  const mobileNavButtonClass = (
    value: 'tickets' | 'chat' | 'details',
    disabled?: boolean,
  ) =>
    cn(
      'flex h-11 items-center justify-center gap-1.5 rounded-[8px] border px-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none',
      mobileView === value
        ? 'border-primary bg-primary text-primary-foreground shadow-sm'
        : 'border-border/70 bg-muted/60 text-muted-foreground hover:border-primary/40 hover:text-foreground',
      disabled && 'hover:border-border/70 hover:text-muted-foreground',
    );

  const handleMobileTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentView: MobileView,
  ) => {
    const availableViews: readonly MobileView[] = selectedTicket
      ? MOBILE_VIEW_SEQUENCE
      : ['tickets'];
    const currentIndex = availableViews.indexOf(currentView);
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % availableViews.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + availableViews.length) % availableViews.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = availableViews.length - 1;
    }

    if (nextIndex === null) return;

    event.preventDefault();
    const nextView = availableViews[nextIndex];
    setActiveMobileView(nextView);
    window.requestAnimationFrame(() => mobileTabRefs.current[nextView]?.focus());
  };

  const hasLoadedInboxData = tickets.length > 0 || filteredTickets.length > 0 || selectedTicket !== null;
  const showInitialLoading = loading && !hasLoadedInboxData;

  if (showInitialLoading && loadingTimedOut) {
    return (
      <TicketPanelState
        testId="tickets-loading-timeout-state"
        title="La bandeja tarda más de lo esperado"
        description="Todavia no recibimos la cola completa. Podes reintentar sin salir del centro de reclamos."
        icon={AlertTriangle}
        tone="warning"
      >
        <Button type="button" size="sm" className="gap-2" onClick={() => void refreshTickets()}>
          <RefreshCw className="h-4 w-4" />
          Reintentar carga
        </Button>
      </TicketPanelState>
    );
  }

  if (showInitialLoading) {
    return (
      <TicketPanelState
        testId="tickets-loading-state"
        title="Preparando el centro de reclamos"
        description="Ordenando la cola y recuperando las conversaciones disponibles."
        icon={RefreshCw}
      >
        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => void refreshTickets()}>
          <RefreshCw className="h-4 w-4 animate-spin" />
          Reintentar
        </Button>
      </TicketPanelState>
    );
  }

  if (error) {
    const isSessionError = /sesión|sesion|iniciá sesión|inicia sesión/i.test(error);
    const isTicketScopeError =
      errorDetails?.actionHint === 'repair_ticket_scope' ||
      Boolean(errorDetails?.reasonCode?.startsWith('missing_'));
    const currentScope = errorDetails?.currentScope ?? {};
    const scopeSummary = [
      ['tenant', currentScope.tenant_slug || currentScope.tenant_id],
      ['tipo', currentScope.tenant_tipo || currentScope.tipo_chat],
      ['municipio', currentScope.tenant_municipio_id || currentScope.municipio_id || currentScope.empresa_id],
      ['empresa', currentScope.tenant_pyme_id || currentScope.pyme_id || currentScope.rubro_id],
      ['rol', currentScope.canonical_role || currentScope.role],
    ].filter(([, value]) => value !== undefined && value !== null && String(value).trim().length > 0);
    const copyRequestId = async () => {
      if (!errorDetails?.requestId) return;
      await navigator.clipboard?.writeText(errorDetails.requestId);
    };
    const goToLogin = () => {
      if (typeof window === 'undefined') return;
      const next = `${window.location.pathname}${window.location.search}`;
      window.location.href = `/login?next=${encodeURIComponent(next)}`;
    };

    return (
      <TicketPanelState
        testId="tickets-error-state"
        title="No pudimos cargar la bandeja"
        description={error}
        icon={AlertTriangle}
        tone="destructive"
        role="alert"
      >
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {isSessionError ? (
              <Button type="button" size="sm" className="gap-2" onClick={goToLogin}>
                <LogIn className="h-4 w-4" />
                Iniciar sesión
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => void refreshTickets()}>
              <RefreshCw className="h-4 w-4" />
              Reintentar
            </Button>
          </div>
          {isTicketScopeError ? (
            <details
              data-testid="tickets-access-contract"
              className="w-full rounded-lg border border-amber-500/30 bg-amber-500/10 text-left"
            >
              <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-amber-800 outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:text-amber-200">
                Revisar datos de acceso
              </summary>
              <div className="border-t border-amber-500/20 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-amber-500/40 bg-background/70 text-amber-700 dark:text-amber-200">
                    Reparar acceso
                  </Badge>
                  {errorDetails?.reasonCode ? (
                    <Badge variant="secondary" className="font-mono text-[11px]">
                      {errorDetails.reasonCode}
                    </Badge>
                  ) : null}
                  {errorDetails?.requestId ? (
                    <button
                      type="button"
                      onClick={() => void copyRequestId()}
                      className="inline-flex min-h-7 items-center rounded-full border border-border bg-background/80 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      request_id: {errorDetails.requestId}
                    </button>
                  ) : null}
                </div>
                <p className="mt-3 text-xs leading-5 text-foreground">
                  El usuario debe estar vinculado al tenant correcto y a un municipio o empresa antes de operar reclamos.
                </p>
                {scopeSummary.length ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {scopeSummary.map(([label, value]) => (
                      <div key={label} className="rounded-lg border border-border/70 bg-background/75 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
                        <p className="mt-1 truncate text-xs font-medium text-foreground">{String(value)}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
                {errorDetails?.requiredCapabilities?.length ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {errorDetails.requiredCapabilities.slice(0, 4).map((capability) => (
                      <Badge key={capability} variant="secondary" className="font-mono text-[10px]">
                        {capability}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            </details>
          ) : null}
        </div>
      </TicketPanelState>
    );
  }

  const requestedTicketId = ticketDeskQuery.ticketId;
  const requestedSourceModel = ticketDeskQuery.sourceModel;
  const hasInvalidRequestedSource = ticketDeskQuery.invalidSourceModel;
  const targetResolutionMatches =
    requestedTicketId !== null &&
    ticketTargetResolution.ticketId === requestedTicketId &&
    (ticketTargetResolution.sourceModel ?? null) === requestedSourceModel;
  const requestedTicketResolved =
    !hasInvalidRequestedSource &&
    targetResolutionMatches &&
    ticketTargetResolution.status === 'resolved';
  const blockRequestedTicket =
    requestedTicketId !== null && (hasInvalidRequestedSource || !requestedTicketResolved);

  if (blockRequestedTicket) {
    const isResolving =
      !hasInvalidRequestedSource && (
        !targetResolutionMatches ||
        ticketTargetResolution.status === 'idle' ||
        ticketTargetResolution.status === 'resolving'
      );
    const isForbidden = targetResolutionMatches && ticketTargetResolution.status === 'forbidden';
    const title = hasInvalidRequestedSource
      ? 'El enlace del caso no es valido'
      : isResolving
        ? `Abriendo reclamo #${requestedTicketId}`
        : isForbidden
          ? 'No tenes acceso a este reclamo'
          : ticketTargetResolution.status === 'not_found'
            ? 'No encontramos el reclamo solicitado'
            : 'No pudimos abrir el reclamo solicitado';
    const message = hasInvalidRequestedSource
      ? 'El origen indicado no pertenece al contrato de tickets. Volve a abrir el caso desde la bandeja operativa.'
      : isResolving
        ? 'Estamos verificando el reclamo exacto y tu alcance operativo antes de habilitar la conversación.'
        : ticketTargetResolution.message || 'Reintenta en unos segundos.';

    return (
      <TicketPanelState
        testId="tickets-target-resolution"
        title={title}
        description={message}
        icon={isResolving ? RefreshCw : AlertTriangle}
        tone={isResolving ? 'default' : 'warning'}
        role={isResolving ? 'status' : 'alert'}
      >
        {!isResolving && !hasInvalidRequestedSource ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => void resolveDeskTicketTarget(requestedTicketId, requestedSourceModel)}
          >
            <RefreshCw className="h-4 w-4" />
            Reintentar apertura
          </Button>
        ) : null}
      </TicketPanelState>
    );
  }

  const panelCardClass = cn(
    'relative flex h-full max-h-full min-h-0 w-full flex-1 flex-col overflow-hidden border border-border/70 bg-card/90 backdrop-blur-md',
    embedded ? 'rounded-none border-x-0 border-b-0 bg-transparent shadow-none' : 'rounded-lg shadow-2xl',
    isMobile && !embedded && 'h-[calc(100dvh-8rem)]',
  );

  const localOpenTickets = tickets.filter((ticket) => !isResolvedTicket(ticket)).length;
  const localUnreadTickets = tickets.filter(hasUnreadTicket).length;
  const localRiskTickets = tickets.filter(isRiskTicket).length;
  const localResolvedTickets = tickets.length - localOpenTickets;
  const summary = inboxSummary?.summary;
  const openTickets = typeof summary?.open === 'number' ? summary.open : localOpenTickets;
  const unreadTickets = typeof summary?.unread === 'number' ? summary.unread : localUnreadTickets;
  const riskTickets = typeof summary?.sla_risk === 'number' ? summary.sla_risk : localRiskTickets;
  const resolvedTickets = typeof summary?.resolved === 'number' ? summary.resolved : localResolvedTickets;
  const recommendedViews = Array.isArray(inboxSummary?.recommended_views) ? inboxSummary.recommended_views : [];
  const unreadFilter = filters.unread ?? 'all';
  const statusFilter = filters.status ?? 'all';
  const channelFilter = filters.channel ?? 'all';
  const areaFilter = filters.area ?? 'all';
  const agentFilter = filters.agent ?? 'all';
  const slaFilter = filters.sla ?? 'all';
  const priorityFilter = filters.priority ?? 'all';
  const operationalFilterBadges = [
    channelFilter !== 'all' ? `Canal: ${channelFilter}` : null,
    unreadFilter !== 'all' ? `Lectura: ${unreadFilter}` : null,
    statusFilter !== 'all' ? `Estado: ${formatTicketStatusLabel(statusFilter)}` : null,
    areaFilter !== 'all' ? `Area: ${areaFilter}` : null,
    agentFilter !== 'all' ? `Agente: ${agentFilter}` : null,
    slaFilter !== 'all' ? `SLA: ${slaFilter}` : null,
    priorityFilter !== 'all' ? `Prioridad: ${priorityFilter}` : null,
  ].filter(Boolean) as string[];
  const compactFilterSummaryLabel =
    operationalFilterBadges.length === 0
      ? 'Sin filtros'
      : operationalFilterBadges.length === 1
        ? operationalFilterBadges[0]
        : `${operationalFilterBadges[0]} +${operationalFilterBadges.length - 1}`;
  const desktopGridTemplate = isSidebarVisible && isDetailsVisible
    ? embedded
      ? `${EMBEDDED_TICKET_LIST_COLUMN} minmax(0, 1fr) ${EMBEDDED_DETAIL_COLUMN}`
      : `${DESKTOP_TICKET_LIST_COLUMN} minmax(0, 1fr) ${DESKTOP_DETAIL_COLUMN}`
    : isSidebarVisible
      ? embedded
        ? `${EMBEDDED_TICKET_LIST_COLUMN} minmax(0, 1fr)`
        : `${DESKTOP_TICKET_LIST_COLUMN} minmax(0, 1fr)`
      : isDetailsVisible
        ? `minmax(0, 1fr) ${DESKTOP_DETAIL_COLUMN}`
        : 'minmax(0, 1fr)';
  const nextPriorityTicket = getNextOperationalTicket(filteredTickets);
  const isNextPrioritySelected = Boolean(
    nextPriorityTicket && selectedTicket && String(nextPriorityTicket.id) === String(selectedTicket.id),
  );
  const nextPriorityLabel = nextPriorityTicket ? resolveTicketQueueLabel(nextPriorityTicket) : '';
  const nextPriorityCrmQueue = resolveTicketCrmQueue(nextPriorityTicket);
  const primaryOperationalActionLabel =
    nextPriorityTicket && !isNextPrioritySelected
      ? 'Atender prioridad'
      : selectedTicket
        ? 'Responder'
        : 'Actualizar cola';
  const handlePrimaryOperationalAction = () => {
    if (nextPriorityTicket && !isNextPrioritySelected) {
      selectTicket(nextPriorityTicket.id);
      if (isMobile) setActiveMobileView('chat');
      return;
    }
    if (!selectedTicket) {
      void refreshTickets();
      return;
    }
    setDesktopView('chat');
    if (isMobile) setActiveMobileView('chat');
  };

  return (
    <Card className={panelCardClass}>
      <div
        data-testid={embedded ? 'tickets-embedded-ops-header' : 'tickets-ops-header'}
        className={cn(
          'shrink-0 border-b border-border/70 bg-gradient-to-r from-background/95 via-primary/5 to-background/95',
          embedded ? 'px-2 py-0 sm:px-3 sm:py-1' : 'px-3 py-2 sm:px-4',
        )}
      >
        <div className="flex min-h-12 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <ListChecks className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold tracking-tight text-foreground sm:text-base">
                {tenant?.tipo === 'municipio' ? 'Centro de reclamos' : 'Centro de tickets'}
              </h2>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">
                Priorizá la cola, conversá y resolvé sin perder contexto.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {realtimeActivity.pending > 0 ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => {
                  clearRealtimeActivity();
                  void refreshTickets();
                }}
                title={realtimeActivity.lastLabel || 'Revisar novedades'}
              >
                {realtimeActivity.pending.toLocaleString('es-AR')} novedades
              </Button>
            ) : null}
            <Button
              data-testid="tickets-primary-operational-action"
              type="button"
              size="sm"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={handlePrimaryOperationalAction}
              aria-label={
                nextPriorityTicket && !isNextPrioritySelected
                  ? `Atender prioridad: ${nextPriorityCrmQueue?.label || nextPriorityLabel}. ${nextPriorityLabel}`
                  : primaryOperationalActionLabel
              }
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{primaryOperationalActionLabel}</span>
              <span className="sm:hidden">
                {nextPriorityTicket && !isNextPrioritySelected
                  ? 'Prioridad'
                  : selectedTicket
                    ? 'Responder'
                    : 'Actualizar'}
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => void refreshTickets()}
              aria-label="Recargar datos de la cola"
              title="Recargar datos de la cola"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  data-testid="tickets-workspace-tools-trigger"
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 px-2.5 text-xs"
                  aria-label={
                    operationalFilterBadges.length
                      ? `Más opciones, ${operationalFilterBadges.length} filtros activos`
                      : 'Más opciones'
                  }
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Más opciones</span>
                  {operationalFilterBadges.length ? (
                    <span className="rounded-full bg-primary/15 px-1.5 text-[10px] font-bold text-primary">
                      {operationalFilterBadges.length}
                    </span>
                  ) : null}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                data-testid="tickets-workspace-tools-panel"
                aria-label="Opciones secundarias del centro de reclamos"
                align="end"
                sideOffset={8}
                className="max-h-[min(75vh,42rem)] w-[min(94vw,38rem)] overflow-y-auto rounded-lg border-border/80 p-0 shadow-2xl"
              >
                <div className="border-b border-border/70 px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">Opciones de la mesa</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Indicadores, filtros y herramientas secundarias.
                  </p>
                </div>

                <section className="space-y-2 border-b border-border/70 p-3" aria-labelledby="ticket-queue-indicators-title">
                  <div className="flex items-center justify-between gap-2">
                    <p id="ticket-queue-indicators-title" className="text-xs font-semibold text-foreground">
                      Indicadores de cola
                    </p>
                    {typeof summary?.unassigned === 'number' ? (
                      <Badge variant={summary.unassigned > 0 ? 'secondary' : 'outline'} className="gap-1 text-[10px]">
                        <UserRound className="h-3 w-3" />
                        {summary.unassigned} sin responsable
                      </Badge>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    <TicketOpsStat
                      label="Abiertos"
                      value={openTickets}
                      helper="Casos por resolver"
                      tone="blue"
                      icon={Clock}
                      onClick={() => applyQuickFilter({ status: 'all', unread: 'all', sla: 'all' })}
                      compact
                    />
                    <TicketOpsStat
                      label="Riesgo"
                      value={riskTickets}
                      helper="SLA o prioridad alta"
                      tone="amber"
                      icon={AlertTriangle}
                      onClick={() => applyQuickFilter({ sla: 'risk', priority: 'all' })}
                      compact
                    />
                    <TicketOpsStat
                      label="No leídos"
                      value={unreadTickets}
                      helper="Requieren respuesta"
                      tone="violet"
                      icon={Radio}
                      onClick={() => applyQuickFilter({ unread: 'unread' })}
                      compact
                    />
                    <TicketOpsStat
                      label="Resueltos"
                      value={resolvedTickets}
                      helper="Cerrados o resueltos"
                      tone="emerald"
                      icon={CheckCircle2}
                      onClick={() => applyQuickFilter({ status: 'resuelto' })}
                      compact
                    />
                  </div>
                </section>

                <section className="space-y-2 border-b border-border/70 p-3" aria-labelledby="ticket-queue-filters-title">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p id="ticket-queue-filters-title" className="text-xs font-semibold text-foreground">
                        Vista de la cola
                      </p>
                      <p
                        data-testid={embedded ? 'tickets-embedded-active-filters' : 'tickets-desk-active-filters'}
                        className="truncate text-[11px] text-muted-foreground"
                        title={operationalFilterBadges.join(' | ') || 'Sin filtros'}
                        aria-label={
                          operationalFilterBadges.length
                            ? `Filtros activos: ${operationalFilterBadges.join(', ')}`
                            : 'Sin filtros activos'
                        }
                      >
                        {compactFilterSummaryLabel}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <TicketFilterPopover
                        compact
                        align="end"
                        side="bottom"
                        onReset={resetOperationalFilters}
                        triggerTestId={embedded ? 'tickets-header-filter-button' : 'tickets-desk-filter-button'}
                        panelTestId={embedded ? 'tickets-header-filter-panel' : 'tickets-desk-filter-panel'}
                        className="h-8"
                      />
                      {operationalFilterBadges.length ? (
                        <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={resetOperationalFilters}>
                          <Filter className="mr-1 h-3.5 w-3.5" />
                          Limpiar
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {recommendedViews.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {recommendedViews.slice(0, 3).map((view, index) => (
                        <Button
                          key={view.id || `recommended_${index}`}
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-7 max-w-full px-2 text-[11px]"
                          title={view.description || view.label}
                          onClick={() => applyRecommendedView(view.query)}
                        >
                          <span className="truncate">{view.label}</span>
                        </Button>
                      ))}
                    </div>
                  ) : null}
                  {deepLinkFocus ? (
                    <Badge data-testid="tickets-deeplink-focus" variant="outline" className="max-w-full capitalize text-[10px]">
                      Vista solicitada: {formatDeskDeepLinkFocus(deepLinkFocus)}
                    </Badge>
                  ) : null}
                </section>

                <section className="space-y-2 p-3" aria-labelledby="ticket-secondary-actions-title">
                  <p id="ticket-secondary-actions-title" className="text-xs font-semibold text-foreground">
                    Herramientas secundarias
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <CuadrillaFieldModal
                      triggerButton={(
                        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                          <UserRound className="h-3.5 w-3.5" />
                          Operación de cuadrillas
                        </Button>
                      )}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => {
                        clearRealtimeActivity();
                        void refreshTickets();
                      }}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Sincronizar ahora
                    </Button>
                  </div>
                </section>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>
      {isMobile ? (
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden" data-testid="tickets-mobile-layout">
          <div className="shrink-0 border-b border-border/70 bg-card/80 px-2 py-1.5 shadow-sm">
            <div
              className="grid grid-cols-3 gap-1.5"
              role="tablist"
              aria-label="Vistas de tickets"
              aria-orientation="horizontal"
            >
              <button
                ref={(node) => { mobileTabRefs.current.tickets = node; }}
                type="button"
                role="tab"
                id={getMobileTabId('tickets')}
                onClick={() => setActiveMobileView('tickets')}
                onKeyDown={(event) => handleMobileTabKeyDown(event, 'tickets')}
                className={mobileNavButtonClass('tickets')}
                aria-selected={mobileView === 'tickets'}
                aria-controls={getMobilePanelId('tickets')}
                tabIndex={mobileView === 'tickets' ? 0 : -1}
              >
                <PanelLeft className="h-4 w-4" />
                <span>Tickets</span>
              </button>
              <button
                ref={(node) => { mobileTabRefs.current.chat = node; }}
                type="button"
                role="tab"
                id={getMobileTabId('chat')}
                onClick={() => setActiveMobileView('chat')}
                onKeyDown={(event) => handleMobileTabKeyDown(event, 'chat')}
                className={mobileNavButtonClass('chat', !selectedTicket)}
                aria-selected={mobileView === 'chat'}
                aria-controls={getMobilePanelId('chat')}
                tabIndex={mobileView === 'chat' ? 0 : -1}
                disabled={!selectedTicket}
              >
                <MessageSquare className="h-4 w-4" />
                <span>Chat</span>
              </button>
              <button
                ref={(node) => { mobileTabRefs.current.details = node; }}
                type="button"
                role="tab"
                id={getMobileTabId('details')}
                onClick={() => setActiveMobileView('details')}
                onKeyDown={(event) => handleMobileTabKeyDown(event, 'details')}
                className={mobileNavButtonClass('details', !selectedTicket)}
                aria-selected={mobileView === 'details'}
                aria-controls={getMobilePanelId('details')}
                tabIndex={mobileView === 'details' ? 0 : -1}
                disabled={!selectedTicket}
              >
                <Info className="h-4 w-4" />
                <span>Info</span>
              </button>
            </div>
          </div>
          <div className="relative min-h-0 flex-1 overflow-hidden" data-testid="tickets-mobile-viewport">
            <AnimatePresence
              initial={false}
              custom={mobileTransitionDirection}
              mode="sync"
            >
              {mobileView === 'tickets' && (
                <motion.div
                  key="tickets"
                  variants={mobileViewVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  custom={mobileTransitionDirection}
                  transition={mobileViewTransition}
                  className="absolute inset-0 flex h-full min-h-0 min-w-0 overflow-hidden"
                  role="tabpanel"
                  id={getMobilePanelId('tickets')}
                  aria-labelledby={getMobileTabId('tickets')}
                  tabIndex={0}
                >
                  <Sidebar
                    compact={embedded}
                    showFilterControl={!embedded}
                    showListSummaryBar={false}
                    className="h-full min-h-0 w-full min-w-full"
                    onTicketSelected={handleMobileTicketSelection}
                  />
                </motion.div>
              )}
              {mobileView === 'chat' && (
                <motion.div
                  key="chat"
                  variants={mobileViewVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  custom={mobileTransitionDirection}
                  transition={mobileViewTransition}
                  className="absolute inset-0 flex h-full min-h-0 min-w-0 overflow-hidden"
                  role="tabpanel"
                  id={getMobilePanelId('chat')}
                  aria-labelledby={getMobileTabId('chat')}
                  tabIndex={0}
                >
                  <ConversationPanel
                    isMobile={true}
                    isSidebarVisible={false}
                    isDetailsVisible={false}
                    onToggleSidebar={() => setActiveMobileView('tickets')}
                    onToggleDetails={() => setActiveMobileView('details')}
                    canToggleSidebar
                    showDetailsToggle
                  />
                </motion.div>
              )}
              {mobileView === 'details' && (
                <motion.div
                  key="details"
                  variants={mobileViewVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  custom={mobileTransitionDirection}
                  transition={mobileViewTransition}
                  className="absolute inset-0 flex h-full min-h-0 min-w-0 overflow-hidden"
                  role="tabpanel"
                  id={getMobilePanelId('details')}
                  aria-labelledby={getMobileTabId('details')}
                  tabIndex={0}
                >
                  <DetailsPanel onClose={() => setActiveMobileView('chat')} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      ) : (
        <div
          data-testid="tickets-desktop-grid"
          className="grid h-full min-h-0 w-full flex-1 overflow-hidden"
          style={{ gridTemplateColumns: desktopGridTemplate }}
        >
          {isSidebarVisible && (
            <section
              className="flex min-h-0 min-w-0 flex-col overflow-hidden border-r border-border/70"
              data-testid="tickets-list-region"
              aria-labelledby="tickets-queue-column-title"
            >
              <TicketWorkspaceColumnHeader
                id="tickets-queue-column-title"
                step={1}
                title="Cola priorizada"
                description="Casos ordenados por urgencia y actividad pendiente."
              />
              <Sidebar
                compact={embedded}
                showFilterControl={isMobile && !embedded}
                showListSummaryBar={false}
                showQueueMetrics={false}
                className="min-h-0 flex-1 border-r-0"
              />
            </section>
          )}

          <section
            className="flex min-h-0 min-w-0 flex-col overflow-hidden"
            data-testid="tickets-conversation-region"
            aria-labelledby="tickets-conversation-column-title"
          >
            <TicketWorkspaceColumnHeader
              id="tickets-conversation-column-title"
              step={2}
              title="Caso y conversación"
              description="Intercambio con el vecino y acciones principales del caso."
            />
            <div className="min-h-0 flex-1 overflow-hidden">
              <ConversationPanel
                isMobile={false}
                isSidebarVisible={isSidebarVisible}
                isDetailsVisible={isDetailsVisible}
                onToggleSidebar={() => setIsSidebarVisible((prev) => !prev)}
                onToggleDetails={() => setIsDetailsVisible((prev) => !prev)}
                canToggleSidebar
                showDetailsToggle
                desktopView={desktopView}
                setDesktopView={setDesktopView}
                operationalWorkspace
              />
            </div>
          </section>

          {isDetailsVisible && (
            <section
              className="flex min-h-0 min-w-0 flex-col overflow-hidden border-l border-border/70"
              data-testid="tickets-detail-region"
              aria-labelledby="tickets-resolution-column-title"
            >
              <TicketWorkspaceColumnHeader
                id="tickets-resolution-column-title"
                step={3}
                title="Resolución guiada"
                description="Siguiente paso, responsable y herramientas para resolver."
              />
              <div className="min-h-0 flex-1 overflow-hidden">
                <DetailsPanel className="h-full w-full border-l-0" operationalWorkspace />
              </div>
            </section>
          )}
        </div>
      )}
      <Toaster richColors />
    </Card>
  );
};

export default NewTicketsPanel;
