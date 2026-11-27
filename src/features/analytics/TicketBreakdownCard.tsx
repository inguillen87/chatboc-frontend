import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type TicketBreakdownRow = { id: string; label: string; count?: number };

const INITIAL_ROWS = 8;
const formatCount = new Intl.NumberFormat('es-AR');

export function TicketBreakdownCard({ title, rows }: { title: string; rows: TicketBreakdownRow[] }) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const titleId = useId();
  const descriptionId = useId();
  const visibleRows = expanded ? rows : rows.slice(0, INITIAL_ROWS);
  // Keep the same scale when the list is expanded.
  const maximum = rows.reduce((largest, { count }) => Math.max(largest, count ?? 0), 0);
  const remaining = rows.length - INITIAL_ROWS;
  const toggleLabel = expanded ? 'Mostrar menos' : `Mostrar ${formatCount.format(remaining)} más`;

  return (
    <Card role="region" aria-labelledby={titleId} aria-describedby={descriptionId} className="min-w-0">
      <CardHeader className="gap-1 px-4 pt-5 sm:px-6">
        <CardTitle id={titleId} className="break-words text-lg leading-snug">{title}</CardTitle>
        <CardDescription id={descriptionId}>
          {maximum > 0
            ? 'Las barras comparan cada recuento con el mayor de este grupo.'
            : 'Recuentos del período seleccionado.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        <ul id={listId} className="divide-y divide-border">
          {visibleRows.map(({ id, label, count }) => (
            <li key={id} className="space-y-2 py-2.5">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 text-sm">
                <span className="min-w-0 break-words text-foreground">{label}</span>
                <span className="font-semibold tabular-nums">
                  {count === undefined ? 'Sin dato' : formatCount.format(count)}
                </span>
              </div>
              {maximum > 0 && count !== undefined ? (
                <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-out"
                    style={{ width: `${(count / maximum) * 100}%` }}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        {remaining > 0 ? (
          <button
            type="button"
            className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-start text-sm font-medium text-primary hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label={`${toggleLabel} en ${title}`}
            aria-controls={listId}
            aria-expanded={expanded}
            onClick={() => setExpanded((previous) => !previous)}
          >
            {toggleLabel}
            <ChevronDown
              aria-hidden="true"
              className={cn('h-4 w-4 shrink-0 motion-safe:transition-transform motion-safe:duration-200', expanded && 'rotate-180')}
            />
          </button>
        ) : null}
      </CardContent>
    </Card>
  );
}
