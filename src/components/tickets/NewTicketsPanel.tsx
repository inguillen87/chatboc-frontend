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

const NewTicketsPanel: React.FC = () => {
  const isMobile = useIsMobile();
  const { loading, error, selectedTicket } = useTickets();
  const [isSidebarVisible, setIsSidebarVisible] = React.useState(!isMobile);
  const [isDetailsVisible, setIsDetailsVisible] = React.useState(!isMobile);
  const [mobileView, setMobileView] = React.useState<'tickets' | 'chat' | 'details'>('chat');
  const detailsPanelRef = React.useRef<ImperativePanelHandle | null>(null);
  const lastDetailsSize = React.useRef<number | null>(null);
  const lastMobileTicketId = React.useRef<string | number | null>(null);
  const DETAILS_PANEL_MAX_SIZE = 60;

  React.useEffect(() => {
    if (!isMobile) {
      setMobileView('chat');
      return;
    }

    if (!selectedTicket) {
      lastMobileTicketId.current = null;
      setMobileView('tickets');
      return;
    }

    if (lastMobileTicketId.current !== selectedTicket.id) {
      lastMobileTicketId.current = selectedTicket.id;
      setMobileView('chat');
    }
  }, [isMobile, selectedTicket]);

  React.useEffect(() => {
    if (!isMobile) {
      return;
    }

    if (mobileView === 'tickets') {
      setIsSidebarVisible(true);
      setIsDetailsVisible(false);
      return;
    }

    if (mobileView === 'details') {
      setIsSidebarVisible(false);
      setIsDetailsVisible(true);
      return;
    }

    setIsSidebarVisible(false);
    setIsDetailsVisible(false);
  }, [isMobile, mobileView]);

  React.useEffect(() => {
    if (isMobile) {
      return;
    }

    setIsSidebarVisible(true);
    setIsDetailsVisible(true);
  }, [isMobile]);

  React.useEffect(() => {
    if (isMobile) {
      return;
    }

    const panel = detailsPanelRef.current;

    if (!panel) {
      return;
    }

    if (lastDetailsSize.current === null) {
      const currentSize = panel.getSize();

      if (currentSize > 0) {
        lastDetailsSize.current = Math.min(currentSize, DETAILS_PANEL_MAX_SIZE);
      }
    }

    if (isDetailsVisible) {
      const storedSize = lastDetailsSize.current;

      if (panel.isCollapsed()) {
        const sizeToApply =
          typeof storedSize === 'number' && storedSize > 0
            ? Math.min(storedSize, DETAILS_PANEL_MAX_SIZE)
            : undefined;
        panel.expand(sizeToApply);
      }

      if (typeof storedSize === 'number' && storedSize > 0) {
        const targetSize = Math.min(storedSize, DETAILS_PANEL_MAX_SIZE);
        const currentSize = panel.getSize();

        if (Math.abs(currentSize - targetSize) > 0.5) {
          panel.resize(targetSize);
        }
      }
    } else if (!panel.isCollapsed()) {
      lastDetailsSize.current = Math.min(panel.getSize(), DETAILS_PANEL_MAX_SIZE);
      panel.collapse();
    }
  }, [isDetailsVisible, isMobile]);

  const toggleSidebar = () => {
    if (isMobile) {
      setMobileView((current) => (current === 'tickets' ? 'chat' : 'tickets'));
    }
  };

  const toggleDetails = () => {
    if (isMobile) {
      setMobileView((current) => (current === 'details' ? 'chat' : 'details'));
      return;
    }

    setIsDetailsVisible((prev) => !prev);
  };

  const handleMobileTicketSelection = React.useCallback(() => {
    if (!isMobile) {
      return;
    }

    setMobileView('chat');
  }, [isMobile]);

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
        <div className="flex h-screen w-full bg-background text-foreground items-center justify-center p-4 text-center">
            <p className="text-destructive">{error}</p>
        </div>
    )
  }

  return (
    <Card className="relative flex h-full w-full flex-col overflow-hidden rounded-3xl border border-border/70 bg-card/90 shadow-2xl backdrop-blur-md">
      {isMobile ? (
        <div className="flex h-full flex-col">
          <div className="border-b border-border/70 bg-card/80 px-3 py-2 shadow-sm">
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMobileView('tickets')}
                className={mobileNavButtonClass('tickets')}
                aria-pressed={mobileView === 'tickets'}
              >
                <PanelLeft className="h-4 w-4" />
                <span>Tickets</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileView('chat')}
                className={mobileNavButtonClass('chat', !selectedTicket)}
                aria-pressed={mobileView === 'chat'}
                disabled={!selectedTicket}
              >
                <MessageSquare className="h-4 w-4" />
                <span>Chat</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileView('details')}
                className={mobileNavButtonClass('details', !selectedTicket)}
                aria-pressed={mobileView === 'details'}
                disabled={!selectedTicket}
              >
                <Info className="h-4 w-4" />
                <span>Info</span>
              </button>
            </div>
          </div>
          <div className="relative flex-1 overflow-hidden">
            <AnimatePresence>
              {isSidebarVisible && (
                <motion.div
                  key="sidebar"
                  initial={{ x: '-100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '-100%' }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  className="absolute left-0 top-0 z-20 h-full w-full"
                >
                  <Sidebar className="h-full w-full min-w-full" onTicketSelected={handleMobileTicketSelection} />
                </motion.div>
              )}
            </AnimatePresence>
            <motion.div
              key="conversation"
              className="absolute left-0 top-0 z-10 h-full w-full"
              animate={{ x: isSidebarVisible ? '100%' : '0%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <ConversationPanel
                isMobile={true}
                isSidebarVisible={isSidebarVisible}
                isDetailsVisible={isDetailsVisible}
                onToggleSidebar={toggleSidebar}
                onToggleDetails={toggleDetails}
                canToggleSidebar
                showDetailsToggle
              />
            </motion.div>
            <AnimatePresence>
              {isDetailsVisible && (
                <motion.div
                  key="details"
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  className="absolute left-0 top-0 z-30 h-full w-full overflow-y-auto bg-background"
                >
                  <DetailsPanel onClose={toggleDetails} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      ) : (
        <ResizablePanelGroup direction="horizontal" className="flex h-full w-full overflow-hidden">
          <ResizablePanel
            defaultSize={24}
            minSize={18}
            maxSize={30}
            className="lg:min-w-[240px] xl:min-w-[300px]"
          >
            <Sidebar className="h-full w-full shrink-0" />
          </ResizablePanel>
          <ResizableHandle withHandle className="w-2 bg-border/60 transition-colors hover:bg-primary/50" />
          <ResizablePanel
            defaultSize={38}
            minSize={32}
            className="lg:min-w-[380px] xl:min-w-[520px]"
          >
            <ConversationPanel
              isMobile={false}
              isSidebarVisible={isSidebarVisible}
              isDetailsVisible={isDetailsVisible}
              onToggleSidebar={toggleSidebar}
              onToggleDetails={toggleDetails}
              showDetailsToggle
            />
          </ResizablePanel>
          <ResizableHandle withHandle className="w-2 bg-border/60 transition-colors hover:bg-primary/50" />
          <ResizablePanel
            ref={detailsPanelRef}
            defaultSize={38}
            minSize={28}
            maxSize={DETAILS_PANEL_MAX_SIZE}
            collapsible
            collapsedSize={0}
            onResize={(size) => {
              if (size > 0) {
                lastDetailsSize.current = Math.min(size, DETAILS_PANEL_MAX_SIZE);
              }
            }}
            onCollapse={() => setIsDetailsVisible(false)}
            onExpand={() => setIsDetailsVisible(true)}
            className="lg:min-w-[320px] xl:min-w-[440px]"
          >
            <DetailsPanel className="h-full w-full" />
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
      <Toaster richColors />
    </Card>
  );
};

export default NewTicketsPanel;
