import React from 'react';
import { TicketSummary, ESTADOS, SLA_STATUS_INFO, PRIORITY_INFO } from '@/types/tickets';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDate } from '@/utils/fecha';
import { useDateSettings } from '@/hooks/useDateSettings';
import { ShieldAlert, ShieldCheck, ShieldX, Clock, AlertTriangle } from 'lucide-react';

interface TicketListItemProps {
  ticket: TicketSummary;
  isSelected: boolean;
  onSelect: () => void;
}

const SlaIcon: React.FC<{ status: TicketSummary['sla_status'] }> = ({ status }) => {
  if (!status) return null;
  const props = { className: cn("h-4 w-4", SLA_STATUS_INFO[status].color) };
  switch (status) {
    case 'on_track': return <ShieldCheck {...props} />;
    case 'nearing_sla': return <ShieldAlert {...props} />;
    case 'breached': return <ShieldX {...props} />;
    default: return null;
  }
};

const TicketListItem: React.FC<TicketListItemProps> = ({ ticket, isSelected, onSelect }) => {
  const { timezone, locale } = useDateSettings();
  const estadoInfo = ESTADOS[ticket.estado];

  return (
    <Card
      className={cn(
        'cursor-pointer mb-2 transition-all duration-200 ease-in-out border-l-4',
        isSelected
          ? 'bg-primary/10 border-primary'
          : 'hover:bg-muted/50 border-transparent'
      )}
      onClick={onSelect}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center space-x-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={ticket.municipio_nombre ? '/logo/chatboc_logo_original.png' : '/favicon/human-avatar.svg'} />
              <AvatarFallback>{ticket.nombre_usuario?.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <p className="text-sm font-semibold truncate max-w-[200px]">{ticket.asunto}</p>
          </div>
          <div className="text-xs text-muted-foreground">
            #{ticket.nro_ticket}
          </div>
        </div>

        <div className="text-xs text-muted-foreground ml-11 mb-3">
          <p>De: {ticket.nombre_usuario}</p>
        </div>

        <div className="flex items-center justify-between ml-11">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-xs">{ticket.categoria || 'General'}</Badge>
            <div className="flex items-center gap-1">
              <SlaIcon status={ticket.sla_status} />
              {ticket.sla_status && <span className={SLA_STATUS_INFO[ticket.sla_status].color}>{SLA_STATUS_INFO[ticket.sla_status].label}</span>}
            </div>
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDate(ticket.fecha, timezone, locale, { month: 'short', day: 'numeric' })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TicketListItem;
