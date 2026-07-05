import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useTenant } from '@/context/TenantContext';
import { analyticsService, type AnalyticsHeatmapPoint, type AnalyticsHeatmapResponse } from '@/services/analyticsService';
import { Loader2 } from 'lucide-react';
// Assuming MapLibreMap component exists as per prompt trace
// If not, a placeholder or simple div will be used to avoid breaking
import MapLibreMap from '@/components/LazyMapLibreMap';

interface Props {
  tenantId: number;
  dateRange: { from: string; to: string };
  filters?: {
    canal?: string;
    categoria?: string;
    distrito?: string;
    genero?: string;
    rango_edad?: string;
    source?: string;
  };
}

const buildOptions = (points: AnalyticsHeatmapPoint[], getter: (point: AnalyticsHeatmapPoint) => unknown) =>
  Array.from(
    new Set(
      points
        .map((point) => {
          const value = getter(point);
          return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
        })
        .filter(Boolean),
    ),
  );

const buildSegmentOptions = (items: unknown) =>
  Array.from(
    new Set(
      (Array.isArray(items) ? items : [])
        .map((item) => {
          if (!item || typeof item !== 'object') return '';
          const record = item as Record<string, unknown>;
          const value = record.key ?? record.value ?? record.label;
          return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
        })
        .filter(Boolean),
    ),
  );

