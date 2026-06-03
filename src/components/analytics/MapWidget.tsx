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

const safeMetadataItems = (items: unknown): HeatmapMetadataItem[] =>
  Array.isArray(items) ? (items as HeatmapMetadataItem[]) : [];

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
    const base = (heatmap.cells ?? []).map((cell) => ({
      id: cell.cellId,
      lat: cell.centroid_lat,
      lng: cell.centroid_lon,
      weight: cell.weight ?? cell.count,
      categoria: Object.keys(cell.breakdown ?? {})[0] ?? 'general',
      estado: 'aggregated',
    }));
    if (mode === 'puntos' && points?.points?.length) {
      return points.points.map((point) => ({
        id: point.cellId,
        lat: point.lat,
        lng: point.lon,
        weight: 1,
        categoria: point.categoria,
        estado: point.estado,
      }));
    }
    return base;
  }, [heatmap, points, mode]);

  const csv = useMemo(() => {
    if (!heatmap) return [];
    return (heatmap.cells ?? []).map((cell) => ({
      cell: cell.cellId,
      total: cell.count,
      weight: cell.weight,
      lat: cell.centroid_lat,
      lon: cell.centroid_lon,
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
        {loading ? (
          <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
            Cargando mapa...
          </div>
        ) : !hasDataset ? (
          <AnalyticsEmptyState message="No hay puntos georreferenciados para este periodo." className="h-80" />
        ) : (
          <MapLibreMap
            className="h-80 w-full rounded-md"
            heatmapData={dataset}
            showHeatmap={mode === 'heatmap'}
            onBoundingBoxChange={handleBbox}
            provider={provider}
            onProviderUnavailable={handleProviderUnavailable}
          />
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
