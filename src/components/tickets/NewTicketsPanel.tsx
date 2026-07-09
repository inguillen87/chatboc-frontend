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
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AlertTriangle, ArrowRight, Bell, CheckCircle2, Clock, Filter, Info, LogIn, MessageSquare, PanelLeft, Radio, RefreshCw, Target, UserRound } from 'lucide-react';
import OperationalContinuityBar from '@/components/operations/OperationalContinuityBar';
import type { Ticket } from '@/types/tickets';
import { formatTicketStatusLabel, normalizeTicketStatus } from '@/utils/ticketStatus';
import { getNextOperationalTicket, isUnassignedQueueTicket } from '@/utils/ticketOperationalQueue';
import { useTenant } from '@/context/TenantContext';
import { backofficeService, type BackofficeInboxSummaryResponse } from '@/services/backofficeService';
import { resolveTenantSlug } from '@/utils/api';

type MobileView = 'tickets' | 'chat' | 'details';
type MobileTransitionDirection = -1 | 0 | 1;

const MOBILE_VIEW_SEQUENCE = ['tickets', 'chat', 'details'] as const;
const TICKET_LOADING_GRACE_MS = 12000;
const INBOX_SUMMARY_DEFER_MS = 1600;
const DESKTOP_DETAIL_MIN_WIDTH = 1536;
const EMBEDDED_DETAIL_MIN_WIDTH = 1800;

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
  const parsed = Number(normalized.replace(/^#/, '').replace(/^M-/i, ''));
  return Number.isFinite(parsed) ? parsed : null;
};

const formatDeskDeepLinkFocus = (value: string | null) =>
  value ? value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() : null;

const readTicketDeskQuery = (searchParams: URLSearchParams) => {
  const focus = normalizeQueryValue(searchParams.get('focus') ?? searchParams.get('ui_hint') ?? searchParams.get('source'));
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
    if (!ticketDeskQuery.ticketId || !tickets.length) return;
    const querySelectionKey = `${ticketDeskQuery.key}:${ticketDeskQuery.ticketId}`;
    if (selectedDeskQueryTicketRef.current === querySelectionKey) return;

    const matchedTicket = tickets.find((ticket) => {
      const candidateIds = [ticket.id, ticket.nro_ticket, ticket.ticket_id].filter((value) => value !== undefined && value !== null);
      return candidateIds.some((value) => {
        const normalized = normalizeTicketQueryNumber(String(value));
        return normalized === ticketDeskQuery.ticketId;
      });
    });

    if (!matchedTicket) return;
    selectTicket(matchedTicket.id);
    selectedDeskQueryTicketRef.current = querySelectionKey;
    if (isMobile) setActiveMobileView('chat');
    else setDesktopView('chat');
  }, [isMobile, selectTicket, setActiveMobileView, ticketDeskQuery, tickets]);

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
      'flex h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none',
      mobileView === value
        ? 'border-primary bg-primary text-primary-foreground shadow-sm'
        : 'border-border/70 bg-muted/60 text-muted-foreground hover:border-primary/40 hover:text-foreground',
      disabled && 'hover:border-border/70 hover:text-muted-foreground',
    );

  const hasLoadedInboxData = tickets.length > 0 || filteredTickets.length > 0 || selectedTicket !== null;
  const showInitialLoading = loading && !hasLoadedInboxData;

  if (showInitialLoading && loadingTimedOut) {
    return (
      <Card className="relative flex h-full min-h-[520px] w-full flex-col items-center justify-center border border-amber-500/30 bg-card/90 p-6 text-center shadow-2xl backdrop-blur-md">
        <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-500">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <h2 className="text-lg font-semibold text-foreground">La bandeja tarda mas de lo esperado</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          El backend todavia no respondio con la lista completa. Podes reintentar ahora o seguir esperando sin perder la vista del CRM.
        </p>
        <Button type="button" className="mt-5 gap-2 rounded-full" onClick={() => void refreshTickets()}>
          <RefreshCw className="h-4 w-4" />
          Reintentar carga
        </Button>
      </Card>
    );
  }

  if (showInitialLoading) {
    return (
        <div
          className="flex h-full min-h-[520px] w-full bg-background text-foreground overflow-hidden"
          role="status"
          aria-live="polite"
          aria-label="Cargando bandeja de reclamos"
        >
            {/* Skeleton for Desktop */}
            <div className="hidden md:flex w-full">
              <div className="w-80 border-r border-border p-4 space-y-4">
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                      Cargando bandeja de reclamos
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      Sincronizando tickets, chats en vivo, filtros y métricas operativas.
                    </p>
                  </div>
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <div className="space-y-4 mt-4">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-24 w-full" />
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-24 w-full" />
                  </div>
              </div>
              <div className="flex-1 p-4 space-y-4">
                  <div className="grid gap-3 lg:grid-cols-3">
                    <Skeleton className="h-20 w-full rounded-2xl" />
                    <Skeleton className="h-20 w-full rounded-2xl" />
                    <Skeleton className="h-20 w-full rounded-2xl" />
                  </div>
                  <Skeleton className="h-16 w-full" />
                  <div className="flex-1 space-y-4 mt-4">
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-20 w-2/3 ml-auto" />
                      <Skeleton className="h-20 w-full" />
                  </div>
              </div>
            </div>
             {/* Skeleton for Mobile */}
            <div className="md:hidden w-full p-4 space-y-4">
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                  Cargando reclamos
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Preparando la mesa operativa.
                </p>
              </div>
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-[420px] w-full" />
            </div>
        </div>
    )
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
      <Card className="relative flex h-full min-h-[520px] w-full flex-col items-center justify-center border border-border/70 bg-card/90 p-6 text-center shadow-2xl backdrop-blur-md">
        <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/10 text-destructive">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <h2 className="text-lg font-semibold text-foreground">No pudimos cargar la bandeja</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-destructive">{error}</p>
        {isTicketScopeError ? (
          <div
            data-testid="tickets-access-contract"
            className="mt-4 w-full max-w-2xl rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-left"
          >
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
            <p className="mt-3 text-sm leading-6 text-foreground">
              El usuario tiene que quedar vinculado al tenant correcto y a un municipio o empresa antes de operar reclamos.
            </p>
            {scopeSummary.length ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {scopeSummary.map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-border/70 bg-background/75 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
                    <p className="mt-1 truncate text-sm font-medium text-foreground">{String(value)}</p>
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
        ) : null}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {isSessionError ? (
            <Button type="button" className="gap-2 rounded-full" onClick={goToLogin}>
              <LogIn className="h-4 w-4" />
              Iniciar sesión
            </Button>
          ) : null}
          <Button type="button" variant="outline" className="gap-2 rounded-full" onClick={() => void refreshTickets()}>
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </Button>
        </div>
      </Card>
    )
  }

  const panelCardClass = cn(
    'relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden border border-border/70 bg-card/90 backdrop-blur-md',
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
  const desktopGridTemplate = isSidebarVisible && isDetailsVisible
    ? embedded
      ? 'minmax(288px, 340px) minmax(0, 1fr) minmax(280px, 320px)'
      : 'minmax(280px, 340px) minmax(0, 1fr) minmax(300px, 360px)'
    : isSidebarVisible
      ? embedded
        ? 'minmax(288px, 340px) minmax(0, 1fr)'
        : 'minmax(280px, 340px) minmax(0, 1fr)'
      : isDetailsVisible
        ? 'minmax(0, 1fr) minmax(300px, 360px)'
        : 'minmax(0, 1fr)';
  const nextPriorityTicket = getNextOperationalTicket(filteredTickets);
  const isNextPrioritySelected = Boolean(
    nextPriorityTicket && selectedTicket && String(nextPriorityTicket.id) === String(selectedTicket.id),
  );
  const nextPriorityLabel = nextPriorityTicket ? resolveTicketQueueLabel(nextPriorityTicket) : '';
  const nextPriorityCrmQueue = resolveTicketCrmQueue(nextPriorityTicket);
  const selectedTicketCrmQueue = resolveTicketCrmQueue(selectedTicket);
  const selectedTicketReference = selectedTicket?.nro_ticket || selectedTicket?.id || null;
  const selectedTicketStatus = selectedTicket ? formatTicketStatusLabel(selectedTicket.estado) : null;
  const selectedTicketChannel = selectedTicket?.channel || 'whatsapp';
  const selectedTicketSla = selectedTicket?.sla_status ? `SLA ${selectedTicket.sla_status}` : null;
  const selectedTicketHasUnread = selectedTicket ? hasUnreadTicket(selectedTicket) : false;
  const selectedTicketNextAction =
    selectedTicket?.recommended_next_action ||
    selectedTicketCrmQueue?.label ||
    (selectedTicketHasUnread ? 'Responder conversacion' : null) ||
    (nextPriorityTicket ? `Proximo: ${nextPriorityLabel}` : 'Mesa actualizada');
  const continuityTone = riskTickets > 0 ? 'warning' : unreadTickets > 0 ? 'live' : 'default';
  const handlePrimaryOperationalAction = () => {
    if (nextPriorityTicket && !isNextPrioritySelected) {
      selectTicket(nextPriorityTicket.id);
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
          'border-b border-border/70 bg-gradient-to-r from-background/95 via-primary/5 to-background/95',
          embedded ? 'px-2.5 py-1 sm:px-3' : 'px-3 py-2 sm:px-4',
        )}
      >
        <div
          className={cn(
            'flex gap-2',
            embedded
              ? 'flex-col min-[920px]:flex-row min-[920px]:items-center min-[920px]:justify-between'
              : 'flex-col min-[1080px]:flex-row min-[1080px]:items-center min-[1080px]:justify-between',
          )}
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                {embedded ? (tenant?.tipo === 'municipio' ? 'Reclamos' : 'Tickets') : 'Mesa operativa'}
              </h2>
              <Badge variant="outline" className="rounded-full">
                {filteredTickets.length.toLocaleString('es-AR')} visibles
              </Badge>
              {selectedTicket ? (
                <Badge variant="secondary" className="rounded-full">
                  #{selectedTicket.nro_ticket || selectedTicket.id}
                </Badge>
              ) : null}
              {deepLinkFocus ? (
                <Badge data-testid="tickets-deeplink-focus" variant="secondary" className="rounded-full capitalize">
                  Desde {formatDeskDeepLinkFocus(deepLinkFocus)}
                </Badge>
              ) : null}
            </div>
            <p className="sr-only">
              Priorización, conversación y detalle en una sola vista.
              {inboxSummary?.request_id ? ` Ref. ${inboxSummary.request_id}` : null}
            </p>
            {!embedded && recommendedViews.length ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {recommendedViews.slice(0, 2).map((view, index) => (
                  <button
                    key={view.id || `recommended_${index}`}
                    type="button"
                    onClick={() => applyRecommendedView(view.query)}
                    className="inline-flex max-w-full rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  >
                    <Badge variant="secondary" className="max-w-full rounded-full text-[11px]">
                      <span className="truncate">
                        {view.label}
                        {view.description ? `: ${view.description}` : ''}
                      </span>
                    </Badge>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {!embedded ? (
            <div
              data-testid="ticket-ops-stat-strip"
              className={cn(
                'flex min-w-0 gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                embedded ? 'w-full min-[920px]:w-auto min-[920px]:justify-end' : 'min-[1080px]:justify-end',
              )}
            >
            <TicketOpsStat
              label="Abiertos"
              value={openTickets}
              helper="Casos por resolver"
              tone="blue"
              icon={Clock}
              onClick={() => applyQuickFilter({ status: 'all', unread: 'all', sla: 'all' })}
              compact={embedded}
            />
            <TicketOpsStat
              label="Riesgo"
              value={riskTickets}
              helper="SLA o prioridad alta"
              tone="amber"
              icon={AlertTriangle}
              onClick={() => applyQuickFilter({ sla: 'risk', priority: 'all' })}
              compact={embedded}
            />
            <TicketOpsStat
              label="No leídos"
              value={unreadTickets}
              helper="Requieren respuesta"
              tone="violet"
              icon={Radio}
              onClick={() => applyQuickFilter({ unread: 'unread' })}
              compact={embedded}
            />
            <TicketOpsStat
              label="Resueltos"
              value={resolvedTickets}
              helper="Cerrados/resueltos"
              tone="emerald"
              icon={CheckCircle2}
              onClick={() => applyQuickFilter({ status: 'resuelto' })}
              compact={embedded}
            />
            </div>
          ) : null}
          {embedded ? (
            <div className="flex w-full min-w-0 shrink-0 flex-wrap items-center gap-2 min-[920px]:w-auto min-[920px]:justify-end">
              <Badge
                data-testid="tickets-embedded-kpi-summary"
                variant="outline"
                className="max-w-full rounded-full bg-background/70 text-[11px] font-medium text-muted-foreground"
                title={`${openTickets} abiertos | ${unreadTickets} sin leer | ${riskTickets} en riesgo | ${resolvedTickets} resueltos`}
              >
                <span className="truncate">
                  {openTickets.toLocaleString('es-AR')} abiertos
                  {unreadTickets > 0 ? ` · ${unreadTickets.toLocaleString('es-AR')} sin leer` : ''}
                  {riskTickets > 0 ? ` · ${riskTickets.toLocaleString('es-AR')} riesgo` : ''}
                </span>
              </Badge>
              {nextPriorityTicket ? (
                <div
                  data-testid="tickets-next-priority-strip"
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-xs text-primary shadow-sm min-[920px]:flex-none"
                >
                  <span className="hidden font-semibold uppercase tracking-[0.08em] min-[980px]:inline">
                    Siguiente prioridad
                  </span>
                  <span className="max-w-[10rem] truncate font-semibold text-foreground min-[920px]:max-w-[11rem]">
                    #{nextPriorityTicket.nro_ticket || nextPriorityTicket.id} · {nextPriorityLabel}
                  </span>
                  <Button
                    type="button"
                    variant={isNextPrioritySelected ? 'secondary' : 'default'}
                    size="sm"
                    className="h-7 rounded-full px-2 text-xs"
                    disabled={isNextPrioritySelected}
                    aria-label={
                      isNextPrioritySelected ? 'Prioridad en atencion' : 'Atender siguiente prioridad'
                    }
                    onClick={() => selectTicket(nextPriorityTicket.id)}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>{isNextPrioritySelected ? 'En foco' : 'Atender'}</span>
                  </Button>
                </div>
              ) : null}
              {loading ? (
                <Badge variant="secondary" className="rounded-full">
                  Actualizando
                </Badge>
              ) : null}
              <TicketFilterPopover
                compact
                align="end"
                side="bottom"
                onReset={resetOperationalFilters}
                triggerTestId="tickets-header-filter-button"
                panelTestId="tickets-header-filter-panel"
                className="h-8 rounded-full"
              />
              {operationalFilterBadges.length > 0 ? (
                <div
                  data-testid="tickets-embedded-active-filters"
                  className="flex min-w-0 flex-wrap items-center gap-1"
                  title={operationalFilterBadges.join(' | ')}
                >
                  <Badge variant="secondary" className="rounded-full text-[11px]">
                    {operationalFilterBadges.length === 1
                      ? '1 filtro'
                      : `${operationalFilterBadges.length} filtros`}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 rounded-full px-2 text-xs"
                    aria-label="Limpiar filtros"
                    title="Limpiar filtros"
                    onClick={resetOperationalFilters}
                  >
                    <Filter className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : null}
              <Button
                type="button"
                variant={realtimeActivity.pending > 0 ? 'default' : 'outline'}
                size="sm"
                className="h-8 gap-2 rounded-full"
                onClick={() => {
                  clearRealtimeActivity();
                  void refreshTickets();
                }}
                title={realtimeActivity.lastLabel || 'Actualizar mesa'}
              >
                <Bell className="h-4 w-4" />
                {realtimeActivity.pending > 0 ? `${realtimeActivity.pending} novedades` : 'Realtime'}
              </Button>
            </div>
          ) : null}
        </div>
        {!embedded ? (
          <div className="mt-2 flex flex-col gap-2 border-t border-border/50 pt-2 min-[760px]:flex-row min-[760px]:items-center min-[760px]:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <TicketFilterPopover
              compact
              align="start"
              side="bottom"
              onReset={resetOperationalFilters}
              triggerTestId="tickets-desk-filter-button"
              panelTestId="tickets-desk-filter-panel"
              className="h-8 rounded-full"
            />
            {operationalFilterBadges.length > 0 ? (
              <Badge
                data-testid="tickets-desk-active-filters"
                variant="secondary"
                className="max-w-full gap-1 rounded-full"
                title={operationalFilterBadges.join(' | ')}
                aria-label={`Filtros activos: ${operationalFilterBadges.join(', ')}`}
              >
                <Filter className="h-3 w-3" />
                {operationalFilterBadges.length === 1
                  ? '1 filtro activo'
                  : `${operationalFilterBadges.length} filtros activos`}
              </Badge>
            ) : (
              <Badge
                data-testid="tickets-desk-active-filters"
                variant="outline"
                className="gap-1 rounded-full text-muted-foreground"
              >
                <Filter className="h-3 w-3" />
                Sin filtros
              </Badge>
            )}
            {operationalFilterBadges.length > 0 ? (
              <Button type="button" variant="ghost" size="sm" className="h-7 rounded-full px-2 text-xs" onClick={resetOperationalFilters}>
                Limpiar
              </Button>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {typeof summary?.unassigned === 'number' ? (
              <Badge variant={summary.unassigned > 0 ? 'secondary' : 'outline'} className="gap-1">
                <UserRound className="h-3 w-3" />
                Sin responsable: {summary.unassigned}
              </Badge>
            ) : null}
            <Button
              type="button"
              variant={realtimeActivity.pending > 0 ? 'default' : 'outline'}
              size="sm"
              className="h-8 gap-2 rounded-full"
              onClick={() => {
                clearRealtimeActivity();
                void refreshTickets();
              }}
              title={realtimeActivity.lastLabel || 'Actualizar mesa'}
            >
              <Bell className="h-4 w-4" />
              {realtimeActivity.pending > 0
                ? `${realtimeActivity.pending} novedades`
                : 'Realtime listo'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-2 rounded-full"
              onClick={() => void refreshTickets()}
            >
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </Button>
          </div>
        </div>
        ) : null}
      </div>
      {!embedded ? (
        <div className="border-b border-border/70 bg-background/65 px-3 py-2 sm:px-4">
          <OperationalContinuityBar
            testId="tickets-operational-continuity"
            icon={MessageSquare}
            tone={continuityTone}
            title={selectedTicket ? 'Atencion del reclamo' : 'Mesa de reclamos'}
            subtitle={
              selectedTicket
                ? 'Conversacion, historial y detalle permanecen conectados para responder sin perder contexto.'
                : 'Selecciona un caso o toma la siguiente prioridad para mantener la mesa operativa.'
            }
            reference={selectedTicketReference}
            statusLabel={selectedTicketStatus ?? `${openTickets} abiertos`}
            channelLabel={selectedTicket ? selectedTicketChannel : 'WhatsApp / web'}
            liveLabel={realtimeActivity.pending > 0 ? `${realtimeActivity.pending} novedades` : 'Realtime listo'}
            slaLabel={selectedTicketSla ?? (riskTickets > 0 ? `${riskTickets} en riesgo` : 'SLA estable')}
            nextActionLabel={selectedTicketNextAction}
            primaryActionLabel={
              nextPriorityTicket && !isNextPrioritySelected
                ? 'Atender prioridad'
                : selectedTicket
                  ? 'Responder'
                  : 'Actualizar mesa'
            }
            onPrimaryAction={handlePrimaryOperationalAction}
            secondaryActionLabel="Actualizar"
            onSecondaryAction={() => void refreshTickets()}
            metrics={[
              { label: 'Abiertos', value: openTickets, tone: 'default' },
              { label: 'No leidos', value: unreadTickets, tone: unreadTickets > 0 ? 'live' : 'muted' },
              { label: 'Riesgo', value: riskTickets, tone: riskTickets > 0 ? 'warning' : 'muted' },
              { label: 'Resueltos', value: resolvedTickets, tone: 'success' },
            ]}
          />
        </div>
      ) : null}
      {embedded && nextPriorityTicket && nextPriorityCrmQueue ? (
        <div className="border-b border-border/70 bg-background/70 px-2.5 py-1.5 sm:px-3" data-testid="tickets-queue-command-card">
          <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-2 shadow-sm min-[860px]:flex-row min-[860px]:items-center min-[860px]:justify-between">
            <div className="flex min-w-0 items-start gap-2">
              <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-background/90 text-primary">
                <Target className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary" className="rounded-full text-[10px] uppercase tracking-[0.12em]">
                    Proxima accion
                  </Badge>
                  <Badge variant="outline" className="rounded-full text-[11px]">
                    Score {nextPriorityCrmQueue.score.toLocaleString('es-AR')}
                  </Badge>
                  {nextPriorityCrmQueue.badges.slice(0, 3).map((badge) => (
                    <Badge key={badge.id || badge.label} variant="outline" className="rounded-full text-[11px]">
                      {badge.label || badge.id}
                    </Badge>
                  ))}
                </div>
                <p className="mt-1 truncate text-sm font-semibold text-foreground">
                  {nextPriorityCrmQueue.label}: #{nextPriorityTicket.nro_ticket || nextPriorityTicket.id} - {nextPriorityLabel}
                </p>
                <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {nextPriorityCrmQueue.reason}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant={isNextPrioritySelected ? 'secondary' : 'default'}
              size="sm"
              className="h-8 shrink-0 gap-1.5 rounded-full px-3 text-xs"
              disabled={isNextPrioritySelected}
              aria-label={isNextPrioritySelected ? 'Prioridad recomendada en atencion' : 'Atender prioridad recomendada'}
              onClick={() => selectTicket(nextPriorityTicket.id)}
            >
              <span>{isNextPrioritySelected ? 'En foco' : 'Atender'}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : null}
      {isMobile ? (
        <div className="flex h-full min-h-0 flex-1 flex-col">
          <div className="border-b border-border/70 bg-card/80 px-3 py-2 shadow-sm">
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setActiveMobileView('tickets')}
                className={mobileNavButtonClass('tickets')}
                aria-pressed={mobileView === 'tickets'}
              >
                <PanelLeft className="h-4 w-4" />
                <span>Tickets</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveMobileView('chat')}
                className={mobileNavButtonClass('chat', !selectedTicket)}
                aria-pressed={mobileView === 'chat'}
                disabled={!selectedTicket}
              >
                <MessageSquare className="h-4 w-4" />
                <span>Chat</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveMobileView('details')}
                className={mobileNavButtonClass('details', !selectedTicket)}
                aria-pressed={mobileView === 'details'}
                disabled={!selectedTicket}
              >
                <Info className="h-4 w-4" />
                <span>Info</span>
              </button>
            </div>
          </div>
          <div className="relative flex-1 overflow-hidden min-h-0">
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
                  className="absolute inset-0 flex min-h-0"
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
                  className="absolute inset-0 flex min-h-0"
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
                  className="absolute inset-0 flex min-h-0"
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
            <div className="min-h-0 min-w-0 overflow-hidden border-r border-border/70">
              <Sidebar
                compact={embedded}
                showFilterControl={isMobile && !embedded}
                showListSummaryBar={false}
                className="h-full w-full shrink-0"
              />
            </div>
          )}

          <div className="min-h-0 min-w-0 overflow-hidden">
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
            />
          </div>

          {isDetailsVisible && (
            <div className="min-h-0 min-w-0 overflow-hidden border-l border-border/70">
              <DetailsPanel className="h-full w-full" />
            </div>
          )}
        </div>
      )}
      <Toaster richColors />
    </Card>
  );
};

export default NewTicketsPanel;
