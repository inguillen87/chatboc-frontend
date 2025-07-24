import React from 'react';
import Sidebar from './Sidebar';
import ConversationPanel from './ConversationPanel';
import DetailsPanel from './DetailsPanel';
import { Toaster, toast } from '@/components/ui/sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { Ticket } from '@/types/tickets';
import { AnimatePresence, motion } from 'framer-motion';
import { getTickets } from '@/services/ticketService';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser } from '@/hooks/useUser';
import getOrCreateAnonId from '@/utils/anonId';
import { usePusher } from '@/hooks/usePusher';
import { playMessageSound } from '@/utils/sounds';

const NewTicketsPanel: React.FC = () => {
  const isMobile = useIsMobile();
  const { user, loading: userLoading } = useUser();
  const [isSidebarVisible, setIsSidebarVisible] = React.useState(true);
  const [isDetailsVisible, setIsDetailsVisible] = React.useState(!isMobile);
  const [selectedTicket, setSelectedTicket] = React.useState<Ticket | null>(null);
  const [tickets, setTickets] = React.useState<Ticket[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const channel = usePusher('tickets');

  React.useEffect(() => {
    if (channel) {
      channel.bind('new-ticket', (newTicket: Ticket) => {
        setTickets(prevTickets => [{ ...newTicket, hasUnreadMessages: true }, ...prevTickets]);
        toast.success(`Nuevo ticket #${newTicket.id}: ${newTicket.title}`);
        playMessageSound();
      });

      channel.bind('new-message', (data: { ticketId: string, message: any }) => {
        setTickets(prevTickets =>
            prevTickets.map(t =>
                t.id === data.ticketId
                    ? { ...t, messages: [...t.messages, data.message], updatedAt: new Date().toISOString(), hasUnreadMessages: true }
                    : t
            )
        );
        // Do not show toast if the user is already viewing the ticket
        if (selectedTicket?.id !== data.ticketId) {
            toast.info(`Nuevo mensaje en el ticket #${data.ticketId}`);
            playMessageSound();
        }
      });
    }
  }, [channel, selectedTicket]);

  React.useEffect(() => {
    if (userLoading) return;

    const fetchTickets = async () => {
      try {
        setLoading(true);
        const anonId = !user ? getOrCreateAnonId() : undefined;
        const fetchedTickets = await getTickets(anonId);
        setTickets(Array.isArray(fetchedTickets) ? fetchedTickets : []);
        if (Array.isArray(fetchedTickets) && fetchedTickets.length > 0) {
          setSelectedTicket(fetchedTickets[0]);
        }
      } catch (err) {
        setError('No se pudieron cargar los tickets. Inténtalo de nuevo más tarde.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTickets();
  }, [user, userLoading]);

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
    const ticket = tickets.find(t => t.id === ticketId) || null;
    setSelectedTicket(ticket);
    // Mark as read
    setTickets(prevTickets =>
        prevTickets.map(t =>
            t.id === ticketId ? { ...t, hasUnreadMessages: false } : t
        )
    );
    if(isMobile) {
        setIsSidebarVisible(false);
    }
  }

  if (loading || userLoading) {
    return (
        <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
            <div className="w-96 border-r border-border p-4 space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-8 w-full" />
                <div className="space-y-2 mt-4">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                </div>
            </div>
            <div className="flex-1 p-4 space-y-4">
                <Skeleton className="h-16 w-full" />
                <div className="flex-1 space-y-4">
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
            <Sidebar
                tickets={tickets}
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

      <Toaster richColors />
    </div>
  );
};

export default NewTicketsPanel;
