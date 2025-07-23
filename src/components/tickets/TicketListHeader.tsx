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
  categoryFilter: string | "";
  onCategoryFilterChange: (category: string | "") => void;
  categories: (string | undefined)[];
}

const TicketListHeader: React.FC<TicketListHeaderProps> = ({
  searchTerm,
  onSearchTermChange,
  statusFilter,
  onStatusFilterChange,
  priorityFilter,
  onPriorityFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  categories,
}) => {
  return (
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
            <SelectItem value="">Todos</SelectItem>
            {Object.entries(ESTADOS).map(([key, { label }]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={onPriorityFilterChange}>
          <SelectTrigger><SelectValue placeholder="Prioridad" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas</SelectItem>
            {Object.entries(PRIORITY_INFO).map(([key, { label }]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={onCategoryFilterChange}>
          <SelectTrigger><SelectValue placeholder="Categoría" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas</SelectItem>
            {categories.map((category) => <SelectItem key={category} value={category!}>{category}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default TicketListHeader;
