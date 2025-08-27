import React from 'react';
import { formatDate } from '@/utils/fecha';
import { CheckCircle, Clock } from 'lucide-react';
import { TicketHistoryEvent } from '@/types/tickets';

interface TicketTimelineProps {
  history: TicketHistoryEvent[];
}

const TicketTimeline: React.FC<TicketTimelineProps> = ({ history }) => {
  if (!history || history.length === 0) {
    return null;
  }

  return (
    <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:bg-gray-200 dark:before:bg-gray-700">
      {history.map((event, index) => {
        const isLastEvent = index === history.length - 1;
        return (
          <div key={index} className="relative flex items-start">
            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${isLastEvent ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>
              {isLastEvent ? <CheckCircle size={20} /> : <Clock size={20} />}
            </div>
            <div className="ml-4">
              <h4 className="font-semibold text-lg">{event.status}</h4>
              <p className="text-sm text-muted-foreground">
                {formatDate(event.date, Intl.DateTimeFormat().resolvedOptions().timeZone, 'es-AR')}
              </p>
              {event.notes && <p className="mt-1 text-sm">{event.notes}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TicketTimeline;
