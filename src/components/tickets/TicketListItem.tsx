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
    <div>
      <Card
        className={cn(
          'cursor-pointer mb-1.5 transition-all duration-200 ease-in-out border-l-4 rounded-lg shadow-sm',
          isSelected
            ? 'bg-primary/10 border-primary shadow-md'
            : 'border-transparent hover:bg-muted/60'
        )}
        onClick={onSelect}
      >
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <Avatar className="h-9 w-9 border">
                <AvatarImage src={ticket.municipio_nombre ? '/logo/chatboc_logo_original.png' : '/favicon/human-avatar.svg'} />
                <AvatarFallback>{ticket.nombre_usuario?.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-semibold truncate max-w-[200px] text-foreground">{ticket.asunto}</p>
                <p className="text-xs text-muted-foreground">De: {ticket.nombre_usuario}</p>
              </div>
            </div>
            <Badge className={cn('text-xs font-medium', estadoInfo.tailwind_class)}>{estadoInfo.label}</Badge>
          </div>

          <div className="flex items-end justify-between text-xs text-muted-foreground pl-12">
             <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{ticket.categoria || 'General'}</Badge>
                <div className="flex items-center gap-1">
                    <SlaIcon status={ticket.sla_status} />
                    {ticket.sla_status && <span className={cn('font-medium', SLA_STATUS_INFO[ticket.sla_status].color)}>{SLA_STATUS_INFO[ticket.sla_status].label}</span>}
                </div>
             </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              <span>{formatDate(ticket.fecha, timezone, locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TicketListItem;
