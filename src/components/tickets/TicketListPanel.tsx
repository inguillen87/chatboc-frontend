import React from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import TicketListHeader from './TicketListHeader';
import TicketList from './TicketList';
import { TicketSummary, TicketStatus, PriorityStatus } from '@/types/tickets';
import { Loader2, TicketIcon } from 'lucide-react';

interface GroupedTickets {
  categoryName: string;
  tickets: TicketSummary[];
}

interface TicketListPanelProps {
  groupedTickets: GroupedTickets[];
  selectedTicketId: number | null;
  onTicketSelect: (ticket: TicketSummary) => void;
  isLoading: boolean;
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

const TicketListPanel: React.FC<TicketListPanelProps> = ({
  groupedTickets,
  selectedTicketId,
  onTicketSelect,
  isLoading,
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
    <div className="flex flex-col h-full bg-muted/30">
      <TicketListHeader
        searchTerm={searchTerm}
        onSearchTermChange={onSearchTermChange}
        statusFilter={statusFilter}
        onStatusFilterChange={onStatusFilterChange}
        priorityFilter={priorityFilter}
        onPriorityFilterChange={onPriorityFilterChange}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={onCategoryFilterChange}
        categories={categories}
      />
      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading && groupedTickets.length === 0 ? (
            <div className="flex items-center justify-center h-full p-8">
              <Loader2 className="animate-spin text-primary h-8 w-8" />
            </div>
          ) : !isLoading && groupedTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <TicketIcon className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold">No hay tickets</h3>
                <p className="text-sm text-muted-foreground">No se encontraron tickets que coincidan con tus filtros.</p>
            </div>
          ) : (
            <TicketList
              groupedTickets={groupedTickets}
              selectedTicketId={selectedTicketId}
              onTicketSelect={onTicketSelect}
              onToggleSelection={() => {}}
              isSelectionEnabled={false}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default TicketListPanel;
