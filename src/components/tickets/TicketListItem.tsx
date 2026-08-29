import React from 'react';
import { Ticket } from '@/types/tickets';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useDateSettings } from '@/hooks/useDateSettings';
import { formatTicketStatusLabel, normalizeTicketStatus } from '@/utils/ticketStatus';
import { shiftDateByHours } from '@/utils/date';
import { AlertTriangle, CheckCircle2, Clock, MapPin, Sparkles, UserRound } from 'lucide-react';
import { IdentityAvatar } from '@/components/identity/IdentityAvatar';
import { resolveConsentedAvatar } from '@/utils/avatarConsent';
import { motion } from 'framer-motion';

interface TicketListItemProps {
  ticket: Ticket;
  isSelected: boolean;
  onClick: () => void;
  compact?: boolean;
}

const getCategoryColor = (category?: string) => {
  const cat = (category || '').toLowerCase();
  if (cat.includes('alumbrad') || cat.includes('luz') || cat.includes('electr')) {
    return { border: 'border-l-amber-500', bg: 'bg-amber-500/10 text-amber-800 dark:text-amber-300' };
  }
  if (cat.includes('bach') || cat.includes('calle') || cat.includes('obra')) {
    return { border: 'border-l-blue-500', bg: 'bg-blue-500/10 text-blue-700 dark:text-blue-300' };
  }
  if (cat.includes('arbol') || cat.includes('poda') || cat.includes('verde') || cat.includes('plaza')) {
    return { border: 'border-l-emerald-500', bg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' };
  }
  if (cat.includes('limpieza') || cat.includes('higiene') || cat.includes('residu') || cat.includes('basura')) {
    return { border: 'border-l-cyan-500', bg: 'bg-cyan-500/10 text-cyan-800 dark:text-cyan-300' };
  }
  if (cat.includes('seguridad') || cat.includes('transit') || cat.includes('vial')) {
    return { border: 'border-l-purple-500', bg: 'bg-purple-500/10 text-purple-700 dark:text-purple-300' };
  }
  return { border: 'border-l-primary', bg: 'bg-blue-500/10 text-blue-700 dark:text-blue-300' };
};

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
  const distritoLabel = normalizeText(ticket.distrito || ticket.barrio);
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
    'text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border',
    normalizedStatus === 'nuevo' && 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
    normalizedStatus === 'esperando_agente_en_vivo' && 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
    normalizedStatus === 'en_vivo' && 'bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border-cyan-500/30',
    normalizedStatus === 'en_proceso' && 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
    normalizedStatus === 'resuelto' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    !normalizedStatus && 'bg-muted text-slate-700 dark:text-slate-300 border-border/80',
  );

  const categoryColors = getCategoryColor(categoryLabel);

  if (compact) {
    return (
      <motion.button
        type="button"
        whileHover={{ x: 2 }}
        whileTap={{ scale: 0.99 }}
        className={cn(
          'relative w-full p-2.5 text-left transition-all rounded-xl border-l-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
          categoryColors.border,
          isSelected
            ? 'bg-primary/10 shadow-sm border border-primary/30'
            : 'bg-card/70 hover:bg-muted/60 border-t border-r border-b border-border/50',
          hasUnread && !isSelected && 'bg-primary/[0.04]',
        )}
        onClick={onClick}
        aria-pressed={isSelected}
        aria-label={`Abrir ticket ${ticket.nro_ticket || ticket.id}`}
      >
        {hasUnread && !isSelected && (
          <span className="absolute right-2 top-2 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground animate-pulse">
            {unreadBadgeLabel}
          </span>
        )}
        <div className="flex min-w-0 items-start gap-2.5">
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
                <h2 className="line-clamp-1 text-xs font-bold leading-4 text-foreground" title={subject}>
                  {subject}
                </h2>
                <p
                  className="line-clamp-1 text-[11px] text-slate-700 dark:text-slate-300"
                  title={`${ticketNumber} - ${displayName}`}
                  aria-label={`Ticket ${ticketNumber}, contacto ${displayName}`}
                >
                  <span className="font-bold text-foreground/80">{ticketNumber}</span>
                  <span aria-hidden="true" className="mx-1 text-muted-foreground/60">•</span>
                  {displayName}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-[10px] font-medium text-slate-700 dark:text-slate-300">{formattedTime}</span>
                <span className={statusClass}>{statusLabel}</span>
              </div>
            </div>
            {categoryLabel && (
              <div className="mt-1.5 flex min-w-0 items-center gap-1 overflow-hidden">
                <span className={cn("truncate rounded-lg px-2 py-0.5 text-[10px] font-extrabold", categoryColors.bg)}>
                  {categoryLabel}
                </span>
                {distritoLabel && (
                  <span className="truncate rounded-lg bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground flex items-center gap-0.5">
                    <MapPin className="w-2.5 h-2.5" />
                    {distritoLabel}
                  </span>
                )}
              </div>
            )}
            {nextAction ? (
              <p
                className="mt-1.5 line-clamp-1 rounded-md border border-primary/20 bg-primary/5 px-2 py-1 text-[11px] font-medium leading-4 text-primary"
                title={`Próximo paso: ${nextAction}`}
              >
                <span className="font-semibold">Próximo paso: </span>
                {nextAction}
              </p>
            ) : null}
          </div>
        </div>
      </motion.button>
    );
  }

  return (
    <motion.button
      type="button"
      whileHover={{ y: -1.5, scale: 1.008 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.15 }}
      className={cn(
        'relative w-full rounded-2xl border text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 border-l-[5px]',
        categoryColors.border,
        'p-3.5 shadow-sm',
        isSelected
          ? 'border-primary/60 bg-gradient-to-r from-primary/10 via-primary/5 to-background shadow-md ring-1 ring-primary/25'
          : 'border-border/70 bg-card/80 backdrop-blur-sm hover:bg-muted/40 hover:shadow-md',
        hasUnread && !isSelected && 'border-primary/40 bg-primary/[0.02]',
      )}
      onClick={onClick}
      aria-pressed={isSelected}
      aria-label={`Abrir ticket ${ticket.nro_ticket || ticket.id}`}
    >
      {hasUnread && !isSelected && (
        <span className="absolute top-3 right-3 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-black text-primary-foreground shadow-sm animate-pulse">
          {unreadBadgeLabel}
        </span>
      )}
      
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <IdentityAvatar name={displayName} avatarUrl={avatarUrl} source={avatarSource} consented={avatar.consented} size="lg" />
          <div className="min-w-0 space-y-0.5">
            <h2 className="line-clamp-2 text-sm font-extrabold leading-snug text-foreground tracking-tight" title={subject}>
              {subject}
            </h2>
            <div
              className="flex min-w-0 flex-wrap items-center gap-1.5 pt-0.5"
              title={`${ticketNumber} - ${displayName}`}
              aria-label={`Ticket ${ticketNumber}, contacto ${displayName}`}
            >
              <span className="font-black text-xs text-primary">{ticketNumber}</span>
              <span aria-hidden="true" className="text-muted-foreground/60 text-xs">•</span>
              <span className="truncate text-xs font-semibold text-foreground/85" title={displayName}>
                {displayName}
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
            <Clock className="w-3 h-3 text-muted-foreground/70" />
            {formattedTime}
          </span>
          <span className={statusClass}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Badges strip */}
      <div className="mb-2.5 flex flex-wrap items-center gap-1.5 overflow-hidden pl-[48px]">
        {categoryLabel ? (
          <span className={cn("truncate rounded-lg px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide", categoryColors.bg)}>
            {categoryLabel}
          </span>
        ) : null}

        {distritoLabel ? (
          <span className="truncate rounded-lg bg-muted/80 px-2 py-0.5 text-[10px] font-bold text-muted-foreground flex items-center gap-1">
            <MapPin className="w-3 h-3 text-primary/70" />
            {distritoLabel}
          </span>
        ) : null}

        {priorityLabel ? (
          <Badge
            variant="outline"
            className={cn(
              'gap-1 text-[10px] font-bold rounded-lg px-2 py-0.5',
              (priorityTone.includes('alta') || priorityTone.includes('urgent')) &&
                'border-amber-400/70 bg-amber-500/15 text-amber-700 dark:text-amber-300',
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
              'text-[10px] font-bold rounded-lg px-2 py-0.5',
              (slaTone.includes('venc') || slaTone.includes('breach') || slaTone.includes('overdue')) &&
                'border-rose-400/70 bg-rose-500/15 text-rose-700 dark:text-rose-300 animate-pulse',
            )}
          >
            SLA: {slaLabel}
          </Badge>
        ) : null}

        {assignedLabel ? (
          <Badge variant="secondary" className="gap-1 text-[10px] font-semibold rounded-lg px-2 py-0.5">
            <UserRound className="h-3 w-3" />
            {assignedLabel}
          </Badge>
        ) : null}
      </div>

      <p className="line-clamp-2 pl-[48px] text-xs leading-relaxed text-muted-foreground font-normal">
        {ticket.lastMessage || ticket.description || 'Sin mensajes adicionales'}
      </p>

      {nextAction ? (
        <div className="mt-2.5 line-clamp-1 rounded-xl border border-primary/25 bg-primary/10 px-3 py-1.5 text-[11px] font-bold leading-none text-primary ml-[48px] flex items-center gap-1.5 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="truncate">
            <span className="uppercase text-[9px] tracking-wider text-primary/70 mr-1">Sugerencia IA:</span>
            {nextAction}
          </span>
        </div>
      ) : null}
    </motion.button>
  );
};

export default TicketListItem;
