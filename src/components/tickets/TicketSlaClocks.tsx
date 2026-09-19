import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import type { TicketSlaClock, TicketSlaClockState } from '@/types/tickets';
import {
  normalizeTicketSla,
  TICKET_SLA_CLOCK_KEYS,
  type TicketSlaClockKey,
} from '@/utils/ticketSla';

interface TicketSlaClocksProps {
  sla?: unknown;
  compact?: boolean;
  className?: string;
}

const clockLabels: Record<TicketSlaClockKey, string> = {
  first_response: 'Primera respuesta',
  next_update: 'Próxima actualización',
  resolution: 'Resolución',
};

const compactClockLabels: Record<TicketSlaClockKey, string> = {
  first_response: 'Respuesta',
  next_update: 'Actualización',
  resolution: 'Resolución',
};

const statePresentation: Record<TicketSlaClockState, {
  label: string;
  compactLabel: string;
  className: string;
  icon: React.ElementType;
}> = {
  overdue: {
    label: 'Vencido',
    compactLabel: 'SLA vencido',
    className: 'border-destructive/35 bg-destructive/10 text-destructive dark:border-rose-400/45 dark:bg-rose-400/10 dark:text-rose-200',
    icon: AlertTriangle,
  },
  due: {
    label: 'Por vencer',
    compactLabel: 'SLA por vencer',
    className: 'border-amber-400/45 bg-amber-500/10 text-amber-800 dark:text-amber-200',
    icon: Clock,
  },
  healthy: {
    label: 'En plazo',
    compactLabel: 'SLA en plazo',
    className: 'border-sky-400/45 bg-sky-500/10 text-sky-800 dark:text-sky-200',
    icon: Clock,
  },
  satisfied: {
    label: 'Cumplido',
    compactLabel: 'SLA cumplido',
    className: 'border-emerald-400/45 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
    icon: CheckCircle2,
  },
  paused: {
    label: 'Pausado',
    compactLabel: 'SLA pausado',
    className: 'border-slate-400/45 bg-slate-500/10 text-slate-700 dark:text-slate-200',
    icon: Clock,
  },
  inactive: {
    label: 'No activo',
    compactLabel: 'SLA no activo',
    className: 'border-border bg-muted/30 text-muted-foreground',
    icon: Info,
  },
  unknown: {
    label: 'Sin evidencia',
    compactLabel: 'SLA sin evidencia',
    className: 'border-border bg-muted/30 text-muted-foreground',
    icon: Info,
  },
};

const formatTimestamp = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const formatDuration = (seconds: number | null): string | null => {
  if (seconds === null || !Number.isFinite(seconds)) return null;

  const totalMinutes = Math.floor(Math.abs(seconds) / 60);
  if (totalMinutes < 1) return '< 1 min';

  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];

  if (days > 0) parts.push(`${days} d`);
  if (hours > 0 && parts.length < 2) parts.push(`${hours} h`);
  if (minutes > 0 && parts.length < 2) parts.push(`${minutes} min`);

  return parts.join(' ');
};

const clockEvidence = (clock: TicketSlaClock, hasEvaluationCut = false) => {
  const remainingSeconds = clock.remaining_seconds;

  if (clock.state === 'satisfied') {
    const fulfilledAt = formatTimestamp(clock.fulfilled_at);
    return fulfilledAt ? `Cumplido el ${fulfilledAt}` : 'Cumplimiento confirmado';
  }
  if (clock.state === 'paused') {
    const dueAt = formatTimestamp(clock.due_at);
    return dueAt ? `Plazo pausado · ${dueAt}` : 'Pausa confirmada por la política SLA';
  }
  if (clock.state === 'inactive') return 'Objetivo sin obligación activa';
  if (clock.state === 'healthy') {
    const remaining = hasEvaluationCut && remainingSeconds !== null && remainingSeconds >= 0
      ? formatDuration(remainingSeconds)
      : null;
    if (remaining) return `${remaining} restantes al corte`;
    const dueAt = formatTimestamp(clock.due_at);
    return dueAt ? `Vence el ${dueAt}` : 'Plazo vigente';
  }
  if (clock.state === 'due' || clock.state === 'overdue') {
    const remaining = hasEvaluationCut && remainingSeconds !== null
      ? formatDuration(remainingSeconds)
      : null;
    if (remaining && clock.state === 'overdue' && remainingSeconds !== null && remainingSeconds <= 0) {
      return `${remaining} fuera de plazo al corte`;
    }
    if (remaining && clock.state === 'due' && remainingSeconds !== null && remainingSeconds >= 0) {
      return `${remaining} restantes al corte`;
    }
    const dueAt = formatTimestamp(clock.due_at);
    return dueAt
      ? `${clock.state === 'overdue' ? 'Venció' : 'Vence'} el ${dueAt}`
      : 'Sin fecha verificable';
  }
  return 'Sin fecha o estado verificable';
};

const resolveCompactClock = (
  state: TicketSlaClockState,
  clocks: Record<TicketSlaClockKey, TicketSlaClock>,
  hasEvaluationCut: boolean,
): TicketSlaClockKey | null => {
  const candidates = TICKET_SLA_CLOCK_KEYS.filter((key) => clocks[key].state === state);
  if (candidates.length === 0) return null;

  if (!hasEvaluationCut) return candidates[0];

  if (state === 'overdue') {
    return candidates.sort((left, right) => {
      const leftRemaining = clocks[left].remaining_seconds;
      const rightRemaining = clocks[right].remaining_seconds;
      if (leftRemaining === null) return 1;
      if (rightRemaining === null) return -1;
      return leftRemaining - rightRemaining;
    })[0];
  }

  if (state === 'due' || state === 'healthy') {
    return candidates.sort((left, right) => {
      const leftRemaining = clocks[left].remaining_seconds;
      const rightRemaining = clocks[right].remaining_seconds;
      if (leftRemaining === null) return 1;
      if (rightRemaining === null) return -1;
      return leftRemaining - rightRemaining;
    })[0];
  }

  return candidates[0];
};

