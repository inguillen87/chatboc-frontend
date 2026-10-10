import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  List,
  MapPinned,
  ShieldCheck,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { HeatPoint } from '@/services/statsService';
import {
  buildTerritorialTicketHref,
  resolveTerritorialTicketIdentity,
} from '@/utils/territorialTicketIdentity';

const PAGE_SIZE = 25;
const FACET_PAGE_SIZE = 5;

export interface TerritorialMapAccessibleSummary {
  id?: string;
  label: string;
  value: string | number;
  detail?: string;
}

export interface TerritorialCoverageFacet {
  key: string;
  label: string;
  total?: number;
  mappedCount?: number;
  pendingGeocodeCount?: number;
  outsideJurisdictionCount?: number;
  selected?: boolean;
}

export interface TerritorialCoverageDimension {
  id: 'categories' | 'zones' | 'locations';
  label: string;
  rows: TerritorialCoverageFacet[];
  protected?: boolean;
}

export interface TerritorialCoverageScope {
  label: string;
  mode: 'global' | 'single' | 'combined';
  total?: number;
  mappedCount?: number;
  pendingGeocodeCount?: number;
  outsideJurisdictionCount?: number;
}

export interface TerritorialCoverageSourceStatus {
  label: string;
  detail?: string;
}

export interface TerritorialMapAccessibleSheetProps {
  points: HeatPoint[];
  canShowExactPointMarkers: boolean;
  tenantSlug?: string | null;
  /** Aggregated, privacy-safe metrics supplied by the territorial contract. */
  summaries?: TerritorialMapAccessibleSummary[];
  /** Contract-backed dimensions. Labels must already be safe aggregated labels. */
  coverageDimensions?: TerritorialCoverageDimension[];
  coverageScope?: TerritorialCoverageScope;
  activeFilterCount?: number;
  provenance?: TerritorialCoverageSourceStatus;
  freshness?: TerritorialCoverageSourceStatus;
}

type SafePointView = {
  key: string;
  category: string;
  area: string;
  status: string | null;
  channel: string | null;
  ticketHref: string | null;
};

const normalizedLabel = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
};

/**
 * Produces a deliberately restricted view model. Exact addresses and
 * coordinates are never copied into the accessible list.
 */
const toSafePointView = (point: HeatPoint, index: number, tenantSlug?: string | null): SafePointView => {
  const identityResolution = resolveTerritorialTicketIdentity(point, tenantSlug);
  const identity = identityResolution.status === 'valid' ? identityResolution.identity : null;
  const category = normalizedLabel(point.categoria) ?? 'Categoría no informada';
  const area =
    normalizedLabel(point.addressCellLabel) ??
    normalizedLabel(point.barrio) ??
    normalizedLabel(point.distrito) ??
    'Zona agregada no informada';

  return {
    key: identity?.opaqueKey ?? `${category}:${area}:${index}`,
    category,
    area,
    status: normalizedLabel(point.estado),
    channel: normalizedLabel(point.canal),
    ticketHref: buildTerritorialTicketHref(identity, tenantSlug),
  };
};

const PrivacySummary = ({ summaries }: { summaries: TerritorialMapAccessibleSummary[] }) => (
  <div className="space-y-4 p-5">
    <div
      className="rounded-xl border border-primary/20 bg-primary/5 p-4"
      data-testid="territorial-list-privacy-notice"
      role="status"
    >
      <div className="flex items-start gap-3">
        <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="space-y-1">
          <p className="font-semibold text-foreground">Vista territorial protegida</p>
          <p className="text-sm leading-6 text-muted-foreground">
            La política de privacidad permite consultar únicamente información agregada. No se enumeran
            casos, personas ni ubicaciones individuales.
          </p>
        </div>
      </div>
    </div>

    {summaries.length > 0 ? (
      <section aria-labelledby="territorial-summary-title" className="space-y-3">
        <h3 id="territorial-summary-title" className="text-sm font-semibold text-foreground">
          Resumen agregado
        </h3>
        <dl className="grid gap-3 sm:grid-cols-2">
          {summaries.map((summary, index) => (
            <div
              key={summary.id ?? `${summary.label}:${index}`}
              className="rounded-xl border bg-card p-4 shadow-sm"
            >
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {summary.label}
              </dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{summary.value}</dd>
              {summary.detail ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{summary.detail}</p> : null}
            </div>
          ))}
        </dl>
      </section>
    ) : (
      <p className="rounded-xl border border-dashed p-4 text-sm leading-6 text-muted-foreground">
        No hay un resumen agregado disponible para esta combinación de filtros.
      </p>
    )}
  </div>
);

