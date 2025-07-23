import React from 'react';
import { TicketSummary, ESTADOS } from '@/pages/TicketsPanel';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDate } from '@/utils/fecha';
import { useDateSettings } from '@/hooks/useDateSettings';

interface TicketListItemProps {
  ticket: TicketSummary;
  isSelected: boolean;
  onSelect: () => void;
}

const TicketListItem: React.FC<TicketListItemProps> = ({ ticket, isSelected, onSelect }) => {
  const { timezone, locale } = useDateSettings();
  const estadoInfo = ESTADOS[ticket.estado];

  return (
    <Card
      className={cn(
        'cursor-pointer mb-2 transition-all duration-200 ease-in-out',
        isSelected ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
      )}
      onClick={onSelect}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={ticket.municipio_nombre ? '/logo/chatboc_logo_original.png' : '/favicon/human-avatar.svg'} />
              <AvatarFallback>{ticket.nombre_usuario?.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-sm font-semibold truncate max-w-[200px]">{ticket.asunto}</p>
              <p className="text-xs text-muted-foreground">{ticket.nombre_usuario}</p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground text-right">
            <p>{formatDate(ticket.fecha, timezone, locale, { month: 'short', day: 'numeric' })}</p>
            <p>#{ticket.nro_ticket}</p>
          </div>
        </div>
        <div className="flex items-center justify-between mt-2">
          <div>
            <Badge variant="outline" className="text-xs">{ticket.categoria || 'Sin Categoria'}</Badge>
          </div>
          <Badge className={cn('text-xs', estadoInfo.tailwind_class)}>{estadoInfo.label}</Badge>
        </div>
      </CardContent>
    </Card>
  );
};

export default TicketListItem;
