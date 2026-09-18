import { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  CircleDot,
  Clock3,
  Inbox,
  MapPin,
  ShieldCheck,
} from 'lucide-react';

import { formatDemoPresentationLabel } from '@/features/demo/demoPresentationLabels';

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

const statusTone = (value: string | null | undefined) => {
  const token = normalizeToneToken(value);
  if (/(resuelt|cerrad|cumplid|complet)/.test(token)) {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200';
  }
  if (/(vencid|incumpl|crit|urgent|alto|alta)/.test(token)) {
    return 'border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-200';
  }
  if (/(riesgo|proxim|medio|media|advert)/.test(token)) {
    return 'border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-200';
  }
  return 'border-border/70 bg-muted/35 text-foreground';
};

const sourceBadgeClass: Record<ExecutiveClaimSourceKind, string> = {
  verified: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
  session: 'border-primary/25 bg-primary/10 text-primary',
  synthetic: 'border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-200',
  mixed: 'border-violet-500/30 bg-violet-500/10 text-violet-800 dark:text-violet-200',
  unknown: 'border-border/70 bg-muted/35 text-muted-foreground',
};

const sourceFallbackLabel: Record<ExecutiveClaimSourceKind, string> = {
  verified: 'Datos verificados',
  session: 'Sesión actual',
  synthetic: 'Escenario simulado',
  mixed: 'Fuentes separadas',
  unknown: 'Fuente no informada',
};

const MetricCard = ({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Inbox;
}) => (
  <div className="min-w-0 rounded-xl border border-border/60 bg-card/75 p-3 shadow-sm">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-xl font-black tabular-nums text-foreground" title={value}>{value}</p>
      </div>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
    </div>
    <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{detail}</p>
  </div>
);

const BreakdownBars = ({
  title,
  description,
  breakdown,
  totalCases,
}: {
  title: string;
  description: string;
  breakdown: { items: BreakdownItem[]; observed: number };
  totalCases: number;
}) => (
  <section className="rounded-2xl border border-border/70 bg-background/75 p-4" aria-label={title}>
    <div className="flex items-start gap-2">
      <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <div>
        <h4 className="text-xs font-bold uppercase tracking-[0.12em] text-foreground">{title}</h4>
        <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{description}</p>
      </div>
    </div>

    {breakdown.items.length ? (
      <div className="mt-4 grid gap-3">
        {breakdown.items.map((item, index) => (
          <div key={item.id} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2">
            <span
              className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                index === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
              aria-label={`Puesto ${index + 1}`}
            >
              {index + 1}
            </span>
            <div className="min-w-0">
              <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                <span className="truncate font-semibold text-foreground" title={item.label}>{item.label}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {item.count} · <strong className="font-semibold text-foreground">{NUMBER_FORMATTER.format(item.share)}%</strong>
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label={`${item.label}: ${item.count} de ${breakdown.observed} casos con dato, ${NUMBER_FORMATTER.format(item.share)} %`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(item.share)}
              >
                <div
                  className={`h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${
                    index === 0 ? 'bg-primary' : 'bg-primary/45'
                  }`}
                  style={{ width: `${item.share}%` }}
                />
              </div>
            </div>
          </div>
        ))}
        <p className="text-[10px] leading-4 text-muted-foreground">
          Base del gráfico: {breakdown.observed} de {totalCases} casos visibles con este campo informado.
        </p>
      </div>
    ) : (
      <p className="mt-4 rounded-xl border border-dashed border-border/70 bg-muted/10 px-3 py-4 text-xs leading-5 text-muted-foreground">
        El contrato no informó esta dimensión. No se completa con estimaciones.
      </p>
    )}
  </section>
);

