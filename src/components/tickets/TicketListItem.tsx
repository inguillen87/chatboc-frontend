import React from 'react';
import { Ticket } from '@/types/tickets';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { FaWhatsapp } from 'react-icons/fa';
import { useDateSettings } from '@/hooks/useDateSettings';
import { formatTicketStatusLabel, normalizeTicketStatus } from '@/utils/ticketStatus';
import { shiftDateByHours } from '@/utils/date';
import { AlertTriangle, UserRound } from 'lucide-react';

interface TicketListItemProps {
  ticket: Ticket;
  isSelected: boolean;
  onClick: () => void;
}

const TicketListItem: React.FC<TicketListItemProps> = ({ ticket, isSelected, onClick }) => {
const getInitials = (name: string) => {
    return name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : '??';
  };
  const normalizeText = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  };
  const priorityLabel = normalizeText(ticket.priority);
  const slaLabel = normalizeText(ticket.sla_status);
  const assignedLabel = normalizeText(
    ticket.assignedAgent?.nombre_usuario ||
      ticket.user?.nombre_usuario ||
      ticket.assignedAgentId ||
      ticket.assigned_agent_id,
  );
  const nextAction = normalizeText(ticket.recommended_next_action);
  const priorityTone = priorityLabel.toLowerCase();
  const slaTone = slaLabel.toLowerCase();
  const unreadViewers = Number(ticket.collaboration_state?.unread_viewer_count || 0);
  const activeViewers = Number(ticket.collaboration_state?.active_viewers_count || 0);
  const hasUnread = ticket.hasUnreadMessages || unreadViewers > 0;

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
        hasUnread && !isSelected && 'border-primary/50'
      )}
      onClick={onClick}
    >
      {hasUnread && !isSelected && (
        <span className="absolute top-2 right-2 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
          {unreadViewers > 0 ? unreadViewers : '•'}
        </span>
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
          {activeViewers > 0 ? (
            <Badge variant="secondary" className="text-[10px]">
              {activeViewers} viendo
            </Badge>
          ) : null}
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
      {(priorityLabel || slaLabel || assignedLabel) && (
        <div className="mb-2 ml-13 flex flex-wrap gap-1.5">
          {priorityLabel ? (
            <Badge
              variant="outline"
              className={cn(
                'gap-1 text-[10px]',
                (priorityTone.includes('alta') || priorityTone.includes('urgent')) &&
                  'border-amber-400/70 bg-amber-500/10 text-amber-700 dark:text-amber-200',
              )}
            >
              <AlertTriangle className="h-3 w-3" />
              {priorityLabel}
            </Badge>
          ) : null}
          {slaLabel ? (
            <Badge
              variant="outline"
              className={cn(
                'text-[10px]',
                (slaTone.includes('venc') || slaTone.includes('breach') || slaTone.includes('overdue')) &&
                  'border-red-400/70 bg-red-500/10 text-red-700 dark:text-red-200',
              )}
            >
              SLA: {slaLabel}
            </Badge>
          ) : null}
          {assignedLabel ? (
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <UserRound className="h-3 w-3" />
              {assignedLabel}
            </Badge>
          ) : null}
        </div>
      )}
      <p className="text-sm text-muted-foreground truncate ml-13">{ticket.lastMessage || '...'}</p>
      {nextAction ? (
        <p className="mt-2 ml-13 rounded-md border border-primary/20 bg-primary/5 px-2 py-1 text-xs text-primary">
          {nextAction}
        </p>
      ) : null}
    </div>
  );
};

export default TicketListItem;
