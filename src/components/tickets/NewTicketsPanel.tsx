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
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import { cn } from '@/lib/utils';
import { PanelLeft, MessageSquare, Info } from 'lucide-react';

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

const NewTicketsPanel: React.FC = () => {
  const isMobile = useIsMobile();
  const { loading, error, selectedTicket } = useTickets();

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

  return (
    <Card className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded-3xl border border-border/70 bg-card/90 shadow-2xl backdrop-blur-md">
      {isMobile ? (
        <div className="flex h-full min-h-0 flex-col">
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