const coverageNumberFormatter = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

const formatCoverageMetric = (value: number | undefined) =>
  value === undefined || !Number.isFinite(value) ? '—' : coverageNumberFormatter.format(value);

const CoverageScopeSummary = ({ scope }: { scope: TerritorialCoverageScope }) => {
  const metrics = [
    { label: 'Total', value: scope.total },
    { label: 'Mapeados', value: scope.mappedCount },
    { label: 'Pendientes de geocodificar', value: scope.pendingGeocodeCount },
    { label: 'Fuera de jurisdicción / revisar', value: scope.outsideJurisdictionCount },
  ];

  return (
    <section aria-labelledby="territorial-accessible-scope-title" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="territorial-accessible-scope-title" className="text-sm font-semibold text-foreground">
          Alcance actual
        </h3>
        <Badge variant="outline">{scope.label}</Badge>
      </div>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-lg border bg-card p-3">
            <dt className="text-[11px] font-medium leading-4 text-muted-foreground">{metric.label}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-foreground">
              {formatCoverageMetric(metric.value)}
            </dd>
          </div>
        ))}
      </dl>
      {scope.mode === 'combined' ? (
        <p className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs leading-5 text-muted-foreground">
          La combinación usa sólo los puntos mapeados que cumplen todos los filtros. El contrato no informa
          denominadores cruzados para total, pendientes ni revisión; esos valores se muestran como no disponibles.
        </p>
      ) : null}
    </section>
  );
};

