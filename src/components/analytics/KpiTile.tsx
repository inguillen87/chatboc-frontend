import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface KpiTileProps {
  title: string;
  value: number | string;
  suffix?: string;
  delta?: { value: number; label?: string; positive?: boolean };
  loading?: boolean;
  className?: string;
  icon?: LucideIcon;
}

export function KpiTile({ title, value, suffix, delta, loading, className, icon: Icon }: KpiTileProps) {
  return (
    <Card
      className={cn(
        'group relative overflow-hidden border-border/60 bg-background/80 shadow-sm backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5',
        className,
      )}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/70 via-sky-400/70 to-violet-400/70 opacity-80" />
      <div className="absolute -right-8 top-6 h-24 w-24 rounded-full bg-primary/5 blur-2xl transition-transform duration-500 group-hover:scale-125" />
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          {Icon ? (
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5 text-primary shadow-sm">
              <Icon className="h-4 w-4" />
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
        ) : (
          <>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-semibold tracking-tight text-foreground">
                {typeof value === 'number'
                  ? value.toLocaleString('es-AR', { maximumFractionDigits: 1 })
                  : value}
              </span>
              {suffix ? <span className="pb-1 text-sm text-muted-foreground">{suffix}</span> : null}
            </div>
            {delta ? (
              <p
                className={cn(
                  'mt-3 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
                  delta.positive
                    ? 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-600 ring-amber-500/20',
                )}
              >
                {delta.positive ? '▲' : '▼'} {Math.abs(delta.value).toFixed(1)}%
                {delta.label ? <span className="ml-1 text-muted-foreground">{delta.label}</span> : null}
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
