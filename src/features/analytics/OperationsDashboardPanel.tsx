import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Brain,
  CheckCircle2,
  DatabaseZap,
  ExternalLink,
  Gauge,
  Layers,
  MapPin,
  Radio,
  RefreshCw,
  Route,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Ticket,
  Users,
  X,
} from 'lucide-react';

import { ViewState } from '@/components/app-shell/ViewState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSocket } from '@/context/SocketContext';
import { useTenant } from '@/context/TenantContext';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/utils/api';
import { operationsTenantSlug, assertOperationsResponseScope, visibleOperationsQuery } from './operationsReadState';
import { useOperationsRefresh } from './useOperationsRefresh';
import { OperationsWorkspaceStatus } from './OperationsWorkspaceStatus';

import {
  getOperationsAIBriefV2,
  getOperationsAIOpsQueueV2,
  getOperationsAIProviderStatusV2,
  getOperationsActionCenterV2,
  getOperationsDashboardV2,
  getOperationsFreshnessV2,
  getOperationsHeatmapV2,
  getPublicMapConfigV1,
} from './analyticsApi';
import { PremiumTerritoryHeatmap } from './PremiumTerritoryMap';
import type {
  OperationsAIOpsQueueItem,
  OperationsAIOpsQueueV1,
  OperationsActionItem,
  OperationsAIBriefV1,
  OperationsAIProviderStatusItem,
  OperationsAIProviderStatusV1,
  OperationsOpenAICapabilityKey,
  OperationsOpenAISuiteReadiness,
  OperationsAlert,
  OperationsBucketItem,
  OperationsDashboardV1,
  OperationsFreshnessSource,
  OperationsFreshnessV1,
  OperationsHeatmapPoint,
  OperationsHeatmapV1,
  OperationsQueueLinkKey,
  PublicMapConfigV1,
} from './analyticsTypes';

const numberFormatter = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });
const OPENAI_PROVIDER_VERIFICATION_MAX_AGE_MS = 168 * 60 * 60 * 1000;
const OPERATIONS_QUERY_TIMEOUT_MS = 9_000;
const OPERATIONS_SECONDARY_QUERY_TIMEOUT_MS = 7_000;

const withOperationsTimeout = async <T,>(
  promise: Promise<T>,
  label: string,
  timeoutMs = OPERATIONS_QUERY_TIMEOUT_MS,
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(label)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const asBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'si'].includes(normalized)) return true;
    if (['false', '0', 'no'].includes(normalized)) return false;
  }
  return undefined;
};

const asString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const formatNumber = (value: unknown, suffix = '') => {
  const parsed = asNumber(value);
  if (parsed === undefined) return '--';
  return `${numberFormatter.format(parsed)}${suffix}`;
};

const formatCurrency = (value: unknown, currency = 'ARS') => {
  const parsed = asNumber(value);
  if (parsed === undefined) return '--';
  const safeCurrency = /^[A-Z]{3}$/.test(currency) ? currency : 'ARS';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: safeCurrency,
    maximumFractionDigits: 0,
  }).format(parsed);
};

const readNumber = (...values: unknown[]) => {
  for (const value of values) {
    const parsed = asNumber(value);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
};

const itemValue = (item: OperationsBucketItem) =>
  readNumber(item.value, item.count, item.total, item.current);

const itemLabel = (item: OperationsBucketItem) =>
  asString(item.label) ?? asString(item.title) ?? asString(item.key) ?? asString(item.id) ?? '--';

const bucketItemKey = (item: OperationsBucketItem, index: number) =>
  [
    asString(item.id),
    asString(item.key),
    asString(item.label),
    asString(item.title),
    asString((item as Record<string, unknown>).categoria),
    asString((item as Record<string, unknown>).category),
    asString((item as Record<string, unknown>).coordinates),
    asString((item as Record<string, unknown>).lat),
    asString((item as Record<string, unknown>).lng),
    String(index),
  ]
    .filter(Boolean)
    .join(':');

const hasItems = (items?: OperationsBucketItem[]) => Array.isArray(items) && items.length > 0;

const mergeByIdentity = <T extends { id?: string; title?: string; reason_code?: string }>(items: T[]) => {
  const seen = new Set<string>();
  return items.filter((item, index) => {
    const identity = item.id || item.reason_code || item.title || String(index);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
};

const priorityVariant = (priority?: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  const normalized = (priority || '').toLowerCase();
  if (normalized === 'high' || normalized === 'critical' || normalized === 'breached') return 'destructive';
  if (normalized === 'medium' || normalized === 'warning') return 'secondary';
  return 'outline';
};

const statusVariant = (status?: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'fresh' || normalized === 'ready') return 'default';
  if (normalized === 'degraded' || normalized === 'stale') return 'secondary';
  if (normalized === 'empty' || normalized === 'error') return 'destructive';
  return 'outline';
};

const statusLabel = (status?: string) => {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'fresh' || normalized === 'ready') return 'al día';
  if (normalized === 'degraded' || normalized === 'stale') return 'requiere revisión';
  if (normalized === 'empty') return 'sin actividad';
  if (normalized === 'error') return 'con error';
  return status || 'sin estado';
};

const operationsDashboardErrorMessage = (error: unknown): string => {
  const message = getErrorMessage(error, 'El resumen ejecutivo tardo mas de lo esperado.');
  if (/operations_dashboard_timeout|timeout|timed out/i.test(message)) {
    return 'El resumen ejecutivo tardo mas de lo esperado';
  }
  if (/html|json|proxy|aplicacion web|frontend/i.test(message)) {
    return 'El backend operativo no entrego datos completos en este intento';
  }
  return message;
};

const priorityLabel = (priority?: string) => {
  const normalized = (priority || '').toLowerCase();
  if (normalized === 'critical') return 'crítico';
  if (normalized === 'high') return 'alta';
  if (normalized === 'medium' || normalized === 'warning') return 'media';
  if (normalized === 'low') return 'baja';
  return priority || 'prioridad';
};

const resolveLabel = (data: OperationsDashboardV1 | undefined, key: string, fallback: string) => {
  const labels = data?.frontend_contract?.labels;
  const backendLabel = labels && typeof labels[key] === 'string' ? labels[key].trim() : '';
  return backendLabel || fallback;
};

const getRefreshSeconds = (...values: Array<number | undefined>) => {
  const candidates = values.filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0,
  );
  if (!candidates.length) return undefined;
  return Math.min(...candidates);
};

type OperationsFocusCard = {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'default' | 'warning' | 'success';
};

const focusCardToneClass: Record<OperationsFocusCard['tone'], string> = {
  default: 'border-primary/20 bg-primary/5 text-primary',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
};

type HeatmapFilterKey = 'categoria' | 'rango_edad' | 'genero' | 'canal' | 'source' | 'barrio' | 'estado' | 'distrito';
type HeatmapQueryKey = HeatmapFilterKey | 'range' | 'scope' | 'days';
type HeatmapFilterState = Partial<Record<HeatmapQueryKey, string>>;
type OperationsPeriodState = Partial<Record<'range' | 'scope' | 'days', string>>;

type HeatmapFilterConfig = {
  key: HeatmapFilterKey;
  queryParam: keyof HeatmapFilterState;
  labelKey: string;
  fallbackLabel: string;
  pointFields: string[];
};

type HeatmapFilterOption = {
  value: string;
  label: string;
  count?: number;
};

const HEATMAP_FILTERS: HeatmapFilterConfig[] = [
  {
    key: 'categoria',
    queryParam: 'categoria',
    labelKey: 'filter_categoria',
    fallbackLabel: 'Categoría',
    pointFields: ['categoria', 'category'],
  },
  {
    key: 'rango_edad',
    queryParam: 'rango_edad',
    labelKey: 'filter_rango_edad',
    fallbackLabel: 'Edad',
    pointFields: ['rango_edad', 'age_range', 'ageRange', 'edad', 'age'],
  },
  {
    key: 'genero',
    queryParam: 'genero',
    labelKey: 'filter_genero',
    fallbackLabel: 'Género',
    pointFields: ['genero', 'gender', 'sexo'],
  },
  {
    key: 'canal',
    queryParam: 'canal',
    labelKey: 'filter_canal',
    fallbackLabel: 'Canal',
    pointFields: ['canal', 'channel'],
  },
  {
    key: 'source',
    queryParam: 'source',
    labelKey: 'filter_source',
    fallbackLabel: 'Fuente',
    pointFields: ['source', 'type', 'layer'],
  },
  {
    key: 'barrio',
    queryParam: 'barrio',
    labelKey: 'filter_zone',
    fallbackLabel: 'Zona declarada',
    pointFields: ['zone', 'zona', 'barrio', 'neighborhood', 'distrito', 'district'],
  },
  {
    key: 'distrito',
    queryParam: 'distrito',
    labelKey: 'filter_distrito',
    fallbackLabel: 'Distrito',
    pointFields: ['distrito', 'district'],
  },
  {
    key: 'estado',
    queryParam: 'estado',
    labelKey: 'filter_estado',
    fallbackLabel: 'Estado',
    pointFields: ['estado', 'status'],
  },
];

const HEATMAP_FILTER_ALIASES: Record<string, HeatmapFilterKey> = {
  category: 'categoria',
  categories: 'categoria',
  categoria: 'categoria',
  categorias: 'categoria',
  age: 'rango_edad',
  edad: 'rango_edad',
  age_range: 'rango_edad',
  agerange: 'rango_edad',
  rango_edad: 'rango_edad',
  gender: 'genero',
  genero: 'genero',
  sexo: 'genero',
  channel: 'canal',
  canal: 'canal',
  source: 'source',
  fuente: 'source',
  layer: 'source',
  type: 'source',
  barrio: 'barrio',
  neighborhood: 'barrio',
  zone: 'barrio',
  zones: 'barrio',
  zona: 'barrio',
  zonas: 'barrio',
  distrito: 'distrito',
  district: 'distrito',
  status: 'estado',
  estado: 'estado',
};

const TERRITORY_HEATMAP_FILTER_KEYS = new Set<HeatmapFilterKey>(['barrio', 'distrito']);
const TERRITORY_PLACEHOLDER_VALUES = new Set([
  'desconocida',
  'desconocido',
  'n_a',
  'na',
  'no_asignada',
  'no_asignado',
  'no_informada',
  'no_informado',
  'not_provided',
  'null',
  'sin_asignar',
  'sin_asignacion',
  'sin_barrio',
  'sin_dato',
  'sin_datos',
  'sin_distrito',
  'sin_informacion',
  'sin_sector',
  'sin_zona',
  'unassigned',
  'undefined',
  'unknown',
  'unknown_zone',
]);

const normalizeTerritoryFilterValue = (value: unknown) =>
  asString(value)
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const isNamedTerritoryFilterValue = (value: unknown) => {
  const normalized = normalizeTerritoryFilterValue(value);
  return Boolean(normalized && !TERRITORY_PLACEHOLDER_VALUES.has(normalized));
};

const normalizeHeatmapFilterKey = (value: unknown): HeatmapFilterKey | null => {
  const normalized = asString(value)?.toLowerCase().replace(/[\s-]+/g, '_');
  if (!normalized) return null;
  return HEATMAP_FILTER_ALIASES[normalized] ?? null;
};

const readItemOptionValue = (item: OperationsBucketItem): string | undefined =>
  asString(item.value) ??
  asString(item.key) ??
  asString(item.id) ??
  asString(item.label) ??
  asString(item.title) ??
  asString(item.name);

const readPointField = (point: OperationsHeatmapPoint, config: HeatmapFilterConfig): string | undefined => {
  for (const field of config.pointFields) {
    const value = (point as Record<string, unknown>)[field];
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    const parsed = asString(value);
    if (parsed) return parsed;
  }
  return undefined;
};

const heatmapDisplayLabel = (value: unknown, fallback?: unknown): string => {
  const parsed = asString(value) ?? asString(fallback) ?? '';
  const normalized = parsed.toLowerCase().replace(/[\s-]+/g, '_');
  if (['unknown', 'sin_dato', 'sin_datos', 'no_informado', 'no_informada', 'null', 'undefined'].includes(normalized)) {
    return 'Sin dato';
  }
  return parsed || 'Sin dato';
};

const humanizeHeatmapToken = (value: unknown, fallback = 'Capa') => {
  const parsed = asString(value);
  if (!parsed) return fallback;
  return parsed
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
};

const describeHeatmapLayer = (layer: string) => {
  const normalized = layer.toLowerCase();
  if (normalized.includes('ai') || normalized.includes('risk') || normalized.includes('riesgo')) {
    return 'riesgo y prioridad IA';
  }
  if (normalized.includes('whatsapp') || normalized.includes('chat')) {
    return 'actividad conversacional';
  }
  if (normalized.includes('survey') || normalized.includes('encuesta') || normalized.includes('vote')) {
    return 'participación y voto';
  }
  if (normalized.includes('geo') || normalized.includes('base') || normalized.includes('heat')) {
    return 'base territorial';
  }
  if (normalized.includes('ticket') || normalized.includes('reclamo')) {
    return 'reclamos y casos';
  }
  return 'capa operativa';
};

const formatEndpoint = (action?: OperationsActionItem) =>
  asString(action?.endpoint) ?? asString(action?.endpoint_template);

const actionHref = (action?: OperationsActionItem) =>
  asString(action?.href) ?? asString(action?.frontend_path) ?? asString(action?.route);

const isExternalHref = (href: string) => /^https?:\/\//i.test(href);

const appendInternalQueryParam = (href: string, key: string, value: string) => {
  if (!href || isExternalHref(href)) return href;
  const [withoutHash, hash = ''] = href.split('#');
  const [path, query = ''] = withoutHash.split('?');
  const params = new URLSearchParams(query);
  if (!params.has(key)) {
    params.set(key, value);
  }
  const nextQuery = params.toString();
  return `${path}${nextQuery ? `?${nextQuery}` : ''}${hash ? `#${hash}` : ''}`;
};

const inferAiOpsSurveyFocus = (item: OperationsAIOpsQueueItem): 'live' | 'comments' | null => {
  const source = `${item.source ?? ''} ${item.source_model ?? ''}`.toLowerCase();
  if (!source.includes('survey') && !source.includes('encuesta') && !source.includes('vote')) {
    return null;
  }

  const action = item.recommended_action;
  const signals = item.signals ?? {};
  const haystack = [
    item.id,
    item.title,
    item.priority,
    action?.id,
    action?.label,
    action?.title,
    action?.endpoint,
    action?.href,
    action?.route,
    action?.ui_hint,
    ...((item.reason_codes ?? []) as string[]),
    ...Object.keys(signals),
    ...Object.values(signals).map((value) => String(value ?? '')),
  ]
    .join(' ')
    .toLowerCase();

  if (haystack.includes('comment') || haystack.includes('comentario') || haystack.includes('debate')) {
    return 'comments';
  }
  if (
    haystack.includes('live') ||
    haystack.includes('votacion') ||
    haystack.includes('votación') ||
    haystack.includes('vote') ||
    haystack.includes('realtime') ||
    haystack.includes('resultado')
  ) {
    return 'live';
  }

  return null;
};

const aiOpsActionHref = (item: OperationsAIOpsQueueItem) => {
  const href = actionHref(item.recommended_action);
  const focus = inferAiOpsSurveyFocus(item);
  if (!href || !focus || isExternalHref(href) || !href.startsWith('/admin/encuestas')) {
    return href;
  }
  return appendInternalQueryParam(href, 'focus', focus);
};

const cleanHeatmapFilters = (filters: HeatmapFilterState): HeatmapFilterState =>
  Object.fromEntries(
    Object.entries(filters)
      .map(([key, value]) => [key, asString(value)] as const)
      .filter(
        ([key, value]) =>
          Boolean(value) &&
          (!TERRITORY_HEATMAP_FILTER_KEYS.has(key as HeatmapFilterKey) || isNamedTerritoryFilterValue(value)),
      ),
  ) as HeatmapFilterState;

const DEFAULT_HEATMAP_FILTERS: HeatmapFilterState = {
  days: '7',
};

const OPERATIONS_DASHBOARD_FALLBACK: OperationsDashboardV1 = {
  contract_version: 'operations.dashboard.v1',
  summary: {},
  trends: { items: [] },
  tickets: { summary: {} },
  surveys: { summary: {} },
  chats: { summary: {} },
  commerce: {
    summary: {},
    by_state: [],
    by_origin: [],
    by_source_model: [],
    by_request_kind: [],
    totals_by_currency: [],
    review_items: [],
  },
  live_chat: { summary: {}, items: [] },
  employees: { summary: {}, items: [], coverage: { uncovered_categories: [], uncovered_channels: [] } },
  maps: { heatmap: { hotspots: [], points: [] } },
  alerts: [],
  next_best_actions: [],
  frontend_contract: {
    render_as: 'degraded_operations_dashboard',
    empty_state_behavior: 'keep_operational_modules_visible',
  },
};

const HEATMAP_PERIOD_KEYS = new Set<HeatmapQueryKey>(['range', 'scope', 'days']);
const OPERATIONS_REALTIME_FALLBACK_EVENTS = [
  'ticket.updated',
  'ticket_update',
  'ticket.status.changed',
  'ticket.assignment.changed',
  'survey.vote.created',
  'survey_update_v2',
  'whatsapp.message.created',
  'new_chat_message',
  'analytics.event.created',
] as const;

const keepHeatmapPeriodFilters = (filters: HeatmapFilterState): OperationsPeriodState => {
  const next = Object.fromEntries(
    Object.entries(filters).filter(([key]) => HEATMAP_PERIOD_KEYS.has(key as HeatmapQueryKey)),
  ) as HeatmapFilterState;
  return Object.keys(next).length ? next : DEFAULT_HEATMAP_FILTERS;
};

