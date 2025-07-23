import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TicketListItem } from './TicketListItem';

// Placeholder
type TicketSummary = { id: number; subject: string; customer: string; status: string; };

import { Ticket, TicketStatus, PriorityStatus } from '@/pages/TicketsPanel';

interface TicketListProps {
  tickets: Ticket[];
  onTicketSelect: (ticket: Ticket) => void;
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  statusFilter: TicketStatus | 'all';
  onStatusFilterChange: (status: TicketStatus | 'all') => void;
  priorityFilter: PriorityStatus | 'all';
  onPriorityFilterChange: (priority: PriorityStatus | 'all') => void;
}

export const TicketList: React.FC<TicketListProps> = ({
    tickets,
    onTicketSelect,
    searchTerm,
    onSearchTermChange,
    statusFilter,
    onStatusFilterChange,
    priorityFilter,
    onPriorityFilterChange,
}) => {
  return (
    <div className="flex flex-col h-full bg-muted/30">
      <div className="p-3 border-b dark:border-slate-700 space-y-3">
        <Input
            placeholder="Buscar tickets..."
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
        />
        <div className="flex space-x-2">
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="nuevo">Nuevo</SelectItem>
              <SelectItem value="en_proceso">En Proceso</SelectItem>
              <SelectItem value="resuelto">Resuelto</SelectItem>
              <SelectItem value="cerrado">Cerrado</SelectItem>
            </SelectContent>
          </Select>
           <Select value={priorityFilter} onValueChange={onPriorityFilterChange}>
            <SelectTrigger><SelectValue placeholder="Prioridad" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las prioridades</SelectItem>
              <SelectItem value="low">Baja</SelectItem>
              <SelectItem value="medium">Media</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1.5">
          {tickets.map(ticket => (
            <TicketListItem key={ticket.id} ticket={ticket} onSelect={() => onTicketSelect(ticket)} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
