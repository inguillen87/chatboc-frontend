import React from 'react';
import { Ticket } from '@/types/tickets';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { FaWhatsapp } from 'react-icons/fa';
import { useDateSettings } from '@/hooks/useDateSettings';
import { formatTicketStatusLabel, normalizeTicketStatus } from '@/utils/ticketStatus';
import { shiftDateByHours } from '@/utils/date';

interface TicketListItemProps {
  ticket: Ticket;
  isSelected: boolean;
  onClick: () => void;
}

const TicketListItem: React.FC<TicketListItemProps> = ({ ticket, isSelected, onClick }) => {
const getInitials = (name: string) => {
    return name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : '??';
  };

  const { timezone, locale } = useDateSettings();
  const createdDate = shiftDateByHours(ticket.fecha, -3);
  const formattedTime = createdDate
    ? createdDate.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: timezone,
      })
    : '—';

  const subject = ticket.categoria || ticket.asunto || 'Sin asunto';

  return (
    <div
      className={cn(
        'p-3 rounded-lg border cursor-pointer transition-colors relative',
        isSelected ? 'bg-primary/10 border-primary' : 'bg-background hover:bg-muted/50',
        ticket.hasUnreadMessages && !isSelected && 'border-primary/50'
      )}
      onClick={onClick}
    >
      {ticket.hasUnreadMessages && !isSelected && (
        <span className="absolute top-2 right-2 h-3 w-3 rounded-full bg-primary" />
      )}
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={ticket.avatarUrl} alt={ticket.display_name} />
            <AvatarFallback>{getInitials(ticket.display_name || '')}</AvatarFallback>
          </Avatar>
          <div>
            <h4 className="text-sm font-semibold truncate" title={ticket.display_name}>
              {ticket.display_name}
            </h4>
            <p className="text-xs text-muted-foreground truncate max-w-[140px]">{ticket.nro_ticket}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="text-xs text-muted-foreground">{formattedTime}</span>
          {(() => {
            const normalizedStatus = normalizeTicketStatus(ticket.estado);
            const statusLabel = formatTicketStatusLabel(ticket.estado);
            const statusClass = cn(
              'text-xs capitalize px-1.5 py-0.5', // smaller padding
              normalizedStatus === 'nuevo' && 'bg-blue-500/80 text-white border-transparent',
              normalizedStatus === 'en_proceso' && 'bg-yellow-500/80 text-white border-transparent',
              normalizedStatus === 'resuelto' && 'bg-emerald-500/80 text-white border-transparent',
              !normalizedStatus && 'bg-muted-foreground/20 text-muted-foreground border-transparent'
            );

            return (
              <Badge variant="outline" className={statusClass}>
                {statusLabel}
              </Badge>
            );
          })()}
        </div>
      </div>
      <p className="font-semibold text-sm ml-13 mb-2">{subject}</p>
      <p className="text-sm text-muted-foreground truncate ml-13">{ticket.lastMessage || '...'}</p>
    </div>
  );
};

export default TicketListItem;
