import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import MapLibreMap from '@/components/MapLibreMap';
import {
  HeatPoint,
  HeatmapBreakdownItem,
  HeatmapMapMetadata,
  MapConfig,
  MapLayerSource,
} from '@/services/statsService';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useMapProvider } from '@/hooks/useMapProvider';
import type { MapProvider, MapProviderUnavailableReason } from '@/hooks/useMapProvider';
import { MapProviderToggle } from '@/components/MapProviderToggle';

interface HeatmapProps {
  initialHeatmapData: HeatPoint[];
  adminLocation?: [number, number];
  availableCategories: string[];
  availableBarrios: string[];
  availableTipos: string[];
  metadata?: HeatmapMapMetadata | null;
  mapConfig?: MapConfig | null;
  mapLayers?: Record<string, MapLayerSource> | null;
  onSelect?: (lat: number, lon: number, address?: string) => void;
}

export const AnalyticsHeatmap: React.FC<HeatmapProps> = ({
  initialHeatmapData,
  adminLocation,
  availableCategories,
  availableBarrios,
  availableTipos,
  metadata,
  mapConfig,
  mapLayers,
  onSelect,
}) => {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedBarrios, setSelectedBarrios] = useState<string[]>([]);
  const [selectedTipos, setSelectedTipos] = useState<string[]>([]);
  const preferredProvider = useMemo<MapProvider | undefined>(() => {
    const providerCandidate =
      typeof mapConfig?.provider === 'string'
        ? mapConfig.provider
        : mapLayers?.heatmap?.providerHint;
    const normalized = typeof providerCandidate === 'string' ? providerCandidate.trim().toLowerCase() : '';
    if (normalized === 'google') return 'google';
    if (normalized === 'maptiler' || normalized === 'maplibre') return 'maplibre';
    return undefined;
  }, [mapConfig?.provider, mapLayers?.heatmap?.providerHint]);

  const { provider, setProvider } = useMapProvider(preferredProvider ?? 'maplibre', {
    preferred: preferredProvider,
  });

  const maptilerKey = useMemo(() => {
    const key =
      (mapConfig?.maptiler_key as string | undefined) ||
      (mapConfig?.maptilerKey as string | undefined) ||
      (mapConfig?.MAPTILER_API_KEY as string | undefined);
    return typeof key === 'string' && key.trim().length > 0 ? key.trim() : undefined;
  }, [mapConfig]);

  const googleMapsKey = useMemo(() => {
    const key =
      (mapConfig?.google_maps_key as string | undefined) ||
      (mapConfig?.googleMapsKey as string | undefined) ||
      (mapConfig?.google_api_key as string | undefined);
    return typeof key === 'string' && key.trim().length > 0 ? key.trim() : undefined;
  }, [mapConfig]);

  const mapStyleUrl = useMemo(() => {
    const value = mapConfig?.style_url as string | undefined;
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
  }, [mapConfig]);

  const handleProviderUnavailable = useCallback(
    (currentProvider: MapProvider, reason: MapProviderUnavailableReason, details?: unknown) => {
      console.warn('[AnalyticsHeatmap] Map provider unavailable, falling back to MapLibre', {
        provider: currentProvider,
        reason,
        details,
      });
      setProvider('maplibre');
    },
    [setProvider],
  );

  const matchesWithAggregated = useCallback(
    (
      selected: string[],
      directValue: string | undefined | null,
      aggregated?: HeatmapBreakdownItem[] | null,
    ) => {
      if (selected.length === 0) {
        return true;
      }

      if (directValue && selected.includes(directValue)) {
        return true;
      }

      if (Array.isArray(aggregated)) {
        return aggregated.some((item) => item?.label && selected.includes(item.label));
      }

      return false;
    },
    [],
  );

  const heatmapData = useMemo(() => {
    return initialHeatmapData.filter((t) => {
      const matchesTipo = matchesWithAggregated(selectedTipos, t.tipo_ticket, t.aggregatedTipos);
      const matchesCategoria = matchesWithAggregated(
        selectedCategories,
        t.categoria,
        t.aggregatedCategorias,
      );
      const matchesBarrio = matchesWithAggregated(selectedBarrios, t.barrio, t.aggregatedBarrios);

      return matchesTipo && matchesCategoria && matchesBarrio;
    });
  }, [
    initialHeatmapData,
    matchesWithAggregated,
    selectedTipos,
    selectedCategories,
    selectedBarrios,
  ]);

  const disableClustering = useMemo(() => {
    if (heatmapData.length === 0) {
      return false;
    }

    const aggregated = heatmapData.some(
      (point) =>
        (typeof point.clusterSize === 'number' && point.clusterSize > 1) ||
        Boolean(point.clusterId) ||
        (Array.isArray(point.sampleTickets) && point.sampleTickets.length > 0) ||
        (Array.isArray(point.aggregatedCategorias) && point.aggregatedCategorias.length > 0) ||
        (Array.isArray(point.aggregatedEstados) && point.aggregatedEstados.length > 0) ||
        (Array.isArray(point.aggregatedTipos) && point.aggregatedTipos.length > 0) ||
        (Array.isArray(point.aggregatedBarrios) && point.aggregatedBarrios.length > 0) ||
        (Array.isArray(point.aggregatedSeveridades) && point.aggregatedSeveridades.length > 0),
    );

    if (aggregated) {
      return true;
    }

    if (metadata) {
      if (typeof metadata.cellCount === 'number' && metadata.cellCount > 0) {
        return true;
      }
      if (
        typeof metadata.pointCount === 'number' &&
        metadata.pointCount > heatmapData.length &&
        heatmapData.length > 0
      ) {
        return true;
      }
    }

    return false;
  }, [heatmapData, metadata]);

  type InsightItem = { label: string; count: number; weight: number; percentage: number };
  type HeatmapInsights = {
    totalPoints: number;
    totalWeight: number;
    averageWeight: number;
    categories: InsightItem[];
    barrios: InsightItem[];
    tipos: InsightItem[];
    estados: InsightItem[];
    severidades: InsightItem[];
    recency: InsightItem[];
    cellCount?: number | null;
    maxPointWeight?: number;
    maxCellCount?: number | null;
  };

  const insights = useMemo<HeatmapInsights | null>(() => {
    if (heatmapData.length === 0) {
      return null;
    }

    const metadataSummary = metadata ?? null;

    const totalPoints =
      metadataSummary?.pointCount !== undefined
        ? metadataSummary.pointCount
        : heatmapData.length;

    const computedTotalWeight = heatmapData.reduce(
      (sum, point) => sum + (point.weight ?? 1),
      0,
    );
    const totalWeight =
      metadataSummary?.totalWeight !== undefined
        ? metadataSummary.totalWeight
        : Number(computedTotalWeight.toFixed(2));

    const averageWeight =
      totalPoints > 0 ? Number((totalWeight / totalPoints).toFixed(2)) : 0;

    const computedMaxPointWeight = heatmapData.reduce(
      (max, point) => Math.max(max, point.weight ?? 1),
      0,
    );
    const maxPointWeight =
      metadataSummary?.maxPointWeight !== undefined
        ? metadataSummary.maxPointWeight
        : Number(computedMaxPointWeight.toFixed(2));

    const buildBreakdown = (getter: (point: HeatPoint) => string | null | undefined): InsightItem[] => {
      const acc = new Map<string, { count: number; weight: number }>();
      heatmapData.forEach((point) => {
        const label = getter(point);
        if (!label) return;
        const current = acc.get(label) ?? { count: 0, weight: 0 };
        current.count += 1;
        current.weight += point.weight ?? 1;
        acc.set(label, current);
      });
      return Array.from(acc.entries())
        .map(([label, value]) => ({
          label,
          count: value.count,
          weight: Number(value.weight.toFixed(2)),
          percentage: totalWeight > 0 ? Number(((value.weight / totalWeight) * 100).toFixed(2)) : 0,
        }))
        .sort((a, b) => b.weight - a.weight);
    };

    const recencyBuckets = {
      last7d: 0,
      last30d: 0,
      older: 0,
      sinDato: 0,
    };

    heatmapData.forEach((point) => {
      if (!point.last_ticket_at) {
        recencyBuckets.sinDato += 1;
        return;
      }
      const lastAt = new Date(point.last_ticket_at).getTime();
      if (Number.isNaN(lastAt)) {
        recencyBuckets.sinDato += 1;
        return;
      }
      const ageDays = (Date.now() - lastAt) / (1000 * 60 * 60 * 24);
      if (ageDays <= 7) {
        recencyBuckets.last7d += 1;
      } else if (ageDays <= 30) {
        recencyBuckets.last30d += 1;
      } else {
        recencyBuckets.older += 1;
      }
    });

    const recency = Object.entries(recencyBuckets).map(([label, count]) => ({
      label,
      count,
      weight: count,
      percentage: totalPoints > 0 ? Number(((count / totalPoints) * 100).toFixed(2)) : 0,
    }));

    return {
      totalPoints,
      totalWeight: Number(totalWeight.toFixed(2)),
      averageWeight,
      categories: buildBreakdown((point) => point.categoria),
      barrios: buildBreakdown((point) => point.barrio),
      tipos: buildBreakdown((point) => point.tipo_ticket),
      estados: buildBreakdown((point) => point.estado),
      severidades: buildBreakdown((point) => point.severidad),
      recency,
      cellCount: metadataSummary?.cellCount,
      maxPointWeight,
      maxCellCount: metadataSummary?.maxCellCount,
    };
  }, [heatmapData, metadata]);

  const metadataCenter = useMemo(() => {
    if (!metadata?.centroid) return null;
    const [lng, lat] = metadata.centroid;
    if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) {
      return [lng, lat] as [number, number];
    }
    return null;
  }, [metadata]);

  const mapCenter = useMemo(() => {
    if (adminLocation) return adminLocation;
    if (metadataCenter) return metadataCenter;

    if (initialHeatmapData.length > 0) {
      const totalWeight = initialHeatmapData.reduce((sum, t) => sum + (t.weight || 1), 0);
      if (totalWeight > 0) {
        const avgLat = initialHeatmapData.reduce((sum, t) => sum + t.lat * (t.weight || 1), 0) / totalWeight;
        const avgLng = initialHeatmapData.reduce((sum, t) => sum + t.lng * (t.weight || 1), 0) / totalWeight;
        if (Number.isFinite(avgLat) && Number.isFinite(avgLng)) {
            return [avgLng, avgLat] as [number, number];
        }
      }
    }
    return [-64.5, -34.5] as [number, number]; // Default to center of Argentina
  }, [initialHeatmapData, adminLocation, metadataCenter]);

  const metadataBoundsCoordinates = useMemo(() => {
    if (!metadata?.bounds || metadata.bounds.length < 4) {
      return null;
    }
    const [west, south, east, north] = metadata.bounds;
    if (
      typeof west === 'number' &&
      typeof south === 'number' &&
      typeof east === 'number' &&
      typeof north === 'number' &&
      [west, south, east, north].every((value) => Number.isFinite(value))
    ) {
      return [
        [west, south] as [number, number],
        [east, north] as [number, number],
      ];
    }
    return null;
  }, [metadata]);

  const boundsCoordinates = useMemo(() => {
    const coords = heatmapData
      .map((point) => [point.lng, point.lat] as [number, number])
      .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));

    if (
      adminLocation &&
      Number.isFinite(adminLocation[0]) &&
      Number.isFinite(adminLocation[1])
    ) {
      coords.push(adminLocation);
    }

    if (metadataBoundsCoordinates) {
      coords.push(...metadataBoundsCoordinates);
    }

    return coords;
  }, [heatmapData, adminLocation, metadataBoundsCoordinates]);

  const initialZoom = adminLocation || heatmapData.length > 0 ? 12 : 4;

  const renderInsightList = (title: string, items: InsightItem[] | undefined) => {
    if (!items || items.length === 0) return null;
    return (
      <div className="space-y-2 rounded-lg border border-border/60 bg-background/80 p-3 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        <ul className="space-y-1 text-xs">
          {items.slice(0, 5).map((item) => (
            <li key={item.label} className="flex items-center justify-between gap-2">
              <span className="truncate text-foreground">{item.label}</span>
              <span className="flex items-center gap-2 font-mono text-muted-foreground">
                <span>{item.count.toLocaleString('es-AR')}</span>
                <span>{item.percentage.toFixed(2)}%</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const FilterGroup: React.FC<{ title: string; items: string[]; selected: string[]; onSelectedChange: (selected: string[]) => void }> = ({ title, items, selected, onSelectedChange }) => {
    if (items.length === 0) return null;

    return (
      <div>
        <Label className="text-muted-foreground text-sm mb-2 block font-semibold">{title}</Label>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {items.map((item) => (
            <label key={item} className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
              <Checkbox
                checked={selected.includes(item)}
                onCheckedChange={(checked) => {
                  const isChecked = checked === true;
                  onSelectedChange(
                    isChecked
                      ? [...selected, item]
                      : selected.filter((i) => i !== item)
                  );
                }}
              />
              {item}
            </label>
          ))}
        </div>
      </div>
    );
  };

  const summaryCards = useMemo(() => {
    if (!insights) return [] as { key: string; label: string; value: string }[];

    const last7d = insights.recency.find((item) => item.label === 'last7d');
    const cards: ({ key: string; label: string; value: string })[] = [
      {
        key: 'points',
        label: 'Puntos geolocalizados',
        value: insights.totalPoints.toLocaleString('es-AR'),
      },
      insights.cellCount !== undefined && insights.cellCount !== null
        ? {
            key: 'cells',
            label: 'Celdas agregadas',
            value: insights.cellCount.toLocaleString('es-AR'),
          }
        : null,
      {
        key: 'total-weight',
        label: 'Intensidad acumulada',
        value: insights.totalWeight.toLocaleString('es-AR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }),
      },
      {
        key: 'average',
        label: 'Promedio por punto',
        value: insights.averageWeight.toFixed(2),
      },
      {
        key: 'max-point',
        label: 'Máx. intensidad por punto',
        value: (insights.maxPointWeight ?? 0).toLocaleString('es-AR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }),
      },
      {
        key: 'recency',
        label: 'Recencia (≤7d)',
        value: `${last7d?.percentage.toFixed(2) ?? '0.00'}%`,
      },
    ].filter((card): card is { key: string; label: string; value: string } => Boolean(card));

    return cards;
  }, [insights]);

  return (
    <Card className="bg-card shadow-xl rounded-xl border border-border backdrop-blur-sm">
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <CardTitle className="text-xl font-semibold text-primary">
          Ubicación y Mapa de Calor de Actividad
        </CardTitle>
        <div className="flex flex-col items-start gap-1 md:items-end">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Proveedor de mapa
          </span>
          <MapProviderToggle value={provider} onChange={setProvider} size="sm" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border-b border-border">
            <FilterGroup title="Tipos de Ticket" items={availableTipos} selected={selectedTipos} onSelectedChange={setSelectedTipos} />
            <FilterGroup title="Categorías" items={availableCategories} selected={selectedCategories} onSelectedChange={setSelectedCategories} />
            <FilterGroup title="Barrios" items={availableBarrios} selected={selectedBarrios} onSelectedChange={setSelectedBarrios} />
        </div>

        {insights ? (
          <div className="space-y-4 rounded-xl border border-dashed border-border/70 bg-muted/40 p-4">
            <div className="grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-6">
              {summaryCards.map((card) => (
                <div key={card.key} className="rounded-lg bg-background/80 p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{card.label}</p>
                  <p className="text-2xl font-semibold text-foreground">{card.value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {renderInsightList('Categorías', insights.categories)}
              {renderInsightList('Barrios', insights.barrios)}
              {renderInsightList('Tipos de ticket', insights.tipos)}
              {renderInsightList('Estados', insights.estados)}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {renderInsightList('Severidad', insights.severidades)}
              {renderInsightList('Recencia', insights.recency)}
            </div>
          </div>
        ) : null}

        <MapLibreMap
          center={mapCenter}
          initialZoom={initialZoom}
          heatmapData={heatmapData}
          adminLocation={adminLocation}
          onSelect={onSelect}
          className="h-[600px] rounded-lg"
          fitToBounds={boundsCoordinates.length > 0 ? boundsCoordinates : undefined}
          provider={provider}
          mapStyleUrl={mapStyleUrl}
          maptilerKey={maptilerKey}
          googleMapsKey={googleMapsKey}
          onProviderUnavailable={handleProviderUnavailable}
          disableClientClustering={disableClustering}
        />
        {heatmapData.length === 0 && (
          <Alert variant="default" className="border-border/60 border-dashed bg-muted/40">
            <AlertTitle>No hay datos georreferenciados</AlertTitle>
            <AlertDescription>
              El backend no devolvió puntos para el mapa de calor con los filtros actuales. Revisá los filtros o consultá al equipo
              responsable de los datos para confirmar que se estén enviando ubicaciones.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default AnalyticsHeatmap;