const CoverageMatrix = ({
  dimensions,
  scope,
  activeFilterCount,
  provenance,
  freshness,
}: {
  dimensions: TerritorialCoverageDimension[];
  scope?: TerritorialCoverageScope;
  activeFilterCount: number;
  provenance?: TerritorialCoverageSourceStatus;
  freshness?: TerritorialCoverageSourceStatus;
}) => {
  // Keep every contract dimension visible. An empty dimension is meaningful:
  // it must say "not available" rather than silently disappearing.
  const availableDimensions = dimensions;
  const [activeDimensionId, setActiveDimensionId] = useState<TerritorialCoverageDimension['id']>(
    availableDimensions[0]?.id ?? 'categories',
  );
  const [visibleRowCount, setVisibleRowCount] = useState(FACET_PAGE_SIZE);

  useEffect(() => {
    if (!availableDimensions.some((dimension) => dimension.id === activeDimensionId)) {
      setActiveDimensionId(availableDimensions[0]?.id ?? 'categories');
    }
  }, [activeDimensionId, availableDimensions]);

  useEffect(() => {
    setVisibleRowCount(FACET_PAGE_SIZE);
  }, [activeDimensionId, activeFilterCount]);

  const activeDimension =
    availableDimensions.find((dimension) => dimension.id === activeDimensionId) ?? availableDimensions[0];
  const rowsForCurrentScope = useMemo(() => {
    if (!activeDimension || scope?.mode === 'combined') return [];
    if (activeFilterCount <= 0) return activeDimension.rows;
    return activeDimension.rows.filter((row) => row.selected);
  }, [activeDimension, activeFilterCount, scope?.mode]);
  const visibleRows = rowsForCurrentScope.slice(0, visibleRowCount);
  const hasHiddenRows = rowsForCurrentScope.length > visibleRows.length;
  const isScopedByAnotherDimension =
    activeFilterCount > 0 && scope?.mode !== 'combined' && rowsForCurrentScope.length === 0;

  return (
    <div className="space-y-5 p-5" data-testid="territorial-coverage-matrix">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 space-y-2">
            <div>
              <p className="font-semibold text-foreground">Lectura territorial sin barreras</p>
              <p className="text-sm leading-6 text-muted-foreground">
                Alternativa tabular del mapa de calor. No expone coordenadas, personas ni domicilios particulares.
              </p>
            </div>
            {provenance || freshness ? (
              <div className="flex flex-wrap gap-2" aria-label="Procedencia y frescura de los datos">
                {provenance ? (
                  <Badge
                    variant="outline"
                    title={provenance.detail}
                    aria-label={`Fuente: ${provenance.label}${provenance.detail ? `. ${provenance.detail}` : ''}`}
                  >
                    Fuente: {provenance.label}
                  </Badge>
                ) : null}
                {freshness ? (
                  <Badge
                    variant="outline"
                    className="gap-1"
                    title={freshness.detail}
                    aria-label={`${freshness.label}${freshness.detail ? `. ${freshness.detail}` : ''}`}
                  >
                    <Activity aria-hidden="true" className="h-3.5 w-3.5" />
                    {freshness.label}
                  </Badge>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {scope ? <CoverageScopeSummary scope={scope} /> : null}

      {availableDimensions.length > 0 ? (
        <section aria-labelledby="territorial-breakdown-title" className="space-y-3">
          <div>
            <h3 id="territorial-breakdown-title" className="text-sm font-semibold text-foreground">
              Desglose territorial
            </h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Totales del contrato actual. Los filtros del mapa también limitan esta lectura.
            </p>
          </div>

          <Tabs
            value={activeDimension?.id ?? 'categories'}
            onValueChange={(value) => setActiveDimensionId(value as TerritorialCoverageDimension['id'])}
          >
            <TabsList className="grid h-auto w-full grid-cols-3 gap-1" aria-label="Dimensión territorial">
              {availableDimensions.map((dimension) => (
                <TabsTrigger
                  key={dimension.id}
                  value={dimension.id}
                  className="min-h-10 whitespace-normal px-2 text-xs leading-4"
                >
                  {dimension.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {availableDimensions.map((dimension) => (
              <TabsContent key={dimension.id} value={dimension.id} className="mt-3">
                {dimension.protected ? (
                  <p className="rounded-lg border border-dashed p-4 text-sm leading-6 text-muted-foreground" role="status">
                    Esta segmentación está protegida por la política de privacidad del contrato.
                  </p>
                ) : scope?.mode === 'combined' ? (
                  <p className="rounded-lg border border-dashed p-4 text-sm leading-6 text-muted-foreground" role="status">
                    El contrato no publica el cruce completo entre estos filtros. Se conserva sólo el total de puntos
                    mapeados del alcance actual para evitar presentar cifras globales como si fueran combinadas.
                  </p>
                ) : isScopedByAnotherDimension ? (
                  <p className="rounded-lg border border-dashed p-4 text-sm leading-6 text-muted-foreground" role="status">
                    La selección activa pertenece a otra dimensión. Este desglose no se recalcula sin un denominador
                    cruzado informado por el sistema.
                  </p>
                ) : visibleRows.length > 0 ? (
                  <>
                    <div
                      className="overflow-x-auto rounded-lg border"
                      role="region"
                      aria-label={`Tabla desplazable de ${dimension.label.toLocaleLowerCase('es-AR')}`}
                      tabIndex={0}
                    >
                      <table className="w-full min-w-[520px] border-collapse text-left text-xs">
                        <caption className="sr-only">
                          Cobertura territorial por {dimension.label.toLocaleLowerCase('es-AR')}
                        </caption>
                        <thead className="bg-muted/60 text-muted-foreground">
                          <tr>
                            <th scope="col" className="px-3 py-2.5 font-semibold">Segmento</th>
                            <th scope="col" className="px-3 py-2.5 text-right font-semibold">Total</th>
                            <th scope="col" className="px-3 py-2.5 text-right font-semibold">Mapeados</th>
                            <th scope="col" className="px-3 py-2.5 text-right font-semibold">Pendientes</th>
                            <th scope="col" className="px-3 py-2.5 text-right font-semibold">Revisar</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {visibleRows.map((row) => (
                            <tr key={row.key} className={row.selected ? 'bg-primary/5' : 'bg-background'}>
                              <th scope="row" className="max-w-[220px] px-3 py-3 font-medium text-foreground">
                                <span className="line-clamp-2">{row.label}</span>
                                {row.selected ? <span className="sr-only"> (filtro activo)</span> : null}
                              </th>
                              <td className="px-3 py-3 text-right tabular-nums">{formatCoverageMetric(row.total)}</td>
                              <td className="px-3 py-3 text-right tabular-nums">{formatCoverageMetric(row.mappedCount)}</td>
                              <td className="px-3 py-3 text-right tabular-nums">{formatCoverageMetric(row.pendingGeocodeCount)}</td>
                              <td className="px-3 py-3 text-right tabular-nums">{formatCoverageMetric(row.outsideJurisdictionCount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {rowsForCurrentScope.length > FACET_PAGE_SIZE ? (
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
                          {visibleRows.length} de {rowsForCurrentScope.length} filas
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setVisibleRowCount((current) =>
                              hasHiddenRows ? Math.min(rowsForCurrentScope.length, current + FACET_PAGE_SIZE) : FACET_PAGE_SIZE,
                            )
                          }
                        >
                          {hasHiddenRows ? 'Ver más' : 'Ver menos'}
                        </Button>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="rounded-lg border border-dashed p-4 text-sm leading-6 text-muted-foreground" role="status">
                    No hay agregaciones verificadas para esta dimensión y los filtros actuales.
                  </p>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </section>
      ) : (
        <p className="rounded-xl border border-dashed p-4 text-sm leading-6 text-muted-foreground" role="status">
          El contrato no informó categorías, zonas ni agrupaciones territoriales seguras.
        </p>
      )}
    </div>
  );
};

export const TerritorialMapAccessibleSheet = ({
  points,
  canShowExactPointMarkers,
  tenantSlug,
  summaries = [],
  coverageDimensions = [],
  coverageScope,
  activeFilterCount = 0,
  provenance,
  freshness,
}: TerritorialMapAccessibleSheetProps) => {
  const [page, setPage] = useState(1);
  const hasStructuredCoverage = Boolean(coverageScope || coverageDimensions.length > 0);
  const hasCoverageView = hasStructuredCoverage || summaries.length > 0 || !canShowExactPointMarkers;
  const [activeView, setActiveView] = useState<'coverage' | 'points'>(
    hasCoverageView ? 'coverage' : 'points',
  );
  const safePoints = useMemo(
    () => canShowExactPointMarkers
      ? points.map((point, index) => toSafePointView(point, index, tenantSlug))
      : [],
    [canShowExactPointMarkers, points, tenantSlug],
  );
  const totalPages = Math.max(1, Math.ceil(safePoints.length / PAGE_SIZE));

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, totalPages));
  }, [totalPages]);

  useEffect(() => {
    if (!canShowExactPointMarkers && activeView === 'points') {
      setActiveView('coverage');
    }
  }, [activeView, canShowExactPointMarkers]);

  const pageStart = (page - 1) * PAGE_SIZE;
  const visiblePoints = safePoints.slice(pageStart, pageStart + PAGE_SIZE);
  const firstVisiblePosition = safePoints.length > 0 ? pageStart + 1 : 0;
  const lastVisiblePosition = Math.min(pageStart + PAGE_SIZE, safePoints.length);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-2">
          <List aria-hidden="true" className="h-4 w-4" />
          {hasStructuredCoverage
            ? canShowExactPointMarkers
              ? `Ver datos accesibles (${points.length})`
              : 'Ver datos accesibles'
            : canShowExactPointMarkers
              ? `Ver puntos en lista (${points.length})`
              : 'Ver resumen territorial'}
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="flex h-full w-[94vw] flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-5 py-5 text-left">
          <div className="flex items-start gap-3 pr-8">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <MapPinned aria-hidden="true" className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <SheetTitle>Lectura territorial accesible</SheetTitle>
              <SheetDescription>
                Matriz y lista equivalentes al mapa, sin coordenadas ni domicilios particulares.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <Tabs
          value={activeView}
          onValueChange={(value) => setActiveView(value as 'coverage' | 'points')}
          className="flex min-h-0 flex-1 flex-col"
        >
          {hasCoverageView && canShowExactPointMarkers ? (
            <div className="border-b px-5 py-3">
              <TabsList className="grid h-auto w-full grid-cols-2" aria-label="Vista territorial accesible">
                <TabsTrigger value="coverage" className="min-h-10">Cobertura</TabsTrigger>
                <TabsTrigger value="points" className="min-h-10">Puntos ({safePoints.length})</TabsTrigger>
              </TabsList>
            </div>
          ) : null}

          {hasCoverageView ? (
            <TabsContent value="coverage" className="mt-0 min-h-0 flex-1">
              <ScrollArea className="h-full">
                {hasStructuredCoverage ? (
                  <CoverageMatrix
                    dimensions={coverageDimensions}
                    scope={coverageScope}
                    activeFilterCount={activeFilterCount}
                    provenance={provenance}
                    freshness={freshness}
                  />
                ) : (
                  <PrivacySummary summaries={summaries} />
                )}
              </ScrollArea>
            </TabsContent>
          ) : null}

          {canShowExactPointMarkers ? (
            <TabsContent value="points" className="mt-0 flex min-h-0 flex-1 flex-col">
              <ScrollArea className="min-h-0 flex-1">
                {safePoints.length === 0 ? (
                  <div className="p-5">
                    <p className="rounded-xl border border-dashed p-4 text-sm leading-6 text-muted-foreground" role="status">
                      No hay puntos disponibles para esta combinación de filtros.
                    </p>
                  </div>
                ) : (
                  <ol className="space-y-3 p-5" start={firstVisiblePosition} aria-label="Puntos territoriales filtrados">
                    {visiblePoints.map((point, index) => (
                      <li key={`${point.key}:${pageStart + index}`} className="rounded-xl border bg-card p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <p className="font-semibold leading-5 text-foreground">
                              <span className="sr-only">Punto {pageStart + index + 1}: </span>
                              {point.category}
                            </p>
                            <p className="text-sm leading-5 text-muted-foreground">{point.area}</p>
                          </div>
                          {point.ticketHref ? (
                            <Button asChild variant="outline" size="sm" className="shrink-0 gap-1.5">
                              <a href={point.ticketHref}>
                                Abrir caso
                                <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                              </a>
                            </Button>
                          ) : null}
                        </div>

                        {point.status || point.channel ? (
                          <div className="mt-3 flex flex-wrap gap-2" aria-label="Datos operativos del punto">
                            {point.status ? <Badge variant="secondary">Estado: {point.status}</Badge> : null}
                            {point.channel ? <Badge variant="outline">Canal: {point.channel}</Badge> : null}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                )}
              </ScrollArea>

              {safePoints.length > 0 ? (
                <div className="flex items-center justify-between gap-3 border-t bg-background px-5 py-4">
                  <p className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
                    {firstVisiblePosition}-{lastVisiblePosition} de {safePoints.length}
                  </p>
                  <div className="flex items-center gap-2" aria-label="Paginación de puntos territoriales">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft aria-hidden="true" className="mr-1 h-4 w-4" />
                      Anterior
                    </Button>
                    <span className="min-w-16 text-center text-xs font-medium tabular-nums text-muted-foreground">
                      {page} / {totalPages}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
                      disabled={page === totalPages}
                    >
                      Siguiente
                      <ChevronRight aria-hidden="true" className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </TabsContent>
          ) : null}
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

export default TerritorialMapAccessibleSheet;
