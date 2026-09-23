import { useId } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BarChart3,
  Gauge,
  Inbox,
  MapPinned,
  MessageSquareText,
  ShieldAlert,
} from 'lucide-react';

export type ExecutiveOverviewDataMode =
  | 'synthetic_demo_scenario'
  | 'session_generated_events'
  | 'mixed_partitioned'
  | 'verified_operational'
  | (string & {});

export type ExecutiveOverviewIconName =
  | 'activity'
  | 'claims'
  | 'coverage'
  | 'sla'
  | 'surveys'
  | 'whatsapp';

export interface ExecutiveOverviewBasis {
  label: string;
  value: string | number;
}

export interface ExecutiveOverviewEvidence {
  sourceLabel: string;
  basis: ExecutiveOverviewBasis | null;
  period?: string | null;
  dataMode?: ExecutiveOverviewDataMode | null;
}

export interface ExecutiveOverviewScorecard {
  id: string;
  label: string;
  value: string | number | null;
  unit?: string | null;
  detail?: string | null;
  icon?: ExecutiveOverviewIconName;
  evidence: ExecutiveOverviewEvidence;
}

export interface ExecutiveOverviewRankingItem {
  id: string;
  label: string;
  value: string | number | null;
  sharePercent?: string | number | null;
  detail?: string | null;
}

export interface ExecutiveOverviewRanking {
  title: string;
  description?: string | null;
  measureLabel: string;
  scale: 'relative' | 'share';
  sourceLabel: string;
  basis: ExecutiveOverviewBasis | null;
  items: ExecutiveOverviewRankingItem[];
  maxItems?: number;
}

export interface ExecutiveOverviewJourneyStep {
  id: string;
  title: string;
  description?: string | null;
  timeLabel?: string | null;
  channel?: string | null;
  status?: string | null;
}

export interface ExecutiveOverviewJourney {
  title: string;
  description?: string | null;
  badge?: string | null;
  steps: ExecutiveOverviewJourneyStep[];
}

export interface ExecutiveOverviewSource {
  label: string;
  mode?: ExecutiveOverviewDataMode | null;
  synthetic: boolean;
  partial?: boolean;
  suitableForDecisions?: boolean | null;
  note?: string | null;
}

export interface ExecutiveOverviewViewModel {
  eyebrow?: string;
  title?: string;
  description?: string | null;
  source: ExecutiveOverviewSource;
  scorecards: ExecutiveOverviewScorecard[];
  ranking?: ExecutiveOverviewRanking | null;
  journey?: ExecutiveOverviewJourney | null;
  callout?: {
    title?: string | null;
    description?: string | null;
  } | null;
  emptyMessage?: string;
}

export interface ExecutiveOverviewPanelProps {
  model: ExecutiveOverviewViewModel;
  className?: string;
  showSourceDisclosure?: boolean;
}

const NUMBER_FORMATTER = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });
const PERCENT_FORMATTER = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });

const OVERVIEW_ICONS: Record<ExecutiveOverviewIconName, LucideIcon> = {
  activity: Activity,
  claims: Inbox,
  coverage: MapPinned,
  sla: Gauge,
  surveys: BarChart3,
  whatsapp: MessageSquareText,
};

const readFiniteNumber = (value: string | number | null | undefined) => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

const readNonNegativeNumber = (value: string | number | null | undefined) => {
  const parsed = readFiniteNumber(value);
  return parsed !== null && parsed >= 0 ? parsed : null;
};

const formatValue = (value: string | number | null | undefined, unit?: string | null) => {
  const normalized =
    typeof value === 'number'
      ? NUMBER_FORMATTER.format(value)
      : typeof value === 'string' && value.trim()
        ? value.trim()
        : '—';
  return unit?.trim() && normalized !== '—' ? `${normalized} ${unit.trim()}` : normalized;
};

const formatBasis = (basis: ExecutiveOverviewBasis | null) =>
  basis ? `${basis.label}: ${formatValue(basis.value)}` : 'Base no informada';

const readShare = (value: string | number | null | undefined) => {
  const parsed = readFiniteNumber(value);
  return parsed !== null && parsed >= 0 && parsed <= 100 ? parsed : null;
};

