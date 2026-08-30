import type { OperationsActionItem, OperationsHeatmapV1 } from './analyticsTypes';
import type { TerritorialGeocodingQueue } from './territorialGeocodingTypes';

type HeatmapGeocoding = NonNullable<OperationsHeatmapV1['geocoding']>;
type HeatmapGeocodingCandidate = NonNullable<HeatmapGeocoding['candidates']>[number];

export type PendingLocationQueueState = 'ready' | 'partial' | 'summary_only' | 'empty' | 'unavailable';
export type PendingLocationActionKind = 'review' | 'approve' | 'reject';

export interface PendingLocationAction {
  kind: PendingLocationActionKind;
  label: string;
  href: string | null;
  enabled: boolean;
  reason: string;
}

export interface PendingLocationCandidate {
  id: string;
  ticketId: string | null;
  sourceModel: 'TenantTicket' | 'MunicipioTicket' | 'PymeTicket' | null;
  category: string;
  source: string;
  safeAreaLabel: string;
  qualityCode: string;
  qualityLabel: string;
  qualityDetail: string;
  ticketHref: string | null;
  actions: Record<PendingLocationActionKind, PendingLocationAction>;
}

export interface PendingLocationQueue {
  state: PendingLocationQueueState;
  contractVersion: string | null;
  status: string | null;
  total: number;
  published: number;
  hidden: number;
  writesEnabled: boolean;
  candidates: PendingLocationCandidate[];
}

const KNOWN_SOURCE_MODELS = new Set(['TenantTicket', 'MunicipioTicket', 'PymeTicket']);

const compact = (value: string) => value.replace(/\s+/g, ' ').trim();

const readString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
};

const readCount = (...values: unknown[]) => {
  for (const value of values) {
    const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
    if (Number.isFinite(parsed)) return Math.max(0, Math.floor(parsed));
  }
  return 0;
};