const HeatmapDashboard: React.FC<Props> = ({ tenantId, dateRange, filters }) => {
  const { currentSlug } = useTenant();
  const [heatmapResponse, setHeatmapResponse] = useState<AnalyticsHeatmapResponse>({ points: [] });
  const [loading, setLoading] = useState(true);
  const [layerMode, setLayerMode] = useState<string>('heatmap');
  const [categoryFilter, setCategoryFilter] = useState<string>(filters?.categoria || 'all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>(filters?.canal || 'all');
  const [genderFilter, setGenderFilter] = useState<string>(filters?.genero || 'all');
  const [ageRangeFilter, setAgeRangeFilter] = useState<string>(filters?.rango_edad || 'all');
  const [districtFilter, setDistrictFilter] = useState<string>(filters?.distrito || 'all');
  const [sourceFilter, setSourceFilter] = useState<string>(filters?.source || 'all');

  useEffect(() => {
    setCategoryFilter(filters?.categoria || 'all');
    setChannelFilter(filters?.canal || 'all');
    setGenderFilter(filters?.genero || 'all');
    setAgeRangeFilter(filters?.rango_edad || 'all');
    setDistrictFilter(filters?.distrito || 'all');
    setSourceFilter(filters?.source || 'all');
  }, [filters?.canal, filters?.categoria, filters?.distrito, filters?.genero, filters?.rango_edad, filters?.source]);

  useEffect(() => {
    const loadHeatmap = async () => {
      setLoading(true);
      try {
        const data = await analyticsService.getHeatmap({
          tenant_id: tenantId,
          tenantSlug: currentSlug || undefined,
          from: dateRange.from,
          to: dateRange.to,
          canal: channelFilter === 'all' ? undefined : channelFilter,
          categoria: categoryFilter === 'all' ? undefined : categoryFilter,
          distrito: districtFilter === 'all' ? undefined : districtFilter,
          genero: genderFilter === 'all' ? undefined : genderFilter,
          rango_edad: ageRangeFilter === 'all' ? undefined : ageRangeFilter,
          source: sourceFilter === 'all' ? undefined : sourceFilter,
        });
        setHeatmapResponse(data || { points: [] });
      } catch (e) {
        console.error("Failed to load heatmap", e);
      } finally {
        setLoading(false);
      }
    };
    if (tenantId) loadHeatmap();
  }, [tenantId, dateRange, currentSlug, channelFilter, categoryFilter, districtFilter, genderFilter, ageRangeFilter, sourceFilter]);


  const points = useMemo(() => (Array.isArray(heatmapResponse?.points) ? heatmapResponse.points : []), [heatmapResponse]);
  const segments = useMemo(() => heatmapResponse?.segments || {}, [heatmapResponse]);
  const availableLayers = useMemo(() => {
    const layers = heatmapResponse?.geo_layers?.layers;
    if (!layers || typeof layers !== 'object') return [] as string[];
    return Object.entries(layers)
      .filter(([, config]) => Boolean(config && typeof config === 'object'))
      .map(([key]) => key);
  }, [heatmapResponse]);
  const categoryOptions = useMemo(() => Array.from(new Set([
    ...buildSegmentOptions((segments as any).categoria || (segments as any).category || (segments as any).categories),
    ...buildOptions(points, (point) => point.categoria),
  ])), [points, segments]);
  const severityOptions = useMemo(() => buildOptions(points, (point) => point.severidad), [points]);
  const stateOptions = useMemo(() => buildOptions(points, (point) => point.estado), [points]);
  const channelOptions = useMemo(() => Array.from(new Set([
    ...buildSegmentOptions((segments as any).canal || (segments as any).channel),
    ...buildOptions(points, (point) => point.canal),
  ])), [points, segments]);
  const genderOptions = useMemo(() => Array.from(new Set([
    ...buildSegmentOptions((segments as any).genero || (segments as any).gender || (segments as any).sexo),
    ...buildOptions(points, (point) => point.genero || point.sexo),
  ])), [points, segments]);
  const ageRangeOptions = useMemo(() => Array.from(new Set([
    ...buildSegmentOptions((segments as any).rango_edad || (segments as any).age_range || (segments as any).age_ranges),
    ...buildOptions(points, (point) => point.rango_edad),
  ])), [points, segments]);
  const districtOptions = useMemo(() => buildOptions(points, (point) => point.distrito), [points]);
  const sourceFilterOptions = useMemo(() => Array.from(new Set([
    ...buildSegmentOptions((segments as any).source || (segments as any).fuente),
    ...buildOptions(points, (point) => point.source || point.fuente),
  ])), [points, segments]);
  const filteredPoints = useMemo(
    () =>
      points.filter((point) => {
        const categoryMatch = categoryFilter === 'all' || point.categoria === categoryFilter;
        const severityMatch = severityFilter === 'all' || point.severidad === severityFilter;
        const stateMatch = stateFilter === 'all' || point.estado === stateFilter;
        const channelMatch = channelFilter === 'all' || point.canal === channelFilter;
        const pointGender = point.genero || point.sexo;
        const genderMatch = genderFilter === 'all' || pointGender === genderFilter;
        const ageMatch = ageRangeFilter === 'all' || point.rango_edad === ageRangeFilter;
        const districtMatch = districtFilter === 'all' || point.distrito === districtFilter;
        const pointSource = point.source || point.fuente;
        const sourceMatch = sourceFilter === 'all' || pointSource === sourceFilter;
        return categoryMatch && severityMatch && stateMatch && channelMatch && genderMatch && ageMatch && districtMatch && sourceMatch;
      }),
    [points, categoryFilter, severityFilter, stateFilter, channelFilter, genderFilter, ageRangeFilter, districtFilter, sourceFilter],
  );
  const geoCategories = useMemo(
    () =>
      Array.isArray(heatmapResponse?.category_layers)
        ? heatmapResponse.category_layers
        : Array.isArray(heatmapResponse?.geo_layers?.categories)
          ? heatmapResponse.geo_layers.categories
          : [],
    [heatmapResponse],
  );
  const cells = useMemo(() => (Array.isArray(heatmapResponse?.cells) ? heatmapResponse.cells : []), [heatmapResponse]);
  const hotspots = useMemo(() => (Array.isArray(heatmapResponse?.hotspots) ? heatmapResponse.hotspots : []), [heatmapResponse]);
  const locationQuality = useMemo(() => heatmapResponse?.location_quality, [heatmapResponse]);
  const geocodingCandidates = useMemo(
    () => (Array.isArray(heatmapResponse?.geocoding?.candidates) ? heatmapResponse.geocoding.candidates : []),
    [heatmapResponse],
  );
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
      filteredPoints
        .map((point) => [Number(point.lng), Number(point.lat)] as [number, number])
        .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat)),
    [filteredPoints],
  );
  const mapCenter = useMemo(() => {
    if (!filteredPoints.length) return undefined;
    const totalWeight = filteredPoints.reduce((sum, point) => sum + (Number(point.weight) || 1), 0);
    const divisor = totalWeight > 0 ? totalWeight : filteredPoints.length;
    const avgLat = filteredPoints.reduce((sum, point) => sum + (Number(point.lat) || 0) * (Number(point.weight) || 1), 0) / divisor;
    const avgLng = filteredPoints.reduce((sum, point) => sum + (Number(point.lng) || 0) * (Number(point.weight) || 1), 0) / divisor;
    if (!Number.isFinite(avgLat) || !Number.isFinite(avgLng)) return undefined;
    return [avgLng, avgLat] as [number, number];
  }, [filteredPoints]);
  const legend = useMemo(() => heatmapResponse?.geo_layers?.legend, [heatmapResponse]);
  const uiLabels = useMemo(() => heatmapResponse?.ui?.labels || {}, [heatmapResponse]);
  const layerLabels = useMemo(() => heatmapResponse?.ui?.layer_labels || {}, [heatmapResponse]);
  const normalizedLayerMode = String(layerMode || '').toLowerCase();
  const showHeatLayer = normalizedLayerMode === 'heatmap' || normalizedLayerMode === 'heat';

  useEffect(() => {
    if (!availableLayers.length) return;
    if (availableLayers.includes(layerMode)) return;
    setLayerMode(availableLayers[0]);
  }, [availableLayers, layerMode]);
  const segmentGroups = useMemo(() => {
    const order: Array<{ key: string; label: string }> = [
      { key: 'categoria', label: 'Categorías' },
      { key: 'category', label: 'Categorías' },
      { key: 'sexo', label: 'Sexo' },
      { key: 'genero', label: 'Género' },
      { key: 'gender', label: 'Género' },
      { key: 'rango_edad', label: 'Rango edad' },
      { key: 'age_range', label: 'Rango edad' },
      { key: 'barrio', label: 'Barrio' },
      { key: 'distrito', label: 'Distrito' },
      { key: 'canal', label: 'Canal' },
      { key: 'source', label: 'Fuente' },
    ];

    return order
      .map(({ key, label }) => ({
        key,
        label,
        items: Array.isArray(segments?.[key]) ? segments[key] : [],
      }))
      .filter((group) => group.items.length > 0);
  }, [segments]);
  const appliedFilters = useMemo(() => {
    const filters = heatmapResponse?.segments_filters_applied || heatmapResponse?.filters_applied || heatmapResponse?.applied_filters;
    if (!filters || typeof filters !== 'object') return [];
    return Object.entries(filters)
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`);
  }, [heatmapResponse]);
  const heatmapEvidence = useMemo(() => {
    const geoLayers = heatmapResponse?.geo_layers as Record<string, unknown> | undefined;
    const provider = typeof geoLayers?.provider === 'string' ? geoLayers.provider : 'analytics_heatmap';
    const contractVersion =
      typeof heatmapResponse?.contract_version === 'string'
        ? heatmapResponse.contract_version
        : typeof geoLayers?.contract_version === 'string'
          ? geoLayers.contract_version
          : undefined;
    return {
      metadata: heatmapResponse?.metadata,
      locationQuality,
      source: provider,
      provider,
      requestId: heatmapResponse?.request_id,
      contractVersion,
      pointCount: filteredPoints.length,
      cellCount: cells.length,
      featureCount: geoLayerSource?.features?.length ?? 0,
      coveragePct: locationQuality?.coverage_pct,
      withCoordinates: locationQuality?.with_coordinates,
      withoutCoordinates: locationQuality?.without_coordinates,
    };
  }, [
    cells.length,
    filteredPoints.length,
    geoLayerSource?.features?.length,
    heatmapResponse?.contract_version,
    heatmapResponse?.geo_layers,
    heatmapResponse?.metadata,
    heatmapResponse?.request_id,
    locationQuality,
  ]);

  if (loading) return <div className="h-[320px] sm:h-[420px] flex items-center justify-center rounded-2xl border border-border/50 bg-background/60"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <Card className="border border-border/60 bg-gradient-to-br from-background via-background to-primary/5 shadow-sm">
      <CardHeader>
        <CardTitle>{uiLabels.title || 'Mapa de Calor'}</CardTitle>
        <CardDescription>{uiLabels.description || 'Distribución geográfica de incidentes y pedidos.'}</CardDescription>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 space-y-3">
        {(geoCategories.length || segmentGroups.length || appliedFilters.length) ? (
          <div className="space-y-2">
            {(availableLayers.length || categoryOptions.length || severityOptions.length || stateOptions.length || channelOptions.length || genderOptions.length || ageRangeOptions.length || districtOptions.length || sourceFilterOptions.length) ? (
              <div className="rounded-md border p-2 text-xs space-y-2">
                {availableLayers.length ? (
                  <div className="space-y-1">
                    <p className="text-muted-foreground">{uiLabels.layers || 'capas'}</p>
                    <div className="flex flex-wrap gap-1">
                      {availableLayers.map((layer) => (
                        <button
                          key={layer}
                          type="button"
                          onClick={() => setLayerMode(layer)}
                          className={`rounded px-2 py-1 border ${layerMode === layer ? 'bg-primary text-primary-foreground' : ''}`}
                        >
                          {layerLabels[layer] || layer}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {categoryOptions.length ? (
                    <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded border px-2 py-1 bg-background">
                      <option value="all">{uiLabels.filter_all || uiLabels.filter_categoria || 'categoria'}</option>
                      {categoryOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  ) : null}
                  {severityOptions.length ? (
                    <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)} className="rounded border px-2 py-1 bg-background">
                      <option value="all">{uiLabels.filter_all || uiLabels.filter_severidad || 'severidad'}</option>
                      {severityOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  ) : null}
                  {stateOptions.length ? (
                    <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)} className="rounded border px-2 py-1 bg-background">
                      <option value="all">{uiLabels.filter_all || uiLabels.filter_estado || 'estado'}</option>
                      {stateOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  ) : null}
                  {channelOptions.length ? (
                    <select value={channelFilter} onChange={(event) => setChannelFilter(event.target.value)} className="rounded border px-2 py-1 bg-background">
                      <option value="all">{uiLabels.filter_all || uiLabels.filter_canal || 'canal'}</option>
                      {channelOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  ) : null}
                  {genderOptions.length ? (
                    <select value={genderFilter} onChange={(event) => setGenderFilter(event.target.value)} className="rounded border px-2 py-1 bg-background">
                      <option value="all">{uiLabels.filter_all || uiLabels.filter_genero || 'genero'}</option>
                      {genderOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  ) : null}
                  {ageRangeOptions.length ? (
                    <select value={ageRangeFilter} onChange={(event) => setAgeRangeFilter(event.target.value)} className="rounded border px-2 py-1 bg-background">
                      <option value="all">{uiLabels.filter_all || uiLabels.filter_rango_edad || 'rango_edad'}</option>
                      {ageRangeOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  ) : null}
                  {districtOptions.length ? (
                    <select value={districtFilter} onChange={(event) => setDistrictFilter(event.target.value)} className="rounded border px-2 py-1 bg-background">
                      <option value="all">{uiLabels.filter_all || uiLabels.filter_distrito || 'distrito'}</option>
                      {districtOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  ) : null}
                  {sourceFilterOptions.length ? (
                    <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} className="rounded border px-2 py-1 bg-background">
                      <option value="all">{uiLabels.filter_all || uiLabels.filter_source || 'source'}</option>
                      {sourceFilterOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  ) : null}
                </div>
              </div>
            ) : null}
            {geoCategories.length ? (
              <div className="flex flex-wrap gap-2 text-xs">
                {geoCategories.slice(0, 10).map((item, idx) => (
                  <span key={`${item.categoria || 'cat'}-${idx}`} className="inline-flex items-center gap-1 rounded-full border px-2 py-1">
                    {item.color ? <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} /> : null}
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
                <p className="mb-1 text-muted-foreground">{uiLabels.applied_filters || 'Filtros aplicados'}</p>
                <p>{appliedFilters.join(' · ')}</p>
              </div>
            ) : null}
            {locationQuality ? (
              <div className="grid gap-2 sm:grid-cols-3 text-xs">
                {typeof locationQuality.with_coordinates !== 'undefined' ? (
                  <div className="rounded-md border p-2">
                    <p className="text-muted-foreground">Con coordenadas</p>
                    <p className="font-medium">{String(locationQuality.with_coordinates)}</p>
                  </div>
                ) : null}
                {typeof locationQuality.without_coordinates !== 'undefined' ? (
                  <div className="rounded-md border p-2">
                    <p className="text-muted-foreground">Sin coordenadas</p>
                    <p className="font-medium">{String(locationQuality.without_coordinates)}</p>
                  </div>
                ) : null}
                {typeof locationQuality.coverage_pct !== 'undefined' ? (
                  <div className="rounded-md border p-2">
                    <p className="text-muted-foreground">Cobertura</p>
                    <p className="font-medium">{String(locationQuality.coverage_pct)}%</p>
                  </div>
                ) : null}
              </div>
            ) : null}
            {(cells.length || hotspots.length) ? (
              <div className="grid gap-2 sm:grid-cols-2 text-xs">
                {hotspots.length ? (
                  <div className="rounded-md border p-2">
                    <p className="mb-1 text-muted-foreground">Hotspots</p>
                    <p>{hotspots.slice(0, 4).map((item: any) => `${item.label || item.key || item.id || '-'} (${item.count ?? item.weight ?? 0})`).join(' | ')}</p>
                  </div>
                ) : null}
                {cells.length ? (
                  <div className="rounded-md border p-2">
                    <p className="mb-1 text-muted-foreground">Celdas</p>
                    <p>{cells.slice(0, 4).map((item: any) => `${item.label || item.key || item.id || '-'} (${item.count ?? item.weight ?? 0})`).join(' | ')}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
            {geocodingCandidates.length ? (
              <div className="rounded-md border border-amber-300/60 bg-amber-50 p-2 text-xs text-amber-950 dark:bg-amber-950/20 dark:text-amber-100">
                <p className="mb-1 font-medium">{uiLabels.geocoding_queue || 'Pendiente geocodificar'}</p>
                <div className="space-y-1">
                  {geocodingCandidates.slice(0, 5).map((item, index) => (
                    <p key={String(item.ticket_id || item.id || index)}>
                      {item.ticket_id || item.id ? `#${item.ticket_id || item.id} ` : ''}
                      {item.address || item.direccion || item.label || '-'}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
            {legend ? (
              <div className="rounded-md border p-2 text-xs">
                <p className="text-muted-foreground">
                  {uiLabels.legend || legend.mode || 'Leyenda'} · {legend.min_weight ?? 0} - {legend.max_weight ?? 0}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="h-[300px] sm:h-[420px] lg:h-[520px] relative overflow-hidden rounded-xl border">
          {(filteredPoints.length > 0 || (geoLayerSource?.features?.length ?? 0) > 0) ? (
              <MapLibreMap
                  heatmapData={filteredPoints as any}
                  showHeatmap={showHeatLayer}
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
                    telemetry:
                      ((heatmapResponse?.geo_layers as Record<string, unknown> | undefined)?.telemetry as {
                        event_endpoint?: string;
                        events?: string[];
                      } | undefined) ?? undefined,
                  }}
                  evidence={heatmapEvidence}
              />
          ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                  {uiLabels.empty || 'No hay datos geográficos para este periodo.'}
              </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default HeatmapDashboard;
