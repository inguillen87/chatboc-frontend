import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  FileText,
  Gauge,
  GraduationCap,
  Inbox,
  MapPinned,
  MessageSquareText,
  Radio,
  ShieldAlert,
  ShoppingCart,
  Timer,
  Users,
  X,
} from "lucide-react";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { resetChatSessionId } from "@/utils/chatSessionId";
import RubroSelector from "@/components/chat/RubroSelector";
import ExecutiveClaimsPanel, {
  type ExecutiveClaimCase,
  type ExecutiveClaimSourceKind,
} from '@/components/demo/ExecutiveClaimsPanel';
import ExecutiveOverviewPanel from '@/components/demo/ExecutiveOverviewPanel';
import type { Rubro } from "@/types/rubro";
import { extractRubroKey, extractRubroLabel } from "@/utils/rubros";
import DemoWorkspace from '@/features/demo/DemoWorkspace';
import { buildExecutiveOverviewModel } from '@/features/demo/buildExecutiveOverviewModel';
import DemoSectorStep from '@/features/demo/DemoSectorStep';
import ExecutiveDemoJourney, {
  type ExecutiveDemoJourneyTarget,
} from '@/features/demo/ExecutiveDemoJourney';
import ExecutiveSurveyPanel from '@/features/demo/ExecutiveSurveyPanel';
import WhatsappSandboxLauncher from '@/features/demo/WhatsappSandboxLauncher';
import { createDemoSession, getDemoAdminPreview, getDemoCatalog } from '@/features/demo/demoApi';
import { formatDemoPresentationLabel } from '@/features/demo/demoPresentationLabels';
import { normalizeDemoDetailDestination } from '@/features/demo/normalizeDemoDetailDestination';
import { DEMO_TENANT_STORAGE_KEY } from '@/features/demo/demoStorage';
import { normalizeRequestedDemoTenantSlug, resolveDemoTenantSlug } from '@/features/demo/demoTenantSelection';
import type { LeadCaptureResponse, OperationalTicketResult } from '@/features/chat/chatApi';
import type {
  DemoAdminPreviewResponse,
  DemoAdminPreviewMapPoint,
  DemoCatalogResponse,
  DemoSector,
  DemoSectorGroup,
  DemoWorkspaceConfig,
} from '@/features/demo/demoTypes';
import type { HeatPoint } from '@/services/statsService';
import { CHATBOC_ORBIT_AVATAR } from '@/utils/brandAssets';
import { ApiError, apiFetch, getErrorMessage } from '@/utils/api';

const MapLibreMap = React.lazy(() => import('@/components/MapLibreMap'));
const EXECUTIVE_NUMBER_FORMATTER = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });

type DemoUiError = {
  message: string;
  requestId?: string | null;
};

type DemoAdminPanelTarget = 'summary' | 'claims' | 'map' | 'surveys';

type DemoRuntimeEvent = {
  id: string;
  leadId?: string | null;
  ticketId?: string | null;
  status?: string | null;
  requestId?: string | null;
  ticket?: OperationalTicketResult | null;
  result?: LeadCaptureResponse | null;
  updatedAt: string;
};

type DemoDetailDrawerState = {
  event: DemoRuntimeEvent;
  endpoint: string | null;
  data: unknown;
  loading: boolean;
  error: DemoUiError | null;
} | null;

type DemoDirectRouteSelection = {
  sector: DemoSector;
  rubro: string;
  tenantSlug: string | null;
};

type DemoInitialSelection = DemoDirectRouteSelection & {
  rubroLabel: string;
};

const readDemoDirectRouteSelection = (search: string): DemoDirectRouteSelection | null => {
  const query = new URLSearchParams(search);
  const requestedSector = query.get('sector');
  const sector =
    requestedSector === 'educacion' || requestedSector === 'gobierno' || requestedSector === 'empresas'
      ? requestedSector
      : null;
  const rubro = query.get('rubro')?.trim() ?? '';

  if (!sector || !rubro) return null;

  return {
    sector,
    rubro,
    tenantSlug: normalizeRequestedDemoTenantSlug(query.get('tenant_slug') ?? query.get('tenant')),
  };
};

const readRequestIdFromError = (error: unknown): string | null => {
  if (error instanceof ApiError) {
    return error.requestId ?? error.body?.request_id ?? null;
  }
  if (error && typeof error === 'object') {
    const source = error as Record<string, unknown>;
    const requestId = source.request_id ?? source.requestId;
    return typeof requestId === 'string' && requestId.trim() ? requestId.trim() : null;
  }
  return null;
};

const buildDemoError = (error: unknown, fallback: string): DemoUiError => {
  const requestId = readRequestIdFromError(error);
  const message = getErrorMessage(error, fallback).replace(/\s*\(Req ID: .*?\)\s*$/, '');
  return { message, requestId };
};

const DemoErrorPanel = ({
  error,
  onRetry,
}: {
  error: DemoUiError;
  onRetry?: () => void;
}) => (
  <div className="rounded-2xl border border-destructive/35 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
    <div className="flex items-start gap-3">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">La demo real no pudo continuar.</p>
        <p className="mt-1 break-words text-destructive/90">{error.message}</p>
        {error.requestId ? (
          <p className="mt-2 text-xs text-destructive/80">request_id: {error.requestId}</p>
        ) : null}
      </div>
      {onRetry ? (
        <button
          type="button"
          className="rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-semibold hover:bg-destructive/10"
          onClick={onRetry}
        >
          Reintentar
        </button>
      ) : null}
    </div>
  </div>
);

const findSectorGroup = (
  catalog: DemoCatalogResponse | null,
  sector: DemoSector | null,
): DemoSectorGroup | null => {
  if (!sector) return null;
  return catalog?.sector_groups?.find((group) => String(group.key) === String(sector)) ?? null;
};

const readSectorLabel = (group: DemoSectorGroup | null, sector: DemoSector | null) => {
  if (group?.label?.trim()) return group.label.trim();
  return sector ? formatDemoPresentationLabel(String(sector)) : 'Demo';
};

const readSectorTenantSlug = (group: DemoSectorGroup | null) => {
  const candidates = [
    group?.tenant_slug,
    group?.demo_tenant_slug,
    group?.default_tenant_slug,
    typeof group?.tenant === 'string' ? group.tenant : null,
    typeof group?.slug === 'string' ? group.slug : null,
  ];
  const candidate = candidates.find(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  );
  return candidate?.trim() ?? null;
};

const readSectorDefaultRubro = (group: DemoSectorGroup | null, sector: DemoSector | null) => {
  const candidates = [group?.default_rubro, group?.default_rubro_slug, sector];
  const candidate = candidates.find(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  );
  return candidate?.trim() ?? null;
};

const normalizeDemoText = (value?: string | number | null) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const rootMatchesSector = (root: Rubro, sector: DemoSector | null) => {
  if (!sector) return false;
  const rootAny = root as Rubro & Record<string, unknown>;
  const declaredSector = normalizeDemoText(
    [rootAny.sector, rootAny.pillar, rootAny.vertical].filter(Boolean).join(' '),
  );
  const key = normalizeDemoText(
    [root.clave, root.nombre, rootAny.key, rootAny.slug, rootAny.label, rootAny.title].filter(Boolean).join(' '),
  );
  const name = normalizeDemoText([root.nombre, rootAny.label, rootAny.title].filter(Boolean).join(' '));
  if (declaredSector && declaredSector.includes(normalizeDemoText(sector))) return true;
  if (sector === 'gobierno') {
    return root.id === 1 || declaredSector.includes('gobierno') || key.includes('municip') || name.includes('gobierno') || name.includes('public');
  }
  if (sector === 'empresas') {
    return root.id === 2 || declaredSector.includes('empresa') || declaredSector.includes('pyme') || key.includes('comercial') || name.includes('empresa') || name.includes('comerc');
  }
  if (sector === 'educacion') {
    return root.id === 3 || declaredSector.includes('educacion') || key.includes('educacion') || name.includes('coleg') || name.includes('escuela');
  }
  return key.includes(normalizeDemoText(sector)) || name.includes(normalizeDemoText(sector));
};

const getRubrosForSector = (catalog: DemoCatalogResponse | null, sector: DemoSector | null) => {
  const roots = Array.isArray(catalog?.rubros) ? catalog.rubros : [];
  return roots
    .filter((root) => rootMatchesSector(root, sector))
    .map(pruneUnavailableDemoRubro)
    .filter((root): root is Rubro => Boolean(root));
};

const isDemoRubroClickable = (rubro: Rubro) => {
  const source = rubro as Rubro & Record<string, unknown>;
  return source.demo_ready !== false && source.disabled !== true && source.enabled !== false;
};

const pruneUnavailableDemoRubro = (rubro: Rubro): Rubro | null => {
  const children = Array.isArray(rubro.subrubros)
    ? rubro.subrubros.map(pruneUnavailableDemoRubro).filter((item): item is Rubro => Boolean(item))
    : [];
  if (!isDemoRubroClickable(rubro) && !children.length) return null;
  return { ...rubro, subrubros: children };
};

const readRubroTenantSlug = (rubro: Rubro) => {
  const rubroAny = rubro as Rubro & Record<string, unknown>;
  const sessionPayload =
    rubroAny.session_payload && typeof rubroAny.session_payload === 'object'
      ? (rubroAny.session_payload as Record<string, unknown>)
      : null;
  const candidates = [
    sessionPayload?.tenant_slug,
    rubroAny.tenant_slug,
    rubroAny.demo_tenant_slug,
    rubroAny.default_tenant_slug,
    rubro.demo?.slug,
    rubroAny.slug,
  ];
  const tenantSlug = candidates.find(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  );
  return tenantSlug?.trim() ?? null;
};

const readRubroSessionPayload = (rubro: Rubro): Record<string, unknown> => {
  const rubroAny = rubro as Rubro & Record<string, unknown>;
  return rubroAny.session_payload && typeof rubroAny.session_payload === 'object'
    ? { ...(rubroAny.session_payload as Record<string, unknown>) }
    : {};
};

const findRubroByKey = (rubros: Rubro[], key: string | null) => {
  const normalizedKey = normalizeDemoText(key);
  if (!normalizedKey) return null;

  const visit = (items: Rubro[]): Rubro | null => {
    for (const rubro of items) {
      const rubroAny = rubro as Rubro & Record<string, unknown>;
      const candidates = [
        extractRubroKey(rubro),
        extractRubroLabel(rubro),
        rubro.clave,
        rubro.nombre,
        rubroAny.key,
        rubroAny.slug,
        rubroAny.rubro_slug,
        rubroAny.category_slug,
        rubroAny.label,
        rubroAny.title,
      ];
      if (candidates.some((candidate) => normalizeDemoText(candidate as string | number | null) === normalizedKey)) {
        return rubro;
      }
      const childMatch = Array.isArray(rubro.subrubros) ? visit(rubro.subrubros) : null;
      if (childMatch) return childMatch;
    }
    return null;
  };

  return visit(rubros);
};

const readSectorCatalogSlug = (sector: DemoSector | null) => {
  if (sector === 'gobierno') return 'municipio';
  if (sector === 'empresas') return null;
  if (sector === 'educacion') return 'colegio-demo';
  return null;
};

const readPersistedDemoSelection = (): DemoInitialSelection | null => {
  const storedSector = safeLocalStorage.getItem('demoSectorSeleccionado');
  const sector =
    storedSector === 'educacion' || storedSector === 'gobierno' || storedSector === 'empresas'
      ? storedSector
      : null;
  const storedRubro = safeLocalStorage.getItem('rubroSeleccionado');
  const rubro = extractRubroKey(storedRubro);

  if (!sector || !rubro) return null;

  const storedLabel = extractRubroLabel(safeLocalStorage.getItem('rubroSeleccionado_label'));
  const tenantSlug = resolveDemoTenantSlug(
    normalizeRequestedDemoTenantSlug(safeLocalStorage.getItem(DEMO_TENANT_STORAGE_KEY)),
    readSectorCatalogSlug(sector),
  );

  return {
    sector,
    rubro,
    rubroLabel: storedLabel ?? extractRubroLabel(storedRubro) ?? rubro,
    tenantSlug,
  };
};

const hasExplicitDemoSelectionQuery = (search: string) => {
  const query = new URLSearchParams(search);
  return ['sector', 'rubro', 'tenant_slug', 'tenant'].some((key) => query.has(key));
};

