import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle2, Info, Paperclip, RefreshCcw, UserPlus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { TicketTimelineEvent } from '@/schemas/api';
import { formatTicketStatusLabel, normalizeTicketStatus } from '@/utils/ticketStatus';

import { ReadStateBadge } from './ReadStateBadge';

interface TimelineMergeViewProps {
  events: TicketTimelineEvent[];
}

export const TimelineMergeView: React.FC<TimelineMergeViewProps> = ({ events }) => (
  <div className="flex flex-col gap-4">
    {events.map((event) => {
      const eventDate = new Date(event.timestamp);
      const timeStr = Number.isNaN(eventDate.getTime())
        ? event.timestamp
        : format(eventDate, 'HH:mm', { locale: es });

      if (event.type === 'message_created') {
        const isOwn = event.actor.type === 'agent' || event.actor.type === 'system';
        const attachmentId =
          event.payload?.archivo_adjunto_id ||
          event.payload?.attachment_id ||
          event.payload?.file_id;

        return (
          <div
            key={event.id}
            className={`flex max-w-[80%] flex-col ${
              isOwn ? 'self-end items-end' : 'self-start items-start'
            }`}
          >
            <div className="mb-1 flex items-baseline gap-2">
              <span className="text-[10px] font-medium text-muted-foreground">
                {event.actor.name || event.actor.type}
              </span>
              <span className="text-[9px] text-muted-foreground/70">{timeStr}</span>
            </div>
            <div
              className={`rounded-lg p-3 text-sm ${
                isOwn
                  ? 'rounded-tr-sm bg-primary text-primary-foreground'
                  : 'rounded-tl-sm bg-muted'
              }`}
            >
              {(event.payload?.content as string) || 'Mensaje sin contenido'}
            </div>
            {attachmentId ? (
              <Badge variant="outline" className="mt-1 gap-1 text-[10px] font-normal">
                <Paperclip className="h-3 w-3" />
                Archivo {String(attachmentId)}
              </Badge>
            ) : null}
            {isOwn ? (
              <div className="mt-1">
                <ReadStateBadge status={(event.payload?.read_state as any) || 'sent'} />
              </div>
            ) : null}
          </div>
        );
      }

      let Icon = Info;
      const bgClass = 'bg-muted/50 text-muted-foreground';
      let message = '';

      if (event.type === 'status_changed') {
        Icon = RefreshCcw;
        const status = (event.payload?.new_status as string) || 'desconocido';
        if (normalizeTicketStatus(status) === 'resuelto') Icon = CheckCircle2;
        message = `${event.actor.name || 'Sistema'} cambio el estado a ${formatTicketStatusLabel(status)}`;
      } else if (event.type === 'assignment_changed') {
        Icon = UserPlus;
        const assigneeName = (event.payload?.new_assignee_name as string) || 'Nadie';
        message = `${event.actor.name || 'Sistema'} asigno el ticket a ${assigneeName}`;
      } else if (
        event.type === 'presence_changed' ||
        event.type === 'message_read' ||
        event.type === 'typing'
      ) {
        return null;
      }

      return (
        <div key={event.id} className="my-2 flex justify-center">
          <Badge
            variant="outline"
            className={`h-auto gap-1.5 border-transparent px-2 py-1 text-[10px] font-normal ${bgClass}`}
          >
            <Icon className="h-3 w-3" />
            <span>{message}</span>
            <span className="ml-1 text-muted-foreground/50">- {timeStr}</span>
          </Badge>
        </div>
      );
    })}
  </div>
);
