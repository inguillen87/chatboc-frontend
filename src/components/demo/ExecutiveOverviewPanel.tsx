import { useId } from 'react';
import { BarChart3 } from 'lucide-react';
import {
  DEMO_DATA_NOTICE,
  cleanDemoText,
  cleanDemoUnit,
  isResolvedDemoStatus,
} from '@/features/demo/demoPresentationLabels';

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
  scopeLabel?: string | null;
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
  showHeader?: boolean;
}

const NUMBER_FORMATTER = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });
const PERCENT_FORMATTER = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });

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
  const cleanedUnit = cleanDemoUnit(unit);
  if (!cleanedUnit || normalized === '—') return normalized;
  if (cleanedUnit === '%') return `${normalized}%`;
  return `${normalized} ${cleanedUnit}`;
};

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

// El backend identifica cada fuente con el nombre de su contrato
// (`demo.admin_preview.v1`). Quien mira la demo ve de dónde salen los datos en palabras.
const CONTRACT_SOURCE_LABEL = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+\.v\d+$/i;

export const readableSourceLabel = (label?: string | null) => {
  const source = label?.trim();
  if (!source) return '';
  if (!CONTRACT_SOURCE_LABEL.test(source)) return source;
  return source.toLowerCase().startsWith('demo.') ? 'Datos de ejemplo de la demo' : 'Datos del sistema';
};

const readMixedModeLabel = (mode: ExecutiveOverviewDataMode | null | undefined) => {
  if (mode === 'synthetic_demo_scenario') return 'Datos de ejemplo';
  if (mode === 'session_generated_events') return 'Sesión actual';
  return null;
};

const SourceDisclosure = ({ source }: { source: ExecutiveOverviewSource }) => {
  if (source.synthetic) {
    return (
      <div
        className="rounded-[12px] border border-border bg-muted/30 px-4 py-3 text-sm leading-6 text-foreground"
        role="note"
        aria-label="Aviso sobre datos de ejemplo"
        data-executive-overview-disclosure="synthetic"
      >
        {DEMO_DATA_NOTICE}
      </div>
    );
  }

  if (source.partial || source.suitableForDecisions === false) {
    return (
      <div
        className="rounded-[12px] border border-border bg-muted/25 px-4 py-3 text-sm leading-6 text-muted-foreground"
        role="note"
        aria-label="Cobertura parcial de los datos"
        data-executive-overview-disclosure="partial"
      >
        <p className="font-semibold text-foreground">Cobertura parcial</p>
        <p className="mt-0.5 text-xs leading-5">
          {source.note ?? 'Esta vista todavía reúne pocos datos. Interpretá cada número con cautela.'}
        </p>
      </div>
    );
  }

  return source.note ? (
    <p className="rounded-[12px] border border-dashed border-border bg-muted/15 px-4 py-3 text-xs leading-5 text-muted-foreground">
      {source.note}
    </p>
  ) : null;
};