const resolveInitialDemoSelection = (search: string): DemoInitialSelection | null => {
  const directRouteSelection = readDemoDirectRouteSelection(search);
  if (directRouteSelection) {
    return {
      ...directRouteSelection,
      rubroLabel: directRouteSelection.rubro,
      tenantSlug: resolveDemoTenantSlug(
        directRouteSelection.tenantSlug,
        readSectorCatalogSlug(directRouteSelection.sector),
      ),
    };
  }

  if (hasExplicitDemoSelectionQuery(search)) return null;

  return readPersistedDemoSelection();
};

const getDemoPreviewIcon = (sector: DemoSector | null) => {
  if (sector === 'educacion') return GraduationCap;
  if (sector === 'gobierno') return MapPinned;
  return ShoppingCart;
};

const DEMO_PREVIEW_ICONS = {
  activity: Activity,
  analytics: BarChart3,
  bar: BarChart3,
  cart: ShoppingCart,
  catalog: FileText,
  commerce: ShoppingCart,
  education: GraduationCap,
  gauge: Gauge,
  inbox: Inbox,
  lead: Users,
  map: MapPinned,
  message: MessageSquareText,
  order: ShoppingCart,
  school: GraduationCap,
  ticket: Inbox,
  time: Clock3,
  timer: Timer,
  users: Users,
} as const;

const resolvePreviewIcon = (value?: string | null) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  const match = Object.entries(DEMO_PREVIEW_ICONS).find(([key]) => normalized.includes(key));
  return match?.[1] ?? FileText;
};

const normalizeSearchText = (value?: string | number | null) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const inferDemoAdminPanelTarget = (module: { id?: unknown; label?: unknown; title?: unknown; route?: unknown }) => {
  const haystack = normalizeSearchText(
    [module.id, module.label, module.title, module.route].filter(Boolean).join(' '),
  );
  if (haystack.includes('map') || haystack.includes('mapa') || haystack.includes('ubic')) return 'map' as const;
  if (haystack.includes('encuesta') || haystack.includes('survey') || haystack.includes('vot')) return 'surveys' as const;
  if (
    haystack.includes('reclamo') ||
    haystack.includes('ticket') ||
    haystack.includes('lead') ||
    haystack.includes('caso') ||
    haystack.includes('inbox')
  ) return 'claims' as const;
  return 'summary' as const;
};

type NormalizedPreviewModule = {
  id: string;
  label: string;
  target: DemoAdminPanelTarget;
};

const normalizePreviewModules = (preview: DemoAdminPreviewResponse | null) => {
  const modules = Array.isArray(preview?.modules) ? preview.modules : [];
  const normalized = modules
    .map<NormalizedPreviewModule | null>((module, index) => {
      const label = module.label ?? module.title ?? module.id;
      if (typeof label !== 'string' || !label.trim()) return null;
      const id = String(module.id ?? module.route ?? module.endpoint ?? `${label}-${index}`).trim();
      return {
        id: id || `${label}-${index}`,
        label: label.trim(),
        target: inferDemoAdminPanelTarget(module),
      };
    })
    .filter((module): module is NormalizedPreviewModule => Boolean(module));

  if (normalized.length) return normalized;

  const fallbackLabel = preview?.labels?.overview ?? preview?.labels?.summary ?? 'Resumen';
  return [{ id: 'summary', label: fallbackLabel || 'Resumen', target: 'summary' as const }];
};

const normalizePreviewCards = (preview: DemoAdminPreviewResponse | null) => {
  const cards = Array.isArray(preview?.cards) ? preview.cards : [];
  return cards
    .map((card, index) => {
      const label = card.label ?? card.title ?? card.id ?? card.key;
      if (!label) return null;
      return {
        id: String(card.id ?? card.key ?? `${label}-${index}`),
        label: String(label),
        value:
          typeof (card.value ?? card.status) === 'string'
            ? formatDemoPresentationLabel(String(card.value ?? card.status))
            : (card.value ?? card.status ?? ''),
        detail: card.description ?? card.detail ?? '',
        period: card.period ?? null,
        dataMode: card.data_mode ?? null,
        icon: resolvePreviewIcon(card.icon ?? card.id ?? card.key ?? card.label),
      };
    })
    .filter((card): card is {
      id: string;
      label: string;
      value: string | number;
      detail: string;
      period: string | null;
      dataMode: string | null;
      icon: React.ElementType;
    } =>
      Boolean(card),
    );
};

const formatExecutiveMetricValue = (value: string | number, unit?: string | null) => {
  const formatted =
    typeof value === 'number'
      ? EXECUTIVE_NUMBER_FORMATTER.format(value)
      : String(value);
  return unit?.trim() ? `${formatted} ${unit.trim()}` : formatted;
};

const resolveExecutiveMetricIcon = (value?: string | null) => {
  const normalized = normalizeSearchText(value);
  if (normalized.includes('sla') || normalized.includes('cumplimiento')) return Gauge;
  if (normalized.includes('whatsapp') || normalized.includes('respuesta')) return MessageSquareText;
  if (normalized.includes('encuesta') || normalized.includes('voto')) return BarChart3;
  if (normalized.includes('reclamo') || normalized.includes('caso')) return Inbox;
  return resolvePreviewIcon(value);
};

const normalizePreviewMetrics = (preview: DemoAdminPreviewResponse | null) => {
  const metrics = Array.isArray(preview?.metrics) ? preview.metrics : [];
  return metrics
    .map((metric, index) => {
      const label = metric.label ?? metric.title ?? metric.id ?? metric.key;
      if (!label || (typeof metric.value !== 'string' && typeof metric.value !== 'number')) return null;
      return {
        id: String(metric.id ?? metric.key ?? `${label}-${index}`),
        label: String(label),
        value: formatExecutiveMetricValue(metric.value, metric.unit),
        detail: metric.detail ?? metric.description ?? '',
        period: metric.period ?? null,
        dataMode: metric.data_mode ?? null,
        icon: resolveExecutiveMetricIcon(metric.icon ?? metric.id ?? metric.key ?? metric.label),
      };
    })
    .filter((metric): metric is {
      id: string;
      label: string;
      value: string;
      detail: string;
      period: string | null;
      dataMode: string | null;
      icon: React.ElementType;
    } => Boolean(metric));
};

const normalizePreviewTimeline = (preview: DemoAdminPreviewResponse | null) => {
  const timeline = Array.isArray(preview?.timeline) ? preview.timeline : [];
  return timeline
    .map((item) => ({
      id: item.id ?? item.title ?? item.label ?? item.description,
      title: item.title ?? item.label ?? item.description,
      description: item.detail ?? item.description ?? null,
      time: item.time ?? null,
      status: item.status ?? null,
      channel: item.channel ?? null,
      dataMode: item.data_mode ?? null,
    }))
    .filter((item): item is {
      id: string;
      title: string;
      description: string | null;
      time: string | null;
      status: string | null;
      channel: string | null;
      dataMode: string | null;
    } =>
      typeof item.id === 'string' && typeof item.title === 'string' && item.title.trim().length > 0,
    );
};

