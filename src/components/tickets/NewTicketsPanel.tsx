import React from 'react';
import Sidebar from './Sidebar';
import ConversationPanel from './ConversationPanel';
import DetailsPanel from './DetailsPanel';
import { Toaster } from '@/components/ui/sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { AnimatePresence, motion } from 'framer-motion';
import { useTickets } from '@/context/TicketContext';
import { Skeleton } from '@/components/ui/skeleton';

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
    <div className="h-screen w-full bg-background text-foreground overflow-hidden">
      {isMobile ? (
        <div className="relative h-full w-full overflow-hidden">
          <AnimatePresence>
            {isSidebarVisible && (
              <motion.div
                key="sidebar"
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="absolute top-0 left-0 h-full w-full z-20"
              >
                <Sidebar />
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
                    className="absolute top-0 left-0 h-full w-full z-30 bg-background"
                >
                    <DetailsPanel />
                </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <div className="grid grid-cols-[320px_1fr_320px] h-full w-full">
          <Sidebar />
          <ConversationPanel
            isMobile={false}
            isSidebarVisible={isSidebarVisible}
            onToggleSidebar={toggleSidebar}
            onToggleDetails={toggleDetails}
          />
          <DetailsPanel />
        </div>
      )}
      <Toaster richColors />
    </div>
  );
};

export default NewTicketsPanel;
