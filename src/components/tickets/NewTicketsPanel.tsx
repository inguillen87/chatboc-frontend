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
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';

const NewTicketsPanel: React.FC = () => {
  const isMobile = useIsMobile();
  const { loading, error, selectedTicket } = useTickets();
  const [isSidebarVisible, setIsSidebarVisible] = React.useState(!isMobile);
  const [isDetailsVisible, setIsDetailsVisible] = React.useState(!isMobile);

  React.useEffect(() => {
    if (isMobile) {
      setIsDetailsVisible(false);
      // Show sidebar only if no ticket is selected on mobile
      setIsSidebarVisible(!selectedTicket);
    } else {
      setIsDetailsVisible(true);
      setIsSidebarVisible(true);
    }
  }, [isMobile, selectedTicket]);

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
    <Card className="flex w-full min-h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl backdrop-blur-sm">
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
                className="absolute top-0 left-0 z-20 h-full w-full"
              >
                <Sidebar className="min-w-full" />
              </motion.div>
            )}
          </AnimatePresence>
          <motion.div
             key="conversation"
             className="absolute top-0 left-0 h-full w-full z-10"
             animate={{ x: isSidebarVisible ? '100%' : '0%' }}
             transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <ConversationPanel
              isMobile={true}
              isSidebarVisible={isSidebarVisible}
              isDetailsVisible={isDetailsVisible}
              onToggleSidebar={toggleSidebar}
              onToggleDetails={toggleDetails}
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
                    className="absolute top-0 left-0 z-30 h-full w-full overflow-y-auto bg-background"
                >
                    <DetailsPanel onClose={toggleDetails} />
                </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          <ResizablePanel defaultSize={26} minSize={20} maxSize={35} className="min-w-[280px]">
            <Sidebar className="h-full" />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={48} minSize={38} className="min-w-[420px]">
            <ConversationPanel
              isMobile={false}
              isSidebarVisible={isSidebarVisible}
              isDetailsVisible={true}
              onToggleSidebar={toggleSidebar}
              onToggleDetails={toggleDetails}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={26} minSize={22} maxSize={40} className="min-w-[340px]">
            <DetailsPanel className="h-full" />
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
      <Toaster richColors />
    </Card>
  );
};

export default NewTicketsPanel;