const normalizePreviewCases = (preview: DemoAdminPreviewResponse | null) => {
  const cases = Array.isArray(preview?.cases) ? preview.cases : [];
  return cases
    .map((item, index) => {
      const id = String(item.id ?? item.case_code ?? `case-${index}`).trim();
      const title = item.title?.trim() || item.case_code?.trim();
      if (!id || !title) return null;
      return {
        id,
        caseCode: item.case_code?.trim() || id,
        title,
        description: item.description?.trim() || null,
        category: item.category?.trim() || null,
        status: item.status?.trim() || null,
        priority: item.priority?.trim() || null,
        channel: item.channel?.trim() || null,
        zone: item.zone?.trim() || null,
        slaStatus: item.sla_status?.trim() || null,
        openedAtLabel: item.opened_at_label?.trim() || null,
        dataMode: item.data_mode?.trim() || null,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
};

const readFiniteNumber = (...values: unknown[]): number | null => {
  for (const value of values) {
    const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const readNonNegativeInteger = (...values: unknown[]): number | null => {
  const parsed = readFiniteNumber(...values);
  return parsed !== null && Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
};

const readMapPointText = (point: DemoAdminPreviewMapPoint, keys: string[]) => {
  for (const key of keys) {
    const value = point[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
};

type NormalizedPreviewMapPoint = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  address?: string | null;
  category?: string | null;
  zone?: string | null;
  status?: string | null;
  weight?: number | null;
  dataMode?: string | null;
};

const normalizePreviewMap = (preview: DemoAdminPreviewResponse | null) => {
  const map = preview?.map;
  if (!map || typeof map !== 'object') return null;
  if (map.enabled === false || map.render_contract?.can_render_map === false) return null;

  const points = Array.isArray(map.points) ? map.points : [];
  const normalizedPoints: NormalizedPreviewMapPoint[] = points
    .map<NormalizedPreviewMapPoint | null>((point, index) => {
      if (!point || typeof point !== 'object') return null;
      const lat = readFiniteNumber(point.lat, point.latitude, point.latitud);
      const lng = readFiniteNumber(point.lng, point.longitude, point.longitud);
      if (lat === null || lng === null) return null;
      const id = String(point.id ?? `${lat}:${lng}:${index}`);
      const coordinateLabel = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      return {
        id,
        label:
          readMapPointText(point, ['label', 'title', 'nro_ticket', 'ticket', 'case_id', 'id']) ??
          coordinateLabel,
        lat,
        lng,
        address: readMapPointText(point, ['address', 'direccion']),
        category: readMapPointText(point, ['category', 'categoria']),
        zone: readMapPointText(point, ['zone', 'zona']),
        status: readMapPointText(point, ['status', 'estado']),
        weight: readFiniteNumber(point.weight),
        dataMode: readMapPointText(point, ['data_mode']),
      };
    })
    .filter((point): point is NormalizedPreviewMapPoint => Boolean(point));

  if (!normalizedPoints.length) return null;
  const dataMode = map.data_mode?.trim() || preview?.data_provenance?.mode?.trim() || null;
  const isSynthetic = dataMode === 'synthetic_demo_scenario' || preview?.data_provenance?.synthetic === true;
  return {
    title:
      map.title?.trim() ||
      map.label?.trim() ||
      preview?.labels?.map_title ||
      (isSynthetic ? 'Mapa operativo del escenario' : 'Ubicaciones de la sesión'),
    description: map.description?.trim() || preview?.labels?.map_description || null,
    points: normalizedPoints,
    dataMode,
    label: map.label?.trim() || null,
    sample: map.sample === true,
    displayedPoints: readFiniteNumber(map.displayed_points, normalizedPoints.length),
    representedCases: readFiniteNumber(map.represented_cases, preview?.case_sample?.represented_cases_on_map),
    totalCases: readFiniteNumber(map.total_cases, preview?.case_sample?.total_cases),
    coverageNote: map.coverage_note?.trim() || preview?.case_sample?.label?.trim() || null,
    zoom: readFiniteNumber(map.zoom),
    center: map.center
      ? {
          lat: readFiniteNumber(map.center.lat, map.center.latitude),
          lng: readFiniteNumber(map.center.lng, map.center.longitude),
        }
      : null,
  };
};

const normalizePreviewSurveyVoting = (preview: DemoAdminPreviewResponse | null) => {
  const surveyVoting = preview?.survey_voting;
  if (!surveyVoting || surveyVoting.enabled === false) return null;
  const rawItems = Array.isArray(surveyVoting.items)
    ? surveyVoting.items
    : Array.isArray(surveyVoting.all_items)
      ? surveyVoting.all_items
      : [];
  const items = rawItems
    .map((item, index) => {
      const title = item.title?.trim() || item.titulo?.trim();
      if (!title) return null;
      const totalResponses = readFiniteNumber(
        item.results?.total_respuestas,
        item.total_respuestas,
        item.results?.seeded_responses,
        surveyVoting.seed_policy?.responses_per_item,
      ) ?? 0;
      const seededResponses = readNonNegativeInteger(
        item.results?.seeded_responses,
        item.seeded_responses,
      );
      const interactiveDemoResponses = readNonNegativeInteger(
        item.results?.interactive_demo_responses,
        item.interactive_demo_responses,
      );
      const verifiedCitizenResponses = readNonNegativeInteger(
        item.results?.verified_citizen_responses,
        item.verified_citizen_responses,
      );
      const hasPartitionedDemoComposition =
        seededResponses !== null &&
        interactiveDemoResponses !== null &&
        verifiedCitizenResponses === 0 &&
        totalResponses === seededResponses + interactiveDemoResponses;
      const options = (Array.isArray(item.results?.options) ? item.results.options : [])
        .map((option, optionIndex) => {
          const label = option.label?.trim() || option.texto?.trim();
          if (!label) return null;
          const count = readFiniteNumber(option.count, option.votos) ?? 0;
          const declaredPercentage = readFiniteNumber(option.porcentaje);
          const percentage = Math.min(
            100,
            Math.max(0, declaredPercentage ?? (totalResponses > 0 ? (count / totalResponses) * 100 : 0)),
          );
          return {
            id: `${String(item.id ?? item.slug ?? index)}-option-${optionIndex}`,
            label,
            count,
            percentage,
          };
        })
        .filter((option): option is NonNullable<typeof option> => Boolean(option));
      const segments = item.results?.segments && typeof item.results.segments === 'object'
        ? Object.entries(item.results.segments)
            .map(([key, values]) => {
              if (!Array.isArray(values)) return null;
              const items = values
                .map((value, segmentIndex) => {
                  const label = value?.label?.trim();
                  const count = readFiniteNumber(value?.count);
                  if (!label || count === null || count < 0) return null;
                  return {
                    id: `${String(item.id ?? item.slug ?? index)}-${key}-${segmentIndex}`,
                    label,
                    count,
                  };
                })
                .filter((value): value is NonNullable<typeof value> => Boolean(value));
              return items.length ? { key, items } : null;
            })
            .filter((value): value is NonNullable<typeof value> => Boolean(value))
        : [];
      const publicPagePath = item.links?.public_page_path?.trim();
      const isSynthetic =
        item.demo_mode === true ||
        item.data_provenance?.mode === 'synthetic' ||
        item.data_provenance?.contains_synthetic === true;
      return {
        id: String(item.id ?? item.slug ?? `survey-${index}`),
        title,
        description: item.description?.trim() || item.descripcion?.trim() || null,
        question: item.question?.trim() || null,
        status: item.status?.trim() || item.estado?.trim() || null,
        totalResponses,
        seededResponses,
        interactiveDemoResponses,
        verifiedCitizenResponses,
        hasPartitionedDemoComposition,
        options,
        segments,
        segmentScope: item.results?.segment_scope?.trim() || null,
        isSynthetic,
        publicPagePath: publicPagePath?.startsWith('/e/') ? publicPagePath : null,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return {
    title: surveyVoting.label?.trim() || 'Encuestas y votaciones',
    description: surveyVoting.description?.trim() || null,
    totalAvailable: readFiniteNumber(surveyVoting.total_available, items.length) ?? items.length,
    realPeople: surveyVoting.seed_policy?.real_people === true,
    items,
  };
};

const stringifyId = (value: unknown) => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
};

const hasTicketLocation = (ticket?: OperationalTicketResult | null) =>
  typeof ticket?.latitud === 'number' &&
  Number.isFinite(ticket.latitud) &&
  typeof ticket?.longitud === 'number' &&
  Number.isFinite(ticket.longitud);

const buildDemoRuntimeEvent = (
  response: unknown,
  result: LeadCaptureResponse | null,
): DemoRuntimeEvent | null => {
  if (!result) return null;
  const ticket = result.ticket ?? null;
  const ticketId =
    stringifyId(ticket?.ticket_id) ??
    stringifyId(ticket?.nro_ticket) ??
    stringifyId(result.ticket_id);
  const leadId = stringifyId(result.lead_id);
  const requestId = stringifyId(result.request_id);
  const id = ticketId ? `ticket:${ticketId}` : leadId ? `lead:${leadId}` : requestId ? `request:${requestId}` : null;
  if (!id) return null;

  return {
    id,
    leadId,
    ticketId,
    status: result.status ?? null,
    requestId,
    ticket,
    result: {
      ...result,
      raw: result.raw ?? response,
    },
    updatedAt: new Date().toISOString(),
  };
};

const readRecordString = (source: unknown, keys: string[]) => {
  if (!source || typeof source !== 'object') return null;
  const record = source as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
};

const readNestedRecord = (source: unknown, key: string) => {
  if (!source || typeof source !== 'object') return null;
  const value = (source as Record<string, unknown>)[key];
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
};

const readDemoEventDetailEndpoint = (event: DemoRuntimeEvent) =>
  event.ticket?.detail_endpoint ??
  readRecordString(event.result?.raw, ['detail_endpoint', 'detail_url', 'endpoint']) ??
  readRecordString(readNestedRecord(event.result?.raw, 'created_entity'), ['detail_endpoint', 'detail_url', 'endpoint']) ??
  readRecordString(readNestedRecord(event.result?.raw, 'ticket'), ['detail_endpoint', 'detail_url', 'endpoint']) ??
  readRecordString(readNestedRecord(event.result?.raw, 'lead'), ['detail_endpoint', 'detail_url', 'endpoint']);

const readDemoEventTicketLabel = (event: DemoRuntimeEvent) =>
  stringifyId(event.ticket?.nro_ticket) ?? event.ticketId ?? event.leadId ?? event.requestId ?? event.id;

const runtimeEventsToExecutiveClaims = (events: DemoRuntimeEvent[]): ExecutiveClaimCase[] =>
  events.map((event) => {
    const caseCode = readDemoEventTicketLabel(event);
    const category = event.ticket?.categoria?.trim() || null;
    const address = event.ticket?.direccion?.trim() || null;
    return {
      id: event.id,
      caseCode,
      title: category ? `Reclamo de ${category}` : `Caso ${caseCode}`,
      description: address ? `Ubicación declarada: ${address}` : null,
      category,
      status: event.ticket?.status?.trim() || event.status?.trim() || null,
      priority: null,
      channel:
        event.ticket?.canal_ingreso?.trim() ||
        event.result?.ticket_type?.trim() ||
        null,
      zone: null,
      slaStatus: null,
      openedAtLabel: 'Creado en esta sesión demo',
      dataMode: 'session_generated_events',
      hasLocation: hasTicketLocation(event.ticket),
    };
  });

const previewCasesToExecutiveClaims = (
  cases: ReturnType<typeof normalizePreviewCases>,
): ExecutiveClaimCase[] =>
  cases.map((item) => ({
    id: item.id,
    caseCode: item.caseCode,
    title: item.title,
    description: item.description,
    category: item.category,
    status: item.status,
    priority: item.priority,
    channel: item.channel,
    zone: item.zone,
    slaStatus: item.slaStatus,
    openedAtLabel: item.openedAtLabel,
    dataMode: item.dataMode,
    hasLocation: false,
  }));

const resolveExecutiveClaimSourceKind = ({
  cases,
  hasSessionCases,
  isSyntheticPreview,
  municipalTruth,
}: {
  cases: ExecutiveClaimCase[];
  hasSessionCases: boolean;
  isSyntheticPreview: boolean;
  municipalTruth: boolean;
}): ExecutiveClaimSourceKind => {
  if (hasSessionCases) return 'session';
  const dataModes = new Set(cases.map((item) => item.dataMode).filter((value): value is string => Boolean(value)));
  if (dataModes.size > 1) return 'mixed';
  if (isSyntheticPreview || dataModes.has('synthetic_demo_scenario')) return 'synthetic';
  if (municipalTruth) return 'verified';
  return 'unknown';
};

const runtimeEventsToMapPoints = (events: DemoRuntimeEvent[]): NormalizedPreviewMapPoint[] =>
  events
    .map<NormalizedPreviewMapPoint | null>((event) => {
      const ticket = event.ticket;
      if (!hasTicketLocation(ticket)) return null;
      const label = readDemoEventTicketLabel(event);
      return {
        id: `runtime-${event.id}`,
        label,
        lat: ticket!.latitud!,
        lng: ticket!.longitud!,
        address: ticket?.direccion ?? null,
        category: ticket?.categoria ?? null,
        status: event.status ?? null,
        dataMode: 'session_generated_events',
      };
    })
    .filter((point): point is NormalizedPreviewMapPoint => Boolean(point));

const mergePreviewMapWithRuntime = (
  previewMap: ReturnType<typeof normalizePreviewMap>,
  runtimePoints: NormalizedPreviewMapPoint[],
) => {
  if (!runtimePoints.length) return previewMap;
  if (!previewMap) {
    return {
      title: 'Ubicaciones capturadas',
      description: null,
      points: runtimePoints,
      dataMode: 'session_generated_events',
      label: 'Eventos reales de esta sesión',
      sample: false,
      displayedPoints: runtimePoints.length,
      representedCases: runtimePoints.length,
      totalCases: runtimePoints.length,
      coverageNote: 'Ubicaciones aportadas durante esta sesión demo.',
      zoom: null,
      center: null,
    };
  }

  const seen = new Set(previewMap.points.map((point) => point.id));
  const extraPoints = runtimePoints.filter((point) => !seen.has(point.id));
  return {
    ...previewMap,
    points: [...extraPoints, ...previewMap.points],
  };
};

const cardMatchesAny = (card: { label: string; detail?: string }, terms: string[]) => {
  const haystack = normalizeSearchText(`${card.label} ${card.detail ?? ''}`);
  return terms.some((term) => haystack.includes(term));
};

const hydratePreviewCardsWithRuntime = (
  cards: ReturnType<typeof normalizePreviewCards>,
  runtimeEvents: DemoRuntimeEvent[],
) => {
  const tickets = runtimeEvents.filter((event) => event.ticket || event.ticketId);
  const locations = tickets.filter((event) => hasTicketLocation(event.ticket));
  const updates = runtimeEvents.length;

  if (!tickets.length && !locations.length && !updates) return cards;

  return cards.map((card) => {
    if (tickets.length && cardMatchesAny(card, ['reclamo', 'ticket', 'caso', 'lead'])) {
      return { ...card, value: tickets.length };
    }
    if (locations.length && cardMatchesAny(card, ['ubicacion', 'ubicaciones', 'mapa', 'gps'])) {
      return { ...card, value: locations.length };
    }
    if (updates && cardMatchesAny(card, ['comentario', 'mensaje', 'actualizacion', 'chat'])) {
      return { ...card, value: updates };
    }
    return card;
  });
};

const DemoPreviewMap = ({
  title,
  description,
  points,
  dataMode,
  label,
  sample,
  displayedPoints,
  representedCases,
  totalCases,
  coverageNote,
  zoom,
  mapCenter,
}: {
  title: string;
  description?: string | null;
  points: NormalizedPreviewMapPoint[];
  dataMode?: string | null;
  label?: string | null;
  sample?: boolean;
  displayedPoints?: number | null;
  representedCases?: number | null;
  totalCases?: number | null;
  coverageNote?: string | null;
  zoom?: number | null;
  mapCenter?: { lat: number | null; lng: number | null } | null;
}) => {
  const [mapMode, setMapMode] = useState<'hybrid' | 'density' | 'points'>('hybrid');
  const rawWeights = points.map((point) => Math.max(0, point.weight ?? 1));
  const maxWeight = Math.max(1, ...rawWeights);
  const positiveWeights = rawWeights.filter((weight) => weight > 0);
  const minWeight = positiveWeights.length ? Math.min(...positiveWeights) : 0;
  const heatmapData: HeatPoint[] = points.map((point, index) => ({
    id: index + 1,
    ticket: point.label,
    lat: point.lat,
    lng: point.lng,
    weight: Math.max(0, point.weight ?? 1) / maxWeight,
    intensity: Math.max(0, point.weight ?? 1) / maxWeight,
    averageWeight: Math.max(0, point.weight ?? 1),
    totalWeight: Math.max(0, point.weight ?? 1),
    clusterSize: Math.max(1, Math.round(point.weight ?? 1)),
    clusterId: `demo-preview-zone-${point.id}`,
    barrio: point.zone ?? point.label,
    categoria: point.category ?? undefined,
    direccion: point.address ?? undefined,
    estado: point.status ?? undefined,
  }));
  const bounds = points.map((point) => [point.lng, point.lat] as [number, number]);
  const center =
    mapCenter?.lat !== null &&
    mapCenter?.lat !== undefined &&
    mapCenter?.lng !== null &&
    mapCenter?.lng !== undefined
      ? ([mapCenter.lng, mapCenter.lat] as [number, number])
      : bounds[0];
  const isSynthetic = dataMode === 'synthetic_demo_scenario';
  const provenanceLabel =
    label && normalizeSearchText(label) !== normalizeSearchText(title)
      ? label
      : isSynthetic
        ? 'Datos simulados'
        : 'Eventos de esta sesión';
  const titleId = `demo-preview-map-${isSynthetic ? 'synthetic' : 'session'}`;
  const pointCount = displayedPoints ?? points.length;
  const hasCoverage =
    typeof representedCases === 'number' && typeof totalCases === 'number' && totalCases > 0;
  const accessibleMapLabel = hasCoverage
    ? `${title}. ${pointCount} zonas muestran ${representedCases} de ${totalCases} casos. ${provenanceLabel}.`
    : `${title}. ${pointCount} ubicaciones. ${provenanceLabel}.`;

  return (
    <section
      className="overflow-hidden rounded-2xl border border-border/70 bg-background/70 shadow-sm"
      aria-labelledby={titleId}
      data-demo-map-mode={dataMode ?? 'unspecified'}
      data-testid="demo-executive-map"
    >
      <div className="flex flex-col gap-3 border-b border-border/70 bg-[linear-gradient(135deg,hsl(var(--background)),hsl(var(--muted)/0.45))] p-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 id={titleId} className="text-sm font-semibold text-foreground">{title}</h3>
          {description ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p> : null}
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          <span className="rounded-full border bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground">
            {pointCount} {sample ? 'zonas de muestra' : pointCount === 1 ? 'ubicación' : 'ubicaciones'}
          </span>
          {hasCoverage ? (
            <span className="rounded-full border bg-muted/40 px-2 py-1 text-[11px] font-semibold text-foreground">
              {EXECUTIVE_NUMBER_FORMATTER.format(representedCases)} de {EXECUTIVE_NUMBER_FORMATTER.format(totalCases)} casos
            </span>
          ) : null}
          <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-800 dark:text-amber-200">
            {provenanceLabel}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Lectura territorial</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Intensidad relativa por volumen representado. No indica prioridad ni gravedad.
          </p>
        </div>
        <div
          className="inline-flex w-fit max-w-full rounded-xl border border-border bg-background p-1 shadow-sm"
          role="group"
          aria-label="Capas del mapa demostrativo"
        >
          {([
            ['hybrid', 'Calor + puntos'],
            ['density', 'Densidad'],
            ['points', 'Puntos'],
          ] as const).map(([mode, modeLabel]) => (
            <button
              key={mode}
              type="button"
              className={`min-h-9 whitespace-nowrap rounded-lg px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 sm:px-3 ${
                mapMode === mode
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              aria-pressed={mapMode === mode}
              onClick={() => setMapMode(mode)}
            >
              {modeLabel}
            </button>
          ))}
        </div>
      </div>
      <React.Suspense
        fallback={
          <div className="flex h-48 items-center justify-center rounded-xl border text-xs text-muted-foreground">
            Cargando mapa...
          </div>
        }
      >
        <MapLibreMap
          className="h-[20rem] rounded-none border-0 sm:h-[24rem]"
          heatmapData={heatmapData}
          showHeatmap={mapMode !== 'points'}
          showPoints={mapMode !== 'density'}
          center={center}
          fitToBounds={bounds.length ? bounds : undefined}
          initialZoom={zoom ?? (bounds.length > 1 ? 12 : 14)}
          disableClientClustering
          evidence={{
            label: isSynthetic ? 'Puntos simulados' : 'Eventos de esta sesión',
            synthetic: isSynthetic,
            usingSyntheticPoints: isSynthetic,
            pointCount,
            provider: 'MapLibre',
            source: isSynthetic ? 'demo_scenario' : 'session_events',
          }}
          ariaLabel={accessibleMapLabel}
        />
      </React.Suspense>
      <div className="border-t border-border/70 bg-muted/15 px-4 py-3" data-testid="demo-map-volume-legend">
        <div className="grid gap-2">
          <div className="min-w-0 w-full">
            <div
              className="h-2.5 rounded-full border border-border/70 bg-[linear-gradient(90deg,rgba(68,1,84,.72),rgba(59,82,139,.82),rgba(33,145,140,.88),rgba(94,201,98,.92),rgba(253,231,37,.98))]"
              aria-hidden="true"
            />
            <div className="mt-1 flex justify-between text-[10px] font-medium text-muted-foreground">
              <span>{EXECUTIVE_NUMBER_FORMATTER.format(minWeight)} menor volumen</span>
              <span>{EXECUTIVE_NUMBER_FORMATTER.format(maxWeight)} mayor volumen</span>
            </div>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            Los números sobre el mapa son casos representados por cada zona de muestra.
          </p>
        </div>
      </div>
      {coverageNote ? (
        <p className="mx-4 mt-3 rounded-lg border border-amber-500/25 bg-amber-500/8 px-3 py-2 text-xs leading-5 text-foreground">
          {coverageNote}
        </p>
      ) : null}
      <div className="grid gap-2 p-4 sm:grid-cols-2">
        {points.map((point) => (
          <div key={`row-${point.id}`} className="rounded-lg border bg-muted/20 px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground">{point.label}</span>
              {point.category ? <span className="text-muted-foreground">{point.category}</span> : null}
              {point.zone ? <span className="text-muted-foreground">{point.zone}</span> : null}
              {point.status ? (
                <span className="rounded-full border bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
                  {formatDemoPresentationLabel(point.status)}
                </span>
              ) : null}
              {typeof point.weight === 'number' ? (
                <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  Volumen {EXECUTIVE_NUMBER_FORMATTER.format(point.weight)}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-muted-foreground">
              {point.address ? `${point.address} - ` : ''}
              {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};

const DemoDetailDrawer = ({
  detail,
  onClose,
}: {
  detail: DemoDetailDrawerState;
  onClose: () => void;
}) => {
  if (!detail) return null;

  const { event, endpoint, data, loading, error } = detail;
  const ticket = event.ticket;
  const detailJson = data ? JSON.stringify(data, null, 2) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 sm:items-center" role="dialog" aria-modal="true">
      <div className="max-h-[88vh] w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Seguimiento del caso</p>
            <h3 className="mt-1 truncate text-lg font-bold text-foreground">{readDemoEventTicketLabel(event)}</h3>
          </div>
          <button
            type="button"
            className="rounded-full border border-border bg-background p-2 text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            onClick={onClose}
            aria-label="Cerrar detalle"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[calc(88vh-72px)] overflow-y-auto p-4">
          <div className="grid gap-2 text-xs sm:grid-cols-2">
            {event.status ? (
              <div className="rounded-lg border bg-muted/20 px-3 py-2">
                <p className="font-medium text-muted-foreground">Estado</p>
                <p className="mt-1 text-foreground">{formatDemoPresentationLabel(event.status)}</p>
              </div>
            ) : null}
            {ticket?.categoria ? (
              <div className="rounded-lg border bg-muted/20 px-3 py-2">
                <p className="font-medium text-muted-foreground">Categoría</p>
                <p className="mt-1 text-foreground">{ticket.categoria}</p>
              </div>
            ) : null}
            {ticket?.direccion ? (
              <div className="rounded-lg border bg-muted/20 px-3 py-2 sm:col-span-2">
                <p className="font-medium text-muted-foreground">Dirección</p>
                <p className="mt-1 text-foreground">{ticket.direccion}</p>
              </div>
            ) : null}
          </div>

          {loading ? (
            <div className="mt-4 rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
              Cargando detalle operativo...
            </div>
          ) : error ? (
            <div className="mt-4">
              <DemoErrorPanel error={error} />
            </div>
          ) : detailJson ? (
            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-3 rounded-xl border border-success/25 bg-success/10 p-4 text-sm text-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                <div>
                  <p className="font-semibold">Detalle operativo sincronizado</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    El caso fue recuperado desde el backend y está disponible para seguimiento.
                  </p>
                </div>
              </div>
              <details className="rounded-xl border border-border/70 bg-muted/15">
                <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                  Ver trazabilidad técnica
                </summary>
                <div className="border-t border-border/70 p-3">
                  {event.requestId ? (
                    <p className="mb-2 break-all font-mono text-[10px] text-muted-foreground">Solicitud: {event.requestId}</p>
                  ) : null}
                  {endpoint ? (
                    <p className="mb-2 break-all font-mono text-[10px] text-muted-foreground">Origen: {endpoint}</p>
                  ) : null}
                  <pre className="max-h-64 overflow-auto rounded-lg bg-background/75 p-3 text-[11px] leading-5 text-foreground">
                    {detailJson}
                  </pre>
                </div>
              </details>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed bg-muted/10 p-4 text-sm text-muted-foreground">
              El backend no publicó un detalle ampliado. Se conserva la información confirmada durante la conversación.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const readDemoWorkspaceChatSessionId = (workspace?: DemoWorkspaceConfig | null) => {
  const bootstrap = workspace?.chat_bootstrap;
  const candidates = [
    bootstrap?.session?.chat_session_id,
    bootstrap?.session?.session_id,
    bootstrap?.headers?.['X-Chat-Session-Id'],
    bootstrap?.payload?.chat_session_id,
    bootstrap?.payload?.session_id,
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const trimmed = candidate.trim();
    if (trimmed && trimmed.length <= 64 && !trimmed.includes('.')) return trimmed;
  }
  return null;
};

const readDemoWorkspaceDemoSessionId = (workspace?: DemoWorkspaceConfig | null) => {
  const bootstrap = workspace?.chat_bootstrap;
  const candidates = [
    bootstrap?.session?.demo_session_id,
    bootstrap?.headers?.['X-Demo-Session-Id'],
    bootstrap?.headers?.['X-Demo-Session'],
    bootstrap?.payload?.demo_session_id,
    bootstrap?.query?.demo_session_id,
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const trimmed = candidate.trim();
    if (trimmed && trimmed.length <= 128 && !trimmed.includes('.')) return trimmed;
  }
  return null;
};

type ExecutiveKpi = ReturnType<typeof normalizePreviewMetrics>[number] | ReturnType<typeof normalizePreviewCards>[number];

const DemoDataProvenanceBanner = ({
  preview,
  hasRuntimeEvents,
}: {
  preview: DemoAdminPreviewResponse;
  hasRuntimeEvents: boolean;
}) => {
  const provenance = preview.data_provenance;
  const declaredMode = provenance?.mode ?? preview.operations?.data_policy ?? null;
  const isMixedPartitioned = declaredMode === 'mixed_partitioned';
  const isSynthetic =
    provenance?.synthetic === true ||
    declaredMode === 'synthetic_demo_scenario' ||
    preview.operations?.data_policy === 'synthetic_demo_scenario';
  const hasSessionEvents =
    !isSynthetic &&
    (hasRuntimeEvents || provenance?.mode === 'session_generated_events' || preview.session_activity?.has_session_data === true);

  if (isMixedPartitioned) {
    return (
      <div
        className="border-b border-border/70 bg-muted/20 px-4 py-2 text-foreground sm:px-5"
        role="note"
        aria-label="Fuentes separadas del panel demostrativo"
        data-demo-provenance="mixed-partitioned"
      >
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <span className="inline-flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" aria-hidden="true" />
              Actividad de esta sesión + encuesta demo separada
            </span>
            <span className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground group-open:hidden">Alcance</span>
          </summary>
          <div className="space-y-1 pb-1 pl-6 pt-2 text-xs leading-5 text-muted-foreground">
            <p>Reclamos y conversaciones pertenecen a esta sesión. La encuesta usa una partición sintética separada.</p>
            <p>No representa datos oficiales ni relevamiento municipal.</p>
            {provenance?.label ? <p>{provenance.label}</p> : null}
          </div>
        </details>
      </div>
    );
  }

  if (isSynthetic) {
    return (
      <div
        className="border-b border-amber-500/25 bg-amber-500/[0.07] px-4 py-2 text-foreground sm:px-5"
        role="note"
        aria-label="Advertencia sobre los datos del escenario demostrativo"
        data-demo-provenance="synthetic"
      >
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <span className="inline-flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-700 dark:text-amber-300" aria-hidden="true" />
              Escenario demostrativo · datos simulados
            </span>
            <span className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground group-open:hidden">Alcance</span>
          </summary>
          <div className="space-y-1 pb-1 pl-6 pt-2 text-xs leading-5 text-muted-foreground">
            <p>No representa datos oficiales ni relevamiento municipal.</p>
            {provenance?.label ? <p>{provenance.label}</p> : null}
            {provenance?.scenario_scope ? <p>Ámbito del escenario: {provenance.scenario_scope}</p> : null}
          </div>
        </details>
      </div>
    );
  }

  if (!hasSessionEvents) return null;

  return (
    <div
      className="border-b border-border/70 bg-muted/20 px-4 py-2 text-foreground sm:px-5"
      role="status"
      data-demo-provenance="session"
    >
      <span className="inline-flex items-center gap-2 text-xs font-semibold">
        <Radio className="h-4 w-4 text-primary" aria-hidden="true" />
        Eventos reales de esta sesión demo
      </span>
    </div>
  );
};

const DemoExecutiveKpiGrid = ({
  items,
  isSynthetic,
  isMixedPartitioned,
}: {
  items: ExecutiveKpi[];
  isSynthetic: boolean;
  isMixedPartitioned: boolean;
}) => {
  if (!items.length) return null;

  return (
    <section aria-labelledby="demo-executive-kpis-title" data-demo-kpi-grid>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 id="demo-executive-kpis-title" className="text-sm font-bold text-foreground">
            Indicadores ejecutivos
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Lectura rápida de volumen, atención y nivel de servicio.
          </p>
        </div>
        <span className="rounded-full border bg-muted/30 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
          {isMixedPartitioned ? 'Fuentes separadas' : isSynthetic ? 'Escenario simulado' : 'Sesión actual'}
        </span>
      </div>
      <ul
        className="m-0 grid list-none grid-cols-2 gap-3 p-0 2xl:grid-cols-4"
        aria-labelledby="demo-executive-kpis-title"
        data-demo-kpi-list
      >
        {items.map((item) => {
          const CardIcon = item.icon;
          const sourceLabel = item.dataMode === 'synthetic_demo_scenario'
            ? 'Demo sintética'
            : item.dataMode === 'session_generated_events'
              ? 'Sesión actual'
              : null;
          return (
            <li
              key={item.id}
              className="min-w-0 rounded-2xl border border-border/70 bg-background/80 p-3 shadow-sm sm:p-4"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CardIcon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="flex min-w-0 flex-col items-end gap-1">
                  {item.period ? (
                    <span className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {item.period}
                    </span>
                  ) : null}
                  {isMixedPartitioned && sourceLabel ? (
                    <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${
                      item.dataMode === 'synthetic_demo_scenario'
                        ? 'border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-200'
                        : 'border-primary/25 bg-primary/5 text-foreground'
                    }`}>
                      {sourceLabel}
                    </span>
                  ) : null}
                </div>
              </div>
              <dl>
                <dt className="text-xs font-medium leading-4 text-muted-foreground">{item.label}</dt>
                <dd className="mt-1 break-words text-xl font-black tracking-tight text-foreground sm:text-2xl">
                  {item.value}
                </dd>
              </dl>
              {item.detail ? <p className="mt-2 text-[11px] leading-4 text-muted-foreground">{item.detail}</p> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

const readSummaryValue = (value: string | number | null | undefined, suffix = '') => {
  if (typeof value === 'number') {
    return `${EXECUTIVE_NUMBER_FORMATTER.format(value)}${suffix}`;
  }
  if (typeof value === 'string' && value.trim()) return `${value.trim()}${suffix}`;
  return '—';
};

const readSharePercentage = (value: string | number | null | undefined) => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : null;
};

const DemoChannelSummary = ({
  summary,
  isSynthetic,
}: {
  summary: DemoAdminPreviewResponse['channel_summary'];
  isSynthetic: boolean;
}) => {
  if (!summary) return null;
  const channels = Array.isArray(summary.channels) ? summary.channels : [];
  const whatsapp = summary.whatsapp;
  const totalSummary =
    summary.total_interactions !== null && summary.total_interactions !== undefined
      ? { label: 'Interacciones', value: summary.total_interactions }
      : summary.total_cases !== null && summary.total_cases !== undefined
        ? { label: 'Casos observados', value: summary.total_cases }
        : summary.observed_cases !== null && summary.observed_cases !== undefined
          ? { label: 'Casos observados', value: summary.observed_cases }
          : summary.observed_items !== null && summary.observed_items !== undefined
            ? { label: 'Elementos observados', value: summary.observed_items }
            : null;
  const hasWhatsappMetrics = Boolean(
    whatsapp &&
      [whatsapp.conversations, whatsapp.first_response_minutes, whatsapp.resolved_without_handoff_pct].some(
        (value) => value !== null && value !== undefined,
      ),
  );

  return (
    <section
      className="rounded-2xl border border-border/70 bg-background/70 p-4"
      aria-labelledby="demo-channel-summary-title"
      data-demo-channel-summary
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Atención omnicanal</p>
          <h3 id="demo-channel-summary-title" className="mt-1 text-base font-bold text-foreground">
            {summary.label?.trim() || 'WhatsApp y nivel de servicio'}
          </h3>
        </div>
        {totalSummary ? (
          <div className="rounded-xl border bg-muted/20 px-3 py-2 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{totalSummary.label}</p>
            <p className="text-lg font-black text-foreground">{readSummaryValue(totalSummary.value)}</p>
          </div>
        ) : null}
      </div>

      {hasWhatsappMetrics ? (
        <dl className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-xl border bg-muted/15 p-3">
            <dt className="text-[10px] leading-4 text-muted-foreground">Conversaciones WhatsApp</dt>
            <dd className="mt-1 text-lg font-black text-foreground">{readSummaryValue(whatsapp?.conversations)}</dd>
          </div>
          <div className="rounded-xl border bg-muted/15 p-3">
            <dt className="text-[10px] leading-4 text-muted-foreground">Primera respuesta</dt>
            <dd className="mt-1 text-lg font-black text-foreground">
              {readSummaryValue(whatsapp?.first_response_minutes, ' min')}
            </dd>
          </div>
          <div className="rounded-xl border bg-muted/15 p-3">
            <dt className="text-[10px] leading-4 text-muted-foreground">Resueltas sin derivación</dt>
            <dd className="mt-1 text-lg font-black text-foreground">
              {readSummaryValue(whatsapp?.resolved_without_handoff_pct, ' %')}
            </dd>
          </div>
        </dl>
      ) : null}

      {channels.length ? (
        <ul className="mt-4 space-y-3" aria-label="Participación por canal">
          {channels.map((channel, index) => {
            const share = readSharePercentage(channel.share_pct);
            const label = channel.label?.trim() || channel.id?.trim() || `Canal ${index + 1}`;
            return (
              <li key={channel.id ?? `${label}-${index}`}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold text-foreground">{label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {readSummaryValue(channel.value)}{share !== null ? ` · ${readSummaryValue(share, ' %')}` : ''}
                  </span>
                </div>
                {share !== null ? (
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-label={`${label}: ${share} %`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={share}
                  >
                    <div className="h-full rounded-full bg-primary" style={{ width: `${share}%` }} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {summary.note ? (
        <p className="mt-4 rounded-xl border border-dashed bg-muted/10 px-3 py-2 text-xs leading-5 text-muted-foreground">
          {summary.note}
        </p>
      ) : null}
      {isSynthetic ? (
        <p className="mt-3 text-[11px] font-medium text-amber-800 dark:text-amber-200">
          Métricas simuladas para demostrar capacidades del producto; no aptas para decisiones públicas.
        </p>
      ) : null}
    </section>
  );
};

export const DemoAdminPreview = ({
  sector,
  rubro,
  preview,
  runtimeEvents = [],
  activeTarget = 'summary',
  onActiveTargetChange,
  onOpenEventDetail,
  showNavigation = true,
}: {
  sector: DemoSector | null;
  rubro?: string | null;
  preview?: DemoAdminPreviewResponse | null;
  runtimeEvents?: DemoRuntimeEvent[];
  activeTarget?: DemoAdminPanelTarget;
  onActiveTargetChange?: (target: DemoAdminPanelTarget) => void;
  onOpenEventDetail?: (event: DemoRuntimeEvent) => void;
  showNavigation?: boolean;
}) => {
  if (!preview) return null;

  const Icon = getDemoPreviewIcon(sector);
  const labels = preview?.labels ?? {};
  const modules = normalizePreviewModules(preview);
  const previewCases = normalizePreviewCases(preview);
  const surveyVoting = normalizePreviewSurveyVoting(preview);
  const runtimeMapPoints = runtimeEventsToMapPoints(runtimeEvents);
  const previewMap = runtimeMapPoints.length
    ? mergePreviewMapWithRuntime(null, runtimeMapPoints)
    : normalizePreviewMap(preview);
  const runtimeTickets = runtimeEvents.filter((event) => event.ticket || event.ticketId);
  const declaredDataMode = preview.data_provenance?.mode ?? preview.operations?.data_policy ?? null;
  const isSyntheticPreview =
    preview.data_provenance?.synthetic === true || declaredDataMode === 'synthetic_demo_scenario';
  const hasSessionCases =
    runtimeTickets.length > 0 ||
    previewCases.some((item) => item.dataMode === 'session_generated_events');
  const caseSourceLabel = hasSessionCases
    ? 'Eventos reales de esta sesión'
    : isSyntheticPreview || previewCases.some((item) => item.dataMode === 'synthetic_demo_scenario')
      ? 'Casos simulados'
      : 'Casos del panel';
  const executiveClaimCases = runtimeTickets.length
    ? runtimeEventsToExecutiveClaims(runtimeTickets)
    : previewCasesToExecutiveClaims(previewCases);
  const executiveClaimSourceKind = resolveExecutiveClaimSourceKind({
    cases: executiveClaimCases,
    hasSessionCases,
    isSyntheticPreview,
    municipalTruth: preview.data_provenance?.municipal_truth === true,
  });
  const runtimeClaimEventsById = new Map(runtimeTickets.map((event) => [event.id, event]));
  const canOpenRuntimeCase = runtimeTickets.length > 0 && Boolean(onOpenEventDetail);
  const canShowRuntimeCaseOnMap =
    runtimeTickets.some((event) => hasTicketLocation(event.ticket)) && Boolean(onActiveTargetChange);
  const caseSample = preview.case_sample;
  const activeModule = modules.find((module) => module.target === activeTarget) ?? modules[0];
  const title = preview.title?.trim() || rubro || readSectorLabel(null, sector);
  const subtitle = preview.subtitle?.trim() || rubro || readSectorLabel(null, sector);
  const outcome = preview.description?.trim() || preview.outcome?.trim() || "";
  const adminLabel = labels.admin_preview ?? labels.admin ?? 'Admin demo';
  const viewLabel = labels.overview ?? labels.view ?? 'Vista 360';
  const rawStatusLabel = preview.status_label?.trim() || labels.status || null;
  const statusLabel = rawStatusLabel ? formatDemoPresentationLabel(rawStatusLabel) : null;
  const executiveOverviewModel = {
    ...buildExecutiveOverviewModel(preview),
    title: 'Situación operativa y participación',
    description:
      'Volumen, nivel de servicio, canales y recorrido operativo con fuente y base declaradas por el backend.',
  };
  const showSummary = activeModule?.target === 'summary';
  const showClaims = activeModule?.target === 'claims';
  const showMap = activeModule?.target === 'map';
  const showSurveys = activeModule?.target === 'surveys';
  const visibleSurveyCount = surveyVoting?.items.length ?? 0;
  const surveyInventoryLabel = surveyVoting
    ? surveyVoting.totalAvailable > visibleSurveyCount
      ? `${visibleSurveyCount} ${visibleSurveyCount === 1 ? 'visible' : 'visibles'} de ${surveyVoting.totalAvailable} encuestas demo`
      : `${surveyVoting.totalAvailable} encuestas demo`
    : null;

  return (
    <section
      className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm backdrop-blur"
      data-demo-admin-preview
      aria-labelledby="demo-admin-preview-title"
    >
      <DemoDataProvenanceBanner preview={preview} hasRuntimeEvents={runtimeEvents.length > 0} />
      <div className="grid gap-0">
        <aside className="border-b border-border/70 bg-muted/15 px-4 py-3 sm:px-5">
          <div className={`flex items-center gap-3 ${showNavigation ? 'mb-3' : ''}`}>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">{adminLabel}</p>
              <p className="truncate text-sm font-bold text-foreground">{subtitle}</p>
            </div>
          </div>
          {showNavigation ? <nav className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Secciones del panel ejecutivo">
            {modules.map((module) => {
              const active = module.id === activeModule?.id;
              return (
              <button
                key={module.id}
                type="button"
                onClick={() => onActiveTargetChange?.(module.target)}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition ${
                  active
                    ? 'border-primary/40 bg-primary/10 font-semibold text-foreground shadow-sm'
                    : 'border-border/60 bg-background/60 text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>{module.label}</span>
                {active ? <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" /> : null}
              </button>
              );
            })}
          </nav> : null}
        </aside>

        <div className="p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">{viewLabel}</p>
              <h2 id="demo-admin-preview-title" className="mt-1 text-xl font-bold tracking-tight text-foreground sm:text-2xl">{title}</h2>
              {outcome ? <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">{outcome}</p> : null}
            </div>
            {statusLabel ? (
              <span className="w-fit rounded-full border border-success/25 bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                {statusLabel}
              </span>
            ) : null}
          </div>

          <div role="region" aria-label={activeModule?.label ?? 'Resumen'}>
          {showSummary ? (
            <ExecutiveOverviewPanel model={executiveOverviewModel} showSourceDisclosure={false} />
          ) : null}

          {showClaims ? (
            <ExecutiveClaimsPanel
              cases={executiveClaimCases}
              sourceKind={executiveClaimSourceKind}
              sourceLabel={caseSourceLabel}
              showSourceDisclosure={false}
              sample={!runtimeTickets.length && caseSample ? {
                isSample: caseSample.sample === true,
                displayedCases: readNonNegativeInteger(caseSample.displayed_cases),
                totalCases: readNonNegativeInteger(caseSample.total_cases),
                label: caseSample.label ?? null,
              } : null}
              orderLabel={runtimeTickets.length
                ? 'Casos creados durante esta sesión, en orden de actualización.'
                : 'Orden priorizado publicado por el backend para la muestra visible.'}
              emptyDescription="El listado se completa cuando el chat crea un caso en esta sesión o el backend publica una cola operativa."
              onOpenCase={canOpenRuntimeCase ? (item) => {
                const event = runtimeClaimEventsById.get(item.id);
                if (event) onOpenEventDetail?.(event);
              } : undefined}
              onShowCaseOnMap={canShowRuntimeCaseOnMap
                ? () => onActiveTargetChange?.('map')
                : undefined}
            />
          ) : null}

          {showMap ? (
            <div className="grid gap-3">
              {previewMap ? (
                <DemoPreviewMap
                  title={previewMap.title}
                  description={previewMap.description}
                  points={previewMap.points}
                  dataMode={previewMap.dataMode}
                  label={previewMap.label}
                  sample={previewMap.sample}
                  displayedPoints={previewMap.displayedPoints}
                  representedCases={previewMap.representedCases}
                  totalCases={previewMap.totalCases}
                  coverageNote={previewMap.coverageNote}
                  zoom={previewMap.zoom}
                  mapCenter={previewMap.center}
                />
              ) : (
                <div className="rounded-xl border border-dashed border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
                  El mapa se activa cuando el backend devuelve coordenadas o el usuario comparte ubicacion.
                </div>
              )}
            </div>
          ) : null}

          {showSurveys ? (
            <ExecutiveSurveyPanel
              surveyVoting={surveyVoting}
              inventoryLabel={surveyInventoryLabel}
              fallbackTitle={labels.surveys_title || labels.surveys || activeModule?.label || 'Encuestas y votaciones'}
              fallbackDescription={labels.surveys_description || undefined}
            />
          ) : null}
        </div>
      </div>
      </div>
    </section>
  );
};

const Demo = () => {
  const location = useLocation();
  const [initialSelection] = useState(
    () => resolveInitialDemoSelection(location.search),
  );
  const [rubroSeleccionado, setRubroSeleccionado] = useState<string | null>(
    () => initialSelection?.rubroLabel ?? null,
  );
  const [rubroClaveSeleccionado, setRubroClaveSeleccionado] = useState<string | null>(
    () => initialSelection?.rubro ?? null,
  );
  const [rubrosDisponibles, setRubrosDisponibles] = useState<Rubro[]>([]);
  const [esperandoRubro, setEsperandoRubro] = useState(() => !initialSelection);
  const [sectorSeleccionado, setSectorSeleccionado] = useState<DemoSector | null>(
    () => initialSelection?.sector ?? null,
  );
  const [demoCatalog, setDemoCatalog] = useState<DemoCatalogResponse | null>(null);
  const [demoTenantSlug, setDemoTenantSlug] = useState<string | null>(
    () => initialSelection?.tenantSlug ?? null,
  );
  const [demoWorkspace, setDemoWorkspace] = useState<DemoWorkspaceConfig | null>(null);
  const [demoSessionLoading, setDemoSessionLoading] = useState(() => Boolean(initialSelection));
  const [demoAdminPreview, setDemoAdminPreview] = useState<DemoAdminPreviewResponse | null>(null);
  const [demoError, setDemoError] = useState<DemoUiError | null>(null);
  const [demoRuntimeEvents, setDemoRuntimeEvents] = useState<DemoRuntimeEvent[]>([]);
  const [demoAdminPanelTarget, setDemoAdminPanelTarget] = useState<DemoAdminPanelTarget>('summary');
  const [demoJourneyTarget, setDemoJourneyTarget] = useState<ExecutiveDemoJourneyTarget>('overview');
  const [demoDetailDrawer, setDemoDetailDrawer] = useState<DemoDetailDrawerState>(null);
  const initialDemoLoadRef = useRef(false);
  const hydratedSessionRef = useRef(false);
  const demoQuery = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const requestedSandboxSector = demoQuery.get('sector');
  const requestedSandboxRubro = demoQuery.get('rubro');
  const requestedSandboxTenant = demoQuery.get('tenant_slug') ?? demoQuery.get('tenant');
  const requestedDemoTenantSlug = useMemo(
    () => normalizeRequestedDemoTenantSlug(requestedSandboxTenant),
    [requestedSandboxTenant],
  );

  const selectedSectorGroup = findSectorGroup(demoCatalog, sectorSeleccionado);
  const visibleRubrosDisponibles = useMemo(
    () => getRubrosForSector({ rubros: rubrosDisponibles }, sectorSeleccionado),
    [rubrosDisponibles, sectorSeleccionado],
  );
  const demoPreviewTenantSlug = useMemo(
    () => resolveDemoTenantSlug(
      requestedDemoTenantSlug,
      demoTenantSlug,
      readSectorTenantSlug(selectedSectorGroup),
      readSectorCatalogSlug(sectorSeleccionado),
    ),
    [demoTenantSlug, requestedDemoTenantSlug, sectorSeleccionado, selectedSectorGroup],
  );
  const demoPreviewChatSessionId = useMemo(
    () => readDemoWorkspaceChatSessionId(demoWorkspace),
    [demoWorkspace],
  );
  const demoPreviewDemoSessionId = useMemo(
    () => readDemoWorkspaceDemoSessionId(demoWorkspace),
    [demoWorkspace],
  );


  // Action: reset demo and choose another rubro
  const handleChangeRubro = () => {
    safeLocalStorage.removeItem("rubroSeleccionado");
    safeLocalStorage.removeItem("rubroSeleccionado_label");
    resetChatSessionId();
    setRubroSeleccionado(null);
    setRubroClaveSeleccionado(null);
    setEsperandoRubro(true);
    setSectorSeleccionado(null);
    setDemoTenantSlug(null);
    setDemoWorkspace(null);
    setDemoSessionLoading(false);
    setDemoAdminPreview(null);
    setDemoError(null);
    setDemoRuntimeEvents([]);
    setDemoDetailDrawer(null);
    setDemoAdminPanelTarget('summary');
    setDemoJourneyTarget('conversation');
    hydratedSessionRef.current = false;
    // The useEffect for loading rubros will trigger again due to rubroSeleccionado being null
    // or rather, we explicitly set esperandoRubro to true and then the rubro loading logic runs
    getDemoCatalog()
        .then((data) => {
          setDemoError(null);
          setDemoCatalog(data);
          setRubrosDisponibles(Array.isArray(data?.rubros) ? data.rubros : []);
        })
        .catch((error) => {
          setDemoCatalog(null);
          setRubrosDisponibles([]);
          setDemoError(buildDemoError(error, 'No se pudo cargar el catalogo de demos.'));
        });
  };


  const openDemoWidget = useCallback(() => {
    try {
      (window as any).chatbocOpenWidget?.();
    } catch (error) {
      console.debug('No se pudo abrir el widget en demo', error);
    }
  }, []);

  const refreshDemoAdminPreview = useCallback(async () => {
    if (!sectorSeleccionado) {
      setDemoAdminPreview(null);
      return null;
    }

    try {
      const preview = await getDemoAdminPreview({
        sector: sectorSeleccionado,
        tenant_slug: demoPreviewTenantSlug,
        chat_session_id: demoPreviewChatSessionId,
        demo_session_id: demoPreviewDemoSessionId,
        presentation_mode: sectorSeleccionado === 'gobierno' ? 'executive' : null,
      });
      setDemoAdminPreview(preview);
      return preview;
    } catch {
      setDemoAdminPreview(null);
      return null;
    }
  }, [demoPreviewChatSessionId, demoPreviewDemoSessionId, demoPreviewTenantSlug, sectorSeleccionado]);

  useEffect(() => {
    setDemoRuntimeEvents([]);
  }, [demoPreviewChatSessionId]);

  // A late demo-session bootstrap must not erase a panel the visitor already
  // selected. Reset navigation only when the actual demo scope changes; the
  // chat session can hydrate or rotate independently while the operator keeps
  // working in the same executive view.
  useEffect(() => {
    setDemoAdminPanelTarget('summary');
    setDemoJourneyTarget('overview');
  }, [demoPreviewTenantSlug, rubroClaveSeleccionado, sectorSeleccionado]);

  const handleDemoAdminPanelTargetChange = useCallback((target: DemoAdminPanelTarget) => {
    setDemoAdminPanelTarget(target);
    setDemoJourneyTarget(
      target === 'summary'
        ? 'overview'
        : target === 'claims' || target === 'surveys'
          ? target
          : 'analytics',
    );
  }, []);

  const handleDemoJourneySelect = useCallback((target: ExecutiveDemoJourneyTarget) => {
    setDemoJourneyTarget(target);

    if (target !== 'conversation') {
      setDemoAdminPanelTarget(
        target === 'overview'
          ? 'summary'
          : target === 'analytics'
            ? 'map'
            : target,
      );
    }

    window.requestAnimationFrame(() => {
      const destinationId = target === 'conversation' ? 'demo-conversation-workspace' : 'demo-executive-workspace';
      const destination = document.getElementById(destinationId);
      if (!destination) return;

      const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      destination.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'start',
      });
      destination.focus({ preventScroll: true });
    });
  }, []);

  const handleDemoRuntimeResult = useCallback(
    (response: unknown, result: LeadCaptureResponse | null) => {
      const event = buildDemoRuntimeEvent(response, result);
      if (event) {
        setDemoRuntimeEvents((current) => {
          const withoutCurrent = current.filter((item) => item.id !== event.id);
          return [...withoutCurrent, event].slice(-20);
        });
        if (event.ticket || event.ticketId) {
          setDemoAdminPanelTarget('claims');
          setDemoJourneyTarget('claims');
        }
      }
      void refreshDemoAdminPreview();
    },
    [refreshDemoAdminPreview],
  );

  const handleOpenDemoDetail = useCallback(
    (event: DemoRuntimeEvent) => {
      const destination = normalizeDemoDetailDestination(readDemoEventDetailEndpoint(event));

      if (destination.kind === 'public_tracking') {
        window.open(destination.href, '_blank', 'noopener,noreferrer');
        return;
      }

      const endpoint = destination.kind === 'api' ? destination.href : null;
      setDemoDetailDrawer({
        event,
        endpoint,
        data: null,
        loading: Boolean(endpoint),
        error: null,
      });

      if (!endpoint) return;

      void apiFetch<unknown>(endpoint, {
        method: 'GET',
        tenantSlug: demoPreviewTenantSlug ?? undefined,
        persistTenantSlug: false,
        suppressPanel401Redirect: true,
      })
        .then((data) => {
          setDemoDetailDrawer((current) =>
            current?.event.id === event.id
              ? {
                  ...current,
                  data,
                  loading: false,
                  error: null,
                }
              : current,
          );
        })
        .catch((error) => {
          setDemoDetailDrawer((current) =>
            current?.event.id === event.id
              ? {
                  ...current,
                  loading: false,
                  error: buildDemoError(error, 'No se pudo cargar el detalle operativo.'),
                }
              : current,
          );
        });
    },
    [demoPreviewTenantSlug],
  );

  useEffect(() => {
    if (!sectorSeleccionado) {
      setDemoAdminPreview(null);
      return;
    }

    let active = true;
    getDemoAdminPreview({
      sector: sectorSeleccionado,
      tenant_slug: demoPreviewTenantSlug,
      chat_session_id: demoPreviewChatSessionId,
      demo_session_id: demoPreviewDemoSessionId,
      presentation_mode: sectorSeleccionado === 'gobierno' ? 'executive' : null,
    })
      .then((preview) => {
        if (active) setDemoAdminPreview(preview);
      })
      .catch(() => {
        if (active) setDemoAdminPreview(null);
      });

    return () => {
      active = false;
    };
  }, [demoPreviewChatSessionId, demoPreviewDemoSessionId, demoPreviewTenantSlug, sectorSeleccionado]);

  useEffect(() => {
    if (hydratedSessionRef.current) return;
    const state = location.state as
      | {
          demoSession?: Awaited<ReturnType<typeof createDemoSession>>;
          sector?: DemoSector;
          rubroLabel?: string;
          rubroSlug?: string;
        }
      | null;
    const sessionId = new URLSearchParams(location.search).get('session');
    if (!sessionId || !state?.demoSession) return;

    hydratedSessionRef.current = true;
    const session = state.demoSession;
    const sector = state.sector ?? sectorSeleccionado ?? null;
    const rubroLabel = state.rubroLabel ?? state.rubroSlug ?? sector ?? null;
    setDemoCatalog((current) => current ?? { sectors: sector ? [sector] : [] });
    setSectorSeleccionado(sector);
    setRubroSeleccionado(rubroLabel);
    setRubroClaveSeleccionado(state.rubroSlug ?? rubroLabel);
    setDemoTenantSlug(session.tenant_slug ?? null);
    setDemoWorkspace(session.workspace ?? null);
    setDemoSessionLoading(false);
    setEsperandoRubro(false);
    openDemoWidget();
    setDemoError(null);
  }, [location.search, location.state, openDemoWidget, sectorSeleccionado]);

  // Load rubros and handle initial welcome message
  useEffect(() => {
    if (initialDemoLoadRef.current) return;
    initialDemoLoadRef.current = true;

    const hasExplicitSelection = hasExplicitDemoSelectionQuery(location.search);
    const storedClave = hasExplicitSelection ? null : safeLocalStorage.getItem("rubroSeleccionado");
    const storedLabel = hasExplicitSelection ? null : safeLocalStorage.getItem("rubroSeleccionado_label");
    const storedSector = hasExplicitSelection ? null : safeLocalStorage.getItem("demoSectorSeleccionado");
    const storedDemoTenantSlug = hasExplicitSelection
      ? null
      : normalizeRequestedDemoTenantSlug(safeLocalStorage.getItem(DEMO_TENANT_STORAGE_KEY));
    const requestedSector = new URLSearchParams(location.search).get('sector') as DemoSector | null;
    const normalizedRequestedSector =
      requestedSector === 'educacion' || requestedSector === 'gobierno' || requestedSector === 'empresas'
        ? requestedSector
        : null;
    const requestedRubro = new URLSearchParams(location.search).get('rubro')?.trim() || null;
    const effectiveStoredClave =
      normalizedRequestedSector && storedSector !== normalizedRequestedSector ? null : storedClave;
    const effectiveStoredLabel = effectiveStoredClave ? storedLabel : null;

    if (normalizedRequestedSector && requestedRubro) {
      // Deep links are presentation entry points. Move to the requested workspace
      // immediately and warm the executive preview in parallel with catalog/session
      // bootstrap instead of leaving the visitor on the generic sector selector.
      setSectorSeleccionado(normalizedRequestedSector);
      setRubroSeleccionado(requestedRubro);
      setRubroClaveSeleccionado(requestedRubro);
      setDemoTenantSlug(requestedDemoTenantSlug ?? readSectorCatalogSlug(normalizedRequestedSector));
      setDemoWorkspace(null);
      setDemoSessionLoading(true);
      setEsperandoRubro(false);
      void (async () => {
        const data = demoCatalog ?? await getDemoCatalog();
        if (!demoCatalog) {
          setDemoError(null);
          setDemoCatalog(data);
          setRubrosDisponibles(Array.isArray(data?.rubros) ? data.rubros : []);
        }
        const catalogGroup = findSectorGroup(data, normalizedRequestedSector);
        const sectorRubros = getRubrosForSector(data, normalizedRequestedSector);
        const requestedRubroMeta = findRubroByKey(sectorRubros, requestedRubro);
        const sessionPayload = requestedRubroMeta ? readRubroSessionPayload(requestedRubroMeta) : {};
        const sessionTenantSlug = resolveDemoTenantSlug(
          requestedDemoTenantSlug,
          requestedRubroMeta ? readRubroTenantSlug(requestedRubroMeta) : null,
          readSectorTenantSlug(catalogGroup),
          readSectorCatalogSlug(normalizedRequestedSector),
        );
        safeLocalStorage.setItem("demoSectorSeleccionado", normalizedRequestedSector);
        safeLocalStorage.setItem("rubroSeleccionado", requestedRubro);
        safeLocalStorage.setItem("rubroSeleccionado_label", requestedRubro);
        const session = await createDemoSession({
          ...sessionPayload,
          sector: normalizedRequestedSector,
          tenant_slug: sessionTenantSlug,
          rubro: requestedRubro,
          rubro_slug: requestedRubro,
          pillar: normalizedRequestedSector,
          category_slug: requestedRubro,
        });
        setDemoError(null);
        setSectorSeleccionado(normalizedRequestedSector);
        setRubroSeleccionado(requestedRubro);
        setRubroClaveSeleccionado(requestedRubro);
        setDemoTenantSlug(session.tenant_slug ?? sessionTenantSlug ?? null);
        setDemoWorkspace(session.workspace ?? null);
        setDemoSessionLoading(false);
        setEsperandoRubro(false);
        openDemoWidget();
      })().catch((error) => {
        setDemoSessionLoading(false);
        setSectorSeleccionado(normalizedRequestedSector);
        setRubroClaveSeleccionado(requestedRubro);
        setEsperandoRubro(true);
        setDemoError(buildDemoError(error, 'No se pudo iniciar la demo real.'));
      });
      return;
    }

    if (normalizedRequestedSector && !effectiveStoredClave) {
      void (async () => {
        const catalog = demoCatalog ?? await getDemoCatalog();
        if (!demoCatalog) {
          setDemoCatalog(catalog);
          setRubrosDisponibles(Array.isArray(catalog?.rubros) ? catalog.rubros : []);
        }
        const catalogGroup = findSectorGroup(catalog, normalizedRequestedSector);
        const sectorRubros = getRubrosForSector(catalog, normalizedRequestedSector);
        const label = readSectorLabel(catalogGroup, normalizedRequestedSector);
        const defaultRubro = readSectorDefaultRubro(catalogGroup, normalizedRequestedSector);
        safeLocalStorage.setItem("demoSectorSeleccionado", normalizedRequestedSector);
        safeLocalStorage.removeItem("rubroSeleccionado");
        safeLocalStorage.removeItem("rubroSeleccionado_label");
        setDemoError(null);
        setSectorSeleccionado(normalizedRequestedSector);
        setRubroSeleccionado(null);
        setRubroClaveSeleccionado(null);
        setDemoTenantSlug(null);
        setDemoWorkspace(null);

        if (sectorRubros.length > 0) {
          setEsperandoRubro(true);
          return null;
        }

        if (normalizedRequestedSector === 'empresas') {
          setEsperandoRubro(true);
          setDemoError({
            message: 'No hay rubros publicados para Empresas en este momento.',
            requestId: typeof catalog?.request_id === 'string' ? catalog.request_id : null,
          });
          return null;
        }

        safeLocalStorage.setItem("rubroSeleccionado", defaultRubro ?? normalizedRequestedSector);
        safeLocalStorage.setItem("rubroSeleccionado_label", label);
        const session = await createDemoSession({
          sector: normalizedRequestedSector,
          tenant_slug: resolveDemoTenantSlug(
            requestedDemoTenantSlug,
            readSectorTenantSlug(catalogGroup),
            readSectorCatalogSlug(normalizedRequestedSector),
          ),
          rubro: defaultRubro ?? normalizedRequestedSector,
          rubro_slug: defaultRubro ?? normalizedRequestedSector,
          pillar: normalizedRequestedSector,
          category_slug: defaultRubro ?? normalizedRequestedSector,
        });
        return { session, label, defaultRubro };
      })()
        .then((result) => {
          if (!result) return;
          const { session, label, defaultRubro } = result;
          setDemoError(null);
          setSectorSeleccionado(normalizedRequestedSector);
          setRubroSeleccionado(label);
          setRubroClaveSeleccionado(defaultRubro ?? normalizedRequestedSector);
          setDemoTenantSlug(session.tenant_slug ?? null);
          setDemoWorkspace(session.workspace ?? null);
          setDemoSessionLoading(false);
          setEsperandoRubro(false);
          openDemoWidget();
          setDemoError(null);
        })
        .catch((error) => {
          setDemoSessionLoading(false);
          setEsperandoRubro(true);
          setDemoError(buildDemoError(error, 'No se pudo iniciar la demo real.'));
        });
      return;
    }

    if (effectiveStoredClave) {
      const normalizedClave = extractRubroKey(effectiveStoredClave) ?? effectiveStoredClave;
      const restoredSector = normalizedRequestedSector ?? (
        storedSector === 'educacion' || storedSector === 'gobierno' || storedSector === 'empresas'
          ? storedSector
          : null
      );
      const restoredTenantSlug = resolveDemoTenantSlug(
        requestedDemoTenantSlug,
        storedDemoTenantSlug,
        readSectorCatalogSlug(restoredSector),
      );
      setSectorSeleccionado(restoredSector);
      setDemoTenantSlug(restoredTenantSlug);
      setDemoSessionLoading(true);
      void createDemoSession({
        sector: restoredSector ?? undefined,
        pillar: restoredSector ?? undefined,
        rubro: normalizedClave,
        rubro_slug: normalizedClave,
        category_slug: normalizedClave,
        tenant_slug: restoredTenantSlug,
      })
        .then((session) => {
          setDemoError(null);
          setRubroClaveSeleccionado(normalizedClave);
          if (!rubroSeleccionado) {
            setRubroSeleccionado(effectiveStoredLabel || effectiveStoredClave);
          }
          setDemoTenantSlug(session.tenant_slug ?? null);
          setDemoWorkspace(session.workspace ?? null);
          setDemoSessionLoading(false);
          setEsperandoRubro(false);
          openDemoWidget();
          setDemoError(null);
        })
        .catch((error) => {
          setDemoSessionLoading(false);
          safeLocalStorage.removeItem("rubroSeleccionado");
          safeLocalStorage.removeItem("rubroSeleccionado_label");
          safeLocalStorage.removeItem("demoSectorSeleccionado");
          setEsperandoRubro(true);
          setDemoError(buildDemoError(error, 'No se pudo recuperar la demo anterior.'));
        });
    } else if (!effectiveStoredClave) {
      setEsperandoRubro(true);
      getDemoCatalog()
        .then((data) => {
          setDemoError(null);
          setDemoCatalog(data);
          setRubrosDisponibles(Array.isArray(data?.rubros) ? data.rubros : []);
        })
        .catch((error) => {
          setDemoCatalog(null);
          setRubrosDisponibles([]);
          setDemoError(buildDemoError(error, 'No se pudo cargar el catalogo de demos.'));
        });
    }
  }, [location.search, location.state, requestedDemoTenantSlug, rubroClaveSeleccionado, rubroSeleccionado, openDemoWidget]);

  const startSectorDemo = useCallback(async () => {
    if (!sectorSeleccionado) return;
    const sector = sectorSeleccionado;
    const group = findSectorGroup(demoCatalog, sector);
    const sectorRubros = getRubrosForSector(demoCatalog, sector);
    const label = readSectorLabel(group, sector);
    const tenantSlug = resolveDemoTenantSlug(requestedDemoTenantSlug, readSectorTenantSlug(group));
    const defaultRubro = readSectorDefaultRubro(group, sector);

    if (sector === 'empresas') {
      setSectorSeleccionado(sector);
      setRubroSeleccionado(null);
      setRubroClaveSeleccionado(null);
      setDemoTenantSlug(null);
      setDemoWorkspace(null);
      setEsperandoRubro(true);
      setDemoError(
        sectorRubros.length
          ? null
          : {
              message: 'No hay rubros publicados para Empresas en este momento.',
              requestId: typeof demoCatalog?.request_id === 'string' ? demoCatalog.request_id : null,
            },
      );
      return;
    }

    if (sectorRubros.length > 0) {
      setSectorSeleccionado(sector);
      setEsperandoRubro(true);
      setDemoError(null);
      return;
    }

    setSectorSeleccionado(sector);
    setRubroSeleccionado(label);
    setRubroClaveSeleccionado(defaultRubro ?? sector);
    setEsperandoRubro(false);
    setDemoError(null);
    safeLocalStorage.setItem("demoSectorSeleccionado", sector);
    safeLocalStorage.setItem("rubroSeleccionado", defaultRubro ?? sector);
    safeLocalStorage.setItem("rubroSeleccionado_label", label);
    openDemoWidget();
    setDemoSessionLoading(true);

    try {
      const session = await createDemoSession({
        sector,
        tenant_slug: tenantSlug,
        rubro: defaultRubro ?? sector,
        rubro_slug: defaultRubro ?? sector,
        pillar: sector,
        category_slug: defaultRubro ?? String(sector),
      });
      setDemoTenantSlug(session.tenant_slug ?? tenantSlug ?? null);
      setDemoWorkspace(session.workspace ?? null);
      setDemoSessionLoading(false);
      setDemoError(null);
    } catch (error) {
      setDemoSessionLoading(false);
      setDemoError(buildDemoError(error, 'No se pudo iniciar la demo real.'));
    }
  }, [demoCatalog, openDemoWidget, requestedDemoTenantSlug, sectorSeleccionado]);

  // Rubros selector UI
  if (esperandoRubro) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8 text-foreground dark:bg-gradient-to-b dark:from-[#10141b] dark:to-[#181d24]">
        <div className="w-full max-w-5xl rounded-[2rem] border border-border bg-card/90 p-5 shadow-2xl shadow-black/10 backdrop-blur dark:bg-[#191f2b] sm:p-7">
          <div className="mb-5 flex items-center gap-3 text-left">
            <img
              src={CHATBOC_ORBIT_AVATAR}
              alt="Chatboc"
              className="h-11 w-11 rounded-full border border-primary/20 bg-primary/10 p-0.5"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/favicon/favicon-48x48.png";
              }}
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Demo guiada</p>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Elegí una operación real para probar</h1>
            </div>
          </div>
          <p className="mb-5 max-w-2xl text-left text-sm leading-6 text-muted-foreground">
            La demo muestra capacidades disponibles y permite ver cómo una conversación se convierte en una acción operativa.
          </p>
          {demoError ? (
            <div className="mb-4">
              <DemoErrorPanel error={demoError} onRetry={sectorSeleccionado ? () => void startSectorDemo() : undefined} />
            </div>
          ) : null}
          <div className="mb-4">
            <DemoSectorStep
              sectors={demoCatalog?.sectors}
              sectorGroups={demoCatalog?.sector_groups}
              selectedSector={sectorSeleccionado}
              onSelect={setSectorSeleccionado}
            />
          </div>
          <div className="mb-5">
            <WhatsappSandboxLauncher
              initialSector={sectorSeleccionado ?? requestedSandboxSector}
              initialRubro={rubroClaveSeleccionado ?? requestedSandboxRubro}
              initialTenantSlug={demoPreviewTenantSlug ?? requestedSandboxTenant}
            />
          </div>
          {sectorSeleccionado ? null : (
            <p className="mb-3 text-xs text-muted-foreground">Seleccioná un sector para iniciar una demo guiada.</p>
          )}
          {sectorSeleccionado && visibleRubrosDisponibles.length === 0 ? (
            <div className="space-y-3 rounded-lg border bg-background/70 p-3 text-left">
              {selectedSectorGroup?.description ? (
                <p className="text-sm text-muted-foreground">{selectedSectorGroup.description}</p>
              ) : null}
              <button
                type="button"
                className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                onClick={() => void startSectorDemo()}
              >
                {selectedSectorGroup?.cta_label?.trim() || 'Iniciar demo'}
              </button>
            </div>
          ) : (
            <RubroSelector
              rubros={sectorSeleccionado ? visibleRubrosDisponibles : []}
              onSelect={(rubro) => {
              const clave = extractRubroKey(rubro);
              const etiqueta = extractRubroLabel(rubro) || rubro.nombre;

              if (!clave && !etiqueta) {
                console.warn('Demo: rubro recibido sin datos suficientes', rubro);
                return;
              }

              if (clave) {
                safeLocalStorage.setItem("rubroSeleccionado", clave);
              } else {
                safeLocalStorage.removeItem("rubroSeleccionado");
              }

              if (etiqueta) {
                safeLocalStorage.setItem("rubroSeleccionado_label", etiqueta);
              } else {
                safeLocalStorage.removeItem("rubroSeleccionado_label");
              }

              if (!sectorSeleccionado) {
                return;
              }

              safeLocalStorage.setItem("demoSectorSeleccionado", sectorSeleccionado);
              setRubroSeleccionado(etiqueta || clave || null);
              setRubroClaveSeleccionado(clave ?? null);
              setEsperandoRubro(false);
              setDemoError(null);
              setDemoSessionLoading(true);
              openDemoWidget();
              void (async () => {
                try {
                  const rubroAny = rubro as Rubro & Record<string, unknown>;
                  const sessionPayload = readRubroSessionPayload(rubro);
                  const selectedRubro =
                    clave ??
                    (typeof rubroAny.rubro_slug === 'string' ? rubroAny.rubro_slug : null) ??
                    (typeof rubroAny.category_slug === 'string' ? rubroAny.category_slug : null) ??
                    etiqueta ??
                    rubro.nombre;
                  const sessionTenantSlug = resolveDemoTenantSlug(
                    requestedDemoTenantSlug,
                    readRubroTenantSlug(rubro),
                    readSectorTenantSlug(selectedSectorGroup),
                  );
                  const session = await createDemoSession({
                    ...sessionPayload,
                    sector: sectorSeleccionado,
                    rubro: selectedRubro,
                    rubro_slug: selectedRubro,
                    category_slug: selectedRubro,
                    tenant_slug: sessionTenantSlug,
                  });
                  setDemoTenantSlug(session.tenant_slug ?? sessionTenantSlug ?? null);
                  setDemoWorkspace(session.workspace ?? null);
                  setDemoSessionLoading(false);
                  setDemoError(null);
                } catch (error) {
                  setDemoSessionLoading(false);
                  setDemoError(buildDemoError(error, 'No se pudo iniciar la demo real.'));
                }
              })();
            }}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-[calc(100dvh-5rem)] w-full flex-col items-center bg-background text-foreground"
      data-testid="demo-route-shell"
      data-demo-route-state={demoSessionLoading ? 'loading' : 'ready'}
      data-demo-active-view={demoJourneyTarget}
    >
      <div className="w-full max-w-[90rem] flex-1 space-y-4 py-4 sm:py-5">
        <ExecutiveDemoJourney
          activeTarget={demoJourneyTarget}
          onSelect={handleDemoJourneySelect}
          onChangeContext={handleChangeRubro}
          scenarioContext={demoAdminPreview?.survey_voting?.items
            ?.flatMap((survey) => [survey.slug, survey.title, survey.titulo, survey.question])
            .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
            .join(' ')}
          scenarioScope={
            demoAdminPreview?.data_provenance?.scenario_scope ??
            demoAdminPreview?.data_provenance?.tenant_scope ??
            demoWorkspace?.label ??
            formatDemoPresentationLabel(demoPreviewTenantSlug)
          }
        />

        {demoError ? (
          <DemoErrorPanel error={demoError} onRetry={sectorSeleccionado ? () => void startSectorDemo() : undefined} />
        ) : null}

        <div
          className="min-h-[32rem]"
          data-demo-workspace-shell
        >
          <div
            id="demo-conversation-workspace"
            className="mx-auto min-w-0 max-w-5xl scroll-mt-24 space-y-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            tabIndex={-1}
            hidden={demoJourneyTarget !== 'conversation'}
          >
            <details className="group overflow-hidden rounded-xl border border-border/70 bg-card" data-demo-whatsapp-access>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50">
                <span className="flex items-center gap-2">
                  <MessageSquareText className="h-4 w-4 text-primary" aria-hidden="true" />
                  Abrir el acceso por WhatsApp
                </span>
                <span className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground group-open:hidden">Opcional</span>
              </summary>
              <div className="border-t border-border/70 p-3 sm:p-4">
                <WhatsappSandboxLauncher
                  initialSector={sectorSeleccionado ?? requestedSandboxSector}
                  initialRubro={rubroClaveSeleccionado ?? requestedSandboxRubro}
                  initialTenantSlug={demoPreviewTenantSlug ?? requestedSandboxTenant}
                />
              </div>
            </details>
            <DemoWorkspace
              tenantSlug={demoTenantSlug}
              sector={sectorSeleccionado}
              rubro={rubroSeleccionado}
              workspace={demoWorkspace}
              loading={demoSessionLoading}
              onRuntimeResult={handleDemoRuntimeResult}
              presentation="executive"
            />
          </div>

          <aside
            id="demo-executive-workspace"
            className="scroll-mt-24 space-y-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            data-demo-admin-shell
            tabIndex={-1}
            hidden={demoJourneyTarget === 'conversation'}
          >
            {demoSessionLoading && !demoAdminPreview ? (
              <section
                className="min-h-[28rem] rounded-2xl border border-border/70 bg-card p-5 shadow-sm"
                role="status"
                aria-live="polite"
                aria-label="Preparando el tablero ejecutivo"
                data-testid="demo-direct-loading-shell"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Vista ejecutiva</p>
                <h2 className="mt-2 text-xl font-bold tracking-tight">Preparando tablero de Gobierno</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Sincronizando casos, participación y señales territoriales del escenario.
                </p>
                <div className="mt-5 grid animate-pulse gap-3 motion-reduce:animate-none sm:grid-cols-3" aria-hidden="true">
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="rounded-2xl border border-border/60 bg-background/70 p-4">
                      <div className="h-3 w-20 rounded-full bg-muted" />
                      <div className="mt-3 h-7 w-16 rounded-lg bg-muted" />
                      <div className="mt-3 h-2.5 w-full rounded-full bg-muted/80" />
                    </div>
                  ))}
                </div>
                <div className="mt-4 h-64 animate-pulse rounded-2xl border border-border/60 bg-muted/50 motion-reduce:animate-none" aria-hidden="true" />
              </section>
            ) : (
              <DemoAdminPreview
                sector={sectorSeleccionado}
                rubro={rubroSeleccionado}
                preview={demoAdminPreview}
                runtimeEvents={demoRuntimeEvents}
                activeTarget={demoAdminPanelTarget}
                onActiveTargetChange={handleDemoAdminPanelTargetChange}
                onOpenEventDetail={handleOpenDemoDetail}
                showNavigation={false}
              />
            )}
          </aside>
        </div>
        <DemoDetailDrawer detail={demoDetailDrawer} onClose={() => setDemoDetailDrawer(null)} />
      </div>
    </div>
  );
};

export default Demo;

