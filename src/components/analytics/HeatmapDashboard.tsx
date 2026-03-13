import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useTenant } from '@/context/TenantContext';
import { analyticsService, type AnalyticsHeatmapResponse } from '@/services/analyticsService';
import { Loader2 } from 'lucide-react';
// Assuming MapLibreMap component exists as per prompt trace
// If not, a placeholder or simple div will be used to avoid breaking
import MapLibreMap from '@/components/MapLibreMap';

interface Props {
  tenantId: number;
  dateRange: { from: string; to: string };
}

const HeatmapDashboard: React.FC<Props> = ({ tenantId, dateRange }) => {
  const { currentSlug } = useTenant();
  const [heatmapResponse, setHeatmapResponse] = useState<AnalyticsHeatmapResponse>({ points: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHeatmap = async () => {
      setLoading(true);
      try {
        const data = await analyticsService.getHeatmap({
          tenant_id: tenantId,
          tenantSlug: currentSlug || undefined,
          from: dateRange.from,
          to: dateRange.to
        });
        setHeatmapResponse(data || { points: [] });
      } catch (e) {
        console.error("Failed to load heatmap", e);
      } finally {
        setLoading(false);
      }
    };
    if (tenantId) loadHeatmap();
  }, [tenantId, dateRange, currentSlug]);


  const points = useMemo(() => (Array.isArray(heatmapResponse?.points) ? heatmapResponse.points : []), [heatmapResponse]);
  const geoCategories = useMemo(() => (Array.isArray(heatmapResponse?.geo_layers?.categories) ? heatmapResponse.geo_layers.categories : []), [heatmapResponse]);
  const tileUrl = useMemo(() => {
    const url = heatmapResponse?.geo_layers?.tiles?.url;
    return typeof url === 'string' && url.trim() ? url.trim() : undefined;
  }, [heatmapResponse]);
  const tileAttribution = useMemo(() => {
    const attribution = heatmapResponse?.geo_layers?.tiles?.attribution;
    return typeof attribution === 'string' && attribution.trim() ? attribution.trim() : undefined;
  }, [heatmapResponse]);
  const mapStyleUrl = useMemo(() => {
    const styleUrl = (heatmapResponse?.geo_layers as Record<string, unknown> | undefined)?.style_url;
    return typeof styleUrl === 'string' && styleUrl.trim() ? styleUrl.trim() : undefined;
  }, [heatmapResponse]);
  const geoLayerSource = useMemo(() => {
    const source = (heatmapResponse?.geo_layers as Record<string, unknown> | undefined)?.source;
    if (!source || typeof source !== 'object') return null;
    const record = source as Record<string, unknown>;
    if (record.type !== 'FeatureCollection' || !Array.isArray(record.features)) return null;
    return source as { type: 'FeatureCollection'; features: unknown[] };
  }, [heatmapResponse]);
  const sourceOptions = useMemo(() => {
    const sourceOptionsCandidate = (heatmapResponse?.geo_layers as Record<string, unknown> | undefined)?.source_options;
    return sourceOptionsCandidate && typeof sourceOptionsCandidate === 'object'
      ? (sourceOptionsCandidate as Record<string, unknown>)
      : undefined;
  }, [heatmapResponse]);
  const mapBounds = useMemo(
    () =>
      points
        .map((point) => [Number(point.lng), Number(point.lat)] as [number, number])
        .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat)),
    [points],
  );
  const mapCenter = useMemo(() => {
    if (!points.length) return undefined;
    const totalWeight = points.reduce((sum, point) => sum + (Number(point.weight) || 1), 0);
    const divisor = totalWeight > 0 ? totalWeight : points.length;
    const avgLat = points.reduce((sum, point) => sum + (Number(point.lat) || 0) * (Number(point.weight) || 1), 0) / divisor;
    const avgLng = points.reduce((sum, point) => sum + (Number(point.lng) || 0) * (Number(point.weight) || 1), 0) / divisor;
    if (!Number.isFinite(avgLat) || !Number.isFinite(avgLng)) return undefined;
    return [avgLng, avgLat] as [number, number];
  }, [points]);
  const segmentGroups = useMemo(() => {
    const segments = heatmapResponse?.segments;
    const order: Array<{ key: string; label: string }> = [
      { key: 'categoria', label: 'Categorías' },
      { key: 'sexo', label: 'Sexo' },
      { key: 'rango_edad', label: 'Rango edad' },
      { key: 'barrio', label: 'Barrio' },
      { key: 'distrito', label: 'Distrito' },
      { key: 'canal', label: 'Canal' },
    ];

    return order
      .map(({ key, label }) => ({
        key,
        label,
        items: Array.isArray(segments?.[key]) ? segments[key] : [],
      }))
      .filter((group) => group.items.length > 0);
  }, [heatmapResponse]);
  const appliedFilters = useMemo(() => {
    const filters = heatmapResponse?.segments_filters_applied;
    if (!filters || typeof filters !== 'object') return [];
    return Object.entries(filters)
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`);
  }, [heatmapResponse]);

  if (loading) return <div className="h-[320px] sm:h-[420px] flex items-center justify-center rounded-2xl border border-border/50 bg-background/60"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <Card className="border border-border/60 bg-gradient-to-br from-background via-background to-primary/5 shadow-sm">
      <CardHeader>
        <CardTitle>Mapa de Calor</CardTitle>
        <CardDescription>Distribución geográfica de incidentes y pedidos.</CardDescription>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 space-y-3">
        {(geoCategories.length || segmentGroups.length || appliedFilters.length) ? (
          <div className="space-y-2">
            {geoCategories.length ? (
              <div className="flex flex-wrap gap-2 text-xs">
                {geoCategories.slice(0, 10).map((item, idx) => (
                  <span key={`${item.categoria || 'cat'}-${idx}`} className="inline-flex items-center gap-1 rounded-full border px-2 py-1">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color || '#94a3b8' }} />
                    {item.categoria || '—'} · {item.event_count || item.total_weight || 0}
                  </span>
                ))}
              </div>
            ) : null}
            {segmentGroups.length ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-xs">
                {segmentGroups.map((group) => (
                  <div key={group.key} className="rounded-md border p-2">
                    <p className="mb-1 text-muted-foreground">{group.label}</p>
                    <p>{group.items.slice(0, 3).map((item: any) => `${item.label || '—'} (${item.count || 0})`).join(' · ') || '—'}</p>
                  </div>
                ))}
              </div>
            ) : null}
            {appliedFilters.length ? (
              <div className="rounded-md border p-2 text-xs">
                <p className="mb-1 text-muted-foreground">Filtros aplicados</p>
                <p>{appliedFilters.join(' · ')}</p>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="h-[300px] sm:h-[420px] lg:h-[520px] relative overflow-hidden rounded-xl border">
          {(points.length > 0 || (geoLayerSource?.features?.length ?? 0) > 0) ? (
              <MapLibreMap
                  heatmapData={points as any}
                  center={mapCenter}
                  fitToBounds={mapBounds.length ? mapBounds : undefined}
                  initialZoom={mapBounds.length ? 11 : 4}
                  mapStyleUrl={mapStyleUrl}
                  mapTileUrl={tileUrl}
                  mapTileAttribution={tileAttribution}
                  geoLayerConfig={{
                    contract_version:
                      typeof (heatmapResponse?.geo_layers as Record<string, unknown> | undefined)?.contract_version === 'string'
                        ? String((heatmapResponse?.geo_layers as Record<string, unknown>).contract_version)
                        : undefined,
                    style_url: mapStyleUrl,
                    source: geoLayerSource,
                    source_options: sourceOptions,
                    interactions:
                      ((heatmapResponse?.geo_layers as Record<string, unknown> | undefined)?.interactions as {
                        hover?: boolean;
                        time_slider?: { enabled?: boolean; field?: string };
                      } | undefined) ?? undefined,
                    layers:
                      ((heatmapResponse?.geo_layers as Record<string, unknown> | undefined)?.layers as {
                        heatmap?: { id?: string };
                        clusters?: { id?: string };
                        points?: { id?: string };
                      } | undefined) ?? undefined,
                  }}
              />
          ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                  No hay datos geográficos para este periodo.
              </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default HeatmapDashboard;
