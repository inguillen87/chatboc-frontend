import { useId, useMemo } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  MapPin,
} from 'lucide-react';

import {
  DEMO_DATA_NOTICE,
  cleanDemoText,
  formatDemoPresentationLabel,
  isResolvedDemoStatus,
} from '@/features/demo/demoPresentationLabels';

const NUMBER_FORMATTER = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });

export type ExecutiveClaimSourceKind = 'verified' | 'session' | 'synthetic' | 'mixed' | 'unknown';

export interface ExecutiveClaimCase {
  id: string;
  caseCode: string;
  title: string;
  description?: string | null;
  category?: string | null;
  status?: string | null;
  priority?: string | null;
  channel?: string | null;
  zone?: string | null;
  slaStatus?: string | null;
  openedAtLabel?: string | null;
  assigneeLabel?: string | null;
  dataMode?: string | null;
  hasLocation?: boolean;
}

export interface ExecutiveClaimsSample {
  isSample: boolean;
  displayedCases?: number | null;
  totalCases?: number | null;
  label?: string | null;
}

export interface ExecutiveClaimsPanelProps {
  cases: ExecutiveClaimCase[];
  sourceKind?: ExecutiveClaimSourceKind;
  sourceLabel?: string | null;
  showSourceDisclosure?: boolean;
  sample?: ExecutiveClaimsSample | null;
  title?: string;
  description?: string;
  orderLabel?: string | null;
  emptyTitle?: string;
  emptyDescription?: string;
  onOpenCase?: (item: ExecutiveClaimCase) => void;
  onShowCaseOnMap?: (item: ExecutiveClaimCase) => void;
}

type BreakdownItem = {
  id: string;
  label: string;
  count: number;
  share: number;
};

const hasText = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const presentLabel = (value: string) => formatDemoPresentationLabel(value.trim());

const makeBreakdown = (
  cases: ExecutiveClaimCase[],
  readValue: (item: ExecutiveClaimCase) => string | null | undefined,
): { items: BreakdownItem[]; observed: number } => {
  const counts = new Map<string, { label: string; count: number }>();

  for (const item of cases) {
    const rawValue = readValue(item);
    if (!hasText(rawValue)) continue;
    const label = presentLabel(rawValue);
    const key = label.toLocaleLowerCase('es-AR');
    const current = counts.get(key);
    counts.set(key, { label, count: (current?.count ?? 0) + 1 });
  }

  const observed = [...counts.values()].reduce((sum, item) => sum + item.count, 0);
  const items = [...counts.entries()]
    .map(([id, item]) => ({
      id,
      label: item.label,
      count: item.count,
      share: observed > 0 ? (item.count / observed) * 100 : 0,
    }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, 'es-AR'));

  return { items, observed };
};

const normalizeToneToken = (value: string | null | undefined) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const statusBadgeTone = (value: string | null | undefined) => {
  if (isResolvedDemoStatus(value)) {
    return 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  }
  const token = normalizeToneToken(value);
  if (/(vencid|incumpl|crit|urgent|alto|alta)/.test(token)) {
    return 'border-rose-500/35 bg-rose-500/10 text-rose-700 dark:text-rose-300';
  }
  if (/(riesgo|proxim|advert)/.test(token)) {
    return 'border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-200';
  }
  return 'border-border bg-muted/35 text-foreground';
};

