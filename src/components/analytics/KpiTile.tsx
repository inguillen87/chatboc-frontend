import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface KpiTileProps {
  title: string;
  value: number | string;
  suffix?: string;
  delta?: { value: number; label?: string; positive?: boolean };
  loading?: boolean;
  className?: string;
}

export function KpiTile({ title, value, suffix, delta, loading, className }: KpiTileProps) {
  return (
    <Card className={cn('bg-background/80 backdrop-blur', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight">
              {typeof value === 'number' ? value.toLocaleString('es-AR', { maximumFractionDigits: 1 }) : value}
            </span>
            {suffix ? <span className="text-sm text-muted-foreground">{suffix}</span> : null}
          </div>
        )}
        {delta ? (
          <p
            className={cn(
              'mt-2 text-xs font-medium',
              delta.positive ? 'text-emerald-500' : 'text-amber-500',
            )}
          >
            {delta.positive ? '▲' : '▼'} {Math.abs(delta.value).toFixed(1)}%
            {delta.label ? <span className="ml-1 text-muted-foreground">{delta.label}</span> : null}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
