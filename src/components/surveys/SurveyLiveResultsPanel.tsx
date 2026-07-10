import { useMemo, useState } from 'react';
import { Activity, AlertTriangle, BarChart3, ExternalLink, Loader2, MapPinned, Radio, RefreshCw, ShieldCheck, Signal, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SurveyLiveHeatmapPreview } from '@/components/surveys/SurveyLiveHeatmapPreview';
import { normalizePublicSurveyLiveResults } from '@/api/encuestas';
import { hasSurveyLiveActivity, useSurveyLiveResults, type SurveyLiveRequestParams } from '@/hooks/useSurveyLiveResults';
import { useSurveySocket } from '@/hooks/useSurveySocket';
import type { SurveyLivePublicQuestion, SurveyLivePublicResultsPayload, SurveyRealtimeContract } from '@/types/encuestas';

interface SurveyLiveResultsPanelProps {
  slug?: string | null;
  tenantSlug?: string | null;
  enabled?: boolean;
  title?: string;
  description?: string;
  className?: string;
}

const DEFAULT_PARAMS: SurveyLiveRequestParams = {
  include_heatmap: 1,
  window_minutes: 60,
  max_points: 800,
  max_cells: 120,
};

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const displayText = (value: unknown, fallback = '-') => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'si' : 'no';
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return displayText(record.label ?? record.texto ?? record.value ?? record.nombre, fallback);
  }
  return fallback;
};

const payloadVersion = (payload?: SurveyLivePublicResultsPayload) => {
  const resultVersion = toNumber(payload?.result_version, Number.NaN);
  if (Number.isFinite(resultVersion)) return resultVersion;
  const numericSnapshotVersion = toNumber(payload?.snapshot_version, Number.NaN);
  if (Number.isFinite(numericSnapshotVersion)) return numericSnapshotVersion;
  const snapshotTimestamp = Date.parse(String(payload?.snapshot_version || ''));
  if (Number.isFinite(snapshotTimestamp)) return snapshotTimestamp;
  const updatedAt = Date.parse(String(payload?.updated_at || ''));
  return Number.isFinite(updatedAt) ? updatedAt : 0;
};

const statusTone = (mode: string) => {
  if (mode === 'socket') return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200';
  if (mode === 'fallback') return 'border-amber-400/40 bg-amber-500/10 text-amber-700 dark:text-amber-200';
  if (mode === 'error') return 'border-rose-400/40 bg-rose-500/10 text-rose-700 dark:text-rose-200';
  return 'border-sky-400/30 bg-sky-500/10 text-sky-700 dark:text-sky-200';
};

const questionTotal = (question: SurveyLivePublicQuestion) =>
  toNumber(question.total_votos) ||
  (question.opciones ?? []).reduce((sum, option) => sum + toNumber(option.votos), 0);

