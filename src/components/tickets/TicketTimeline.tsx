import React from 'react';
import { fmtARWithOffset } from '@/utils/date';
import { CheckCircle, Clock, MessageSquare } from 'lucide-react';
import { TicketHistoryEvent, Message, Ticket } from '@/types/tickets';
import TicketMap from '../TicketMap';

interface TicketTimelineProps {
  history: TicketHistoryEvent[];
  messages?: Message[];
  ticket: Ticket | null;
}

type TimelineEvent =
  | { type: 'status'; status: string; date: string; notes?: string }
  | {
      type: 'message';
      date: string;
      author: string;
      origin: 'agent' | 'user';
      content: string;
    };

const formatStatus = (status: string) =>
  status
    ? status
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : '';

const TicketTimeline: React.FC<TicketTimelineProps> = ({ history, messages = [], ticket }) => {
  const events: TimelineEvent[] = [
    ...(history || []).map((h) => ({ type: 'status', ...h })),
    ...messages.map((m) => ({
      type: 'message',
      date: m.timestamp,
      author: m.agentName || (m.author === 'agent' ? 'Agente' : 'Vecino'),
      origin: m.author,
      content: m.content || '',
    })),
  ].sort(
    (a, b) =>
      (new Date(a.date).getTime() || 0) - (new Date(b.date).getTime() || 0)
  );

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay historial disponible.</p>;
  }

  const lastStatusIndex = events.reduce(
    (last, evt, idx) => (evt.type === 'status' ? idx : last),
    -1
  );

  const hasLocation = ticket && (ticket.latitud || ticket.longitud);

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
                <h4 className="font-semibold">{formatStatus(event.status)}</h4>
                <time className="text-sm text-muted-foreground">
                  {fmtARWithOffset(event.date, -3)}
                </time>
                {'notes' in event && event.notes && (
                  <p className="text-sm mt-1">{event.notes}</p>
                )}
                {hasLocation && (
                  <div className="mt-2">
                    <TicketMap ticket={ticket} />
                  </div>
                )}
              </div>
            ) : (
              <div className={`flex flex-col gap-1 ${event.origin === 'agent' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`px-3 py-2 rounded-lg max-w-[80%] ${
                    event.origin === 'agent'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm">{event.content}</p>
                </div>
                <time className="text-sm text-muted-foreground">
                  {fmtARWithOffset(event.date, -3)}
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
