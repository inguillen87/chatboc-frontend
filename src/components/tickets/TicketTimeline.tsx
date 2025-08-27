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
    return null;
  }

  return (
    <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:bg-gray-200 dark:before:bg-gray-700">
      {events.map((event, index) => {
        const isLastEvent = index === events.length - 1;
        const isStatus = event.type === 'status';
        const circleClass =
          isStatus && isLastEvent
            ? 'bg-green-500 text-white'
            : 'bg-gray-200 dark:bg-gray-700';
        return (
          <div key={index} className="relative flex items-start">
            <div
              className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${circleClass}`}
            >
              {isStatus ? (
                isLastEvent ? (
                  <CheckCircle size={20} />
                ) : (
                  <Clock size={20} />
                )
              ) : (
                <MessageSquare size={20} />
              )}
            </div>
            <div className="ml-4">
              {isStatus ? (
                <>
                  <h4 className="font-semibold text-lg">{event.status}</h4>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(
                      event.date,
                      Intl.DateTimeFormat().resolvedOptions().timeZone,
                      'es-AR'
                    )}
                  </p>
                  {'notes' in event && event.notes && (
                    <p className="mt-1 text-sm">{event.notes}</p>
                  )}
                </>
              ) : (
                <>
                  <h4 className="font-semibold text-lg">{event.author}</h4>
                  <p className="mt-1">{event.content}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(
                      event.date,
                      Intl.DateTimeFormat().resolvedOptions().timeZone,
                      'es-AR'
                    )}
                  </p>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TicketTimeline;
