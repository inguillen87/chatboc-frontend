import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, List, MapPinned, ShieldCheck } from 'lucide-react';

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
import type { HeatPoint } from '@/services/statsService';
import {
  buildTerritorialTicketHref,
  resolveTerritorialTicketIdentity,
} from '@/utils/territorialTicketIdentity';

const PAGE_SIZE = 25;

export interface TerritorialMapAccessibleSummary {
  id?: string;
  label: string;
  value: string | number;
  detail?: string;
}

export interface TerritorialMapAccessibleSheetProps {
  points: HeatPoint[];
  canShowExactPointMarkers: boolean;
  tenantSlug?: string | null;
  /** Aggregated, privacy-safe metrics supplied by the territorial contract. */
  summaries?: TerritorialMapAccessibleSummary[];
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

export const TerritorialMapAccessibleSheet = ({
  points,
  canShowExactPointMarkers,
  tenantSlug,
  summaries = [],
}: TerritorialMapAccessibleSheetProps) => {
  const [page, setPage] = useState(1);
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

  const pageStart = (page - 1) * PAGE_SIZE;
  const visiblePoints = safePoints.slice(pageStart, pageStart + PAGE_SIZE);
  const firstVisiblePosition = safePoints.length > 0 ? pageStart + 1 : 0;
  const lastVisiblePosition = Math.min(pageStart + PAGE_SIZE, safePoints.length);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-2">
          <List aria-hidden="true" className="h-4 w-4" />
          {canShowExactPointMarkers
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
              <SheetTitle>Puntos territoriales</SheetTitle>
              <SheetDescription>
                Alternativa accesible del mapa, sin coordenadas ni domicilios particulares.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          {!canShowExactPointMarkers ? (
            <PrivacySummary summaries={summaries} />
          ) : safePoints.length === 0 ? (
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

        {canShowExactPointMarkers && safePoints.length > 0 ? (
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
      </SheetContent>
    </Sheet>
  );
};

export default TerritorialMapAccessibleSheet;
