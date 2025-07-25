import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, FileDown } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import TicketListItem from './TicketListItem';
import { useTickets } from '@/context/TicketContext';
import { exportToPdf, exportToExcel, exportAllToPdf } from '@/services/exportService';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const Sidebar: React.FC = () => {
  const { tickets, ticketsByCategory, selectedTicket, selectTicket } = useTickets();
  const [searchTerm, setSearchTerm] = React.useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const filteredTicketsByCategory = React.useMemo(() => {
    if (!debouncedSearchTerm) {
      return ticketsByCategory;
    }
    const filtered: { [key: string]: any[] } = {};
    for (const category in ticketsByCategory) {
      const tickets = ticketsByCategory[category].filter(ticket =>
        (ticket.asunto || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        (ticket.name || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        (ticket.nro_ticket || '').toString().toLowerCase().includes(debouncedSearchTerm.toLowerCase())
      );
      if (tickets.length > 0) {
        filtered[category] = tickets;
      }
    }
    return filtered;
  }, [ticketsByCategory, debouncedSearchTerm]);

  return (
    <aside className="w-80 border-r border-border flex flex-col h-screen bg-muted/20 shrink-0">
      <div className="p-4 space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Tickets</h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <FileDown className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportToExcel(tickets)}>
                Exportar Todos (Excel)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportAllToPdf(tickets)}>
                Exportar Todos (PDF)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToPdf(selectedTicket, selectedTicket?.messages || [])} disabled={!selectedTicket}>
                Exportar Ticket Actual (PDF)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nro, asunto, nombre..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        <Accordion type="multiple" className="w-full" defaultValue={Object.keys(filteredTicketsByCategory)}>
          {Object.entries(filteredTicketsByCategory).map(([category, tickets]) => (
            <AccordionItem value={category} key={category}>
              <AccordionTrigger className="px-4 font-semibold">
                {category} ({tickets.length})
              </AccordionTrigger>
              <AccordionContent>
                <div className="p-1 space-y-2">
                  {tickets.map((ticket) => (
                    <TicketListItem
                      key={ticket.id}
                      ticket={ticket}
                      isSelected={selectedTicket?.id === ticket.id}
                      onClick={() => selectTicket(ticket.id)}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </ScrollArea>
    </aside>
  );
};

export default Sidebar;
