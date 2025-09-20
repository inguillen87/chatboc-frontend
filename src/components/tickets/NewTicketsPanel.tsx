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

const NewTicketsPanel: React.FC = () => {
  const isMobile = useIsMobile();
  const { loading, error, selectedTicket } = useTickets();
  const [isSidebarVisible, setIsSidebarVisible] = React.useState(!isMobile);
  const [isDetailsVisible, setIsDetailsVisible] = React.useState(!isMobile);
  const [isWideLayout, setIsWideLayout] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return true;
    }
    return window.matchMedia('(min-width: 1440px)').matches;
  });
  const detailsPanelRef = React.useRef<ImperativePanelHandle | null>(null);
  const lastWideDetailsSize = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(min-width: 1440px)');
    const applyMatch = (value: boolean) => setIsWideLayout(value);

    applyMatch(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => applyMatch(event.matches);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }

    mediaQuery.addListener(handler);
    return () => mediaQuery.removeListener(handler);
  }, []);

  React.useEffect(() => {
    if (!isMobile) {
      return;
    }
    setIsDetailsVisible(false);
    // Show sidebar only if no ticket is selected on mobile
    setIsSidebarVisible(!selectedTicket);
  }, [isMobile, selectedTicket]);

  React.useEffect(() => {
    if (isMobile) {
      return;
    }
    if (isWideLayout) {
      setIsDetailsVisible(true);
    } else {
      setIsDetailsVisible(false);
    }
    setIsSidebarVisible(true);
  }, [isMobile, isWideLayout]);

  React.useEffect(() => {
    if (!isWideLayout) {
      return;
    }

    const panel = detailsPanelRef.current;

    if (!panel) {
      return;
    }

    if (lastWideDetailsSize.current === null) {
      const currentSize = panel.getSize();

      if (currentSize > 0) {
        lastWideDetailsSize.current = currentSize;
      }
    }

    if (isDetailsVisible) {
      const storedSize = lastWideDetailsSize.current;

      if (panel.isCollapsed()) {
        panel.expand(
          typeof storedSize === 'number' && storedSize > 0 ? storedSize : undefined,
        );
      }

      if (typeof storedSize === 'number' && storedSize > 0) {
        const currentSize = panel.getSize();

        if (Math.abs(currentSize - storedSize) > 0.5) {
          panel.resize(storedSize);
        }
      }
    } else if (!panel.isCollapsed()) {
      lastWideDetailsSize.current = panel.getSize();
      panel.collapse();
    }
  }, [isDetailsVisible, isWideLayout]);

  const toggleSidebar = () => setIsSidebarVisible(prev => !prev);
  const toggleDetails = () => setIsDetailsVisible(prev => !prev);

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
    <Card className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl backdrop-blur-sm">
      {isMobile ? (
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
                <Sidebar className="h-full w-full min-w-full" />
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
      ) : isWideLayout ? (
        <ResizablePanelGroup direction="horizontal" className="flex h-full w-full overflow-hidden">
          <ResizablePanel
            defaultSize={22}
            minSize={18}
            maxSize={30}
            className="min-w-[260px]"
          >
            <Sidebar className="h-full w-full shrink-0" />
          </ResizablePanel>
          <ResizableHandle withHandle className="bg-border/70 transition-colors hover:bg-primary/50" />
          <ResizablePanel
            defaultSize={48}
            minSize={36}
            className="min-w-[620px]"
          >
            <ConversationPanel
              isMobile={false}
              isSidebarVisible={true}
              isDetailsVisible={isDetailsVisible}
              onToggleSidebar={toggleSidebar}
              onToggleDetails={toggleDetails}
              showDetailsToggle
            />
          </ResizablePanel>
          <ResizableHandle withHandle className="bg-border/70 transition-colors hover:bg-primary/50" />
          <ResizablePanel
            ref={detailsPanelRef}
            defaultSize={30}
            minSize={22}
            maxSize={40}
            collapsible
            collapsedSize={0}
            onResize={(size) => {
              if (size > 0) {
                lastWideDetailsSize.current = size;
              }
            }}
            onCollapse={() =>
              setIsDetailsVisible((prev) => (prev ? false : prev))
            }
            onExpand={() =>
              setIsDetailsVisible((prev) => (prev ? prev : true))
            }
            className="min-w-[320px] max-w-[560px] overflow-hidden"
          >
            <DetailsPanel className="h-full w-full" />
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <div className="flex h-full w-full overflow-hidden">
          {isSidebarVisible && (
            <Sidebar className="w-[clamp(260px,26vw,340px)] shrink-0 xl:w-[clamp(280px,22vw,360px)] 2xl:w-[clamp(300px,20vw,380px)]" />
          )}
          <div className="relative flex min-w-0 flex-1 bg-background">
            <ConversationPanel
              isMobile={false}
              isSidebarVisible={isSidebarVisible}
              isDetailsVisible={isDetailsVisible}
              onToggleSidebar={toggleSidebar}
              onToggleDetails={toggleDetails}
              canToggleSidebar
              showDetailsToggle
            />
            <AnimatePresence>
              {isDetailsVisible && (
                <motion.div
                  key="compact-details"
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                  className="absolute inset-y-0 right-0 z-30 flex w-full max-w-[clamp(320px,42vw,520px)] overflow-hidden border-l border-border bg-card shadow-xl"
                >
                  <DetailsPanel onClose={toggleDetails} className="w-full" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
      <Toaster richColors />
    </Card>
  );
};

export default NewTicketsPanel;
