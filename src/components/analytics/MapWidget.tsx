import { useCallback, useMemo, useState } from 'react';
import MapLibreMap from '@/components/LazyMapLibreMap';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type {
  HeatmapMetadataItem,
  HeatmapResponse,
  PointsResponse,
} from '@/services/analyticsService';
import { WidgetFrame } from './WidgetFrame';
import { useMapProvider } from '@/hooks/useMapProvider';
import type { MapProvider, MapProviderUnavailableReason } from '@/hooks/useMapProvider';
import { MapProviderToggle } from '@/components/MapProviderToggle';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AnalyticsEmptyState } from './AnalyticsEmptyState';

interface MapWidgetProps {
  title: string;
  description?: string;
  heatmap?: HeatmapResponse;
  points?: PointsResponse;
  loading?: boolean;
  exportName: string;
  onBoundingBoxChange?: (bbox: [number, number, number, number] | null) => void;
}

type Mode = 'heatmap' | 'puntos';

const safeNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const safeCoordinate = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const resolveCellCoordinates = (cell: Record<string, unknown>) => {
  const lat = safeCoordinate(cell.lat ?? cell.centroid_lat);
  const lng = safeCoordinate(cell.lng ?? cell.lon ?? cell.centroid_lon);
  return lat === null || lng === null ? null : { lat, lng };
};

const safeMetadataItems = (items: unknown): HeatmapMetadataItem[] =>
  Array.isArray(items) ? (items as HeatmapMetadataItem[]) : [];

const formatCompactNumber = (value: number) =>
  new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

const formatLegendWeight = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (value >= 1000) return formatCompactNumber(value);
  if (value >= 10) return value.toFixed(0);
  return value.toFixed(1);
};

