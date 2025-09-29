import { useMemo, useState } from 'react';
import MapLibreMap from '@/components/MapLibreMap';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { HeatmapResponse, PointsResponse } from '@/services/analyticsService';
import { WidgetFrame } from './WidgetFrame';

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

  const dataset = useMemo(() => {
    if (!heatmap) return [];
    const base = heatmap.cells.map((cell) => ({
      id: cell.cellId,
      lat: cell.centroid_lat,
      lng: cell.centroid_lon,
      weight: cell.count,
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
    return heatmap.cells.map((cell) => ({
      cell: cell.cellId,
      total: cell.count,
      lat: cell.centroid_lat,
      lon: cell.centroid_lon,
      ...cell.breakdown,
    }));
  }, [heatmap]);

  const hotspots = heatmap?.hotspots ?? [];

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
      }
    >
      <div className="space-y-3">
        {loading ? (
          <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
            Cargando mapa...
          </div>
        ) : (
          <MapLibreMap
            className="h-80 w-full rounded-md"
            heatmapData={dataset}
            showHeatmap={mode === 'heatmap'}
            onBoundingBoxChange={handleBbox}
          />
        )}
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>Hotspots:</span>
          {hotspots.slice(0, 5).map((hotspot) => (
            <Badge key={hotspot.cellId} variant="secondary" className="gap-1">
              {hotspot.cellId}
              <span className="font-semibold">{hotspot.count}</span>
            </Badge>
          ))}
          {hotspots.length === 0 ? <span>Sin datos destacados</span> : null}
          {lastBbox ? (
            <Button variant="link" className="ml-auto h-6 px-0" onClick={() => handleBbox(null)}>
              Limpiar selección
            </Button>
          ) : null}
        </div>
      </div>
    </WidgetFrame>
  );
}
