import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { Activity, AlertTriangle, CalendarDays, Copy, Download, ExternalLink, Gauge, Loader2, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { SurveyAnalytics } from '@/components/surveys/SurveyAnalytics';
import { SurveyLiveResultsPanel } from '@/components/surveys/SurveyLiveResultsPanel';
import { SurveyQrPreview } from '@/components/surveys/SurveyQrPreview';
import { SurveyRecentResponses } from '@/components/surveys/SurveyRecentResponses';
import { TransparencyTab } from '@/components/surveys/TransparencyTab';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSurveyAdmin } from '@/hooks/useSurveyAdmin';
import { useSurveyAnalytics } from '@/hooks/useSurveyAnalytics';
import { useAnchor } from '@/hooks/useAnchor';
import { useSurveyResponses } from '@/hooks/useSurveyResponses';
import { useSurveySeedResponses } from '@/hooks/useSurveySeedResponses';
import { toast } from '@/components/ui/use-toast';
import { getPublicSurveyQrUrlFromRecord, getPublicSurveyUrlFromRecord } from '@/utils/publicSurveyUrl';
import { getSurveyAlerts, getSurveyAnomalies, getSurveyBrief, getSurveyForecast, getSurveySegmentsCompare, getSurveySegmentsSuggestions } from '@/api/encuestas';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getErrorMessage } from '@/utils/api';
import { enterpriseService } from '@/services/enterpriseService';
import { MeasuredContainer } from '@/components/analytics/MeasuredContainer';


function formatDateLabel(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString();
}

function asSafeText(value?: unknown) {
  return typeof value === 'string' ? value : '';
}

function humanizeMetricKey(value?: unknown) {
  if (typeof value !== 'string') return '';
  const normalized = value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
  if (!normalized) return '';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function asRenderableText(value?: unknown) {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (!value || typeof value !== 'object') return '';

  const record = value as Record<string, unknown>;
  const candidates = [record.texto, record.text, record.label, record.title, record.message, record.summary];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' || typeof candidate === 'number') return String(candidate);
  }

  return '';
}

function readMetricValue(value: Record<string, unknown>) {
  const candidates = [
    value.value,
    value.metric,
    value.current,
    value.total,
    value.count,
    value.score,
    value.amount,
  ];
  for (const candidate of candidates) {
    const resolved = asRenderableText(candidate);
    if (resolved.trim()) return resolved;
  }
  return '—';
}

function renderLabeledMetric(label: string, value: string | number) {
  if (label.trim()) {
    return (
      <p>
        {label}: <strong>{value}</strong>
      </p>
    );
  }

  return (
    <p>
      <strong>{value}</strong>
    </p>
  );
}

function toFiniteNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asPercentage(value: number) {
  return `${value.toFixed(1)}%`;
}

function normalizePriority(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.trim()) return value;
  return '';
}

function formatMetricMaybe(value: unknown) {
  const text = asRenderableText(value);
  if (!text.trim()) return '—';
  return text;
}

function EnterpriseMetricCard({
  title,
  value,
  subtitle,
  icon,
  tone = 'default',
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon?: ReactNode;
  tone?: 'default' | 'success' | 'warning';
}) {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-500/20 bg-emerald-500/5'
      : tone === 'warning'
        ? 'border-amber-500/20 bg-amber-500/5'
        : 'border-border/60 bg-background/80';

  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}


function normalizeLibraryList(value: unknown): string[] {
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item): item is string => Boolean(item));
  }
  return [];
}

function toNormalizedRatio(value: unknown) {
  const raw = toFiniteNumber(value, Number.NaN);
  if (!Number.isFinite(raw)) return null;
  if (raw <= 0) return 0;
  if (raw >= 1 && raw <= 100) return raw / 100;
  if (raw > 100) return 1;
  return raw;
}

function getPriorityBadgeVariant(priority: string): 'outline' | 'default' | 'secondary' | 'destructive' {
  const normalized = priority.toLowerCase();
  if (normalized.includes('alta') || normalized.includes('high') || normalized === 'p0' || normalized === '1') return 'destructive';
  if (normalized.includes('media') || normalized.includes('medium') || normalized === 'p1' || normalized === '2') return 'default';
  if (normalized.includes('baja') || normalized.includes('low') || normalized === 'p2' || normalized === '3') return 'secondary';
  return 'outline';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asRecordList(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => Boolean(asRecord(item)));
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asRenderableText(item))
    .filter((item): item is string => Boolean(item.trim()));
}

function readRecordText(record: Record<string, unknown> | null | undefined, key: string) {
  return asRenderableText(record?.[key]).trim();
}

function resolveDisplayUrl(value?: unknown) {
  const text = asRenderableText(value).trim();
  if (!text) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(text)) return text;
  if (text.startsWith('/') && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin.replace(/\/$/, '')}${text}`;
  }
  return text;
}

function resolveHref(value?: unknown) {
  return asRenderableText(value).trim();
}

function appendClientQueryParam(href: string, key: string, value: string) {
  const normalized = href.trim();
  if (!normalized) return '';
  const [withoutHash, hash = ''] = normalized.split('#');
  const separator = withoutHash.includes('?') ? '&' : '?';
  const nextHref = `${withoutHash}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
  return hash ? `${nextHref}#${hash}` : nextHref;
}

function publicationStateLabel(value?: unknown) {
  const normalized = asRenderableText(value).trim().toLowerCase();
  if (normalized === 'published') return 'Publicado';
  if (normalized === 'closed') return 'Cerrado';
  if (normalized === 'draft') return 'Borrador';
  if (normalized === 'unavailable') return 'Sin contrato';
  return normalized || 'Sin estado';
}

function normalizeSegmentFilterValue(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const values = value
      .map((item) => normalizeSegmentFilterValue(item))
      .filter((item): item is string => Boolean(item));
    if (values.length) return values.join(',');
  }
  return undefined;
}

function encodeSegmentFilters(filters: Record<string, unknown>) {
  const normalizedEntries = Object.entries(filters)
    .map(([key, value]) => [key, normalizeSegmentFilterValue(value)] as const)
    .filter((entry): entry is readonly [string, string] => Boolean(entry[1]))
    .sort(([a], [b]) => a.localeCompare(b));
  return normalizedEntries.map(([key, value]) => `${key}:${value}`).join('|');
}

function decodeSegmentFilters(encodedValue: string) {
  if (!encodedValue || encodedValue.startsWith('__empty__')) return {} as Record<string, string>;
  return encodedValue.split('|').reduce<Record<string, string>>((acc, pair) => {
    const [key, ...rest] = pair.split(':');
    const value = rest.join(':');
    if (key && value) acc[key] = value;
    return acc;
  }, {});
}


