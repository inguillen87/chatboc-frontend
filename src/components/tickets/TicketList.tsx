import React from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TicketSummary, ESTADOS } from '@/pages/TicketsPanel';
import { Checkbox } from "@/components/ui/checkbox";
import { useVirtualizer } from '@tanstack/react-virtual';

interface TicketListItemProps {
  ticket: TicketSummary;
  isSelected: boolean;
  onSelect: () => void;
  onToggleSelection: (ticketId: number, isSelected: boolean) => void;
  isTicketSelectedForBulk: boolean;
  style: React.CSSProperties;
}

const TicketListItem: React.FC<TicketListItemProps> = React.memo(({ ticket, isSelected, onSelect, onToggleSelection, isTicketSelectedForBulk, style }) => {
  let cardClasses = "bg-card dark:bg-slate-800 border-border dark:border-slate-700/80 hover:border-slate-400 dark:hover:border-slate-500";
  if (isSelected) {
    cardClasses = "bg-primary/10 border-primary dark:bg-primary/20 dark:border-primary ring-1 ring-primary";
  } else if (ticket.sla_status === 'breached') {
    cardClasses = "bg-red-500/10 border-red-500/30 dark:bg-red-700/20 dark:border-red-600/40 hover:border-red-500";
  } else if (ticket.sla_status === 'nearing_sla') {
    cardClasses = "bg-yellow-500/10 border-yellow-500/30 dark:bg-yellow-700/20 dark:border-yellow-600/40 hover:border-yellow-500";
  }

  return (
    <div style={style}>
      <motion.div
        layout
        className={cn(
          "p-4 rounded-lg border mb-2 transition-all duration-200 ease-in-out flex items-center gap-3",
          "hover:shadow-md dark:hover:bg-slate-700/60",
          cardClasses
        )}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
      >
        <Checkbox
          checked={isTicketSelectedForBulk}
          onCheckedChange={(checked) => onToggleSelection(ticket.id, !!checked)}
          className="mr-2"
        />
        <div onClick={onSelect} className="cursor-pointer flex-grow">
          <div className="flex justify-between items-start mb-1">
            <span className="font-semibold text-primary text-xs truncate max-w-[80px] flex-shrink-0" title={`#${ticket.nro_ticket}`}>#{ticket.nro_ticket}</span>
            <Badge className={cn("text-xs border", ESTADOS[ticket.estado]?.tailwind_class)}>{ESTADOS[ticket.estado]?.label}</Badge>
          </div>
          <p className="font-medium text-foreground truncate text-xs" title={ticket.asunto}>{ticket.asunto}</p>
          {ticket.nombre_usuario && <p className="text-xs text-muted-foreground truncate mt-0.5" title={ticket.nombre_usuario}>{ticket.nombre_usuario}</p>}
        </div>
      </motion.div>
    </div>
  );
});

interface TicketListProps {
  tickets: TicketSummary[];
  selectedTicketId: number | null;
  onTicketSelect: (ticket: TicketSummary) => void;
  selectedTicketsForBulk: Set<number>;
  onToggleSelection: (ticketId: number, isSelected: boolean) => void;
}

const TicketList: React.FC<TicketListProps> = ({ tickets, selectedTicketId, onTicketSelect, selectedTicketsForBulk, onToggleSelection }) => {
  const parentRef = React.useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: tickets.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 90, // Estimate size of each item
    overscan: 5,
  });

  return (
    <div ref={parentRef} className="w-full h-full overflow-auto">
      <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
        {rowVirtualizer.getVirtualItems().map(virtualItem => {
          const ticket = tickets[virtualItem.index];
          return (
            <TicketListItem
              key={ticket.id}
              ticket={ticket}
              isSelected={selectedTicketId === ticket.id}
              onSelect={() => onTicketSelect(ticket)}
              isTicketSelectedForBulk={selectedTicketsForBulk.has(ticket.id)}
              onToggleSelection={onToggleSelection}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

export default TicketList;