const ScorecardGrid = ({
  items,
  titleId,
  isMixedMode,
}: {
  items: ExecutiveOverviewScorecard[];
  titleId: string;
  isMixedMode: boolean;
}) => {
  if (!items.length) return null;

  return (
    <section aria-labelledby={titleId} data-executive-overview-scorecards>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={titleId} className="chatboc-display text-lg font-semibold text-foreground">
          Indicadores del mes
        </h3>
        <span className="text-xs text-muted-foreground">Últimos 30 días</span>
      </div>
      <ul
        className="m-0 grid list-none gap-px overflow-hidden rounded-[12px] border border-border bg-border p-0 sm:grid-cols-2 lg:grid-cols-4"
        aria-labelledby={titleId}
      >
        {items.map((item) => {
          const mixedLabel = isMixedMode ? readMixedModeLabel(item.evidence.dataMode) : null;
          const cleanDetail = cleanDemoText(item.detail);
          const cleanLabel = cleanDemoText(item.label) || item.label;
          return (
            <li
              key={item.id}
              className="flex min-w-0 flex-col justify-between bg-card p-5"
              data-scorecard-id={item.id}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-5 text-muted-foreground">{cleanLabel}</p>
                  {mixedLabel ? (
                    <span className="shrink-0 rounded-[8px] border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-foreground">
                      {mixedLabel}
                    </span>
                  ) : null}
                </div>
                <p className="chatboc-display mt-3 break-words text-3xl font-bold tracking-tight tabular-nums text-foreground">
                  {formatValue(item.value, item.unit)}
                </p>
              </div>
              {cleanDetail ? (
                <p className="mt-3 text-xs leading-5 text-muted-foreground">{cleanDetail}</p>
              ) : null}
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
  const heading = cleanDemoText(ranking.title) || 'Por dónde entran las consultas';

  return (
    <section
      className="rounded-[12px] border border-border bg-card p-5 sm:p-6"
      aria-labelledby={titleId}
      data-executive-overview-ranking
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-4">
        <div className="min-w-0">
          <h3 id={titleId} className="chatboc-display text-lg font-semibold text-foreground">
            {heading}
          </h3>
          {ranking.description ? (
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{cleanDemoText(ranking.description)}</p>
          ) : null}
        </div>
        {ranking.basis ? (
          <span className="text-sm font-medium tabular-nums text-muted-foreground">
            {formatValue(ranking.basis.value)} {ranking.basis.label.toLocaleLowerCase('es-AR')}
          </span>
        ) : null}
      </div>

      {canCompare ? (
        <ol className="mt-5 space-y-4" aria-label={heading}>
          {normalized.items.map(({ item, numericValue, share, barPercent }) => (
            <li key={item.id}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 font-medium text-foreground">{item.label}</span>
                <span className="shrink-0 text-right tabular-nums text-muted-foreground">
                  <strong className="font-semibold text-foreground">{formatValue(item.value)}</strong>
                  {share !== null ? <span className="ml-2">{PERCENT_FORMATTER.format(share)}%</span> : null}
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
              {item.detail ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p> : null}
              {numericValue === null && share === null ? (
                <span className="sr-only">Valor no comparable</span>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <div className="mt-4 rounded-[8px] border border-dashed border-border bg-muted/15 p-4" role="note">
          <p className="text-sm font-semibold text-foreground">Todavía hay pocos canales para comparar</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Se necesitan al menos dos canales con actividad para mostrar el desglose.
          </p>
          {normalized.items[0] ? (
            <p className="mt-2 text-xs font-medium text-foreground">
              Dato disponible: {normalized.items[0].item.label} ({formatValue(normalized.items[0].item.value)})
            </p>
          ) : null}
        </div>
      )}

      {normalized.hiddenCount > 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Se muestran {normalized.items.length} de {normalized.totalComparable} canales.
        </p>
      ) : null}
    </section>
  );
};

const JourneyPanel = ({ journey, titleId }: { journey: ExecutiveOverviewJourney; titleId: string }) => {
  const heading = cleanDemoText(journey.title) || 'Cómo avanza un caso';

  return (
    <section
      className="rounded-[12px] border border-border bg-card p-5 sm:p-6"
      aria-labelledby={titleId}
      data-executive-overview-journey
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-4">
        <div>
          <h3 id={titleId} className="chatboc-display text-lg font-semibold text-foreground">
            {heading}
          </h3>
          {journey.description ? (
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{cleanDemoText(journey.description)}</p>
          ) : null}
        </div>
        {journey.badge ? (
          <span className="text-xs font-medium text-muted-foreground">{journey.badge}</span>
        ) : null}
      </div>

      {journey.steps.length ? (
        <ol className="divide-y divide-border">
          {journey.steps.map((step, index) => {
            const resolved = isResolvedDemoStatus(step.status);
            const cleanTitle = cleanDemoText(step.title) || step.title;
            const cleanDesc = cleanDemoText(step.description);

            return (
              <li key={step.id} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3 py-4 first:pt-4 last:pb-0">
                <span className="mt-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{cleanTitle}</p>
                    {step.timeLabel ? (
                      <span className="text-xs tabular-nums text-muted-foreground">{step.timeLabel}</span>
                    ) : null}
                  </div>
                  {cleanDesc ? (
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">{cleanDesc}</p>
                  ) : null}
                  {step.channel || step.status ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      {step.channel ? (
                        <span className="rounded-[8px] border border-border bg-muted/30 px-2 py-0.5 text-muted-foreground">
                          {step.channel}
                        </span>
                      ) : null}
                      {step.status ? (
                        <span
                          className={`rounded-[8px] border px-2 py-0.5 font-medium ${
                            resolved
                              ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                              : 'border-border bg-background text-foreground'
                          }`}
                        >
                          {step.status}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-4 rounded-[8px] border border-dashed border-border bg-muted/15 p-4 text-sm text-muted-foreground">
          Todavía no hay movimientos registrados en este período.
        </p>
      )}
    </section>
  );
};

export const ExecutiveOverviewPanel = ({
  model,
  className,
  showSourceDisclosure = true,
  showHeader = true,
}: ExecutiveOverviewPanelProps) => {
  const titleId = useId();
  const scorecardTitleId = useId();
  const rankingTitleId = useId();
  const journeyTitleId = useId();
  const hasContent = Boolean(
    model.scorecards.length || model.ranking || model.journey || model.callout?.title || model.callout?.description,
  );
  const isMixedMode = model.source.mode === 'mixed_partitioned';
  const sourceText = readableSourceLabel(model.source.label);

  return (
    <section
      className={className}
      aria-labelledby={showHeader ? titleId : scorecardTitleId}
      data-executive-overview
      data-source-mode={model.source.mode ?? 'unspecified'}
    >
      {showHeader ? (
        <div className="mb-5">
          <h3 id={titleId} className="chatboc-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {model.title ?? 'Resumen general'}
          </h3>
          {model.description ? (
            <p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted-foreground">{model.description}</p>
          ) : null}
        </div>
      ) : null}

      {showSourceDisclosure ? <SourceDisclosure source={model.source} /> : null}

      {hasContent ? (
        <div className={showSourceDisclosure ? 'mt-6 space-y-8' : 'space-y-8'}>
          <ScorecardGrid items={model.scorecards} titleId={scorecardTitleId} isMixedMode={isMixedMode} />

          {model.ranking || model.journey ? (
            <div className="grid gap-6 xl:grid-cols-2">
              {model.ranking ? <RankingPanel ranking={model.ranking} titleId={rankingTitleId} /> : null}
              {model.journey ? <JourneyPanel journey={model.journey} titleId={journeyTitleId} /> : null}
            </div>
          ) : null}

          {model.callout?.title || model.callout?.description ? (
            <div className="rounded-[12px] border border-border bg-muted/25 p-5" role="note">
              {model.callout.title ? <p className="text-sm font-semibold text-foreground">{model.callout.title}</p> : null}
              {model.callout.description ? (
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{model.callout.description}</p>
              ) : null}
            </div>
          ) : null}

          {sourceText ? (
            <footer
              className="border-t border-border pt-3 text-xs leading-5 text-muted-foreground"
              data-executive-overview-source-footer
            >
              Fuente:{' '}
              <span title={model.source.label}>
                {sourceText}
                {model.source.scopeLabel ? ` (${model.source.scopeLabel})` : ''}
              </span>
              .
            </footer>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 rounded-[12px] border border-dashed border-border bg-muted/15 p-8 text-center" role="status">
          <BarChart3 className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-foreground">Todavía no hay indicadores para mostrar</p>
          <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-muted-foreground">
            {model.emptyMessage ?? 'Cuando se registren consultas o reclamos vas a ver el resumen acá.'}
          </p>
        </div>
      )}
    </section>
  );
};

export default ExecutiveOverviewPanel;
