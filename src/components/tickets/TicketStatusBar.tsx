import React from 'react';
import { Check } from 'lucide-react';

interface TicketStatusBarProps {
  status?: string | null;
  flow?: string[];
}

const normalize = (s?: string | null) => (s ? s.toLowerCase().replace(/\s+/g, '_') : '');

const formatLabel = (s: string) =>
  s
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const TicketStatusBar: React.FC<TicketStatusBarProps> = ({ status, flow = [] }) => {
  const current = normalize(status);
  const steps = React.useMemo(() => {
    const normalized = flow.map(normalize);
    if (current) normalized.push(current);
    return Array.from(new Set(normalized));
  }, [flow, current]);
  const currentIndex = steps.indexOf(current);

  return (
    <div className="flex items-center gap-2 my-2">
      {steps.map((step, idx) => {
        const completed = idx <= currentIndex;
        return (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center">
              <div
                className={
                  `w-5 h-5 rounded-full border flex items-center justify-center ` +
                  (completed
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'bg-muted border-muted-foreground text-muted-foreground')
                }
              >
                {completed && <Check className="w-3 h-3" />}
              </div>
              <span
                className={`mt-1 text-xs text-center capitalize ${completed ? 'text-primary font-medium' : 'text-muted-foreground'}`}
              >
                {formatLabel(step)}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`flex-1 h-0.5 ${idx < currentIndex ? 'bg-primary' : 'bg-muted'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default TicketStatusBar;
