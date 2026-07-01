import React from 'react';
import { Ticket } from '@/types/tickets';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useDateSettings } from '@/hooks/useDateSettings';
import { formatTicketStatusLabel, normalizeTicketStatus } from '@/utils/ticketStatus';
import { shiftDateByHours } from '@/utils/date';
import { AlertTriangle, UserRound } from 'lucide-react';
import { IdentityAvatar } from '@/components/identity/IdentityAvatar';
import { resolveConsentedAvatar } from '@/utils/avatarConsent';

interface TicketListItemProps {
  ticket: Ticket;
  isSelected: boolean;
  onClick: () => void;
  compact?: boolean;
}

const TicketListItem: React.FC<TicketListItemProps> = ({ ticket, isSelected, onClick, compact = false }) => {
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
  const unreadBadgeLabel = unreadViewers > 0 ? unreadViewers : 1;

  const { timezone, locale } = useDateSettings();
  const createdDate = shiftDateByHours(ticket.fecha, -3);
  const formattedTime = createdDate
    ? createdDate.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: timezone,
      })
    : '-';

  const categoryLabel = normalizeText(
    ticket.categoria || ticket.categoria_principal || ticket.categoria_simple,
  );
  const rawSubject = normalizeText(ticket.asunto || ticket.title);
  const descriptionLabel = normalizeText(ticket.description || ticket.lastMessage);
  const subjectLooksLikeCategory =
    Boolean(categoryLabel && rawSubject) &&
    categoryLabel.toLowerCase() === rawSubject.toLowerCase();
  const subject =
    rawSubject && !subjectLooksLikeCategory
      ? rawSubject
      : descriptionLabel || rawSubject || categoryLabel || 'Sin asunto';
  const displayName = normalizeText(ticket.display_name) || 'Contacto sin nombre';
  const avatar = resolveConsentedAvatar(
    ticket as unknown as Record<string, unknown>,
    ticket.user as unknown as Record<string, unknown> | null | undefined,
  );
  const avatarUrl = normalizeText(avatar.avatarUrl);
  const avatarSource = normalizeText(avatar.source || ticket.avatar_source) || (avatarUrl ? 'imagen consentida' : 'iniciales');
  const ticketNumber = normalizeText(ticket.nro_ticket) || `#${ticket.id}`;

  return (
    <button
      type="button"
      className={cn(
        'relative w-full rounded-lg border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        compact ? 'p-2' : 'p-3',
        isSelected
          ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary/20'
          : 'border-border/80 bg-background hover:bg-muted/50',
        hasUnread && !isSelected && 'border-primary/50',
      )}
      onClick={onClick}
      aria-pressed={isSelected}
      aria-label={`Abrir ticket ${ticket.nro_ticket || ticket.id}`}
    >
      {hasUnread && !isSelected && (
        <span className="absolute top-2 right-2 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
          {unreadBadgeLabel}
        </span>
      )}
      <div className={cn('flex items-start justify-between gap-2', compact ? 'mb-1.5' : 'mb-2')}>
        <div className={cn('flex min-w-0 items-start', compact ? 'gap-2' : 'gap-3')}>
          <IdentityAvatar name={displayName} avatarUrl={avatarUrl} source={avatarSource} consented={avatar.consented} size={compact ? 'md' : 'lg'} />
          <div className="min-w-0 space-y-0.5">
            <h4 className={cn('text-sm font-semibold leading-5 text-foreground', compact ? 'line-clamp-1' : 'line-clamp-2')} title={subject}>
              {subject}
            </h4>
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <p className="truncate text-xs text-muted-foreground" title={`${ticketNumber} - ${displayName}`}>
                {ticketNumber} - {displayName}
              </p>
              {categoryLabel && categoryLabel !== subject ? (
                <Badge variant="outline" className="max-w-[8rem] truncate px-1.5 py-0 text-[10px] font-semibold">
                  {categoryLabel}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
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
      {(priorityLabel || slaLabel || assignedLabel) && (
        <div className={cn('flex gap-1.5 overflow-hidden', compact ? 'mb-1.5 pl-10' : 'mb-2 flex-wrap pl-[52px]')}>
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
      <p className={cn('text-sm leading-5 text-muted-foreground', compact ? 'line-clamp-1 pl-10' : 'line-clamp-2 pl-[52px]')}>{ticket.lastMessage || '...'}</p>
      {nextAction ? (
        <p className={cn(
          'rounded-md border border-primary/20 bg-primary/5 px-2 py-1 text-xs leading-4 text-primary',
          compact ? 'mt-1 line-clamp-1 sm:ml-10' : 'mt-2 line-clamp-2 sm:ml-[52px]',
        )}>
          {nextAction}
        </p>
      ) : null}
    </button>
  );
};

export default TicketListItem;
