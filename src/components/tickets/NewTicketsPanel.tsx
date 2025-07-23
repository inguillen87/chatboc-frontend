import React from 'react';
import Sidebar from './Sidebar';
import ConversationPanel from './ConversationPanel';
import DetailsPanel from './DetailsPanel';
import { Toaster } from '@/components/ui/sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { mockTickets } from '@/lib/mock-data';
import { Ticket } from '@/types/tickets';
import { AnimatePresence, motion } from 'framer-motion';

const NewTicketsPanel: React.FC = () => {
  const isMobile = useIsMobile();
  const [isSidebarVisible, setIsSidebarVisible] = React.useState(true);
  const [isDetailsVisible, setIsDetailsVisible] = React.useState(!isMobile);
  const [selectedTicket, setSelectedTicket] = React.useState<Ticket | null>(mockTickets[0] || null);

  React.useEffect(() => {
    if (isMobile) {
      setIsDetailsVisible(false);
      setIsSidebarVisible(true);
    } else {
      setIsDetailsVisible(true);
      setIsSidebarVisible(true);
    }
  }, [isMobile]);

  const handleSelectTicket = (ticketId: string) => {
    const ticket = mockTickets.find(t => t.id === ticketId) || null;
    setSelectedTicket(ticket);
    if(isMobile) {
        setIsSidebarVisible(false);
    }
  }

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      <AnimatePresence>
        {isSidebarVisible && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <Sidebar
                tickets={mockTickets}
                selectedTicketId={selectedTicket?.id || null}
                onSelectTicket={handleSelectTicket}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 flex flex-col h-screen">
        <ConversationPanel
          ticket={selectedTicket}
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
                <DetailsPanel ticket={selectedTicket} />
            </motion.div>
        )}
      </AnimatePresence>

      <Toaster />
    </div>
  );
};

export default NewTicketsPanel;