const BreakdownSection = ({
  title,
  subtitle,
  breakdown,
  highlightResolved = false,
}: {
  title: string;
  subtitle?: string;
  breakdown: { items: BreakdownItem[]; observed: number };
  highlightResolved?: boolean;
}) => {
  const titleId = useId();

  return (
    <section
      className="rounded-[12px] border border-border bg-card p-5 sm:p-6"
      aria-labelledby={titleId}
    >
      <div className="border-b border-border pb-3">
        <h3 id={titleId} className="chatboc-display text-lg font-semibold text-foreground">
          {title}
        </h3>
        {subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>

      {breakdown.items.length ? (
        <ul className="mt-4 space-y-3.5">
          {breakdown.items.map((item) => {
            const resolved = highlightResolved && isResolvedDemoStatus(item.label);
            return (
              <li key={item.id}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate font-medium text-foreground" title={item.label}>
                    {item.label}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    <strong className="font-semibold text-foreground">{item.count}</strong>
                    <span className="ml-2">{NUMBER_FORMATTER.format(item.share)}%</span>
                  </span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-label={`${item.label}: ${item.count} de ${breakdown.observed} casos, ${NUMBER_FORMATTER.format(item.share)} %`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(item.share)}
                >
                  <div
                    className={`h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${
                      resolved ? 'bg-emerald-500' : 'bg-primary'
                    }`}
                    style={{ width: `${item.share}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 rounded-[8px] border border-dashed border-border bg-muted/15 px-4 py-4 text-sm text-muted-foreground">
          Sin datos cargados para esta apertura.
        </p>
      )}
    </section>
  );
};

const ExecutiveClaimsPanel = ({
  cases,
  sourceKind = 'unknown',
  showSourceDisclosure = true,
  sample,
  emptyTitle = 'Todavía no hay reclamos cargados',
  emptyDescription = 'Cuando ingresen reclamos desde el chat o WhatsApp los vas a ver ordenados acá.',
  onOpenCase,
  onShowCaseOnMap,
}: ExecutiveClaimsPanelProps) => {
  const statusHeadingId = useId();
  const queueHeadingId = useId();
  const statusBreakdown = useMemo(() => makeBreakdown(cases, (item) => item.status), [cases]);
  const categoryBreakdown = useMemo(() => makeBreakdown(cases, (item) => item.category), [cases]);
  const zoneBreakdown = useMemo(() => makeBreakdown(cases, (item) => item.zone), [cases]);
  const channelBreakdown = useMemo(() => makeBreakdown(cases, (item) => item.channel), [cases]);
  const reportedDisplayedCases = sample?.displayedCases;
  const reportedTotalCases = sample?.totalCases;
  const hasInconsistentSample = Boolean(
    (typeof reportedDisplayedCases === 'number' && reportedDisplayedCases !== cases.length) ||
      (typeof reportedTotalCases === 'number' && reportedTotalCases < cases.length),
  );
  const hasDuplicateIds = useMemo(() => new Set(cases.map((item) => item.id)).size !== cases.length, [cases]);

  const queueSummary =
    sample?.isSample && typeof reportedDisplayedCases === 'number' && typeof reportedTotalCases === 'number'
      ? `Mostrando ${reportedDisplayedCases} de ${reportedTotalCases} reclamos recientes`
      : `${cases.length} ${cases.length === 1 ? 'caso reciente' : 'casos recientes'}`;

  return (
    <div className="space-y-8" data-demo-executive-claims>
      {showSourceDisclosure && sourceKind === 'synthetic' ? (
        <div
          className="rounded-[12px] border border-border bg-muted/30 px-4 py-3 text-sm leading-6 text-foreground"
          role="note"
        >
          {DEMO_DATA_NOTICE}
        </div>
      ) : null}

      {hasInconsistentSample || hasDuplicateIds ? (
        <div
          className="flex items-start gap-2.5 rounded-[12px] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-foreground"
          role="alert"
        >
          <AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
          <span>
            Hay una diferencia en el conteo recibido
            {hasInconsistentSample && typeof reportedDisplayedCases === 'number'
              ? `: se anunciaron ${reportedDisplayedCases} casos y llegaron ${cases.length}`
              : ''}
            {hasDuplicateIds ? `${hasInconsistentSample ? '; ' : ': '}hay códigos repetidos` : ''}.
          </span>
        </div>
      ) : null}

      {cases.length ? (
        <>
          {statusBreakdown.items.length ? (
            <section aria-labelledby={statusHeadingId}>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h3 id={statusHeadingId} className="chatboc-display text-lg font-semibold text-foreground">
                  Cómo están hoy
                </h3>
                <span className="text-xs text-muted-foreground">Distribución por estado</span>
              </div>
              <ul
                className="m-0 grid list-none gap-px overflow-hidden rounded-[12px] border border-border bg-border p-0 sm:grid-cols-2 lg:grid-cols-4"
                aria-labelledby={statusHeadingId}
              >
                {statusBreakdown.items.map((item) => {
                  const resolved = isResolvedDemoStatus(item.label);
                  return (
                    <li key={item.id} className="bg-card p-5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-muted-foreground">{item.label}</span>
                        <span
                          className={`h-2 w-2 rounded-full ${resolved ? 'bg-emerald-500' : 'bg-primary'}`}
                          aria-hidden="true"
                        />
                      </div>
                      <p className="chatboc-display mt-2.5 text-3xl font-bold tracking-tight tabular-nums text-foreground">
                        {item.count}
                      </p>
                      <div className="mt-3">
                        <div
                          className="h-1.5 overflow-hidden rounded-full bg-muted"
                          role="progressbar"
                          aria-label={`${item.label}: ${item.count} de ${statusBreakdown.observed} casos, ${NUMBER_FORMATTER.format(item.share)} %`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Math.round(item.share)}
                        >
                          <div
                            className={`h-full rounded-full ${resolved ? 'bg-emerald-500' : 'bg-primary'}`}
                            style={{ width: `${item.share}%` }}
                          />
                        </div>
                        <p className="mt-1.5 text-xs tabular-nums text-muted-foreground">
                          {NUMBER_FORMATTER.format(item.share)}% del total visible
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <BreakdownSection
              title="Por categoría"
              subtitle="Motivos más frecuentes en los casos recientes"
              breakdown={categoryBreakdown}
            />
            {zoneBreakdown.items.length ? (
              <BreakdownSection
                title="Por zona"
                subtitle="Barrios y sectores donde se concentran los pedidos"
                breakdown={zoneBreakdown}
              />
            ) : (
              <BreakdownSection
                title="Por canal de ingreso"
                subtitle="Cómo llegan los reclamos"
                breakdown={channelBreakdown}
              />
            )}
          </div>

          <section
            className="overflow-hidden rounded-[12px] border border-border bg-card"
            aria-labelledby={queueHeadingId}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-4 sm:px-6">
              <div>
                <h3 id={queueHeadingId} className="chatboc-display text-lg font-semibold text-foreground">
                  Últimos reclamos
                </h3>
                <p className="mt-0.5 text-sm text-muted-foreground">{queueSummary}</p>
              </div>
              {sourceKind === 'session' ? (
                <span className="rounded-[8px] border border-border bg-muted/35 px-2.5 py-1 text-xs font-medium text-foreground">
                  Sesión actual
                </span>
              ) : null}
            </div>

            <ol className="divide-y divide-border" aria-label="Últimos reclamos">
              {cases.map((item, index) => {
                const cleanOpenedAt = cleanDemoText(item.openedAtLabel);
                const cleanTitle = cleanDemoText(item.title) || item.title;
                const cleanDescription = cleanDemoText(item.description);

                return (
                  <li key={`${item.id}-${index}`} className="px-5 py-4 sm:px-6" data-demo-executive-claim={item.id}>
                    <article>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-mono font-semibold text-muted-foreground">
                              {item.caseCode}
                            </span>
                            {item.status ? (
                              <span className={`rounded-[8px] border px-2 py-0.5 font-medium ${statusBadgeTone(item.status)}`}>
                                {presentLabel(item.status)}
                              </span>
                            ) : null}
                            {item.priority ? (
                              <span className="text-muted-foreground">
                                Prioridad {presentLabel(item.priority).toLocaleLowerCase('es-AR')}
                              </span>
                            ) : null}
                          </div>
                          <h4 className="mt-1.5 text-base font-semibold leading-6 text-foreground">
                            {cleanTitle}
                          </h4>
                          {cleanDescription ? (
                            <p className="mt-1 text-sm leading-5 text-muted-foreground">{cleanDescription}</p>
                          ) : null}
                        </div>
                        {item.slaStatus ? (
                          <span
                            className={`w-fit shrink-0 rounded-[8px] border px-2.5 py-1 text-xs font-medium ${statusBadgeTone(item.slaStatus)}`}
                          >
                            {presentLabel(item.slaStatus)}
                          </span>
                        ) : null}
                      </div>

                      <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
                        {item.category ? (
                          <div>
                            <dt className="inline">Categoría: </dt>
                            <dd className="inline font-medium text-foreground">{item.category}</dd>
                          </div>
                        ) : null}
                        {item.zone ? (
                          <div>
                            <dt className="inline">Zona: </dt>
                            <dd className="inline font-medium text-foreground">{item.zone}</dd>
                          </div>
                        ) : null}
                        {item.channel ? (
                          <div>
                            <dt className="inline">Canal: </dt>
                            <dd className="inline font-medium text-foreground">{presentLabel(item.channel)}</dd>
                          </div>
                        ) : null}
                        {item.assigneeLabel ? (
                          <div>
                            <dt className="inline">Área: </dt>
                            <dd className="inline font-medium text-foreground">{item.assigneeLabel}</dd>
                          </div>
                        ) : null}
                        {cleanOpenedAt ? (
                          <div>
                            <dt className="inline">Ingreso: </dt>
                            <dd className="inline font-medium text-foreground">{cleanOpenedAt}</dd>
                          </div>
                        ) : null}
                      </dl>

                      {onOpenCase || onShowCaseOnMap ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {onOpenCase ? (
                            <button
                              type="button"
                              onClick={() => onOpenCase(item)}
                              className="inline-flex min-h-11 items-center gap-1.5 rounded-[8px] border border-border bg-background px-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                              aria-label={`Abrir detalle de ${item.caseCode}`}
                            >
                              Ver detalle <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                            </button>
                          ) : null}
                          {onShowCaseOnMap ? (
                            <button
                              type="button"
                              onClick={() => onShowCaseOnMap(item)}
                              disabled={!item.hasLocation}
                              className="inline-flex min-h-11 items-center gap-1.5 rounded-[8px] border border-border bg-background px-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-45"
                              aria-label={`Mostrar ${item.caseCode} en el mapa`}
                            >
                              <MapPin className="h-4 w-4" aria-hidden="true" /> Ver en mapa
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  </li>
                );
              })}
            </ol>
          </section>
        </>
      ) : (
        <div className="rounded-[12px] border border-dashed border-border bg-muted/15 p-8 text-center">
          <CheckCircle2 className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-foreground">{emptyTitle}</p>
          <p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-muted-foreground">{emptyDescription}</p>
        </div>
      )}
    </div>
  );
};

export default ExecutiveClaimsPanel;
