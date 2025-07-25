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
  const { loading, error } = useTickets();
  const [isSidebarVisible, setIsSidebarVisible] = React.useState(true);
  const [isDetailsVisible, setIsDetailsVisible] = React.useState(!isMobile);

  React.useEffect(() => {
    if (isMobile) {
      setIsDetailsVisible(false);
      setIsSidebarVisible(true);
    } else {
      setIsDetailsVisible(true);
      setIsSidebarVisible(true);
    }
  }, [isMobile]);

  if (loading) {
    return (
        <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
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
    )
  }

  if (error) {
    return (
        <div className="flex h-screen w-full bg-background text-foreground items-center justify-center">
            <p className="text-destructive">{error}</p>
        </div>
    )
  }

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden lg:max-w-full lg:mx-auto">
      <AnimatePresence>
        {isSidebarVisible && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <Sidebar />
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 flex flex-col h-screen">
        <ConversationPanel
          isMobile={isMobile}
          isSidebarVisible={isSidebarVisible}
          onToggleSidebar={() => setIsSidebarVisible(!isSidebarVisible)}
          onToggleDetails={() => setIsDetailsVisible(!isDetailsVisible)}
        />
      </main>

      <AnimatePresence>
        {isDetailsVisible && (
            <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="hidden md:block"
            >
                <DetailsPanel />
            </motion.div>
        )}
      </AnimatePresence>

      <Toaster richColors />
    </div>
  );
};

export default NewTicketsPanel;
