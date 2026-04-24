import { cn } from '@/lib/utils';

interface AnalyticsEmptyStateProps {
  message?: string;
  className?: string;
}

export function AnalyticsEmptyState({
  message = 'No hay datos para los filtros seleccionados.',
  className,
}: AnalyticsEmptyStateProps) {
  return (
    <div
      className={cn(
        'flex h-full min-h-[8rem] w-full items-center justify-center rounded-md border border-dashed border-border/70 bg-muted/40 text-sm text-muted-foreground',
        className,
      )}
    >
      {message}
    </div>
  );
}

export default AnalyticsEmptyState;
