import React from 'react';
import { BadgeCheck, Check, CircleDot, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AllowedTicketStatus,
  buildStatusFlow,
  formatTicketStatusLabel,
  normalizeTicketStatus,
} from '@/utils/ticketStatus';
import { shiftDateByHours } from '@/utils/date';

type StatusHistoryEntry = {
  status?: string | null;
  date?: string | number | Date | null;
  [key: string]: unknown;
};

interface TicketStatusBarProps {
  status?: string | null;
  flow?: string[];
  history?: StatusHistoryEntry[];
  className?: string;
}

const ICONS: Record<AllowedTicketStatus, React.ReactNode> = {
  nuevo: <CircleDot className="h-3.5 w-3.5" />,
  en_proceso: <Wrench className="h-3.5 w-3.5" />,
  resuelto: <BadgeCheck className="h-3.5 w-3.5" />,
};

const formatStepDate = (value?: string | number | Date | null) => {
  if (!value) return null;

  const shifted = shiftDateByHours(value, -3);

  if (!shifted) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(shifted);
  } catch (error) {
    console.error('Error formatting status date', error);
    return null;
  }
};

const extractHistoryDate = (entry: StatusHistoryEntry): string | number | Date | null => {
  if (!entry) return null;
  if (entry.date) return entry.date;

  const candidateKeys = ['fecha', 'created_at', 'updated_at', 'timestamp'];

  for (const key of candidateKeys) {
    const raw = entry[key];
    if (
      typeof raw === 'string' ||
      typeof raw === 'number' ||
      raw instanceof Date
    ) {
      return raw;
    }
  }

  return null;
};

const TicketStatusBar: React.FC<TicketStatusBarProps> = ({
  status,
  flow = [],
  history,
  className,
}) => {
  const [routeStatus, setRouteStatus] = React.useState<string | null>(null);

  // listen to custom route status events dispatched by TicketMap
  React.useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      setRouteStatus(detail);
    };
    window.addEventListener('route-status', handler);
    return () => window.removeEventListener('route-status', handler);
  }, []);

  const historyMap = React.useMemo(() => {
    const map = new Map<AllowedTicketStatus, string>();
    if (!Array.isArray(history)) {
      return map;
    }

    history.forEach((entry) => {
      const normalized = normalizeTicketStatus(entry?.status);
      if (!normalized || map.has(normalized)) {
        return;
      }

      const formatted = formatStepDate(extractHistoryDate(entry));
      map.set(normalized, formatted ?? '');
    });

    return map;
  }, [history]);

  const historyStatuses = React.useMemo(() => {
    if (!Array.isArray(history)) {
      return [] as AllowedTicketStatus[];
    }

    return history
      .map((entry) => normalizeTicketStatus(entry?.status))
      .filter((value): value is AllowedTicketStatus => Boolean(value));
  }, [history]);
  const historySet = React.useMemo(
    () => new Set(historyStatuses),
    [historyStatuses],
  );

  const providedFlow = React.useMemo(
    () => buildStatusFlow(flow ?? []),
    [flow],
  );

  const lastHistoryStatus =
    historyStatuses[historyStatuses.length - 1] ?? null;
  const current =
    normalizeTicketStatus(routeStatus || status) || lastHistoryStatus;

  const steps = React.useMemo(() => {
    const flowCandidates: Array<string | null | undefined> = [
      ...providedFlow,
      ...historyStatuses,
      current ?? undefined,
    ];
    return buildStatusFlow(flowCandidates);
  }, [providedFlow, historyStatuses, current]);

  const currentIndex = current ? steps.indexOf(current) : -1;
  const highestHistoryIndex = React.useMemo(
    () =>
      steps.reduce(
        (acc, step, idx) => (historySet.has(step) ? idx : acc),
        -1,
      ),
    [steps, historySet],
  );
  const resolvedCurrentIndex = currentIndex === -1 ? highestHistoryIndex : currentIndex;

  if (!steps.length) {
    return null;
  }

  return (
    <div className={cn('my-4 overflow-x-auto pb-1', className)}>
      <div className="flex min-w-max items-stretch gap-3 pr-3">
        {steps.map((step, idx) => {
          const completed = resolvedCurrentIndex !== -1 && idx <= resolvedCurrentIndex;
          const icon = ICONS[step] || <Check className="h-3.5 w-3.5" />;
          const timestamp = historyMap.get(step) || '';

          return (
            <React.Fragment key={step}>
              <div className="flex min-w-[78px] shrink-0 flex-col items-center text-center">
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full border text-xs transition-all duration-200',
                    completed
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                      : 'border-muted-foreground/40 bg-muted/60 text-muted-foreground',
                  )}
                >
                  {icon}
                </div>
                <span
                  className={cn(
                    'mt-2 text-xs font-semibold capitalize',
                    completed ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {formatTicketStatusLabel(step)}
                </span>
                {timestamp && (
                  <span
                    className={cn(
                      'mt-1 text-[10px]',
                      completed ? 'text-primary/80' : 'text-muted-foreground/70',
                    )}
                  >
                    {timestamp}
                  </span>
                )}
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={cn(
                    'h-0.5 flex-1 self-center rounded-full transition-colors duration-200',
                    idx < resolvedCurrentIndex
                      ? 'bg-primary'
                      : 'bg-muted-foreground/30',
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default TicketStatusBar;
