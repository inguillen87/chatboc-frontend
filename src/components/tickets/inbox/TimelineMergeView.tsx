import React from 'react';
import { TicketTimelineEvent } from '@/schemas/api';
import { RefreshCcw, UserPlus, Info, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ReadStateBadge } from './ReadStateBadge';
import { Badge } from '@/components/ui/badge';

interface TimelineMergeViewProps {
  events: TicketTimelineEvent[];
}

export const TimelineMergeView: React.FC<TimelineMergeViewProps> = ({ events }) => {
  // Normally, we would merge messages and events.
  // Here, we just render the raw TimelineEvent array based on the schema mapping to UI blocks.

  return (
    <div className="flex flex-col gap-4">
      {events.map((event) => {
        const timeStr = format(new Date(event.timestamp), 'HH:mm', { locale: es });

        if (event.type === 'message_created') {
          const isOwn = event.actor.type === 'agent' || event.actor.type === 'system';
          return (
            <div key={event.id} className={`flex flex-col max-w-[80%] ${isOwn ? 'self-end items-end' : 'self-start items-start'}`}>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-[10px] font-medium text-muted-foreground">{event.actor.name || event.actor.type}</span>
                <span className="text-[9px] text-muted-foreground/70">{timeStr}</span>
              </div>
              <div className={`p-3 rounded-lg text-sm ${isOwn ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted rounded-tl-sm'}`}>
                {event.payload?.content as string || 'Mensaje sin contenido'}
              </div>
              {isOwn && (
                 <div className="mt-1">
                   <ReadStateBadge status={(event.payload?.read_state as any) || 'sent'} />
                 </div>
              )}
            </div>
          );
        }

        // Render system/metadata events centrally
        let Icon = Info;
        let bgClass = "bg-muted/50 text-muted-foreground";
        let message = "";

        if (event.type === 'status_changed') {
          Icon = RefreshCcw;
          const status = event.payload?.new_status as string || 'desconocido';
          if (status === 'resuelto') Icon = CheckCircle2;
          message = `${event.actor.name} cambió el estado a ${status}`;
        } else if (event.type === 'assignment_changed') {
          Icon = UserPlus;
          const assigneeName = event.payload?.new_assignee_name as string || 'Nadie';
          message = `${event.actor.name} asignó el ticket a ${assigneeName}`;
        } else if (event.type === 'presence_changed' || event.type === 'message_read' || event.type === 'typing') {
           // Skip rendering granular typing/presence in the historical timeline log usually, unless requested.
           return null;
        }

        return (
          <div key={event.id} className="flex justify-center my-2">
            <Badge variant="outline" className={`font-normal text-[10px] gap-1.5 px-2 py-1 h-auto border-transparent ${bgClass}`}>
              <Icon className="w-3 h-3" />
              <span>{message}</span>
              <span className="text-muted-foreground/50 ml-1">• {timeStr}</span>
            </Badge>
          </div>
        );
      })}
    </div>
  );
};
