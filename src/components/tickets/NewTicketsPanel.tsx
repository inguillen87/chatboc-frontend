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
        toast.success(`Nuevo ticket #${newTicket.id}: ${newTicket.asunto}`);
        playMessageSound();
      });

      channel.bind('new-message', (data: { ticketId: string, message: any }) => {
        setTickets(prevTickets =>
            prevTickets.map(t =>
                t.id === data.ticketId
                    ? { ...t, messages: [...(t.messages || []), data.message], fecha: new Date().toISOString(), hasUnreadMessages: true }
                    : t
            )
        );
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
        const apiResponse = await getTickets();
        const fetchedTickets = (apiResponse as any)?.tickets;

        if (Array.isArray(fetchedTickets)) {
            setTickets(fetchedTickets);
            if (fetchedTickets.length > 0) {
                setSelectedTicket(fetchedTickets[0]);
            }
        } else {
            console.warn("La respuesta de la API no contiene un array de tickets:", apiResponse);
            setTickets([]);
        }

      } catch (err) {
        console.error('Error fetching tickets:', err);
        setError('No se pudieron cargar los tickets. Inténtalo de nuevo más tarde.');
        setTickets([]);
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

  const handleSelectTicket = (ticketId: number) => {
    const ticket = tickets.find(t => t.id === ticketId) || null;
    setSelectedTicket(ticket);
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
    // ... skeleton loading state ...
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
