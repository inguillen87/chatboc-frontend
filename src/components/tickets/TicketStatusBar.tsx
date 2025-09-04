import React from 'react';
import { Check } from 'lucide-react';

interface TicketStatusBarProps {
  status?: string | null;
  flow?: string[];
}

const DEFAULT_FLOW = ['nuevo', 'en_proceso', 'completado'];
const normalize = (s?: string | null) =>
  s ? s.toLowerCase().replace(/\s+/g, '_') : '';

const formatLabel = (s: string) =>
  s
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const TicketStatusBar: React.FC<TicketStatusBarProps> = ({ status, flow = [] }) => {
  const current = normalize(status);
  const steps = React.useMemo(() => {
    const set = new Set(flow.map(normalize));
    if (set.size === 0) {
      DEFAULT_FLOW.forEach((s) => set.add(s));
    }
    if (current) set.add(current);
    return Array.from(set).sort((a, b) => {
      const ia = DEFAULT_FLOW.indexOf(a);
      const ib = DEFAULT_FLOW.indexOf(b);
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }, [flow, current]);
  const currentIndex = steps.indexOf(current);

  return (
    <div className="flex items-center gap-3 my-4">
      {steps.map((step, idx) => {
        const completed = idx <= currentIndex;
        return (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center">
              <div
                className={
                  `w-6 h-6 rounded-full border flex items-center justify-center text-xs ` +
                  (completed
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'bg-muted border-muted-foreground text-muted-foreground')
                }
              >
                {completed && <Check className="w-3 h-3" />}
              </div>
              <span
                className={`mt-2 text-xs text-center font-medium capitalize ${completed ? 'text-primary' : 'text-muted-foreground'}`}
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
