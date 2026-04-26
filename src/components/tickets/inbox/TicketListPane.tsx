import React from 'react';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow, differenceInHours } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertCircle, Clock } from 'lucide-react';

export interface TicketSummary {
  id: string;
  status: string;
  title: string;
  category?: string;
  lastMessageAt: string;
  unreadCount: number;
  slaLimitAt?: string; // Nuevo campo para SLA
}

interface TicketListPaneProps {
  tickets: TicketSummary[];
  selectedTicketId?: string;
  onSelect: (id: string) => void;
}

export const TicketListPane: React.FC<TicketListPaneProps> = ({ tickets, selectedTicketId, onSelect }) => {
  const getSLAIndicator = (slaLimitAt?: string) => {
    if (!slaLimitAt) return null;
    const limitDate = new Date(slaLimitAt);
    const now = new Date();
    const diffHours = differenceInHours(limitDate, now);

    if (limitDate < now) {
      return (
        <Badge variant="destructive" className="text-[10px] px-1.5 h-4 font-normal gap-1 mt-1">
          <AlertCircle className="w-3 h-3" /> Vencido
        </Badge>
      );
    } else if (diffHours <= 2) {
      return (
        <Badge variant="secondary" className="bg-orange-100 text-orange-800 hover:bg-orange-200 border-transparent text-[10px] px-1.5 h-4 font-normal gap-1 mt-1">
          <Clock className="w-3 h-3" /> Por vencer ({diffHours}h)
        </Badge>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col w-full h-full border-r bg-background overflow-hidden">
      <div className="p-4 border-b shrink-0 flex items-center justify-between">
        <h2 className="font-semibold text-lg">Bandeja de Entrada</h2>
        {/* Placeholder for filters */}
        <Badge variant="secondary">{tickets.length} activos</Badge>
      </div>
      <div className="flex-1 overflow-y-auto">
        {tickets.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">
            No hay tickets en la bandeja.
          </div>
        ) : (
          <ul className="divide-y">
            {tickets.map(ticket => (
              <li
                key={ticket.id}
                onClick={() => onSelect(ticket.id)}
                className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors flex flex-col gap-1.5 ${
                  selectedTicketId === ticket.id ? 'bg-muted border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <span className="font-medium text-sm truncate">{ticket.title}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                    {formatDistanceToNow(new Date(ticket.lastMessageAt), { addSuffix: true, locale: es })}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                   <div className="flex justify-between items-center mt-1">
                     <div className="flex gap-1.5">
                        <Badge variant="outline" className="text-[10px] px-1.5 h-4 font-normal">{ticket.status}</Badge>
                        {ticket.category && <Badge variant="secondary" className="text-[10px] px-1.5 h-4 font-normal">{ticket.category}</Badge>}
                     </div>
                     {ticket.unreadCount > 0 && (
                       <Badge variant="destructive" className="rounded-full w-5 h-5 p-0 flex items-center justify-center text-[10px]">
                         {ticket.unreadCount}
                       </Badge>
                     )}
                   </div>
                   <div className="flex items-center justify-start">
                     {getSLAIndicator(ticket.slaLimitAt)}
                   </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
