import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TicketSummary, ESTADOS, PriorityStatus } from '@/pages/TicketsPanel'; // Import PriorityStatus
import { Checkbox } from "@/components/ui/checkbox";
import { useVirtualizer } from '@tanstack/react-virtual';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, Clock } from 'lucide-react';

interface TicketListItemProps {
  ticket: TicketSummary;
  isSelected: boolean;
  onSelect: () => void;
  onToggleSelection: (ticketId: number, selected: boolean) => void;
  isSelectionEnabled: boolean;
  style: React.CSSProperties;
}

const PRIORITY_STYLES: Record<NonNullable<PriorityStatus>, string> = {
  high: "bg-red-500",
  medium: "bg-yellow-500",
  low: "bg-gray-400",
};

const TicketListItem: React.FC<TicketListItemProps> = React.memo(({ ticket, isSelected, onSelect, onToggleSelection, isSelectionEnabled, style }) => {
  const cardClasses = cn(
    "bg-card dark:bg-slate-800/80 border-l-4 cursor-pointer mb-2 transition-colors duration-200",
    "hover:bg-muted/80 dark:hover:bg-slate-700/60",
    {
      "border-primary bg-primary/10 dark:bg-primary/20": isSelected,
      "border-transparent": !isSelected,
      "border-red-500/80": !isSelected && ticket.sla_status === 'breached',
      "border-yellow-500/80": !isSelected && ticket.sla_status === 'nearing_sla',
    }
  );

  return (
    <motion.div
      layout
      onClick={onSelect}
      className={cardClasses}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      style={style}
    >
      <div className="p-3 flex items-start gap-3">
        {isSelectionEnabled && <Checkbox className="mt-1" onCheckedChange={(checked) => onToggleSelection(ticket.id, !!checked)} />}
        <div className="flex-grow min-w-0">
          <div className="flex justify-between items-center mb-1">
            <span className="font-semibold text-foreground text-sm truncate" title={ticket.nombre_usuario || 'Usuario desconocido'}>
              {ticket.nombre_usuario || 'Usuario desconocido'}
            </span>
            <div className="flex items-center gap-2">
                {ticket.priority && PRIORITY_STYLES[ticket.priority] && (
                    <span className={cn("h-2.5 w-2.5 rounded-full", PRIORITY_STYLES[ticket.priority])} title={`Prioridad: ${ticket.priority}`}></span>
                )}
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(ticket.fecha), { addSuffix: true, locale: es })}
                </span>
            </div>
          </div>
          <p className="font-medium text-foreground truncate text-sm" title={ticket.asunto}>{ticket.asunto}</p>
          <p className="text-xs text-muted-foreground truncate mt-1" title={ticket.detalles}>
            {ticket.detalles || 'Sin detalles adicionales...'}
          </p>
          <div className="flex items-center justify-between mt-2 text-xs">
             <Badge variant="outline" className={cn("text-xs", ESTADOS[ticket.estado]?.tailwind_class)}>
                {ESTADOS[ticket.estado]?.label}
             </Badge>
             <div className="flex items-center gap-1.5">
                {ticket.sla_status === 'breached' && <AlertTriangle className="h-3.5 w-3.5 text-red-500" title="SLA Vencido" />}
                {ticket.sla_status === 'nearing_sla' && <Clock className="h-3.5 w-3.5 text-yellow-500" title="Próximo a vencer SLA" />}
             </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

interface GroupedTicketListProps {
  groupedTickets: { categoryName: string; tickets: TicketSummary[] }[];
  selectedTicketId: number | null;
  onTicketSelect: (ticket: TicketSummary) => void;
  onToggleSelection: (ticketId: number, selected: boolean) => void;
  isSelectionEnabled: boolean;
}

const TicketList: React.FC<GroupedTicketListProps> = ({ groupedTickets, selectedTicketId, onTicketSelect, onToggleSelection, isSelectionEnabled }) => {
  const parentRef = React.useRef<HTMLDivElement>(null);

  // Aplanar la lista para la virtualización, insertando cabeceras
  const flatList = React.useMemo(() => {
    const items: (TicketSummary | { type: 'header'; name: string })[] = [];
    groupedTickets.forEach(group => {
      items.push({ type: 'header', name: group.categoryName });
      items.push(...group.tickets);
    });
    return items;
  }, [groupedTickets]);

  const rowVirtualizer = useVirtualizer({
    count: flatList.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => (flatList[index] as any).type === 'header' ? 35 : 110, // Estimar diferente tamaño para cabeceras y tickets
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
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">{item.name}</h3>
                </motion.div>
              );
            }

            const ticket = item as TicketSummary;
            return (
              <TicketListItem
                key={ticket.id}
                ticket={ticket}
                isSelected={selectedTicketId === ticket.id}
                onSelect={() => onTicketSelect(ticket)}
                onToggleSelection={onToggleSelection}
                isSelectionEnabled={isSelectionEnabled}
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
        </AnimatePresence>
      </div>
    </div>
  );
};

export default TicketList;
