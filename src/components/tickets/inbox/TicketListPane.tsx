import { inboxActivityTime } from './inboxWorkspaceModel';
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import type { OmnichannelInboxItem, OmnichannelLiveChatStatus } from '@/api/v2/saas';
import { MapPin, Paperclip } from 'lucide-react';
import { TicketSlaClocks } from '../TicketSlaClocks';

interface TicketListPaneProps {
  tickets: OmnichannelInboxItem[];
  selectedTicketId?: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
}

const formatRelativeTime = (value: string) => {
  const time = inboxActivityTime(value);
  if (time === null) return 'Fecha no informada';
  if (time > Date.now()) return 'Fecha por verificar';
  const date = new Date(time);
  return formatDistanceToNow(date, { addSuffix: true, locale: es });
};

const getSchoolCaseLabel = (ticket: OmnichannelInboxItem) =>
  ticket.school_case?.taxonomy_label ||
  ticket.school_case?.case_type ||
  ticket.school_case?.status ||
  ticket.school_case?.school_name ||
  null;

const liveChatLabel = (liveChat?: OmnichannelLiveChatStatus) => {
  const state = liveChat?.channel_state;
  if (state === 'queued') return 'En cola';
  if (state === 'online') return 'En vivo';
  if (state === 'offline') return 'Fuera de horario';
  return null;
};

const liveChatClassName = (state?: string) => {
  if (state === 'queued') return 'border-amber-400/50 bg-amber-500/10 text-amber-700 dark:text-amber-200';
  if (state === 'online') return 'border-emerald-400/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200';
  return 'border-slate-400/50 bg-slate-500/10 text-slate-700 dark:text-slate-200';
};

export const TicketListPane: React.FC<TicketListPaneProps> = ({ tickets, selectedTicketId, onSelect, disabled = false }) => {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden border-r bg-background">
      <div className="shrink-0 border-b p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Inbox 360</h2>
            <p className="text-xs text-muted-foreground">Conversaciones de los canales conectados</p>
          </div>
          <Badge variant="secondary">{tickets.length} cargadas</Badge>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {tickets.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">
            No hay tickets en la bandeja.
          </div>
        ) : (
          <ul className="divide-y">
            {tickets.map((ticket) => {
              const schoolCaseLabel = getSchoolCaseLabel(ticket);
              const liveLabel = liveChatLabel(ticket.live_chat);

              return (
                <li
                  key={ticket.id}
                  className={`flex cursor-pointer flex-col gap-2 border-l-4 p-4 transition-colors hover:bg-muted/50 ${
                    selectedTicketId === ticket.id ? 'border-l-primary bg-muted' : 'border-l-transparent'
                  }`}
                >
                  <button id={`inbox-case-${ticket.id}`} type="button" disabled={disabled} onClick={() => onSelect(ticket.id)} aria-pressed={selectedTicketId === ticket.id} aria-label={`Abrir conversación: ${ticket.title}`} className="inbox-ticket-select flex w-full items-start justify-between gap-2 text-left">
                    <span className="min-w-0 truncate text-sm font-medium">{ticket.title}</span>
                    <span className="mt-0.5 shrink-0 text-[10px] text-muted-foreground">
                      {formatRelativeTime(ticket.lastMessageAt)}
                    </span>
                  </button>
                  {ticket.description ? (
                    <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{ticket.description}</p>
                  ) : null}
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap gap-1.5">
                       <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">{ticket.status}</Badge>
                       {ticket.channel && <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">{ticket.channel}</Badge>}
                       {liveLabel ? (
                         <Badge
                           variant="outline"
                           className={`h-5 px-1.5 text-[10px] font-semibold ${liveChatClassName(ticket.live_chat?.channel_state)}`}
                           data-testid={`ticket-live-chat-state-${ticket.id}`}
                         >
                           {liveLabel}
                         </Badge>
                       ) : null}
                       {ticket.category && <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">{ticket.category}</Badge>}
                       {schoolCaseLabel ? (
                         <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">
                           {schoolCaseLabel}
                         </Badge>
                       ) : null}
                    </div>
                    {ticket.unreadCount > 0 && (
                      <Badge variant="destructive" className="rounded-full w-5 h-5 p-0 flex items-center justify-center text-[10px]">
                        {ticket.unreadCount}
                      </Badge>
                    )}
                  </div>
                  <div className="inbox-ticket-metadata flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                    <TicketSlaClocks sla={ticket.sla} compact />
                    <span className="flex items-center gap-1 rounded-[8px] border bg-background px-2 py-1">
                      <MapPin className="h-3 w-3 text-primary" />
                      {ticket.map?.can_render ? 'mapa' : 'timeline'}
                    </span>
                    <span className="flex items-center gap-1 rounded-[8px] border bg-background px-2 py-1">
                      <Paperclip className="h-3 w-3 text-primary" />
                      {ticket.attachments.length}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
