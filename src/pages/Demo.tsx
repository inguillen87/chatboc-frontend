import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  FileText,
  GraduationCap,
  Inbox,
  MapPinned,
  MessageSquareText,
  ShoppingCart,
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
  analytics: BarChart3,
  bar: BarChart3,
  cart: ShoppingCart,
  catalog: FileText,
  commerce: ShoppingCart,
  education: GraduationCap,
  inbox: Inbox,
  lead: Users,
  map: MapPinned,
  message: MessageSquareText,
  order: ShoppingCart,
  school: GraduationCap,
  ticket: Inbox,
  time: Clock3,
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
    .map((card) => {
      const label = card.label ?? card.title ?? card.id ?? card.key;
      if (!label) return null;
      return {
        label: String(label),
        value: card.value ?? card.status ?? '',
        detail: card.description ?? card.detail ?? '',
        icon: resolvePreviewIcon(card.icon ?? card.id ?? card.key ?? card.label),
      };
    })
    .filter((card): card is { label: string; value: string | number; detail: string; icon: React.ElementType } =>
      Boolean(card),
    );
};

const normalizePreviewTimeline = (preview: DemoAdminPreviewResponse | null) => {
  const timeline = Array.isArray(preview?.timeline) ? preview.timeline : [];
  return timeline
    .map((item) => ({
      id: item.id ?? item.title ?? item.label ?? item.description,
      title: item.title ?? item.label ?? item.description,
      description: item.description ?? null,
    }))
    .filter((item): item is { id: string; title: string; description: string | null } =>
      typeof item.id === 'string' && typeof item.title === 'string' && item.title.trim().length > 0,
    );
};

