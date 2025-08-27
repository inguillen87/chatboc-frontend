import React from 'react';
import { formatDate } from '@/utils/fecha';
import { CheckCircle, Clock, MessageSquare } from 'lucide-react';
import { TicketHistoryEvent, Message } from '@/types/tickets';

interface TicketTimelineProps {
  history: TicketHistoryEvent[];
  messages?: Message[];
}

type TimelineEvent =
  | { type: 'status'; status: string; date: string; notes?: string }
  | { type: 'message'; date: string; author: string; content: string };

const TicketTimeline: React.FC<TicketTimelineProps> = ({ history, messages = [] }) => {
  const events: TimelineEvent[] = [
    ...history.map((h) => ({ type: 'status', ...h })),
    ...messages.map((m) => ({
      type: 'message',
      date: m.timestamp,
      author: m.agentName || (m.author === 'agent' ? 'Agente' : 'Vecino'),
      content: m.content,
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay historial disponible.</p>;
  }

  const lastStatusIndex = events.reduce(
    (last, evt, idx) => (evt.type === 'status' ? idx : last),
    -1
  );

  return (
    <ol className="relative border-l border-gray-200 dark:border-gray-700">
      {events.map((event, index) => {
        const isStatus = event.type === 'status';
        const isLastStatus = index === lastStatusIndex;
        const icon = isStatus
          ? isLastStatus
            ? <CheckCircle size={16} />
            : <Clock size={16} />
          : <MessageSquare size={16} />;
        const circleClass =
          isStatus && isLastStatus
            ? 'bg-green-500 text-white'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
        return (
          <li key={index} className="mb-8 ml-6">
            <span className={`absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full ring-8 ring-white dark:ring-gray-900 ${circleClass}`}>
              {icon}
            </span>
            {isStatus ? (
              <div className="flex flex-col gap-1">
                <h4 className="font-semibold">{event.status}</h4>
                <time className="text-sm text-muted-foreground">
                  {formatDate(
                    event.date,
                    Intl.DateTimeFormat().resolvedOptions().timeZone,
                    'es-AR'
                  )}
                </time>
                {'notes' in event && event.notes && (
                  <p className="text-sm mt-1">{event.notes}</p>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <h4 className="font-semibold">{event.author}</h4>
                <p className="mt-1">{event.content}</p>
                <time className="text-sm text-muted-foreground">
                  {formatDate(
                    event.date,
                    Intl.DateTimeFormat().resolvedOptions().timeZone,
                    'es-AR'
                  )}
                </time>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
};

export default TicketTimeline;
