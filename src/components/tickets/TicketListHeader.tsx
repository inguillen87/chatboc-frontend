import React from 'react';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TicketStatus, PriorityStatus, ESTADOS, PRIORITY_INFO } from '@/types/tickets';

interface TicketListHeaderProps {
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  statusFilter: TicketStatus | "";
  onStatusFilterChange: (status: TicketStatus | "") => void;
  priorityFilter: PriorityStatus | "";
  onPriorityFilterChange: (priority: PriorityStatus | "") => void;
}

const TicketListHeader: React.FC<TicketListHeaderProps> = ({
  searchTerm,
  onSearchTermChange,
  statusFilter,
  onStatusFilterChange,
  priorityFilter,
  onPriorityFilterChange,
}) => {
  return (
    <div className="p-3 border-b bg-muted/30 dark:border-slate-700 space-y-3">
      <Input
        placeholder="Buscar en esta vista..."
        value={searchTerm}
        onChange={(e) => onSearchTermChange(e.target.value)}
      />
      <div className="flex space-x-2">
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="text-xs h-8"><SelectValue placeholder="Filtrar por estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos los estados</SelectItem>
            {Object.entries(ESTADOS).map(([key, { label }]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={onPriorityFilterChange}>
          <SelectTrigger className="text-xs h-8"><SelectValue placeholder="Filtrar por prioridad" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas las prioridades</SelectItem>
            {Object.entries(PRIORITY_INFO).map(([key, { label }]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default TicketListHeader;