const compactClockSummary = (
  key: TicketSlaClockKey,
  clock: TicketSlaClock,
  hasEvaluationCut: boolean,
): string => {
  const label = compactClockLabels[key];
  const duration = hasEvaluationCut ? formatDuration(clock.remaining_seconds) : null;

  if (clock.state === 'overdue') {
    return duration && clock.remaining_seconds !== null && clock.remaining_seconds <= 0
      ? `${label} vencida · ${duration} al corte`
      : `${label} vencida`;
  }
  if (clock.state === 'due') {
    return duration && clock.remaining_seconds !== null && clock.remaining_seconds >= 0
      ? `${label} por vencer · ${duration} al corte`
      : `${label} por vencer`;
  }
  if (clock.state === 'healthy') {
    return duration && clock.remaining_seconds !== null && clock.remaining_seconds >= 0
      ? `${label} · ${duration} al corte`
      : `${label} en plazo`;
  }
  if (clock.state === 'satisfied') return `${label} cumplida`;
  if (clock.state === 'paused') return `${label} pausada`;
  if (clock.state === 'inactive') return `${label} no activa`;
  return 'SLA sin evidencia';
};

export const TicketSlaClocks: React.FC<TicketSlaClocksProps> = ({
  sla,
  compact = false,
  className,
}) => {
  const contract = normalizeTicketSla(sla);
  const knownClockCount = TICKET_SLA_CLOCK_KEYS.filter((key) => contract.clocks[key].known).length;
  const isPartial = contract.state === 'unknown' && knownClockCount > 0;
  const presentation = isPartial
    ? {
        label: 'Evidencia parcial',
        compactLabel: 'SLA parcial',
        className: 'border-border bg-muted/30 text-muted-foreground',
        icon: Info,
      }
    : statePresentation[contract.state];
  const SummaryIcon = presentation.icon;
  const evaluatedAt = formatTimestamp(contract.evaluated_at);
  const hasEvaluationCut = Boolean(evaluatedAt);
  const compactClockKey = isPartial
    ? null
    : resolveCompactClock(contract.state, contract.clocks, hasEvaluationCut);
  const compactLabel = compactClockKey
    ? compactClockSummary(compactClockKey, contract.clocks[compactClockKey], hasEvaluationCut)
    : presentation.compactLabel;
  const clockDescriptions = TICKET_SLA_CLOCK_KEYS
    .map((key) => `${clockLabels[key]}: ${statePresentation[contract.clocks[key].state].label}; ${clockEvidence(contract.clocks[key], hasEvaluationCut)}`)
    .join('. ');
  const accessibleSummary = `Estado de nivel de servicio: ${presentation.label}. ${clockDescriptions}${
    evaluatedAt ? `. Corte de cálculo: ${evaluatedAt}` : ''
  }`;

  if (compact) {
    return (
      <div
        role="group"
        aria-label={`SLA: ${compactLabel}${evaluatedAt ? `. Corte ${evaluatedAt}` : ''}`}
        title={accessibleSummary}
        className={cn(
          'flex min-w-0 items-center gap-1 rounded-[8px] border px-2 py-1 text-[10px] font-medium',
          presentation.className,
          className,
        )}
        data-sla-state={contract.state}
        data-testid="ticket-sla-clocks-compact"
      >
        <SummaryIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span className="truncate">{compactLabel}</span>
      </div>
    );
  }

  return (
    <section
      aria-label="Relojes de nivel de servicio"
      className={cn('rounded-lg border bg-muted/10 p-3', className)}
      data-testid="ticket-sla-clocks"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" aria-hidden="true" />
          <h4 className="text-xs font-semibold text-foreground">Compromisos de atención</h4>
        </div>
        {evaluatedAt ? (
          <time
            dateTime={contract.evaluated_at || undefined}
            className="text-[10px] text-muted-foreground"
            title="Saldo calculado por el backend; no es un contador del navegador"
          >
            Corte {evaluatedAt}
          </time>
        ) : (
          <span className="text-[10px] text-muted-foreground">SLA operativo</span>
        )}
      </div>
      <dl className="grid gap-2 sm:grid-cols-3">
        {TICKET_SLA_CLOCK_KEYS.map((key) => {
          const clock = contract.clocks[key];
          const state = statePresentation[clock.state];
          const StateIcon = state.icon;
          return (
            <div
              key={key}
              className={cn('min-w-0 rounded-[8px] border px-2.5 py-2', state.className)}
              data-sla-state={clock.state}
              data-testid={`ticket-sla-clock-${key}`}
            >
              <dt className="truncate text-[10px] font-semibold uppercase tracking-wide opacity-80">
                {clockLabels[key]}
              </dt>
              <dd className="mt-1">
                <span className="flex items-center gap-1.5 text-xs font-semibold">
                  <StateIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {state.label}
                </span>
                <span className="mt-0.5 block truncate text-[10px] opacity-80" title={clockEvidence(clock, hasEvaluationCut)}>
                  {clockEvidence(clock, hasEvaluationCut)}
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
};

export default TicketSlaClocks;
