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
import type { Rubro } from "@/types/rubro";
import { extractRubroKey, extractRubroLabel } from "@/utils/rubros";
import DemoWorkspace from '@/features/demo/DemoWorkspace';
import DemoSectorStep from '@/features/demo/DemoSectorStep';
import WhatsappSandboxLauncher from '@/features/demo/WhatsappSandboxLauncher';
import { createDemoSession, getDemoAdminPreview, getDemoCatalog } from '@/features/demo/demoApi';
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
  return sector ? String(sector) : 'Demo';
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
        value: card.value ?? card.status ?? '',
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

const normalizeDemoDetailEndpoint = (endpoint: string | null) => {
  if (!endpoint || typeof window === 'undefined' || !window.location?.origin) return null;

  try {
    const url = new URL(endpoint, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    if (!url.pathname.startsWith('/api/')) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
};

const readDemoEventTicketLabel = (event: DemoRuntimeEvent) =>
  event.ticketId ?? event.leadId ?? event.requestId ?? event.id;

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
  const heatmapData: HeatPoint[] = points.map((point, index) => ({
    id: index + 1,
    ticket: point.label,
    lat: point.lat,
    lng: point.lng,
    weight: point.weight ?? 1,
    totalWeight: point.weight ?? 1,
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
      className="rounded-2xl border border-border/70 bg-background/70 p-4"
      aria-labelledby={titleId}
      data-demo-map-mode={dataMode ?? 'unspecified'}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
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
      <React.Suspense
        fallback={
          <div className="flex h-48 items-center justify-center rounded-xl border text-xs text-muted-foreground">
            Cargando mapa...
          </div>
        }
      >
        <MapLibreMap
          className="h-48 rounded-xl border"
          heatmapData={heatmapData}
          showHeatmap={false}
          center={center}
          fitToBounds={bounds.length ? bounds : undefined}
          initialZoom={zoom ?? (bounds.length > 1 ? 12 : 14)}
          disableClientClustering
          ariaLabel={accessibleMapLabel}
        />
      </React.Suspense>
      {coverageNote ? (
        <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/8 px-3 py-2 text-xs leading-5 text-foreground">
          {coverageNote}
        </p>
      ) : null}
      <div className="mt-3 grid gap-2">
        {points.map((point) => (
          <div key={`row-${point.id}`} className="rounded-lg border bg-muted/20 px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground">{point.label}</span>
              {point.category ? <span className="text-muted-foreground">{point.category}</span> : null}
              {point.zone ? <span className="text-muted-foreground">{point.zone}</span> : null}
              {point.status ? (
                <span className="rounded-full border bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
                  {point.status}
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
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Vista 360</p>
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
                <p className="mt-1 text-foreground">{event.status}</p>
              </div>
            ) : null}
            {ticket?.categoria ? (
              <div className="rounded-lg border bg-muted/20 px-3 py-2">
                <p className="font-medium text-muted-foreground">Categoria</p>
                <p className="mt-1 text-foreground">{ticket.categoria}</p>
              </div>
            ) : null}
            {ticket?.direccion ? (
              <div className="rounded-lg border bg-muted/20 px-3 py-2 sm:col-span-2">
                <p className="font-medium text-muted-foreground">Direccion</p>
                <p className="mt-1 text-foreground">{ticket.direccion}</p>
              </div>
            ) : null}
            {event.requestId ? (
              <div className="rounded-lg border bg-muted/20 px-3 py-2 sm:col-span-2">
                <p className="font-medium text-muted-foreground">request_id</p>
                <p className="mt-1 break-all font-mono text-[11px] text-foreground">{event.requestId}</p>
              </div>
            ) : null}
            {endpoint ? (
              <div className="rounded-lg border bg-muted/20 px-3 py-2 sm:col-span-2">
                <p className="font-medium text-muted-foreground">detail_endpoint</p>
                <p className="mt-1 break-all font-mono text-[11px] text-foreground">{endpoint}</p>
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
            <pre className="mt-4 max-h-72 overflow-auto rounded-xl border bg-muted/20 p-3 text-[11px] leading-5 text-foreground">
              {detailJson}
            </pre>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed bg-muted/10 p-4 text-sm text-muted-foreground">
              El backend no publico un detalle ampliado para este caso. Se muestra el snapshot recibido en la conversacion.
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
        className="border-b border-primary/30 bg-primary/10 px-4 py-4 text-foreground sm:px-5"
        role="note"
        aria-label="Fuentes separadas del panel demostrativo"
        data-demo-provenance="mixed-partitioned"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-background/80 text-primary">
            <Activity className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-black uppercase tracking-[0.08em]">
              Actividad de esta sesión + encuesta demo separada
            </p>
            <p className="mt-1 text-sm font-semibold leading-6">
              Reclamos, ubicaciones y conversaciones corresponden a esta sesión demo. La encuesta pertenece a una
              partición sintética separada.
            </p>
            <p className="mt-1 text-xs leading-5 text-foreground">
              La encuesta no representa datos oficiales ni relevamiento municipal y no debe usarse para decisiones públicas.
            </p>
            {provenance?.label ? <p className="mt-1 text-xs leading-5 text-foreground">{provenance.label}</p> : null}
          </div>
        </div>
      </div>
    );
  }

  if (isSynthetic) {
    return (
      <div
        className="border-b border-amber-500/35 bg-amber-400/15 px-4 py-4 text-amber-950 dark:bg-amber-400/10 dark:text-amber-100 sm:px-5"
        role="note"
        aria-label="Advertencia sobre los datos del escenario demostrativo"
        data-demo-provenance="synthetic"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/35 bg-amber-400/20">
            <ShieldAlert className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-black uppercase tracking-[0.08em]">
              Escenario demostrativo · datos simulados
            </p>
            <p className="mt-1 text-sm font-semibold leading-6">
              No representa datos oficiales ni relevamiento municipal.
            </p>
            {provenance?.label ? (
              <p className="mt-1 text-xs leading-5 text-amber-900/85 dark:text-amber-100/80">{provenance.label}</p>
            ) : null}
            {provenance?.scenario_scope ? (
              <p className="mt-1 text-xs font-semibold text-amber-900/85 dark:text-amber-100/80">
                Ámbito del escenario: {provenance.scenario_scope}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (!hasSessionEvents) return null;

  return (
    <div
      className="border-b border-primary/25 bg-primary/10 px-4 py-3 text-foreground sm:px-5"
      role="status"
      data-demo-provenance="session"
    >
      <div className="flex items-start gap-3">
        <Radio className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <p className="text-sm font-bold">Eventos reales de esta sesión demo</p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            Esta vista muestra únicamente actividad generada durante la sesión actual; no se mezcla con el escenario simulado.
          </p>
        </div>
      </div>
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
      <div className="grid grid-cols-2 gap-3 2xl:grid-cols-4" role="list" data-demo-kpi-list>
        {items.map((item) => {
          const CardIcon = item.icon;
          const sourceLabel = item.dataMode === 'synthetic_demo_scenario'
            ? 'Demo sintética'
            : item.dataMode === 'session_generated_events'
              ? 'Sesión actual'
              : null;
          return (
            <article
              key={item.id}
              className="min-w-0 rounded-2xl border border-border/70 bg-background/80 p-3 shadow-sm sm:p-4"
              role="listitem"
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
            </article>
          );
        })}
      </div>
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
}: {
  sector: DemoSector | null;
  rubro?: string | null;
  preview?: DemoAdminPreviewResponse | null;
  runtimeEvents?: DemoRuntimeEvent[];
  activeTarget?: DemoAdminPanelTarget;
  onActiveTargetChange?: (target: DemoAdminPanelTarget) => void;
  onOpenEventDetail?: (event: DemoRuntimeEvent) => void;
}) => {
  if (!preview) return null;

  const Icon = getDemoPreviewIcon(sector);
  const labels = preview?.labels ?? {};
  const modules = normalizePreviewModules(preview);
  const cards = hydratePreviewCardsWithRuntime(normalizePreviewCards(preview), runtimeEvents);
  const metrics = normalizePreviewMetrics(preview);
  const executiveKpis = metrics.length ? metrics : cards;
  const timeline = normalizePreviewTimeline(preview);
  const previewCases = normalizePreviewCases(preview);
  const surveyVoting = normalizePreviewSurveyVoting(preview);
  const runtimeMapPoints = runtimeEventsToMapPoints(runtimeEvents);
  const previewMap = runtimeMapPoints.length
    ? mergePreviewMapWithRuntime(null, runtimeMapPoints)
    : normalizePreviewMap(preview);
  const runtimeTickets = runtimeEvents.filter((event) => event.ticket || event.ticketId);
  const declaredDataMode = preview.data_provenance?.mode ?? preview.operations?.data_policy ?? null;
  const isMixedPartitioned = declaredDataMode === 'mixed_partitioned';
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
  const caseSourceIsSession = hasSessionCases;
  const caseSample = preview.case_sample;
  const activeModule = modules.find((module) => module.target === activeTarget) ?? modules[0];
  const title = preview.title?.trim() || rubro || readSectorLabel(null, sector);
  const subtitle = preview.subtitle?.trim() || rubro || readSectorLabel(null, sector);
  const outcome = preview.description?.trim() || preview.outcome?.trim() || "";
  const adminLabel = labels.admin_preview ?? labels.admin ?? 'Admin demo';
  const viewLabel = labels.overview ?? labels.view ?? 'Vista 360';
  const statusLabel = preview.status_label?.trim() || labels.status || null;
  const timelineTitle = labels.timeline_title ?? labels.timeline ?? 'Recorrido visible para el equipo';
  const timelineBadge = labels.timeline_badge ?? null;
  const timelineDetail = labels.timeline_detail ?? null;
  const summaryTitle = labels.summary_title ?? null;
  const summaryDescription = labels.summary_description ?? null;
  const showSummary = activeModule?.target === 'summary';
  const showClaims = activeModule?.target === 'claims';
  const showMap = activeModule?.target === 'map';
  const showSurveys = activeModule?.target === 'surveys';

  return (
    <section
      className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm backdrop-blur"
      data-demo-admin-preview
      aria-labelledby="demo-admin-preview-title"
    >
      <DemoDataProvenanceBanner preview={preview} hasRuntimeEvents={runtimeEvents.length > 0} />
      <div className="grid gap-0">
        <aside className="border-b border-border/70 bg-muted/25 p-4 sm:p-5">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{adminLabel}</p>
              <p className="truncate text-lg font-bold text-foreground">{subtitle}</p>
            </div>
          </div>
          <nav className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Secciones del panel ejecutivo">
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
          </nav>
        </aside>

        <div className="p-4 sm:p-5">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{viewLabel}</p>
              <h2 id="demo-admin-preview-title" className="mt-1 text-2xl font-bold tracking-tight text-foreground">{title}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{outcome}</p>
            </div>
            {statusLabel ? (
              <span className="w-fit rounded-full border border-success/25 bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                {statusLabel}
              </span>
            ) : null}
          </div>

          <div role="region" aria-label={activeModule?.label ?? 'Resumen'}>
          {showSummary ? (
            <>
              <DemoExecutiveKpiGrid
                items={executiveKpis}
                isSynthetic={isSyntheticPreview}
                isMixedPartitioned={isMixedPartitioned}
              />

              <div className="mt-4 grid gap-3">
                <DemoChannelSummary summary={preview.channel_summary} isSynthetic={isSyntheticPreview} />
                {timeline.length ? (
                  <section className="rounded-2xl border border-border/70 bg-background/70 p-4" aria-labelledby="demo-timeline-title">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 id="demo-timeline-title" className="text-sm font-semibold text-foreground">{timelineTitle}</h3>
                      {timelineBadge ? <span className="text-xs text-muted-foreground">{timelineBadge}</span> : null}
                    </div>
                    <ol className="space-y-3">
                      {timeline.map((step, index) => (
                        <li key={step.id} className="flex items-start gap-3">
                          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-[10px] font-black text-primary">
                            {index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-foreground">{step.title}</p>
                              {step.time ? <span className="text-[11px] font-semibold text-muted-foreground">{step.time}</span> : null}
                            </div>
                            {step.description || timelineDetail ? (
                              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{step.description ?? timelineDetail}</p>
                            ) : null}
                            {step.channel || step.status ? (
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {step.channel ? <span className="rounded-full border bg-muted/20 px-2 py-0.5 text-[10px] text-muted-foreground">{step.channel}</span> : null}
                                {step.status ? <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] text-primary">{step.status}</span> : null}
                              </div>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </section>
                ) : null}
                {summaryTitle || summaryDescription ? (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                    {summaryTitle ? <p className="text-sm font-semibold text-foreground">{summaryTitle}</p> : null}
                    {summaryDescription ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{summaryDescription}</p> : null}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          {showClaims ? (
            <section className="grid gap-3" aria-labelledby="demo-claims-title" data-demo-claims>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 id="demo-claims-title" className="text-base font-bold text-foreground">Reclamos y casos operativos</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Seguimiento priorizado con canal, zona y estado de SLA.
                  </p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                  caseSourceIsSession
                    ? 'border-primary/25 bg-primary/10 text-primary'
                    : 'border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-200'
                }`}>
                  {caseSourceLabel}
                </span>
              </div>
              {caseSample?.sample === true ? (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3 text-xs leading-5 text-foreground">
                  <p className="font-semibold">
                    Muestra visible: {readSummaryValue(caseSample.displayed_cases)} de {readSummaryValue(caseSample.total_cases)} casos del escenario.
                  </p>
                  {caseSample.label ? <p className="mt-1 text-muted-foreground">{caseSample.label}</p> : null}
                </div>
              ) : null}
              <div className="grid gap-3 md:grid-cols-2">
              {runtimeTickets.length ? (
                runtimeTickets.map((event) => (
                  <article key={event.id} className="rounded-2xl border border-border/70 bg-background/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                          {event.ticket?.canal_ingreso ?? event.result?.ticket_type ?? 'Caso'}
                        </p>
                        <h4 className="mt-1 text-lg font-bold text-foreground">
                          {readDemoEventTicketLabel(event)}
                        </h4>
                      </div>
                      {event.status ? (
                        <span className="rounded-full border bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
                          {event.status}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                      {event.ticket?.categoria ? (
                        <div className="rounded-lg border bg-muted/20 px-3 py-2">
                          <p className="font-medium text-muted-foreground">Categoria</p>
                          <p className="mt-1 text-foreground">{event.ticket.categoria}</p>
                        </div>
                      ) : null}
                      {event.ticket?.direccion ? (
                        <div className="rounded-lg border bg-muted/20 px-3 py-2">
                          <p className="font-medium text-muted-foreground">Direccion</p>
                          <p className="mt-1 text-foreground">{event.ticket.direccion}</p>
                        </div>
                      ) : null}
                      {event.requestId ? (
                        <div className="rounded-lg border bg-muted/20 px-3 py-2 sm:col-span-2">
                          <p className="font-medium text-muted-foreground">request_id</p>
                          <p className="mt-1 break-all font-mono text-[11px] text-foreground">{event.requestId}</p>
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenEventDetail?.(event)}
                        className="rounded-full border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-primary/40 hover:text-primary"
                      >
                        Ver detalle
                      </button>
                      <button
                        type="button"
                        onClick={() => onActiveTargetChange?.('map')}
                        disabled={!hasTicketLocation(event.ticket)}
                        className="rounded-full border bg-muted/20 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Ver mapa
                      </button>
                    </div>
                  </article>
                ))
              ) : previewCases.length ? (
                previewCases.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-border/70 bg-background/75 p-4 shadow-sm"
                    data-demo-case-mode={item.dataMode ?? declaredDataMode ?? 'unspecified'}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">{item.caseCode}</p>
                        <h4 className="mt-1 text-base font-bold leading-6 text-foreground">{item.title}</h4>
                      </div>
                      {item.status ? (
                        <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-1 text-[11px] font-semibold text-primary">
                          {item.status}
                        </span>
                      ) : null}
                    </div>
                    {item.description ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.description}</p> : null}
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      {item.category ? (
                        <div className="rounded-lg border bg-muted/15 px-3 py-2">
                          <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Categoría</dt>
                          <dd className="mt-1 font-medium text-foreground">{item.category}</dd>
                        </div>
                      ) : null}
                      {item.priority ? (
                        <div className="rounded-lg border bg-muted/15 px-3 py-2">
                          <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Prioridad</dt>
                          <dd className="mt-1 font-medium text-foreground">{item.priority}</dd>
                        </div>
                      ) : null}
                      {item.channel ? (
                        <div className="rounded-lg border bg-muted/15 px-3 py-2">
                          <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Canal</dt>
                          <dd className="mt-1 font-medium text-foreground">{item.channel}</dd>
                        </div>
                      ) : null}
                      {item.zone ? (
                        <div className="rounded-lg border bg-muted/15 px-3 py-2">
                          <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Zona</dt>
                          <dd className="mt-1 font-medium text-foreground">{item.zone}</dd>
                        </div>
                      ) : null}
                    </dl>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                      {item.slaStatus ? (
                        <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-1 font-semibold text-primary">
                          SLA · {item.slaStatus}
                        </span>
                      ) : null}
                      {item.openedAtLabel ? <span className="text-muted-foreground">{item.openedAtLabel}</span> : null}
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-border/70 bg-background/60 p-4 text-sm text-muted-foreground md:col-span-2">
                  El listado se completa cuando el chat crea un caso en esta sesion.
                </div>
              )}
              </div>
            </section>
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
            <section className="grid gap-3" aria-labelledby="demo-surveys-title" data-demo-survey-voting>
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Participación ciudadana</p>
                    <h3 id="demo-surveys-title" className="mt-1 text-base font-bold text-foreground">
                      {surveyVoting?.title || labels.surveys_title || labels.surveys || activeModule?.label || 'Encuestas y votaciones'}
                    </h3>
                  </div>
                  {surveyVoting ? (
                    <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:text-amber-200">
                      {surveyVoting.totalAvailable} encuestas demo
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {surveyVoting?.description || labels.surveys_description ||
                    'Resultados separados por fuente para demostrar votaciones y analítica sin presentarlos como información oficial.'}
                </p>
                {surveyVoting && surveyVoting.realPeople === false ? (
                  <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/8 px-3 py-2 text-xs leading-5 text-foreground" role="note">
                    Base sintética determinística: las respuestas no pertenecen a personas reales ni representan opinión pública municipal.
                  </div>
                ) : null}
              </div>

              {surveyVoting?.items.length ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  {surveyVoting.items.map((survey) => (
                    <article key={survey.id} className="rounded-2xl border border-border/70 bg-background/75 p-4 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                            {survey.status || 'Encuesta publicada'}
                          </p>
                          <h4 className="mt-1 text-base font-bold leading-6 text-foreground">{survey.title}</h4>
                        </div>
                        <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${
                          survey.isSynthetic
                            ? 'border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-200'
                            : 'border-primary/25 bg-primary/10 text-primary'
                        }`}>
                          {survey.totalResponses} {survey.hasPartitionedDemoComposition
                            ? 'respuestas demo'
                            : survey.isSynthetic
                              ? 'respuestas sintéticas'
                              : 'respuestas'}
                        </span>
                      </div>
                      {survey.description ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{survey.description}</p> : null}
                      {survey.hasPartitionedDemoComposition ? (
                        <div
                          className="mt-3 rounded-xl border border-primary/15 bg-primary/[0.04] px-3 py-2 text-xs leading-5 text-foreground"
                          role="note"
                          aria-label={`Composición de respuestas de ${survey.title}`}
                          data-demo-survey-composition
                        >
                          <span className="font-semibold">Composición verificable · </span>
                          <span className="tabular-nums">
                            {survey.seededResponses} base sintética + {survey.interactiveDemoResponses} participaciones demo = {survey.totalResponses} total
                          </span>
                          <span className="block text-foreground">0 respuestas ciudadanas verificadas.</span>
                        </div>
                      ) : null}
                      {survey.question ? <p className="mt-3 text-sm font-semibold text-foreground">{survey.question}</p> : null}
                      <div className="mt-3 grid gap-2">
                        {survey.options.length ? (
                          survey.options.map((option) => (
                            <div key={option.id}>
                              <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                                <span className="font-medium text-foreground">{option.label}</span>
                                <span className="tabular-nums text-muted-foreground">
                                  {option.count} · {EXECUTIVE_NUMBER_FORMATTER.format(option.percentage)}%
                                </span>
                              </div>
                              <div
                                className="h-2 overflow-hidden rounded-full bg-muted"
                                role="progressbar"
                                aria-label={`${option.label}: ${EXECUTIVE_NUMBER_FORMATTER.format(option.percentage)} %`}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={Math.round(option.percentage)}
                              >
                                <div
                                  className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
                                  style={{ width: `${option.percentage}%` }}
                                />
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="rounded-lg border border-dashed bg-muted/10 px-3 py-3 text-xs text-muted-foreground">
                            La encuesta está disponible, pero este contrato todavía no publicó resultados.
                          </p>
                        )}
                      </div>
                      {survey.publicPagePath ? (
                        <a
                          href={survey.publicPagePath}
                          className="mt-4 inline-flex rounded-full border border-primary/25 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          Abrir encuesta demo
                        </a>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
                  El backend no devolvió una encuesta publicada para este escenario.
                </div>
              )}
            </section>
          ) : null}
        </div>
      </div>
      </div>
    </section>
  );
};

const Demo = () => {
  const location = useLocation();
  const [rubroSeleccionado, setRubroSeleccionado] = useState<string | null>(null);
  const [rubroClaveSeleccionado, setRubroClaveSeleccionado] = useState<string | null>(null);
  const [rubrosDisponibles, setRubrosDisponibles] = useState<Rubro[]>([]);
  const [esperandoRubro, setEsperandoRubro] = useState(true); // Initialize to true
  const [sectorSeleccionado, setSectorSeleccionado] = useState<DemoSector | null>(null);
  const [demoCatalog, setDemoCatalog] = useState<DemoCatalogResponse | null>(null);
  const [demoTenantSlug, setDemoTenantSlug] = useState<string | null>(null);
  const [demoWorkspace, setDemoWorkspace] = useState<DemoWorkspaceConfig | null>(null);
  const [demoSessionLoading, setDemoSessionLoading] = useState(false);
  const [demoAdminPreview, setDemoAdminPreview] = useState<DemoAdminPreviewResponse | null>(null);
  const [demoError, setDemoError] = useState<DemoUiError | null>(null);
  const [demoRuntimeEvents, setDemoRuntimeEvents] = useState<DemoRuntimeEvent[]>([]);
  const [demoAdminPanelTarget, setDemoAdminPanelTarget] = useState<DemoAdminPanelTarget>('summary');
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
  }, [demoPreviewTenantSlug, rubroClaveSeleccionado, sectorSeleccionado]);

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
        }
      }
      void refreshDemoAdminPreview();
    },
    [refreshDemoAdminPreview],
  );

  const handleOpenDemoDetail = useCallback(
    (event: DemoRuntimeEvent) => {
      const endpoint = normalizeDemoDetailEndpoint(readDemoEventDetailEndpoint(event));
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

    const storedClave = safeLocalStorage.getItem("rubroSeleccionado");
    const storedLabel = safeLocalStorage.getItem("rubroSeleccionado_label");
    const storedSector = safeLocalStorage.getItem("demoSectorSeleccionado");
    const requestedSector = new URLSearchParams(location.search).get('sector') as DemoSector | null;
    const normalizedRequestedSector =
      requestedSector === 'educacion' || requestedSector === 'gobierno' || requestedSector === 'empresas'
        ? requestedSector
        : null;
    const requestedRubro = new URLSearchParams(location.search).get('rubro');
    const effectiveStoredClave =
      normalizedRequestedSector && storedSector !== normalizedRequestedSector ? null : storedClave;
    const effectiveStoredLabel = effectiveStoredClave ? storedLabel : null;

    if (normalizedRequestedSector && requestedRubro && !effectiveStoredClave) {
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

    if (effectiveStoredClave && !rubroClaveSeleccionado) {
      const normalizedClave = extractRubroKey(effectiveStoredClave) ?? effectiveStoredClave;
      setDemoSessionLoading(true);
      void createDemoSession({
        rubro: normalizedClave,
        rubro_slug: normalizedClave,
        category_slug: normalizedClave,
        tenant_slug: requestedDemoTenantSlug,
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
    <div className="flex min-h-screen w-full flex-col items-center bg-background text-foreground">
      <header className="sticky top-0 z-20 w-full border-b border-border bg-card/80 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img
              src={CHATBOC_ORBIT_AVATAR}
              alt="Chatboc"
              className="h-9 w-9 rounded-full border border-primary/30 bg-primary/20 p-0.5 dark:bg-primary/30"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/favicon/favicon-48x48.png";
              }}
            />
            <span className="text-xl font-semibold tracking-tight text-foreground">
              Chatboc <span className="text-lg text-muted-foreground">- Demo</span>
            </span>
          </div>
          {rubroSeleccionado ? (
            <button
              onClick={handleChangeRubro}
              className="text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-primary sm:text-sm"
              title="Cambiar rubro"
            >
              Rubro: {rubroSeleccionado} (cambiar)
            </button>
          ) : null}
        </div>
      </header>

      <div className="w-full max-w-6xl flex-1 space-y-5 px-4 py-5 sm:px-6">
        <section className="overflow-hidden rounded-3xl border border-border/70 bg-card/70 p-5 shadow-sm backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Demo completa</p>
            <h1 className="mt-2 max-w-3xl text-2xl font-black tracking-tight text-foreground sm:text-3xl">
              Probá una conversación real y mirá qué queda listo para operar.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              El chat toma texto, adjuntos y seguimiento; el panel muestra el resultado operativo para que el equipo actúe.
            </p>
          </div>
          {demoError ? (
            <div className="mt-4">
              <DemoErrorPanel error={demoError} onRetry={sectorSeleccionado ? () => void startSectorDemo() : undefined} />
            </div>
          ) : null}
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(340px,460px)_minmax(0,1fr)]">
          <div className="min-w-0">
            <DemoWorkspace
              tenantSlug={demoTenantSlug}
              sector={sectorSeleccionado}
              rubro={rubroSeleccionado}
              workspace={demoWorkspace}
              loading={demoSessionLoading}
              onRuntimeResult={handleDemoRuntimeResult}
            />
          </div>

          <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
            {demoSessionLoading && !demoAdminPreview ? (
              <section
                className="rounded-3xl border border-border/70 bg-card/80 p-5 shadow-sm"
                role="status"
                aria-live="polite"
                aria-label="Preparando el tablero ejecutivo"
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
                onActiveTargetChange={setDemoAdminPanelTarget}
                onOpenEventDetail={handleOpenDemoDetail}
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

