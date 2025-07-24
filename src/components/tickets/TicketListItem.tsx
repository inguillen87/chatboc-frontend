import React from 'react';
import { Ticket } from '@/types/tickets';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TicketListItemProps {
  ticket: Ticket;
  isSelected: boolean;
  onClick: () => void;
}

const statusColors: { [key in Ticket['status']]: string } = {
  nuevo: 'bg-blue-500',
  abierto: 'bg-green-500',
  'en-espera': 'bg-yellow-500',
  resuelto: 'bg-gray-500',
  cerrado: 'bg-red-500',
};

const TicketListItem: React.FC<TicketListItemProps> = ({ ticket, isSelected, onClick }) => {
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

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
            <AvatarImage src={ticket.avatarUrl || ticket.user?.avatarUrl} alt={ticket.name || ticket.user?.name} />
            <AvatarFallback>{getInitials(ticket.name || ticket.user?.name || '??')}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-sm">{ticket.name || ticket.user?.name}</p>
            <p className="text-xs text-muted-foreground">{ticket.id}</p>
          </div>
        </div>
        <span className="text-xs text-muted-foreground">
          {new Date(ticket.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <p className="font-semibold text-sm ml-13 mb-2">{ticket.title}</p>
      <p className="text-sm text-muted-foreground truncate ml-13">{ticket.lastMessage}</p>
      <div className="flex items-center justify-start mt-2 ml-13">
         <Badge variant={ticket.status === 'nuevo' ? 'default' : 'outline'}
               className={cn(
                'capitalize',
                ticket.status === 'nuevo' && 'bg-blue-500 text-white',
                ticket.status === 'abierto' && 'text-green-500 border-green-500',
                ticket.status === 'en-espera' && 'text-yellow-500 border-yellow-500',
                ticket.status === 'resuelto' && 'text-gray-500 border-gray-500',
                ticket.status === 'cerrado' && 'text-red-500 border-red-500',
               )}>
          {ticket.status}
        </Badge>
      </div>
    </div>
  );
};

export default TicketListItem;
