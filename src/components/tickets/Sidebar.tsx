import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search } from 'lucide-react';
import TicketListItem from './TicketListItem';
import { Ticket, TicketStatus } from '@/types/tickets';
import { useDebounce } from '@/hooks/useDebounce';
import { motion, AnimatePresence } from 'framer-motion';


interface SidebarProps {
    tickets: Ticket[];
    selectedTicketId: string | null;
    onSelectTicket: (ticketId: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ tickets, selectedTicketId, onSelectTicket }) => {
  const [activeFilter, setActiveFilter] = React.useState<TicketStatus | 'todos'>('todos');
  const [searchTerm, setSearchTerm] = React.useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const filteredTickets = React.useMemo(() => tickets.filter(ticket => {
    const statusMatch = activeFilter === 'todos' || ticket.status === activeFilter;
    const searchTermMatch = debouncedSearchTerm === '' ||
                            ticket.title.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                            ticket.user.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                            ticket.id.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
    return statusMatch && searchTermMatch;
  }), [tickets, activeFilter, debouncedSearchTerm]);

  const newTicketsCount = tickets.filter(t => t.status === 'nuevo').length;

  return (
    <aside className="w-96 border-r border-border flex flex-col h-screen bg-muted/20 shrink-0">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Tickets</h1>
          {newTicketsCount > 0 && (
            <span className="text-sm font-semibold text-primary">
                {newTicketsCount} Nuevos
            </span>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por ID, título, nombre..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex space-x-2">
          <Button variant={activeFilter === 'todos' ? 'secondary' : 'ghost'} size="sm" className="flex-1" onClick={() => setActiveFilter('todos')}>Todos</Button>
          <Button variant={activeFilter === 'nuevo' ? 'secondary' : 'ghost'} size="sm" className="flex-1" onClick={() => setActiveFilter('nuevo')}>Nuevos</Button>
          <Button variant={activeFilter === 'abierto' ? 'secondary' : 'ghost'} size="sm" className="flex-1" onClick={() => setActiveFilter('abierto')}>Abiertos</Button>
          <Button variant={activeFilter === 'cerrado' ? 'secondary' : 'ghost'} size="sm" className="flex-1" onClick={() => setActiveFilter('cerrado')}>Cerrados</Button>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <motion.div layout className="p-4 space-y-2">
          <AnimatePresence>
            {filteredTickets.length > 0 ? (
                filteredTickets.map((ticket, index) => (
                    <motion.div
                        key={ticket.id}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2, delay: index * 0.05 }}
                    >
                        <TicketListItem
                            ticket={ticket}
                            isSelected={selectedTicketId === ticket.id}
                            onClick={() => onSelectTicket(ticket.id)}
                        />
                    </motion.div>
                ))
            ) : (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center text-muted-foreground py-10"
                >
                    <p>No se encontraron tickets.</p>
                </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </ScrollArea>
      <div className="p-4 border-t border-border">
          <Button className="w-full">Nuevo Ticket</Button>
      </div>
    </aside>
  );
};

export default Sidebar;