export default function SurveyAnalyticsPage() {
  const params = useParams();
  const surveyId = useMemo(() => (params.id ? Number(params.id) : null), [params.id]);
  const { survey, surveys, isLoadingSurvey, surveyError } = useSurveyAdmin({ id: surveyId ?? undefined });
  const {
    summary,
    timeseries,
    heatmap,
    heatmapPayload,
    heatmapMeta,
    dashboardBundle,
    executiveSummary,
    isLoading,
    exportCsv,
    isExporting,
    filters,
    setFilters,
    error: analyticsError,
  } = useSurveyAnalytics(surveyId ?? undefined, {}, { fallbackSurvey: survey ?? null, fallbackCount: 100 });
  const { snapshots, isLoading: loadingSnapshots, create, publish, verify, isCreating, isPublishing, isVerifying } =
    useAnchor(surveyId ?? undefined);
  const {
    responses,
    isLoading: isLoadingResponses,
    isRefetching: isRefreshingResponses,
    error: responsesError,
    refetch: refetchResponses,
  } = useSurveyResponses(surveyId ?? undefined);
  const queryClient = useQueryClient();
  const { seed: seedSurveyResponses, isSeeding, progress: seedProgress } = useSurveySeedResponses();
  const [segmentAKey, setSegmentAKey] = useState<string>('');
  const [segmentBKey, setSegmentBKey] = useState<string>('');

  const forecastQuery = useQuery({
    queryKey: ['survey-analytics-forecast', surveyId],
    enabled: Boolean(surveyId),
    queryFn: () => getSurveyForecast(surveyId as number, { window_minutes: 15, horizon_minutes: 90 }),
    staleTime: 30_000,
  });
  const alertsQuery = useQuery({
    queryKey: ['survey-analytics-alerts', surveyId],
    enabled: Boolean(surveyId),
    queryFn: () => getSurveyAlerts(surveyId as number, { window_minutes: 15, min_activity: 5 }),
    staleTime: 15_000,
  });
  const briefQuery = useQuery({
    queryKey: ['survey-analytics-brief', surveyId],
    enabled: Boolean(surveyId),
    queryFn: () => getSurveyBrief(surveyId as number),
    staleTime: 60_000,
  });
  const segmentsSuggestionsQuery = useQuery({
    queryKey: ['survey-analytics-segments-suggestions', surveyId],
    enabled: Boolean(surveyId),
    queryFn: () => getSurveySegmentsSuggestions(surveyId as number, { limit: 5 }),
    staleTime: 60_000,
  });

  const segmentSuggestionOptions = useMemo(() => {
    const dimensions = segmentsSuggestionsQuery.data?.dimensions;
    if (!dimensions || typeof dimensions !== 'object') return [] as Array<{ key: string; label: string; dimension: string }>;

    return Object.entries(dimensions).flatMap(([dimension, suggestions]) =>
      (Array.isArray(suggestions) ? suggestions : [])
        .map((suggestion, index) => {
          const filters = asRecord(suggestion?.filters) ?? {};
          const encoded = encodeSegmentFilters(filters);
          const fallbackKey = encoded || `__empty__:${dimension}:${index}`;
          const label = asRenderableText(suggestion?.label);
          if (!label) return null;
          return { key: fallbackKey, label, dimension };
        })
        .filter((option): option is { key: string; label: string; dimension: string } => Boolean(option)),
    );
  }, [segmentsSuggestionsQuery.data?.dimensions]);

  useEffect(() => {
    setSegmentAKey('');
    setSegmentBKey('');
  }, [surveyId]);

  useEffect(() => {
    if (!segmentSuggestionOptions.length) return;
    setSegmentAKey((current) => current || segmentSuggestionOptions[0]?.key || '');
    setSegmentBKey((current) => current || segmentSuggestionOptions[1]?.key || segmentSuggestionOptions[0]?.key || '');
  }, [segmentSuggestionOptions]);

  const compareParams = useMemo(() => {
    const aFilters = decodeSegmentFilters(segmentAKey);
    const bFilters = decodeSegmentFilters(segmentBKey);

    const aEntries = Object.entries(aFilters).map(([key, value]) => [`a_${key}`, value] as const);
    const bEntries = Object.entries(bFilters).map(([key, value]) => [`b_${key}`, value] as const);

    return Object.fromEntries([...aEntries, ...bEntries]);
  }, [segmentAKey, segmentBKey]);

  const hasCompareFiltersReady = useMemo(
    () => Boolean(segmentAKey && segmentBKey && Object.keys(compareParams).length > 0),
    [segmentAKey, segmentBKey, compareParams],
  );

  const compareQuery = useQuery({
    queryKey: ['survey-analytics-segments-compare', surveyId, compareParams],
    enabled: Boolean(surveyId && hasCompareFiltersReady),
    queryFn: () => getSurveySegmentsCompare(surveyId as number, compareParams),
    staleTime: 30_000,
  });
  const anomaliesQuery = useQuery({
    queryKey: ['survey-analytics-anomalies', surveyId],
    enabled: Boolean(surveyId),
    queryFn: () => getSurveyAnomalies(surveyId as number, { burst_window_minutes: 5, burst_threshold: 10 }),
    staleTime: 30_000,
  });

  const surveyFromList = useMemo(() => {
    if (!surveyId || !surveys?.data?.length) return undefined;
    return surveys.data.find((item) => item.id === surveyId);
  }, [surveyId, surveys?.data]);
  const effectiveSurvey = survey ?? surveyFromList;
  const effectiveTenantSlug = effectiveSurvey?.tenant_slug;

  const surveyPublication = useMemo(
    () => asRecord(dashboardBundle?.survey_publication) ?? asRecord(dashboardBundle?.modules?.publication),
    [dashboardBundle?.modules?.publication, dashboardBundle?.survey_publication],
  );
  const publicationLinks = useMemo(() => {
    const directLinks = asRecord(surveyPublication?.links);
    if (directLinks && Object.keys(directLinks).length) return directLinks;
    return asRecord(dashboardBundle?.public_links) ?? {};
  }, [dashboardBundle?.public_links, surveyPublication?.links]);
  const publicationActions = useMemo(() => asRecordList(surveyPublication?.actions), [surveyPublication?.actions]);
  const backendPublicHref =
    readRecordText(publicationLinks, 'public_page_path') ||
    readRecordText(publicationLinks, 'share_url') ||
    readRecordText(publicationLinks, 'public_url') ||
    readRecordText(publicationLinks, 'copy_url');
  const publicHref = backendPublicHref || getPublicSurveyUrlFromRecord(effectiveSurvey);
  const publicUrl = useMemo(
    () => resolveDisplayUrl(publicHref),
    [publicHref],
  );
  const copyPublicUrl = useMemo(
    () => resolveDisplayUrl(readRecordText(publicationLinks, 'copy_url') || publicHref),
    [publicHref, publicationLinks],
  );
  const qrUrl = (
    readRecordText(publicationLinks, 'qr_image_url') ||
    readRecordText(publicationLinks, 'qr_endpoint') ||
    getPublicSurveyQrUrlFromRecord(effectiveSurvey, { size: 512 })
  ) || null;
  const whatsappShareUrl = readRecordText(publicationLinks, 'whatsapp_share_url');
  const publicationState = readRecordText(surveyPublication, 'public_state') || effectiveSurvey?.estado || '';
  const isPublicationReady =
    surveyPublication?.is_published === true ||
    publicationState.toLowerCase() === 'published' ||
    Boolean(publicUrl);
  const liveResultsEnabled =
    surveyPublication?.live_results_enabled === true ||
    effectiveSurvey?.mostrar_resultados_envivo === true;
  const isLiveVote =
    surveyPublication?.is_live_vote === true ||
    effectiveSurvey?.es_votacion_envivo === true;
  const requiresIdentity =
    surveyPublication?.requires_identity === true ||
    effectiveSurvey?.requiere_identidad === true;
  const openLiveAction = publicationActions.find((action) => readRecordText(action, 'id') === 'open_live_results');
  const resolvedPublicHref = resolveHref(publicHref);
  const openLiveActionHref = readRecordText(openLiveAction, 'href');
  const liveResultsPageHref = openLiveActionHref || (resolvedPublicHref ? appendClientQueryParam(resolvedPublicHref, 'live', '1') : '');
  const shouldShowLiveResultsButton = liveResultsEnabled && Boolean(liveResultsPageHref);
  const resolvedLiveResultsHref = resolveHref(liveResultsPageHref);
  const resolvedWhatsappShareUrl = resolveHref(whatsappShareUrl);
  const publicContractVersion = readRecordText(surveyPublication, 'contract_version');
  const publicSlug = readRecordText(surveyPublication, 'slug_publico') || readRecordText(surveyPublication, 'canonical_slug');
  const livePanelSlug = publicSlug || effectiveSurvey?.slug_publico || effectiveSurvey?.canonical_slug || effectiveSurvey?.slug || '';
  const publicationActionIds = publicationActions.map((action) => readRecordText(action, 'id')).filter(Boolean);
  const publicationActionLabel =
    publicationActionIds.includes('publish_survey')
      ? 'Publicar encuesta'
      : publicationActionIds.includes('enable_live_results')
        ? 'Activar resultados en vivo'
        : publicationActionIds.includes('open_live_results')
          ? 'Resultados listos'
          : 'Distribucion lista';

  const rangeLabel = useMemo(() => {
    const start = formatDateLabel(effectiveSurvey?.inicio_at);
    const end = formatDateLabel(effectiveSurvey?.fin_at);
    if (start && end) return `${start} – ${end}`;
    return start || end || 'Sin rango definido';
  }, [effectiveSurvey?.fin_at, effectiveSurvey?.inicio_at]);

  const enterpriseUiConfig = useMemo(
    () => ((effectiveSurvey?.recursos as Record<string, unknown> | undefined)?.analytics_enterprise_ui as Record<string, unknown>) ?? {},
    [effectiveSurvey?.recursos],
  );
  
  const adminTemplate = useMemo(
    () => (dashboardBundle?.admin_template && typeof dashboardBundle.admin_template === 'object' ? dashboardBundle.admin_template : null),
    [dashboardBundle?.admin_template],
  );
  const adminTemplateTabs = useMemo(() => asRecordList(adminTemplate?.tabs), [adminTemplate?.tabs]);
  const adminTemplateDatasets = useMemo(() => {
    if (Array.isArray(adminTemplate?.datasets)) return asRecordList(adminTemplate.datasets);
    const datasetsRecord = asRecord(adminTemplate?.datasets);
    if (!datasetsRecord) return [] as Array<Record<string, unknown>>;
    return Object.entries(datasetsRecord).map(([key, value]) => ({ key, items: Array.isArray(value) ? value : [value] }));
  }, [adminTemplate?.datasets]);
  const adminTemplateDecisionCards = useMemo(
    () => asRecordList(adminTemplate?.decision_cards),
    [adminTemplate?.decision_cards],
  );
  const adminTemplateMapLayers = useMemo(() => asRecordList(adminTemplate?.map_layers), [adminTemplate?.map_layers]);
  const adminTemplateStackGroups = useMemo(() => {
    const stack = asRecord(adminTemplate?.stack);
    const recommended = asStringList(asRecord(adminTemplate?.chart_stack)?.recommended);
    const recommendedGroupLabel = asRenderableText(asRecord(adminTemplate?.chart_stack)?.recommended_label);
    const groups = stack
      ? Object.entries(stack)
          .map(([key, value]) => ({ key, libs: asStringList(value) }))
          .filter((group) => group.libs.length > 0)
      : [];
    if (recommended.length) {
      groups.unshift({ key: recommendedGroupLabel, libs: recommended });
    }
    return groups;
  }, [adminTemplate?.stack, adminTemplate?.chart_stack]);
  const adminTemplateVisualModules = useMemo(() => asRecordList(adminTemplate?.visual_modules), [adminTemplate?.visual_modules]);
  const adminTemplateUxGuardrails = useMemo(() => asRecord(adminTemplate?.ux_guardrails), [adminTemplate?.ux_guardrails]);
  const chartContainerGuardrails = useMemo(
    () => asRecord(adminTemplateUxGuardrails?.chart_container),
    [adminTemplateUxGuardrails?.chart_container],
  );
  const chartContainerMinWidth = useMemo(
    () => Math.max(280, Math.round(toFiniteNumber(chartContainerGuardrails?.default_min_width, 280))),
    [chartContainerGuardrails?.default_min_width],
  );
  const chartContainerMinHeight = useMemo(
    () => Math.max(220, Math.round(toFiniteNumber(chartContainerGuardrails?.default_min_height, 220))),
    [chartContainerGuardrails?.default_min_height],
  );
  const chartRenderWhenVisible = chartContainerGuardrails?.render_when_visible === true;
  const telemetryGuardrails = useMemo(() => asRecord(adminTemplateUxGuardrails?.telemetry), [adminTemplateUxGuardrails?.telemetry]);
  const telemetryEventEndpoint = asRenderableText(telemetryGuardrails?.event_endpoint_preferred) || '/api/analytics/event';
  const telemetryFallbackEventName = asRenderableText(telemetryGuardrails?.fallback_event_name) || 'frontend_analytics_event';

  useEffect(() => {
    if (!surveyId) return;
    void enterpriseService.trackEvent(
      {
        event: 'analytics_dashboard_loaded',
        tenant_id: typeof effectiveSurvey?.tenant_id === 'number' ? effectiveSurvey.tenant_id : undefined,
        payload: {
          tenant_slug: effectiveTenantSlug || null,
          route: '/admin/encuestas/:id/analytics',
          build_version: import.meta.env.VITE_APP_VERSION || 'dev',
          survey_id: surveyId,
        },
        fallback_event_name: telemetryFallbackEventName,
        event_endpoint_preferred: telemetryEventEndpoint,
      },
      effectiveTenantSlug,
    ).catch(() => undefined);
  }, [surveyId, effectiveSurvey?.tenant_id, effectiveTenantSlug, telemetryEventEndpoint, telemetryFallbackEventName]);

  const hasAdminTemplateContent = Boolean(
    adminTemplateTabs.length ||
      adminTemplateDatasets.length ||
      adminTemplateDecisionCards.length ||
      adminTemplateMapLayers.length ||
      adminTemplateStackGroups.length ||
      adminTemplateVisualModules.length,
  );

  const demographicFilterOptions = useMemo(() => {
    const breakdowns = summary?.demografia ?? {};
    const buildOptions = (keys: string[]) => {
      for (const key of keys) {
        const items = breakdowns[key];
        if (!Array.isArray(items) || !items.length) continue;
        const normalized = items
          .map((item) => {
            const rawValue = item?.clave ?? item?.etiqueta;
            if (rawValue === undefined || rawValue === null || rawValue === '') {
              return null;
            }
            const value = String(rawValue);
            const label = String(item?.etiqueta ?? rawValue);
            return { value, label };
          })
          .filter((option): option is { value: string; label: string } => Boolean(option));
        if (!normalized.length) continue;
        const unique = normalized.filter(
          (option, index, array) => array.findIndex((candidate) => candidate.value === option.value) === index,
        );
        if (unique.length) {
          return unique;
        }
      }
      return [] as Array<{ value: string; label: string }>;
    };

    return {
      genero: buildOptions(['genero', 'generos']),
      rango_etario: buildOptions(['rango_etario', 'rangos_etarios', 'rangoEtario', 'rangosEtarios']),
      pais: buildOptions(['pais', 'paises']),
      provincia: buildOptions(['provincia', 'provincias']),
      ciudad: buildOptions(['ciudad', 'ciudades']),
      barrio: buildOptions(['barrio', 'barrios']),
    };
  }, [summary?.demografia]);

  const SELECT_ALL = '__all__';

  const demographicFilterConfig: Array<{
    key: 'genero' | 'rango_etario' | 'pais' | 'provincia' | 'ciudad' | 'barrio';
    label: string;
    placeholder: string;
    options: Array<{ value: string; label: string }>;
  }> = [
    {
      key: 'genero',
      label: 'Género',
      placeholder: 'Todos los géneros',
      options: demographicFilterOptions.genero,
    },
    {
      key: 'rango_etario',
      label: 'Rango etario',
      placeholder: 'Todos los rangos',
      options: demographicFilterOptions.rango_etario,
    },
    {
      key: 'pais',
      label: 'País',
      placeholder: 'Todos los países',
      options: demographicFilterOptions.pais,
    },
    {
      key: 'provincia',
      label: 'Provincia',
      placeholder: 'Todas las provincias',
      options: demographicFilterOptions.provincia,
    },
    {
      key: 'ciudad',
      label: 'Ciudad',
      placeholder: 'Todas las ciudades',
      options: demographicFilterOptions.ciudad,
    },
    {
      key: 'barrio',
      label: 'Barrio',
      placeholder: 'Todos los barrios',
      options: demographicFilterOptions.barrio,
    },
  ];

  const hasDemographicOptions = demographicFilterConfig.some((config) => config.options.length > 0);
  const hasActiveDemographicFilters = Boolean(
    filters.genero ||
      filters.rango_etario ||
      filters.pais ||
      filters.provincia ||
      filters.ciudad ||
      filters.barrio,
  );

  const handleDemographicFilterChange = (
    field: 'genero' | 'rango_etario' | 'pais' | 'provincia' | 'ciudad' | 'barrio',
    value: string,
  ) => {
    const normalizedValue = value === SELECT_ALL ? undefined : value;
    setFilters({
      ...filters,
      [field]: normalizedValue,
    });
  };

  const clearDemographicFilters = () => {
    setFilters({
      ...filters,
      genero: undefined,
      rango_etario: undefined,
      pais: undefined,
      provincia: undefined,
      ciudad: undefined,
      barrio: undefined,
    });
  };

  const handleExport = async () => {
    try {
      const blob = await exportCsv();
      const filename = effectiveSurvey ? `encuesta-${effectiveSurvey.slug}-analytics.csv` : 'encuesta-analytics.csv';
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Exportación lista', description: 'Descargaste la analítica en formato CSV.' });
    } catch (error) {
      toast({ title: 'No pudimos exportar los datos', description: String((error as Error)?.message ?? error), variant: 'destructive' });
    }
  };

  const handleCreateSnapshot = async (payload?: { rango?: string }) => {
    try {
      await create(payload);
      toast({ title: 'Snapshot creado', description: 'Guardamos un corte transparente de resultados.' });
    } catch (error) {
      toast({ title: 'No se pudo crear el snapshot', description: String((error as Error)?.message ?? error), variant: 'destructive' });
    }
  };

  const handlePublishSnapshot = async (snapshotId: number) => {
    try {
      await publish(snapshotId);
      toast({ title: 'Snapshot publicado', description: 'Ahora cualquiera puede auditar este corte.' });
    } catch (error) {
      toast({ title: 'No se pudo publicar el snapshot', description: String((error as Error)?.message ?? error), variant: 'destructive' });
    }
  };

  const handleVerify = async (snapshotId: number, respuestaId: number) => {
    try {
      const result = await verify(snapshotId, respuestaId);
      toast({
        title: 'Verificación realizada',
        description: result.valido
          ? 'La respuesta figura en el snapshot seleccionado.'
          : 'No encontramos esa respuesta en el snapshot.',
      });
      return result;
    } catch (error) {
      toast({ title: 'No se pudo verificar la respuesta', description: String((error as Error)?.message ?? error), variant: 'destructive' });
      throw error;
    }
  };

  const handleSeedDemoResponses = async () => {
    if (!effectiveSurvey) return;
    try {
      const result = await seedSurveyResponses({ survey: effectiveSurvey, count: 100 });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['survey-analytics-summary', effectiveSurvey.id] }),
        queryClient.invalidateQueries({ queryKey: ['survey-analytics-timeseries', effectiveSurvey.id] }),
        queryClient.invalidateQueries({ queryKey: ['survey-analytics-heatmap', effectiveSurvey.id] }),
        queryClient.invalidateQueries({ queryKey: ['survey-responses', effectiveSurvey.id] }),
      ]);

      void refetchResponses();

      const duplicateHint = result.duplicates > 0 ? ` ${result.duplicates} respuestas ya existían y se omitieron.` : '';
      toast({
        title: 'Respuestas demo generadas',
        description:
          result.failures > 0
            ? `Registramos ${result.success} de ${result.total} respuestas. ${result.failures} intentos fallaron.${duplicateHint}`
            : `Registramos ${result.success} respuestas de demostración.${duplicateHint}`,
      });
    } catch (error) {
      toast({
        title: 'No se pudieron generar respuestas demo',
        description: getErrorMessage(error, 'Intentá nuevamente en unos minutos.'),
        variant: 'destructive',
      });
    }
  };

  const forecast = forecastQuery.data;
  const alerts = alertsQuery.data ?? [];
  const brief = briefQuery.data;
  const segmentsCompare = compareQuery.data;
  const anomalies = anomaliesQuery.data;
  const responsesTotalHint = typeof summary?.total_respuestas === 'number' ? summary.total_respuestas : null;
  const backendAlerts = dashboardBundle?.modules?.alerts ?? [];
  const effectiveAlerts = backendAlerts.length ? backendAlerts : alerts;
  const backendBrief = dashboardBundle?.modules?.brief;
  const effectiveBrief = backendBrief ?? brief;
  const executiveKpisEntries = useMemo(() => {
    const source = dashboardBundle?.kpis_executive;
    if (!source || typeof source !== 'object') return [] as Array<{ key: string; value: Record<string, unknown> }>;
    return Object.entries(source).map(([key, value]) => ({ key, value: asRecord(value) ?? {} }));
  }, [dashboardBundle?.kpis_executive]);
  const topAnomalies = useMemo(
    () => (Array.isArray(anomalies?.top_anomalies) && anomalies.top_anomalies.length ? anomalies.top_anomalies : anomalies?.signals ?? []),
    [anomalies?.top_anomalies, anomalies?.signals],
  );
  const operationsPulse = useMemo(
    () => [
      {
        id: 'alerts',
        title: asSafeText(enterpriseUiConfig?.alerts_count_label) || 'Alertas activas',
        value: String(effectiveAlerts.length),
        subtitle: asSafeText(enterpriseUiConfig?.alerts_title) || 'Eventos críticos detectados por reglas',
        icon: <AlertTriangle className="h-4 w-4" />,
        tone: effectiveAlerts.length > 0 ? 'warning' : 'success',
      },
      {
        id: 'confidence',
        title: asSafeText(enterpriseUiConfig?.forecast_confidence_label) || 'Confianza de proyección',
        value: formatMetricMaybe(forecast?.confidence),
        subtitle: asSafeText(enterpriseUiConfig?.forecast_title) || 'Modelo de tendencia de participación',
        icon: <Gauge className="h-4 w-4" />,
        tone: 'default' as const,
      },
      {
        id: 'risk',
        title: asSafeText(enterpriseUiConfig?.risk_score_label) || 'Riesgo operativo',
        value: formatMetricMaybe(anomalies?.risk_score),
        subtitle: asSafeText(enterpriseUiConfig?.data_quality_title) || 'Señales de consistencia y manipulación',
        icon: <ShieldCheck className="h-4 w-4" />,
        tone: toFiniteNumber(anomalies?.risk_score, 0) > 70 ? ('warning' as const) : ('success' as const),
      },
      {
        id: 'activity',
        title: asSafeText(enterpriseUiConfig?.forecast_current_rate_label) || 'Ritmo actual',
        value: formatMetricMaybe(forecast?.current_rate),
        subtitle: asSafeText(enterpriseUiConfig?.brief_title) || 'Pulso de actividad reciente',
        icon: <Activity className="h-4 w-4" />,
        tone: 'default' as const,
      },
    ],
    [
      anomalies?.risk_score,
      effectiveAlerts.length,
      enterpriseUiConfig?.alerts_count_label,
      enterpriseUiConfig?.alerts_title,
      enterpriseUiConfig?.brief_title,
      enterpriseUiConfig?.data_quality_title,
      enterpriseUiConfig?.forecast_confidence_label,
      enterpriseUiConfig?.forecast_current_rate_label,
      enterpriseUiConfig?.forecast_title,
      enterpriseUiConfig?.risk_score_label,
      forecast?.confidence,
      forecast?.current_rate,
    ],
  );


  const segmentDeltaData = useMemo(
    () =>
      (segmentsCompare?.buckets ?? [])
        .map((bucket, index) => {
          const segmentA = toFiniteNumber(bucket.segment_a, 0);
          const segmentB = toFiniteNumber(bucket.segment_b, 0);
          const rawDelta = bucket.delta;
          const delta =
            typeof rawDelta === 'number' && Number.isFinite(rawDelta)
              ? rawDelta
              : segmentA === 0
                ? 0
                : ((segmentB - segmentA) / Math.max(segmentA, 1)) * 100;

          return {
            key: String(bucket.question_id ?? index + 1),
            question: asRenderableText(bucket.question_text) || String(bucket.question_id ?? index + 1),
            delta,
            segmentA,
            segmentB,
          };
        })
        .slice(0, 8),
    [segmentsCompare?.buckets],
  );

  const anomalySignalsData = useMemo(
    () =>
      (topAnomalies ?? [])
        .map((signal, index) => ({
          key: String(signal.id ?? index + 1),
          signal: asRenderableText(signal.type) || String(signal.id ?? index + 1),
          score: toFiniteNumber(signal.score, 0),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 8),
    [topAnomalies],
  );

  const selectedSegmentALabel = useMemo(
    () => segmentSuggestionOptions.find((option) => option.key === segmentAKey)?.label ?? asRenderableText(segmentsCompare?.segment_a_label),
    [segmentSuggestionOptions, segmentAKey, segmentsCompare?.segment_a_label],
  );
  const selectedSegmentBLabel = useMemo(
    () => segmentSuggestionOptions.find((option) => option.key === segmentBKey)?.label ?? asRenderableText(segmentsCompare?.segment_b_label),
    [segmentSuggestionOptions, segmentBKey, segmentsCompare?.segment_b_label],
  );

  const shouldRenderAdvancedVisuals = segmentDeltaData.length > 0 || anomalySignalsData.length > 0;

  if ((isLoadingSurvey && !surveys) || isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!effectiveSurvey) {
    return <p className="text-sm text-destructive">{surveyError || 'No encontramos esta encuesta.'}</p>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Difusión y acceso público</CardTitle>
          <CardDescription>Copiá el enlace, abrí resultados en vivo y compartí el QR desde un contrato público validado.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <Badge variant={isPublicationReady ? 'default' : 'outline'} className="uppercase tracking-wide">
              {publicationStateLabel(publicationState)}
            </Badge>
            {publicSlug ? <Badge variant="secondary">Slug {publicSlug}</Badge> : null}
            {isLiveVote ? <Badge variant="secondary">Votación en vivo</Badge> : null}
            <Badge variant={liveResultsEnabled ? 'default' : 'outline'}>
              {liveResultsEnabled ? 'Realtime encendido' : 'Realtime apagado'}
            </Badge>
            {requiresIdentity ? <Badge variant="outline">Identidad requerida</Badge> : <Badge variant="outline">Anónima permitida</Badge>}
            {publicContractVersion ? <Badge variant="outline">{publicContractVersion}</Badge> : null}
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {rangeLabel}
            </span>
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="space-y-3">
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Enlace público</p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <span className="truncate">
                        {publicUrl || 'Configurá el slug público para generar el enlace compartible.'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={async () => {
                        if (!copyPublicUrl) return;
                        try {
                          await navigator.clipboard.writeText(copyPublicUrl);
                          toast({
                            title: 'Link copiado',
                            description: 'Listo para compartir por WhatsApp, redes o correo.',
                          });
                        } catch (error) {
                          toast({
                            title: 'No se pudo copiar el enlace',
                            description: String((error as Error)?.message ?? error),
                            variant: 'destructive',
                          });
                        }
                      }}
                      className="inline-flex items-center gap-2"
                      disabled={!copyPublicUrl}
                    >
                      <Copy className="h-4 w-4" /> Copiar link
                    </Button>
                    {resolvedWhatsappShareUrl ? (
                      <Button variant="outline" asChild className="inline-flex items-center gap-2">
                        <a href={resolvedWhatsappShareUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4" /> WhatsApp
                        </a>
                      </Button>
                    ) : null}
                    {shouldShowLiveResultsButton && resolvedLiveResultsHref ? (
                      <Button variant="outline" asChild className="inline-flex items-center gap-2">
                        <a href={resolvedLiveResultsHref} target="_blank" rel="noreferrer">
                          <Activity className="h-4 w-4" /> Resultados
                        </a>
                      </Button>
                    ) : null}
                    {qrUrl ? (
                      <Button variant="outline" asChild className="inline-flex items-center gap-2">
                        <a href={qrUrl} download>
                          <Download className="h-4 w-4" /> Descargar QR
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {publicationActionLabel}. Compartí el enlace en WhatsApp, redes sociales o insertalo en tu sitio para maximizar la participación.
              </p>
            </div>
            {qrUrl ? (
              <div className="flex flex-col items-center gap-2">
                <SurveyQrPreview
                  slug={effectiveSurvey.slug}
                  title={effectiveSurvey.titulo}
                  remoteUrl={qrUrl}
                  size={160}
                  imageClassName="bg-white p-4"
                />
                <span className="text-xs text-muted-foreground">Escaneá para probar el recorrido público.</span>
              </div>
            ) : null}
          </div>
      </CardContent>
    </Card>
      {liveResultsEnabled ? (
        <SurveyLiveResultsPanel
          slug={livePanelSlug}
          tenantSlug={effectiveTenantSlug}
          enabled={liveResultsEnabled}
          title="Sala live de la encuesta"
          description="Resultados en vivo dentro del CRM: socket, polling, mapa de calor y lectura IA sin abrir la pagina publica."
        />
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Filtros demográficos y territoriales</CardTitle>
          <CardDescription>Segmentá los tableros por género, edad o ubicación declarada.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasDemographicOptions ? (
            <div className="grid gap-4 md:grid-cols-3">
              {demographicFilterConfig.map((config) => (
                <div key={config.key} className="space-y-2">
                  <Label htmlFor={`analytics-filter-${config.key}`}>{config.label}</Label>
                  <Select
                    value={(filters[config.key] as string | undefined) ?? SELECT_ALL}
                    onValueChange={(value) => handleDemographicFilterChange(config.key, value)}
                    disabled={!config.options.length}
                  >
                    <SelectTrigger id={`analytics-filter-${config.key}`}>
                      <SelectValue placeholder={config.placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SELECT_ALL}>{config.placeholder}</SelectItem>
                      {config.options.map((option) => (
                        <SelectItem key={`${config.key}-${option.value}`} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Los filtros aparecerán automáticamente cuando se registren respuestas con datos demográficos o territoriales.
            </p>
          )}
          {hasActiveDemographicFilters ? (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearDemographicFilters}>
                Limpiar filtros
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {executiveSummary ? (
        <Card>
          <CardHeader>
            <CardTitle>{asRenderableText(executiveSummary.headline)}</CardTitle>
            <CardDescription>{asRenderableText(executiveSummary.one_liner)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.isArray(executiveSummary.focus_points) && executiveSummary.focus_points.length ? (
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {executiveSummary.focus_points.slice(0, 6).map((focusPoint, index) => (
                  <li key={`${index}-${asRenderableText(focusPoint)}`}>{asRenderableText(focusPoint)}</li>
                ))}
              </ul>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border/60 p-3 text-sm">
                <p className="text-muted-foreground">{asSafeText(enterpriseUiConfig?.alerts_count_label) || 'Alertas detectadas'}</p>
                <p className="text-xl font-semibold">{executiveSummary.alert_count ?? effectiveAlerts.length ?? 0}</p>
              </div>
              <div className="rounded-lg border border-border/60 p-3 text-sm">
                <p className="text-muted-foreground">{asSafeText(enterpriseUiConfig?.projected_additional_label) || 'Proyección adicional'}</p>
                <p className="text-xl font-semibold">{executiveSummary.projected_additional ?? '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
      <div className="sticky top-3 z-20 rounded-2xl border border-border/70 bg-background/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold">Centro de acciones de analytics</p>
            <p className="text-xs text-muted-foreground">Exportá, difundí y generá demo sin salir de la vista.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isExporting}
              className="inline-flex items-center gap-2"
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Exportar CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void handleSeedDemoResponses();
              }}
              disabled={isSeeding || !effectiveSurvey.slug}
              className="inline-flex items-center gap-2"
            >
              {isSeeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} 100 demo
            </Button>
            {publicUrl && resolvedPublicHref ? (
              <Button variant="outline" size="sm" asChild className="inline-flex items-center gap-2">
                <a href={resolvedPublicHref} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" /> Pública
                </a>
              </Button>
            ) : null}
            {shouldShowLiveResultsButton && resolvedLiveResultsHref ? (
              <Button variant="outline" size="sm" asChild className="inline-flex items-center gap-2">
                <a href={resolvedLiveResultsHref} target="_blank" rel="noreferrer">
                  <Activity className="h-4 w-4" /> Live
                </a>
              </Button>
            ) : null}
          </div>
        </div>
        {isSeeding && seedProgress ? (
          <div className="mt-3 space-y-2 rounded-md border border-primary/25 bg-primary/5 p-2">
            <div className="flex items-center justify-between text-xs text-primary">
              <span>Generando respuestas demo…</span>
              <span>{seedProgress.processed}/{seedProgress.total}</span>
            </div>
            <Progress
              value={seedProgress.total > 0 ? (seedProgress.processed / seedProgress.total) * 100 : 0}
              className="h-1.5"
            />
            <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
              <span>Éxito: {seedProgress.success}</span>
              <span>Duplicadas: {seedProgress.duplicates}</span>
              <span>Fallidas: {seedProgress.failures}</span>
            </div>
          </div>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Analítica de {effectiveSurvey.titulo}</CardTitle>
              <CardDescription>
                Explorá la evolución de las respuestas, canales de difusión y trazabilidad pública.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {analyticsError && !isLoading ? (
            <p className="mb-4 text-sm text-destructive">
              {analyticsError}
            </p>
          ) : null}
          <SurveyAnalytics
            summary={summary}
            timeseries={timeseries}
            heatmap={heatmap}
            heatmapPayload={heatmapPayload}
            heatmapMeta={heatmapMeta}
            onExport={handleExport}
            isExporting={isExporting}
            filters={filters}
            onFiltersChange={setFilters}
            tenantSlug={effectiveTenantSlug}
            tenantId={typeof effectiveSurvey?.tenant_id === 'number' ? effectiveSurvey.tenant_id : undefined}
            route="/admin/encuestas/:id/analytics"
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Pulso operativo enterprise</CardTitle>
          <CardDescription>Lectura rápida de salud, riesgo y tracción en tiempo real para toma de decisiones.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {operationsPulse.map((item) => (
            <EnterpriseMetricCard
              key={item.id}
              title={item.title}
              value={item.value}
              subtitle={item.subtitle}
              icon={item.icon}
              tone={item.tone}
            />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{asSafeText(enterpriseUiConfig?.command_center_title)}</CardTitle>
          <CardDescription>{asSafeText(enterpriseUiConfig?.command_center_description)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-border/60 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <TrendingUp className="h-4 w-4 text-primary" /> {asSafeText(enterpriseUiConfig?.forecast_title)}
              </div>
              {forecastQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Cargando…</p>
              ) : forecastQuery.error ? (
                <p className="text-sm text-destructive">{getErrorMessage(forecastQuery.error)}</p>
              ) : (
                <div className="space-y-1 text-sm">
                  {renderLabeledMetric(asSafeText(enterpriseUiConfig?.forecast_projected_total_label), forecast?.projected_total ?? '—')}
                  {renderLabeledMetric(asSafeText(enterpriseUiConfig?.forecast_current_rate_label), forecast?.current_rate ?? '—')}
                  {renderLabeledMetric(asSafeText(enterpriseUiConfig?.forecast_confidence_label), forecast?.confidence ?? '—')}
                </div>
              )}
            </div>
            <div className="rounded-lg border border-border/60 p-4 md:col-span-2">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> {asSafeText(enterpriseUiConfig?.alerts_title)}
              </div>
              {alertsQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Cargando…</p>
              ) : alertsQuery.error ? (
                <p className="text-sm text-destructive">{getErrorMessage(alertsQuery.error)}</p>
              ) : effectiveAlerts.length ? (
                <div className="space-y-2">
                  {effectiveAlerts.slice(0, 6).map((alert, index) => (
                    <div key={`${alert.id ?? index}`} className="rounded-md border border-border/60 px-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{asRenderableText(alert.severity) || 'info'}</Badge>
                        <span className="font-medium">{asRenderableText(alert.title)}</span>
                      </div>
                      <p className="text-muted-foreground">{asRenderableText(alert.message)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{asSafeText(enterpriseUiConfig?.alerts_empty_label)}</p>
              )}
            </div>
          </div>
          <div className="rounded-lg border border-border/60 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-primary" /> {asSafeText(enterpriseUiConfig?.brief_title)}
            </div>
            {briefQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            ) : briefQuery.error ? (
              <p className="text-sm text-destructive">{getErrorMessage(briefQuery.error)}</p>
            ) : (
              <div className="space-y-2 text-sm">
                <p>{asRenderableText(effectiveBrief?.summary) || asSafeText(enterpriseUiConfig?.brief_fallback_label)}</p>
                {effectiveBrief?.highlights?.length ? (
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {effectiveBrief.highlights.slice(0, 4).map((item, index) => (
                      <li key={`${index}-${asRenderableText(item)}`}>{asRenderableText(item)}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{asSafeText(enterpriseUiConfig?.territorial_center_title)}</CardTitle>
          <CardDescription>{asSafeText(enterpriseUiConfig?.territorial_center_description)}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          {segmentSuggestionOptions.length ? (
            <div className="lg:col-span-2 grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="segment-a-selector">{asSafeText(enterpriseUiConfig?.segment_selector_a_label)}</Label>
                <Select value={segmentAKey} onValueChange={setSegmentAKey}>
                  <SelectTrigger id="segment-a-selector">
                    <SelectValue placeholder={asSafeText(enterpriseUiConfig?.segment_selector_placeholder)} />
                  </SelectTrigger>
                  <SelectContent>
                    {segmentSuggestionOptions.map((option) => (
                      <SelectItem key={`segment-a-${option.key}`} value={option.key}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="segment-b-selector">{asSafeText(enterpriseUiConfig?.segment_selector_b_label)}</Label>
                <Select value={segmentBKey} onValueChange={setSegmentBKey}>
                  <SelectTrigger id="segment-b-selector">
                    <SelectValue placeholder={asSafeText(enterpriseUiConfig?.segment_selector_placeholder)} />
                  </SelectTrigger>
                  <SelectContent>
                    {segmentSuggestionOptions.map((option) => (
                      <SelectItem key={`segment-b-${option.key}`} value={option.key}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
          <div className="rounded-lg border border-border/60 p-4">
            <p className="mb-2 text-sm font-medium">{asSafeText(enterpriseUiConfig?.segment_comparator_title)}</p>
            {compareQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">{asSafeText(enterpriseUiConfig?.loading_label)}</p>
            ) : compareQuery.error ? (
              <p className="text-sm text-destructive">{getErrorMessage(compareQuery.error)}</p>
            ) : segmentsCompare?.buckets?.length ? (
              <div className="space-y-2">
                {segmentsCompare.buckets.slice(0, 6).map((bucket, index) => (
                  <div key={`${bucket.question_id ?? index}`} className="space-y-1">
                    <p className="text-xs text-muted-foreground">{asRenderableText(bucket.question_text)}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded bg-primary/10 px-2 py-1">{selectedSegmentALabel || asRenderableText(segmentsCompare.segment_a_label)}: {bucket.segment_a ?? 0}</div>
                      <div className="rounded bg-amber-500/10 px-2 py-1">{selectedSegmentBLabel || asRenderableText(segmentsCompare.segment_b_label)}: {bucket.segment_b ?? 0}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{asSafeText(enterpriseUiConfig?.segment_comparator_empty_label)}</p>
            )}
          </div>
          <div className="rounded-lg border border-border/60 p-4">
            <p className="mb-2 text-sm font-medium">{asSafeText(enterpriseUiConfig?.data_quality_title)}</p>
            {anomaliesQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">{asSafeText(enterpriseUiConfig?.loading_label)}</p>
            ) : anomaliesQuery.error ? (
              <p className="text-sm text-destructive">{getErrorMessage(anomaliesQuery.error)}</p>
            ) : (
              <div className="space-y-2 text-sm">
                {renderLabeledMetric(asSafeText(enterpriseUiConfig?.risk_score_label), anomalies?.risk_score ?? '—')}
                {renderLabeledMetric(asSafeText(enterpriseUiConfig?.risk_level_label), anomalies?.risk_level ?? '—')}
                {anomalies?.signals?.length ? (
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {anomalies.signals.slice(0, 6).map((signal, index) => (
                      <li key={`${signal.id ?? index}`}>{asRenderableText(signal.type)}: {asRenderableText(signal.detail)}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">{asSafeText(enterpriseUiConfig?.data_quality_empty_label)}</p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>


      {shouldRenderAdvancedVisuals ? (
        <Card>
          <CardHeader>
            <CardTitle>{asSafeText(enterpriseUiConfig?.intelligence_center_title)}</CardTitle>
            <CardDescription>{asSafeText(enterpriseUiConfig?.intelligence_center_description)}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <div className="min-w-0 rounded-lg border border-border/60 p-4">
              <p className="mb-3 text-sm font-medium">{asSafeText(enterpriseUiConfig?.segment_delta_chart_title)}</p>
              {segmentDeltaData.length ? (
                <div className="h-[280px] min-w-0">
                  <MeasuredContainer minWidth={chartContainerMinWidth} minHeight={chartContainerMinHeight} renderWhenVisible={chartRenderWhenVisible} className="min-w-0">
                    <ResponsiveContainer width="100%" height="100%" minWidth={chartContainerMinWidth} minHeight={chartContainerMinHeight} debounce={120}>
                    <BarChart data={segmentDeltaData} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="question"
                        interval={0}
                        angle={-28}
                        textAnchor="end"
                        tick={{ fontSize: 11 }}
                        height={70}
                      />
                      <YAxis tickFormatter={(value) => `${Math.round(Number(value))}%`} tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value: number) => [asPercentage(toFiniteNumber(value, 0)), asSafeText(enterpriseUiConfig?.segment_delta_label)]}
                        labelFormatter={(label) => `${label}`}
                      />
                      <Bar dataKey="delta" fill="#2563eb" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  </MeasuredContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{asSafeText(enterpriseUiConfig?.segment_delta_chart_empty_label)}</p>
              )}
            </div>
            <div className="min-w-0 rounded-lg border border-border/60 p-4">
              <p className="mb-3 text-sm font-medium">{asSafeText(enterpriseUiConfig?.anomaly_signals_chart_title)}</p>
              {anomalySignalsData.length ? (
                <div className="h-[280px] min-w-0">
                  <MeasuredContainer minWidth={chartContainerMinWidth} minHeight={chartContainerMinHeight} renderWhenVisible={chartRenderWhenVisible} className="min-w-0">
                    <ResponsiveContainer width="100%" height="100%" minWidth={chartContainerMinWidth} minHeight={chartContainerMinHeight} debounce={120}>
                    <BarChart data={anomalySignalsData} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="signal" type="category" width={120} tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value: number) => [toFiniteNumber(value, 0), asSafeText(enterpriseUiConfig?.anomaly_score_label)]}
                        labelFormatter={(label) => `${label}`}
                      />
                      <Bar dataKey="score" fill="#f59e0b" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  </MeasuredContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{asSafeText(enterpriseUiConfig?.anomaly_signals_chart_empty_label)}</p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {hasAdminTemplateContent ? (
        <Card>
          <CardHeader>
            <CardTitle>{asRenderableText(adminTemplate?.title)}</CardTitle>
            <CardDescription>{asRenderableText(adminTemplate?.description)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {adminTemplateTabs.length ? (
              <div className="flex flex-wrap gap-2">
                {adminTemplateTabs.map((tab, index) => (
                  <Badge key={`${asRenderableText(tab.key) || 'tab'}-${index}`} variant="secondary">
                    {asRenderableText(tab.label) || asRenderableText(tab.key)}
                  </Badge>
                ))}
              </div>
            ) : null}

            {adminTemplateStackGroups.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {adminTemplateStackGroups.map((group) => (
                  <motion.div
                    key={group.key}
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.35 }}
                    transition={{ duration: 0.22 }}
                    className="rounded-lg border border-border/60 bg-gradient-to-b from-muted/20 to-background p-3"
                  >
                    {asRenderableText(group.key) ? (
                      <p className="text-xs font-medium uppercase text-muted-foreground">{asRenderableText(group.key)}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {group.libs.map((library, index) => (
                        <Badge key={`${group.key}-${library}-${index}`} variant="outline" className="bg-background/70">
                          {library}
                        </Badge>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : null}

            {adminTemplateDatasets.length ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {adminTemplateDatasets.slice(0, 4).map((dataset, index) => {
                  const items = asRecordList(dataset.items).slice(0, 3);
                  return (
                    <div key={`${asRenderableText(dataset.key) || 'dataset'}-${index}`} className="rounded-lg border border-border/60 p-3">
                      <p className="text-sm font-medium">{asRenderableText(dataset.label) || humanizeMetricKey(asRenderableText(dataset.key)) || asRenderableText(dataset.key)}</p>
                      <p className="text-xs text-muted-foreground">{asRenderableText(dataset.description)}</p>
                      {items.length ? (
                        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                          {items.map((item, itemIndex) => (
                            <p key={`${asRenderableText(dataset.key) || 'dataset'}-item-${itemIndex}`}>
                              {Object.entries(item)
                                .slice(0, 3)
                                .map(([key, value]) => `${humanizeMetricKey(key) || asRenderableText(key)}: ${asRenderableText(value)}`)
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}

            {adminTemplateDecisionCards.length ? (
              <div className="grid gap-3 lg:grid-cols-3">
                {adminTemplateDecisionCards.slice(0, 6).map((card, index) => {
                  const evidence = asStringList(card.evidence).slice(0, 3);
                  const priority = normalizePriority(card.priority);
                  const confidenceRatio = toNormalizedRatio(card.confidence ?? card.score ?? card.priority_score);
                  const impactRatio = toNormalizedRatio(card.impact ?? card.impact_score);
                  const owner = asRenderableText(card.owner);
                  const horizon = asRenderableText(card.horizon);
                  return (
                    <motion.div
                      key={`${asRenderableText(card.key) || 'decision'}-${index}`}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.25 }}
                      transition={{ duration: 0.24, delay: index * 0.03 }}
                      className="rounded-lg border border-border/60 bg-gradient-to-b from-primary/5 to-background p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{asRenderableText(card.title) || humanizeMetricKey(asRenderableText(card.key)) || asRenderableText(card.key)}</p>
                        {priority ? <Badge variant={getPriorityBadgeVariant(priority)}>{priority}</Badge> : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{asRenderableText(card.summary)}</p>
                      <div className="mt-2 space-y-2">
                        {confidenceRatio !== null ? (
                          <div>
                            <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                              <span>Confianza</span>
                              <span>{Math.round(confidenceRatio * 100)}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted">
                              <div className="h-1.5 rounded-full bg-primary" style={{ width: `${Math.round(confidenceRatio * 100)}%` }} />
                            </div>
                          </div>
                        ) : null}
                        {impactRatio !== null ? (
                          <div>
                            <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                              <span>Impacto</span>
                              <span>{Math.round(impactRatio * 100)}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted">
                              <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${Math.round(impactRatio * 100)}%` }} />
                            </div>
                          </div>
                        ) : null}
                      </div>
                      {evidence.length ? (
                        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                          {evidence.map((item, evidenceIndex) => (
                            <li key={`${asRenderableText(card.key) || 'decision'}-evidence-${evidenceIndex}`}>{item}</li>
                          ))}
                        </ul>
                      ) : null}
                      {(owner || horizon) ? (
                        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                          {owner ? <Badge variant="secondary">{owner}</Badge> : null}
                          {horizon ? <Badge variant="outline">{horizon}</Badge> : null}
                        </div>
                      ) : null}
                    </motion.div>
                  );
                })}
              </div>
            ) : null}

            {adminTemplateVisualModules.length ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {adminTemplateVisualModules.slice(0, 6).map((module, index) => {
                  const renderHints = [
                    ...normalizeLibraryList(module.engine),
                    ...normalizeLibraryList(module.provider),
                    ...normalizeLibraryList(module.renderer),
                    ...normalizeLibraryList(module.library),
                    ...normalizeLibraryList(module.libraries),
                  ].filter((value, idx, list) => list.indexOf(value) === idx);

                  return (
                    <motion.div
                      key={`${asRenderableText(module.key) || 'module'}-${index}`}
                      initial={{ opacity: 0, y: 8 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.3 }}
                      transition={{ duration: 0.22, delay: index * 0.02 }}
                      className="rounded-lg border border-border/60 bg-gradient-to-br from-muted/20 via-background to-background p-3 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{asRenderableText(module.title) || humanizeMetricKey(asRenderableText(module.key)) || asRenderableText(module.key)}</p>
                        {asRenderableText(module.type) ? <Badge variant="outline">{asRenderableText(module.type)}</Badge> : null}
                      </div>
                      <p className="mt-1 text-muted-foreground">{asRenderableText(module.description)}</p>
                      <p className="text-muted-foreground">{asRenderableText(module.empty_state)}</p>
                      {renderHints.length ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {renderHints.slice(0, 4).map((hint) => (
                            <Badge key={`${asRenderableText(module.key)}-${hint}`} variant="secondary" className="text-[11px]">
                              {hint}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </motion.div>
                  );
                })}
              </div>
            ) : null}

            {adminTemplateMapLayers.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {adminTemplateMapLayers.map((layer, index) => {
                  const providers = [
                    ...normalizeLibraryList(layer.provider),
                    ...normalizeLibraryList(layer.engine),
                    ...normalizeLibraryList(layer.map_provider),
                  ].filter((value, idx, list) => list.indexOf(value) === idx);

                  return (
                    <div key={`${asRenderableText(layer.key) || 'layer'}-${index}`} className="rounded border border-border/60 bg-background px-3 py-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{asRenderableText(layer.label) || humanizeMetricKey(asRenderableText(layer.key)) || asRenderableText(layer.key)}</p>
                        {asRenderableText(layer.type) ? <Badge variant="outline">{asRenderableText(layer.type)}</Badge> : null}
                      </div>
                      {providers.length ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {providers.slice(0, 3).map((provider) => (
                            <Badge key={`${asRenderableText(layer.key)}-${provider}`} variant="secondary" className="text-[11px]">
                              {provider}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {executiveKpisEntries.length ? (
        <Card>
          <CardHeader>
            <CardTitle>{asSafeText(enterpriseUiConfig?.executive_kpis_title) || 'Indicadores ejecutivos'}</CardTitle>
            <CardDescription>{asSafeText(enterpriseUiConfig?.executive_kpis_description) || 'Indicadores listos para leer la participacion, los resultados y las alertas.'}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {executiveKpisEntries.map((item) => {
              const label = asRenderableText(item.value.label) || humanizeMetricKey(item.key) || item.key;
              const metricValue = readMetricValue(item.value);
              const trend = asRenderableText(item.value.trend);
              const status = asRenderableText(item.value.status);
              const explanation = asRenderableText(item.value.explanation);
              return (
                <div key={item.key} className="rounded-lg border border-border/60 bg-gradient-to-b from-background to-muted/20 p-3 text-sm">
                  <p className="text-muted-foreground">{label}</p>
                  <p className="text-3xl font-semibold tracking-tight">{metricValue}</p>
                  {(trend || status) ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {trend ? <Badge variant="secondary">{trend}</Badge> : null}
                      {status ? <Badge variant="outline">{status}</Badge> : null}
                    </div>
                  ) : null}
                  {explanation ? <p className="mt-2 text-xs text-muted-foreground">{explanation}</p> : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      <SurveyRecentResponses
        responses={responses}
        loading={isLoadingResponses}
        refreshing={isRefreshingResponses}
        error={responsesError}
        onRefresh={() => {
          void refetchResponses();
        }}
        emptyHintUrl={publicUrl}
        totalResponsesHint={responsesTotalHint}
      />
      <Card>
        <CardHeader>
          <CardTitle>Transparencia y auditoría</CardTitle>
          <CardDescription>Gestioná snapshots verificables y permití validar respuestas puntuales.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingSnapshots ? (
            <div className="flex min-h-[20vh] items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (
            <TransparencyTab
              snapshots={snapshots}
              onCreateSnapshot={handleCreateSnapshot}
              onPublishSnapshot={handlePublishSnapshot}
              onVerifyResponse={handleVerify}
              isCreating={isCreating}
              isPublishing={isPublishing}
              isVerifying={isVerifying}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