const normalizeRanking = (ranking: ExecutiveOverviewRanking) => {
  const prepared = ranking.items
    .map((item) => ({
      item,
      numericValue: readNonNegativeNumber(item.value),
      share: readShare(item.sharePercent),
    }))
    .filter(({ numericValue, share }) => numericValue !== null || share !== null)
    .sort((left, right) => (right.numericValue ?? right.share ?? 0) - (left.numericValue ?? left.share ?? 0));
  const maxItems = Math.max(2, Math.min(8, ranking.maxItems ?? 6));
  const visible = prepared.slice(0, maxItems);
  const relativeMaximum = visible.reduce((maximum, item) => Math.max(maximum, item.numericValue ?? 0), 0);

  return {
    totalComparable: prepared.length,
    hiddenCount: Math.max(0, prepared.length - visible.length),
    items: visible.map((entry) => ({
      ...entry,
      barPercent:
        ranking.scale === 'share'
          ? (entry.share ?? 0)
          : relativeMaximum > 0 && entry.numericValue !== null
            ? (entry.numericValue / relativeMaximum) * 100
            : 0,
    })),
  };
};

const readDataModeLabel = (mode: ExecutiveOverviewDataMode | null | undefined) => {
  if (mode === 'synthetic_demo_scenario') return 'Demo sintética';
  if (mode === 'session_generated_events') return 'Sesión actual';
  if (mode === 'mixed_partitioned') return 'Fuentes separadas';
  if (mode === 'verified_operational') return 'Fuente verificada';
  return null;
};

const SourceDisclosure = ({ source }: { source: ExecutiveOverviewSource }) => {
  const decisionWarning = source.suitableForDecisions === false;

  if (source.synthetic) {
    return (
      <div
        className="rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-amber-950 dark:text-amber-100"
        role="note"
        aria-label="Advertencia sobre datos simulados"
        data-executive-overview-disclosure="synthetic"
      >
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.12em]">Escenario demostrativo · datos simulados</p>
            <p className="mt-1 text-xs leading-5">
              {decisionWarning
                ? 'No representa mediciones oficiales ni debe utilizarse para decisiones públicas.'
                : 'No representa mediciones oficiales.'}
            </p>
            {source.note ? <p className="mt-1 text-[11px] leading-5 opacity-85">{source.note}</p> : null}
          </div>
        </div>
      </div>
    );
  }

  if (source.partial || decisionWarning) {
    return (
      <div
        className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 text-foreground"
        role="note"
        aria-label="Cobertura parcial de los datos"
        data-executive-overview-disclosure="partial"
      >
        <div className="flex items-start gap-3">
          <Activity className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.12em]">Cobertura parcial</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {source.note ?? 'La vista contiene información incompleta; interpretá cada indicador con su base declarada.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return source.note ? (
    <p className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-3 py-2 text-xs leading-5 text-muted-foreground">
      {source.note}
    </p>
  ) : null;
};

