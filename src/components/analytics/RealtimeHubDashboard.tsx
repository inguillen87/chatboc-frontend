import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import type { RealtimeHubResponse } from '@/services/analyticsService';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import MapLibreMap from '@/components/LazyMapLibreMap';
import { MeasuredContainer } from '@/components/analytics/MeasuredContainer';
import { Activity, BarChart3, MessageCircle, Radio, Vote } from 'lucide-react';

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

const toDisplayNumber = (value: unknown): string => {
  const number = toFiniteNumber(value);
  if (number === null) return '0';
  return new Intl.NumberFormat('es-AR').format(number);
};

const sentimentLabel = (value: string): string => {
  const normalized = value.trim().toLowerCase();
  if (['positive', 'positivo', 'positiva'].includes(normalized)) return 'Comentario favorable';
  if (['negative', 'negativo', 'negativa'].includes(normalized)) return 'Comentario que necesita atención';
  if (['neutral', 'neutro', 'neutra'].includes(normalized)) return 'Sin una señal clara';
  return 'Otra lectura automática';
};

const segmentLabel = (value: string): string => ({
  categoria: 'Categoría',
  rango_edad: 'Edad',
  sexo: 'Género',
  barrio: 'Barrio',
  distrito: 'Distrito',
  canal: 'Canal',
}[value] ?? value);

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
  const surveyOps = data?.survey_operations;
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

  const surveyActions = Array.isArray(surveyOps?.recommended_actions) ? surveyOps.recommended_actions : [];
  const surveyIsLive = Boolean(surveyOps?.live_signal || surveyOps?.status === 'live');
  const summaryMetrics = [
    { label: labels.cards_events || 'Actividad registrada', value: totals.events },
    { label: labels.cards_survey_responses || 'Respuestas de encuestas', value: totals.survey_responses },
    { label: labels.cards_survey_comments || 'Comentarios en encuestas', value: totals.survey_comments },
    { label: labels.cards_live_chat_comments || 'Comentarios en conversaciones', value: totals.live_chat_comments },
  ];
  const hasSummaryActivity = summaryMetrics.some((item) => (toFiniteNumber(item.value) ?? 0) > 0);
  const hasCommentFilters = selectedChannel !== 'all' || selectedSentiment !== 'all' || Boolean(search.trim());

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardContent className="grid gap-4 p-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border bg-muted text-primary">
                <Radio className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold">{labels.survey_ops_title || 'Encuestas y votaciones en vivo'}</h2>
                <p className="text-sm text-muted-foreground">Seguí la participación y abrí la tarea que necesita atención.</p>
              </div>
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${surveyIsLive ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200' : 'text-muted-foreground'}`}>
                <span className={`h-2 w-2 rounded-full ${surveyIsLive ? 'animate-pulse bg-emerald-300' : 'bg-slate-400'}`} />
                {surveyIsLive ? 'Hay actividad en vivo' : 'No hay actividad en vivo'}
              </span>
            </div>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              {surveyOps?.headline || labels.survey_ops_quiet || 'Sin actividad de encuestas en este periodo'}
            </p>
            {surveyIsLive || surveyActions.length ? <div className="grid gap-2 sm:grid-cols-4">
              {[
                { label: 'Participaciones', value: surveyOps?.responses ?? totals.survey_responses, icon: Vote },
                { label: 'Comentarios', value: surveyOps?.comments ?? totals.survey_comments, icon: MessageCircle },
                { label: 'Votos registrados', value: surveyOps?.vote_events, icon: Activity },
                { label: 'Interacciones', value: surveyOps?.engagement, icon: BarChart3 },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border p-3">
                  <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{item.label}</span>
                    <item.icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  </div>
                  <div className="text-2xl font-semibold">{toDisplayNumber(item.value)}</div>
                </div>
              ))}
            </div> : (
              <div className="rounded-xl border border-dashed p-4 text-sm">
                <p className="font-medium">Todavía no hay participación para mostrar.</p>
                <p className="mt-1 text-muted-foreground">Publicá o revisá una encuesta para empezar a recibir respuestas.</p>
                <a href="/admin/encuestas" className="mt-3 inline-flex min-h-11 items-center rounded-md border px-4 font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  Ir a encuestas
                </a>
              </div>
            )}
          </div>
          <div className="rounded-xl border bg-muted/20 p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">Qué podés hacer ahora</span>
              <span className="text-xs text-muted-foreground">Actividad de los últimos {surveyOps?.window_minutes || 30} min</span>
            </div>
            <div className="space-y-2">
              {surveyActions.length ? surveyActions.slice(0, 3).map((action) => (
                <a
                  key={action.id || action.label}
                  href={action.href || action.route || '/admin/encuestas'}
                  className="flex min-h-11 items-center rounded-lg border bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:border-primary/40 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span>{action.label || 'Abrir encuestas'}</span>
                </a>
              )) : (
                <div className="rounded-lg border border-dashed bg-background px-3 py-3 text-sm">
                  <p>{labels.survey_ops_quiet || 'No hay una acción pendiente en este periodo.'}</p>
                  <a href="/admin/encuestas" className="mt-3 inline-flex min-h-11 items-center rounded-md border px-3 font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    Revisar encuestas
                  </a>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-2 xl:grid-cols-4">
        <Select value={selectedChannel} onValueChange={setSelectedChannel}>
          <SelectTrigger className="h-11"><SelectValue placeholder={labels.filters_channel || 'Canal'} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{labels.option_all || 'Todos los canales'}</SelectItem>
            {channels.map((channel) => <SelectItem key={channel} value={channel}>{channel}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={selectedSentiment} onValueChange={setSelectedSentiment}>
          <SelectTrigger className="h-11"><SelectValue placeholder={labels.filters_sentiment || 'Lectura de comentarios'} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{labels.option_all || 'Todas las lecturas'}</SelectItem>
            {sentiments.map((sentimentValue) => <SelectItem key={sentimentValue} value={sentimentValue}>{sentimentLabel(sentimentValue)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={labels.filters_search || 'Buscar en comentarios'} className="h-11 md:col-span-2" />
      </div>

      <Card>
        <CardHeader><CardTitle>Actividad del periodo</CardTitle></CardHeader>
        <CardContent>
          {hasSummaryActivity ? (
            <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {summaryMetrics.map((item) => (
                <div key={item.label} className="border-l-2 border-primary/30 pl-3">
                  <dt className="text-sm text-muted-foreground">{item.label}</dt>
                  <dd className="mt-1 text-2xl font-semibold">{toDisplayNumber(item.value)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-sm">
              <p className="font-medium">Todavía no se registró actividad en este periodo.</p>
              <a href="/admin/encuestas" className="mt-3 inline-flex min-h-11 items-center rounded-md border px-3 font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Revisar encuestas
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{labels.sections_top_channels || 'Canales con actividad'}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm min-w-0">
            {topChannels.length ? topChannels.map((item, idx) => (
              <div key={`ch_${idx}`} className="flex items-center justify-between rounded border px-2 py-1">
                <span>{item.channel || '—'}</span>
                <span className="font-medium">{item.count || 0}</span>
              </div>
            )) : <div className="rounded-lg border border-dashed p-3"><p className="text-muted-foreground">Todavía no hay canales con actividad.</p><a href="/admin/encuestas" className="mt-2 inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline">Revisar encuestas</a></div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{labels.sections_hotspots_recommendations || 'Dónde conviene actuar'}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm min-w-0">
            {hotspots.length ? hotspots.map((item, idx) => (
              <div key={`hs_${idx}`} className="flex items-center justify-between rounded border px-2 py-2">
                <span>{item.label || 'Zona sin nombre'}</span>
                <span className="font-medium">{item.count || 0}</span>
              </div>
            )) : <div className="rounded-lg border border-dashed p-3"><p className="text-muted-foreground">Todavía no hay zonas para priorizar.</p><a href="/perfil?tab=mapas" className="mt-2 inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline">Revisar ubicaciones</a></div>}
            {recommendations.length ? <div className="pt-2">{recommendations.map((text, idx) => <div key={`rc_${idx}`} className="mb-1 rounded border bg-muted/30 px-2 py-2">{text}</div>)}</div> : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader><CardTitle>{labels.sections_live_comments || 'Comentarios recibidos'}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm min-w-0">
            {filteredComments.length ? filteredComments.slice(0, 12).map((item, idx) => (
              <div key={`cm_${idx}`} className="rounded border px-2 py-1">
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{item.channel || '—'}</span>
                </div>
                <p className="break-words">{item.text || 'Comentario sin texto'}</p>
              </div>
            )) : <div className="rounded-lg border border-dashed p-3"><p className="text-muted-foreground">{hasCommentFilters ? 'No hay comentarios con estos filtros.' : 'Todavía no hay comentarios para mostrar.'}</p>{hasCommentFilters ? <button type="button" className="mt-2 min-h-11 rounded-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => { setSelectedChannel('all'); setSelectedSentiment('all'); setSearch(''); }}>Quitar filtros</button> : <a href="/admin/encuestas" className="mt-2 inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline">Revisar encuestas</a>}</div>}
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
                    {item.color ? <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} /> : null}
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
                  <div>
                    <p>{labels.empty_map || 'Todavía no hay ubicaciones para mostrar en el mapa.'}</p>
                    <a href="/perfil?tab=tickets&focus=open_geocoding_queue" className="mt-3 inline-flex min-h-11 items-center rounded-md border px-3 font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      Completar ubicaciones de casos
                    </a>
                  </div>
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
                <div className="mb-1 text-sm font-medium text-muted-foreground">{segmentLabel(group.key)}</div>
                <div className="space-y-1">
                  {group.items.slice(0, 5).map((item, idx) => (
                    <div key={`${group.key}_${idx}`} className="flex items-center justify-between gap-2">
                      <span className="truncate">{item.label || '—'}</span>
                      <span className="font-medium">{item.count || 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            )) : <div className="rounded-lg border border-dashed p-3"><p className="text-muted-foreground">Todavía no hay grupos para comparar.</p><a href="/admin/encuestas" className="mt-2 inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline">Revisar encuestas</a></div>}
          </CardContent>
        </Card>
      </div>

      {(topEvents.length || Object.keys(sentiment).length || appliedFilters.length) ? (
        <details className="rounded-lg border bg-card px-4 py-2 text-sm">
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Datos para soporte
          </summary>
          <div className="space-y-4 border-t pt-3 text-muted-foreground">
            {topEvents.length ? <div><p className="font-medium text-foreground">Eventos recibidos</p>{topEvents.map((item, idx) => <p key={`ev_${idx}`}>{item.event || 'Sin identificador'}: {item.count || 0}</p>)}</div> : null}
            {Object.keys(sentiment).length ? <div><p className="font-medium text-foreground">Lectura automática de comentarios</p>{Object.entries(sentiment).map(([key, value]) => <p key={key}>{sentimentLabel(key)} ({key}): {typeof value === 'number' || typeof value === 'string' ? value : JSON.stringify(value)}</p>)}</div> : null}
            {appliedFilters.length ? <div><p className="font-medium text-foreground">Filtros informados por el servicio</p><p>{appliedFilters.join(' · ')}</p></div> : null}
          </div>
        </details>
      ) : null}
    </div>
  );
};

export default RealtimeHubDashboard;