const readFiniteNumber = (...values: unknown[]): number | null => {
  for (const value of values) {
    const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
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
  status?: string | null;
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
        status: readMapPointText(point, ['status', 'estado']),
      };
    })
    .filter((point): point is NormalizedPreviewMapPoint => Boolean(point));

  if (!normalizedPoints.length) return null;
  return {
    title: map.title?.trim() || map.label?.trim() || preview?.labels?.map_title || 'Ubicaciones reales',
    description: map.description?.trim() || preview?.labels?.map_description || null,
    points: normalizedPoints,
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
}: {
  title: string;
  description?: string | null;
  points: NormalizedPreviewMapPoint[];
}) => {
  const heatmapData: HeatPoint[] = points.map((point, index) => ({
    id: index + 1,
    ticket: point.label,
    lat: point.lat,
    lng: point.lng,
    weight: 1,
    totalWeight: 1,
    categoria: point.category ?? undefined,
    direccion: point.address ?? undefined,
    estado: point.status ?? undefined,
  }));
  const bounds = points.map((point) => [point.lng, point.lat] as [number, number]);
  const center = bounds[0];

  return (
    <div className="rounded-xl border border-border/70 bg-background/70 p-4" aria-label="Ubicaciones reales del admin preview">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {description ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p> : null}
        </div>
        <span className="rounded-full border bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground">
          {points.length}
        </span>
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
          initialZoom={bounds.length > 1 ? 12 : 14}
          disableClientClustering
        />
      </React.Suspense>
      <div className="mt-3 grid gap-2">
        {points.slice(0, 4).map((point) => (
          <div key={`row-${point.id}`} className="rounded-lg border bg-muted/20 px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground">{point.label}</span>
              {point.category ? <span className="text-muted-foreground">{point.category}</span> : null}
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
    </div>
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

const DemoAdminPreview = ({
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
  const timeline = normalizePreviewTimeline(preview);
  const runtimeMapPoints = runtimeEventsToMapPoints(runtimeEvents);
  const previewMap = mergePreviewMapWithRuntime(normalizePreviewMap(preview), runtimeMapPoints);
  const runtimeTickets = runtimeEvents.filter((event) => event.ticket || event.ticketId);
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
    >
      <div className="grid gap-0">
        <aside className="border-b border-border/70 bg-muted/25 p-4 sm:p-5">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{adminLabel}</p>
              <h3 className="text-lg font-bold text-foreground">{subtitle}</h3>
            </div>
          </div>
          <nav className="grid gap-2">
            {modules.map((module) => {
              const active = module.id === activeModule?.id;
              return (
              <button
                key={module.id}
                type="button"
                onClick={() => onActiveTargetChange?.(module.target)}
                className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition ${
                  active
                    ? 'border-primary/30 bg-primary/10 text-primary'
                    : 'border-border/60 bg-background/60 text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>{module.label}</span>
                {active ? <CheckCircle2 className="h-4 w-4" /> : null}
              </button>
              );
            })}
          </nav>
        </aside>

        <div className="p-4 sm:p-5">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{viewLabel}</p>
              <h3 className="mt-1 text-2xl font-bold tracking-tight text-foreground">{title}</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{outcome}</p>
            </div>
            {statusLabel ? (
              <span className="w-fit rounded-full border border-success/25 bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                {statusLabel}
              </span>
            ) : null}
          </div>

          {showSummary ? (
            <>
              <div className="grid gap-3">
                {cards.map((card) => {
                  const CardIcon = card.icon;
                  return (
                    <div key={card.label} className="rounded-xl border border-border/70 bg-background/70 p-4">
                      <CardIcon className="mb-4 h-5 w-5 text-primary" />
                      <p className="text-sm text-muted-foreground">{card.label}</p>
                      <p className="mt-1 text-2xl font-black tracking-tight text-foreground">{card.value}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{card.detail}</p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 grid gap-3">
                {timeline.length ? (
                  <div className="rounded-xl border border-border/70 bg-background/70 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">{timelineTitle}</p>
                      {timelineBadge ? <span className="text-xs text-muted-foreground">{timelineBadge}</span> : null}
                    </div>
                    <div className="space-y-3">
                      {timeline.map((step, index) => (
                        <div key={step.id} className="flex items-start gap-3">
                          <span className={`mt-1 h-2.5 w-2.5 rounded-full ${index < 2 ? 'bg-success' : index === 2 ? 'bg-primary' : 'bg-muted-foreground/35'}`} />
                          <div>
                            <p className="text-sm font-medium text-foreground">{step.title}</p>
                            {step.description || timelineDetail ? (
                              <p className="text-xs text-muted-foreground">{step.description ?? timelineDetail}</p>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
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
            <div className="grid gap-3">
              {runtimeTickets.length ? (
                runtimeTickets.map((event) => (
                  <div key={event.id} className="rounded-xl border border-border/70 bg-background/70 p-4">
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
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
                  El listado se completa cuando el chat crea un caso en esta sesion.
                </div>
              )}
            </div>
          ) : null}

          {showMap ? (
            <div className="grid gap-3">
              {previewMap ? (
                <DemoPreviewMap
                  title={previewMap.title}
                  description={previewMap.description}
                  points={previewMap.points}
                />
              ) : (
                <div className="rounded-xl border border-dashed border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
                  El mapa se activa cuando el backend devuelve coordenadas o el usuario comparte ubicacion.
                </div>
              )}
            </div>
          ) : null}

          {showSurveys ? (
            <div className="grid gap-3">
              <div className="rounded-xl border border-border/70 bg-background/70 p-4">
                <p className="text-sm font-semibold text-foreground">
                  {labels.surveys_title ?? labels.surveys ?? activeModule?.label}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {labels.surveys_description ??
                    'Este panel muestra respuestas, comentarios y acciones ciudadanas capturadas durante la demo.'}
                </p>
                <div className="mt-4 grid gap-2 text-xs">
                  {runtimeEvents.length ? (
                    runtimeEvents.map((event) => (
                      <div key={`survey-${event.id}`} className="rounded-lg border bg-muted/20 px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium text-foreground">{readDemoEventTicketLabel(event)}</span>
                          {event.status ? <span className="text-muted-foreground">{event.status}</span> : null}
                        </div>
                        {event.requestId ? (
                          <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{event.requestId}</p>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed bg-muted/10 px-3 py-3 text-muted-foreground">
                      Las respuestas aparecen cuando el usuario envia feedback o comentarios desde el chat.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
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
    setDemoAdminPanelTarget('summary');
  }, [demoPreviewChatSessionId]);

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
        setEsperandoRubro(false);
        openDemoWidget();
      })().catch((error) => {
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
          setEsperandoRubro(false);
          openDemoWidget();
          setDemoError(null);
        })
        .catch((error) => {
          setEsperandoRubro(true);
          setDemoError(buildDemoError(error, 'No se pudo iniciar la demo real.'));
        });
      return;
    }

    if (effectiveStoredClave && !rubroClaveSeleccionado) {
      const normalizedClave = extractRubroKey(effectiveStoredClave) ?? effectiveStoredClave;
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
          setEsperandoRubro(false);
          openDemoWidget();
          setDemoError(null);
        })
        .catch((error) => {
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
      setDemoError(null);
    } catch (error) {
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
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Elegi una operacion real para probar</h1>
            </div>
          </div>
          <p className="mb-5 max-w-2xl text-left text-sm leading-6 text-muted-foreground">
            La demo muestra capacidades disponibles y permite ver como una conversacion se convierte en una accion operativa.
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
            <p className="mb-3 text-xs text-muted-foreground">Selecciona un sector para iniciar una demo guiada.</p>
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
                  setDemoError(null);
                } catch (error) {
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

      <main className="w-full max-w-6xl flex-1 space-y-5 px-4 py-5 sm:px-6">
        <section className="overflow-hidden rounded-3xl border border-border/70 bg-card/70 p-5 shadow-sm backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Demo completa</p>
            <h1 className="mt-2 max-w-3xl text-2xl font-black tracking-tight text-foreground sm:text-3xl">
              Proba una conversacion real y mira que queda listo para operar.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              El chat toma texto, adjuntos y seguimiento; el panel muestra el resultado operativo para que el equipo actue.
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
              onRuntimeResult={handleDemoRuntimeResult}
            />
          </div>

          <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
            <DemoAdminPreview
              sector={sectorSeleccionado}
              rubro={rubroSeleccionado}
              preview={demoAdminPreview}
              runtimeEvents={demoRuntimeEvents}
              activeTarget={demoAdminPanelTarget}
              onActiveTargetChange={setDemoAdminPanelTarget}
              onOpenEventDetail={handleOpenDemoDetail}
            />
          </aside>
        </div>
        <DemoDetailDrawer detail={demoDetailDrawer} onClose={() => setDemoDetailDrawer(null)} />
      </main>
    </div>
  );
};

export default Demo;

