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

const TicketListItem: React.FC<TicketListItemProps> = ({ ticket, isSelected, onClick }) => {
const getInitials = (nombre_usuario: string) => {
    return nombre_usuario ? nombre_usuario.split(' ').map(n => n[0]).join('').toUpperCase() : '??';
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
            <AvatarImage src={ticket.avatarUrl} alt={ticket.nombre_usuario} />
            <AvatarFallback>{getInitials(ticket.nombre_usuario || '')}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-sm">{ticket.nombre_usuario || 'Usuario desconocido'}</p>
            <p className="text-xs text-muted-foreground">{ticket.nro_ticket}</p>
          </div>
        </div>
        <span className="text-xs text-muted-foreground">
          {new Date(ticket.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <p className="font-semibold text-sm ml-13 mb-2">{ticket.asunto}</p>
      <p className="text-sm text-muted-foreground truncate ml-13">{ticket.lastMessage || '...'}</p>
      <div className="flex items-center justify-between mt-2 ml-13">
         <Badge variant={ticket.estado === 'nuevo' ? 'default' : 'outline'}
               className={cn(
                'capitalize',
                ticket.estado === 'nuevo' && 'bg-blue-500 text-white',
                ticket.estado === 'abierto' && 'text-green-500 border-green-500',
                ticket.estado === 'en_proceso' && 'text-yellow-500 border-yellow-500',
               )}>
          {ticket.estado}
        </Badge>
        {ticket.categoria && <p className="text-xs font-bold text-muted-foreground">{ticket.categoria}</p>}
      </div>
    </div>
  );
};

export default TicketListItem;