export function MapWidget({
  title,
  description,
  heatmap,
  points,
  loading,
  exportName,
  onBoundingBoxChange,
}: MapWidgetProps) {
  const [mode, setMode] = useState<Mode>('heatmap');
  const [lastBbox, setLastBbox] = useState<[number, number, number, number] | null>(null);
  const { provider, setProvider } = useMapProvider();
  const googleProviderAvailable = useMemo(
    () => ((import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '').trim().length > 0),
    [],
  );
  const [providerWarning, setProviderWarning] = useState<string | null>(null);

  const handleProviderUnavailable = useCallback(
    (currentProvider: MapProvider, reason: MapProviderUnavailableReason, details?: unknown) => {
      console.warn('[MapWidget] Map provider unavailable, falling back to MapLibre', {
        provider: currentProvider,
        reason,
        details,
      });
      setProvider('maplibre');
      const reasons: Record<MapProviderUnavailableReason, string> = {
        'missing-api-key':
          'Falta configurar VITE_GOOGLE_MAPS_API_KEY para mostrar el mapa de calor. Se cambió automáticamente a MapLibre.',
        'load-error': 'No se pudo cargar Google Maps. Revisá la clave y la conexión. Se usará MapLibre por ahora.',
        'heatmap-unavailable':
          'Google Maps no ofrece el layer de calor en esta cuenta. Se cambió automáticamente a MapLibre.',
      };
      setProviderWarning(reasons[reason] ?? null);
    },
    [setProvider],
  );

  const dataset = useMemo(() => {
    if (!heatmap) return [];
    const base = (heatmap.cells ?? []).flatMap((cell) => {
      const coordinates = resolveCellCoordinates(cell);
      if (!coordinates) return [];

      return {
        id: cell.cellId ?? cell.id ?? cell.key,
        ...coordinates,
        weight: cell.weight ?? cell.count,
        categoria: Object.keys(cell.breakdown ?? {})[0] ?? cell.categoria ?? cell.category ?? 'general',
        estado: 'aggregated',
      };
    });
    if (mode === 'puntos' && points?.points?.length) {
      return points.points.flatMap((point) => {
        const lat = safeCoordinate(point.lat);
        const lng = safeCoordinate(point.lon);
        if (lat === null || lng === null) return [];

        return {
          id: point.cellId,
          lat,
          lng,
          weight: 1,
          categoria: point.categoria,
          estado: point.estado,
        };
      });
    }
    return base;
  }, [heatmap, points, mode]);

  const csv = useMemo(() => {
    if (!heatmap) return [];
    return (heatmap.cells ?? []).map((cell) => ({
      cell: cell.cellId,
      total: cell.count,
      weight: cell.weight,
      lat: resolveCellCoordinates(cell)?.lat,
      lon: resolveCellCoordinates(cell)?.lng,
      ...cell.breakdown,
    }));
  }, [heatmap]);

  const hotspots = heatmap?.hotspots ?? [];
  const metadata = heatmap?.metadata;
  const metadataTotals = metadata?.totals ?? {};
  const metadataIntensity = metadata?.intensity ?? {};
  const serviceLevels = metadata?.serviceLevels ?? {};
  const responseMinutes = serviceLevels.responseMinutes ?? {};
  const resolutionMinutes = serviceLevels.resolutionMinutes ?? {};
  const hasDataset = dataset.length > 0;
  const cellCount = heatmap?.cells?.length ?? 0;
  const pointCount = points?.points?.length ?? 0;
  const visibleCount = dataset.length;
  const coverage = safeNumber(metadataTotals.coverage);
  const totalWeight = safeNumber(metadataIntensity.totalWeight);
  const averageWeight = safeNumber(metadataIntensity.averageWeight);
  const maxVisibleWeight = dataset.reduce((max, point) => Math.max(max, safeNumber(point.weight)), 0);
  const primaryHotspot = hotspots[0];
  const primaryHotspotLabel =
    primaryHotspot?.label ??
    primaryHotspot?.cellId ??
    primaryHotspot?.id ??
    Object.keys(primaryHotspot?.breakdown ?? {})[0] ??
    'Sin foco';
  const totalTickets = safeNumber(metadataTotals.tickets) || safeNumber(metadataTotals.geocoded) + safeNumber(metadataTotals.missing);
  const missingGeo = safeNumber(metadataTotals.missing);
  const geoCoverageTone = coverage >= 85 ? 'Alta' : coverage >= 60 ? 'Media' : coverage > 0 ? 'Baja' : 'Sin datos';
  const geoCoverageClass =
    coverage >= 85
      ? 'border-emerald-300/40 bg-emerald-400/10 text-emerald-50'
      : coverage >= 60
        ? 'border-amber-300/40 bg-amber-400/10 text-amber-50'
        : 'border-rose-300/40 bg-rose-400/10 text-rose-50';
  const responseP90 = safeNumber(responseMinutes.p90);
  const resolutionP90 = safeNumber(resolutionMinutes.p90);
  const topCategory = safeMetadataItems(metadata?.categories ?? metadata?.byCategory)[0];
  const topStatus = safeMetadataItems(metadata?.status ?? metadata?.byStatus)[0];
  const topSeverity = safeMetadataItems(metadata?.severity)[0];
  const actionSignals = [
    topCategory ? `${topCategory.label}: ${safeNumber(topCategory.count).toLocaleString('es-AR')}` : null,
    topSeverity ? `${topSeverity.label}: ${safeNumber(topSeverity.percentage).toFixed(1)}%` : null,
    topStatus ? `${topStatus.label}: ${safeNumber(topStatus.count).toLocaleString('es-AR')}` : null,
  ].filter(Boolean);
  const focusNarrative = primaryHotspot
    ? `${String(primaryHotspotLabel)} concentra ${safeNumber(primaryHotspot.count).toLocaleString('es-AR')} eventos.`
    : 'Sin hotspot dominante en este periodo.';
  const mapEvidence = {
    source: mode === 'puntos' ? 'geo_points' : heatmap?.contract_version ?? 'heatmap_cells',
    provider,
    contractVersion: heatmap?.contract_version,
    requestId: heatmap?.request_id ?? points?.request_id,
    pointCount: mode === 'puntos' ? visibleCount : 0,
    cellCount: mode === 'heatmap' ? cellCount || visibleCount : 0,
    coveragePct: coverage || undefined,
    withCoordinates: safeNumber(metadataTotals.geocoded) || undefined,
    withoutCoordinates: missingGeo || undefined,
    label: coverage ? `Geo ${geoCoverageTone}` : undefined,
  };
  const mapProvenanceLabel =
    mode === 'puntos'
      ? 'puntos georreferenciados'
      : heatmap?.contract_version
        ? `contrato ${heatmap.contract_version}`
        : 'celdas agregadas';
  const legendRangeLabel = maxVisibleWeight
    ? `0 - ${formatLegendWeight(maxVisibleWeight)} peso`
    : 'sin escala visible';

  const formatPercent = (value: number) => `${value.toFixed(2)}%`;

  const renderMetadataList = (title: string, items: HeatmapMetadataItem[] | undefined) => {
    if (!items || items.length === 0) return null;
    return (
      <div className="space-y-2 rounded-md border border-border/60 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        <ul className="space-y-1 text-xs">
          {items.slice(0, 5).map((item) => (
            <li key={item.label} className="flex items-center justify-between gap-2">
              <span className="truncate text-foreground">{item.label}</span>
              <span className="flex items-center gap-2 font-mono text-muted-foreground">
                <span>{safeNumber(item.count).toLocaleString('es-AR')}</span>
                <span>{formatPercent(safeNumber(item.percentage))}</span>
              </span>
            </li>
            ))}
        </ul>
      </div>
    );
  };

  const handleBbox = (bbox: [number, number, number, number] | null) => {
    setLastBbox(bbox);
    onBoundingBoxChange?.(bbox);
  };

  return (
    <WidgetFrame
      title={title}
      description={description}
      csvData={csv}
      exportFilename={exportName}
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col items-start gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Motor de mapa
            </span>
            <span className="text-[10px] text-muted-foreground">MapLibre GL (WebGL)</span>
            <MapProviderToggle
              value={provider}
              onChange={setProvider}
              size="sm"
              googleAvailable={googleProviderAvailable}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={mode === 'heatmap' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('heatmap')}
            >
              Calor
            </Button>
            <Button
              variant={mode === 'puntos' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('puntos')}
            >
              Puntos
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        {providerWarning ? (
          <Alert variant="default" className="border-dashed border-border/70 bg-muted/50 text-sm">
            <AlertTitle>Mapa con proveedor alternativo</AlertTitle>
            <AlertDescription>{providerWarning}</AlertDescription>
          </Alert>
        ) : null}
        <div
          className="grid gap-3 overflow-hidden rounded-lg border border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.22),transparent_28%),linear-gradient(135deg,#07111f,#101827_52%,#171717)] p-3 text-slate-100 shadow-sm md:grid-cols-4"
          data-testid="analytics-map-command-strip"
        >
          <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Señal visible</p>
            <p className="mt-2 text-xl font-semibold text-white">{formatCompactNumber(visibleCount)}</p>
            <p className="text-[11px] text-slate-400">
              {mode === 'heatmap' ? `${cellCount} celdas de calor` : `${pointCount} puntos reales`}
            </p>
          </div>
          <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Cobertura geo</p>
            <p className="mt-2 text-xl font-semibold text-white">{coverage ? formatPercent(coverage) : 'Sin datos'}</p>
            <p className="text-[11px] text-slate-400">
              {safeNumber(metadataTotals.geocoded).toLocaleString('es-AR')} geocodificados
            </p>
          </div>
          <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Intensidad</p>
            <p className="mt-2 text-xl font-semibold text-white">
              {totalWeight ? totalWeight.toFixed(1) : averageWeight.toFixed(1)}
            </p>
            <p className="text-[11px] text-slate-400">peso territorial ponderado</p>
          </div>
          <div className="rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-100/80">Hotspot principal</p>
            <p className="mt-2 truncate text-lg font-semibold text-white">{String(primaryHotspotLabel)}</p>
            <p className="text-[11px] text-cyan-100/70">
              {primaryHotspot ? `${safeNumber(primaryHotspot.count).toLocaleString('es-AR')} eventos` : 'esperando actividad'}
            </p>
          </div>
        </div>
        <div
          className="grid gap-3 rounded-lg border border-border/70 bg-background/80 p-3 shadow-sm lg:grid-cols-[1.2fr_1fr_1fr]"
          data-testid="analytics-map-intelligence-strip"
        >
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Lectura ejecutiva</p>
              <Badge variant="outline" className="bg-background/70">Radar territorial</Badge>
            </div>
            <p className="mt-2 text-sm font-medium text-foreground">{focusNarrative}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {totalTickets ? `${totalTickets.toLocaleString('es-AR')} casos evaluados` : 'Sin total operativo informado'}
              {missingGeo ? ` · ${missingGeo.toLocaleString('es-AR')} sin ubicacion confiable` : ''}
            </p>
          </div>
          <div className={`rounded-md border p-3 ${geoCoverageClass}`}>
            <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">Confianza geografica</p>
            <p className="mt-2 text-xl font-semibold">{geoCoverageTone}</p>
            <p className="text-xs opacity-80">{coverage ? `${formatPercent(coverage)} de cobertura` : 'Todavia no hay coordenadas suficientes'}</p>
          </div>
          <div className="rounded-md border bg-background p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">SLA operativo</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Respuesta p90</p>
                <p className="font-mono text-base font-semibold">{responseP90 ? responseP90.toFixed(0) : '—'} min</p>
              </div>
              <div>
                <p className="text-muted-foreground">Resolucion p90</p>
                <p className="font-mono text-base font-semibold">{resolutionP90 ? resolutionP90.toFixed(0) : '—'} min</p>
              </div>
            </div>
          </div>
          {actionSignals.length ? (
            <div className="rounded-md border bg-background p-3 lg:col-span-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Señales para priorizar</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {actionSignals.map((signal) => (
                  <Badge key={String(signal)} variant="secondary" className="max-w-full truncate">
                    {signal}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        {loading ? (
          <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
            Cargando mapa...
          </div>
        ) : !hasDataset ? (
          <AnalyticsEmptyState message="No hay puntos georreferenciados para este periodo." className="h-80" />
        ) : (
          <div className="relative overflow-hidden rounded-md border border-border/70">
            <MapLibreMap
              className="h-80 w-full"
              heatmapData={dataset}
              showHeatmap={mode === 'heatmap'}
              onBoundingBoxChange={handleBbox}
              provider={provider}
              onProviderUnavailable={handleProviderUnavailable}
              evidence={mapEvidence}
            />
            <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div
                className="max-w-[18rem] rounded-md border border-white/15 bg-slate-950/82 px-3 py-2 text-xs text-white shadow-lg backdrop-blur"
                data-testid="analytics-map-provenance"
              >
                <p className="font-semibold">Radar territorial</p>
                <p className="text-white/70">{mode === 'heatmap' ? 'Intensidad por zona' : 'Puntos reales'}</p>
                <p className="mt-1 text-[11px] text-white/55">{mapProvenanceLabel}</p>
              </div>
              <div
                className="w-full max-w-[18rem] rounded-md border border-white/15 bg-slate-950/82 px-3 py-2 text-xs text-white shadow-lg backdrop-blur sm:w-64"
                data-testid="analytics-map-visual-legend"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">Intensidad</p>
                  <span className="text-[11px] text-white/60">{legendRangeLabel}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-[linear-gradient(90deg,#22d3ee_0%,#facc15_52%,#fb7185_100%)]" />
                <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wide text-white/55">
                  <span>Baja</span>
                  <span>Alta</span>
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>Hotspots:</span>
          {hotspots.slice(0, 5).map((hotspot) => (
            <Badge key={hotspot.cellId} variant="secondary" className="gap-1">
              {hotspot.cellId}
              <span className="font-semibold">{safeNumber(hotspot.count)}</span>
              <span className="text-[11px] text-muted-foreground">{safeNumber(hotspot.weight).toFixed(2)}</span>
            </Badge>
          ))}
          {hotspots.length === 0 ? <span>Sin datos destacados</span> : null}
          {lastBbox ? (
            <Button variant="link" className="ml-auto h-6 px-0" onClick={() => handleBbox(null)}>
              Limpiar selección
            </Button>
          ) : null}
        </div>
        {metadata ? (
          <div className="space-y-3 rounded-md border border-dashed border-border/70 p-3">
            <div className="grid gap-3 text-xs sm:grid-cols-3">
              <div className="rounded-md bg-muted/40 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Tickets geocodificados</p>
                <p className="text-lg font-semibold text-foreground">
                  {safeNumber(metadataTotals.geocoded).toLocaleString('es-AR')}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Faltantes: {safeNumber(metadataTotals.missing).toLocaleString('es-AR')}
                </p>
              </div>
              <div className="rounded-md bg-muted/40 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Cobertura de ubicación</p>
                <p className="text-lg font-semibold text-foreground">
                  {formatPercent(safeNumber(metadataTotals.coverage))}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Total considerado: {safeNumber(metadataTotals.tickets).toLocaleString('es-AR')}
                </p>
              </div>
              <div className="rounded-md bg-muted/40 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Intensidad promedio</p>
                <p className="text-lg font-semibold text-foreground">
                  {safeNumber(metadataIntensity.averageWeight).toFixed(2)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Peso total: {safeNumber(metadataIntensity.totalWeight).toFixed(2)}
                </p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {renderMetadataList('Categorías principales', safeMetadataItems(metadata.categories))}
              {renderMetadataList('Severidad', safeMetadataItems(metadata.severity))}
              {renderMetadataList('Estado', safeMetadataItems(metadata.status))}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {renderMetadataList('Recencia', safeMetadataItems(metadata.recency))}
              <div className="space-y-2 rounded-md border border-border/60 p-3 text-xs">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  SLA por minutos
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[11px] text-muted-foreground">1ª respuesta</p>
                    <p className="font-mono text-sm text-foreground">
                      {safeNumber(responseMinutes.average).toFixed(2)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      p90 {safeNumber(responseMinutes.p90).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Resolución</p>
                    <p className="font-mono text-sm text-foreground">
                      {safeNumber(resolutionMinutes.average).toFixed(2)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      p90 {safeNumber(resolutionMinutes.p90).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </WidgetFrame>
  );
}
