import React from 'react';
import { motion } from 'framer-motion';
import { TicketSummary } from '@/pages/TicketsPanel';
import TicketListItem from './TicketListItem';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AnimatePresence } from 'framer-motion';

interface GroupedTickets {
  categoryName: string;
  tickets: TicketSummary[];
}

interface TicketListProps {
  groupedTickets: GroupedTickets[];
  selectedTicketId: number | null;
  onTicketSelect: (ticket: TicketSummary) => void;
  onToggleSelection: (ticketId: number) => void;
  isSelectionEnabled: boolean;
  selection?: Set<number>;
}

const TicketList: React.FC<TicketListProps> = ({
  groupedTickets,
  selectedTicketId,
  onTicketSelect,
}) => {
  const parentRef = React.useRef<HTMLDivElement>(null);

  const flatList = React.useMemo(() => {
    const items: (TicketSummary | { type: 'header'; name: string, count: number })[] = [];
    groupedTickets.forEach(group => {
      if (group.tickets.length > 0) {
        items.push({ type: 'header', name: group.categoryName, count: group.tickets.length });
        items.push(...group.tickets);
      }
    });
    return items;
  }, [groupedTickets]);

  const rowVirtualizer = useVirtualizer({
    count: flatList.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => (flatList[index] as any).type === 'header' ? 35 : 110,
    overscan: 5,
  });

  return (
    <div ref={parentRef} className="w-full h-full overflow-y-auto">
      <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
        <AnimatePresence>
          {rowVirtualizer.getVirtualItems().map(virtualItem => {
            const item = flatList[virtualItem.index];

            if ('type' in item && item.type === 'header') {
              return (
                <motion.div
                  key={item.name}
                  className="p-2 sticky top-0 bg-muted dark:bg-slate-800 z-10"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <h3 className="text-sm font-semibold text-muted-foreground px-2 mb-2">{item.name} ({item.count})</h3>
                </motion.div>
              );
            }

            const ticket = item as TicketSummary;
            return (
              <motion.div
                key={ticket.id}
                layout
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <TicketListItem
                  ticket={ticket}
                  isSelected={selectedTicketId === ticket.id}
                  onSelect={() => onTicketSelect(ticket)}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default TicketList;
