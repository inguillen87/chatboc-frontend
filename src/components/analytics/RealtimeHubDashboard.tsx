import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import type { RealtimeHubResponse } from '@/services/analyticsService';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import MapLibreMap from '@/components/MapLibreMap';
import { MeasuredContainer } from '@/components/analytics/MeasuredContainer';

interface Props {
  data: RealtimeHubResponse | null;
  loading?: boolean;
}

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const isFeatureCollection = (value: unknown): value is { type: 'FeatureCollection'; features: unknown[] } => {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return record.type === 'FeatureCollection' && Array.isArray(record.features);
};

const RealtimeHubDashboard: React.FC<Props> = ({ data, loading }) => {
  const [selectedChannel, setSelectedChannel] = React.useState<string>('all');
  const [selectedSentiment, setSelectedSentiment] = React.useState<string>('all');
  const [search, setSearch] = React.useState('');

  React.useEffect(() => {
    try {
      const raw = safeLocalStorage.getItem('analytics_realtime_hub_filters');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.channel === 'string') setSelectedChannel(parsed.channel);
      if (typeof parsed?.sentiment === 'string') setSelectedSentiment(parsed.sentiment);
      if (typeof parsed?.search === 'string') setSearch(parsed.search);
    } catch {
      // no-op
    }
  }, []);

  React.useEffect(() => {
    safeLocalStorage.setItem('analytics_realtime_hub_filters', JSON.stringify({
      channel: selectedChannel,
      sentiment: selectedSentiment,
      search,
    }));
  }, [search, selectedChannel, selectedSentiment]);

  const totals = data?.totals || {};
  const labels = data?.ui?.labels || {};
  const topChannels = Array.isArray(data?.top_channels) ? data!.top_channels! : [];
  const topEvents = Array.isArray(data?.top_events) ? data!.top_events! : [];
  const recommendations = Array.isArray(data?.recommendations) ? data!.recommendations! : [];
  const comments = Array.isArray(data?.comments) ? data!.comments! : [];
  const hotspots = Array.isArray(data?.hotspots) ? data!.hotspots! : [];
  const geoPoints = Array.isArray(data?.geo_points) ? data!.geo_points! : [];
  const geoCategories = Array.isArray(data?.geo_layers?.categories) ? data!.geo_layers!.categories! : [];
  const segments = data?.segments && typeof data.segments === 'object' ? data.segments : {};
  const sentiment = data?.sentiment || {};
  const channels = Array.from(new Set(comments.map((item) => item.channel).filter(Boolean))) as string[];
  const sentiments = Array.from(new Set(comments.map((item) => item.sentiment).filter(Boolean))) as string[];
  const filteredComments = comments.filter((item) => {
    if (selectedChannel !== 'all' && item.channel !== selectedChannel) return false;
    if (selectedSentiment !== 'all' && item.sentiment !== selectedSentiment) return false;
    if (search.trim() && !String(item.text || '').toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });
  const mapPoints = React.useMemo(
    () =>
      geoPoints
        .map((point) => {
          const lat = toFiniteNumber(point.lat);
          const lng = toFiniteNumber(point.lng);
          if (lat === null || lng === null) return null;
          return {
            lat,
            lng,
            weight: toFiniteNumber(point.count) ?? 1,
            canal: point.channel,
          };
        })
        .filter((point): point is { lat: number; lng: number; weight: number; canal?: string } => Boolean(point)),
    [geoPoints],
  );
  const geoLayerSource = React.useMemo(
    () => (isFeatureCollection(data?.geo_layers?.source) ? data?.geo_layers?.source : null),
    [data?.geo_layers?.source],
  );
  const mapBounds = React.useMemo(
    () =>
      mapPoints
        .map((point) => [point.lng, point.lat] as [number, number])
        .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat)),
    [mapPoints],
  );
  const mapCenter = React.useMemo(() => {
    if (!mapPoints.length) return undefined;
    const totalWeight = mapPoints.reduce((sum, point) => sum + (point.weight || 1), 0);
    const divisor = totalWeight > 0 ? totalWeight : mapPoints.length;
    const avgLat = mapPoints.reduce((sum, point) => sum + point.lat * (point.weight || 1), 0) / divisor;
    const avgLng = mapPoints.reduce((sum, point) => sum + point.lng * (point.weight || 1), 0) / divisor;
    if (!Number.isFinite(avgLat) || !Number.isFinite(avgLng)) return undefined;
    return [avgLng, avgLat] as [number, number];
  }, [mapPoints]);
  const segmentGroups = React.useMemo(
    () =>
      ['categoria', 'rango_edad', 'sexo', 'barrio', 'distrito', 'canal']
        .map((key) => ({
          key,
          items: Array.isArray(segments[key]) ? segments[key] : [],
        }))
        .filter((group) => group.items.length > 0),
    [segments],
  );
  const appliedFilters = React.useMemo(() => {
    const filters = data?.segments_filters_applied;
    if (!filters || typeof filters !== 'object') return [];
    return Object.entries(filters)
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`);
  }, [data?.segments_filters_applied]);

  if (loading) {
    return <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">{labels.loading || '…'}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-2 xl:grid-cols-4">
        <Select value={selectedChannel} onValueChange={setSelectedChannel}>
          <SelectTrigger><SelectValue placeholder={labels.filters_channel || ''} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{labels.option_all || '—'}</SelectItem>
            {channels.map((channel) => <SelectItem key={channel} value={channel}>{channel}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={selectedSentiment} onValueChange={setSelectedSentiment}>
          <SelectTrigger><SelectValue placeholder={labels.filters_sentiment || ''} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{labels.option_all || '—'}</SelectItem>
            {sentiments.map((sentimentValue) => <SelectItem key={sentimentValue} value={sentimentValue}>{sentimentValue}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={labels.filters_search || ''} className="md:col-span-2" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardHeader><CardTitle className="text-sm">{labels.cards_events || '—'}</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{totals.events || 0}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">{labels.cards_survey_responses || '—'}</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{totals.survey_responses || 0}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">{labels.cards_survey_comments || '—'}</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{totals.survey_comments || 0}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">{labels.cards_live_chat_comments || '—'}</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{totals.live_chat_comments || 0}</CardContent></Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>{labels.sections_top_channels || '—'}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm min-w-0">
            {topChannels.length ? topChannels.map((item, idx) => (
              <div key={`ch_${idx}`} className="flex items-center justify-between rounded border px-2 py-1">
                <span>{item.channel || '—'}</span>
                <span className="font-medium">{item.count || 0}</span>
              </div>
            )) : <p className="text-muted-foreground">{labels.empty || '—'}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{labels.sections_top_events || '—'}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm min-w-0">
            {topEvents.length ? topEvents.map((item, idx) => (
              <div key={`ev_${idx}`} className="flex items-center justify-between rounded border px-2 py-1">
                <span>{item.event || '—'}</span>
                <span className="font-medium">{item.count || 0}</span>
              </div>
            )) : <p className="text-muted-foreground">{labels.empty || '—'}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{labels.sections_sentiment || '—'}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm min-w-0">
            {Object.keys(sentiment).length ? Object.entries(sentiment).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between rounded border px-2 py-1">
                <span>{key}</span>
                <span className="font-medium">{value}</span>
              </div>
            )) : <p className="text-muted-foreground">{labels.empty || '—'}</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{labels.sections_live_comments || '—'}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm min-w-0">
            {filteredComments.length ? filteredComments.slice(0, 12).map((item, idx) => (
              <div key={`cm_${idx}`} className="rounded border px-2 py-1">
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{item.channel || '—'}</span>
                  <span>{item.sentiment || '—'}</span>
                </div>
                <p className="break-words">{item.text || '—'}</p>
              </div>
            )) : <p className="text-muted-foreground">{labels.empty_filtered || labels.empty || '—'}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{labels.sections_hotspots_recommendations || '—'}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm min-w-0">
            {hotspots.length ? hotspots.map((item, idx) => (
              <div key={`hs_${idx}`} className="flex items-center justify-between rounded border px-2 py-1">
                <span>{item.label || '—'}</span>
                <span className="font-medium">{item.count || 0}</span>
              </div>
            )) : <p className="text-muted-foreground">{labels.empty || '—'}</p>}
            {recommendations.length ? (
              <div className="pt-2">
                {recommendations.map((text, idx) => (
                  <div key={`rc_${idx}`} className="mb-1 rounded border bg-muted/30 px-2 py-1">{text}</div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader><CardTitle>{labels.sections_map || 'Mapa en tiempo real'}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {geoCategories.length ? (
              <div className="flex flex-wrap gap-2 text-xs">
                {geoCategories.slice(0, 10).map((item, idx) => (
                  <span key={`${item.categoria || 'cat'}_${idx}`} className="inline-flex items-center gap-1 rounded-full border px-2 py-1">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color || '#94a3b8' }} />
                    {item.categoria || '—'} · {item.event_count ?? item.total_weight ?? 0}
                  </span>
                ))}
              </div>
            ) : null}
            <MeasuredContainer className="h-[320px] min-w-0 overflow-hidden rounded-lg border border-border/60 sm:h-[420px]">
              {mapPoints.length || (geoLayerSource?.features?.length ?? 0) > 0 ? (
                <MapLibreMap
                  className="h-full w-full"
                  heatmapData={mapPoints}
                  center={mapCenter}
                  fitToBounds={mapBounds.length ? mapBounds : undefined}
                  initialZoom={mapBounds.length ? 11 : 4}
                  showHeatmap
                  geoLayerConfig={{
                    contract_version: data?.geo_layers?.contract_version,
                    style_url: data?.geo_layers?.style_url,
                    source: geoLayerSource,
                    source_options: data?.geo_layers?.source_options,
                    interactions: data?.geo_layers?.interactions,
                    layers: data?.geo_layers?.layers,
                    telemetry: data?.geo_layers?.telemetry,
                  }}
                  mapStyleUrl={data?.geo_layers?.style_url}
                />
              ) : (
                <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
                  {labels.empty_map || labels.empty || '—'}
                </div>
              )}
            </MeasuredContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{labels.sections_segments || 'Segmentos'}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm min-w-0">
            {segmentGroups.length ? segmentGroups.map((group) => (
              <div key={group.key} className="rounded border px-2 py-2">
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.key}</div>
                <div className="space-y-1">
                  {group.items.slice(0, 5).map((item, idx) => (
                    <div key={`${group.key}_${idx}`} className="flex items-center justify-between gap-2">
                      <span className="truncate">{item.label || '—'}</span>
                      <span className="font-medium">{item.count || 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            )) : <p className="text-muted-foreground">{labels.empty || '—'}</p>}
            {appliedFilters.length ? (
              <div className="rounded border bg-muted/30 px-2 py-2 text-xs">
                <div className="mb-1 font-medium text-muted-foreground">{labels.applied_filters || 'Filtros aplicados'}</div>
                <div>{appliedFilters.join(' · ')}</div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RealtimeHubDashboard;
