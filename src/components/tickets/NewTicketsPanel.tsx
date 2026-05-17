import React from 'react';
import Sidebar from './Sidebar';
import ConversationPanel from './ConversationPanel';
import DetailsPanel from './DetailsPanel';
import { Toaster } from '@/components/ui/sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { AnimatePresence, motion } from 'framer-motion';
import { useTickets } from '@/context/TicketContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, Clock, Info, MessageSquare, PanelLeft, Radio } from 'lucide-react';
import type { Ticket } from '@/types/tickets';
import { normalizeTicketStatus } from '@/utils/ticketStatus';
import { useTenant } from '@/context/TenantContext';
import { backofficeService, type BackofficeInboxSummaryResponse } from '@/services/backofficeService';

type MobileView = 'tickets' | 'chat' | 'details';
type MobileTransitionDirection = -1 | 0 | 1;

const MOBILE_VIEW_SEQUENCE = ['tickets', 'chat', 'details'] as const;

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
  return status === 'resuelto' || status === 'cerrado';
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

const TicketOpsStat = ({
  label,
  value,
  helper,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  helper: string;
  tone: 'blue' | 'amber' | 'emerald' | 'violet';
  icon: React.ElementType;
}) => {
  const toneClass = {
    blue: 'border-blue-500/20 bg-blue-500/10 text-blue-500',
    amber: 'border-amber-500/20 bg-amber-500/10 text-amber-500',
    emerald: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500',
    violet: 'border-violet-500/20 bg-violet-500/10 text-violet-500',
  }[tone];

  return (
    <div className="rounded-2xl border border-border/70 bg-background/75 p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{value.toLocaleString('es-AR')}</p>
        </div>
        <span className={cn('inline-flex h-9 w-9 items-center justify-center rounded-xl border', toneClass)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{helper}</p>
    </div>
  );
};

const NewTicketsPanel: React.FC = () => {
  const isMobile = useIsMobile();
  const { loading, error, tickets, filteredTickets, selectedTicket } = useTickets();
  const { currentSlug, tenant } = useTenant();
  const [inboxSummary, setInboxSummary] = React.useState<BackofficeInboxSummaryResponse | null>(null);

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
  const [isDetailsVisible, setIsDetailsVisible] = React.useState(!isMobile);
  const [desktopView, setDesktopView] = React.useState<'chat' | 'details'>('chat');

  const sidebarPanelRef = React.useRef<ImperativePanelHandle | null>(null);
  const detailsPanelRef = React.useRef<ImperativePanelHandle | null>(null);
  const lastSidebarSize = React.useRef<number | null>(null);
  const lastDetailsSize = React.useRef<number | null>(null);
  const lastMobileTicketId = React.useRef<string | number | null>(null);
  const DETAILS_PANEL_MAX_SIZE = 72;
  const SIDEBAR_PANEL_MAX_SIZE = 40;

  React.useEffect(() => {
    mobileViewRef.current = mobileView;
  }, [mobileView]);

  React.useEffect(() => {
    let cancelled = false;
    const tenantSlug = currentSlug || tenant?.slug || null;
    if (!tenantSlug || tenantSlug === 'default') {
      setInboxSummary(null);
      return;
    }

    const scope = tenant?.tipo === 'municipio' || tenant?.tipo === 'colegio' ? tenant.tipo : 'pyme';
    backofficeService
      .getInboxSummary({ tenantSlug, scope })
      .then((response) => {
        if (!cancelled) setInboxSummary(response);
      })
      .catch(() => {
        if (!cancelled) setInboxSummary(null);
      });

    return () => {
      cancelled = true;
    };
  }, [currentSlug, tenant?.slug, tenant?.tipo]);

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

  // Effect for sidebar panel
  React.useEffect(() => {
    if (isMobile) return;

    const panel = sidebarPanelRef.current;
    if (!panel) return;

    if (lastSidebarSize.current === null) {
      const currentSize = panel.getSize();
      if (currentSize > 0) {
        lastSidebarSize.current = Math.min(currentSize, SIDEBAR_PANEL_MAX_SIZE);
      }
    }

    if (isSidebarVisible) {
      if (panel.isCollapsed()) {
        const sizeToApply = lastSidebarSize.current ?? undefined;
        panel.expand(sizeToApply);
      }
    } else {
      if (!panel.isCollapsed()) {
        lastSidebarSize.current = Math.min(panel.getSize(), SIDEBAR_PANEL_MAX_SIZE);
        panel.collapse();
      }
    }
  }, [isSidebarVisible, isMobile]);

  // Effect for details panel
  React.useEffect(() => {
    if (isMobile) return;

    const panel = detailsPanelRef.current;
    if (!panel) return;

    if (lastDetailsSize.current === null) {
      const currentSize = panel.getSize();
      if (currentSize > 0) {
        lastDetailsSize.current = Math.min(currentSize, DETAILS_PANEL_MAX_SIZE);
      }
    }

    if (isDetailsVisible) {
      if (panel.isCollapsed()) {
        const sizeToApply = lastDetailsSize.current ?? undefined;
        panel.expand(sizeToApply);
      }
    } else {
      if (!panel.isCollapsed()) {
        lastDetailsSize.current = Math.min(panel.getSize(), DETAILS_PANEL_MAX_SIZE);
        panel.collapse();
      }
    }
  }, [isDetailsVisible, isMobile]);

  const handleMobileTicketSelection = React.useCallback(() => {
    if (isMobile) {
      setActiveMobileView('chat');
    }
  }, [isMobile, setActiveMobileView]);

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

  if (loading) {
    return (
        <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
            {/* Skeleton for Desktop */}
            <div className="hidden md:flex w-full">
              <div className="w-80 border-r border-border p-4 space-y-4">
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
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-screen w-full" />
            </div>
        </div>
    )
  }

  if (error) {
    return (
      <Card className="relative flex h-full min-h-[520px] w-full flex-col items-center justify-center border border-border/70 bg-card/90 p-6 text-center shadow-2xl backdrop-blur-md">
        <p className="text-sm text-destructive">{error}</p>
      </Card>
    )
  }

  const panelCardClass = cn(
    'relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded-3xl border border-border/70 bg-card/90 shadow-2xl backdrop-blur-md',
    isMobile && 'h-[calc(100dvh-8rem)]',
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

  return (
    <Card className={panelCardClass}>
      <div className="border-b border-border/70 bg-gradient-to-r from-background/95 via-primary/5 to-background/95 px-3 py-3 sm:px-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight text-foreground">Mesa operativa</h2>
              <Badge variant="outline" className="rounded-full">
                {filteredTickets.length.toLocaleString('es-AR')} visibles
              </Badge>
              {selectedTicket ? (
                <Badge variant="secondary" className="rounded-full">
                  #{selectedTicket.nro_ticket || selectedTicket.id}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Priorizacion, conversacion y detalle en una sola vista.
              {inboxSummary?.request_id ? ` Ref. ${inboxSummary.request_id}` : null}
            </p>
            {recommendedViews.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {recommendedViews.slice(0, 3).map((view, index) => (
                  <Badge key={view.id || `recommended_${index}`} variant="secondary" className="max-w-full rounded-full">
                    <span className="truncate">
                      {view.label}
                      {view.description ? `: ${view.description}` : ''}
                    </span>
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:w-[620px] xl:grid-cols-4">
            <TicketOpsStat label="Abiertos" value={openTickets} helper="Casos por resolver" tone="blue" icon={Clock} />
            <TicketOpsStat label="Riesgo" value={riskTickets} helper="SLA o prioridad alta" tone="amber" icon={AlertTriangle} />
            <TicketOpsStat label="No leidos" value={unreadTickets} helper="Requieren respuesta" tone="violet" icon={Radio} />
            <TicketOpsStat label="Resueltos" value={resolvedTickets} helper="Cerrados/resueltos" tone="emerald" icon={CheckCircle2} />
          </div>
        </div>
      </div>
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
        <ResizablePanelGroup direction="horizontal" className="flex h-full w-full overflow-hidden">
          {isSidebarVisible && (
            <ResizablePanel
              ref={sidebarPanelRef}
              order={1}
              defaultSize={25}
              minSize={20}
              maxSize={SIDEBAR_PANEL_MAX_SIZE}
              collapsible
              collapsedSize={0}
              onCollapse={() => setIsSidebarVisible(false)}
              className="min-w-[300px]"
            >
              <Sidebar className="h-full w-full shrink-0" />
            </ResizablePanel>
          )}
          {isSidebarVisible && <ResizableHandle withHandle className="w-2 bg-border/60 transition-colors hover:bg-primary/50" />}

          <ResizablePanel order={2} defaultSize={45} minSize={30}>
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
          </ResizablePanel>

          {isDetailsVisible && (
            <>
              <ResizableHandle withHandle className="w-2 bg-border/60 transition-colors hover:bg-primary/50" />
              <ResizablePanel
                ref={detailsPanelRef}
                order={3}
                defaultSize={30}
                minSize={25}
                maxSize={DETAILS_PANEL_MAX_SIZE}
                collapsible
                collapsedSize={0}
                onCollapse={() => setIsDetailsVisible(false)}
                className="min-w-[360px]"
              >
                <DetailsPanel className="h-full w-full" />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      )}
      <Toaster richColors />
    </Card>
  );
};

export default NewTicketsPanel;