const topQuestions = (questions?: SurveyLivePublicQuestion[]) =>
  (questions ?? [])
    .map((question) => ({ ...question, total: questionTotal(question) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object');

const displayProductSurface = (payload?: SurveyLivePublicResultsPayload) => {
  const surface = payload?.render_contract?.product_surface;
  if (isRecord(surface) && typeof surface.name === 'string' && surface.name.trim()) {
    return surface.name.trim();
  }
  return 'Noether Analytics Maps';
};

const heatmapProviderLabel = (payload?: SurveyLivePublicResultsPayload) => {
  const metadata = payload?.heatmap?.metadata;
  const mapConfig = isRecord(metadata?.map_config) ? metadata.map_config : undefined;
  return displayText(mapConfig?.provider, 'MapLibre');
};

const heatmapPrivacyLabel = (payload?: SurveyLivePublicResultsPayload) => {
  const metadata = payload?.heatmap?.metadata;
  if (metadata?.raw_points_redacted || metadata?.privacy_mode === 'public_aggregated') {
    return 'Privacidad protegida';
  }
  if (metadata?.privacy_mode === 'raw') {
    return 'Vista interna exacta';
  }
  return 'Geo segura';
};

const heatmapAdminRoute = (payload?: SurveyLivePublicResultsPayload) => {
  const analyticsSurface = payload?.admin_operations?.analytics_surface ?? payload?.operations?.analytics_surface;
  const route = analyticsSurface?.heatmap_href ?? analyticsSurface?.heatmap_route;
  return typeof route === 'string' && route.trim() ? route.trim() : undefined;
};

const LIVE_RESULTS_SOCKET_SIGNAL_KEYS = [
  'preguntas',
  'questions',
  'resultados',
  'results',
  'total_respuestas',
  'total_responses',
  'total_votos',
  'total_votes',
  'votes',
  'votos',
  'timeline_minute',
  'timeline',
  'series',
  'timeseries',
  'heatmap',
  'heatmap_points',
  'geo_points',
  'points',
  'puntos',
  'heatmap_cells',
  'cells',
  'celdas',
  'result_version',
  'resultVersion',
  'snapshot_version',
  'snapshotVersion',
] as const;

const isSurveyLiveResultsSocketPayload = (payload: unknown) => {
  if (!isRecord(payload)) return false;
  const contractVersion = payload.contract_version ?? payload.contractVersion;
  if (contractVersion === 'surveys.live_results.v2') return true;
  return LIVE_RESULTS_SOCKET_SIGNAL_KEYS.some((key) => payload[key] !== undefined && payload[key] !== null);
};

const normalizeSocketLiveResultsPayload = (payload: unknown): SurveyLivePublicResultsPayload | null => {
  if (!isSurveyLiveResultsSocketPayload(payload)) return null;
  return normalizePublicSurveyLiveResults(payload);
};

const normalizeStringList = (values: unknown[]) =>
  Array.from(
    new Set(
      values
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean),
    ),
  );

const extractRealtimeEvents = (realtime?: SurveyRealtimeContract) =>
  normalizeStringList(
    (realtime?.socket?.events ?? []).map((event) => (typeof event === 'string' ? event : isRecord(event) ? event.name : undefined)),
  );

const extractRealtimeJoinPayloads = (realtime?: SurveyRealtimeContract) => {
  const payloads = Array.isArray(realtime?.socket?.join_payloads)
    ? realtime?.socket?.join_payloads?.filter(isRecord) ?? []
    : [];
  const singlePayload = isRecord(realtime?.socket?.join_payload) ? [realtime.socket.join_payload] : [];
  const source = payloads.length ? payloads : singlePayload;
  if (!source.length) return undefined;
  const seen = new Set<string>();
  return source.filter((payload) => {
    const key = JSON.stringify(payload);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const buildFallbackRooms = (slug: string, tenantSlug?: string) => {
  if (!slug) return [];
  const legacyRoom = `encuesta_${slug}`;
  return tenantSlug ? [`encuesta:${tenantSlug}:${slug}`, legacyRoom] : [legacyRoom];
};

const buildRealtimeSocketOptions = (
  realtime: SurveyRealtimeContract | undefined,
  slug: string,
  tenantSlug?: string,
) => {
  const rooms = normalizeStringList([
    realtime?.rooms,
    realtime?.primary_room,
    realtime?.room,
    realtime?.legacy_room,
    buildFallbackRooms(slug, tenantSlug),
  ]);
  return {
    rooms,
    joinEvent: typeof realtime?.socket?.join_event === 'string' && realtime.socket.join_event.trim()
      ? realtime.socket.join_event.trim()
      : 'join',
    joinPayloads: extractRealtimeJoinPayloads(realtime),
    events: extractRealtimeEvents(realtime),
  };
};

export function SurveyLiveResultsPanel({
  slug,
  tenantSlug,
  enabled = true,
  title = 'Resultados en vivo',
  description = 'Pulso operativo con socket, polling, mapa de calor e inteligencia de participacion.',
  className,
}: SurveyLiveResultsPanelProps) {
  const normalizedSlug = slug?.trim() ?? '';
  const normalizedTenant = tenantSlug?.trim() ?? '';
  const [params, setParams] = useState<SurveyLiveRequestParams>(DEFAULT_PARAMS);
  const [socketPayload, setSocketPayload] = useState<SurveyLivePublicResultsPayload | undefined>(undefined);

  const {
    liveResults: polledPayload,
    isLoading,
    isFetching,
    error,
    consecutiveErrors,
    liveStatus,
    pollingIntervalMs,
    refetch,
  } = useSurveyLiveResults(enabled && normalizedSlug ? normalizedSlug : undefined, normalizedTenant || undefined, params);

  const realtimeSocketOptions = useMemo(
    () => buildRealtimeSocketOptions(polledPayload?.realtime, normalizedSlug, normalizedTenant || undefined),
    [normalizedSlug, normalizedTenant, polledPayload?.realtime],
  );

  useSurveySocket({
    slug: normalizedSlug,
    tenantSlug: normalizedTenant || undefined,
    rooms: realtimeSocketOptions.rooms,
    joinEvent: realtimeSocketOptions.joinEvent,
    joinPayloads: realtimeSocketOptions.joinPayloads,
    events: realtimeSocketOptions.events,
    enabled: enabled && Boolean(normalizedSlug),
    onUpdate: (payload) => {
      const normalizedPayload = normalizeSocketLiveResultsPayload(payload);
      if (normalizedPayload) {
        setSocketPayload(normalizedPayload);
      } else {
        void refetch();
      }
    },
  });

  const payload = useMemo(() => {
    if (!socketPayload) return polledPayload;
    if (!polledPayload) return socketPayload;
    return payloadVersion(socketPayload) >= payloadVersion(polledPayload) ? socketPayload : polledPayload;
  }, [polledPayload, socketPayload]);

  const hasSocketPayload = Boolean(socketPayload && payload === socketPayload);
  const hasActivity = hasSurveyLiveActivity(payload);
  const statusMode = error && !payload ? 'error' : consecutiveErrors > 2 ? 'fallback' : hasSocketPayload ? 'socket' : liveStatus.status;
  const statusLabel =
    statusMode === 'socket'
      ? 'Socket live'
      : statusMode === 'fallback'
        ? 'Polling fallback'
        : statusMode === 'error'
          ? 'Sin conexion live'
          : liveStatus.label;
  const totalResponses = toNumber(payload?.total_respuestas);
  const questions = topQuestions(payload?.preguntas);
  const maxQuestionTotal = Math.max(1, ...questions.map((question) => question.total));
  const timeline = (payload?.timeline_minute ?? []).slice(-18);
  const maxTimelineValue = Math.max(
    1,
    ...timeline.map((point) => toNumber(point.respuestas ?? point.value ?? point.total)),
  );
  const updatedAtLabel = payload?.updated_at ? new Date(payload.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
  const pollingSeconds = Math.max(1, Math.round((pollingIntervalMs ?? 0) / 1000));
  const productSurfaceName = displayProductSurface(payload);
  const productSurfaceScope = displayText(payload?.render_contract?.product_surface?.scope, 'surveys_live_heatmap');
  const privacyLabel = heatmapPrivacyLabel(payload);
  const providerLabel = heatmapProviderLabel(payload);
  const adminHeatmapRoute = heatmapAdminRoute(payload);

  if (!enabled || !normalizedSlug) {
    return (
      <Card className={className} data-testid="survey-live-results-panel-disabled">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>Activa resultados en vivo y publica la encuesta para ver la sala operativa.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={className} data-testid="survey-live-results-panel">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-primary" />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${statusTone(statusMode)}`} role="status">
              <span className={`h-2 w-2 rounded-full bg-current ${isFetching || hasSocketPayload ? 'animate-pulse' : ''}`} />
              {statusLabel}
            </span>
            {updatedAtLabel ? <span className="text-xs text-muted-foreground">Actualizado {updatedAtLabel}</span> : null}
            <Button type="button" variant="outline" size="sm" disabled={isFetching} onClick={() => void refetch()}>
              {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refrescar
            </Button>
          </div>
        </div>
        {error && consecutiveErrors > 2 ? (
          <div className="flex items-center gap-2 rounded-md border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4" />
            Se muestran datos previos mientras polling reintenta: {error}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading && !payload ? (
          <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-border/70 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Cargando sala live...
          </div>
        ) : (
          <>
            <div
              className="grid gap-3 rounded-xl border border-cyan-400/20 bg-cyan-500/5 p-4 text-sm md:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)]"
              data-testid="survey-live-product-surface"
            >
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-700 dark:text-cyan-200">
                    <MapPinned className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">{productSurfaceName}</p>
                    <p className="text-xs text-muted-foreground">{productSurfaceScope}</p>
                  </div>
                </div>
                <p className="max-w-3xl text-sm text-muted-foreground">
                  Mapa operativo para leer votos, zonas activas, canales y senales IA sin exponer coordenadas sensibles.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-1">
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                  <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    {privacyLabel}
                  </span>
                  <span className="text-xs text-muted-foreground">{providerLabel}</span>
                </div>
                {adminHeatmapRoute ? (
                  <a
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90"
                    href={adminHeatmapRoute}
                  >
                    Abrir mapa admin
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <div className="rounded-lg border border-dashed border-border/70 bg-background/50 px-3 py-2 text-xs text-muted-foreground">
                    Mapa admin disponible cuando el contrato operativo incluya ruta.
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-border/60 bg-background/80 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <Users className="h-4 w-4" />
                  Respuestas
                </div>
                <p className="text-2xl font-semibold">{totalResponses || '-'}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/80 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <Activity className="h-4 w-4" />
                  Ultima hora
                </div>
                <p className="text-2xl font-semibold">{payload?.kpis?.responses_last_hour ?? '-'}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/80 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <Signal className="h-4 w-4" />
                  Ritmo/min
                </div>
                <p className="text-2xl font-semibold">{payload?.kpis?.participation_per_minute ?? '-'}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/80 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <BarChart3 className="h-4 w-4" />
                  Cadencia
                </div>
                <p className="text-2xl font-semibold">{pollingSeconds}s</p>
              </div>
            </div>

            {!hasActivity ? (
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
                La sala esta lista. Va a mostrar votos, comentarios y zonas activas cuando entren respuestas.
              </div>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
              <div className="space-y-4">
                <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">Preguntas con mas actividad</p>
                    <span className="text-xs text-muted-foreground">{questions.length} visibles</span>
                  </div>
                  <div className="space-y-3">
                    {questions.length ? (
                      questions.map((question) => (
                        <div key={String(question.id ?? question.texto ?? question.titulo)} className="space-y-2">
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="truncate font-medium">{displayText(question.texto ?? question.titulo, 'Pregunta')}</span>
                            <span className="shrink-0 text-muted-foreground">{question.total}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${Math.max(4, Math.min(100, (question.total / maxQuestionTotal) * 100))}%` }}
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">Sin preguntas activas todavia.</p>
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">Timeline live</p>
                    <select
                      className="rounded-md border bg-background px-2 py-1 text-xs"
                      value={String(params.window_minutes ?? 60)}
                      onChange={(event) => setParams((current) => ({ ...current, window_minutes: Number(event.target.value) || 60 }))}
                    >
                      <option value="60">Ultima hora</option>
                      <option value="360">6 horas</option>
                      <option value="1440">24 horas</option>
                    </select>
                  </div>
                  <div className="flex h-24 items-end gap-1">
                    {timeline.length ? (
                      timeline.map((point, index) => {
                        const value = toNumber(point.respuestas ?? point.value ?? point.total);
                        return (
                          <div
                            key={`${point.minute ?? point.timestamp ?? index}`}
                            className="flex-1 rounded-t bg-primary/70"
                            title={`${displayText(point.label ?? point.minute ?? point.timestamp, 'minuto')}: ${value}`}
                            style={{ height: `${Math.max(6, (value / maxTimelineValue) * 96)}%` }}
                          />
                        );
                      })
                    ) : (
                      <div className="flex h-full w-full items-center justify-center rounded-md border border-dashed border-border/70 text-sm text-muted-foreground">
                        Sin actividad temporal para esta ventana.
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <SurveyLiveHeatmapPreview
                heatmap={payload?.heatmap}
                aiSignal={payload?.ai_signal}
                operatorRecommendations={payload?.operator_recommendations}
                title="Mapa live de participacion"
                subtitle="Zonas y canales activos con privacidad protegida"
                emptyLabel="Sin actividad territorial para esta ventana"
              />
            </div>

            {(payload?.ai_summary || payload?.ai_insights?.length) ? (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
                <p className="mb-2 font-semibold">Lectura IA</p>
                {payload.ai_summary ? <p className="text-muted-foreground">{payload.ai_summary}</p> : null}
                {payload.ai_insights?.length ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                    {payload.ai_insights.slice(0, 4).map((insight, index) => (
                      <li key={`${index}-${insight}`}>{insight}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default SurveyLiveResultsPanel;
