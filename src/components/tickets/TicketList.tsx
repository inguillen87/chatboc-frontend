import React from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TicketSummary, ESTADOS } from '@/pages/TicketsPanel';

interface TicketListItemProps {
  ticket: TicketSummary;
  isSelected: boolean;
  onSelect: () => void;
}

const TicketListItem: React.FC<TicketListItemProps> = React.memo(({ ticket, isSelected, onSelect }) => {
  let cardClasses = "bg-card dark:bg-slate-800 border-border dark:border-slate-700/80 hover:border-slate-400 dark:hover:border-slate-500";
  if (isSelected) {
    cardClasses = "bg-primary/10 border-primary dark:bg-primary/20 dark:border-primary ring-1 ring-primary";
  } else if (ticket.sla_status === 'breached') {
    cardClasses = "bg-red-500/10 border-red-500/30 dark:bg-red-700/20 dark:border-red-600/40 hover:border-red-500";
  } else if (ticket.sla_status === 'nearing_sla') {
    cardClasses = "bg-yellow-500/10 border-yellow-500/30 dark:bg-yellow-700/20 dark:border-yellow-600/40 hover:border-yellow-500";
  }

  return (
    <motion.div
      layout
      onClick={onSelect}
      className={cn(
        "p-3 rounded-lg border cursor-pointer mb-2 transition-all duration-200 ease-in-out",
        "hover:shadow-md dark:hover:bg-slate-700/60",
        cardClasses
      )}
      whileHover={{ y: -2 }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
    >
      <div className="flex justify-between items-start mb-1">
        <span className="font-semibold text-primary text-xs truncate max-w-[80px] flex-shrink-0" title={`#${ticket.nro_ticket}`}>#{ticket.nro_ticket}</span>
        <Badge className={cn("text-xs border", ESTADOS[ticket.estado]?.tailwind_class)}>{ESTADOS[ticket.estado]?.label}</Badge>
      </div>
      <p className="font-medium text-foreground truncate text-xs" title={ticket.asunto}>{ticket.asunto}</p>
      {ticket.nombre_usuario && <p className="text-xs text-muted-foreground truncate mt-0.5" title={ticket.nombre_usuario}>{ticket.nombre_usuario}</p>}
    </motion.div>
  );
});


interface GroupedTickets {
  categoryName: string;
  tickets: TicketSummary[];
}

interface TicketListProps {
  groupedTickets: GroupedTickets[];
  selectedTicketId: number | null;
  onTicketSelect: (ticket: TicketSummary) => void;
}

const TicketList: React.FC<TicketListProps> = ({ groupedTickets, selectedTicketId, onTicketSelect }) => {
  return (
    <div className="w-full space-y-1">
      {groupedTickets.map(group => (
        <div key={group.categoryName} className="mb-4">
          <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-2 py-2 rounded-md bg-muted/50 dark:bg-slate-700/50">
            <div className="flex items-center justify-between w-full">
              <span>{group.categoryName}</span>
              <Badge variant="secondary">{group.tickets.length}</Badge>
            </div>
          </div>
          <div className="pt-1 space-y-1.5">
            {group.tickets.map(ticket => (
              <TicketListItem
                key={ticket.id}
                ticket={ticket}
                isSelected={selectedTicketId === ticket.id}
                onSelect={() => onTicketSelect(ticket)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default TicketList;
