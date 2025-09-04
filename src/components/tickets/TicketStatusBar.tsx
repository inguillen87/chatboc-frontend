import React from 'react';

interface TicketStatusBarProps {
  status?: string | null;
}

const STATUS_FLOW = ['nuevo', 'en_proceso', 'completado'];

const normalize = (s?: string | null) => (s ? s.toLowerCase().replace(/\s+/g, '_') : '');

const formatLabel = (s: string) =>
  s
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const TicketStatusBar: React.FC<TicketStatusBarProps> = ({ status }) => {
  const current = normalize(status);
  const flow = STATUS_FLOW.includes(current) ? STATUS_FLOW : [...STATUS_FLOW, current].filter(Boolean);
  const currentIndex = flow.indexOf(current);

  return (
    <div className="flex items-center gap-2 my-2">
      {flow.map((step, idx) => {
        const completed = idx <= currentIndex;
        return (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center">
              <div
                className={
                  `w-4 h-4 rounded-full border ` +
                  (completed ? 'bg-primary border-primary' : 'bg-muted border-muted-foreground')
                }
              />
              <span className={`mt-1 text-xs text-center capitalize ${completed ? 'text-primary' : 'text-muted-foreground'}`}>
                {formatLabel(step)}
              </span>
            </div>
            {idx < flow.length - 1 && (
              <div className={`flex-1 h-0.5 ${idx < currentIndex ? 'bg-primary' : 'bg-muted'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default TicketStatusBar;