const ExecutiveClaimsPanel = ({
  cases,
  sourceKind = 'unknown',
  sourceLabel,
  showSourceDisclosure = true,
  sample,
  title = 'Reclamos y casos operativos',
  description = 'Lectura ejecutiva de la cola recibida, con estado, prioridad, territorio y SLA cuando el contrato los informa.',
  orderLabel,
  emptyTitle = 'Sin casos en el contrato actual',
  emptyDescription = 'La API no devolvió reclamos para esta vista. El panel queda vacío de forma explícita y no genera casos ni indicadores sustitutos.',
  onOpenCase,
  onShowCaseOnMap,
}: ExecutiveClaimsPanelProps) => {
  const statusBreakdown = useMemo(() => makeBreakdown(cases, (item) => item.status), [cases]);
  const priorityBreakdown = useMemo(() => makeBreakdown(cases, (item) => item.priority), [cases]);
  const categoryBreakdown = useMemo(() => makeBreakdown(cases, (item) => item.category), [cases]);
  const channelBreakdown = useMemo(() => makeBreakdown(cases, (item) => item.channel), [cases]);
  const slaObserved = useMemo(() => cases.filter((item) => hasText(item.slaStatus)).length, [cases]);
  const zoneCount = useMemo(
    () => new Set(cases.map((item) => item.zone?.trim()).filter(hasText)).size,
    [cases],
  );
  const reportedDisplayedCases = sample?.displayedCases;
  const reportedTotalCases = sample?.totalCases;
  const hasInconsistentSample = Boolean(
    (typeof reportedDisplayedCases === 'number' && reportedDisplayedCases !== cases.length) ||
      (typeof reportedTotalCases === 'number' && reportedTotalCases < cases.length),
  );
  const hasDuplicateIds = useMemo(() => new Set(cases.map((item) => item.id)).size !== cases.length, [cases]);
  const primaryDistribution = statusBreakdown.items.length
    ? {
        breakdown: statusBreakdown,
        title: 'Distribución por estado',
        description: 'Composición de los casos que incluyen estado operativo.',
      }
    : priorityBreakdown.items.length
      ? {
          breakdown: priorityBreakdown,
          title: 'Distribución por prioridad',
          description: 'Composición de los casos que incluyen prioridad.',
        }
      : {
          breakdown: categoryBreakdown,
          title: 'Demanda por categoría',
          description: 'Ranking por cantidad dentro de la muestra visible.',
        };
  const secondaryDistribution = categoryBreakdown.items.length && primaryDistribution.breakdown !== categoryBreakdown
    ? {
        breakdown: categoryBreakdown,
        title: 'Demanda por categoría',
        description: 'Ranking por cantidad dentro de la muestra visible.',
      }
    : priorityBreakdown.items.length && primaryDistribution.breakdown !== priorityBreakdown
      ? {
          breakdown: priorityBreakdown,
          title: 'Prioridades informadas',
          description: 'Distribución de prioridades provistas por el backend.',
        }
      : {
          breakdown: channelBreakdown,
          title: 'Origen por canal',
          description: 'Composición según el canal informado para cada caso.',
        };
  const resolvedSourceLabel = sourceLabel?.trim() || sourceFallbackLabel[sourceKind];

  return (
    <section className="grid gap-3" aria-labelledby="executive-claims-title" data-demo-executive-claims>
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-background/75 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 p-4 sm:p-5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Inbox className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Gestión ciudadana</p>
                <h3 id="executive-claims-title" className="mt-0.5 text-base font-bold text-foreground">{title}</h3>
              </div>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${sourceBadgeClass[sourceKind]}`}>
            {resolvedSourceLabel}
          </span>
        </div>

        {showSourceDisclosure && sourceKind === 'synthetic' ? (
          <div className="border-t border-amber-500/20 bg-amber-500/[0.08] px-4 py-3 text-xs leading-5 text-foreground" role="note">
            Escenario sintético de demostración: estos casos no corresponden a personas reales ni representan demanda municipal oficial.
          </div>
        ) : null}

        {showSourceDisclosure && sourceKind === 'mixed' ? (
          <div className="border-t border-violet-500/20 bg-violet-500/[0.07] px-4 py-3 text-xs leading-5 text-foreground" role="note">
            La vista contiene fuentes distintas. Cada caso conserva su modo de datos para evitar mezclar actividad de sesión con el escenario base.
          </div>
        ) : null}

        {sample?.isSample ? (
          <div className="border-t border-border/60 bg-muted/15 px-4 py-3 text-xs leading-5 text-foreground">
            <span className="font-semibold">Cobertura visible · </span>
            {typeof reportedDisplayedCases === 'number' && typeof reportedTotalCases === 'number'
              ? `${reportedDisplayedCases} de ${reportedTotalCases} casos informados por el contrato.`
              : 'El backend identificó esta vista como una muestra.'}
            {sample.label ? <span className="block text-muted-foreground">{sample.label}</span> : null}
          </div>
        ) : null}

        {hasInconsistentSample || hasDuplicateIds ? (
          <div className="flex items-start gap-2 border-t border-amber-500/20 bg-amber-500/[0.08] px-4 py-3 text-xs leading-5 text-amber-950 dark:text-amber-100" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              El contrato presenta una inconsistencia de inventario
              {hasInconsistentSample && typeof reportedDisplayedCases === 'number'
                ? `: declara ${reportedDisplayedCases} casos visibles y entregó ${cases.length}`
                : ''}
              {hasDuplicateIds ? `${hasInconsistentSample ? '; ' : ': '}hay identificadores repetidos` : ''}.
              Se muestran los registros recibidos sin completar ni descartar información.
            </span>
          </div>
        ) : null}

        {cases.length ? (
          <div className="grid grid-cols-2 gap-px bg-border/60 sm:grid-cols-4" aria-label="Cobertura operativa de los casos visibles">
            <div className="bg-background p-4">
              <MetricCard label="Casos visibles" value={NUMBER_FORMATTER.format(cases.length)} detail="registros recibidos" icon={Inbox} />
            </div>
            <div className="bg-background p-4">
              <MetricCard
                label="Con estado"
                value={`${statusBreakdown.observed}/${cases.length}`}
                detail="cobertura del campo"
                icon={CircleDot}
              />
            </div>
            <div className="bg-background p-4">
              <MetricCard
                label="Con SLA"
                value={`${slaObserved}/${cases.length}`}
                detail="sin inferir cumplimiento"
                icon={ShieldCheck}
              />
            </div>
            <div className="bg-background p-4">
              <MetricCard
                label="Zonas informadas"
                value={NUMBER_FORMATTER.format(zoneCount)}
                detail="territorios distintos"
                icon={MapPin}
              />
            </div>
          </div>
        ) : null}
      </div>

      {cases.length ? (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            <BreakdownBars
              title={primaryDistribution.title}
              description={primaryDistribution.description}
              breakdown={primaryDistribution.breakdown}
              totalCases={cases.length}
            />
            <BreakdownBars
              title={secondaryDistribution.title}
              description={secondaryDistribution.description}
              breakdown={secondaryDistribution.breakdown}
              totalCases={cases.length}
            />
          </div>

          <section className="overflow-hidden rounded-2xl border border-border/70 bg-background/75" aria-labelledby="executive-claims-queue-title">
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/60 px-4 py-3 sm:px-5">
              <div>
                <h4 id="executive-claims-queue-title" className="text-sm font-bold text-foreground">Cola operativa visible</h4>
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                  {orderLabel?.trim() || 'Orden conservado exactamente como lo entregó el backend.'}
                </p>
              </div>
              <span className="rounded-full border border-border/70 bg-muted/25 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
                {cases.length} {cases.length === 1 ? 'caso' : 'casos'}
              </span>
            </div>

            <ol className="divide-y divide-border/60" aria-label="Casos operativos">
              {cases.map((item, index) => (
                <li key={`${item.id}-${index}`} className="p-4 sm:p-5" data-demo-executive-claim={item.id}>
                  <article>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
                            {item.caseCode}
                          </span>
                          {item.status ? (
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusTone(item.status)}`}>
                              {presentLabel(item.status)}
                            </span>
                          ) : null}
                          {item.priority ? (
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusTone(item.priority)}`}>
                              Prioridad · {presentLabel(item.priority)}
                            </span>
                          ) : null}
                        </div>
                        <h5 className="mt-1.5 text-sm font-bold leading-5 text-foreground sm:text-base">{item.title}</h5>
                        {item.description ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p> : null}
                      </div>
                      {item.slaStatus ? (
                        <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusTone(item.slaStatus)}`}>
                          <Clock3 className="h-3 w-3" aria-hidden="true" />
                          SLA · {presentLabel(item.slaStatus)}
                        </span>
                      ) : null}
                    </div>

                    <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px]">
                      {item.category ? <div><dt className="inline text-muted-foreground">Categoría: </dt><dd className="inline font-semibold text-foreground">{item.category}</dd></div> : null}
                      {item.channel ? <div><dt className="inline text-muted-foreground">Canal: </dt><dd className="inline font-semibold text-foreground">{presentLabel(item.channel)}</dd></div> : null}
                      {item.zone ? <div><dt className="inline text-muted-foreground">Zona: </dt><dd className="inline font-semibold text-foreground">{item.zone}</dd></div> : null}
                      {item.assigneeLabel ? <div><dt className="inline text-muted-foreground">Responsable: </dt><dd className="inline font-semibold text-foreground">{item.assigneeLabel}</dd></div> : null}
                      {item.openedAtLabel ? <div><dt className="inline text-muted-foreground">Apertura: </dt><dd className="inline font-semibold text-foreground">{item.openedAtLabel}</dd></div> : null}
                    </dl>

                    {sourceKind === 'mixed' && item.dataMode ? (
                      <p className="mt-2 text-[10px] text-muted-foreground">Fuente del caso: {presentLabel(item.dataMode)}</p>
                    ) : null}

                    {onOpenCase || onShowCaseOnMap ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {onOpenCase ? (
                          <button
                            type="button"
                            onClick={() => onOpenCase(item)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            aria-label={`Abrir detalle de ${item.caseCode}`}
                          >
                            Ver detalle <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        ) : null}
                        {onShowCaseOnMap ? (
                          <button
                            type="button"
                            onClick={() => onShowCaseOnMap(item)}
                            disabled={!item.hasLocation}
                            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-45"
                            aria-label={`Mostrar ${item.caseCode} en el mapa`}
                          >
                            <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> Mapa
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                </li>
              ))}
            </ol>
          </section>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 p-6 text-center">
          <CheckCircle2 className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-foreground">{emptyTitle}</p>
          <p className="mx-auto mt-1 max-w-xl text-xs leading-5 text-muted-foreground">{emptyDescription}</p>
        </div>
      )}
    </section>
  );
};

export default ExecutiveClaimsPanel;