const ScorecardGrid = ({ items, titleId }: { items: ExecutiveOverviewScorecard[]; titleId: string }) => {
  if (!items.length) return null;

  return (
    <section aria-labelledby={titleId} data-executive-overview-scorecards>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 id={titleId} className="text-sm font-bold text-foreground">Indicadores ejecutivos</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Valor, período, fuente y base visibles para evitar lecturas fuera de contexto.
          </p>
        </div>
      </div>
      <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 2xl:grid-cols-4">
        {items.map((item) => {
          const Icon = OVERVIEW_ICONS[item.icon ?? 'activity'];
          const modeLabel = readDataModeLabel(item.evidence.dataMode);
          return (
            <li
              key={item.id}
              className="min-w-0 rounded-2xl border border-border/70 bg-background/85 p-4 shadow-sm"
              data-scorecard-id={item.id}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="flex min-w-0 flex-col items-end gap-1">
                  {item.evidence.period ? (
                    <span className="text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      {item.evidence.period}
                    </span>
                  ) : null}
                  {modeLabel ? (
                    <span className="rounded-full border border-border/70 bg-muted/20 px-2 py-0.5 text-[9px] font-bold text-muted-foreground">
                      {modeLabel}
                    </span>
                  ) : null}
                </div>
              </div>
              <dl className="mt-4">
                <dt className="text-xs font-semibold leading-4 text-muted-foreground">{item.label}</dt>
                <dd className="mt-1 break-words text-2xl font-black tracking-tight text-foreground tabular-nums">
                  {formatValue(item.value, item.unit)}
                </dd>
              </dl>
              {item.detail ? <p className="mt-2 text-[11px] leading-4 text-muted-foreground">{item.detail}</p> : null}
              <dl className="mt-4 space-y-1 border-t border-border/60 pt-3 text-[10px] leading-4 text-muted-foreground">
                <div className="flex items-start justify-between gap-2">
                  <dt className="font-semibold">Fuente</dt>
                  <dd className="text-right">{item.evidence.sourceLabel}</dd>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <dt className="font-semibold">Base</dt>
                  <dd className="text-right">{formatBasis(item.evidence.basis)}</dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

const RankingPanel = ({ ranking, titleId }: { ranking: ExecutiveOverviewRanking; titleId: string }) => {
  const normalized = normalizeRanking(ranking);
  const canCompare = normalized.totalComparable >= 2;

  return (
    <section
      className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm"
      aria-labelledby={titleId}
      data-executive-overview-ranking
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Comparación y ranking</p>
          <h3 id={titleId} className="mt-1 text-base font-bold text-foreground">{ranking.title}</h3>
          {ranking.description ? (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{ranking.description}</p>
          ) : null}
        </div>
        <span className="rounded-full border border-border/70 bg-muted/20 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
          {ranking.measureLabel}
        </span>
      </div>

      {canCompare ? (
        <ol className="mt-5 space-y-4" aria-label={ranking.title}>
          {normalized.items.map(({ item, numericValue, share, barPercent }, index) => (
            <li key={item.id}>
              <div className="mb-1.5 flex items-start justify-between gap-3 text-xs">
                <span className="min-w-0 font-semibold text-foreground">
                  <span className="mr-2 font-mono text-[10px] text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
                  {item.label}
                </span>
                <span className="shrink-0 text-right font-semibold tabular-nums text-foreground">
                  {formatValue(item.value)}
                  {share !== null ? <span className="ml-1 text-muted-foreground">· {PERCENT_FORMATTER.format(share)} %</span> : null}
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-muted"
                role="meter"
                aria-label={`${item.label}: ${formatValue(item.value)}${share !== null ? `, ${PERCENT_FORMATTER.format(share)} %` : ''}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(barPercent * 10) / 10}
                aria-valuetext={
                  ranking.scale === 'share' && share !== null
                    ? `${PERCENT_FORMATTER.format(share)} por ciento`
                    : `${formatValue(item.value)}; longitud relativa al máximo del conjunto`
                }
              >
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(100, Math.max(0, barPercent))}%` }}
                />
              </div>
              {item.detail ? <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{item.detail}</p> : null}
              {numericValue === null && share === null ? (
                <span className="sr-only">Valor no comparable</span>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-border/70 bg-muted/10 p-4" role="note">
          <p className="text-sm font-semibold text-foreground">Comparación todavía insuficiente</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Se necesitan al menos dos categorías con valores comparables. No se dibuja un ranking con evidencia escasa.
          </p>
          {normalized.items[0] ? (
            <p className="mt-2 text-xs font-medium text-foreground">
              Dato disponible: {normalized.items[0].item.label} · {formatValue(normalized.items[0].item.value)}
            </p>
          ) : null}
        </div>
      )}

      <dl className="mt-5 grid gap-2 border-t border-border/60 pt-3 text-[10px] leading-4 text-muted-foreground sm:grid-cols-2">
        <div>
          <dt className="font-semibold">Fuente</dt>
          <dd>{ranking.sourceLabel}</dd>
        </div>
        <div className="sm:text-right">
          <dt className="font-semibold">Base</dt>
          <dd>{formatBasis(ranking.basis)}</dd>
        </div>
      </dl>
      {ranking.scale === 'relative' && canCompare ? (
        <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
          Longitud relativa al valor máximo del conjunto; los valores exactos figuran en cada fila.
        </p>
      ) : null}
      {normalized.hiddenCount > 0 ? (
        <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
          Se muestran {normalized.items.length} de {normalized.totalComparable} categorías comparables.
        </p>
      ) : null}
    </section>
  );
};

const JourneyPanel = ({ journey, titleId }: { journey: ExecutiveOverviewJourney; titleId: string }) => (
  <section
    className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm"
    aria-labelledby={titleId}
    data-executive-overview-journey
  >
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Circuito operativo</p>
        <h3 id={titleId} className="mt-1 text-base font-bold text-foreground">{journey.title}</h3>
        {journey.description ? (
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{journey.description}</p>
        ) : null}
      </div>
      {journey.badge ? (
        <span className="rounded-full border border-border/70 bg-muted/20 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
          {journey.badge}
        </span>
      ) : null}
    </div>
    {journey.steps.length ? (
      <ol className="mt-5 space-y-4">
        {journey.steps.map((step, index) => (
          <li key={step.id} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-primary/25 bg-primary/10 font-mono text-[10px] font-black text-primary">
              {index + 1}
            </span>
            <div className="min-w-0 border-b border-border/50 pb-4 last:border-b-0 last:pb-0">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{step.title}</p>
                {step.timeLabel ? <span className="text-[10px] font-semibold text-muted-foreground">{step.timeLabel}</span> : null}
              </div>
              {step.description ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{step.description}</p> : null}
              {step.channel || step.status ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {step.channel ? (
                    <span className="rounded-full border border-border/70 bg-muted/15 px-2 py-0.5 text-[10px] text-muted-foreground">
                      {step.channel}
                    </span>
                  ) : null}
                  {step.status ? (
                    <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      {step.status}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    ) : (
      <p className="mt-4 rounded-xl border border-dashed border-border/70 bg-muted/10 p-4 text-xs leading-5 text-muted-foreground">
        El backend todavía no publicó hitos operativos para este período.
      </p>
    )}
  </section>
);

export const ExecutiveOverviewPanel = ({
  model,
  className,
  showSourceDisclosure = true,
}: ExecutiveOverviewPanelProps) => {
  const titleId = useId();
  const scorecardTitleId = useId();
  const rankingTitleId = useId();
  const journeyTitleId = useId();
  const hasContent = Boolean(
    model.scorecards.length || model.ranking || model.journey || model.callout?.title || model.callout?.description,
  );

  return (
    <section
      className={className}
      aria-labelledby={titleId}
      data-executive-overview
      data-source-mode={model.source.mode ?? 'unspecified'}
    >
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
            {model.eyebrow ?? 'Inteligencia de gestión'}
          </p>
          <h3 id={titleId} className="mt-1 text-xl font-black tracking-tight text-foreground sm:text-2xl">
            {model.title ?? 'Resumen ejecutivo'}
          </h3>
          {model.description ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{model.description}</p>
          ) : null}
        </div>
        <span className="w-fit rounded-full border border-border/70 bg-muted/20 px-3 py-1.5 text-[10px] font-bold text-muted-foreground">
          Fuente · {model.source.label}
        </span>
      </div>

      {showSourceDisclosure ? <SourceDisclosure source={model.source} /> : null}

      {hasContent ? (
        <div className="mt-4 space-y-4">
          <ScorecardGrid items={model.scorecards} titleId={scorecardTitleId} />
          {model.ranking || model.journey ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {model.ranking ? <RankingPanel ranking={model.ranking} titleId={rankingTitleId} /> : null}
              {model.journey ? <JourneyPanel journey={model.journey} titleId={journeyTitleId} /> : null}
            </div>
          ) : null}
          {model.callout?.title || model.callout?.description ? (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4" role="note">
              {model.callout.title ? <p className="text-sm font-bold text-foreground">{model.callout.title}</p> : null}
              {model.callout.description ? (
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{model.callout.description}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-border/70 bg-muted/10 p-6 text-center" role="status">
          <BarChart3 className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-foreground">Sin evidencia ejecutiva disponible</p>
          <p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-muted-foreground">
            {model.emptyMessage ?? 'El panel se completa cuando el backend publica indicadores con fuente y base declaradas.'}
          </p>
        </div>
      )}
    </section>
  );
};

export default ExecutiveOverviewPanel;