interface OperationsDashboardPanelProps {
  className?: string;
}

export function OperationsDashboardPanel({ className }: OperationsDashboardPanelProps) {
  const { currentSlug } = useTenant();
  const tenantSlug = operationsTenantSlug(currentSlug);
  if (!tenantSlug) return <ViewState status="empty" title="Seleccioná una organización" description="El centro de decisiones necesita un contexto de organización confirmado." className={className} />;
  return <ScopedOperationsDashboard key={tenantSlug} tenantSlug={tenantSlug} className={className} />;
}
function ScopedOperationsDashboard({ tenantSlug, className }: OperationsDashboardPanelProps & { tenantSlug: string }) {
  const { socket, isConnected: socketConnected } = useSocket();
  const [heatmapFilters, setHeatmapFilters] = useState<HeatmapFilterState>(DEFAULT_HEATMAP_FILTERS);
  const activeHeatmapFilters = useMemo(() => cleanHeatmapFilters(heatmapFilters), [heatmapFilters]);
  const activeOperationsPeriod = useMemo(
    () => keepHeatmapPeriodFilters(activeHeatmapFilters),
    [activeHeatmapFilters],
  );

  const dashboardQuery = visibleOperationsQuery(useQuery({
    queryKey: ['v2-operations-dashboard', tenantSlug, activeOperationsPeriod],
    queryFn: () => withOperationsTimeout(
      getOperationsDashboardV2({ tenantSlug, ...activeOperationsPeriod }).then((response) => assertOperationsResponseScope(response, tenantSlug)),
      'operations_dashboard_timeout',
    ),
    retry: 0,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  }));

  const heatmapQuery = visibleOperationsQuery(useQuery({
    queryKey: ['v2-operations-heatmap', tenantSlug, activeHeatmapFilters],
    queryFn: () => withOperationsTimeout(
      getOperationsHeatmapV2({ tenantSlug, include_ai: 0, ...activeHeatmapFilters }).then((response) => assertOperationsResponseScope(response, tenantSlug)),
      'operations_heatmap_timeout',
      OPERATIONS_SECONDARY_QUERY_TIMEOUT_MS,
    ),
    retry: 0,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  }));

  const mapConfigQuery = visibleOperationsQuery(useQuery({
    queryKey: ['public-map-config-v1', tenantSlug],
    queryFn: () => withOperationsTimeout(
      getPublicMapConfigV1({ tenantSlug }).then((response) => assertOperationsResponseScope(response, tenantSlug)),
      'public_map_config_timeout',
      OPERATIONS_SECONDARY_QUERY_TIMEOUT_MS,
    ),
    retry: 0,
    refetchOnWindowFocus: false,
    staleTime: 10 * 60_000,
  }));

  const actionCenterQuery = visibleOperationsQuery(useQuery({
    queryKey: ['v2-operations-action-center', tenantSlug, activeOperationsPeriod],
    queryFn: () => withOperationsTimeout(
      getOperationsActionCenterV2({ tenantSlug, ...activeOperationsPeriod }).then((response) => assertOperationsResponseScope(response, tenantSlug)),
      'operations_action_center_timeout',
      OPERATIONS_SECONDARY_QUERY_TIMEOUT_MS,
    ),
    retry: 0,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  }));
  const aiBriefQuery = visibleOperationsQuery(useQuery({
    queryKey: ['v2-operations-ai-brief', tenantSlug, activeOperationsPeriod],
    queryFn: () => withOperationsTimeout(
      getOperationsAIBriefV2({ tenantSlug, ...activeOperationsPeriod }).then((response) => assertOperationsResponseScope(response, tenantSlug)),
      'operations_ai_brief_timeout',
      OPERATIONS_SECONDARY_QUERY_TIMEOUT_MS,
    ),
    retry: 0,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  }));
  const aiOpsQueueQuery = visibleOperationsQuery(useQuery({
    queryKey: ['v2-operations-ai-ops-queue', tenantSlug, activeOperationsPeriod],
    queryFn: () => withOperationsTimeout(
      getOperationsAIOpsQueueV2({ tenantSlug, limit: 12, ...activeOperationsPeriod }).then((response) => assertOperationsResponseScope(response, tenantSlug)),
      'operations_ai_ops_queue_timeout',
      OPERATIONS_SECONDARY_QUERY_TIMEOUT_MS,
    ),
    retry: 0,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  }));
  const aiProviderStatusQuery = visibleOperationsQuery(useQuery({
    queryKey: ['v2-operations-ai-provider-status', tenantSlug],
    queryFn: () => withOperationsTimeout(
      getOperationsAIProviderStatusV2({ tenantSlug }).then((response) => assertOperationsResponseScope(response, tenantSlug)),
      'operations_ai_provider_status_timeout',
      OPERATIONS_SECONDARY_QUERY_TIMEOUT_MS,
    ),
    retry: 0,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  }));
  const freshnessQuery = visibleOperationsQuery(useQuery({
    queryKey: ['v2-operations-freshness', tenantSlug, activeOperationsPeriod],
    queryFn: () => withOperationsTimeout(
      getOperationsFreshnessV2({ tenantSlug, ...activeOperationsPeriod }).then((response) => assertOperationsResponseScope(response, tenantSlug)),
      'operations_freshness_timeout',
      OPERATIONS_SECONDARY_QUERY_TIMEOUT_MS,
    ),
    retry: 0,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  }));
  const refetchDashboard = dashboardQuery.refetch;
  const refetchHeatmap = heatmapQuery.refetch;
  const refetchActionCenter = actionCenterQuery.refetch;
  const refetchAIBrief = aiBriefQuery.refetch;
  const refetchAIOpsQueue = aiOpsQueueQuery.refetch;
  const refetchAIProviderStatus = aiProviderStatusQuery.refetch;
  const refetchFreshness = freshnessQuery.refetch;

  const refreshSeconds = getRefreshSeconds(
    heatmapQuery.data?.realtime?.poll_seconds,
    dashboardQuery.data?.frontend_contract?.primary_refresh_seconds,
    actionCenterQuery.data?.frontend_contract?.primary_refresh_seconds,
    aiBriefQuery.data?.frontend_contract?.primary_refresh_seconds,
    aiOpsQueueQuery.data?.frontend_contract?.primary_refresh_seconds,
    aiProviderStatusQuery.data?.frontend_contract?.primary_refresh_seconds,
    freshnessQuery.data?.frontend_contract?.primary_refresh_seconds,
  );

  const realtimeEvents = useMemo(() => Array.from(new Set([
    ...(heatmapQuery.data?.realtime?.socket_events ?? []), ...OPERATIONS_REALTIME_FALLBACK_EVENTS,
  ])), [heatmapQuery.data?.realtime?.socket_events]);
  const liveRefresh = useOperationsRefresh({
    tenantSlug, scopeKey: JSON.stringify([tenantSlug, activeHeatmapFilters]),
    pollSeconds: refreshSeconds, socket, connected: Boolean(socketConnected), eventNames: realtimeEvents,
    run: async (mode) => {
      const options = { cancelRefetch: false };
      const reads: Promise<unknown>[] = [refetchDashboard(options), refetchHeatmap(options), refetchActionCenter(options), refetchFreshness(options)];
      if (mode === 'all') {
        reads.push(refetchAIBrief(options), refetchAIOpsQueue(options), refetchAIProviderStatus(options));
        if (mapConfigQuery.isError) reads.push(mapConfigQuery.refetch(options));
      }
      await Promise.allSettled(reads);
    },
  });

  const dashboardData = dashboardQuery.data;
  const dashboardFallbackActive = dashboardQuery.isError && !dashboardData;
  const dashboardErrorMessage = dashboardFallbackActive
    ? operationsDashboardErrorMessage(dashboardQuery.error)
    : undefined;
  const data = dashboardData ?? OPERATIONS_DASHBOARD_FALLBACK;
  const actionCenter = actionCenterQuery.data;
  const aiBrief = aiBriefQuery.data ?? (data?.ai_brief as OperationsAIBriefV1 | undefined);
  const aiOpsQueue = aiOpsQueueQuery.data;
  const aiProviderStatus = aiProviderStatusQuery.data;
  const freshness = freshnessQuery.data;
  const alerts = useMemo(
    () => mergeByIdentity([...(data?.alerts ?? []), ...(actionCenter?.alerts ?? [])]),
    [actionCenter?.alerts, data?.alerts],
  );
  const actions = useMemo(
    () => mergeByIdentity([...(data?.next_best_actions ?? []), ...(actionCenter?.items ?? [])]),
    [actionCenter?.items, data?.next_best_actions],
  );
  const heatmapContractCanRender = heatmapQuery.data?.render_contract?.can_render_heatmap;
  const heatmapQualityCanRender = heatmapQuery.data?.quality?.can_render_heatmap;
  const canRenderHeatmap =
    heatmapContractCanRender === false || heatmapQualityCanRender === false || freshness?.summary?.can_render_heatmap === false
      ? false
      : heatmapContractCanRender ?? heatmapQualityCanRender ?? freshness?.summary?.can_render_heatmap;
  const canRenderDashboard = freshness?.summary?.can_render_dashboard;
  const readSources = [
    { id: 'dashboard', label: 'Resumen y reclamos', ...dashboardQuery },
    { id: 'heatmap', label: 'Mapa de calor', ...heatmapQuery },
    { id: 'mapConfig', label: 'Configuración del mapa', ...mapConfigQuery },
    { id: 'actions', label: 'Centro de acciones', ...actionCenterQuery },
    { id: 'brief', label: 'Resumen IA', ...aiBriefQuery },
    { id: 'queue', label: 'Cola IA', ...aiOpsQueueQuery },
    { id: 'providers', label: 'Integraciones IA', ...aiProviderStatusQuery },
    { id: 'freshness', label: 'Actualidad de fuentes', ...freshnessQuery },
  ];
  const mapFilterCount = Object.keys(activeHeatmapFilters).filter((key) => !HEATMAP_PERIOD_KEYS.has(key as HeatmapQueryKey)).length;
  const anyFetching = readSources.some((source) => source.isFetching);
  const focusCards: OperationsFocusCard[] = [
    {
      id: 'health',
      title: dashboardFallbackActive ? 'continuidad activa' : freshness?.status ? statusLabel(freshness.status) : 'datos cargados',
      description: dashboardFallbackActive
        ? 'El tablero mantiene mapa, IA, acciones y reclamos disponibles mientras se refresca el resumen.'
        : 'Estado general de las fuentes que alimentan el tablero.',
      icon: Gauge,
      tone: dashboardFallbackActive ? 'warning' : freshness?.status === 'fresh' || freshness?.status === 'ready' ? 'success' : 'default',
    },
    {
      id: 'actions',
      title: actions.length ? `${actions.length} acciones sugeridas` : dashboardData || actionCenter ? 'sin acciones publicadas' : 'acciones no verificadas',
      description: actions.length ? 'Revisar primero el centro de acciones.' : dashboardData || actionCenter ? 'Las fuentes recibidas no publican acciones.' : 'Revisá el estado de las fuentes antes de tomar decisiones.',
      icon: CheckCircle2,
      tone: actions.length || (!dashboardData && !actionCenter) ? 'warning' : 'default',
    },
    {
      id: 'territory',
      title: heatmapQuery.isError ? 'mapa no verificado' : canRenderHeatmap === false ? 'mapa sin datos' : heatmapQuery.data ? 'mapa disponible' : 'mapa pendiente',
      description: 'Zonas calientes y segmentos territoriales cuando backend publica puntos.',
      icon: MapPin,
      tone: canRenderHeatmap === false ? 'warning' : 'default',
    },
  ];

  if (dashboardQuery.isLoading && !dashboardData) {
    return <ViewState status="loading" description="Cargando actividad operativa." className={className} />;
  }

  if (dashboardQuery.isError && !data) {
    return (
      <ViewState
        status="partial"
        title="Estadísticas no disponibles"
        description={getErrorMessage(dashboardQuery.error, 'No se pudo cargar la actividad operativa.')}
        action={
          <Button type="button" variant="outline" onClick={() => void dashboardQuery.refetch()}>
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </Button>
        }
        className={className}
      />
    );
  }

  if (!data) {
    return <ViewState status="empty" description="Todavía no hay datos operativos para mostrar." className={className} />;
  }

  return (
    <section className={cn('operations-live-workspace space-y-5', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tablero operativo</p>
          </div>
          <h2 className="text-xl font-semibold tracking-tight">Actividad y decisiones</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Reclamos, encuestas, canales, equipo, mapa y acciones recomendadas para resolver primero.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {refreshSeconds ? <Badge variant="outline">Actualización cada {refreshSeconds}s</Badge> : null}
          {dashboardFallbackActive ? <Badge variant="secondary">Continuidad operativa</Badge> : null}
          {dashboardQuery.isFetching || heatmapQuery.isFetching || actionCenterQuery.isFetching || aiBriefQuery.isFetching || aiOpsQueueQuery.isFetching || aiProviderStatusQuery.isFetching || freshnessQuery.isFetching ? (
            <Badge variant="secondary">Actualizando</Badge>
          ) : null}
          {freshness?.status ? <Badge variant={statusVariant(freshness.status)}>{statusLabel(freshness.status)}</Badge> : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="operations-global-refresh"
            disabled={anyFetching || liveRefresh.busy}
            onClick={liveRefresh.refreshNow}
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
        </div>
      </div>

      <OperationsWorkspaceStatus tenantSlug={tenantSlug} sources={readSources} paused={liveRefresh.paused} mapFilterCount={mapFilterCount} labels={data.frontend_contract?.labels} />
      {freshness ? <FreshnessBanner freshness={freshness} /> : null}
      {aiBrief ? <AIBriefBanner brief={aiBrief} /> : null}
      {dashboardFallbackActive ? (
        <div
          data-testid="operations-dashboard-degraded"
          className="flex flex-col gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 shadow-sm dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold">Tablero en continuidad operativa</p>
              <p className="mt-1 text-amber-900/80 dark:text-amber-100/80">
                {dashboardErrorMessage}. Mantenemos accesibles mapa de calor, cola IA, acciones y reclamos para no cortar la operacion.
              </p>
            </div>
          </div>
          <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={() => void dashboardQuery.refetch()}>
            <RefreshCw className="h-4 w-4" />
            Refrescar resumen
          </Button>
        </div>
      ) : null}

      <div id="operations-overview">
      <OperationsCommandCockpit
        data={data}
        heatmap={heatmapQuery.data}
        freshness={freshness}
        aiOpsQueue={aiOpsQueue}
        canRenderHeatmap={canRenderHeatmap}
        actionsCount={actions.length}
        alertsCount={alerts.length}
      />

      <QueueTruthPanel data={data} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {focusCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.id} className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border', focusCardToneClass[card.tone])}>
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Prioridad</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{card.title}</p>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">{card.description}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {canRenderDashboard === false ? (
        <ViewState
          status="partial"
          title="Datos operativos no disponibles"
          description="No hay datos suficientes para dibujar esta vista en el periodo seleccionado."
          className="min-h-[140px]"
        />
      ) : null}

      {alerts.length ? <AlertsStrip alerts={alerts} /> : null}

      <KpiGrid data={data} heatmap={heatmapQuery.data} alertsCount={alerts.length} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="space-y-5">
          <TrendsPanel data={data} />
          <div id="operations-tickets"><TicketBreakdowns data={data} /></div>
          <div id="operations-engagement"><EngagementPanel data={data} /></div>
          <div id="operations-team"><EmployeePanel data={data} /></div>
          <OperationsHeatmapPanel
            heatmap={heatmapQuery.data}
            freshness={freshness}
            loading={heatmapQuery.isLoading}
            error={heatmapQuery.error}
            canRenderHeatmap={canRenderHeatmap}
            filters={activeHeatmapFilters}
            onFiltersChange={setHeatmapFilters}
            mapConfig={mapConfigQuery.data}
            refetch={() => void refetchHeatmap()}
          />
        </div>
        <div className="space-y-5">
          <AIOpsQueuePanel
            queue={aiOpsQueue}
            loading={aiOpsQueueQuery.isLoading}
            error={aiOpsQueueQuery.error}
            refetch={() => void refetchAIOpsQueue()}
          />
          <CommerceOpsPanel data={data} />
          <AIProviderStatusPanel
            status={aiProviderStatus}
            loading={aiProviderStatusQuery.isLoading}
            error={aiProviderStatusQuery.error}
            refetch={() => void refetchAIProviderStatus()}
          />
          <div id="operations-actions">
          <ActionCenterPanel
            items={actions}
            summary={actionCenter?.summary}
            loading={actionCenterQuery.isLoading}
            error={actionCenterQuery.error}
            refetch={() => void refetchActionCenter()}
          />
          </div>
          <HotspotsPanel data={data} heatmap={heatmapQuery.data} mapFiltered={mapFilterCount > 0} />
        </div>
      </div>
    </section>
  );
}

function QueueTruthPanel({ data }: { data: OperationsDashboardV1 }) {
  const truth = data.queue_truth;
  const snapshot = truth?.queue_snapshot;
  if (!truth || !snapshot) return null;

  const summary = snapshot.summary ?? {};
  const sla = snapshot.sla ?? {};
  const ownership = snapshot.ownership ?? {};
  const links = snapshot.links ?? {};
  const linkContract = snapshot.link_contract;
  const linkNotice = asString(linkContract?.notice);
  const membershipQuality = truth.membership_quality;
  const futureCreatedAtExcluded = readNumber(membershipQuality?.future_created_at?.excluded_records) ?? 0;
  const nullCreatedAtIncluded = readNumber(membershipQuality?.null_created_at?.included_records) ?? 0;
  const isExactQueueLink = (key: OperationsQueueLinkKey) => {
    const metadata = linkContract?.[key];
    return metadata?.exact_filter === true && metadata.semantics === 'exact_filter';
  };
  const periodFlow = truth.period_flow?.summary ?? {};
  const openTotal = readNumber(summary.open_total) ?? 0;
  const breached = readNumber(sla.breached, summary.sla_breached) ?? 0;
  const atRisk = readNumber(sla.at_risk, summary.sla_at_risk) ?? 0;
  const eligible = readNumber(sla.eligible, truth.coverage?.sla?.eligible) ?? 0;
  const known = readNumber(sla.known, truth.coverage?.sla?.known) ?? 0;
  const unknown = readNumber(sla.unknown, truth.coverage?.sla?.unknown) ?? 0;
  const unassigned = readNumber(ownership.unassigned, summary.unassigned) ?? 0;
  const assignmentRate = readNumber(ownership.assignment_rate_pct);
  const atRiskWindowSeconds = readNumber(sla.at_risk_window_seconds);
  const atRiskWindowHours = atRiskWindowSeconds === undefined ? undefined : atRiskWindowSeconds / 3600;
  const asOf = asString(snapshot.as_of) ?? asString(truth.as_of);
  const parsedAsOf = asOf ? new Date(asOf) : null;
  const asOfLabel = parsedAsOf && !Number.isNaN(parsedAsOf.getTime())
    ? parsedAsOf.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
    : 'corte no informado';
  const ageBuckets = snapshot.age_buckets ?? [];

  const cards: Array<{
    key: string;
    linkKey: OperationsQueueLinkKey;
    label: string;
    value: number;
    detail: string;
    href?: string;
  }> = [
    {
      key: 'open',
      linkKey: 'open',
      label: 'Backlog abierto',
      value: openTotal,
      detail: 'Casos abiertos elegibles al corte; fechas futuras quedan en cuarentena.',
      href: links.open,
    },
    {
      key: 'breached',
      linkKey: 'sla_breached',
      label: 'SLA vencido',
      value: breached,
      detail: `${breached}/${known} casos con SLA conocido`,
      href: links.sla_breached,
    },
    {
      key: 'risk',
      linkKey: 'sla_at_risk',
      label: 'SLA en riesgo',
      value: atRisk,
      detail: atRiskWindowHours === undefined
        ? 'Ventana preventiva no informada'
        : `Ventana preventiva de ${formatNumber(atRiskWindowHours)} h`,
      href: links.sla_at_risk,
    },
    {
      key: 'ownership',
      linkKey: 'unassigned',
      label: 'Sin responsable',
      value: unassigned,
      detail: assignmentRate === undefined ? 'Cobertura de asignación no disponible' : `${formatNumber(assignmentRate, '%')} asignado`,
      href: links.unassigned,
    },
  ];

  return (
    <Card data-testid="operations-queue-truth" className="overflow-hidden border-primary/15 shadow-sm">
      <CardHeader className="gap-3 border-b bg-muted/20 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg">Cola operativa actual</CardTitle>
              <Badge variant="outline">corte operativo</Badge>
              <Badge variant="secondary">{asOfLabel}</Badge>
            </div>
            <CardDescription className="mt-1">
              Stock vigente separado del flujo creado durante el período seleccionado.
            </CardDescription>
          </div>
          <Badge variant={unknown > 0 ? 'secondary' : 'outline'}>
            SLA conocido {known}/{eligible}
          </Badge>
        </div>
        {unknown > 0 ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              {formatNumber(unknown)} casos no tienen evidencia SLA verificable. Se muestran como desconocidos y no como saludables.
            </p>
          </div>
        ) : null}
        {futureCreatedAtExcluded > 0 || nullCreatedAtIncluded > 0 ? (
          <div
            role="note"
            className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              {futureCreatedAtExcluded > 0 ? (
                <p>
                  {formatNumber(futureCreatedAtExcluded)} {futureCreatedAtExcluded === 1 ? 'caso' : 'casos'} con fecha futura
                  {futureCreatedAtExcluded === 1 ? ' fue excluido' : ' fueron excluidos'} de la cola y
                  {futureCreatedAtExcluded === 1 ? ' quedo' : ' quedaron'} en cuarentena de calidad.
                </p>
              ) : null}
              {nullCreatedAtIncluded > 0 ? (
                <p>
                  {formatNumber(nullCreatedAtIncluded)} {nullCreatedAtIncluded === 1 ? 'caso' : 'casos'} sin fecha de creacion
                  {nullCreatedAtIncluded === 1 ? ' sigue visible' : ' siguen visibles'} con antiguedad desconocida.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
        {linkNotice ? (
          <div
            role="note"
            className="flex items-start gap-2 rounded-lg border border-border/70 bg-background/70 px-3 py-2 text-sm text-muted-foreground"
          >
            <Route className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{linkNotice}</p>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => {
            const exactHref = card.href && isExactQueueLink(card.linkKey) ? card.href : undefined;
            const body = (
              <div className={cn(
                'rounded-lg border bg-background p-3',
                exactHref && 'transition-colors hover:border-primary/30',
              )}>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{card.label}</p>
                <p className="mt-1 text-2xl font-semibold">{formatNumber(card.value)}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{card.detail}</p>
              </div>
            );
            return exactHref ? <Link key={card.key} to={exactHref}>{body}</Link> : <div key={card.key}>{body}</div>;
          })}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.35fr)]">
          <div>
            <p className="text-sm font-semibold">Antigüedad del backlog</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ageBuckets.map((bucket, index) => {
                const href = asString(bucket.href);
                const exactHref = href
                  && bucket.exact_filter === true
                  && bucket.link_semantics === 'exact_filter'
                  ? href
                  : undefined;
                const label = `${itemLabel(bucket)} · ${formatNumber(itemValue(bucket))}`;
                return exactHref ? (
                  <Link key={bucketItemKey(bucket, index)} to={exactHref}>
                    <Badge variant="outline" className="cursor-pointer">{label}</Badge>
                  </Link>
                ) : (
                  <Badge key={bucketItemKey(bucket, index)} variant="outline">{label}</Badge>
                );
              })}
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
            <p className="font-semibold">Flujo del período</p>
            <p className="mt-1 text-muted-foreground">
              {formatNumber(periodFlow.created_total)} creados · {formatNumber(periodFlow.currently_open)} siguen abiertos.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">No se mezcla con el backlog actual.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OperationsCommandCockpit({
  data,
  heatmap,
  freshness,
  aiOpsQueue,
  canRenderHeatmap,
  actionsCount,
  alertsCount,
}: {
  data: OperationsDashboardV1;
  heatmap?: OperationsHeatmapV1;
  freshness?: OperationsFreshnessV1;
  aiOpsQueue?: OperationsAIOpsQueueV1;
  canRenderHeatmap?: boolean;
  actionsCount: number;
  alertsCount: number;
}) {
  const ticketsSummary = data.tickets?.summary ?? {};
  const queueSnapshot = data.queue_truth?.queue_snapshot;
  const queueSummary = queueSnapshot?.summary ?? {};
  const queueSla = queueSnapshot?.sla ?? {};
  const queueLinks = queueSnapshot?.links ?? {};
  const surveysSummary = data.surveys?.summary ?? {};
  const commerceSummary = data.commerce?.summary ?? {};
  const openTickets = readNumber(queueSummary.open_total, data.summary.open_tickets, ticketsSummary.open_tickets, ticketsSummary.open, ticketsSummary.abiertos);
  const overdueTickets = readNumber(queueSla.breached, queueSummary.sla_breached, data.summary.overdue_tickets, ticketsSummary.overdue_tickets, ticketsSummary.overdue, ticketsSummary.vencidos);
  const slaKnown = readNumber(queueSla.known);
  const slaUnknown = readNumber(queueSla.unknown, queueSummary.sla_unknown);
  const surveyResponses = readNumber(data.summary.survey_responses, surveysSummary.responses, surveysSummary.respuestas);
  const liveVotes = readNumber(data.summary.live_votes, surveysSummary.votaciones_live, surveysSummary.live_votes);
  const assistedOrders = readNumber(data.summary.assisted_orders, commerceSummary.assisted_orders);
  const ordersNeedingReview = readNumber(data.summary.orders_needing_review, commerceSummary.orders_needing_review);
  const unmatchedItems = readNumber(data.summary.unmatched_order_items, commerceSummary.unmatched_items);
  const heatmapSummary = heatmap?.summary ?? {};
  const coverageRaw = readNumber(
    heatmap?.quality?.coverage_percent,
    heatmapSummary.coverage_percent,
    heatmapSummary.coordinate_coverage_pct,
    heatmap?.quality?.coverage_rate,
  );
  const coveragePercent = coverageRaw !== undefined && coverageRaw <= 1 ? coverageRaw * 100 : coverageRaw;
  const mapPoints = readNumber(
    heatmap?.quality?.visible_points,
    heatmapSummary.points,
    heatmap?.points.length,
    data.summary.map_points,
    data.summary.geo_points,
  );
  const pendingGeocode = readNumber(
    heatmap?.quality?.pending_geocode,
    heatmapSummary.pending_geocode,
    heatmap?.geocoding?.candidate_count,
    data.summary.pending_geocode,
  );
  const aiSummary = aiOpsQueue?.summary ?? {};
  const aiTotal = readNumber(aiSummary.total) ?? aiOpsQueue?.items?.length ?? 0;
  const aiHigh = readNumber(aiSummary.high) ?? 0;
  const dataStatus = freshness?.status ? statusLabel(freshness.status) : 'datos operativos';
  const canMapRender = canRenderHeatmap !== false;
  const ticketDetail = queueSnapshot
    ? slaUnknown
      ? `${formatNumber(overdueTickets ?? 0)} vencidos confirmados · ${formatNumber(slaUnknown)} sin SLA verificable`
      : slaKnown !== undefined
        ? `${formatNumber(overdueTickets ?? 0)}/${formatNumber(slaKnown)} vencidos con SLA conocido`
        : 'Cobertura SLA no informada'
    : overdueTickets
      ? `${formatNumber(overdueTickets)} vencidos o en riesgo`
      : 'Cobertura SLA de backlog no publicada';

  const cards = [
    {
      key: 'tickets',
      eyebrow: 'Resolucion',
      title: 'Reclamos abiertos',
      value: formatNumber(openTickets),
      detail: ticketDetail,
      icon: Ticket,
      tone: !queueSnapshot || overdueTickets || slaUnknown ? 'warning' : 'success',
      href: queueLinks.open || '/perfil?tab=tickets',
      action: 'Abrir bandeja de reclamos',
    },
    {
      key: 'commerce',
      eyebrow: 'Marketplace',
      title: 'Pedidos asistidos',
      value: formatNumber(assistedOrders),
      detail: ordersNeedingReview
        ? `${formatNumber(ordersNeedingReview)} a revisar · ${formatNumber(unmatchedItems)} items sin resolver`
        : 'Notas, fotos y PDFs listos para operar',
      icon: ShoppingCart,
      tone: ordersNeedingReview ? 'warning' : 'success',
      href: '/perfil?tab=orders&focus=assisted',
      action: 'Abrir pedidos asistidos',
    },
    {
      key: 'heatmap',
      eyebrow: 'Territorio',
      title: 'Mapa de calor',
      value: coveragePercent !== undefined ? `${formatNumber(coveragePercent, '%')}` : formatNumber(mapPoints),
      detail: canMapRender
        ? `${formatNumber(mapPoints)} puntos visibles · ${formatNumber(pendingGeocode)} por geocodificar`
        : 'Backend marcó el mapa como no renderizable',
      icon: MapPin,
      tone: canMapRender ? 'default' : 'warning',
      href: '#operations-heatmap',
      action: 'Ver mapa de calor',
    },
    {
      key: 'ai',
      eyebrow: 'IA operativa',
      title: aiOpsQueue?.agent_display_name || 'Cola IA',
      value: formatNumber(aiTotal),
      detail: aiHigh ? `${formatNumber(aiHigh)} prioridad alta · solo lectura` : 'Priorizacion sin mutar estados',
      icon: Sparkles,
      tone: aiHigh ? 'warning' : 'success',
      href: '#operations-ai-queue',
      action: 'Revisar cola IA',
    },
    {
      key: 'surveys',
      eyebrow: 'Participacion',
      title: 'Encuestas y votos',
      value: formatNumber(surveyResponses),
      detail: liveVotes ? `${formatNumber(liveVotes)} votaciones en vivo` : 'Sin votaciones live publicadas',
      icon: Activity,
      tone: liveVotes ? 'default' : 'neutral',
      href: '/perfil?tab=analytics&focus=surveys',
      action: 'Ver encuestas',
    },
  ] as const;

  return (
    <div
      data-testid="operations-command-cockpit"
      className="overflow-hidden rounded-2xl border border-primary/15 bg-[linear-gradient(135deg,hsl(var(--card)),hsl(var(--card)),hsl(var(--primary)/0.08))] shadow-sm"
    >
      <div className="flex flex-col gap-3 border-b border-border/60 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cabina de mando</p>
          <h3 className="mt-1 text-xl font-semibold tracking-tight">Vista ejecutiva para operar ahora</h3>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Reclamos, mapa, IA y participación unidos en una sola lectura. Cada bloque abre el módulo donde se resuelve.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={freshness?.status ? statusVariant(freshness.status) : 'outline'}>{dataStatus}</Badge>
          {actionsCount ? <Badge variant="secondary">{formatNumber(actionsCount)} acciones</Badge> : null}
          {alertsCount ? <Badge variant="destructive">{formatNumber(alertsCount)} alertas</Badge> : null}
        </div>
      </div>
      <div className="grid gap-0 md:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon;
          const toneClass =
            card.tone === 'warning'
              ? 'text-amber-600 bg-amber-500/10 border-amber-500/25 dark:text-amber-300'
              : card.tone === 'success'
                ? 'text-emerald-600 bg-emerald-500/10 border-emerald-500/25 dark:text-emerald-300'
                : card.tone === 'neutral'
                  ? 'text-muted-foreground bg-muted/50 border-border'
                  : 'text-primary bg-primary/10 border-primary/20';
          return (
            <div key={card.key} className="border-t border-border/60 p-4 md:[&:nth-child(2n)]:border-l xl:border-l xl:first:border-l-0 xl:border-t-0">
              <div className="flex items-start justify-between gap-3">
                <span className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border', toneClass)}>
                  <Icon className="h-5 w-5" />
                </span>
                {card.href.startsWith('#') ? (
                  <a href={card.href} className="text-xs font-semibold text-primary underline-offset-4 hover:underline">
                    {card.action}
                  </a>
                ) : (
                  <Link to={card.href} className="text-xs font-semibold text-primary underline-offset-4 hover:underline">
                    {card.action}
                  </Link>
                )}
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{card.eyebrow}</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{card.title}</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">{card.value}</p>
              <p className="mt-1 min-h-[2.25rem] text-sm leading-5 text-muted-foreground">{card.detail}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const aiOpsSourceLabel = (source?: string) => {
  const normalized = (source || '').toLowerCase();
  if (normalized === 'ticket') return 'Reclamo';
  if (normalized === 'order') return 'Pedido';
  if (normalized === 'survey') return 'Encuesta';
  return source || 'Operación';
};

const aiOpsReasonLabel = (reason: string) =>
  reason
    .replace(/_/g, ' ')
    .replace(/\bsla\b/i, 'SLA')
    .replace(/\bia\b/i, 'IA');

const providerLabel = (provider?: string) => {
  const normalized = (provider || '').toLowerCase();
  if (normalized === 'openai') return 'OpenAI';
  if (normalized === 'gemini') return 'Gemini';
  if (normalized === 'huggingface') return 'Hugging Face';
  if (normalized === 'ollama') return 'Ollama';
  if (normalized === 'cohere') return 'Cohere';
  if (normalized === 'docling') return 'Docling';
  return provider || 'Proveedor';
};

const providerRuntimeLabel = (provider: OperationsAIProviderStatusItem) => {
  const normalized = (provider.runtime_status || '').toLowerCase();
  if (normalized === 'live_verified') return 'verificado en vivo';
  if (normalized === 'configured_unverified') return 'configurado, sin verificar';
  if (normalized === 'not_configured') return 'sin configurar';
  if (provider.runtime_status) return provider.runtime_status.replace(/_/g, ' ');
  if (provider.configured || provider.installed || provider.enabled) return 'configurado';
  return 'sin configurar';
};

const providerReadinessLabel = (status: string) => {
  if (status === 'ready') return 'configuración disponible';
  if (status === 'warning') return 'revisión operativa';
  if (status === 'blocked') return 'bloqueado';
  if (status === 'loading') return 'leyendo configuración';
  return 'estado no verificado';
};

const openAICapabilityLabels: Record<OperationsOpenAICapabilityKey, string> = {
  chat_responses: 'Chat / Responses',
  vision: 'Visión',
  stt: 'Audio a texto (STT)',
  tts: 'Texto a voz (TTS)',
  realtime_voice: 'Realtime / llamadas',
};

const openAIReasonLabels: Record<string, string> = {
  openai_api_key_missing: 'Falta la credencial de OpenAI',
  openai_sdk_missing: 'Falta el SDK de OpenAI en el runtime',
  openai_not_in_provider_order: 'OpenAI no está habilitado en el orden de proveedores',
  websocket_client_missing: 'Falta el cliente WebSocket',
  flask_sock_missing: 'Falta el servidor WebSocket',
  twilio_request_auth_missing: 'Falta autenticar los webhooks de Twilio',
  voice_stream_signing_missing: 'Falta la firma segura de Media Streams',
  voice_stream_replay_store_missing: 'Falta Redis compartido para impedir replays',
  capability_live_verification_missing: 'Falta una prueba controlada de esta modalidad',
};

const openAICapabilityStatusLabel = (status: string) => {
  if (status === 'live_verified') return 'verificado en vivo';
  if (status === 'unverified') return 'configurado · sin verificar';
  return 'bloqueado';
};

const formatVerificationTimestamp = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (
    Number.isNaN(parsed.getTime())
    || parsed.getTime() > Date.now() + 5 * 60 * 1000
    || parsed.getTime() < Date.now() - OPENAI_PROVIDER_VERIFICATION_MAX_AGE_MS
  ) return null;
  return parsed.toISOString().replace('T', ' ').replace('.000Z', ' UTC');
};

function OpenAISuiteReadinessPanel({
  suite,
  configurationScope,
}: {
  suite: OperationsOpenAISuiteReadiness;
  configurationScope?: string;
}) {
  const providerEvidenceAt = formatVerificationTimestamp(suite.provider_verification.live_verified_at);
  const providerVerified = suite.provider_verification.live_verified && Boolean(providerEvidenceAt);
  const capabilityEntries = Object.entries(suite.capabilities) as Array<[
    OperationsOpenAICapabilityKey,
    OperationsOpenAISuiteReadiness['capabilities'][OperationsOpenAICapabilityKey],
  ]>;

  return (
    <section
      aria-labelledby="openai-suite-readiness-title"
      data-testid="openai-suite-readiness"
      className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.04] p-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p id="openai-suite-readiness-title" className="text-sm font-semibold text-foreground">Suite OpenAI</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Configuración y evidencia se informan por separado. Una credencial presente no prueba que una modalidad funcione.
          </p>
          {configurationScope === 'platform_runtime' ? (
            <p className="mt-1 text-xs font-medium text-cyan-800 dark:text-cyan-200">
              Configuración compartida de la plataforma Chatboc; no es una credencial ni integración propia de este tenant. La vista sí respeta sus permisos tenant.
            </p>
          ) : null}
        </div>
        <Badge variant={suite.status === 'blocked' ? 'destructive' : 'secondary'}>
          {suite.status === 'partially_verified'
            ? 'verificación parcial'
            : suite.status === 'unverified'
              ? 'sin verificar'
              : suite.status === 'live_verified'
                ? 'verificado en vivo'
                : 'bloqueado'}
        </Badge>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-border/70 bg-background/75 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Credencial</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {suite.key_configured ? 'Configurada' : 'No configurada'}
          </p>
          <code className="mt-1 block text-[11px] text-muted-foreground">OPENAI_API_KEY</code>
        </div>
        <div className="rounded-lg border border-border/70 bg-background/75 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Evidencia del proveedor</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {providerVerified ? 'Conectividad verificada' : 'Sin verificación fechada'}
          </p>
          {providerVerified ? (
            <time dateTime={suite.provider_verification.live_verified_at ?? undefined} className="mt-1 block text-[11px] text-muted-foreground">
              {providerEvidenceAt}
            </time>
          ) : (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Registrar un smoke controlado en OPENAI_PROVIDER_LIVE_VERIFIED y OPENAI_PROVIDER_LIVE_VERIFIED_AT.
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        {capabilityEntries.map(([key, capability]) => {
          const primaryReason = capability.reason_codes.find((reason) => reason !== 'capability_live_verification_missing');
          return (
            <div key={key} data-testid={`openai-capability-${key}`} className="rounded-lg border border-border/70 bg-background/75 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{openAICapabilityLabels[key]}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {capability.status === 'unverified'
                      ? 'Runtime configurado; falta una prueba controlada y específica.'
                      : capability.status === 'live_verified'
                        ? 'Prueba específica registrada con fecha.'
                        : openAIReasonLabels[primaryReason || ''] || 'Configuración incompleta.'}
                  </p>
                </div>
                <Badge variant={capability.status === 'blocked' ? 'destructive' : capability.status === 'live_verified' ? 'default' : 'outline'}>
                  {openAICapabilityStatusLabel(capability.status)}
                </Badge>
              </div>
              {capability.status === 'blocked' && capability.configuration_env.length ? (
                <p className="mt-2 break-words text-[11px] text-muted-foreground">
                  Revisar: {capability.configuration_env.join(' · ')}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AIProviderStatusPanel({
  status,
  loading,
  error,
  refetch,
}: {
  status?: OperationsAIProviderStatusV1;
  loading?: boolean;
  error?: unknown;
  refetch: () => void;
}) {
  const readiness = status?.readiness;
  const providerEntries = Object.entries(status?.providers ?? {});
  const orderedProviderEntries = [
    ...(status?.llm_provider_order ?? [])
      .map((key) => providerEntries.find(([providerKey]) => providerKey === key))
      .filter((entry): entry is [string, OperationsAIProviderStatusItem] => Boolean(entry)),
    ...providerEntries.filter(([key]) => !(status?.llm_provider_order ?? []).includes(key)),
  ];
  const configuredProviders = providerEntries.filter(([, provider]) => provider.configured || provider.enabled || provider.installed).length;
  const advisoryOnly = asBoolean(status?.frontend_contract?.advisory_only) !== false;
  const warnings = readiness?.warnings ?? [];
  const selectedProvider = asString(status?.model_policy?.selected_provider);
  const primaryProvider = asString(status?.model_policy?.primary_provider);
  const fallbackProvider = providerEntries.find(([, provider]) => provider.fallback_behavior)?.[1];
  const statusText = readiness?.status || (error ? 'error' : loading ? 'loading' : 'unknown');

  return (
    <Card
      id="operations-ai-provider-status"
      data-testid="operations-ai-provider-status"
      className="overflow-hidden border-cyan-500/20 bg-gradient-to-br from-card via-card to-cyan-500/5"
    >
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4 text-cyan-500" />
              IA operacional
            </CardTitle>
            <CardDescription>
              Estado seguro de proveedores para analytics, mapas, reclamos y automatizacion.
            </CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={refetch} disabled={loading} className="h-8 shrink-0">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={statusVariant(statusText)}>
            {error ? 'Estado IA no disponible' : providerReadinessLabel(statusText)}
          </Badge>
          <Badge variant={readiness?.chat_ready ? 'default' : 'outline'}>
            {readiness?.chat_ready
              ? 'chat verificado'
              : readiness?.chat_runtime_configured
                ? 'chat configurado · sin verificar'
                : 'chat sin runtime'}
          </Badge>
          <Badge variant={readiness?.specialized_ai_ready ? 'default' : 'outline'}>
            {readiness?.specialized_ai_ready
              ? 'IA especializada verificada'
              : readiness?.specialized_ai_runtime_configured
                ? 'IA especializada · sin verificar'
                : 'IA especializada no configurada'}
          </Badge>
          {advisoryOnly ? <Badge variant="secondary">solo lectura</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">
            No pudimos leer el estado de proveedores. El tablero sigue operando con datos y fallback seguro.
          </div>
        ) : null}

        {!status && !error ? (
          <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground">
            {loading ? 'Verificando proveedores IA...' : 'Sin estado IA publicado todavia.'}
          </div>
        ) : null}

        {status ? (
          <>
            {status.openai_suite ? (
              <OpenAISuiteReadinessPanel
                suite={status.openai_suite}
                configurationScope={asString(status.frontend_contract?.configuration_scope)}
              />
            ) : (
              <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-950 dark:text-amber-100">
                El backend todavía no publica readiness por modalidad para OpenAI. Estado no verificado.
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-border/70 bg-background/70 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Proveedor</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{providerLabel(primaryProvider || selectedProvider || status.llm_provider_order[0])}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-background/70 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Modo</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{providerLabel(selectedProvider) || statusText}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-background/70 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Configurados</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{configuredProviders} proveedores</p>
              </div>
            </div>

            {fallbackProvider?.fallback_behavior ? (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-900 dark:text-emerald-100">
                Fallback local seguro: {String(fallbackProvider.fallback_behavior).replace(/_/g, ' ')}.
              </div>
            ) : null}

            {warnings.length ? (
              <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3">
                <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">Atencion operativa</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {warnings.slice(0, 4).map((warning) => (
                    <span key={warning} className="rounded-full bg-background/80 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {aiOpsReasonLabel(warning)}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="grid gap-2">
              {orderedProviderEntries.slice(0, 6).map(([key, provider]) => (
                <div key={key} className="flex items-start justify-between gap-3 rounded-lg border border-border/70 bg-background/70 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{providerLabel(key)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{providerRuntimeLabel(provider)}</p>
                    {provider.last_failure?.reason_code ? (
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                        {aiOpsReasonLabel(provider.last_failure.reason_code)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                    {provider.live_verified ? <Badge variant="default">verificado</Badge> : provider.configured || provider.enabled || provider.installed ? <Badge variant="outline">configurado</Badge> : <Badge variant="outline">pendiente</Badge>}
                    {provider.quota_depleted ? <Badge variant="destructive">cuota</Badge> : null}
                    {provider.provider_order_enabled ? <Badge variant="secondary">orden</Badge> : null}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

const commerceSourceLabel = (item: OperationsBucketItem) => {
  const raw = asString(item.label) ?? asString(item.key) ?? '';
  const labels: Record<string, string> = {
    PedidoConversacional: 'Pedidos asistidos',
    MarketOrder: 'Marketplace',
    PymePedido: 'WhatsApp y pedidos historicos',
    Order: 'Widget y checkout',
  };
  return labels[raw] ?? raw.replace(/([a-z])([A-Z])/g, '$1 $2');
};

function CommerceOpsPanel({ data }: { data: OperationsDashboardV1 }) {
  const commerce = data.commerce;
  const summary = commerce?.summary ?? {};
  const totalOrders = readNumber(summary.orders);
  const assistedOrders = readNumber(data.summary.assisted_orders, summary.assisted_orders);
  const reviewCount = readNumber(data.summary.orders_needing_review, summary.orders_needing_review);
  const unmatchedItems = readNumber(data.summary.unmatched_order_items, summary.unmatched_items);
  const sourceRecords = readNumber(summary.source_records, totalOrders);
  const deduplicatedMirrors = readNumber(summary.deduplicated_mirrors, 0);
  const totalMonetary = readNumber(summary.total_monetary);
  const currency = asString(summary.currency) ?? 'ARS';
  const currencyCount = readNumber(summary.currencies, 0) ?? 0;
  const reviewItems = commerce?.review_items ?? [];
  const origins = commerce?.by_origin ?? [];
  const sourceModels = commerce?.by_source_model ?? [];
  const requestKinds = commerce?.by_request_kind ?? [];
  const currencyTotals = commerce?.totals_by_currency ?? [];
  const hasSignal =
    (totalOrders ?? 0) > 0 ||
    (assistedOrders ?? 0) > 0 ||
    (reviewCount ?? 0) > 0 ||
    reviewItems.length > 0 ||
    origins.length > 0 ||
    sourceModels.length > 0;

  return (
    <Card id="operations-commerce" data-testid="operations-commerce" className="overflow-hidden border-primary/15 bg-gradient-to-br from-card via-card to-emerald-500/5">
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="h-4 w-4 text-primary" />
              Pedidos y ventas
            </CardTitle>
            <CardDescription>
              Pipeline unificado de WhatsApp, widget, marketplace e integraciones, con cola asistida y deduplicacion.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {deduplicatedMirrors ? (
              <Badge variant="outline">
                {formatNumber(deduplicatedMirrors)} {deduplicatedMirrors === 1 ? 'espejo unificado' : 'espejos unificados'}
              </Badge>
            ) : null}
            <Badge variant={reviewCount ? 'secondary' : 'outline'}>
              {reviewCount ? `${formatNumber(reviewCount)} a revisar` : 'sin cola critica'}
            </Badge>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border/70 bg-background/70 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Pedidos</p>
            <p className="mt-1 text-lg font-semibold">{formatNumber(totalOrders)}</p>
            <p className="text-[11px] text-muted-foreground">{formatNumber(sourceRecords)} registros fuente</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/70 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Ventas</p>
            <p className="mt-1 text-lg font-semibold">
              {currencyCount > 1 ? `${formatNumber(currencyCount)} monedas` : formatCurrency(totalMonetary, currency)}
            </p>
            <p className="text-[11px] text-muted-foreground">importe del periodo</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/70 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Asistidos</p>
            <p className="mt-1 text-lg font-semibold">{formatNumber(assistedOrders)}</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/70 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">A revisar</p>
            <p className="mt-1 text-lg font-semibold">{formatNumber(reviewCount)}</p>
            <p className="text-[11px] text-muted-foreground">{formatNumber(unmatchedItems)} items sin resolver</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!hasSignal ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3">
            <p className="text-sm font-semibold text-foreground">Sin pedidos ni ventas en este periodo</p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              Los pedidos de WhatsApp, widget, marketplace e integraciones aparecen aca con estado, origen y trazabilidad.
            </p>
          </div>
        ) : null}

        {reviewItems.length ? (
          <div className="space-y-2">
            {reviewItems.slice(0, 4).map((item, index) => {
              const href = asString(item.frontend_path) ?? asString(item.href) ?? asString(item.route);
              const title = asString(item.title) ?? asString(item.label) ?? `Pedido asistido ${index + 1}`;
              return (
                <div key={item.id || title} className="rounded-lg border border-border/70 bg-background/70 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant={priorityVariant(asString(item.priority))}>{priorityLabel(asString(item.priority))}</Badge>
                        {item.origin ? <Badge variant="outline">{String(item.origin)}</Badge> : null}
                      </div>
                      <p className="mt-2 text-sm font-semibold leading-5 text-foreground">{title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatNumber(item.detected)} detectados · {formatNumber(item.matched)} resueltos · {formatNumber(item.unmatched)} sin resolver
                      </p>
                    </div>
                    {href ? (
                      <Button asChild size="sm" variant="secondary" className="h-8 shrink-0 px-3">
                        {isExternalHref(href) ? (
                          <a href={href} target="_blank" rel="noreferrer">
                            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                            Revisar
                          </a>
                        ) : (
                          <Link to={href}>
                            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                            Revisar
                          </Link>
                        )}
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {origins.length || requestKinds.length || sourceModels.length ? (
          <div className="grid gap-2 text-xs">
            <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
              <p className="font-semibold uppercase tracking-[0.14em] text-muted-foreground">Origen</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {origins.slice(0, 4).map((item, index) => (
                  <Badge key={bucketItemKey(item, index)} variant="outline">
                    {itemLabel(item)} {formatNumber(itemValue(item))}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
              <p className="font-semibold uppercase tracking-[0.14em] text-muted-foreground">Tipo</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {requestKinds.slice(0, 4).map((item, index) => (
                  <Badge key={bucketItemKey(item, index)} variant="outline">
                    {itemLabel(item)} {formatNumber(itemValue(item))}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
              <p className="font-semibold uppercase tracking-[0.14em] text-muted-foreground">Fuentes</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {sourceModels.slice(0, 4).map((item, index) => (
                  <Badge key={bucketItemKey(item, index)} variant="outline">
                    {commerceSourceLabel(item)} {formatNumber(itemValue(item))}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {currencyTotals.length > 1 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-background/70 p-3 text-xs">
            <span className="font-semibold uppercase tracking-[0.14em] text-muted-foreground">Ventas por moneda</span>
            {currencyTotals.slice(0, 4).map((item, index) => {
              const itemCurrency = asString(item.currency) ?? asString(item.key) ?? 'ARS';
              return (
                <Badge key={bucketItemKey(item, index)} variant="secondary">
                  {formatCurrency(item.amount, itemCurrency)} · {formatNumber(item.count)} pedidos
                </Badge>
              );
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AIOpsQueuePanel({
  queue,
  loading,
  error,
  refetch,
}: {
  queue?: OperationsAIOpsQueueV1;
  loading?: boolean;
  error?: unknown;
  refetch: () => void;
}) {
  const items = queue?.items ?? [];
  const summary = queue?.summary ?? {};
  const policy = queue?.advisory_policy ?? {};
  const enabled = queue?.enabled !== false;
  const total = readNumber(summary.total) ?? items.length;
  const high = readNumber(summary.high) ?? 0;
  const agentName = queue?.agent_display_name || 'Valeria IA-Analytics';
  const advisoryOnly = policy.advisory_only !== false && policy.mutates_operational_state !== true;

  return (
    <Card id="operations-ai-queue" data-testid="operations-ai-queue" className="overflow-hidden border-primary/15 bg-gradient-to-br from-card via-card to-primary/5">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Cola IA operativa
            </CardTitle>
            <CardDescription>
              Priorizacion de reclamos, pedidos y encuestas para operar primero.
            </CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={refetch} disabled={loading} className="h-8 shrink-0">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={enabled ? 'default' : 'outline'}>
            {enabled ? `${formatNumber(total)} items` : 'feature apagado'}
          </Badge>
          {high ? <Badge variant="destructive">{formatNumber(high)} alta</Badge> : null}
          {advisoryOnly ? <Badge variant="secondary">solo lectura</Badge> : null}
          <Badge variant="outline">{agentName}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <div className="rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
            No se pudo cargar la cola IA. El tablero principal sigue disponible.
          </div>
        ) : null}

        {!enabled ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3">
            <p className="text-sm font-semibold text-foreground">Listo para activar por flag</p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              El backend ya publica el contrato; cuando se habilite, esta bandeja muestra prioridades reales sin cambiar estados automáticamente.
            </p>
          </div>
        ) : null}

        {enabled && !items.length && !error ? (
          <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
            <p className="text-sm font-semibold text-foreground">Sin trabajo crítico sugerido</p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              No hay pedidos, reclamos o encuestas que requieran intervencion prioritaria en este periodo.
            </p>
          </div>
        ) : null}

        {items.slice(0, 5).map((item) => (
          <AIOpsQueueItemCard key={item.id || `${item.source}-${item.record_id}`} item={item} />
        ))}
      </CardContent>
    </Card>
  );
}

function AIOpsQueueItemCard({ item }: { item: OperationsAIOpsQueueItem }) {
  const action = item.recommended_action;
  const actionLabel = action?.label || action?.title;
  const uiHref = aiOpsActionHref(item);
  const signals = item.signals ?? {};
  const reasonCodes = item.reason_codes ?? [];
  const signalPairs = Object.entries(signals)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .slice(0, 3);

  return (
    <div className="rounded-lg border border-border/70 bg-background/70 p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">{aiOpsSourceLabel(item.source)}</Badge>
            <Badge variant={priorityVariant(item.priority)}>{priorityLabel(item.priority)}</Badge>
          </div>
          <p className="mt-2 text-sm font-semibold leading-5 text-foreground">
            {item.title || 'Operación requiere revisión'}
          </p>
        </div>
        {actionLabel && uiHref ? (
          <Button asChild size="sm" variant="secondary" className="h-8 shrink-0 px-3">
            {isExternalHref(uiHref) ? (
              <a href={uiHref} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                {actionLabel}
              </a>
            ) : (
              <Link to={uiHref}>
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                {actionLabel}
              </Link>
            )}
          </Button>
        ) : actionLabel ? (
          <Badge variant="secondary" className="shrink-0">
            {actionLabel}
          </Badge>
        ) : null}
      </div>
      {reasonCodes.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {reasonCodes.slice(0, 4).map((reason) => (
            <span key={reason} className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {aiOpsReasonLabel(reason)}
            </span>
          ))}
        </div>
      ) : null}
      {signalPairs.length ? (
        <dl className="mt-3 grid grid-cols-1 gap-1.5 text-xs text-muted-foreground sm:grid-cols-3">
          {signalPairs.map(([key, value]) => (
            <div key={key} className="min-w-0 rounded-md bg-muted/40 px-2 py-1">
              <dt className="truncate uppercase tracking-[0.12em]">{aiOpsReasonLabel(key)}</dt>
              <dd className="truncate font-semibold text-foreground">{String(value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

function AIBriefBanner({ brief }: { brief: OperationsAIBriefV1 }) {
  const severity = brief.severity || brief.risk_level || 'low';
  const topAction = brief.top_action;
  const focusItems = brief.focus_items ?? [];
  const modelPolicy = brief.model_policy ?? {};
  const providerOrder = Array.isArray(modelPolicy.provider_order)
    ? modelPolicy.provider_order.map((item) => String(item || '').trim()).filter(Boolean).join(' -> ')
    : '';
  const primaryProvider = asString(modelPolicy.primary_provider);
  const hfMode = asString(brief.signals?.hf_mode);
  const hfConfigured = brief.signals?.hf_configured === true;

  return (
    <div className="overflow-hidden rounded-xl border border-primary/15 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white shadow-sm">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/20 text-primary-foreground">
              <Brain className="h-5 w-5" />
            </span>
            <Badge variant={priorityVariant(severity)}>{priorityLabel(severity)}</Badge>
            {brief.dominant_intent_label ? <Badge variant="outline" className="border-white/20 text-white">{brief.dominant_intent_label}</Badge> : null}
            {brief.sentiment ? <Badge variant="outline" className="border-white/20 text-white">sentimiento {brief.sentiment}</Badge> : null}
          </div>
          <div>
            <h3 className="text-xl font-semibold tracking-tight">{brief.headline || 'Brief operativo IA'}</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">
              {brief.narrative || 'El sistema consolido tickets, encuestas, WhatsApp, equipo y mapa para sugerir la proxima accion.'}
            </p>
          </div>
          {topAction ? (
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">Siguiente accion</p>
              <p className="mt-1 text-sm font-semibold">{topAction.title || topAction.id || 'Revisar accion recomendada'}</p>
              {topAction.description ? <p className="mt-1 text-sm text-slate-300">{topAction.description}</p> : null}
            </div>
          ) : null}
        </div>
        <div className="border-t border-white/10 bg-white/5 p-5 lg:border-l lg:border-t-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">Foco del momento</p>
          <div className="mt-3 grid gap-2">
            {focusItems.slice(0, 5).map((item, index) => (
              <div key={item.id || item.key || item.label || index} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2">
                <span className="min-w-0 truncate text-sm">{item.label || item.title || item.key || 'Foco operativo'}</span>
                <span className="shrink-0 text-sm font-semibold">{formatNumber(item.value ?? item.count ?? item.total)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
            {primaryProvider ? <span className="rounded-full border border-white/10 px-2 py-1">IA {primaryProvider}</span> : null}
            {providerOrder ? <span className="rounded-full border border-white/10 px-2 py-1">{providerOrder}</span> : null}
            {hfMode ? <span className="rounded-full border border-white/10 px-2 py-1">HF {hfMode}</span> : null}
            {hfConfigured ? <span className="rounded-full border border-emerald-400/30 px-2 py-1 text-emerald-200">HF activo</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function FreshnessBanner({ freshness }: { freshness: OperationsFreshnessV1 }) {
  const staleOrEmpty = freshness.sources.filter((source) => {
    const normalized = (source.status || '').toLowerCase();
    return normalized === 'stale' || normalized === 'empty' || normalized === 'degraded';
  });
  const summary = freshness.summary ?? {};
  const latestAt = asString(summary.latest_at);

  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <DatabaseZap className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">Estado de datos</p>
              {freshness.status ? <Badge variant={statusVariant(freshness.status)}>{statusLabel(freshness.status)}</Badge> : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>{formatNumber(summary.fresh_sources)} fuentes al día</span>
              <span>{formatNumber(summary.stale_sources)} por revisar</span>
              <span>{formatNumber(summary.empty_sources)} sin actividad</span>
              {latestAt ? <span>ultimo dato {latestAt}</span> : null}
            </div>
          </div>
        </div>
        {staleOrEmpty.length ? (
          <div className="flex max-w-full flex-wrap gap-2">
            {staleOrEmpty.slice(0, 5).map((source) => (
              <FreshnessSourceChip key={source.key || source.label || source.reason_code} source={source} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FreshnessSourceChip({ source }: { source: OperationsFreshnessSource }) {
  const label = source.label || source.key || 'fuente';
  const action = source.recommended_action;
  const actionLabel = action?.title;

  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs">
      <span className="shrink-0 font-medium">{label}</span>
      {source.status ? <span className="text-muted-foreground">{statusLabel(source.status)}</span> : null}
      {actionLabel ? (
        <span className="shrink-0 text-muted-foreground">{actionLabel}</span>
      ) : null}
    </span>
  );
}

function KpiGrid({
  data,
  heatmap,
  alertsCount,
}: {
  data: OperationsDashboardV1;
  heatmap?: OperationsHeatmapV1;
  alertsCount: number;
}) {
  const ticketsSummary = data.tickets?.summary ?? {};
  const surveysSummary = data.surveys?.summary ?? {};
  const chatsSummary = data.chats?.summary ?? {};
  const commerceSummary = data.commerce?.summary ?? {};
  const employeesSummary = data.employees?.summary ?? {};
  const heatmapSummary = heatmap?.summary ?? {};

  const metrics = [
    {
      key: 'open_tickets',
      label: resolveLabel(data, 'open_tickets', 'Reclamos abiertos'),
      value: readNumber(data.summary.open_tickets, ticketsSummary.open_tickets, ticketsSummary.open, ticketsSummary.abiertos),
      icon: Ticket,
    },
    {
      key: 'overdue_tickets',
      label: resolveLabel(data, 'overdue_tickets', 'Reclamos vencidos'),
      value: readNumber(data.summary.overdue_tickets, ticketsSummary.overdue_tickets, ticketsSummary.overdue, ticketsSummary.vencidos),
      icon: AlertTriangle,
    },
    {
      key: 'survey_responses',
      label: resolveLabel(data, 'survey_responses', 'Respuestas'),
      value: readNumber(data.summary.survey_responses, surveysSummary.responses, surveysSummary.respuestas),
      icon: BarChart3,
    },
    {
      key: 'live_votes',
      label: resolveLabel(data, 'live_votes', 'Votos en vivo'),
      value: readNumber(data.summary.live_votes, surveysSummary.votaciones_live, surveysSummary.live_votes),
      icon: Activity,
    },
    {
      key: 'whatsapp_messages',
      label: resolveLabel(data, 'whatsapp_messages', 'WhatsApp'),
      value: readNumber(data.summary.whatsapp_messages, chatsSummary.whatsapp_messages),
      icon: Bell,
    },
    {
      key: 'assisted_orders',
      label: resolveLabel(data, 'assisted_orders', 'Pedidos asistidos'),
      value: readNumber(data.summary.assisted_orders, commerceSummary.assisted_orders),
      icon: ShoppingCart,
    },
    {
      key: 'orders_needing_review',
      label: resolveLabel(data, 'orders_needing_review', 'Pedidos a revisar'),
      value: readNumber(data.summary.orders_needing_review, commerceSummary.orders_needing_review),
      icon: AlertTriangle,
    },
    {
      key: 'employees',
      label: resolveLabel(data, 'employees', 'Equipo'),
      value: readNumber(data.summary.employees, employeesSummary.employees, employeesSummary.total, data.employees?.items?.length),
      icon: Users,
    },
    {
      key: 'map_points',
      label: resolveLabel(data, 'map_points', 'Puntos en mapa'),
      value: readNumber(data.summary.map_points, heatmapSummary.points, heatmap?.points.length),
      icon: MapPin,
    },
    {
      key: 'alerts',
      label: resolveLabel(data, 'alerts', 'Alertas'),
      value: readNumber(data.summary.alerts, alertsCount),
      icon: AlertTriangle,
    },
  ];

  return (
    <details className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <summary className="cursor-pointer text-sm font-semibold text-foreground">
        Ver indicadores detallados
      </summary>
      <p className="mt-1 text-sm text-muted-foreground">
        Métricas completas para revisión. El resumen superior indica las prioridades principales.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <Card key={metric.key}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Icon className="h-4 w-4" />
                {metric.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{formatNumber(metric.value)}</p>
            </CardContent>
          </Card>
        );
      })}
      </div>
    </details>
  );
}

function AlertsStrip({ alerts }: { alerts: OperationsAlert[] }) {
  return (
    <div className="grid gap-2">
      {alerts.slice(0, 4).map((alert, index) => {
        const title = asString(alert.title) ?? `Alerta ${index + 1}`;
        const message = asString(alert.message) ?? asString(alert.description);
        return (
          <div
            key={alert.id || alert.reason_code || title}
            className="flex flex-col gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div className="min-w-0">
                <p className="font-medium">{title}</p>
                {message ? <p className="text-muted-foreground">{message}</p> : null}
              </div>
            </div>
            {alert.severity ? (
              <div className="flex shrink-0 flex-wrap gap-1">
                {alert.severity ? <Badge variant={priorityVariant(alert.severity)}>{priorityLabel(alert.severity)}</Badge> : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function TrendsPanel({ data }: { data: OperationsDashboardV1 }) {
  const trends = data.trends?.items ?? [];
  if (!trends.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Tendencias</CardTitle>
        <CardDescription>Comparacion contra el periodo anterior.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {trends.slice(0, 8).map((trend, index) => {
          const direction = asString(trend.direction);
          return (
            <div key={trend.id || trend.key || index} className="rounded-lg border px-3 py-2">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">{itemLabel(trend)}</p>
                {direction ? <Badge variant="outline">{direction}</Badge> : null}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <MetricMini label="Actual" value={formatNumber(trend.current)} />
                <MetricMini label="Anterior" value={formatNumber(trend.previous)} />
                <MetricMini label="Cambio" value={formatNumber(trend.percent_change, '%')} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function TicketBreakdowns({ data }: { data: OperationsDashboardV1 }) {
  const groups = [
    { key: 'by_status', title: resolveLabel(data, 'tickets_by_status', 'Reclamos por estado'), items: data.tickets?.by_status },
    { key: 'by_channel', title: resolveLabel(data, 'tickets_by_channel', 'Reclamos por canal'), items: data.tickets?.by_channel },
    { key: 'by_category', title: resolveLabel(data, 'tickets_by_category', 'Reclamos por categoria'), items: data.tickets?.by_category },
    { key: 'by_priority', title: resolveLabel(data, 'tickets_by_priority', 'Reclamos por prioridad'), items: data.tickets?.by_priority },
  ].filter((group) => hasItems(group.items));

  if (!groups.length) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {groups.map((group) => (
        <BreakdownCard key={group.key} title={group.title} items={group.items ?? []} />
      ))}
    </div>
  );
}

function SurveyLiveControlRoom({ data }: { data: OperationsDashboardV1 }) {
  const room = data.surveys?.live_control_room;
  if (!room || room.enabled === false) return null;

  const monitors = Array.isArray(room.monitors) ? room.monitors : [];
  const actions = Array.isArray(room.actions) ? room.actions : [];
  const summary = room.summary ?? {};
  const realtime = isRecord(room.realtime) ? room.realtime : {};
  const state = asString(room.state) ?? 'monitor';
  const refreshSeconds = readNumber(realtime.refresh_seconds);
  const channels = Array.isArray(summary.channels) ? (summary.channels as OperationsBucketItem[]) : [];

  return (
    <Card className="overflow-hidden border-primary/20">
      <CardHeader className="border-b bg-primary/5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-primary" />
              Control de votaciones en vivo
            </CardTitle>
            <CardDescription>
              Participación, resultados, canales y cobertura geográfica para decisiones en tiempo real.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={state === 'live' ? 'default' : 'secondary'}>{state === 'live' ? 'en vivo' : statusLabel(state)}</Badge>
            {refreshSeconds !== undefined ? <Badge variant="outline">refresh {formatNumber(refreshSeconds)}s</Badge> : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground">Votaciones activas</p>
            <p className="text-2xl font-semibold">{formatNumber(summary.live_surveys)}</p>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground">Respuestas</p>
            <p className="text-2xl font-semibold">{formatNumber(summary.responses)}</p>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground">Cobertura mapa</p>
            <p className="text-2xl font-semibold">{formatNumber(summary.geo_coverage_rate, '%')}</p>
          </div>
        </div>

        {monitors.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {monitors.slice(0, 4).map((monitor, index) => {
              const responses = readNumber(monitor.responses, monitor.value, monitor.count);
              const geoCoverage = readNumber(monitor.geo_coverage_rate);
              const liveResults = asString(monitor.live_results_endpoint);
              const publicUrl = asString(monitor.public_url);
              const adminUrl = asString(monitor.admin_url);
              return (
                <div key={String(monitor.id ?? monitor.slug ?? index)} className="rounded-xl border bg-muted/20 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{itemLabel(monitor)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {asString(monitor.slug) ?? 'encuesta'} · {statusLabel(asString(monitor.status))}
                      </p>
                    </div>
                    <Badge variant={asString(monitor.state) === 'live_collecting' ? 'default' : 'secondary'}>
                      {asString(monitor.state) === 'live_collecting' ? 'recolectando' : statusLabel(asString(monitor.state))}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <MetricMini label="Votos" value={formatNumber(responses)} />
                    <MetricMini label="Mapa" value={geoCoverage !== undefined ? formatNumber(geoCoverage, '%') : '--'} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {publicUrl ? (
                      <Button asChild size="sm" variant="outline">
                        <a href={publicUrl}>Abrir publica</a>
                      </Button>
                    ) : null}
                    {liveResults ? (
                      <Button asChild size="sm" variant="outline">
                        <a href={liveResults}>Resultados API</a>
                      </Button>
                    ) : null}
                    {adminUrl ? (
                      <Button asChild size="sm">
                        <a href={adminUrl}>Analítica</a>
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <ViewState status="empty" description="No hay votaciones en vivo publicadas para este periodo." className="min-h-[140px]" />
        )}

        {channels.length || actions.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {channels.length ? <MiniList title="Canales de participación" items={channels} /> : null}
            {actions.length ? (
              <div className="rounded-lg border bg-background p-3">
                <p className="text-sm font-medium">Acciones operativas</p>
                <div className="mt-3 space-y-2">
                  {actions.slice(0, 4).map((action, index) => (
                    <div key={action.id || action.title || index} className="flex items-start justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{action.title || action.label || action.id}</p>
                        {action.endpoint ? <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{action.endpoint}</p> : null}
                      </div>
                      {action.template_id ? <Badge variant="outline">{String(action.template_id)}</Badge> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function EngagementPanel({ data }: { data: OperationsDashboardV1 }) {
  const surveyItems = data.surveys?.items ?? [];
  const liveItems = Array.isArray(data.surveys?.live_items)
    ? (data.surveys?.live_items as OperationsBucketItem[])
    : [];
  const channelItems = data.chats?.by_channel ?? [];
  const liveChatItems = data.live_chat?.items ?? [];
  const surveyRows = [...liveItems, ...surveyItems].slice(0, 8);
  const channelRows = [...channelItems, ...liveChatItems].slice(0, 8);
  const hasSignal = surveyItems.length || liveItems.length || channelItems.length || liveChatItems.length || data.live_chat?.active_viewers !== undefined;

  if (!hasSignal) return null;

  return (
    <div className="space-y-4">
      <SurveyLiveControlRoom data={data} />
      <div className="grid gap-4 lg:grid-cols-2">
        {surveyRows.length ? (
          <BreakdownCard title={resolveLabel(data, 'surveys', 'Encuestas y votaciones')} items={surveyRows} />
        ) : null}
        {channelRows.length || data.live_chat?.active_viewers !== undefined ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{resolveLabel(data, 'channels', 'Canales y live chat')}</CardTitle>
              <CardDescription>
                {data.live_chat?.active_viewers !== undefined
                  ? `${formatNumber(data.live_chat.active_viewers)} personas activas`
                  : 'Conversaciones y participación del periodo'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {channelRows.length ? (
                channelRows.map((item, index) => (
                  <BreakdownRow key={item.id || item.key || index} item={item} />
                ))
              ) : (
                <ViewState status="empty" description="Sin actividad de canales para este periodo." className="min-h-[120px]" />
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function EmployeePanel({ data }: { data: OperationsDashboardV1 }) {
  const employees = data.employees?.items ?? [];
  const uncoveredCategories = data.employees?.coverage?.uncovered_categories ?? [];
  const uncoveredChannels = data.employees?.coverage?.uncovered_channels ?? [];
  const coverageRate = readNumber(data.employees?.summary?.coverage_rate);

  if (!employees.length && !uncoveredCategories.length && !uncoveredChannels.length && coverageRate === undefined) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{resolveLabel(data, 'employees', 'Cobertura del equipo')}</CardTitle>
        <CardDescription>
          {coverageRate !== undefined ? `${formatNumber(coverageRate, '%')} de cobertura` : 'Categorías y canales cubiertos por el equipo'}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-2 lg:col-span-2">
          {employees.slice(0, 6).map((item, index) => (
            <BreakdownRow key={item.id || item.key || index} item={item} />
          ))}
        </div>
        <div className="space-y-3">
          <MiniList title={resolveLabel(data, 'uncovered_categories', 'Categorías sin cubrir')} items={uncoveredCategories} />
          <MiniList title={resolveLabel(data, 'uncovered_channels', 'Canales sin cubrir')} items={uncoveredChannels} />
        </div>
      </CardContent>
    </Card>
  );
}

function OperationsHeatmapPanel({
  heatmap,
  freshness,
  loading,
  error,
  canRenderHeatmap,
  filters,
  onFiltersChange,
  mapConfig,
  refetch,
}: {
  heatmap?: OperationsHeatmapV1;
  freshness?: OperationsFreshnessV1;
  loading: boolean;
  error: unknown;
  canRenderHeatmap?: boolean;
  filters: HeatmapFilterState;
  onFiltersChange: React.Dispatch<React.SetStateAction<HeatmapFilterState>>;
  mapConfig?: PublicMapConfigV1;
  refetch: () => void;
}) {
  const layers = heatmap?.render_contract?.layers ?? [];
  const layersKey = layers.join('|');
  const [enabledLayers, setEnabledLayers] = useState<string[]>(layers);

  useEffect(() => {
    setEnabledLayers(layers);
  }, [layersKey]);

  const uiLabels = heatmap?.ui?.labels ?? heatmap?.frontend_contract?.labels ?? {};
  const privacySuppressed = heatmap?.privacy?.suppressed;
  const territoryPrivacyProtected =
    privacySuppressed === true ||
    (isRecord(privacySuppressed) &&
      ['zones', 'zone', 'neighborhoods', 'neighborhood', 'districts', 'district'].some(
        (key) => asBoolean(privacySuppressed[key]) === true,
      ));
  const filterControls = useMemo(() => {
    const byKey = new Map<HeatmapFilterKey, Map<string, HeatmapFilterOption>>();
    const encounteredKeys = new Set<HeatmapFilterKey>();
    const ensureGroup = (key: HeatmapFilterKey) => {
      const existing = byKey.get(key);
      if (existing) return existing;
      const next = new Map<string, HeatmapFilterOption>();
      byKey.set(key, next);
      return next;
    };
    const addOption = (key: HeatmapFilterKey, value: unknown, labelCandidate?: unknown, countCandidate?: unknown) => {
      const parsedValue = typeof value === 'number' && Number.isFinite(value) ? String(value) : asString(value);
      if (!parsedValue) return;
      const rawLabel =
        (typeof labelCandidate === 'number' && Number.isFinite(labelCandidate) ? String(labelCandidate) : asString(labelCandidate)) ??
        parsedValue;
      encounteredKeys.add(key);
      if (
        TERRITORY_HEATMAP_FILTER_KEYS.has(key) &&
        (territoryPrivacyProtected ||
          !isNamedTerritoryFilterValue(parsedValue) ||
          !isNamedTerritoryFilterValue(rawLabel))
      ) {
        return;
      }
      const label = heatmapDisplayLabel(rawLabel, parsedValue);
      const group = ensureGroup(key);
      const previous = group.get(parsedValue);
      const count = readNumber(countCandidate);
      group.set(parsedValue, {
        value: parsedValue,
        label,
        count: count !== undefined ? count : previous?.count,
      });
    };

    (heatmap?.facets ?? []).forEach((facet) => {
      const key = normalizeHeatmapFilterKey(facet.key ?? facet.field ?? facet.query_param);
      if (!key) return;
      facet.items.forEach((item) => {
        addOption(key, readItemOptionValue(item), itemLabel(item), itemValue(item));
      });
    });

    Object.entries(heatmap?.segments ?? {}).forEach(([segmentKey, items]) => {
      const key = normalizeHeatmapFilterKey(segmentKey);
      if (!key) return;
      items.forEach((item) => {
        addOption(key, readItemOptionValue(item), itemLabel(item), itemValue(item));
      });
    });

    (heatmap?.points ?? []).forEach((point) => {
      HEATMAP_FILTERS.forEach((config) => {
        addOption(config.key, readPointField(point, config));
      });
    });

    return HEATMAP_FILTERS.map((config) => {
      const options = Array.from(byKey.get(config.key)?.values() ?? [])
        .sort((a, b) => {
          const countDelta = (b.count ?? 0) - (a.count ?? 0);
          if (countDelta) return countDelta;
          return a.label.localeCompare(b.label, 'es');
        })
        .slice(0, 60);

      return {
        ...config,
        label: uiLabels[config.labelKey] || config.fallbackLabel,
        options,
        unavailableReason:
          TERRITORY_HEATMAP_FILTER_KEYS.has(config.key) &&
          options.length === 0 &&
          (encounteredKeys.has(config.key) || (config.key === 'barrio' && territoryPrivacyProtected))
            ? territoryPrivacyProtected
              ? 'privacy'
              : 'unverified'
            : undefined,
      };
    }).filter((config) => config.options.length > 0 || Boolean(config.unavailableReason));
  }, [heatmap?.facets, heatmap?.points, heatmap?.segments, territoryPrivacyProtected, uiLabels]);

  const hasActiveSegmentFilters = Object.keys(filters).some((key) => !HEATMAP_PERIOD_KEYS.has(key as HeatmapQueryKey));
  const clearFiltersLabel = uiLabels.clear_filters || 'Limpiar filtros';
  const allLabel = uiLabels.filter_all || 'Todos';
  const periodLabel = uiLabels.period_filter || 'Periodo';
  const selectedPeriod =
    filters.range === 'all' || filters.scope === 'historical'
      ? 'historical'
      : asString(filters.days) ?? '365';

  const filteredPoints = useMemo(() => {
    if (!heatmap?.points.length) return [] as OperationsHeatmapPoint[];
    const layerFiltered = (() => {
      if (!layers.length || enabledLayers.length === layers.length) return heatmap.points;

      const enabled = new Set(enabledLayers.map((layer) => layer.toLowerCase()));
      return heatmap.points.filter((point) => {
        const pointLayer = String(point.layer ?? point.source ?? point.type ?? '').trim().toLowerCase();
        return !pointLayer || enabled.has(pointLayer);
      });
    })();

    const activeFilters = Object.entries(filters)
      .map(([key, value]) => {
        const config = HEATMAP_FILTERS.find((candidate) => candidate.key === key);
        const parsedValue = asString(value);
        return config && parsedValue ? { config, value: parsedValue } : null;
      })
      .filter((item): item is { config: HeatmapFilterConfig; value: string } => item !== null);

    if (!activeFilters.length) return layerFiltered;

    return layerFiltered.filter((point) =>
      activeFilters.every(({ config, value }) => {
        const pointValue = readPointField(point, config);
        if (!pointValue) return false;
        return pointValue === value;
      }),
    );
  }, [enabledLayers, filters, heatmap?.points, layers]);

  const segmentBreakdowns = useMemo(() => {
    if (!filteredPoints.length) return [] as Array<{ key: HeatmapFilterKey; label: string; items: OperationsBucketItem[] }>;

    return filterControls
      .map((config) => {
        const acc = new Map<string, { label: string; count: number; weight: number }>();
        filteredPoints.forEach((point) => {
          const value = readPointField(point, config);
          if (!value) return;
          const previous = acc.get(value) ?? { label: value, count: 0, weight: 0 };
          previous.count += 1;
          previous.weight += readNumber(point.weight) ?? 1;
          acc.set(value, previous);
        });
        const items = Array.from(acc.entries())
          .map(([value, item]) => ({
            key: value,
            label: heatmapDisplayLabel(item.label, value),
            count: item.count,
            value: Number(item.weight.toFixed(2)),
          }))
          .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
          .slice(0, 5);
        return { key: config.key, label: config.label, items };
      })
      .filter((group) => group.items.length > 0);
  }, [filterControls, filteredPoints]);

  const activeFilterSummaries = useMemo(
    () =>
      filterControls
        .map((config) => {
          const value = filters[config.queryParam];
          if (!value) return null;
          const option = config.options.find((candidate) => candidate.value === value);
          return {
            key: config.key,
            queryParam: config.queryParam,
            label: config.label,
            value,
            optionLabel: option?.label ?? value,
          };
        })
        .filter(
          (item): item is {
            key: HeatmapFilterKey;
            queryParam: keyof HeatmapFilterState;
            label: string;
            value: string;
            optionLabel: string;
          } => item !== null,
        ),
    [filterControls, filters],
  );

  const backendAppliedFilters = useMemo(() => {
    if (!heatmap?.filters_applied) return [] as Array<{ key: string; value: string }>;
    return Object.entries(heatmap.filters_applied)
      .map(([key, value]) => {
        const parsed = typeof value === 'number' && Number.isFinite(value) ? String(value) : asString(value);
        return parsed ? { key, value: parsed } : null;
      })
      .filter((item): item is { key: string; value: string } => item !== null);
  }, [heatmap?.filters_applied]);

  const demographicItems = useMemo(() => {
    const summary = heatmap?.summary ?? {};
    return [
      {
        key: 'known_gender_points',
        label: uiLabels.known_gender_points || 'Género conocido',
        value: readNumber(heatmap?.demographics?.known_gender_points) ?? readNumber(summary.points_with_gender),
      },
      {
        key: 'unknown_gender_points',
        label: uiLabels.unknown_gender_points || 'Género sin dato',
        value: readNumber(heatmap?.demographics?.unknown_gender_points) ?? readNumber(summary.unknown_gender_points),
      },
      {
        key: 'known_age_points',
        label: uiLabels.known_age_points || 'Edad conocida',
        value: readNumber(heatmap?.demographics?.known_age_points) ?? readNumber(summary.points_with_age),
      },
      {
        key: 'unknown_age_points',
        label: uiLabels.unknown_age_points || 'Edad sin dato',
        value: readNumber(heatmap?.demographics?.unknown_age_points) ?? readNumber(summary.unknown_age_points),
      },
    ].filter((item): item is { key: string; label: string; value: number } => item.value !== undefined);
  }, [heatmap?.demographics, heatmap?.summary, uiLabels]);

  const demographicBreakdowns = useMemo(() => {
    const groups = [
      {
        key: 'gender',
        label: uiLabels.demographic_gender || 'Género',
        items: heatmap?.demographics?.gender ?? [],
      },
      {
        key: 'age_ranges',
        label: uiLabels.demographic_age_ranges || 'Rangos de edad',
        items: heatmap?.demographics?.age_ranges ?? [],
      },
    ];

    return groups
      .map((group) => ({
        ...group,
        items: group.items.map((item) => ({
          ...item,
          label: heatmapDisplayLabel(itemLabel(item), readItemOptionValue(item)),
        })),
      }))
      .filter((group) => group.items.length > 0);
  }, [heatmap?.demographics, uiLabels]);

  const categoryLayerItems = useMemo(
    () =>
      (heatmap?.category_layers ?? [])
        .map((item) => ({
          ...item,
          label: heatmapDisplayLabel(itemLabel(item), readItemOptionValue(item)),
          key: readItemOptionValue(item) ?? item.key,
        }))
        .filter((item) => asString(item.key)),
    [heatmap?.category_layers],
  );

  const aiInsights = heatmap?.ai_insights;
  const aiLayers = heatmap?.ai_layers;
  const aiStatus = heatmap?.ai_status;
  const aiSummary = aiInsights?.summary ?? aiLayers?.summary ?? {};
  const aiCollection = aiInsights?.collection ?? {};
  const hfStatus = aiInsights?.hf_status ?? aiLayers?.hf_status ?? {};
  const aiLayerItems = [...(aiLayers?.layers ?? []), ...(aiLayers?.risk_layers ?? [])];
  const aiRecommendedActions = [...(aiInsights?.recommended_actions ?? []), ...(aiLayers?.recommendations ?? [])].slice(0, 3);
  const aiLayerHints = [
    ...(aiStatus?.map_layer_hints ?? []),
    ...aiLayerItems.map((item) => itemLabel(item)),
  ]
    .map((hint) => humanizeHeatmapToken(hint, hint))
    .filter((hint, index, arr) => arr.indexOf(hint) === index)
    .slice(0, 5);
  const aiProvider = humanizeHeatmapToken(
    aiStatus?.provider_family ?? aiInsights?.provider_family ?? aiLayers?.provider_family,
    'IA operativa',
  );
  const aiMode = humanizeHeatmapToken(aiStatus?.mode ?? aiInsights?.mode ?? aiLayers?.mode, 'análisis operativo');
  const aiState = aiStatus?.status ?? aiLayers?.status ?? aiInsights?.mode;
  const aiStateLabel = humanizeHeatmapToken(aiState, 'sin estado IA');
  const aiUsedHf = aiStatus?.used_hf ?? asBoolean(hfStatus.used);
  const aiConfigured = aiStatus?.configured ?? asBoolean(hfStatus.configured);
  const aiZeroShotEnabled = aiStatus?.zero_shot_enabled ?? asBoolean(hfStatus.zero_shot_enabled);
  const aiSafeFallback = aiStatus?.safe_to_render_without_hf_token ?? asBoolean(aiInsights?.frontend_contract?.safe_to_render_without_hf_token);
  const aiAdvisoryOnly =
    asBoolean(aiInsights?.advisory_policy?.mutates_operational_state) === false ||
    asBoolean(aiInsights?.frontend_contract?.advisory_only) === true ||
    asBoolean(aiLayers?.frontend_contract?.advisory_only) === true;
  const aiRiskLabel = humanizeHeatmapToken(aiSummary.risk_level ?? aiSummary.risk_signal, 'riesgo normal');
  const aiIntentLabel = humanizeHeatmapToken(
    aiSummary.dominant_intent_label ?? aiSummary.dominant_intent,
    'consulta general',
  );
  const aiSentimentLabel = humanizeHeatmapToken(aiSummary.sentiment, 'neutral');
  const aiItemsAnalyzed = readNumber(aiCollection.items_analyzed, aiCollection.text_items_analyzed);
  const hasAiCockpit = Boolean(aiInsights || aiLayers || aiStatus || aiLayerHints.length || aiRecommendedActions.length);
  const aiMetricCards: Array<{
    key: string;
    label: string;
    value: string;
    detail: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      key: 'provider',
      label: 'Proveedor IA',
      value: aiProvider,
      detail: aiUsedHf ? 'clasificación HF activa' : aiConfigured ? 'token listo, fallback disponible' : 'fallback local seguro',
      icon: Brain,
    },
    {
      key: 'intent',
      label: 'Intención dominante',
      value: aiIntentLabel,
      detail: aiSentimentLabel,
      icon: Sparkles,
    },
    {
      key: 'risk',
      label: 'Riesgo detectado',
      value: aiRiskLabel,
      detail: aiSummary.requires_human_attention ? 'requiere revisión humana' : 'sin alerta crítica',
      icon: AlertTriangle,
    },
    {
      key: 'sample',
      label: 'Muestra analizada',
      value: aiItemsAnalyzed !== undefined ? formatNumber(aiItemsAnalyzed) : formatNumber(aiLayerItems.length),
      detail: aiLayerItems.length ? `${formatNumber(aiLayerItems.length)} capas IA` : 'sin capas IA publicadas',
      icon: DatabaseZap,
    },
  ];

  const quality = heatmap?.quality;
  const realtime = heatmap?.realtime;
  const mapExperience = heatmap?.map_experience;
  const geocoding = heatmap?.geocoding;
  const rawCoverageRate = readNumber(quality?.coverage_rate, heatmap?.summary?.coverage_rate);
  const normalizedCoverageRate =
    rawCoverageRate !== undefined ? (rawCoverageRate <= 1 ? rawCoverageRate * 100 : rawCoverageRate) : undefined;
  const qualityState = asString(quality?.state) ?? asString(heatmap?.summary?.quality_state);
  const qualityLabel =
    asString(quality?.label) ??
    (qualityState ? uiLabels[`quality_${qualityState}`] : undefined) ??
    'Calidad pendiente';
  const qualityReason = quality?.reason_code
    ? humanizeHeatmapToken(quality.reason_code, 'contrato operativo')
    : 'contrato operativo';
  const coveragePercent =
    readNumber(quality?.coverage_percent, heatmap?.summary?.coverage_percent, heatmap?.summary?.coordinate_coverage_pct) ??
    normalizedCoverageRate;
  const geocodingCandidateCount = readNumber(geocoding?.candidate_count, geocoding?.candidates?.length);
  const pendingGeocode = readNumber(quality?.pending_geocode, heatmap?.summary?.pending_geocode, geocodingCandidateCount);
  const visiblePoints = readNumber(quality?.visible_points, heatmap?.summary?.points, heatmap?.points.length);
  const totalTicketRecords = readNumber(
    quality?.total_ticket_records,
    heatmap?.summary?.total_ticket_records,
    heatmap?.summary?.records_total,
  );
  const coordinateRecords = readNumber(
    quality?.ticket_records_with_coordinates,
    heatmap?.summary?.ticket_records_with_coordinates,
    heatmap?.summary?.points_with_coordinates,
  );
  const recordsWithoutCoordinates = readNumber(
    quality?.ticket_records_without_coordinates,
    heatmap?.summary?.ticket_records_without_coordinates,
    pendingGeocode,
  );
  const coverageDetail =
    coordinateRecords !== undefined && totalTicketRecords !== undefined
      ? `${formatNumber(coordinateRecords)} de ${formatNumber(totalTicketRecords)} registros con GPS`
      : coordinateRecords !== undefined
        ? `${formatNumber(coordinateRecords)} registros con GPS`
        : 'esperando resumen de coordenadas';
  const geocodeDetail =
    recordsWithoutCoordinates !== undefined
      ? `${formatNumber(recordsWithoutCoordinates)} registros sin coordenadas`
      : 'sin cola publicada';
  const latestRealtime = asString(realtime?.latest_event_at);
  const realtimeEvents = realtime?.socket_events ?? [];
  const realtimeSources = realtime?.sources ?? [];
  const realtimeReady = Boolean(realtime?.poll_seconds || latestRealtime || realtimeEvents.length || realtimeSources.length);
  const realtimeDetail =
    latestRealtime
      ? `ultimo evento ${latestRealtime}`
      : realtimeEvents.length
        ? `${realtimeEvents.slice(0, 2).join(', ')}`
        : 'sin eventos recientes';
  const mapEngines = mapExperience?.map_engines ?? [];
  const layerGroups = mapExperience?.layer_groups ?? [];
  const preferredVisualizationRaw = asString(mapExperience?.preferred_visualization);
  const preferredVisualization = humanizeHeatmapToken(preferredVisualizationRaw, 'Mapa operativo interactivo');
  const enabledLayerCount = layers.length ? enabledLayers.length : layerGroups.length;
  const mapStateCards: Array<{
    key: string;
    label: string;
    value: string;
    detail: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
    badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
  }> = [
    {
      key: 'quality',
      label: uiLabels.map_quality || 'Calidad del mapa',
      value: qualityLabel,
      detail: qualityReason,
      icon: Gauge,
      badge: qualityState ? statusLabel(qualityState) : undefined,
      badgeVariant: qualityState ? statusVariant(qualityState) : undefined,
    },
    {
      key: 'coverage',
      label: uiLabels.coverage || 'Cobertura GPS',
      value: coveragePercent !== undefined ? `${formatNumber(coveragePercent, '%')}` : '--',
      detail: coverageDetail,
      icon: MapPin,
    },
    {
      key: 'geocode_queue',
      label: uiLabels.pending_geocode || 'Pendientes de geocodificar',
      value: formatNumber(pendingGeocode),
      detail: geocodeDetail,
      icon: Route,
    },
    {
      key: 'realtime',
      label: uiLabels.realtime || 'Actualización en vivo',
      value: realtime?.poll_seconds ? `${formatNumber(realtime.poll_seconds)}s` : '--',
      detail: realtimeDetail,
      icon: Radio,
      badge: realtimeReady ? 'activo' : 'sin senal',
      badgeVariant: realtimeReady ? 'default' : 'outline',
    },
  ];
  const mainHotspot = heatmap?.hotspots?.[0] ?? heatmap?.cells?.[0];
  const mainHotspotLabel = mainHotspot
    ? itemLabel(mainHotspot)
    : activeFilterSummaries[0]?.optionLabel ?? categoryLayerItems[0]?.label ?? 'Sin foco definido';
  const mainHotspotValue = mainHotspot ? itemValue(mainHotspot) : filteredPoints.length;
  const mainSegment =
    activeFilterSummaries[0]?.optionLabel ??
    segmentBreakdowns[0]?.items?.[0]?.label ??
    categoryLayerItems[0]?.label ??
    aiIntentLabel;
  const mainAction = aiRecommendedActions[0];
  const mainActionTitle =
    asString(mainAction?.title) ??
    asString(mainAction?.label) ??
    asString(geocoding?.recommended_action?.title) ??
    asString(geocoding?.recommended_action?.label) ??
    (pendingGeocode ? 'Validar ubicaciones pendientes' : 'Monitorear operaciones');
  const mainActionDetail =
    asString(mainAction?.description) ??
    (pendingGeocode
      ? `${formatNumber(pendingGeocode)} direcciones para mejorar el mapa`
      : aiSummary.requires_human_attention
        ? 'requiere revision humana'
        : 'sin bloqueo critico publicado');
  const territorialDecisionCards = [
    {
      key: 'territory_priority',
      label: 'Prioridad territorial',
      value: mainHotspotLabel,
      detail:
        mainHotspotValue !== undefined
          ? `${formatNumber(mainHotspotValue)} eventos o peso operativo`
          : `${formatNumber(filteredPoints.length)} puntos visibles`,
      icon: MapPin,
    },
    {
      key: 'territory_ai',
      label: 'Lectura IA',
      value: aiRiskLabel,
      detail: `${aiIntentLabel} - ${aiSentimentLabel}`,
      icon: Brain,
    },
    {
      key: 'territory_action',
      label: 'Que hacer ahora',
      value: mainActionTitle,
      detail: mainActionDetail,
      icon: CheckCircle2,
    },
  ];
  const geocodingCandidates = (geocoding?.candidates ?? []).slice(0, 4);
  const geocodingStatus = asString(geocoding?.status);
  const geocodingAction = geocoding?.recommended_action;
  const geocodingActionTitle =
    asString(geocodingAction?.title) ?? asString(geocodingAction?.label) ?? asString(geocodingAction?.id);
  const geocodingActionEndpoint = formatEndpoint(geocodingAction);
  const geocodingActionMethod = asString(geocodingAction?.method) ?? (geocodingActionEndpoint ? 'PATCH' : undefined);
  const candidateCountLabel =
    geocodingCandidateCount === 1 ? '1 pendiente' : `${formatNumber(geocodingCandidateCount)} pendientes`;
  const visiblePointsLabel = uiLabels.visible_points || 'Puntos visibles';
  const backendFiltersLabel = uiLabels.backend_filters || 'Filtros aplicados por backend';
  const hasLayerSignals = Boolean(
    layers.length ||
      layerGroups.length ||
      mapEngines.length ||
      preferredVisualizationRaw ||
      mapExperience?.supports_reduced_motion,
  );
  const layerStatusLabel = layers.length
    ? `${formatNumber(enabledLayerCount)} de ${formatNumber(layers.length)} capas activas`
    : layerGroups.length
      ? `${formatNumber(layerGroups.length)} grupos publicados`
      : 'sin capas publicadas';

  const renderState = heatmap?.render_contract?.state;
  const isFreshnessBlocked = canRenderHeatmap === false;
  const allowDemoFallback = import.meta.env.DEV && !isFreshnessBlocked && renderState !== 'empty';
  const usesDemoFallback = allowDemoFallback && !filteredPoints.length;
  const isEmpty = isFreshnessBlocked || renderState === 'empty' || (!filteredPoints.length && !allowDemoFallback);
  const emptyDescription = isFreshnessBlocked
    ? 'El backend marcó el heatmap como no renderizable para este periodo.'
    : pendingGeocode
      ? `${formatNumber(pendingGeocode)} direcciones pendientes de geocodificación antes de mejorar la cobertura.`
      : 'Todavía no hay coordenadas para las capas y filtros activos.';
  const tenantVertical = asString(heatmap?.tenant?.vertical ?? heatmap?.tenant?.tipo ?? heatmap?.tenant?.sector);
  const demoProfile =
    tenantVertical === 'educacion' || tenantVertical === 'colegio'
      ? 'colegio'
      : tenantVertical === 'empresa' || tenantVertical === 'empresas' || tenantVertical === 'pyme'
        ? 'empresa'
        : tenantVertical === 'gobierno' || tenantVertical === 'municipio'
          ? 'gobierno'
          : 'general';

  if (loading && !heatmap) {
    return (
      <Card id="operations-heatmap" data-testid="operations-heatmap" className="overflow-hidden">
        <ViewState status="loading" description="Cargando mapa operativo." />
      </Card>
    );
  }

  if (error && !heatmap) {
    const errorMessage = getErrorMessage(error, 'No se pudo cargar el mapa operativo.');
    const recoveryHeatmap: OperationsHeatmapV1 = {
      contract_version: 'operations.heatmap.recovery.v1',
      render_contract: {
        state: 'degraded',
        layers: ['recovery', 'geocoding', 'operations'],
        can_render_heatmap: true,
      },
      summary: { points: 0 },
      points: [],
      cells: [],
      hotspots: [],
      facets: [],
      category_layers: [],
      quality: {
        state: 'degraded',
        label: 'Mapa en recuperacion',
        coverage_percent: 0,
        visible_points: 0,
        pending_geocode: 0,
        can_render_heatmap: true,
      },
      realtime: {
        sources: ['dashboard'],
        socket_events: ['operations.heatmap.retry_required'],
      },
      map_experience: {
        preferred_visualization: 'continuity_atlas',
        layer_groups: ['diagnostico', 'geocoding', 'acciones'],
        empty_state_behavior: 'render_safe_recovery_map',
        supports_reduced_motion: true,
      },
      map_narrative: {
        headline: 'Mapa temporalmente no disponible',
        operator_summary: errorMessage,
        primary_cta: {
          id: 'retry_heatmap',
          label: 'Reintentar mapa',
          ui_hint: 'retry_heatmap',
        },
      },
      hotspot_actions: {
        safe_by_default: true,
        writes_enabled: false,
        playbook: [],
        actions: [
          {
            id: 'retry_heatmap',
            label: 'Reintentar mapa',
            ui_hint: 'retry_heatmap',
          },
        ],
      },
      ai_status: {
        status: 'safe_recovery',
        mode: 'map_continuity',
        safe_to_render_without_hf_token: true,
        ai_layers_ready: false,
      },
    };
    return (
      <Card id="operations-heatmap" data-testid="operations-heatmap" className="overflow-hidden border-amber-500/25">
        <CardHeader className="border-b bg-[linear-gradient(135deg,rgba(245,158,11,0.12),hsl(var(--background)),rgba(59,130,246,0.06))]">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="h-5 w-5" />
                  Centro territorial
                </CardTitle>
                <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-200">
                  mapa en recuperacion
                </Badge>
              </div>
              <CardDescription className="mt-1">
                No ocultamos el problema: el mapa no respondió, pero el operador conserva el diagnóstico y puede reintentar sin perder el panel.
              </CardDescription>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={refetch}>
              <RefreshCw className="h-4 w-4" />
              Reintentar mapa
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-background/80 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Mapa temporalmente no disponible</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{errorMessage}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border bg-background p-3 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <DatabaseZap className="h-3.5 w-3.5 text-primary" />
                Contrato
              </div>
              <p className="mt-2 text-sm font-medium">Esperando heatmap operativo</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Dashboard, KPIs y acciones siguen visibles mientras se recupera la capa geo.</p>
            </div>
            <div className="rounded-xl border bg-background p-3 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <Route className="h-3.5 w-3.5 text-primary" />
                Geocoding
              </div>
              <p className="mt-2 text-sm font-medium">Sin cambios automáticos</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">No se inventan puntos ni zonas hasta que backend publique coordenadas confiables.</p>
            </div>
            <div className="rounded-xl border bg-background p-3 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <Radio className="h-3.5 w-3.5 text-primary" />
                Operación
              </div>
              <p className="mt-2 text-sm font-medium">Reintento manual disponible</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">El equipo puede refrescar sin abandonar reclamos, encuestas ni acciones recomendadas.</p>
            </div>
          </div>
          <PremiumTerritoryHeatmap
            points={[]}
            heatmap={recoveryHeatmap}
            labels={{
              premium_heatmap_title: 'Mapa territorial en recuperacion',
              premium_heatmap_description:
                'Continuidad visual sin puntos inventados: se mantiene el command loop y el equipo puede reintentar la capa geografica.',
            }}
            mapConfig={mapConfig}
            allowDemoFallback={false}
            demoProfile="general"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id="operations-heatmap" data-testid="operations-heatmap" className="overflow-hidden">
      <CardHeader className="border-b bg-muted/20">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-5 w-5" />
                Centro territorial
              </CardTitle>
              {renderState ? <Badge variant={statusVariant(renderState)}>{statusLabel(renderState)}</Badge> : null}
              {usesDemoFallback ? <Badge variant="outline">demo local</Badge> : null}
            </div>
            <CardDescription className="mt-1">
              Mapa operativo con calor territorial, capas IA, cobertura GPS y calidad de geocodificación.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Layers className="h-3.5 w-3.5" />
              {layerStatusLabel}
            </Badge>
            <Badge variant="outline">
              {formatNumber(visiblePoints)} publicados / {formatNumber(filteredPoints.length)} visibles
            </Badge>
            <Button type="button" size="sm" variant="outline" onClick={refetch}>
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              Actualizar mapa
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {mapStateCards.map((metric) => {
            const Icon = metric.icon;
            return (
              <div key={metric.key} className="rounded-lg border bg-background/85 p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  {metric.badge ? <Badge variant={metric.badgeVariant ?? 'outline'}>{metric.badge}</Badge> : null}
                </div>
                <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{metric.label}</p>
                <p className="mt-1 text-lg font-semibold leading-tight">{metric.value}</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{metric.detail}</p>
              </div>
            );
          })}
        </div>

        <div
          data-testid="territorial-decision-brief"
          className="overflow-hidden rounded-xl border border-primary/20 bg-[linear-gradient(135deg,hsl(var(--background)),hsl(var(--primary)/0.08),hsl(var(--background)))] shadow-sm"
        >
          <div className="flex flex-col gap-2 border-b bg-background/55 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Mesa territorial inteligente</p>
              <h3 className="mt-1 text-lg font-semibold tracking-tight">Donde actuar, por que y con que prioridad</h3>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                Resume calor territorial, senales IA, geocodificacion y filtros para que el equipo no tenga que interpretar el mapa desde cero.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{mainSegment}</Badge>
              {coveragePercent !== undefined ? <Badge variant="outline">GPS {formatNumber(coveragePercent, '%')}</Badge> : null}
            </div>
          </div>
          <div className="grid divide-y divide-border/70 md:grid-cols-3 md:divide-x md:divide-y-0">
            {territorialDecisionCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.key} className="min-w-0 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">
                    <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="truncate">{card.label}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-base font-semibold leading-snug">{card.value}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{card.detail}</p>
                </div>
              );
            })}
          </div>
        </div>

        {hasAiCockpit ? (
          <div
            data-testid="territorial-ai-cockpit"
            className="overflow-hidden rounded-xl border border-primary/15 bg-[linear-gradient(135deg,rgba(37,99,235,0.09),hsl(var(--background)),rgba(20,184,166,0.08))] shadow-sm"
          >
            <div className="flex flex-col gap-3 border-b bg-background/45 p-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                  <Brain className="h-5 w-5" />
                  <span className={cn(
                    'absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full',
                    aiUsedHf ? 'bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.18)]' : 'bg-amber-400 shadow-[0_0_0_4px_rgba(251,191,36,0.18)]',
                  )} />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">IA territorial</p>
                    <Badge variant={aiUsedHf ? 'default' : 'secondary'}>{aiUsedHf ? 'Hugging Face activo' : 'fallback local'}</Badge>
                    {aiAdvisoryOnly ? <Badge variant="outline">solo recomendaciones</Badge> : null}
                  </div>
                  <h3 className="mt-1 text-lg font-semibold leading-tight">Lectura automática de reclamos, encuestas y WhatsApp</h3>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                    El CRM cruza intención, riesgo, participación y actividad conversacional para priorizar sin exponer claves ni cambiar estados automáticamente.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant(aiState)}>{aiStateLabel}</Badge>
                <Badge variant="outline">{aiMode}</Badge>
                {aiZeroShotEnabled ? <Badge variant="secondary">zero-shot listo</Badge> : null}
                {aiSafeFallback ? <Badge variant="outline">safe fallback</Badge> : null}
              </div>
            </div>
            <div className="grid gap-0 divide-y divide-border/70 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
              {aiMetricCards.map((metric) => {
                const Icon = metric.icon;
                return (
                  <div key={metric.key} className="min-w-0 p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="truncate">{metric.label}</span>
                    </div>
                    <p className="mt-2 truncate text-base font-semibold">{metric.value}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{metric.detail}</p>
                  </div>
                );
              })}
            </div>
            {aiLayerHints.length || aiRecommendedActions.length ? (
              <div className="grid gap-3 border-t bg-background/35 p-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                {aiLayerHints.length ? (
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Capas IA sugeridas</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {aiLayerHints.map((hint) => (
                        <Badge key={hint} variant="secondary" className="max-w-full truncate">
                          {hint}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
                {aiRecommendedActions.length ? (
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Siguiente acción IA</p>
                    <div className="mt-2 grid gap-2 md:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                      {aiRecommendedActions.map((action, index) => (
                        <ActionItemRow key={action.id || action.reason_code || action.title || index} item={action} />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="order-2 space-y-4 2xl:order-1">
            <div className="flex flex-col gap-2 rounded-xl border bg-background/70 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold">Mapa y hotspots</p>
                <p className="text-xs text-muted-foreground">
                  {isEmpty
                    ? 'Sin puntos renderizables para las capas activas.'
                    : usesDemoFallback
                      ? 'Vista demo local: el tenant real todavía no publicó puntos geográficos renderizables.'
                      : `${formatNumber(filteredPoints.length)} puntos tras filtros y capas activas.`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {visiblePointsLabel}: {formatNumber(filteredPoints.length)}
                </Badge>
                {activeFilterSummaries.length ? (
                  <Badge variant="outline">{formatNumber(activeFilterSummaries.length)} filtros</Badge>
                ) : null}
              </div>
            </div>

            {isEmpty ? (
              <ViewState
                status="empty"
                title="Mapa sin puntos operativos"
                description={emptyDescription}
                action={
                  <Button type="button" variant="outline" onClick={refetch}>
                    <RefreshCw className="h-4 w-4" />
                    Reintentar mapa
                  </Button>
                }
                className="min-h-[360px] rounded-xl border bg-background"
              />
            ) : (
              <>
                {usesDemoFallback ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">
                    Esta visualización usa datos demo solo en desarrollo. En un tenant real, Chatboc debe mostrar cobertura, pendientes de geocodificación o el motivo de ausencia de puntos, no inventar geografía.
                  </div>
                ) : null}
                <PremiumTerritoryHeatmap
                  points={filteredPoints}
                  heatmap={heatmap}
                  labels={uiLabels}
                  mapConfig={mapConfig}
                  allowDemoFallback={allowDemoFallback}
                  demoProfile={demoProfile}
                  activeFilters={activeFilterSummaries.map((filter) => ({
                    key: String(filter.queryParam),
                    label: filter.label,
                    value: filter.optionLabel,
                    onClear: () =>
                      onFiltersChange((current) => {
                        const next = { ...current };
                        delete next[filter.queryParam];
                        return next;
                      }),
                  }))}
                />
              </>
            )}

            {segmentBreakdowns.length ? (
              <div className="rounded-xl border bg-background p-3 shadow-sm">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-semibold">{uiLabels.segment_reading || 'Lectura de segmentos'}</p>
                  <p className="text-xs text-muted-foreground">
                    Distribucion visible despues de aplicar filtros y capas activas.
                  </p>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {segmentBreakdowns.slice(0, 6).map((group) => (
                    <MiniList key={group.key} title={group.label} items={group.items} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <aside className="order-1 space-y-3 2xl:order-2">
            <div className="rounded-xl border bg-background p-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Layers className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{uiLabels.map_stack || 'Capas y motor'}</p>
                    <p className="text-xs text-muted-foreground">
                      {uiLabels.map_stack_description ||
                        'Activa calor territorial, riesgo IA, WhatsApp, encuestas y geocodificación.'}
                    </p>
                  </div>
                </div>
                <Badge variant="outline">{layerStatusLabel}</Badge>
              </div>

              {hasLayerSignals ? (
                <>
                  <div className="mt-3 rounded-lg border bg-muted/20 p-3">
                    <p className="text-sm font-medium">{preferredVisualization}</p>
                    <div className="mt-2 flex flex-wrap gap-1 text-xs text-muted-foreground">
                      {mapEngines.length ? (
                        <span>Motor: {mapEngines.map((engine) => humanizeHeatmapToken(engine, 'motor')).join(', ')}</span>
                      ) : (
                        <span>Motor no informado</span>
                      )}
                      {mapExperience?.supports_reduced_motion ? <Badge variant="outline">motion seguro</Badge> : null}
                    </div>
                  </div>

                  {layers.length ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Capas renderizadas</p>
                      <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-1">
                        {layers.map((layer) => {
                          const active = enabledLayers.includes(layer);
                          return (
                            <Button
                              key={layer}
                              type="button"
                              size="sm"
                              variant={active ? 'default' : 'outline'}
                              aria-pressed={active}
                              className="h-auto justify-start gap-2 px-3 py-2 text-left"
                              onClick={() => {
                                setEnabledLayers((current) =>
                                  current.includes(layer)
                                    ? current.filter((item) => item !== layer)
                                    : [...current, layer],
                                );
                              }}
                            >
                              <Layers className="h-4 w-4 shrink-0" />
                              <span className="min-w-0">
                                <span className="block truncate">{humanizeHeatmapToken(layer)}</span>
                                <span className="block text-[11px] font-normal opacity-80">{describeHeatmapLayer(layer)}</span>
                              </span>
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {layerGroups.length ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Capas disponibles</p>
                      <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-1">
                        {layerGroups.slice(0, 6).map((layer) => (
                          <div key={layer} className="rounded-lg border bg-muted/20 px-3 py-2">
                            <p className="text-sm font-medium">{humanizeHeatmapToken(layer)}</p>
                            <p className="text-xs text-muted-foreground">{describeHeatmapLayer(layer)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {categoryLayerItems.length ? (
                    <div className="mt-3 rounded-lg border bg-muted/20 p-3">
                      <p className="text-sm font-medium">{uiLabels.category_layers || 'Capas por categoria'}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {categoryLayerItems.map((item) => {
                          const value = asString(item.key) ?? '';
                          const active = filters.categoria === value;
                          return (
                            <Button
                              key={value}
                              type="button"
                              size="sm"
                              variant={active ? 'default' : 'outline'}
                              onClick={() =>
                                onFiltersChange((current) => {
                                  const next = { ...current };
                                  if (active) {
                                    delete next.categoria;
                                  } else {
                                    next.categoria = value;
                                  }
                                  return next;
                                })
                              }
                            >
                              {item.label}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <ViewState
                  status="empty"
                  title="Sin capas publicadas"
                  description="El backend aún no publicó contrato de capas para este mapa."
                  className="mt-3 min-h-[130px]"
                />
              )}
            </div>

            <div className="rounded-xl border bg-background p-3 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between 2xl:flex-col">
                <div className="flex min-w-0 items-start gap-2">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <SlidersHorizontal className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{uiLabels.segment_filters || 'Filtros operativos'}</p>
                    <p className="text-xs text-muted-foreground">
                      {uiLabels.segment_filters_description ||
                        'Cruza categoria, canal, estado y territorio sin perder el periodo activo.'}
                    </p>
                  </div>
                </div>
                {hasActiveSegmentFilters ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => onFiltersChange((current) => keepHeatmapPeriodFilters(current))}
                  >
                    <X className="h-4 w-4" />
                    {clearFiltersLabel}
                  </Button>
                ) : null}
              </div>

              <label className="mt-3 block space-y-1 text-xs font-medium text-muted-foreground">
                <span>{periodLabel}</span>
                <select
                  value={selectedPeriod}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    onFiltersChange((current) => {
                      const next = { ...current };
                      delete next.range;
                      delete next.scope;
                      delete next.days;
                      if (nextValue === 'historical') {
                        next.range = 'all';
                        next.scope = 'historical';
                      } else {
                        next.days = nextValue;
                      }
                      return next;
                    });
                  }}
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="historical">{uiLabels.period_historical || 'Histórico completo'}</option>
                  <option value="365">{uiLabels.period_365 || 'Últimos 365 días'}</option>
                  <option value="90">{uiLabels.period_90 || 'Últimos 90 días'}</option>
                  <option value="30">{uiLabels.period_30 || 'Últimos 30 días'}</option>
                  <option value="7">{uiLabels.period_7 || 'Últimos 7 días'}</option>
                </select>
              </label>

              {filterControls.length ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2 2xl:grid-cols-1">
                  {filterControls.map((config) => (
                    <label
                      key={config.key}
                      htmlFor={`heatmap-filter-${config.key}`}
                      className="space-y-1 text-xs font-medium text-muted-foreground"
                    >
                      <span>{config.label}</span>
                      <select
                        aria-label={config.label}
                        aria-describedby={config.unavailableReason ? `heatmap-filter-${config.key}-status` : undefined}
                        disabled={Boolean(config.unavailableReason)}
                        id={`heatmap-filter-${config.key}`}
                        value={filters[config.queryParam] ?? ''}
                        onChange={(event) => {
                          const nextValue = event.target.value.trim();
                          onFiltersChange((current) => {
                            const next = { ...current };
                            if (nextValue) {
                              next[config.queryParam] = nextValue;
                            } else {
                              delete next[config.queryParam];
                            }
                            return next;
                          });
                        }}
                        className="h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="">{allLabel}</option>
                        {config.options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.count !== undefined ? `${option.label} (${formatNumber(option.count)})` : option.label}
                          </option>
                        ))}
                      </select>
                      {config.unavailableReason ? (
                        <span id={`heatmap-filter-${config.key}-status`} className="block text-[11px] leading-4 text-muted-foreground">
                          {config.unavailableReason === 'privacy'
                            ? 'Segmentación territorial protegida por privacidad.'
                            : 'Sin zonas verificadas. Las ubicaciones pendientes no se ofrecen como zonas.'}
                        </span>
                      ) : null}
                    </label>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-lg border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
                  Los filtros aparecen cuando el backend publica facets, segmentos o puntos con metadatos.
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">
                  {visiblePointsLabel}: {formatNumber(filteredPoints.length)}
                </Badge>
                {activeFilterSummaries.map((filter) => (
                  <Button
                    key={`${filter.queryParam}-${filter.value}`}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 px-2 text-xs"
                    aria-label={`Quitar filtro ${filter.label} ${filter.optionLabel}`}
                    onClick={() =>
                      onFiltersChange((current) => {
                        const next = { ...current };
                        delete next[filter.queryParam];
                        return next;
                      })
                    }
                  >
                    <span className="font-medium">{filter.label}</span>
                    <span>{filter.optionLabel}</span>
                    <X className="h-3 w-3" />
                  </Button>
                ))}
              </div>
              {backendAppliedFilters.length ? (
                <p className="mt-2 break-words text-[11px] text-muted-foreground">
                  {backendFiltersLabel}: {backendAppliedFilters.map((filter) => `${filter.key}=${filter.value}`).join(', ')}
                </p>
              ) : null}
            </div>

            <div className="rounded-xl border bg-background p-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <DatabaseZap className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{uiLabels.geocoding_queue || 'Cola de geocodificación'}</p>
                    <p className="text-lg font-semibold">{candidateCountLabel}</p>
                  </div>
                </div>
                {geocodingStatus ? <Badge variant={statusVariant(geocodingStatus)}>{statusLabel(geocodingStatus)}</Badge> : null}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {geocodingCandidates.length
                  ? 'Direcciones con texto útil pero sin coordenadas. Resolverlas mejora mapa, SLA y asignación de equipo.'
                  : geocoding
                    ? 'No hay direcciones pendientes para los filtros actuales.'
                    : 'El backend aún no publicó cola de geocodificación para este mapa.'}
              </p>

              {geocodingCandidates.length ? (
                <div className="mt-3 space-y-2">
                  {geocodingCandidates.map((candidate, index) => {
                    const key = String(candidate.record_id ?? candidate.ticket_id ?? candidate.address ?? index);
                    return (
                      <div key={key} className="rounded-lg border bg-muted/20 p-3">
                        <p className="line-clamp-1 text-sm font-medium">
                          {candidate.address || candidate.label || 'Dirección pendiente'}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1 text-xs text-muted-foreground">
                          {candidate.category ? <Badge variant="outline">{candidate.category}</Badge> : null}
                          {candidate.source ? <Badge variant="outline">{candidate.source}</Badge> : null}
                          {candidate.reason_code ? <span>{humanizeHeatmapToken(candidate.reason_code, 'motivo')}</span> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {geocodingActionTitle || geocodingActionEndpoint ? (
                <div className="mt-3 rounded-lg border border-dashed bg-muted/20 p-3">
                  <div className="flex items-start gap-2">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {geocodingActionTitle || 'Acción de geocodificación disponible'}
                      </p>
                      {geocodingActionEndpoint ? (
                        <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                          {geocodingActionMethod ?? 'PATCH'} {geocodingActionEndpoint}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              <Button type="button" size="sm" variant="outline" className="mt-3 w-full justify-start" onClick={refetch}>
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                Revisar cola
              </Button>
            </div>

            {demographicItems.length || demographicBreakdowns.length ? (
              <div className="rounded-xl border bg-background p-3 shadow-sm">
                <div className="flex min-w-0 items-start gap-2">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Users className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{uiLabels.demographics_title || 'Cobertura demografica'}</p>
                    <p className="text-xs text-muted-foreground">
                      {uiLabels.demographics_description ||
                        'Solo se muestran rangos publicados por backend; los valores unknown se tratan como sin dato.'}
                    </p>
                  </div>
                </div>
                {demographicItems.length ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 2xl:grid-cols-2">
                    {demographicItems.map((item) => (
                      <div key={item.key} className="rounded-md border bg-muted/20 p-2">
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                        <p className="text-lg font-semibold">{formatNumber(item.value)}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
                {demographicBreakdowns.length ? (
                  <div className="mt-3 grid gap-2">
                    {demographicBreakdowns.map((group) => (
                      <MiniList key={group.key} title={group.label} items={group.items} />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </aside>
        </div>
      </CardContent>
    </Card>
  );
}

function ActionCenterPanel({
  items,
  summary,
  loading,
  error,
  refetch,
}: {
  items: OperationsActionItem[];
  summary?: Record<string, unknown>;
  loading: boolean;
  error: unknown;
  refetch: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle2 className="h-5 w-5" />
              Acciones recomendadas
            </CardTitle>
            <CardDescription>Prioridades para resolver ahora y equilibrar el trabajo.</CardDescription>
          </div>
          <Button type="button" size="icon" variant="ghost" onClick={refetch} aria-label="Actualizar acciones">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {summary ? (
          <div className="grid grid-cols-2 gap-2 text-xs">
            {Object.entries(summary).slice(0, 4).map(([key, value]) => (
              <MetricMini key={key} label={key} value={formatNumber(value)} />
            ))}
          </div>
        ) : null}

        {error && !items.length ? (
          <ViewState status="partial" description={getErrorMessage(error, 'No se pudieron cargar las recomendaciones.')} className="min-h-[180px]" />
        ) : null}

        {!loading && !items.length && !error ? (
          <ViewState status="empty" title="Sin acciones pendientes" description="No hay recomendaciones para este periodo." className="min-h-[180px]" />
        ) : null}

        {items.slice(0, 8).map((item, index) => (
          <ActionItemRow key={item.id || item.reason_code || item.title || index} item={item} />
        ))}
      </CardContent>
    </Card>
  );
}

function HotspotsPanel({ data, heatmap, mapFiltered = false }: { data: OperationsDashboardV1; heatmap?: OperationsHeatmapV1; mapFiltered?: boolean }) {
  const hotspots = [...(mapFiltered ? [] : (data.maps?.heatmap?.hotspots ?? [])), ...(heatmap?.hotspots ?? [])].slice(0, 8);
  if (!hotspots.length) return null;

  return <BreakdownCard title={resolveLabel(data, 'hotspots', 'Zonas calientes')} items={hotspots} />;
}

function BreakdownCard({ title, items }: { title: string; items: OperationsBucketItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.slice(0, 8).map((item, index) => (
          <BreakdownRow key={bucketItemKey(item, index)} item={item} />
        ))}
      </CardContent>
    </Card>
  );
}

function BreakdownRow({ item }: { item: OperationsBucketItem }) {
  const value = itemValue(item);
  const percentage = readNumber(item.percentage, item.percent);
  const width = percentage !== undefined ? Math.max(0, Math.min(100, percentage)) : undefined;

  return (
    <div className="space-y-1 rounded-lg border px-3 py-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="min-w-0 truncate text-muted-foreground">{itemLabel(item)}</span>
        <span className="shrink-0 font-semibold">{formatNumber(value)}</span>
      </div>
      {width !== undefined ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
        </div>
      ) : null}
    </div>
  );
}

function ActionItemRow({ item }: { item: OperationsActionItem }) {
  const title = asString(item.title) ?? asString(item.label) ?? 'Acción recomendada';
  const description = asString(item.description);
  const impact = asString(item.impact);

  return (
    <div className="rounded-lg border px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{title}</p>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {item.priority ? <Badge variant={priorityVariant(item.priority)}>{priorityLabel(item.priority)}</Badge> : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-1 text-xs">
        {impact ? <Badge variant="secondary">{impact}</Badge> : null}
      </div>
    </div>
  );
}

function MiniList({ title, items }: { title: string; items: OperationsBucketItem[] }) {
  if (!items.length) return null;
  return (
    <div className="rounded-lg border px-3 py-2">
      <p className="text-sm font-medium">{title}</p>
      <div className="mt-2 space-y-1">
        {items.slice(0, 4).map((item, index) => (
          <div key={item.id || item.key || index} className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="truncate">{itemLabel(item)}</span>
            <span className="font-medium">{formatNumber(itemValue(item))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/20 px-2 py-1">
      <p className="truncate text-muted-foreground">{humanizeMetricLabel(label)}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function humanizeMetricLabel(label: string) {
  const normalized = label.replace(/[_-]+/g, ' ').trim();
  if (!normalized) return 'Indicador';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export default OperationsDashboardPanel;
