import React, { useMemo } from 'react';
import { Ticket, Comment } from '@/types/tickets';
import { cn } from '@/lib/utils';
import { useDateSettings } from '@/hooks/useDateSettings';
import { formatDate } from '@/utils/fecha';
import { GitCommit, MessageSquare, UserPlus } from 'lucide-react';

interface TimelineEvent {
  type: 'creation' | 'comment' | 'status_change' | 'assignment';
  date: string;
  author?: string;
  content: string;
  esAdmin?: boolean;
}

interface TicketTimelineProps {
  ticket: Ticket;
}

const getEventType = (comment: Comment): 'comment' | 'status_change' => {
    if (comment.comentario.startsWith('Estado cambiado a:')) return 'status_change';
    return 'comment';
}

const TimelineIcon: React.FC<{ type: TimelineEvent['type'], esAdmin?: boolean }> = ({ type, esAdmin }) => {
    const commonClass = "h-4 w-4 text-white";
    switch(type) {
        case 'creation': return <UserPlus className={commonClass} />;
        case 'comment': return <MessageSquare className={commonClass} />;
        case 'status_change': return <GitCommit className={commonClass} />;
        default: return <MessageSquare className={commonClass} />;
    }
};

const TicketTimeline: React.FC<TicketTimelineProps> = ({ ticket }) => {
    const { timezone, locale } = useDateSettings();

    const events = useMemo(() => {
        const allEvents: TimelineEvent[] = [];

        // Evento de creación
        allEvents.push({
            type: 'creation',
            date: ticket.fecha,
            author: ticket.nombre_usuario,
            content: `Ticket #${ticket.nro_ticket} creado.`,
            esAdmin: false,
        });

        // Eventos de comentarios
        (ticket.comentarios || []).forEach(comment => {
            allEvents.push({
                type: getEventType(comment),
                date: comment.fecha,
                author: comment.es_admin ? 'Agente' : ticket.nombre_usuario,
                content: comment.comentario,
                esAdmin: comment.es_admin,
            });
        });

        return allEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [ticket]);

    return (
        <div className="p-4 space-y-6">
            {events.map((event, index) => (
                <div key={index} className="flex gap-4">
                    <div className={cn("rounded-full h-8 w-8 flex items-center justify-center ring-4 ring-background", event.esAdmin ? 'bg-primary' : 'bg-muted-foreground')}>
                        <TimelineIcon type={event.type} esAdmin={event.esAdmin} />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center justify-between">
                            <p className="font-semibold text-sm">{event.author}</p>
                            <time className="text-xs text-muted-foreground">
                                {formatDate(event.date, timezone, locale, { dateStyle: 'medium', timeStyle: 'short' })}
                            </time>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1 bg-background/50 p-2 rounded-md">
                            {event.content}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default TicketTimeline;
