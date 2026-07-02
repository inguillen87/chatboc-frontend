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
  const normalizedStatus = normalizeTicketStatus(ticket.estado);
  const statusLabel = formatTicketStatusLabel(ticket.estado);
  const statusClass = cn(
    'text-xs capitalize px-1.5 py-0.5',
    normalizedStatus === 'nuevo' && 'bg-blue-500/80 text-white border-transparent',
    normalizedStatus === 'en_proceso' && 'bg-yellow-500/80 text-white border-transparent',
    normalizedStatus === 'resuelto' && 'bg-emerald-500/80 text-white border-transparent',
    !normalizedStatus && 'bg-muted-foreground/20 text-muted-foreground border-transparent',
  );

  if (compact) {
    return (
      <button
        type="button"
        className={cn(
          'relative w-full rounded-lg border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
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
          <span className="absolute right-2 top-2 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {unreadBadgeLabel}
          </span>
        )}
        <div className="flex min-w-0 items-start gap-2">
          <IdentityAvatar
            name={displayName}
            avatarUrl={avatarUrl}
            source={avatarSource}
            consented={avatar.consented}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0">
                <h4 className="line-clamp-1 text-sm font-semibold leading-5 text-foreground" title={subject}>
                  {subject}
                </h4>
                <p className="line-clamp-1 text-[11px] leading-4 text-muted-foreground" title={`${ticketNumber} - ${displayName}`}>
                  {ticketNumber} - {displayName}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-[11px] leading-4 text-muted-foreground">{formattedTime}</span>
                <Badge variant="outline" className={statusClass}>
                  {statusLabel}
                </Badge>
              </div>
            </div>
            {(categoryLabel || priorityLabel || slaLabel || assignedLabel) && (
              <div className="mt-1 flex min-w-0 items-center gap-1 overflow-hidden">
                {categoryLabel && categoryLabel !== subject ? (
                  <Badge variant="outline" className="max-w-[7rem] shrink truncate px-1.5 py-0 text-[10px] font-semibold">
                    {categoryLabel}
                  </Badge>
                ) : null}
                {priorityLabel ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      'shrink-0 gap-1 px-1.5 py-0 text-[10px]',
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
                      'shrink-0 px-1.5 py-0 text-[10px]',
                      (slaTone.includes('venc') || slaTone.includes('breach') || slaTone.includes('overdue')) &&
                        'border-red-400/70 bg-red-500/10 text-red-700 dark:text-red-200',
                    )}
                  >
                    SLA: {slaLabel}
                  </Badge>
                ) : null}
                {assignedLabel ? (
                  <Badge variant="secondary" className="min-w-0 shrink truncate px-1.5 py-0 text-[10px]">
                    {assignedLabel}
                  </Badge>
                ) : null}
              </div>
            )}
            <p className="mt-1 line-clamp-1 text-xs leading-4 text-muted-foreground">
              {ticket.lastMessage || '...'}
            </p>
            {nextAction ? <span className="sr-only">Accion sugerida: {nextAction}</span> : null}
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        'relative w-full rounded-lg border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'p-3',
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
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <IdentityAvatar name={displayName} avatarUrl={avatarUrl} source={avatarSource} consented={avatar.consented} size="lg" />
          <div className="min-w-0 space-y-0.5">
            <h4 className="line-clamp-2 text-sm font-semibold leading-5 text-foreground" title={subject}>
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
          <Badge variant="outline" className={statusClass}>
            {statusLabel}
          </Badge>
        </div>
      </div>
      {(priorityLabel || slaLabel || assignedLabel) && (
        <div className="mb-2 flex flex-wrap gap-1.5 overflow-hidden pl-[52px]">
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
      <p className="line-clamp-2 pl-[52px] text-sm leading-5 text-muted-foreground">{ticket.lastMessage || '...'}</p>
      {nextAction ? (
        <p className="mt-2 line-clamp-2 rounded-md border border-primary/20 bg-primary/5 px-2 py-1 text-xs leading-4 text-primary sm:ml-[52px]">
          {nextAction}
        </p>
      ) : null}
    </button>
  );
};

export default TicketListItem;