export const normalizeTerritorialFilter = (value: string | null | undefined) =>
  compact(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-AR')
    .replace(/[^a-z0-9]+/g, '-');

const stripExactAddressIdentifiers = (value: string) => compact(value
  .replace(/\b(?:piso|depto\.?|departamento|unidad|casa|lote|manzana|mz\.?)\s*[a-z0-9-]+\b/gi, '')
  .replace(/\b(?:km|kil[oó]metro)\s*\d+(?:[.,]\d+)?\b/gi, '')
  .replace(/\b(?:n(?:ro|umero)\.?|n[°º]|#)\s*\d+[a-z]?(?:\s+bis)?\b/gi, '')
  .replace(/\s+\d{2,6}[a-z]?(?:\s+bis)?(?=\s*(?:,|$))/gi, '')
  .replace(/[;,|]+/g, ' '));

/**
 * Produces an aggregate corridor label. It intentionally removes house, floor,
 * unit and kilometre identifiers and must never be used as a geocoding input.
 */
export const safeAggregateAreaLabel = (candidate: HeatmapGeocodingCandidate) => {
  const explicitAggregate = readString(
    candidate.address_cell_label,
    candidate.cell_label,
    candidate.street_segment,
    candidate.zone,
    candidate.zona,
    candidate.barrio,
    candidate.district,
    candidate.distrito,
  );
  if (explicitAggregate) {
    const safeAggregate = stripExactAddressIdentifiers(explicitAggregate).slice(0, 80);
    return safeAggregate || 'Área todavía no publicada';
  }

  const address = readString(candidate.address);
  if (!address) return 'Área todavía no publicada';

  const normalized = stripExactAddressIdentifiers(address.split(',')[0]).slice(0, 72);
  return normalized ? `Corredor ${normalized}` : 'Área todavía no publicada';
};

const QUALITY_MESSAGES: Record<string, { label: string; detail: string }> = {
  address_without_coordinates: {
    label: 'Dirección sin coordenadas verificadas',
    detail: 'El caso contiene una referencia textual, pero todavía no puede ubicarse con precisión en el mapa.',
  },
  missing_address: {
    label: 'Dirección incompleta',
    detail: 'El caso no aporta una referencia territorial suficiente para iniciar una validación.',
  },
  coordinates_outside_configured_jurisdiction: {
    label: 'Fuera del alcance configurado',
    detail: 'La coordenada informada quedó fuera de la jurisdicción y requiere revisión antes de publicarse.',
  },
  low_precision_geocode: {
    label: 'Precisión insuficiente',
    detail: 'La ubicación disponible es aproximada y no debe aprobarse sin una validación adicional.',
  },
  pending_review: {
    label: 'Revisión territorial pendiente',
    detail: 'El sistema requiere una decisión humana antes de incorporar esta ubicación al mapa.',
  },
};

export const describeLocationQuality = (reasonCode: string | null | undefined) => {
  const normalized = normalizeTerritorialFilter(reasonCode).replace(/-/g, '_');
  return QUALITY_MESSAGES[normalized] ?? {
    label: 'Calidad territorial pendiente',
    detail: 'El contrato no publicó una razón más específica. Revisá el ticket antes de aceptar o rechazar la ubicación.',
  };
};

const actionText = (action: OperationsActionItem) =>
  normalizeTerritorialFilter(readString(action.id, action.action_type, action.ui_hint, action.label, action.title));

const safeFrontendHref = (action: OperationsActionItem | undefined, requiresWrite: boolean) => {
  if (!action) return null;
  if (requiresWrite && action.writes_enabled !== true) return null;
  const href = readString(action.frontend_path, action.href, action.route);
  return href?.startsWith('/') && !href.startsWith('/api/') ? href : null;
};

const findAction = (actions: OperationsActionItem[], kind: PendingLocationActionKind) => {
  const patterns: Record<PendingLocationActionKind, RegExp> = {
    review: /(?:review|revis|inspect|open-record|open-ticket|abrir-ticket)/,
    approve: /(?:approve|aprobar|confirm-location|confirmar-ubicacion|validate-location|validar-ubicacion)/,
    reject: /(?:reject|rechazar|discard-location|descartar-ubicacion)/,
  };
  return actions.find((action) => patterns[kind].test(actionText(action)));
};

const buildContractAction = (
  actions: OperationsActionItem[],
  kind: PendingLocationActionKind,
): PendingLocationAction => {
  const labels: Record<PendingLocationActionKind, string> = {
    review: 'Revisar evidencia',
    approve: 'Aprobar ubicación',
    reject: 'Rechazar ubicación',
  };
  const action = findAction(actions, kind);
  const href = safeFrontendHref(action, kind !== 'review');
  const enabled = Boolean(href);
  return {
    kind,
    label: labels[kind],
    href,
    enabled,
    reason: enabled
      ? 'Acción publicada por el contrato operativo.'
      : action
        ? 'El backend publicó la acción, pero no una ruta de interfaz segura para ejecutarla.'
        : 'El backend todavía no publicó esta decisión para la bandeja territorial.',
  };
};

export const buildPendingLocationTicketHref = (
  ticketId: string | null,
  tenantSlug?: string | null,
  sourceModel?: PendingLocationCandidate['sourceModel'],
) => {
  if (!ticketId) return null;
  const params = new URLSearchParams({
    tab: 'tickets',
    focus: 'territorial_location_review',
    ticket_id: ticketId,
  });
  if (tenantSlug) {
    params.set('tenant_slug', tenantSlug);
    params.set('tenant', tenantSlug);
  }
  if (sourceModel) params.set('source_model', sourceModel);
  return `/perfil?${params.toString()}`;
};

const adaptCandidate = (
  candidate: HeatmapGeocodingCandidate,
  index: number,
  tenantSlug?: string | null,
): PendingLocationCandidate => {
  const rawTicketId = candidate.ticket_id ?? candidate.record_id;
  const ticketId = rawTicketId === undefined || rawTicketId === null ? null : String(rawTicketId).trim() || null;
  const rawSourceModel = readString(candidate.source_model);
  const sourceModel = rawSourceModel && KNOWN_SOURCE_MODELS.has(rawSourceModel)
    ? (rawSourceModel as PendingLocationCandidate['sourceModel'])
    : null;
  const qualityCode = readString(candidate.reason_code) ?? 'pending_review';
  const quality = describeLocationQuality(qualityCode);
  const contractActions = Array.isArray(candidate.actions) ? candidate.actions : [];
  const ticketHref = buildPendingLocationTicketHref(ticketId, tenantSlug, sourceModel);
  const reviewAction = buildContractAction(contractActions, 'review');
  if (!reviewAction.enabled && ticketHref) {
    reviewAction.href = ticketHref;
    reviewAction.enabled = true;
    reviewAction.reason = 'Abre el ticket para revisar la evidencia protegida sin decidir automáticamente.';
  }
  return {
    id: String(candidate.record_id ?? candidate.ticket_id ?? `pending-location-${index + 1}`),
    ticketId,
    sourceModel,
    category: readString(candidate.category) ?? 'Categoría no publicada',
    source: readString(candidate.source) ?? 'Origen no publicado',
    safeAreaLabel: safeAggregateAreaLabel(candidate),
    qualityCode,
    qualityLabel: quality.label,
    qualityDetail: quality.detail,
    ticketHref,
    actions: {
      review: reviewAction,
      approve: buildContractAction(contractActions, 'approve'),
      reject: buildContractAction(contractActions, 'reject'),
    },
  };
};

export const adaptPendingLocationQueue = (
  heatmap: OperationsHeatmapV1 | null | undefined,
  tenantSlug?: string | null,
): PendingLocationQueue => {
  const geocoding = heatmap?.geocoding;
  if (!geocoding) {
    return {
      state: 'unavailable',
      contractVersion: null,
      status: null,
      total: 0,
      published: 0,
      hidden: 0,
      writesEnabled: false,
      candidates: [],
    };
  }

  const rawCandidates = Array.isArray(geocoding.candidates) ? geocoding.candidates : [];
  const total = Math.max(readCount(geocoding.candidate_count), rawCandidates.length);
  const candidates = rawCandidates.map((candidate, index) => adaptCandidate(candidate, index, tenantSlug));
  const writesEnabled = candidates.some((candidate) => candidate.actions.approve.enabled || candidate.actions.reject.enabled);
  const published = candidates.length;
  const hidden = Math.max(0, total - published);
  const state: PendingLocationQueueState = total === 0
    ? 'empty'
    : published === 0
      ? 'summary_only'
      : hidden > 0
        ? 'partial'
        : 'ready';

  return {
    state,
    contractVersion: readString(geocoding.contract_version),
    status: readString(geocoding.status, geocoding.reason_code),
    total,
    published,
    hidden,
    writesEnabled,
    candidates,
  };
};

export const adaptTerritorialAdminQueue = (
  response: TerritorialGeocodingQueue,
  tenantSlug?: string | null,
): PendingLocationQueue => {
  const candidates = response.items.map((item) => {
    const quality = describeLocationQuality(item.reasonCode);
    const ticketHref = buildPendingLocationTicketHref(item.ticketId, tenantSlug, item.ticketSourceModel);
    const reviewEnabled = Boolean(item.detailHref);
    const approveEnabled = Boolean(item.reviewAction.href && item.reviewAction.canApprove);
    const rejectEnabled = Boolean(item.reviewAction.href && item.reviewAction.canReject);
    return {
      id: item.id,
      ticketId: item.ticketId,
      sourceModel: item.ticketSourceModel,
      category: item.category ?? 'Categoría no publicada',
      source: item.sourceModelRaw ?? 'Origen no publicado',
      safeAreaLabel: item.zone ?? 'Área todavía no publicada',
      qualityCode: item.reasonCode,
      qualityLabel: quality.label,
      qualityDetail: quality.detail,
      ticketHref,
      actions: {
        review: {
          kind: 'review' as const,
          label: 'Revisar evidencia',
          href: item.detailHref,
          enabled: reviewEnabled,
          reason: reviewEnabled
            ? 'El contrato administrativo publicó detalle autorizado y auditable.'
            : 'El contrato no publicó una ruta de detalle segura.',
        },
        approve: {
          kind: 'approve' as const,
          label: 'Aprobar ubicación',
          href: null,
          enabled: approveEnabled,
          reason: approveEnabled
            ? 'Requiere motivo controlado y confirmación humana explícita.'
            : 'La propuesta o la autoridad de revisión no permiten aprobar.',
        },
        reject: {
          kind: 'reject' as const,
          label: 'Rechazar ubicación',
          href: null,
          enabled: rejectEnabled,
          reason: rejectEnabled
            ? 'Requiere motivo controlado y confirmación humana explícita.'
            : 'La autoridad de revisión no permite rechazar este caso.',
        },
      },
    } satisfies PendingLocationCandidate;
  });
  const total = response.summary.total;
  const hidden = Math.max(0, total - candidates.length);
  return {
    state: total === 0 ? 'empty' : hidden > 0 ? 'partial' : 'ready',
    contractVersion: response.contractVersion,
    status: response.summary.needsHumanReview > 0 ? 'pending' : 'ready',
    total,
    published: candidates.length,
    hidden,
    writesEnabled: candidates.some((candidate) => candidate.actions.approve.enabled || candidate.actions.reject.enabled),
    candidates,
  };
};
