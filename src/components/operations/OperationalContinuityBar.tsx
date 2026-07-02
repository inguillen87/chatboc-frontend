import React from 'react';
import {
  ArrowRight,
  Clock3,
  ExternalLink,
  LucideIcon,
  MessageCircle,
  Radio,
  ShieldCheck,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ContinuityTone = 'default' | 'live' | 'warning' | 'success' | 'muted';

export type OperationalContinuityMetric = {
  label: string;
  value: React.ReactNode;
  tone?: ContinuityTone;
};

export type OperationalContinuityBarProps = {
  title: string;
  subtitle?: string;
  reference?: string | number | null;
  statusLabel?: string;
  channelLabel?: string;
  nextActionLabel?: string;
  slaLabel?: string;
  liveLabel?: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  primaryActionHref?: string | null;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  metrics?: OperationalContinuityMetric[];
  icon?: LucideIcon;
  tone?: ContinuityTone;
  compact?: boolean;
  className?: string;
  testId?: string;
};

const toneClass: Record<ContinuityTone, string> = {
  default: 'border-primary/25 bg-primary/10 text-primary',
  live: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  muted: 'border-border/70 bg-muted/60 text-muted-foreground',
};

const metricToneClass: Record<ContinuityTone, string> = {
  default: 'border-primary/15 bg-primary/5',
  live: 'border-emerald-500/20 bg-emerald-500/10',
  warning: 'border-amber-500/25 bg-amber-500/10',
  success: 'border-emerald-500/20 bg-emerald-500/10',
  muted: 'border-border/70 bg-background/65',
};

export default function OperationalContinuityBar({
  title,
  subtitle,
  reference,
  statusLabel,
  channelLabel,
  nextActionLabel,
  slaLabel,
  liveLabel,
  primaryActionLabel,
  onPrimaryAction,
  primaryActionHref,
  secondaryActionLabel,
  onSecondaryAction,
  metrics = [],
  icon: Icon = ShieldCheck,
  tone = 'default',
  compact = false,
  className,
  testId = 'operational-continuity-bar',
}: OperationalContinuityBarProps) {
  const hasPrimaryAction = Boolean(primaryActionLabel && (onPrimaryAction || primaryActionHref));
  const PrimaryContent = (
    <>
      {primaryActionHref ? <ExternalLink className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
      <span>{primaryActionLabel}</span>
    </>
  );

  return (
    <section
      data-testid={testId}
      className={cn(
        'relative overflow-hidden rounded-[10px] border border-border/70 bg-card/95 shadow-sm',
        'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-primary/35 before:to-transparent',
        compact ? 'p-2.5' : 'p-3 sm:p-4',
        className,
      )}
      aria-label="Continuidad operativa"
    >
      <div className="flex min-w-0 flex-col gap-3 min-[920px]:flex-row min-[920px]:items-center min-[920px]:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border',
              toneClass[tone],
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <h3 className={cn('truncate font-semibold tracking-tight', compact ? 'text-sm' : 'text-base')}>
                {title}
              </h3>
              {reference ? (
                <Badge variant="outline" className="max-w-[12rem] truncate rounded-full">
                  Ref. {reference}
                </Badge>
              ) : null}
              {statusLabel ? (
                <Badge className={cn('max-w-[12rem] truncate rounded-full border', toneClass[tone])}>
                  {statusLabel}
                </Badge>
              ) : null}
            </div>
            {subtitle ? (
              <p className={cn('mt-1 line-clamp-2 text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>
                {subtitle}
              </p>
            ) : null}
            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
              {channelLabel ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/70 px-2 py-1">
                  <MessageCircle className="h-3.5 w-3.5 text-primary" />
                  {channelLabel}
                </span>
              ) : null}
              {liveLabel ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-emerald-700 dark:text-emerald-300">
                  <Radio className="h-3.5 w-3.5" />
                  {liveLabel}
                </span>
              ) : null}
              {slaLabel ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/70 px-2 py-1">
                  <Clock3 className="h-3.5 w-3.5 text-amber-500" />
                  {slaLabel}
                </span>
              ) : null}
              {nextActionLabel ? (
                <span className="inline-flex min-w-0 items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2 py-1 text-primary">
                  <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{nextActionLabel}</span>
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-2 min-[720px]:flex-row min-[720px]:items-center min-[920px]:justify-end">
          {metrics.length ? (
            <div className="grid min-w-0 grid-cols-2 gap-1.5 min-[520px]:flex min-[520px]:items-center">
              {metrics.slice(0, 4).map((metric) => (
                <div
                  key={`${metric.label}-${String(metric.value)}`}
                  className={cn(
                    'min-w-0 rounded-[8px] border px-2.5 py-2',
                    metricToneClass[metric.tone ?? 'muted'],
                  )}
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    {metric.label}
                  </p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{metric.value}</p>
                </div>
              ))}
            </div>
          ) : null}
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {secondaryActionLabel && onSecondaryAction ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-[8px]"
                onClick={onSecondaryAction}
              >
                {secondaryActionLabel}
              </Button>
            ) : null}
            {hasPrimaryAction ? (
              primaryActionHref ? (
                <Button asChild size="sm" className="h-9 rounded-[8px] font-semibold">
                  <a href={primaryActionHref} target="_blank" rel="noreferrer">
                    {PrimaryContent}
                  </a>
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="h-9 rounded-[8px] font-semibold"
                  onClick={onPrimaryAction}
                >
                  {PrimaryContent}
                </Button>
              )
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
