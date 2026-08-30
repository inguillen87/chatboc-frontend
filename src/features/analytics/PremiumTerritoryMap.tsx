import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  Brain,
  CheckCircle2,
  Compass,
  DatabaseZap,
  Eye,
  Filter,
  Gauge,
  Globe2,
  Layers,
  ListChecks,
  MapPin,
  Radar,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import LazyMapLibreMap from '@/components/LazyMapLibreMap';
import { cn } from '@/lib/utils';

import type {
  OperationsHeatmapGeoFeatureCollection,
  OperationsHeatmapPoint,
  OperationsHeatmapV1,
  PublicMapConfigV1,
} from './analyticsTypes';
import type { MapLibreMapProps } from '@/components/MapLibreMap';
import type { HeatPoint } from '@/services/statsService';
import { TerritorialMapAccessibleSheet } from './TerritorialMapAccessibleSheet';
import {
  buildTerritorialTicketHref,
  isTerritorialTenantScopeCompatible,
  resolveTerritorialTicketIdentity,
} from '@/utils/territorialTicketIdentity';
import {
  aggregateTerritoryHeatmap,
  DEVELOPMENT_TERRITORY_ZONES,
  getDemoTerritoryHeatmapPoints,
  isTerritoryDemoFallbackEnabled,
  PREMIUM_HEATMAP_MIN_SAMPLE_SIZE,
  resolveOfficialTerritoryZones,
  resolveTerritoryDataProvenance,
  resolveTerritoryLayerDescriptors,
  resolveTerritoryMapReadiness,
  territoryCentroid,
  territoryZoneToPath,
  type TerritoryLayerDescriptor,
  type TerritoryZoneMetric,
} from './premiumTerritoryHeatmap';

type DemoProfile = 'gobierno' | 'empresa' | 'colegio' | 'general';

type ActiveFilterSummary = {
  key: string;
  label: string;
  value: string;
  onClear?: () => void;
};

type MapFocusMode = 'territory' | 'quality' | 'telemetry';
type MapDisplayMode = 'hybrid' | 'clusters' | 'heat';

type BackendActionSummary = {
  label: string;
  detail?: string;
  priority?: string;
  uiHint?: string;
  actionType?: string;
  writesEnabled?: boolean;
  href?: string;
};

type OperationsGeoLayerConfig = NonNullable<MapLibreMapProps['geoLayerConfig']>;

type PremiumTerritoryHeatmapProps = {
  points: OperationsHeatmapPoint[];
  heatmap?: OperationsHeatmapV1;
  labels?: Record<string, string>;
  activeFilters?: ActiveFilterSummary[];
  mapConfig?: PublicMapConfigV1;
  minSampleSize?: number;
  allowDemoFallback?: boolean;
  demoProfile?: DemoProfile;
  tenantSlug?: string | null;
  className?: string;
};

const numberFormatter = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });

const MAP_CATEGORY_COLORS = ['#2563eb', '#0f766e', '#d97706', '#7c3aed', '#e11d48', '#0891b2'];

const normalizedFacetValue = (value: string | undefined) => value?.trim().toLocaleLowerCase('es-AR') ?? '';

const isNamedFacetValue = (value: string | undefined) => {
  const normalized = normalizedFacetValue(value).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  return Boolean(
    normalized &&
      ![
        'sin zona',
        'sin barrio',
        'sin categoria',
        'sin categoría',
        'no informado',
        'no informada',
        'desconocido',
        'desconocida',
        'unknown',
        'none',
        'null',
        'n/a',
      ].includes(normalized),
  );
};

const categoryColorFor = (value: string | undefined) => {
  const normalized = normalizedFacetValue(value) || 'sin-categoria';
  const hash = Array.from(normalized).reduce((total, character) => (total * 31 + character.charCodeAt(0)) >>> 0, 0);
  return MAP_CATEGORY_COLORS[hash % MAP_CATEGORY_COLORS.length];
};

type SafeLocationFacet = {
  key: string;
  label: string;
  kind: 'cell' | 'street';
};

type TerritoryMapFacet = {
  key: string;
  label: string;
  total: number;
  mappedCount: number;
  pendingGeocodeCount: number;
  outsideJurisdictionCount: number;
  matchKeys: string[];
  color?: string;
  volume?: number;
};

type ScopedTerritoryView = {
  mode: 'global' | 'single' | 'combined';
  label: string;
  visiblePointCount: number;
  total?: number;
  mappedCount: number;
  pendingGeocodeCount?: number;
  outsideJurisdictionCount?: number;
  coveragePercent?: number;
  selectedFacet?: TerritoryMapFacet;
  globalInsightsCompatible: boolean;
};

const compactWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const withoutDiacritics = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const MAX_ADDRESS_CORRIDOR_FACETS = 6;

const NARRATIVE_LOCATION_PATTERN =
  /^(?:justamente|luminaria|la\s+luminaria|hay\s+(?:un|una)|se\s+encuentra|quiero|necesito|solicito|reclamo|bache|el\s+bache|arbol\s+caido|basura|por\s+favor|frente\s+a|al\s+lado)\b|\b(?:apagada|apagado|no\s+funciona|sin\s+luz|roto|rota|caido|caida|desbordado|desbordada)\b/i;

const normalizedStreetKeyPart = (value: string) =>
  withoutDiacritics(value)
    .toLocaleLowerCase('es-AR')
    .replace(/^(?:avenida|av(?:da)?)\s*[.:]?\s+/, 'av ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const streetCorridorFacetKey = (value: string) => {
  const normalizedParts = value
    .split(/\s*\/\s*/)
    .map(normalizedStreetKeyPart)
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, 'es'));
  return normalizedFacetValue(`street:${normalizedParts.join(':intersection:')}`);
};

const streetCorridorLabel = (corridor: string) =>
  corridor.includes(' / ') ? `Intersección ${corridor}` : `Corredor ${corridor}`;

const stableLocationCode = (value: string) => {
  const hash = Array.from(value).reduce((total, character) => (total * 33 + character.charCodeAt(0)) >>> 0, 5381);
  return String((hash % 97) + 1).padStart(2, '0');
};

/**
 * Executive maps must never turn a heat-point tooltip or filter into a list of
 * household addresses. Exact locations remain available from the authorized
 * ticket workspace; this view only keeps a street corridor or backend-issued
 * aggregated cell label.
 */
const safeStreetCorridor = (value: string | undefined) => {
  if (!value) return undefined;
  const compactValue = compactWhitespace(value)
    .replace(/^(?:ubicaci[oó]n|direcci[oó]n|domicilio)\s*[:\-]\s*/i, '')
    .split(/[\n\r|;]/, 1)[0]
    .trim();
  const narrativeCandidate = withoutDiacritics(compactValue).toLocaleLowerCase('es-AR');
  if (!compactValue || compactValue.length > 96 || /[!?]/.test(compactValue) || NARRATIVE_LOCATION_PATTERN.test(narrativeCandidate)) {
    return undefined;
  }

  const withoutCoordinates = compactValue.replace(/-?\d{1,3}[.,]\d{3,}\s*[,;/]\s*-?\d{1,3}[.,]\d{3,}/g, '');
  const withoutUnit = withoutCoordinates.replace(
    /\b(?:piso|depto\.?|departamento|unidad|lote|casa|oficina)\b.*$/i,
    '',
  );
  const withoutGeographicSuffix = withoutUnit
    .replace(/\b(?:c\.?p\.?|c[oó]digo\s+postal)\s*:?\s*[a-z]?\d{4,8}[a-z]{0,3}\b.*$/i, '')
    .replace(/\s*,\s*[a-z]\d{4}[a-z]{0,3}\s*,\s*(?:mz|mza|mendoza)\s*,\s*(?:ar|argentina)\b.*$/i, '')
    .replace(/\s*,\s*[a-z]\d{4}[a-z]{0,3}\b.*$/i, '')
    .replace(/\s*[,\-]\s*[a-z]?\d{4}\s*[,\-]\s*(?:jun[ií]n|mendoza|argentina)\b.*$/i, '')
    .replace(/\s*[,\-]\s*(?:jun[ií]n|mendoza|buenos\s+aires|argentina)\b.*$/i, '')
    .replace(/\s+(?:en\s+)?jun[ií]n(?:\s+centro)?(?:\s*,?\s*(?:mendoza|buenos\s+aires|argentina))?\s*$/i, '')
    .replace(/\s+(?:jun[ií]n(?:\s*,?\s*mendoza)?|mendoza|argentina)\s*$/i, '');
  const normalizeStreetSegment = (segment: string) =>
    compactWhitespace(
      segment
        .replace(/\b(?:altura|nro\.?|n[°º]|numero|número)\s*\d+[a-z]?\b/gi, '')
        // Preserve official numeric street names such as "25 de Mayo" or
        // "9 de Julio" while still removing household numbers.
        .replace(/(?:^|[\s,])#?\d{1,6}[a-z]?(?:\s+bis)?(?=$|[\s,])(?!\s+de\b)/gi, ' ')
        .replace(/^(?:avenida|av(?:da)?)\s*[.:]?\s+/i, 'Av. ')
        .replace(/\s+([,;:])/g, '$1')
        .replace(/([,;:])\s*/g, '$1 ')
        .replace(/\s*[,;:\-]+\s*$/g, '')
        .replace(/^[,;:\s]+|[,;:\s]+$/g, ''),
    );
  const intersectionParts = withoutGeographicSuffix
    .split(/\s+(?:esquina(?:\s+con)?|y)\s+|\s*\/\s*/i)
    .map(normalizeStreetSegment)
    .filter(Boolean);
  const normalized =
    intersectionParts.length === 2 && normalizedStreetKeyPart(intersectionParts[0]) !== normalizedStreetKeyPart(intersectionParts[1])
      ? intersectionParts
          .slice()
          .sort((left, right) => normalizedStreetKeyPart(left).localeCompare(normalizedStreetKeyPart(right), 'es'))
          .join(' / ')
      : normalizeStreetSegment(withoutGeographicSuffix);
  const normalizedForValidation = withoutDiacritics(normalized).toLocaleLowerCase('es-AR');
  if (
    !isNamedFacetValue(normalized) ||
    normalized.length < 3 ||
    normalized.length > 64 ||
    normalized.split(/\s+/).length > 9 ||
    NARRATIVE_LOCATION_PATTERN.test(normalizedForValidation) ||
    !/[a-záéíóúüñ]/i.test(normalized)
  ) {
    return undefined;
  }
  return normalized;
};

const safeAggregateCellLabel = (value: string | undefined) => {
  if (!value) return undefined;
  const normalized = compactWhitespace(value);
  const normalizedForValidation = withoutDiacritics(normalized).toLocaleLowerCase('es-AR');
  if (!isNamedFacetValue(normalized) || normalized.length > 64 || NARRATIVE_LOCATION_PATTERN.test(normalizedForValidation)) {
    return undefined;
  }
  if (/^(?:celda|sector|zona|barrio|distrito|cuadr[ií]cula|tramo|corredor)\b/i.test(normalized)) {
    return compactWhitespace(normalized.replace(/\b([a-záéíóúüñ]{3,})\s+#?\d{2,6}[a-z]?(?:\s+bis)?\b/gi, '$1'));
  }
  return safeStreetCorridor(normalized);
};

const safeLocationFacetForPoint = (point: OperationsHeatmapPoint): SafeLocationFacet | undefined => {
  const location = asRecord(point.location);
  const explicitCellLabel = safeAggregateCellLabel(
    readString(
      point.address_cell_label,
      point.cell_label,
      point.address_cell,
      point.street_segment,
      point.block_label,
      point.location_bucket_label,
      location?.address_cell_label,
      location?.cell_label,
      location?.street_segment,
    ),
  );
  const cellId = readString(point.cell_id, point.cellId, point.location_cell_id, location?.cell_id, location?.cellId);
  if (explicitCellLabel) {
    return {
      key: normalizedFacetValue(cellId ? `cell:${cellId}` : `label:${explicitCellLabel}`),
      label: explicitCellLabel,
      kind: 'cell',
    };
  }

  const corridor = safeStreetCorridor(
    readString(point.direccion, point.address, location?.direccion, location?.address),
  );
  if (corridor) {
    return {
      key: streetCorridorFacetKey(corridor),
      label: streetCorridorLabel(corridor),
      kind: 'street',
    };
  }

  if (cellId) {
    return {
      key: normalizedFacetValue(`cell:${cellId}`),
      label: `Sector territorial ${stableLocationCode(cellId)}`,
      kind: 'cell',
    };
  }
  return undefined;
};

const presentExecutiveText = (value: string | undefined) =>
  value
    ?.replace(/\bGeoJSON\b/gi, 'archivo oficial de límites territoriales')
    .replace(/\bbackend\b/gi, 'sistema')
    .replace(/\bAPI\b/g, 'sistema')
    .replace(/\bhotspots\b/gi, 'zonas prioritarias')
    .replace(/\bhotspot\b/gi, 'zona prioritaria')
    .replace(/\brealtime\b/gi, 'actualización continua')
    .replace(/\bAI\b/g, 'IA')
    .replace(/\bmedium\b/gi, 'medio')
    .replace(/\b1 zonas\b/gi, '1 zona')
    .replace(/\b1 zona activas\b/gi, '1 zona activa')
    .replace(/\b1 zona prioritarias\b/gi, '1 zona prioritaria')
    .replace(/\b1 zona críticas\b/gi, '1 zona crítica')
    .replace(/\blos zonas\b/gi, 'las zonas')
    .replace(/\bsenales\b/gi, 'señales')
    .replace(/\bsenal\b/gi, 'señal')
    .replace(/\bdecision\b/gi, 'decisión')
    .replace(/\bacciones\b/gi, 'acciones')
    .replace(/\baccion\b/gi, 'acción')
    .replace(/\bproximas\b/gi, 'próximas')
    .replace(/\bproxima\b/gi, 'próxima')
    .replace(/\bpreparacion\b/gi, 'preparación')
    .replace(/\bubicaciones\b/gi, 'ubicaciones')
    .replace(/\bubicacion\b/gi, 'ubicación')
    .replace(/\bcomparacion\b/gi, 'comparación')
    .replace(/\basignacion\b/gi, 'asignación')
    .replace(/\bconcentracion\b/gi, 'concentración')
    .replace(/\bcategorias\b/gi, 'categorías')
    .replace(/\bcategoria\b/gi, 'categoría')
    .replace(/\bcriticos\b/gi, 'críticos')
    .replace(/\bcritico\b/gi, 'crítico')
    .replace(/\bestatica\b/gi, 'estática')
    .replace(/\bestatico\b/gi, 'estático')
    .replace(/\bprediccion\b/gi, 'predicción')
    .replace(/\bconfirmacion\b/gi, 'confirmación')
    .replace(/\bminima\b/gi, 'mínima')
    .replace(/\bminimo\b/gi, 'mínimo')
    .replace(/\butil\b/gi, 'útil')
    .replace(/\bgeocodificacion\b/gi, 'localización')
    .replace(/\s+/g, ' ')
    .trim();

const NO_TERRITORY_ZONE_METRIC: TerritoryZoneMetric = {
  zone: {
    id: 'without-official-boundaries',
    label: 'Sin delimitación territorial oficial',
    polygon: [],
    source: 'official',
  },
  total: 0,
  previousTotal: 0,
  records: 0,
  intensity: 0,
  suppressed: false,
  confidence: 'insufficient',
  topCategories: [],
  recommendation: 'Cargá un archivo oficial de límites de barrios, distritos o circuitos para habilitar métricas por zona.',
};

const labelFor = (labels: Record<string, string> | undefined, key: string, fallback: string) => {
  const candidate = labels?.[key];
  return presentExecutiveText(typeof candidate === 'string' && candidate.trim() ? candidate : fallback) ?? fallback;
};

const formatNumber = (value: number | undefined, fallback = '--') =>
  value === undefined || Number.isNaN(value) ? fallback : numberFormatter.format(value);

const formatCountLabel = (value: number, singular: string, plural: string, fallback = '0') =>
  `${formatNumber(value, fallback)} ${Math.abs(value) === 1 ? singular : plural}`;

const TerritoryFacetCounts = ({
  facet: { total, mappedCount, pendingGeocodeCount, outsideJurisdictionCount },
}: {
  facet: Pick<
    TerritoryMapFacet,
    'total' | 'mappedCount' | 'pendingGeocodeCount' | 'outsideJurisdictionCount'
  >;
}) => (
  <span aria-hidden="true" className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] font-normal leading-4 text-current/70">
    <span>Total {formatNumber(total)}</span>
    <span>Mapeados {formatNumber(mappedCount)}</span>
    <span>Pendientes {formatNumber(pendingGeocodeCount)}</span>
    <span className={outsideJurisdictionCount > 0 ? 'text-amber-700 dark:text-amber-200' : undefined}>
      Revisar {formatNumber(outsideJurisdictionCount)}
    </span>
  </span>
);

const formatVariation = (value: number | undefined) => {
  if (value === undefined) return 'sin comparación';
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${numberFormatter.format(value)}%`;
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

const asRecordArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(asRecord(item)))
    : [];

const readString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
};

const readNumber = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
};

const isOutsideJurisdictionRecord = (value: unknown) => {
  const record = asRecord(value);
  if (!record) return false;
  if (record.outside_jurisdiction === true || record.is_outside_jurisdiction === true) return true;
  const status = normalizedFacetValue(
    readString(
      record.coordinate_jurisdiction_status,
      record.jurisdiction_status,
      record.location_jurisdiction_status,
    ),
  );
  const reasonCode = normalizedFacetValue(readString(record.reason_code, record.location_reason_code));
  return status === 'outside' || reasonCode === 'coordinates_outside_configured_jurisdiction';
};

const toLiveHeatPoint = (
  point: OperationsHeatmapPoint,
  tenantSlug?: string | null,
): HeatPoint | null => {
  const location = asRecord(point.location);
  const lat = readNumber(point.lat, location?.lat, point.latitude);
  const lng = readNumber(point.lng, location?.lng, location?.lon, point.lon, point.longitude);
  if (lat === undefined || lng === undefined) return null;
  if (!isTerritorialTenantScopeCompatible(point, tenantSlug)) return null;

  const id = readStringOrNumber(point.id, point.ticket_id, point.record_id);
  const ticketIdentity = resolveTerritorialTicketIdentity(point, tenantSlug);
  const canonicalTicketIdentity = ticketIdentity.status === 'valid' ? ticketIdentity.identity : null;
  const locationFacet = safeLocationFacetForPoint(point);
  const addressCorridor = safeStreetCorridor(
    readString(point.direccion, point.address, location?.direccion, location?.address),
  );
  return {
    lat,
    lng,
    ...(id !== undefined ? { id } : {}),
    weight: readNumber(point.weight, point.total, point.count, point.value) ?? 1,
    total: readNumber(point.total, point.count, point.value),
    ticket: canonicalTicketIdentity?.ticketId ?? readString(point.ticket, point.ticket_id, point.record_id),
    ticketId: canonicalTicketIdentity?.ticketId,
    sourceModel: canonicalTicketIdentity?.sourceModel,
    recordId: readStringOrNumber(point.record_id, point.ticket_id),
    recordSource: readString(point.record_source),
    ticketIdentityStatus: ticketIdentity.status,
    ticketHref: buildTerritorialTicketHref(canonicalTicketIdentity, tenantSlug),
    tenantSlug: canonicalTicketIdentity?.tenantSlug ?? undefined,
    categoria: readString(point.categoria, point.category, point.type, point.layer),
    canal: readString(point.canal, point.channel),
    barrio: readString(point.zone, point.zona, point.barrio, point.district, point.distrito),
    estado: readString(point.estado, point.status),
    severidad: readString(point.severidad, point.severity),
    fuente: readString(point.fuente, point.source),
    // Never forward a household address into the executive map popup.
    direccion: locationFacet?.label,
    addressCellLabel: locationFacet?.label,
    addressCellKey: locationFacet?.key,
    addressCorridorKey: addressCorridor
      ? streetCorridorFacetKey(addressCorridor)
      : undefined,
    cellId: readString(point.cell_id, point.cellId, point.location_cell_id, location?.cell_id),
    locationQuality: readString(point.location_quality, point.locationQuality, point.geocode_quality),
    locationProvenance: readString(
      point.location_provenance,
      point.locationProvenance,
      point.address_source,
      point.coordinate_source,
    ),
    last_ticket_at: readString(point.last_ticket_at, point.updated_at, point.created_at) ?? null,
    feature: { raw: point },
  };
};

const exactTicketHrefForPoint = (
  point: HeatPoint | null | undefined,
  tenantSlug?: string | null,
) => {
  if (!point || Number(point.clusterSize ?? 1) > 1) return null;
  const expectedTenantSlug = point.tenantSlug ?? tenantSlug;
  const resolution = resolveTerritorialTicketIdentity(point, expectedTenantSlug);
  return buildTerritorialTicketHref(
    resolution.status === 'valid' ? resolution.identity : null,
    expectedTenantSlug,
  );
};

const formatPercent = (value: number | undefined) =>
  value === undefined || Number.isNaN(value) ? '--' : `${numberFormatter.format(value)}%`;

const CONTRACT_VALUE_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  queued: 'En revisión',
  ready: 'Disponible',
  online: 'Conectividad no verificada',
  connected: 'Conectividad no verificada',
  disconnected: 'Sin conexión confirmada',
  stale: 'Actualización pendiente',
  unknown: 'Estado no confirmado',
  active: 'Activo',
  inactive: 'Inactivo',
  enabled: 'Habilitado',
  disabled: 'Deshabilitado',
  manual: 'Actualización manual',
  critical: 'Crítica',
  healthy: 'Operación estable',
  degraded: 'Operación parcial',
  client_filter: 'Filtro operativo',
  interactive_globe_heatmap: 'Mapa territorial interactivo',
  show_geocoding_queue_and_ai_summary: 'Mostrar ubicaciones pendientes y resumen operativo',
  local_fallback: 'Análisis local seguro',
  municipal_risk_detection: 'Detección municipal de riesgos',
  deterministic_lightweight_dashboard: 'Análisis local verificable',
  webgl_heatmap: 'Mapa de calor acelerado',
  fly_to: 'Encuadre automático',
  open_geocoding_queue: 'Abrir ubicaciones pendientes',
  open_ai_risk_layers: 'Revisar riesgos sugeridos',
  open_template_or_live_chat: 'Abrir respuesta o conversación',
  focus_map_cell_and_filter_tickets: 'Priorizar zona y filtrar reclamos',
  open_ticket: 'Abrir reclamo',
  operations_heatmap_updated: 'Mapa territorial actualizado',
  ticket_updated: 'Reclamo actualizado',
  base_heatmap: 'Mapa de calor',
  hotspot_cells: 'Zonas de mayor intensidad',
  category_layers: 'Capas por categoría',
  ai_risk_layers: 'Riesgo sugerido por IA',
  survey_participation: 'Participación en encuestas',
  whatsapp_activity: 'Actividad de WhatsApp',
  risk_pulses: 'Alertas de riesgo',
  priority_forecast: 'Prioridad sugerida',
  geocoding_queue: 'Ubicaciones pendientes',
  realtime_telemetry: 'Actividad en tiempo real',
  coverage_quality: 'Calidad de cobertura',
  privileged_exact: 'Acceso institucional protegido',
  employee_aggregated: 'Datos agregados del equipo',
  tenant_aggregated: 'Datos agregados del municipio',
  public_aggregated: 'Datos públicos agregados',
  default: 'Predeterminada',
  fit_bounds: 'Encuadre automático',
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
  open_queue: 'Abrir cola operativa',
  open_panel: 'Abrir panel operativo',
  open_heatmap_cell: 'Abrir zona prioritaria',
  inspect_hotspot: 'Revisar zona prioritaria',
  inspeccionar_hotspot: 'Revisar zona prioritaria',
  ai_risk_pulses: 'Alertas de riesgo',
  tickets: 'Reclamos',
  surveys: 'Encuestas',
  analytics_events: 'Eventos operativos',
  whatsapp: 'WhatsApp',
  points: 'Puntos mapeados',
  cells: 'Zonas agregadas',
  layers: 'Capas de análisis',
};

const TECHNICAL_VALUE_PATTERN =
  /(?:^https?:\/\/|^\/api\/|\b(?:api|backend|frontend|webgl|maplibre|geojson|socket|endpoint|renderer|contract)\b|(?:^|[._-])v\d+(?:$|[._-]))/i;
const OPAQUE_CONTRACT_TOKEN_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)+$/i;

const humanizeContractValue = (value: string | undefined, fallback: string) => {
  if (!value) return presentExecutiveText(fallback) ?? fallback;
  const readable = value.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const normalized = readable.toLowerCase().replace(/\s+/g, '_');
  const knownLabel = CONTRACT_VALUE_LABELS[normalized];
  if (knownLabel) return knownLabel;
  if (TECHNICAL_VALUE_PATTERN.test(value) || OPAQUE_CONTRACT_TOKEN_PATTERN.test(value)) {
    return presentExecutiveText(fallback) ?? fallback;
  }
  return presentExecutiveText(readable) ?? presentExecutiveText(fallback) ?? fallback;
};

const humanizeCategoryValue = (value: string | undefined, fallback = 'Sin categoría') => {
  if (!value) return fallback;
  const readable = value.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (TECHNICAL_VALUE_PATTERN.test(value)) return fallback;
  return presentExecutiveText(readable) ?? fallback;
};

const resolveRealtimeFreshness = (latestEventAt: string | undefined, pollSeconds: number | undefined) => {
  if (!latestEventAt) {
    return {
      isFresh: false,
      label: 'Conectividad no verificada',
      detail: 'Sin confirmación reciente del canal de actualización.',
    };
  }

  const timestamp = Date.parse(latestEventAt);
  if (!Number.isFinite(timestamp)) {
    return {
      isFresh: false,
      label: 'Conectividad no verificada',
      detail: 'La última actualización informada no tiene una fecha válida.',
    };
  }

  const ageMs = Date.now() - timestamp;
  const allowedAgeMs = Math.max(5 * 60_000, Math.max(0, pollSeconds ?? 0) * 3_000);
  const formattedTimestamp = new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
    .format(new Date(timestamp))
    .replace(/\.+$/, '');

  if (ageMs >= -60_000 && ageMs <= allowedAgeMs) {
    return {
      isFresh: true,
      label: 'Actualizado recientemente',
      detail: `Última actualización confirmada: ${formattedTimestamp}.`,
    };
  }

  return {
    isFresh: false,
    label: 'Actualización pendiente',
    detail: `Último dato recibido: ${formattedTimestamp}. La conectividad actual no está verificada.`,
  };
};

const privacyModeLabel = (value: string | undefined) => {
  const normalized = value?.trim().toLowerCase();
  if (['aggregated', 'tenant_aggregated', 'public_aggregated'].includes(normalized ?? '')) {
    return 'privacidad agregada';
  }
  if (normalized === 'coordinates_without_customer_pii') return 'sin datos personales';
  if (normalized === 'privileged_exact') return 'acceso institucional protegido';
  if (normalized === 'employee_aggregated') return 'datos agregados del equipo';
  return humanizeContractValue(value, 'privacidad protegida');
};

const operationalRankLabel = (reason: string | undefined) => {
  const labels: Record<string, string> = {
    sla_breached: 'SLA vencido',
    overdue_cases: 'Casos vencidos',
    unassigned_cases: 'Sin responsable',
    recent_activity: 'Actividad reciente',
    ticket_density: 'Densidad de tickets',
    activity_density: 'Densidad operativa',
  };
  return labels[reason ?? ''] ?? humanizeContractValue(reason, 'Prioridad operativa');
};

const layerToneClass: Record<TerritoryLayerDescriptor['tone'], string> = {
  heat: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200',
  ai: 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-200',
  quality: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200',
  realtime: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-200',
  commerce: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-200',
  neutral: 'border-border bg-background/80 text-foreground',
};

const readinessToneClass = {
  ready: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200',
  degraded: 'border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-200',
  low: 'border-orange-500/35 bg-orange-500/10 text-orange-700 dark:text-orange-200',
  empty: 'border-destructive/35 bg-destructive/10 text-destructive',
};

const provenanceToneClass: Record<
  ReturnType<typeof resolveTerritoryDataProvenance>['state'],
  string
> = {
  real: 'border-sky-500/35 bg-sky-500/10 text-sky-700 dark:text-sky-200',
  synthetic: 'border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-200',
  demo: 'border-violet-500/35 bg-violet-500/10 text-violet-700 dark:text-violet-200',
  unvalidated: 'border-slate-500/35 bg-slate-500/10 text-slate-700 dark:text-slate-200',
};

const badgeVariantForReadiness = (state: ReturnType<typeof resolveTerritoryMapReadiness>['state']) => {
  if (state === 'ready') return 'default';
  if (state === 'empty') return 'destructive';
  return 'secondary';
};

const readinessCopy = (
  state: ReturnType<typeof resolveTerritoryMapReadiness>['state'],
  labels: Record<string, string> | undefined,
) => {
  if (state === 'ready') {
    return labelFor(labels, 'premium_map_quality_ready', 'Mapa listo para operar con cobertura suficiente.');
  }
  if (state === 'degraded') {
    return labelFor(labels, 'premium_map_quality_degraded', 'La lectura es útil, pero conviene resolver coordenadas pendientes.');
  }
  if (state === 'low') {
    return labelFor(labels, 'premium_map_quality_low', 'Muestra territorial baja: usar como señal, no como decisión final.');
  }
  return labelFor(labels, 'premium_map_quality_empty', 'Faltan coordenadas para construir inteligencia territorial confiable.');
};

const extractTicketIdFromEndpoint = (value: string | undefined) => {
  if (!value) return undefined;
  const match = value.match(/\/tickets\/([^/?#]+)/i);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
};

const readStringOrNumber = (...values: unknown[]) => {
  const text = readString(...values);
  if (text) return text;
  const numeric = readNumber(...values);
  return numeric !== undefined ? String(numeric) : undefined;
};

const buildTicketDeskHref = (record: Record<string, unknown>) => {
  const frontendPath = readString(record.frontend_path, record.route, record.href);
  const isSafeSameOriginPath = Boolean(
    frontendPath
      && frontendPath.startsWith('/')
      && !frontendPath.startsWith('//')
      && !frontendPath.includes('\\')
      && !/[\r\n]/.test(frontendPath),
  );
  if (isSafeSameOriginPath) return frontendPath;

  const endpoint = readString(record.endpoint, record.endpoint_template);
  const target = asRecord(record.target);
  const filters = asRecord(record.filters);
  const params = new URLSearchParams();
  params.set('tab', 'tickets');

  const uiHint = readString(record.ui_hint);
  const actionType = readString(record.action_type);
  const ticketId =
    readStringOrNumber(record.ticket_id, record.record_id, target?.ticket_id, target?.record_id) ??
    extractTicketIdFromEndpoint(endpoint);
  const inferredSourceModel = readString(
    record.source_model,
    record.sourceModel,
    record.record_source,
    target?.source_model,
    target?.sourceModel,
    target?.record_source,
  ) ?? (endpoint?.includes('/api/v2/tickets/') ? 'TenantTicket' : undefined);
  const exactIdentity = ticketId
    ? resolveTerritorialTicketIdentity({
        source_model: inferredSourceModel,
        ticket_id: ticketId,
      })
    : null;
  const category = readString(record.categoria, record.category, target?.categoria, target?.category, filters?.category, filters?.categoria);
  const status = readString(record.estado, record.status, target?.estado, target?.status);
  const channel = readString(record.canal, record.channel, target?.canal, target?.channel, filters?.channel, filters?.canal);
  const cellId = readString(record.cell_id, target?.cell_id, filters?.cell_id);

  if (uiHint) params.set('focus', uiHint);
  else if (actionType) params.set('focus', actionType);
  if (exactIdentity?.status === 'valid') {
    params.set('source_model', exactIdentity.identity.sourceModel);
    params.set('ticket_id', exactIdentity.identity.ticketId);
  }
  if (category) params.set('categoria', category);
  if (status) params.set('estado', status);
  if (channel) params.set('canal', channel);
  if (cellId) params.set('heatmap_cell', cellId);
  if (uiHint === 'open_geocoding_queue') params.set('sla', 'risk');

  return params.toString() === 'tab=tickets' ? undefined : `/perfil?${params.toString()}`;
};

const summarizeBackendAction = (action: unknown): BackendActionSummary | undefined => {
  const record = asRecord(action);
  if (!record) return undefined;
  const rawLabel = readString(record.title, record.label, record.name);
  const label = rawLabel ? humanizeContractValue(rawLabel, 'Acción disponible') : undefined;
  const contextLabel = readString(record.context_label, record.contextLabel);
  const target = asRecord(record.target);
  const targetType = readString(target?.type, target?.kind);
  const numericTargetId = readNumber(target?.record_id, target?.ticket_id, target?.lat, target?.lng);
  const targetId = readString(target?.cell_id, target?.record_id, target?.ticket_id) ?? (numericTargetId !== undefined ? String(numericTargetId) : undefined);
  const targetLabel = targetType || targetId ? [targetType, targetId].filter(Boolean).join(' ') : undefined;
  const rawHumanDetail = readString(record.description, record.reason_code, record.action_type, record.ui_hint);
  const humanDetail = rawHumanDetail
    ? humanizeContractValue(rawHumanDetail, 'Detalle operativo')
    : undefined;
  const href = buildTicketDeskHref(record);
  const detail = contextLabel
    ? humanizeCategoryValue(contextLabel, 'Contexto operativo')
    : humanDetail ?? (targetLabel ? humanizeContractValue(targetLabel, 'Contexto operativo') : undefined);
  if (!label && !detail) return undefined;
  return {
    label: label ?? 'Acción disponible',
    detail,
    priority: readString(record.priority),
    uiHint: readString(record.ui_hint),
    actionType: readString(record.action_type),
    writesEnabled: record.writes_enabled === true,
    href,
  };
};

const uniqueActionSummaries = (actions: unknown[]) => {
  const seen = new Set<string>();
  return actions.reduce<BackendActionSummary[]>((acc, action) => {
    const summary = summarizeBackendAction(action);
    if (!summary) return acc;
    const key = `${summary.label}|${summary.detail ?? ''}`;
    if (seen.has(key)) return acc;
    seen.add(key);
    acc.push(summary);
    return acc;
  }, []);
};

const actionWithContext = (action: unknown, contextLabel: string | undefined) => {
  const record = asRecord(action);
  if (!record || !contextLabel) return action;
  return { ...record, context_label: contextLabel };
};

const layerIsEnabled = (enabledLayerIds: string[], fragments: string[]) =>
  enabledLayerIds.some((layerId) => fragments.some((fragment) => layerId.includes(fragment)));

const readStringArray = (...values: unknown[]) => {
  for (const value of values) {
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim());
    }
  }
  return [];
};

const uniqueStrings = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

const isFeatureCollection = (value: unknown): value is OperationsHeatmapGeoFeatureCollection => {
  const record = asRecord(value);
  return record?.type === 'FeatureCollection' && Array.isArray(record.features);
};

const featureCollectionFromHeatmap = (heatmap?: OperationsHeatmapV1): OperationsHeatmapGeoFeatureCollection | undefined => {
  const collection = heatmap?.geo_layers?.points;
  return isFeatureCollection(collection) && collection.features.length > 0 ? collection : undefined;
};

const operationsPointsFromFeatureCollection = (
  collection: OperationsHeatmapGeoFeatureCollection | undefined,
): OperationsHeatmapPoint[] => {
  if (!collection) return [];
  return collection.features.reduce<OperationsHeatmapPoint[]>((acc, feature, index) => {
    const geometry = asRecord(feature.geometry);
    const properties = asRecord(feature.properties) ?? {};
    const coordinates = Array.isArray(geometry?.coordinates) ? geometry.coordinates : [];
    const lng = readNumber(coordinates[0]);
    const lat = readNumber(coordinates[1]);
    if (lat === undefined || lng === undefined) return acc;
    const id = readStringOrNumber(feature.id, properties.id, properties.ticket_id, properties.record_id) ?? `geo-layer-${index}`;
    acc.push({
      ...properties,
      id,
      lat,
      lng,
      weight: readNumber(properties.weight, properties.count, properties.total) ?? 1,
      category: readString(properties.category, properties.categoria),
      categoria: readString(properties.categoria, properties.category),
      channel: readString(properties.channel, properties.canal),
      canal: readString(properties.canal, properties.channel),
      zone: readString(properties.zone, properties.zona),
      zona: readString(properties.zona, properties.zone),
      barrio: readString(properties.barrio, properties.neighborhood, properties.zone, properties.zona),
      distrito: readString(properties.distrito, properties.district),
      address: readString(properties.address, properties.direccion),
      direccion: readString(properties.direccion, properties.address),
      address_cell: readString(properties.address_cell, properties.addressCell, properties.street_segment),
      address_cell_label: readString(
        properties.address_cell_label,
        properties.addressCellLabel,
        properties.cell_label,
        properties.location_bucket_label,
      ),
      cell_id: readString(properties.cell_id, properties.cellId, properties.location_cell_id),
      cell_label: readString(properties.cell_label, properties.cellLabel, properties.address_cell_label),
      location_quality: readString(properties.location_quality, properties.locationQuality, properties.geocode_quality),
      location_provenance: readString(
        properties.location_provenance,
        properties.locationProvenance,
        properties.address_source,
        properties.coordinate_source,
      ),
      status: readString(properties.status, properties.estado),
      estado: readString(properties.estado, properties.status),
      source: readString(properties.source, properties.fuente),
      label: readString(properties.label, properties.title, properties.name),
      feature: { raw: properties, geojson: feature },
    });
    return acc;
  }, []);
};

const findMapLayerRecord = (mapLayers: Record<string, unknown> | undefined, fragments: string[]) => {
  const layers = asRecordArray(mapLayers?.layers);
  return layers.find((layer) => {
    const id = readString(layer.id, layer.key);
    const type = readString(layer.type);
    return fragments.some((fragment) => id?.includes(fragment) || type?.includes(fragment));
  });
};

const buildOperationsGeoLayerConfig = ({
  heatmap,
  points,
  enabledLayerIds,
  mapStyleUrl,
  showHeatLayer,
  showAiLayer,
  showQualityLayer,
  showRealtimeLayer,
  showCommerceLayer,
}: {
  heatmap?: OperationsHeatmapV1;
  points: HeatPoint[];
  enabledLayerIds: string[];
  mapStyleUrl?: string | null;
  showHeatLayer: boolean;
  showAiLayer: boolean;
  showQualityLayer: boolean;
  showRealtimeLayer: boolean;
  showCommerceLayer: boolean;
}): OperationsGeoLayerConfig | null => {
  if (!heatmap) return null;

  const mapLayers = asRecord(heatmap.map_layers);
  const geoLayerSource = featureCollectionFromHeatmap(heatmap);
  const provider = asRecord(mapLayers?.provider);
  const categoryHeatmap = asRecord(mapLayers?.category_heatmap);
  const hotspots = asRecord(mapLayers?.hotspots);
  const telemetry = asRecord(mapLayers?.telemetry);
  const backendHeatLayer = findMapLayerRecord(mapLayers, ['base_heatmap', 'heatmap']);
  const backendCellLayer = findMapLayerRecord(mapLayers, ['cells', 'cell']);
  const backendHotspotLayer = findMapLayerRecord(mapLayers, ['hotspots', 'hotspot', 'symbol']);
  const layerStyle = asRecord(heatmap.layer_style_contract);
  const styleTokens = asRecord(layerStyle?.style_tokens);
  const layerIds = asRecord(styleTokens?.layer_ids);
  const viewportPresets = asRecord(heatmap.viewport_presets);
  const legend = asRecord(heatmap.legend);
  const realtimeEvents = heatmap.realtime?.socket_events ?? [];
  const telemetryEvents = uniqueStrings([
    ...readStringArray(telemetry?.events),
    ...realtimeEvents,
    'map_loaded',
    'cluster_click',
    'layer_toggle',
    'time_slider_changed',
  ]).slice(0, 12);

  const localFeatures = points
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
    .map((point, index) => {
      const featureRecord = asRecord(point.feature);
      const rawPoint = asRecord(featureRecord?.raw) ?? featureRecord;
      const pointId =
        readStringOrNumber(point.id, point.ticket, rawPoint?.id, rawPoint?.ticket_id, rawPoint?.record_id, rawPoint?.cell_id) ??
        `operations-point-${index}`;
      const category = readString(point.categoria, rawPoint?.categoria, rawPoint?.category, rawPoint?.type, rawPoint?.layer);
      const channel = readString(point.canal, rawPoint?.canal, rawPoint?.channel);
      const status = readString(point.estado, rawPoint?.estado, rawPoint?.status);
      const latestEventAt = readString(point.last_ticket_at, rawPoint?.latest_event_at, rawPoint?.updated_at, rawPoint?.created_at);
      const weight = readNumber(point.totalWeight, point.weight, rawPoint?.weight, rawPoint?.count, rawPoint?.total) ?? 1;

      return {
        type: 'Feature' as const,
        id: pointId,
        geometry: { type: 'Point' as const, coordinates: [point.lng, point.lat] as [number, number] },
        properties: {
          id: pointId,
          ticket: readString(point.ticket, rawPoint?.ticket, rawPoint?.ticket_id, rawPoint?.record_id),
          ticketId: point.ticketId,
          ticket_id: point.ticketId,
          sourceModel: point.sourceModel,
          source_model: point.sourceModel,
          recordId: point.recordId,
          record_id: point.recordId,
          recordSource: point.recordSource,
          record_source: point.recordSource,
          ticketIdentityStatus: point.ticketIdentityStatus,
          ticketHref: point.ticketHref,
          categoria: category,
          category,
          categoryColor: point.categoryColor ?? categoryColorFor(category),
          canal: channel,
          channel,
          estado: status,
          status,
          weight,
          intensity: readNumber(point.intensity, rawPoint?.intensity, weight) ?? weight,
          totalWeight: readNumber(point.totalWeight, rawPoint?.total_weight, weight) ?? weight,
          // The executive map only receives the aggregated/corridor label.
          direccion: readString(point.addressCellLabel, point.direccion),
          address_cell_label: readString(point.addressCellLabel),
          barrio: readString(
            point.barrio,
            rawPoint?.zone,
            rawPoint?.zona,
            rawPoint?.barrio,
            rawPoint?.district,
            rawPoint?.distrito,
          ),
          cell_id: readString(point.cellId, rawPoint?.cell_id),
          location_quality: readString(point.locationQuality, rawPoint?.location_quality, rawPoint?.quality_state),
          location_provenance: readString(
            point.locationProvenance,
            rawPoint?.location_provenance,
            rawPoint?.address_source,
          ),
          fuente: readString(point.fuente, point.source, rawPoint?.fuente, rawPoint?.source) ?? 'operations',
          latest_event_at: latestEventAt,
          operational_score: readNumber(rawPoint?.operational_score),
          operational_rank: readString(rawPoint?.rank_reason),
          quality_state: readString(heatmap.quality?.state),
          ai_layer_active: showAiLayer,
          quality_layer_active: showQualityLayer,
          realtime_layer_active: showRealtimeLayer,
        },
      };
    });

  // Always rebuild the rendered source from privacy-sanitized points. Falling
  // back to the raw backend FeatureCollection here would bypass active facets
  // when their mapped result is empty and could reintroduce exact addresses.
  const features = localFeatures.filter((feature) => {
    const properties = asRecord(feature.properties);
    if (isOutsideJurisdictionRecord(properties)) return false;
    const source = readString(properties?.source, properties?.fuente);
    return source !== 'commerce' || showCommerceLayer;
  });
  if (features.length === 0) return null;

  return {
    contract_version: readString(heatmap.geo_layers?.contract_version) ?? 'operations.heatmap.geo_layers.v1',
    style_url: readString(mapStyleUrl, provider?.style_url, provider?.styleUrl),
    source: {
      ...(geoLayerSource ?? {}),
      type: 'FeatureCollection',
      features,
      metadata: {
        ...(asRecord(geoLayerSource?.metadata) ?? {}),
        backend_contract_version: heatmap.contract_version,
        geo_layer_contract_version: readString(heatmap.geo_layers?.contract_version),
        map_layer_contract_version: readString(mapLayers?.contract_version),
        layer_style_contract_version: readString(layerStyle?.contract_version),
        viewport_contract_version: readString(viewportPresets?.contract_version),
        legend_contract_version: readString(legend?.contract_version),
        enabled_layers: enabledLayerIds,
        operational_hotspots: heatmap.operational_hotspots?.length ?? 0,
        backend_geojson_source: Boolean(geoLayerSource),
        privacy: heatmap.privacy,
      },
    },
    source_options: {
      cluster: false,
      clusterMaxZoom: 14,
      clusterRadius: 54,
      backend_contract_version: heatmap.contract_version,
      geo_layer_contract_version: readString(heatmap.geo_layers?.contract_version),
      map_layer_contract_version: readString(mapLayers?.contract_version),
      layer_style_contract_version: readString(layerStyle?.contract_version),
      source_quality_contract_version: readString(heatmap.source_quality?.contract_version),
      default_viewport_id: readString(viewportPresets?.default_preset_id),
      enabled_layers: enabledLayerIds,
      privacy: heatmap.privacy,
      active_layers: {
        heatmap: showHeatLayer,
        ai: showAiLayer,
        quality: showQualityLayer,
        realtime: showRealtimeLayer,
        commerce: showCommerceLayer,
      },
    },
    interactions: {
      hover: true,
      time_slider: {
        enabled: showRealtimeLayer && Boolean(readString(heatmap.realtime?.latest_event_at) || realtimeEvents.length),
        field: 'latest_event_at',
      },
    },
    layers: {
      heatmap: {
        id: readString(layerIds?.heatmap, backendHeatLayer?.id, categoryHeatmap?.layer_id, categoryHeatmap?.id) ?? 'operations-heatmap-layer',
      },
      clusters: {
        id: readString(layerIds?.clusters, backendCellLayer?.id, hotspots?.cluster_layer_id, hotspots?.cluster_id) ?? 'operations-hotspot-clusters',
      },
      points: {
        id: readString(layerIds?.points, backendHotspotLayer?.id, hotspots?.point_layer_id, hotspots?.point_id) ?? 'operations-hotspot-points',
      },
    },
    telemetry: {
      event_endpoint: readString(telemetry?.event_endpoint, telemetry?.endpoint),
      events: telemetryEvents,
    },
  };
};

const coverageArc = (coveragePercent: number | undefined) => {
  const coverage = Math.max(0, Math.min(100, coveragePercent ?? 0));
  return `${coverage}, ${100 - coverage}`;
};

const fillForIntensity = (metric: TerritoryZoneMetric, selected: boolean) => {
  if (!metric.records) return 'rgba(148, 163, 184, 0.12)';
  if (metric.suppressed) return 'rgba(148, 163, 184, 0.24)';
  if (metric.intensity > 0.78) return `rgba(245, 158, 11, ${selected ? 0.82 : 0.58})`;
  if (metric.intensity > 0.48) return `rgba(20, 184, 166, ${selected ? 0.8 : 0.54})`;
  return `rgba(59, 130, 246, ${selected ? 0.72 : 0.42})`;
};

const strokeForIntensity = (metric: TerritoryZoneMetric, selected: boolean) => {
  if (selected) return 'rgba(255, 255, 255, 0.94)';
  if (!metric.records) return 'rgba(148, 163, 184, 0.28)';
  if (metric.suppressed) return 'rgba(148, 163, 184, 0.48)';
  if (metric.intensity > 0.78) return 'rgba(245, 158, 11, 0.92)';
  if (metric.intensity > 0.48) return 'rgba(20, 184, 166, 0.9)';
  return 'rgba(59, 130, 246, 0.86)';
};

const confidenceLabel = (value: string) => {
  if (value === 'high') return 'alta';
  if (value === 'medium') return 'media';
  if (value === 'low') return 'baja';
  if (value === 'empty') return 'sin datos';
  return 'muestra insuficiente';
};

const MetricLine = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-4 border-b border-border/60 py-2 last:border-b-0">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-sm font-semibold text-foreground">{value}</span>
  </div>
);

export function PremiumTerritoryHeatmap({
  points,
  heatmap,
  labels,
  activeFilters = [],
  mapConfig,
  minSampleSize = PREMIUM_HEATMAP_MIN_SAMPLE_SIZE,
  allowDemoFallback = false,
  demoProfile = 'general',
  tenantSlug,
  className,
}: PremiumTerritoryHeatmapProps) {
  const svgId = useId().replace(/:/g, '');
  const mapInstructionsId = `${svgId}-map-instructions`;
  const shouldReduceMotion = useReducedMotion();
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [comparisonEnabled, setComparisonEnabled] = useState(false);
  const [focusMode, setFocusMode] = useState<MapFocusMode>('territory');
  const [layerSelection, setLayerSelection] = useState<string[] | null>(null);
  const [mapCategoryFilter, setMapCategoryFilter] = useState<string | null>(null);
  const [mapZoneFilter, setMapZoneFilter] = useState<string | null>(null);
  const [mapAddressCellFilter, setMapAddressCellFilter] = useState<string | null>(null);
  const [selectedMapPoint, setSelectedMapPoint] = useState<HeatPoint | null>(null);
  const selectedTicketHref = exactTicketHrefForPoint(selectedMapPoint, tenantSlug);

  const backendGeoLayerPoints = useMemo(
    () => operationsPointsFromFeatureCollection(featureCollectionFromHeatmap(heatmap)),
    [heatmap],
  );
  const backendCellPoints = useMemo<OperationsHeatmapPoint[]>(
    () =>
      (heatmap?.cells ?? [])
        .map<OperationsHeatmapPoint | null>((cell, index) => {
          const record = asRecord(cell);
          if (!record) return null;
          const lat = readNumber(record.centroid_lat, record.lat, record.latitude);
          const lng = readNumber(record.centroid_lon, record.lng, record.lon, record.longitude);
          if (lat === undefined || lng === undefined) return null;
          const risk = asRecord(record.risk);
          const id =
            readString(record.cell_id, record.id) ??
            (readNumber(record.id) !== undefined ? String(readNumber(record.id)) : undefined) ??
            `cell-${index}`;
          return {
            id,
            lat,
            lng,
            weight: readNumber(record.count, record.weight, record.total) ?? 1,
            total: readNumber(record.count, record.total),
            categoria: readString(record.dominant_category, record.categoria, record.category),
            estado: readString(risk?.level, record.estado, record.status),
            severidad: readString(risk?.label, risk?.level, record.severidad, record.severity),
            fuente: 'heatmap_cell',
            cell_id: readString(record.cell_id, record.id),
            cell_label: readString(record.cell_label, record.address_cell_label, record.location_bucket_label),
            address_cell: readString(record.address_cell, record.street_segment),
            address_cell_label: readString(record.address_cell_label, record.cell_label, record.location_bucket_label),
            location_quality: readString(record.location_quality, record.quality_state),
            location_provenance: readString(record.location_provenance, record.source),
            coordinate_jurisdiction_status: readString(
              record.coordinate_jurisdiction_status,
              record.jurisdiction_status,
            ),
          };
        })
        .filter((point): point is OperationsHeatmapPoint => Boolean(point)),
    [heatmap?.cells],
  );
  const usesBackendGeoLayerPoints = points.length === 0 && backendGeoLayerPoints.length > 0;
  const usesBackendCellPoints = points.length === 0 && !usesBackendGeoLayerPoints && backendCellPoints.length > 0;
  const usesDemoData =
    allowDemoFallback &&
    isTerritoryDemoFallbackEnabled() &&
    points.length === 0 &&
    !usesBackendGeoLayerPoints &&
    !usesBackendCellPoints;
  const rawSourcePoints = useMemo(
    () =>
      usesDemoData
        ? getDemoTerritoryHeatmapPoints(demoProfile)
        : usesBackendGeoLayerPoints
          ? backendGeoLayerPoints
          : usesBackendCellPoints
            ? backendCellPoints
            : points,
    [backendCellPoints, backendGeoLayerPoints, demoProfile, points, usesBackendCellPoints, usesBackendGeoLayerPoints, usesDemoData],
  );
  const outsidePointsRejectedByFrontend = useMemo(
    () => rawSourcePoints.filter((point) => isOutsideJurisdictionRecord(point)).length,
    [rawSourcePoints],
  );
  const sourcePoints = useMemo(
    () => rawSourcePoints.filter((point) => !isOutsideJurisdictionRecord(point)),
    [rawSourcePoints],
  );
  const declaredOutsideJurisdictionCount = Math.max(
    0,
    readNumber(
      heatmap?.location_quality?.ticket_records_outside_jurisdiction,
      heatmap?.territorial_facets?.summary?.records_outside_jurisdiction,
      heatmap?.jurisdiction?.excluded_coordinate_records,
      heatmap?.jurisdiction_review?.candidate_count,
      heatmap?.summary?.outside_jurisdiction,
    ) ?? 0,
  );
  const outsideJurisdictionCount = Math.max(
    declaredOutsideJurisdictionCount,
    outsidePointsRejectedByFrontend,
  );
  const jurisdictionCityLabel = readString(heatmap?.jurisdiction?.city);
  const jurisdictionLabel = [
    jurisdictionCityLabel,
    readString(heatmap?.jurisdiction?.state_name),
  ]
    .filter((value): value is string => Boolean(value))
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(', ');
  const jurisdictionEnforced = heatmap?.jurisdiction?.enforced === true;
  const effectiveMinSampleSize = Math.max(
    minSampleSize,
    heatmap?.privacy?.minimum_sample_size ?? 0,
    heatmap?.privacy?.k_min ?? 0,
    PREMIUM_HEATMAP_MIN_SAMPLE_SIZE,
  );
  const privacyMode = normalizedFacetValue(heatmap?.privacy?.mode).replace(/[_-]+/g, ' ');
  const hasPrivacyContract = Boolean(heatmap?.privacy);
  const privilegedExactAccess = ['privileged exact', 'admin exact', 'operator exact', 'institutional exact'].includes(
    privacyMode,
  );
  const exactPrivacyMode = privilegedExactAccess || privacyMode.includes('exact');
  const aggregatedPrivacyMode = privacyMode.includes('aggregated') || privacyMode.includes('anonymous');
  const suppressedPrivacy = asRecord(heatmap?.privacy?.suppressed);
  const allTerritoryFacetsSuppressed = heatmap?.privacy?.suppressed === true;
  const exactPointsSuppressed =
    allTerritoryFacetsSuppressed ||
    heatmap?.privacy?.raw_points_redacted === true ||
    suppressedPrivacy?.exact_points === true ||
    suppressedPrivacy?.points === true;
  const categoryFacetsSuppressed =
    allTerritoryFacetsSuppressed ||
    suppressedPrivacy?.categories === true ||
    suppressedPrivacy?.category === true;
  const zoneFacetsSuppressed =
    allTerritoryFacetsSuppressed ||
    suppressedPrivacy?.zones === true ||
    suppressedPrivacy?.zone === true ||
    suppressedPrivacy?.neighborhoods === true;
  const addressCellFacetsSuppressed =
    allTerritoryFacetsSuppressed ||
    suppressedPrivacy?.addresses === true ||
    suppressedPrivacy?.address === true ||
    suppressedPrivacy?.exact_addresses === true ||
    suppressedPrivacy?.cells === true ||
    suppressedPrivacy?.location_cells === true;
  const canShowExactPointMarkers =
    !exactPointsSuppressed && !aggregatedPrivacyMode && (!hasPrivacyContract || exactPrivacyMode);
  const liveMapPoints = useMemo(
    () =>
      sourcePoints
        .map((point) => toLiveHeatPoint(point, tenantSlug))
        .filter((point): point is HeatPoint => Boolean(point))
        .map((point) => ({
          ...point,
          categoryColor: point.categoryColor ?? categoryColorFor(point.categoria),
        })),
    [sourcePoints, tenantSlug],
  );
  const canonicalCategoryFacets = heatmap?.territorial_facets?.categories ?? [];
  const canonicalZoneFacets = heatmap?.territorial_facets?.explicit_zones ?? [];
  const canonicalAddressFacets = heatmap?.territorial_facets?.addresses ?? [];
  const hasNamedMapCategories =
    canonicalCategoryFacets.some((facet) => isNamedFacetValue(readString(facet.label, facet.key))) ||
    liveMapPoints.some((point) => isNamedFacetValue(point.categoria));
  const hasNamedMapZones =
    canonicalZoneFacets.some((facet) => isNamedFacetValue(readString(facet.label, facet.key))) ||
    liveMapPoints.some((point) => isNamedFacetValue(point.barrio?.trim() || point.distrito?.trim()));
  const hasNamedMapAddressCells =
    canonicalAddressFacets.some((facet) => Boolean(safeStreetCorridor(readString(facet.label, facet.key)))) ||
    liveMapPoints.some((point) => isNamedFacetValue(point.addressCellLabel));
  const mapCategoryFacets = useMemo<TerritoryMapFacet[]>(() => {
    if (categoryFacetsSuppressed) return [];

    const canonical = canonicalCategoryFacets
      .map((facet): TerritoryMapFacet | null => {
        const rawLabel = readString(facet.label, facet.key);
        const rawKey = readString(facet.key, facet.label);
        if (!isNamedFacetValue(rawLabel) || !rawKey) return null;
        const key = normalizedFacetValue(rawKey);
        const total = Math.max(0, readNumber(facet.count, facet.total, facet.value) ?? 0);
        const rawCategoryMatchKeys = Array.isArray(facet.raw_categories)
          ? facet.raw_categories.flatMap((item) => {
              const rawCategory = asRecord(item);
              const value = readString(rawCategory?.key, rawCategory?.label);
              return value ? [normalizedFacetValue(value)] : [];
            })
          : [];
        return {
          key,
          label: humanizeCategoryValue(rawLabel),
          total,
          mappedCount: Math.max(0, readNumber(facet.mapped_count) ?? 0),
          pendingGeocodeCount: Math.max(0, readNumber(facet.pending_geocode_count) ?? 0),
          outsideJurisdictionCount: Math.max(0, readNumber(facet.outside_jurisdiction_count) ?? 0),
          matchKeys: Array.from(new Set([key, normalizedFacetValue(rawLabel), ...rawCategoryMatchKeys])),
          color: categoryColorFor(rawKey),
        };
      })
      .filter((facet): facet is TerritoryMapFacet => Boolean(facet));

    const fallback = new Map<string, TerritoryMapFacet>();
    liveMapPoints.forEach((point) => {
      const rawLabel = point.categoria?.trim();
      if (!isNamedFacetValue(rawLabel)) return;
      const key = normalizedFacetValue(rawLabel);
      const current = fallback.get(key);
      fallback.set(key, {
        key,
        label: current?.label ?? humanizeCategoryValue(rawLabel),
        total: (current?.total ?? 0) + 1,
        mappedCount: (current?.mappedCount ?? 0) + 1,
        pendingGeocodeCount: 0,
        outsideJurisdictionCount: 0,
        matchKeys: [key],
        color: current?.color ?? point.categoryColor ?? categoryColorFor(rawLabel),
      });
    });

    return (canonicalCategoryFacets.length > 0 ? canonical : Array.from(fallback.values()))
      .filter((facet) => !hasPrivacyContract || exactPrivacyMode || facet.total >= effectiveMinSampleSize)
      .sort((left, right) => right.total - left.total || left.label.localeCompare(right.label, 'es'));
  }, [canonicalCategoryFacets, categoryFacetsSuppressed, effectiveMinSampleSize, exactPrivacyMode, hasPrivacyContract, liveMapPoints]);
  const mapZoneFacets = useMemo<TerritoryMapFacet[]>(() => {
    if (zoneFacetsSuppressed) return [];

    const canonical = canonicalZoneFacets
      .map((facet): TerritoryMapFacet | null => {
        const rawLabel = readString(facet.label, facet.key);
        const rawKey = readString(facet.key, facet.label);
        if (!isNamedFacetValue(rawLabel) || !rawKey) return null;
        const key = normalizedFacetValue(rawKey);
        const total = Math.max(0, readNumber(facet.count, facet.total, facet.value) ?? 0);
        return {
          key,
          label: compactWhitespace(rawLabel),
          total,
          mappedCount: Math.max(0, readNumber(facet.mapped_count) ?? 0),
          pendingGeocodeCount: Math.max(0, readNumber(facet.pending_geocode_count) ?? 0),
          outsideJurisdictionCount: Math.max(0, readNumber(facet.outside_jurisdiction_count) ?? 0),
          matchKeys: Array.from(new Set([key, normalizedFacetValue(rawLabel)])),
        };
      })
      .filter((facet): facet is TerritoryMapFacet => Boolean(facet));

    const fallback = new Map<string, TerritoryMapFacet>();
    liveMapPoints.forEach((point) => {
      const rawLabel = point.barrio?.trim() || point.distrito?.trim();
      if (!isNamedFacetValue(rawLabel)) return;
      const key = normalizedFacetValue(rawLabel);
      const current = fallback.get(key);
      fallback.set(key, {
        key,
        label: current?.label ?? rawLabel,
        total: (current?.total ?? 0) + 1,
        mappedCount: (current?.mappedCount ?? 0) + 1,
        pendingGeocodeCount: 0,
        outsideJurisdictionCount: 0,
        matchKeys: [key],
      });
    });

    return (canonicalZoneFacets.length > 0 ? canonical : Array.from(fallback.values()))
      .filter((facet) => !hasPrivacyContract || exactPrivacyMode || facet.total >= effectiveMinSampleSize)
      .sort((left, right) => right.total - left.total || left.label.localeCompare(right.label, 'es'));
  }, [canonicalZoneFacets, effectiveMinSampleSize, exactPrivacyMode, hasPrivacyContract, liveMapPoints, zoneFacetsSuppressed]);
  const mapAddressCellFacets = useMemo<TerritoryMapFacet[]>(() => {
    if (addressCellFacetsSuppressed) return [];

    const canonical = new Map<string, TerritoryMapFacet>();
    canonicalAddressFacets.forEach((facet) => {
      const corridor = safeStreetCorridor(readString(facet.label, facet.key));
      if (!corridor) return;
      const key = streetCorridorFacetKey(corridor);
      const current = canonical.get(key);
      const total = Math.max(0, readNumber(facet.count, facet.total, facet.value) ?? 0);
      const mappedCount = Math.max(0, readNumber(facet.mapped_count) ?? 0);
      canonical.set(key, {
        key,
        label: current?.label ?? streetCorridorLabel(corridor),
        total: (current?.total ?? 0) + total,
        mappedCount: (current?.mappedCount ?? 0) + mappedCount,
        pendingGeocodeCount:
          (current?.pendingGeocodeCount ?? 0) + Math.max(0, readNumber(facet.pending_geocode_count) ?? 0),
        outsideJurisdictionCount:
          (current?.outsideJurisdictionCount ?? 0) +
          Math.max(0, readNumber(facet.outside_jurisdiction_count) ?? 0),
        matchKeys: [key],
        volume: (current?.volume ?? 0) + total,
      });
    });

    const fallback = new Map<string, TerritoryMapFacet>();
    liveMapPoints.forEach((point) => {
      const key = point.addressCellKey;
      const label = point.addressCellLabel?.trim();
      if (!key || !isNamedFacetValue(label)) return;
      const current = fallback.get(key);
      const pointVolume = Math.max(1, readNumber(point.totalWeight, point.total, point.weight) ?? 1);
      fallback.set(key, {
        key,
        label: current?.label ?? label,
        total: (current?.total ?? 0) + 1,
        mappedCount: (current?.mappedCount ?? 0) + 1,
        pendingGeocodeCount: 0,
        outsideJurisdictionCount: 0,
        matchKeys: [key],
        volume: (current?.volume ?? 0) + pointVolume,
      });
    });

    return (canonicalAddressFacets.length > 0 ? Array.from(canonical.values()) : Array.from(fallback.values()))
      .filter((facet) => !hasPrivacyContract || exactPrivacyMode || facet.total >= effectiveMinSampleSize)
      .sort((left, right) => (right.volume ?? right.total) - (left.volume ?? left.total) || left.label.localeCompare(right.label, 'es'))
      .slice(0, MAX_ADDRESS_CORRIDOR_FACETS);
  }, [addressCellFacetsSuppressed, canonicalAddressFacets, effectiveMinSampleSize, exactPrivacyMode, hasPrivacyContract, liveMapPoints]);
  const territorialRecordCounts = useMemo(() => {
    const summary = heatmap?.territorial_facets?.summary;
    const categoryTotal = mapCategoryFacets.reduce((total, facet) => total + facet.total, 0);
    return {
      total: Math.max(
        0,
        readNumber(summary?.ticket_records, heatmap?.location_quality?.total_ticket_records) ??
          (categoryTotal || liveMapPoints.length),
      ),
      mappedCount: Math.max(
        0,
        readNumber(summary?.mapped_records, heatmap?.location_quality?.ticket_records_with_coordinates) ??
          liveMapPoints.length,
      ),
      pendingGeocodeCount: Math.max(
        0,
        readNumber(summary?.pending_geocode_records, heatmap?.location_quality?.ticket_records_pending_geocode) ?? 0,
      ),
      outsideJurisdictionCount,
    };
  }, [heatmap?.location_quality, heatmap?.territorial_facets?.summary, liveMapPoints.length, mapCategoryFacets, outsideJurisdictionCount]);
  const categoryBreakdownProtected =
    categoryFacetsSuppressed ||
    (hasPrivacyContract && !exactPrivacyMode && hasNamedMapCategories && mapCategoryFacets.length === 0);
  const zoneBreakdownProtected =
    zoneFacetsSuppressed ||
    (hasPrivacyContract && !exactPrivacyMode && hasNamedMapZones && mapZoneFacets.length === 0);
  const addressCellBreakdownProtected =
    addressCellFacetsSuppressed ||
    (hasPrivacyContract && !exactPrivacyMode && hasNamedMapAddressCells && mapAddressCellFacets.length === 0);

  useEffect(() => {
    if (mapCategoryFilter && !mapCategoryFacets.some((facet) => facet.key === mapCategoryFilter)) {
      setMapCategoryFilter(null);
    }
  }, [mapCategoryFacets, mapCategoryFilter]);

  useEffect(() => {
    if (mapZoneFilter && !mapZoneFacets.some((facet) => facet.key === mapZoneFilter)) {
      setMapZoneFilter(null);
    }
  }, [mapZoneFacets, mapZoneFilter]);

  useEffect(() => {
    if (mapAddressCellFilter && !mapAddressCellFacets.some((facet) => facet.key === mapAddressCellFilter)) {
      setMapAddressCellFilter(null);
    }
  }, [mapAddressCellFacets, mapAddressCellFilter]);
  const liveMapProvider = mapConfig?.provider === 'google' ? 'google' : 'maplibre';
  const showLiveMap = liveMapPoints.length > 0 && !usesDemoData;
  const officialTerritoryZones = useMemo(() => resolveOfficialTerritoryZones(heatmap), [heatmap]);
  const territoryZones = usesDemoData ? DEVELOPMENT_TERRITORY_ZONES : officialTerritoryZones;

  const aggregate = useMemo(
    () =>
      aggregateTerritoryHeatmap({
        points: sourcePoints,
        zones: territoryZones,
        minSampleSize: effectiveMinSampleSize,
      }),
    [effectiveMinSampleSize, sourcePoints, territoryZones],
  );
  const hasTerritoryBoundaries = aggregate.hasBoundaries;

  const readiness = useMemo(
    () => resolveTerritoryMapReadiness(heatmap, sourcePoints.length),
    [heatmap, sourcePoints.length],
  );
  const dataProvenance = useMemo(
    () => resolveTerritoryDataProvenance(heatmap, usesDemoData, sourcePoints),
    [heatmap, sourcePoints, usesDemoData],
  );
  const executiveReadinessLabel =
    dataProvenance.state === 'real' || readiness.state !== 'ready'
      ? readiness.label
      : 'Cobertura técnica disponible';
  const executiveReadinessDetail =
    dataProvenance.state === 'real' || readiness.state !== 'ready'
      ? readinessCopy(readiness.state, labels)
      : 'La cobertura permite visualizar patrones, pero la procedencia debe validarse antes de tomar decisiones.';
  const displayLayers = useMemo(() => resolveTerritoryLayerDescriptors(heatmap), [heatmap]);
  const displayLayerKey = displayLayers.map((layer) => layer.id).join('|');
  const defaultEnabledLayerIds = useMemo(
    () =>
      displayLayers
        .filter((layer) => layer.tone !== 'neutral' || layer.source === 'backend')
        .slice(0, 6)
        .map((layer) => layer.id),
    [displayLayerKey, displayLayers],
  );
  const enabledLayerIds = layerSelection ?? defaultEnabledLayerIds;

  useEffect(() => {
    setLayerSelection(null);
  }, [displayLayerKey]);

  const selectedZone =
    aggregate.zones.find((metric) => metric.zone.id === selectedZoneId) ??
    aggregate.zones.find((metric) => metric.records > 0 && !metric.suppressed) ??
    aggregate.zones[0] ??
    NO_TERRITORY_ZONE_METRIC;

  const topZones = aggregate.zones
    .filter((metric) => metric.records > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 4);
  const animatedZones = topZones.slice(0, 3);

  const title = labelFor(labels, 'premium_heatmap_title', 'Inteligencia territorial');
  const description = labelFor(
    labels,
    'premium_heatmap_description',
    'Volumen, demanda y riesgo por zona con privacidad por muestra minima.',
  );
  const hasWarning = Boolean(mapConfig?.style_url_warning);
  const preferredVisualization = humanizeContractValue(
    readString(heatmap?.map_experience?.preferred_visualization),
    'Globo territorial interactivo',
  );
  const geocodingStatus = readString(heatmap?.geocoding?.status, heatmap?.geocoding?.reason_code);
  const geocodingCandidates = heatmap?.geocoding?.candidates?.slice(0, 3) ?? [];
  const qualityAction = summarizeBackendAction(heatmap?.quality?.empty_state_action);
  const geocodingAction = summarizeBackendAction(heatmap?.geocoding?.recommended_action);
  const activeAction = readiness.state === 'empty' || readiness.state === 'low' ? qualityAction ?? geocodingAction : geocodingAction;
  const realtimeSources = heatmap?.realtime?.sources ?? [];
  const realtimeEvents = heatmap?.realtime?.socket_events ?? [];
  const latestRealtime = readString(heatmap?.realtime?.latest_event_at);
  const realtimeFreshness = resolveRealtimeFreshness(latestRealtime, heatmap?.realtime?.poll_seconds);
  const executiveProvenanceLabel =
    dataProvenance.state === 'real' ? 'Datos territoriales verificados' : dataProvenance.label;
  const narrativeTitle = presentExecutiveText(
    readString(
      heatmap?.map_narrative?.headline,
      heatmap?.map_narrative?.title,
      readiness.state === 'empty' ? heatmap?.map_narrative?.empty_state_title : undefined,
    ),
  );
  const narrativeBody = presentExecutiveText(
    readString(
      heatmap?.map_narrative?.operator_summary,
      heatmap?.map_narrative?.body,
      heatmap?.map_narrative?.description,
      readiness.state === 'empty' ? heatmap?.map_narrative?.empty_state_description : undefined,
    ),
  );
  const operationalNarrativeTitle =
    dataProvenance.state === 'real'
      ? narrativeTitle || 'Mapa territorial para la acción'
      : dataProvenance.state === 'demo'
        ? 'Escenario territorial de demostración'
        : dataProvenance.state === 'synthetic'
          ? 'Mapa territorial con datos sintéticos'
          : dataProvenance.label === 'Procedencia parcial'
            ? 'Mapa territorial con validación parcial'
            : 'Mapa territorial pendiente de validación';
  const operationalNarrativeBody =
    dataProvenance.state === 'real' ? narrativeBody : dataProvenance.detail;
  const narrativeAction = summarizeBackendAction(heatmap?.map_narrative?.primary_cta);
  const viewportPresets = heatmap?.viewport_presets?.presets?.slice(0, 3) ?? [];
  const defaultViewportId = heatmap?.viewport_presets?.default_preset_id;
  const defaultViewport = viewportPresets.find((preset) => preset.id === defaultViewportId) ?? viewportPresets[0];
  const defaultViewportZoom = readNumber(defaultViewport?.zoom);
  const defaultViewportRadius = readNumber(defaultViewport?.radius_km);
  const defaultViewportDetail = defaultViewport
    ? [
        humanizeContractValue(readString(defaultViewport.mode), 'Vista territorial'),
        defaultViewportZoom !== undefined ? `zoom ${formatNumber(defaultViewportZoom)}` : undefined,
        defaultViewportRadius !== undefined ? `${formatNumber(defaultViewportRadius)} km` : undefined,
      ]
        .filter(Boolean)
        .join(' - ')
    : undefined;
  const aiStatus = heatmap?.ai_status;
  const aiStatusLabel = humanizeContractValue(readString(aiStatus?.status, heatmap?.ai_layers?.status), 'sin estado IA');
  const aiModeLabel = humanizeContractValue(readString(aiStatus?.mode, heatmap?.ai_layers?.mode), 'capas operativas');
  const aiHintLabels = (Array.isArray(aiStatus?.map_layer_hints) ? aiStatus.map_layer_hints : [])
    .map((hint) => humanizeContractValue(hint, 'Capa operativa'))
    .slice(0, 3);
  const mapLayers = asRecord(heatmap?.map_layers);
  const mapLayerHotspots = asRecord(mapLayers?.hotspots);
  const mapLayerFocus = asRecord(mapLayerHotspots?.focus);
  const mapLayerFocusRisk = asRecord(mapLayerFocus?.risk);
  const mapLayerIntensity = asRecord(mapLayers?.intensity);
  const mapLayerVisualSystem = asRecord(mapLayers?.visual_system);
  const mapLayerAnimations = asRecord(mapLayerVisualSystem?.animations);
  const mapLayerOperatorMetrics = asRecord(mapLayers?.operator_metrics);
  const heatmapSummary = asRecord(heatmap?.summary);
  const operationalHotspots = heatmap?.operational_hotspots?.slice(0, 4) ?? [];
  const topOperationalHotspot = operationalHotspots[0];
  const topOperationalSignals = asRecord(topOperationalHotspot?.signals);
  const operationalHotspotCount = readNumber(heatmapSummary?.operational_hotspots) ?? operationalHotspots.length;
  const backendTotalCases = readNumber(mapLayerOperatorMetrics?.total_cases, mapLayerIntensity?.total_cases);
  const backendVisibleLayers = readNumber(mapLayerOperatorMetrics?.visible_layers, mapLayerIntensity?.total_items);
  const backendCriticalHotspots = readNumber(mapLayerOperatorMetrics?.critical_hotspots, operationalHotspotCount);
  const backendTopCategory = readString(mapLayerOperatorMetrics?.top_category, mapLayerFocus?.category, topOperationalHotspot?.top_category);
  const backendFocusCount = readNumber(mapLayerFocus?.count);
  const backendFocusRiskLabel = humanizeContractValue(
    readString(mapLayerFocusRisk?.label, mapLayerFocusRisk?.level),
    'sin severidad',
  );
  const backendRenderer = humanizeContractValue(readString(mapLayerVisualSystem?.renderer), 'mapa operativo');
  const backendRadarEnabled = mapLayerAnimations?.radar_sweep === true;
  const hasBackendMapContract = Boolean(
    mapLayers?.contract_version || backendTopCategory || backendTotalCases !== undefined || backendVisibleLayers !== undefined,
  );
  const territoryScopeBadgeLabel = hasTerritoryBoundaries
    ? confidenceLabel(aggregate.confidence)
    : jurisdictionEnforced
      ? `Alcance configurado${jurisdictionCityLabel ? ` · ${jurisdictionCityLabel}` : ''}`
      : 'Sin límites oficiales';
  const hotspotActionSummaries = uniqueActionSummaries([
    ...(heatmap?.hotspot_actions?.actions ?? []),
    ...(heatmap?.hotspot_actions?.playbook ?? []),
    ...(heatmap?.hotspot_playbook ?? []),
    ...(heatmap?.operator_playbook ?? []),
  ]).slice(0, 4);
  const geocodingCandidateActions = geocodingCandidates.flatMap((candidate) => {
    const safeCandidateCorridor = safeStreetCorridor(candidate.address);
    const contextLabel = readString(
      safeCandidateCorridor ? streetCorridorLabel(safeCandidateCorridor) : undefined,
      candidate.label,
      candidate.category,
    );
    return (Array.isArray(candidate.actions) ? candidate.actions : []).map((action) => actionWithContext(action, contextLabel));
  });
  const pointActions = sourcePoints.flatMap((point) => {
    const contextLabel = readString(point.label, point.categoria, point.category, point.barrio, point.distrito);
    return (Array.isArray(point.actions) ? point.actions : []).map((action) => actionWithContext(action, contextLabel));
  });
  const cellActions = (heatmap?.cells ?? []).flatMap((cell) => {
    const contextLabel = readString(cell.label, cell.title, cell.key, cell.id);
    return (Array.isArray(cell.actions) ? cell.actions : []).map((action) => actionWithContext(action, contextLabel));
  });
  const operationalHotspotActions = operationalHotspots
    .map((hotspot) => actionWithContext(hotspot.recommended_action, readString(hotspot.top_category, hotspot.id)))
    .filter(Boolean);
  const operationalActionSummaries = uniqueActionSummaries([
    heatmap?.map_narrative?.primary_cta,
    ...operationalHotspotActions,
    ...(heatmap?.hotspot_actions?.actions ?? []),
    ...(heatmap?.hotspot_actions?.playbook ?? []),
    ...(heatmap?.hotspot_playbook ?? []),
    ...(heatmap?.operator_playbook ?? []),
    ...(heatmap?.geocoding?.guidance?.recommended_actions ?? []),
    heatmap?.geocoding?.recommended_action,
    ...(heatmap?.ai_layers?.recommendations ?? []),
    ...geocodingCandidateActions,
    ...pointActions,
    ...cellActions,
  ]).slice(0, 8);
  const hasOperationalBrief = Boolean(
    narrativeTitle ||
      narrativeBody ||
      narrativeAction ||
      viewportPresets.length ||
      operationalActionSummaries.length ||
      aiStatus ||
      heatmap?.ai_layers ||
      hasBackendMapContract,
  );
  const showHeatLayer = layerIsEnabled(enabledLayerIds, ['heat', 'hotspot', 'base']) || !displayLayers.length;
  const hasCategoryLayerControl = displayLayers.some((layer) =>
    ['category', 'categoria'].some((fragment) => layer.id.includes(fragment)),
  );
  const showCategoryLayer = hasCategoryLayerControl
    ? canShowExactPointMarkers && layerIsEnabled(enabledLayerIds, ['category', 'categoria'])
    : canShowExactPointMarkers && mapCategoryFacets.length > 0;
  const [mapDisplayMode, setMapDisplayMode] = useState<MapDisplayMode>(() =>
    showCategoryLayer && showHeatLayer ? 'hybrid' : showCategoryLayer ? 'clusters' : 'heat',
  );
  const temporarilyHiddenPointModeRef = useRef<Exclude<MapDisplayMode, 'heat'> | null>(null);

  useEffect(() => {
    if (!canShowExactPointMarkers) {
      temporarilyHiddenPointModeRef.current = null;
      if (mapDisplayMode !== 'heat') {
        setSelectedMapPoint(null);
        setMapDisplayMode('heat');
      }
      return;
    }

    if (mapDisplayMode === 'heat' && !showHeatLayer && showCategoryLayer) {
      const restoredMode = temporarilyHiddenPointModeRef.current ?? 'hybrid';
      temporarilyHiddenPointModeRef.current = null;
      setSelectedMapPoint(null);
      setMapDisplayMode(restoredMode);
      return;
    }

    if (mapDisplayMode === 'hybrid' && !showHeatLayer && showCategoryLayer) {
      temporarilyHiddenPointModeRef.current = 'hybrid';
      setSelectedMapPoint(null);
      setMapDisplayMode('clusters');
      return;
    }

    if (!showCategoryLayer) {
      if (mapDisplayMode !== 'heat' && showHeatLayer) {
        temporarilyHiddenPointModeRef.current = mapDisplayMode;
        setSelectedMapPoint(null);
        setMapDisplayMode('heat');
      }
      return;
    }

    if (temporarilyHiddenPointModeRef.current && showHeatLayer) {
      const restoredMode = temporarilyHiddenPointModeRef.current;
      temporarilyHiddenPointModeRef.current = null;
      setMapDisplayMode(restoredMode);
    }
  }, [canShowExactPointMarkers, mapDisplayMode, showCategoryLayer, showHeatLayer]);

  const showAiLayer = layerIsEnabled(enabledLayerIds, ['ai', 'risk', 'prior']);
  const showQualityLayer = layerIsEnabled(enabledLayerIds, ['quality', 'coverage', 'geo']);
  const showRealtimeLayer = layerIsEnabled(enabledLayerIds, ['realtime', 'live', 'whatsapp', 'socket']);
  const hasCommerceLayer = displayLayers.some((layer) => layer.tone === 'commerce');
  const showCommerceLayer = hasCommerceLayer && layerIsEnabled(enabledLayerIds, ['commerce', 'order', 'pedido', 'venta']);
  const selectedCategoryFacet = mapCategoryFacets.find((facet) => facet.key === mapCategoryFilter);
  const selectedZoneFacet = mapZoneFacets.find((facet) => facet.key === mapZoneFilter);
  const selectedAddressCellFacet = mapAddressCellFacets.find((facet) => facet.key === mapAddressCellFilter);
  const visibleLiveMapPoints = useMemo(
    () =>
      liveMapPoints.filter((point) => {
        if (!showCommerceLayer && readString(point.fuente) === 'commerce') return false;
        if (
          mapCategoryFilter &&
          !(
            selectedCategoryFacet?.matchKeys.includes(normalizedFacetValue(point.categoria)) ??
            normalizedFacetValue(point.categoria) === mapCategoryFilter
          )
        ) {
          return false;
        }
        if (
          mapZoneFilter &&
          !(
            selectedZoneFacet?.matchKeys.includes(
              normalizedFacetValue(point.barrio?.trim() || point.distrito?.trim()),
            ) ?? normalizedFacetValue(point.barrio?.trim() || point.distrito?.trim()) === mapZoneFilter
          )
        ) {
          return false;
        }
        if (
          mapAddressCellFilter &&
          point.addressCellKey !== mapAddressCellFilter &&
          point.addressCorridorKey !== mapAddressCellFilter
        ) {
          return false;
        }
        return true;
      }),
    [
      liveMapPoints,
      mapAddressCellFilter,
      mapCategoryFilter,
      mapZoneFilter,
      selectedCategoryFacet,
      selectedZoneFacet,
      showCommerceLayer,
    ],
  );
  const selectedTerritorialFacets = useMemo(
    () =>
      [selectedCategoryFacet, selectedZoneFacet, selectedAddressCellFacet].filter(
        (facet): facet is TerritoryMapFacet => Boolean(facet),
      ),
    [selectedAddressCellFacet, selectedCategoryFacet, selectedZoneFacet],
  );
  const hasCanonicalTerritorialSummary = Boolean(heatmap?.territorial_facets?.summary || heatmap?.location_quality);
  const scopedTerritoryView = useMemo<ScopedTerritoryView>(() => {
    if (selectedTerritorialFacets.length === 1) {
      const facet = selectedTerritorialFacets[0];
      return {
        mode: 'single',
        label: facet.label,
        visiblePointCount: visibleLiveMapPoints.length,
        total: facet.total,
        mappedCount: facet.mappedCount,
        pendingGeocodeCount: facet.pendingGeocodeCount,
        outsideJurisdictionCount: facet.outsideJurisdictionCount,
        coveragePercent: facet.total > 0 ? (facet.mappedCount / facet.total) * 100 : undefined,
        selectedFacet: facet,
        globalInsightsCompatible: false,
      };
    }
    if (selectedTerritorialFacets.length > 1) {
      return {
        mode: 'combined',
        label: 'Combinación de filtros',
        visiblePointCount: visibleLiveMapPoints.length,
        mappedCount: visibleLiveMapPoints.length,
        globalInsightsCompatible: false,
      };
    }
    const total = territorialRecordCounts.total;
    const mappedCount = territorialRecordCounts.mappedCount;
    return {
      mode: 'global',
      label: 'Vista general',
      visiblePointCount: visibleLiveMapPoints.length,
      total,
      mappedCount,
      pendingGeocodeCount: hasCanonicalTerritorialSummary ? territorialRecordCounts.pendingGeocodeCount : readiness.pendingGeocode,
      outsideJurisdictionCount: territorialRecordCounts.outsideJurisdictionCount,
      coveragePercent:
        hasCanonicalTerritorialSummary && total > 0 ? (mappedCount / total) * 100 : readiness.coveragePercent,
      globalInsightsCompatible: true,
    };
  }, [
    hasCanonicalTerritorialSummary,
    readiness.coveragePercent,
    readiness.pendingGeocode,
    selectedTerritorialFacets,
    territorialRecordCounts,
    visibleLiveMapPoints.length,
  ]);
  const activeZeroMappedFacet = [selectedCategoryFacet, selectedZoneFacet, selectedAddressCellFacet].find(
    (facet): facet is TerritoryMapFacet => Boolean(facet && facet.mappedCount === 0),
  );
  const hasActiveTerritorialFacet = Boolean(mapCategoryFilter || mapZoneFilter || mapAddressCellFilter);
  const filteredMapEmpty = hasActiveTerritorialFacet && visibleLiveMapPoints.length === 0;
  const renderHeatLayer = mapDisplayMode !== 'clusters' && showHeatLayer;
  const renderPointLayer = mapDisplayMode !== 'heat' && showCategoryLayer;
  const clusterDisplayMode = mapDisplayMode === 'clusters';
  const noBaseMapLayerAvailable = !showHeatLayer && !showCategoryLayer;
  const selectedDisplayModeUnavailable = mapDisplayMode === 'heat' ? !showHeatLayer : !showCategoryLayer;
  const mapDisplayStatus = noBaseMapLayerAvailable
    ? 'No hay una capa territorial activa. Activá Calor territorial o Capas por categoría para visualizar los registros.'
    : selectedDisplayModeUnavailable
      ? 'La visualización seleccionada está desactivada. Elegí uno de los modos disponibles.'
      : filteredMapEmpty
    ? 'La selección no tiene coordenadas mapeadas. No se agregan puntos estimados.'
    : mapDisplayMode === 'hybrid'
      ? `${formatCountLabel(visibleLiveMapPoints.length, 'ubicación mapeada visible', 'ubicaciones mapeadas visibles')}. El calor y los marcadores categorizados usan únicamente coordenadas persistidas válidas.`
      : mapDisplayMode === 'clusters'
        ? visibleLiveMapPoints.length > 1
          ? `${formatCountLabel(visibleLiveMapPoints.length, 'ubicación mapeada agrupada', 'ubicaciones mapeadas agrupadas')} por proximidad, sin alterar los filtros.`
          : 'Sólo hay una ubicación mapeada en esta selección; no se genera una agrupación artificial.'
        : `${formatCountLabel(visibleLiveMapPoints.length, 'ubicación mapeada', 'ubicaciones mapeadas')} alimentan la densidad territorial.`;
  const visiblePointCountProtected =
    hasPrivacyContract && !exactPrivacyMode && visibleLiveMapPoints.length < effectiveMinSampleSize;
  const liveHeatmapRadiusScale =
    visibleLiveMapPoints.length <= 2
      ? 2.8
      : visibleLiveMapPoints.length <= 5
        ? 2.35
        : visibleLiveMapPoints.length <= 12
          ? 1.9
          : 1.55;
  const liveMapBounds = useMemo(
    () => visibleLiveMapPoints.map((point) => [point.lng, point.lat] as [number, number]),
    [visibleLiveMapPoints],
  );
  const geoLayerConfig = useMemo(
    () =>
      buildOperationsGeoLayerConfig({
        heatmap,
        points: visibleLiveMapPoints,
        enabledLayerIds,
        mapStyleUrl: mapConfig?.style_url,
        showHeatLayer,
        showAiLayer,
        showQualityLayer,
        showRealtimeLayer,
        showCommerceLayer,
      }),
    [
      heatmap,
      visibleLiveMapPoints,
      enabledLayerIds,
      mapConfig?.style_url,
      showAiLayer,
      showHeatLayer,
      showQualityLayer,
      showRealtimeLayer,
      showCommerceLayer,
    ],
  );
  const visiblePointCount = scopedTerritoryView.visiblePointCount;
  const overallEventTotal = scopedTerritoryView.total ?? scopedTerritoryView.mappedCount;
  const scopedCoverageLabel = scopedTerritoryView.coveragePercent === undefined ? '—' : formatPercent(scopedTerritoryView.coveragePercent);
  const scopedPendingLabel =
    scopedTerritoryView.pendingGeocodeCount === undefined ? '—' : formatNumber(scopedTerritoryView.pendingGeocodeCount, '0');
  const scopedOutsideJurisdictionCount = scopedTerritoryView.outsideJurisdictionCount;
  const scopedVisiblePointLabel = visiblePointCountProtected ? '—' : formatNumber(visiblePointCount, '0');
  const scopedMetricsUnavailable = scopedTerritoryView.mode === 'combined';
  const scopedMetricsDetail = scopedMetricsUnavailable
    ? 'La intersección no tiene denominador canónico; sólo se muestran puntos mapeados.'
    : `${scopedCoverageLabel} de cobertura del alcance`;
  const decisionZone = selectedZone.records > 0 ? selectedZone : topZones[0] ?? selectedZone;
  const decisionAction = scopedTerritoryView.globalInsightsCompatible
    ? narrativeAction ?? operationalActionSummaries[0] ?? hotspotActionSummaries[0] ?? activeAction
    : undefined;
  const decisionActionLabel =
    decisionAction?.label ??
    (scopedTerritoryView.mode === 'single'
      ? (scopedTerritoryView.pendingGeocodeCount ?? 0) > 0
        ? `Revisar pendientes de ${scopedTerritoryView.label}`
        : `Revisar ${scopedTerritoryView.label}`
      : scopedTerritoryView.mode === 'combined'
        ? 'Revisar combinación filtrada'
      : readiness.pendingGeocode > 0
      ? 'Resolver ubicaciones pendientes'
      : readiness.state === 'ready'
        ? 'Monitorear territorio'
        : 'Completar datos territoriales');
  const decisionActionDetail =
    decisionAction?.detail ??
    (scopedTerritoryView.mode === 'single'
      ? `${formatCountLabel(scopedTerritoryView.mappedCount, 'registro mapeado', 'registros mapeados')} de ${formatNumber(scopedTerritoryView.total, '0')} en el segmento.`
      : scopedTerritoryView.mode === 'combined'
        ? scopedMetricsDetail
      : hasTerritoryBoundaries
      ? decisionZone.recommendation
      : 'La actividad puntual sigue disponible; las comparaciones por zona requieren límites oficiales.');
  const commandLoopHref =
    scopedTerritoryView.mode === 'single' && (scopedTerritoryView.pendingGeocodeCount ?? 0) > 0
      ? `/perfil?tab=tickets&focus=open_geocoding_queue&facet=${encodeURIComponent(scopedTerritoryView.selectedFacet?.key ?? '')}`
      : scopedTerritoryView.globalInsightsCompatible
        ? decisionAction?.href ?? operationalActionSummaries.find((action) => action.href)?.href
        : undefined;
  const commandPrimaryCategory = !scopedTerritoryView.globalInsightsCompatible
    ? scopedTerritoryView.label
    : backendTopCategory
    ? humanizeCategoryValue(backendTopCategory)
    : decisionZone.topCategories[0]?.label ??
      aggregate.topCategories[0]?.label ??
      (hasTerritoryBoundaries ? 'sin categoría dominante' : 'sin delimitación oficial');
  const commandRealtimeDetail = realtimeFreshness.detail;
  const [decisionCx, decisionCy] = territoryCentroid(decisionZone.zone.polygon);
  const [selectedCx, selectedCy] = territoryCentroid(selectedZone.zone.polygon);
  const decisionRadarRadius = Math.min(14, Math.max(7, 8 + decisionZone.intensity * 6));
  const telemetryRouteZones = topZones.length >= 2 ? topZones : aggregate.zones.slice(0, 4);
  const telemetryRoutes = telemetryRouteZones.slice(0, -1).map((metric, index) => {
    const nextMetric = telemetryRouteZones[index + 1];
    const [startX, startY] = territoryCentroid(metric.zone.polygon);
    const [endX, endY] = territoryCentroid(nextMetric.zone.polygon);
    const controlX = (startX + endX) / 2;
    const controlY = (startY + endY) / 2 + (index % 2 === 0 ? -5.5 : 4.5);
    const routeId = `${svgId}-telemetry-route-${metric.zone.id}-${nextMetric.zone.id}`.replace(/[^a-zA-Z0-9_-]/g, '-');
    return {
      id: routeId,
      d: `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`,
      delay: `${index * 0.9}s`,
      duration: `${5.4 + index * 0.8}s`,
      tone:
        index === 0
          ? 'rgba(34,211,238,0.9)'
          : index === 1
            ? 'rgba(168,85,247,0.82)'
            : 'rgba(245,158,11,0.86)',
    };
  });
  const hudBars = [
    { id: 'visible', label: 'visibles', value: visiblePointCount || 0, tone: 'rgba(34,211,238,0.86)' },
    ...(scopedTerritoryView.globalInsightsCompatible
      ? [{ id: 'hotspots', label: 'zonas', value: backendCriticalHotspots ?? aggregate.alerts ?? 0, tone: 'rgba(168,85,247,0.78)' }]
      : []),
    ...(scopedTerritoryView.pendingGeocodeCount === undefined
      ? []
      : [{ id: 'pend', label: 'pend.', value: scopedTerritoryView.pendingGeocodeCount, tone: 'rgba(245,158,11,0.86)' }]),
  ];
  const hudMax = Math.max(1, ...hudBars.map((bar) => bar.value));
  const executiveSummaryCards: Array<{ label: string; value: string; detail: string; icon: typeof Globe2; testId: string }> = [
    {
      label: 'Puntos visibles',
      value: scopedVisiblePointLabel,
      detail: visiblePointCountProtected ? `Muestra protegida · mínimo ${effectiveMinSampleSize}` : scopedMetricsDetail,
      icon: Eye,
      testId: 'territory-summary-visible',
    },
    {
      label: 'Pendientes',
      value: scopedPendingLabel,
      detail: scopedMetricsUnavailable
        ? 'No disponible para filtros combinados'
        : geocodingStatus
          ? humanizeContractValue(geocodingStatus, 'Estado no confirmado')
          : 'sin ubicaciones pendientes',
      icon: DatabaseZap,
      testId: 'territory-summary-pending',
    },
    {
      label: scopedTerritoryView.globalInsightsCompatible ? 'Foco territorial' : 'Segmento activo',
      value: commandPrimaryCategory,
      detail:
        scopedTerritoryView.mode === 'single'
          ? `${formatNumber(scopedTerritoryView.mappedCount)} de ${formatNumber(scopedTerritoryView.total)} mapeados`
          : scopedTerritoryView.mode === 'combined'
            ? 'Sin ranking global para esta intersección'
        : backendFocusCount !== undefined
          ? `${formatCountLabel(backendFocusCount, 'caso', 'casos')} - ${backendFocusRiskLabel}`
          : !hasTerritoryBoundaries
            ? 'sin ranking zonal'
            : decisionZone.suppressed
            ? 'muestra insuficiente'
             : decisionZone.zone.label,
      icon: Compass,
      testId: 'territory-summary-focus',
    },
    {
      label: 'Próxima acción',
      value: decisionActionLabel,
      detail: decisionActionDetail || 'sin acción automática pendiente',
      icon: ListChecks,
      testId: 'territory-summary-action',
    },
  ];
  const commandLoopCards: Array<{ label: string; value: string; detail: string; icon: typeof Globe2; testId: string }> = [
    {
      label: scopedTerritoryView.globalInsightsCompatible ? 'Foco crítico' : 'Alcance filtrado',
      value:
        scopedTerritoryView.mode === 'single'
          ? `${formatNumber(scopedTerritoryView.mappedCount)} de ${formatNumber(scopedTerritoryView.total)} mapeados`
          : scopedTerritoryView.mode === 'combined'
            ? formatCountLabel(visiblePointCount, 'punto mapeado', 'puntos mapeados')
        : backendCriticalHotspots !== undefined
          ? formatCountLabel(backendCriticalHotspots, 'zona crítica', 'zonas críticas')
          : formatCountLabel(aggregate.alerts, 'alerta', 'alertas'),
      detail: commandPrimaryCategory,
      icon: ShieldAlert,
      testId: 'territory-command-scope',
    },
    {
      label: 'Acción siguiente',
      value: decisionActionLabel,
      detail: decisionActionDetail || 'sin acción automática pendiente',
      icon: ListChecks,
      testId: 'territory-command-action',
    },
    {
      label: 'Cobertura territorial',
      value: scopedCoverageLabel,
      detail: visiblePointCountProtected
        ? `Muestra protegida · mínimo ${effectiveMinSampleSize}`
        : formatCountLabel(visiblePointCount, 'punto visible', 'puntos visibles'),
      icon: Gauge,
      testId: 'territory-command-coverage',
    },
    {
      label: 'Actualización',
      value: realtimeFreshness.label,
      detail: commandRealtimeDetail,
      icon: Activity,
      testId: 'territory-command-freshness',
    },
  ];
  const commandSignals = [
    {
      label: scopedTerritoryView.globalInsightsCompatible ? (backendTopCategory ? 'Motivo prioritario' : 'Zona foco') : 'Segmento activo',
      value: !scopedTerritoryView.globalInsightsCompatible
        ? scopedTerritoryView.label
        : backendTopCategory
        ? humanizeCategoryValue(backendTopCategory)
        : hasTerritoryBoundaries
          ? decisionZone.zone.label
          : 'Sin delimitación oficial',
      detail:
        scopedTerritoryView.mode === 'single'
          ? `${formatNumber(scopedTerritoryView.mappedCount)} de ${formatNumber(scopedTerritoryView.total)} mapeados`
          : scopedTerritoryView.mode === 'combined'
            ? 'Sin ranking global para filtros combinados'
        : backendFocusCount !== undefined
          ? `${formatCountLabel(backendFocusCount, 'caso', 'casos')} - ${backendFocusRiskLabel}`
          : !hasTerritoryBoundaries
            ? `${formatCountLabel(visiblePointCount, 'punto', 'puntos')} · ${dataProvenance.shortLabel} · sin agregación zonal`
            : decisionZone.suppressed
            ? 'muestra insuficiente'
          : formatCountLabel(decisionZone.total, 'evento', 'eventos'),
      icon: MapPin,
      testId: 'territory-radar-scope',
    },
    {
      label: 'Cobertura',
      value: scopedCoverageLabel,
      detail: scopedMetricsUnavailable ? 'No disponible para filtros combinados' : executiveReadinessLabel,
      icon: Gauge,
      testId: 'territory-radar-coverage',
    },
    {
      label: 'Capas activas',
      value:
        backendVisibleLayers !== undefined
          ? formatNumber(backendVisibleLayers)
          : `${formatNumber(enabledLayerIds.length)}/${formatNumber(displayLayers.length || enabledLayerIds.length)}`,
      detail: hasBackendMapContract ? backendRenderer : aiModeLabel,
      icon: Layers,
      testId: 'territory-radar-layers',
    },
    {
      label: 'Datos pendientes',
      value: scopedPendingLabel,
      detail: scopedMetricsUnavailable
        ? 'No disponible para filtros combinados'
        : geocodingStatus
          ? humanizeContractValue(geocodingStatus, 'Estado no confirmado')
          : 'sin cola visible',
      icon: DatabaseZap,
      testId: 'territory-radar-pending',
    },
  ];
  const focusModes: Array<{ id: MapFocusMode; label: string; icon: typeof Globe2 }> = [
    { id: 'territory', label: labelFor(labels, 'premium_map_mode_territory', 'Territorio'), icon: Globe2 },
    { id: 'quality', label: labelFor(labels, 'premium_map_mode_quality', 'Calidad'), icon: Gauge },
    { id: 'telemetry', label: labelFor(labels, 'premium_map_mode_telemetry', 'Actualización'), icon: Activity },
  ];
  const resetTerritoryFilters = () => {
    setMapCategoryFilter(null);
    setMapZoneFilter(null);
    setMapAddressCellFilter(null);
    setSelectedMapPoint(null);
  };
  const clearMostSpecificTerritoryFilter = () => {
    setSelectedMapPoint(null);
    if (mapAddressCellFilter) {
      setMapAddressCellFilter(null);
      return;
    }
    if (mapZoneFilter) {
      setMapZoneFilter(null);
      return;
    }
    setMapCategoryFilter(null);
  };

  return (
    <section className={cn('flex flex-col gap-4', className)} style={{ containerType: 'inline-size' }}>
      <style>{`@container (min-width: 1080px) { [data-territory-map-layout="${svgId}"] { grid-template-columns: minmax(0, 1fr) minmax(260px, 28%); } }`}</style>
      <div className="order-1 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Layers className="h-3.5 w-3.5" />
              {executiveProvenanceLabel}
            </Badge>
            <Badge variant="outline" className="gap-1 capitalize">
              <Globe2 className="h-3.5 w-3.5" />
              {preferredVisualization}
            </Badge>
            <Badge variant={badgeVariantForReadiness(readiness.state)} className="gap-1">
              {readiness.state === 'ready' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
              {executiveReadinessLabel}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              mínimo {effectiveMinSampleSize}
            </Badge>
            {heatmap?.privacy?.mode ? (
              <Badge variant="outline" className="gap-1 capitalize">
                <ShieldCheck className="h-3.5 w-3.5" />
                {privacyModeLabel(heatmap.privacy.mode)}
              </Badge>
            ) : null}
            {jurisdictionEnforced && jurisdictionLabel ? (
              <Badge data-testid="territory-jurisdiction" variant="outline" className="gap-1">
                <MapPin className="h-3.5 w-3.5" />
                Alcance · {jurisdictionLabel}
              </Badge>
            ) : null}
            {scopedOutsideJurisdictionCount !== undefined && scopedOutsideJurisdictionCount > 0 ? (
              <Badge
                data-testid="territory-outside-jurisdiction"
                variant="outline"
                className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                aria-label={`${formatCountLabel(scopedOutsideJurisdictionCount, 'coordenada', 'coordenadas')} fuera de jurisdicción, excluidas del mapa y pendientes de revisión`}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Fuera de jurisdicción / revisar · {formatNumber(scopedOutsideJurisdictionCount)}
              </Badge>
            ) : null}
            {hasWarning ? (
              <Badge variant="outline" className="gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                Vista alternativa activa
              </Badge>
            ) : null}
          </div>
          <div>
            <h3 className="text-xl font-semibold tracking-normal text-foreground">{title}</h3>
            <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-right sm:min-w-[430px] sm:grid-cols-4">
          <div className="rounded-lg border border-border/70 bg-background/70 p-3">
            <p className="text-xs text-muted-foreground">
              {scopedTerritoryView.mode === 'single'
                ? 'Registros del segmento'
                : scopedTerritoryView.mode === 'combined'
                  ? 'Puntos mapeados'
                  : 'Registros territoriales'}
            </p>
            <p data-testid="territory-header-volume" className="text-lg font-semibold">
              {formatNumber(overallEventTotal)}
            </p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/70 p-3">
            <p className="text-xs text-muted-foreground">Cobertura</p>
            <p data-testid="territory-header-coverage" className="text-lg font-semibold">
              {scopedCoverageLabel}
            </p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/70 p-3">
            <p className="text-xs text-muted-foreground">Ubicaciones pendientes</p>
            <p data-testid="territory-header-pending" className="text-lg font-semibold">
              {scopedPendingLabel}
            </p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/70 p-3">
            <p className="text-xs text-muted-foreground">Frecuencia configurada</p>
            <p className="text-lg font-semibold">{heatmap?.realtime?.poll_seconds ? `${formatNumber(heatmap.realtime.poll_seconds)}s` : '--'}</p>
          </div>
        </div>
      </div>

      {activeFilters.length ? (
        <div className="order-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Segmentos activos:</span>
          {activeFilters.map((filter) => (
            <Button
              key={`${filter.key}-${filter.value}`}
              type="button"
              size="sm"
              variant="outline"
              className="h-7 gap-1 px-2 text-xs"
              onClick={filter.onClear}
            >
              <span>{filter.label}</span>
              <span className="font-semibold text-foreground">{filter.value}</span>
            </Button>
          ))}
        </div>
      ) : null}

      <div
        data-testid="territory-executive-strip"
        className="order-5 overflow-hidden rounded-xl border border-border/70 bg-background/80 shadow-sm"
      >
        <div className="flex flex-col gap-2 border-b border-border/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Radar className="h-3.5 w-3.5" />
                Lectura ejecutiva
              </Badge>
              <Badge variant="outline" className="capitalize">
                {executiveReadinessLabel}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Resumen operativo para leer demanda, calidad de datos y acción siguiente sin abrir paneles internos.
            </p>
          </div>
          <Badge variant="outline" className="w-fit gap-1">
            <Activity className="h-3.5 w-3.5" />
            {territoryScopeBadgeLabel}
          </Badge>
        </div>
        <div className="grid divide-y divide-border/70 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
          {executiveSummaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} data-testid={card.testId} className="min-w-0 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="truncate">{card.label}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-lg font-semibold leading-snug">{card.value}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{card.detail}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div
        data-testid="territory-command-loop"
        className="order-7 overflow-hidden rounded-xl border border-primary/15 bg-[linear-gradient(135deg,hsl(var(--background)),rgba(59,130,246,0.08),rgba(20,184,166,0.08))] shadow-sm"
      >
        <div className="flex flex-col gap-4 border-b border-border/70 p-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Radar className="h-3.5 w-3.5" />
                Ciclo de decisión asistido
              </Badge>
              <Badge variant={readiness.state === 'ready' ? 'outline' : 'secondary'} className="capitalize">
                {executiveReadinessLabel}
              </Badge>
            </div>
            <h4 className="mt-2 text-lg font-semibold leading-tight">Pulso operativo territorial</h4>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              Priorización territorial para convertir reclamos, encuestas y WhatsApp en una cola de trabajo clara para el equipo.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Activity className="h-3.5 w-3.5" />
              {realtimeFreshness.isFresh ? 'actualización reciente' : 'conectividad no verificada'}
            </Badge>
            {commandLoopHref ? (
              <a
                href={commandLoopHref}
                className="inline-flex min-h-9 items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                Abrir cola CRM
              </a>
            ) : null}
          </div>
        </div>
        <div className="grid gap-0 divide-y divide-border/70 md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-4">
          {commandLoopCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                data-testid="territory-command-card"
                data-metric={card.testId}
                className="min-w-0 p-4"
              >
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
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

      <div
        data-testid="territory-decision-radar"
        className="order-8 overflow-hidden rounded-xl border border-border/70 bg-[linear-gradient(135deg,rgba(15,23,42,0.04),hsl(var(--background)),rgba(20,184,166,0.06))] shadow-sm"
      >
        <div className="grid gap-0 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)]">
          <div className="border-b border-border/70 p-4 lg:border-b-0 lg:border-r">
            <div className="flex items-start gap-3">
              <span className="relative mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                <Radar className="h-5 w-5" />
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-teal-400 shadow-[0_0_0_4px_rgba(45,212,191,0.18)]" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Radar de decisión</p>
                <h4 className="mt-1 text-base font-semibold leading-snug">{decisionActionLabel}</h4>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{decisionActionDetail}</p>
              </div>
            </div>
          </div>
          <div className="grid min-w-0 grid-cols-2 divide-x divide-y divide-border/60 sm:grid-cols-4 sm:divide-y-0">
            {commandSignals.map((signal) => {
              const Icon = signal.icon;
              return (
                <div key={signal.label} data-testid={signal.testId} className="min-w-0 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="truncate">{signal.label}</span>
                  </div>
                  <p className="mt-2 truncate text-lg font-semibold">{signal.value}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{signal.detail}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="order-2 flex flex-col gap-3 rounded-lg border border-border/70 bg-muted/20 p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Modo de lectura del mapa">
          {focusModes.map((mode) => {
            const Icon = mode.icon;
            const active = focusMode === mode.id;
            return (
              <Button
                key={mode.id}
                type="button"
                size="sm"
                variant={active ? 'default' : 'outline'}
                onClick={() => setFocusMode(mode.id)}
                aria-pressed={active}
              >
                <Icon className="h-4 w-4" />
                {mode.label}
              </Button>
            );
          })}
        </div>
        <div className="flex min-w-0 flex-col items-start gap-1 lg:items-end">
          <div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
            <div
              data-testid="territory-display-mode-control"
              className="flex min-w-0 flex-wrap items-center gap-1 rounded-lg border bg-background p-1"
              role="radiogroup"
              aria-label="Visualización del mapa"
            >
              {([
                { id: 'hybrid', label: 'Mapa operativo' },
                { id: 'clusters', label: 'Clústeres' },
                { id: 'heat', label: 'Solo calor' },
              ] as Array<{ id: MapDisplayMode; label: string }>).map((mode) => (
                <Button
                  key={mode.id}
                  type="button"
                  role="radio"
                  size="sm"
                  variant={mapDisplayMode === mode.id ? 'default' : 'ghost'}
                  className="h-8 px-3"
                  onClick={() => {
                    temporarilyHiddenPointModeRef.current = null;
                    setSelectedMapPoint(null);
                    setMapDisplayMode(mode.id);
                  }}
                  aria-checked={mapDisplayMode === mode.id}
                  aria-pressed={mapDisplayMode === mode.id}
                  disabled={
                    mode.id === 'heat'
                      ? !showHeatLayer
                      : !canShowExactPointMarkers || !showCategoryLayer
                  }
                  title={
                    mode.id === 'heat' && !showHeatLayer
                      ? 'La capa Calor territorial está desactivada'
                      : mode.id !== 'heat' && !canShowExactPointMarkers
                      ? 'La política territorial protege el detalle puntual'
                      : mode.id !== 'heat' && !showCategoryLayer
                        ? 'La capa por categoría está desactivada'
                        : undefined
                  }
                >
                  {mode.label}
                </Button>
              ))}
            </div>
            <TerritorialMapAccessibleSheet
              points={visibleLiveMapPoints}
              canShowExactPointMarkers={canShowExactPointMarkers}
              tenantSlug={tenantSlug}
              summaries={[
                { id: 'coverage', label: 'Cobertura', value: scopedCoverageLabel },
                { id: 'mapped', label: 'Puntos mapeados', value: scopedVisiblePointLabel },
                { id: 'pending', label: 'Pendientes de geocodificar', value: scopedPendingLabel },
                { id: 'scope', label: 'Alcance', value: scopedTerritoryView.label },
              ]}
            />
          </div>
          <p
            data-testid="territory-display-mode-status"
            className="max-w-2xl text-xs leading-5 text-muted-foreground lg:text-right"
            role="status"
            aria-live="polite"
          >
            {mapDisplayStatus}
            {(scopedTerritoryView.pendingGeocodeCount ?? 0) > 0
              ? ` ${formatCountLabel(scopedTerritoryView.pendingGeocodeCount ?? 0, 'registro permanece pendiente de geocodificar', 'registros permanecen pendientes de geocodificar')}.`
              : ''}
          </p>
        </div>
      </div>

      <div
        data-testid="territory-filter-toolbar"
        className="order-3 sticky top-20 z-30 rounded-xl border border-border/70 bg-background/95 p-4 shadow-md backdrop-blur"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 shrink-0 text-primary" />
              <h4 className="text-sm font-semibold">Explorar demanda territorial</h4>
              {hasActiveTerritorialFacet ? (
                <Badge variant="secondary" className="shrink-0">
                  {[mapCategoryFilter, mapZoneFilter, mapAddressCellFilter].filter(Boolean).length} activos
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Elegí una categoría, zona o corredor. El mapa y todos los indicadores responden a la misma selección.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-fit shrink-0 gap-2"
            onClick={resetTerritoryFilters}
            disabled={!hasActiveTerritorialFacet}
            aria-label="Limpiar filtros territoriales"
          >
            <RotateCcw className="h-4 w-4" />
            Restablecer mapa
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3">
          <label htmlFor={`${svgId}-category-filter`} className="min-w-0 rounded-lg border bg-muted/15 p-3">
            <span className="text-xs font-semibold text-foreground">Categoría de reclamo</span>
            <select
              id={`${svgId}-category-filter`}
              aria-label="Filtrar mapa por categoría"
              className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
              value={mapCategoryFilter ?? ''}
              onChange={(event) => {
                setSelectedMapPoint(null);
                setMapCategoryFilter(event.target.value || null);
              }}
              disabled={!mapCategoryFacets.length}
            >
              <option value="">Todas las categorías</option>
              {mapCategoryFacets.map((facet) => (
                <option key={facet.key} value={facet.key}>
                  {facet.label} · Total {formatNumber(facet.total)} · Mapeados {formatNumber(facet.mappedCount)} · Pendientes{' '}
                  {formatNumber(facet.pendingGeocodeCount)} · Revisar {formatNumber(facet.outsideJurisdictionCount)}
                </option>
              ))}
            </select>
            <span className="mt-2 block min-h-5 text-[11px] leading-5 text-muted-foreground">
              {mapCategoryFacets.length ? (
                <TerritoryFacetCounts facet={selectedCategoryFacet ?? territorialRecordCounts} />
              ) : categoryBreakdownProtected ? (
                `Segmentación protegida · mínimo ${effectiveMinSampleSize} registros`
              ) : (
                'Sin categorías verificadas'
              )}
            </span>
          </label>

          <label htmlFor={`${svgId}-zone-filter`} className="min-w-0 rounded-lg border bg-muted/15 p-3">
            <span className="text-xs font-semibold text-foreground">Zona o barrio</span>
            <select
              id={`${svgId}-zone-filter`}
              aria-label="Filtrar mapa por zona o barrio"
              className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
              value={mapZoneFilter ?? ''}
              onChange={(event) => {
                setSelectedMapPoint(null);
                setMapZoneFilter(event.target.value || null);
              }}
              disabled={!mapZoneFacets.length}
            >
              <option value="">{mapZoneFacets.length ? 'Todas las zonas' : 'Sin zonas verificadas'}</option>
              {mapZoneFacets.map((facet) => (
                <option key={facet.key} value={facet.key}>
                  {facet.label} · Total {formatNumber(facet.total)} · Mapeados {formatNumber(facet.mappedCount)} · Pendientes{' '}
                  {formatNumber(facet.pendingGeocodeCount)} · Revisar {formatNumber(facet.outsideJurisdictionCount)}
                </option>
              ))}
            </select>
            <span className="mt-2 block min-h-5 text-[11px] leading-5 text-muted-foreground">
              {selectedZoneFacet ? (
                <TerritoryFacetCounts facet={selectedZoneFacet} />
              ) : zoneBreakdownProtected ? (
                `Segmentación protegida · mínimo ${effectiveMinSampleSize} registros`
              ) : mapZoneFacets.length ? (
                `${formatNumber(mapZoneFacets.length)} zonas disponibles`
              ) : (
                `${formatCountLabel(readiness.pendingGeocode, 'ubicación pendiente', 'ubicaciones pendientes')} de validación`
              )}
            </span>
          </label>

          <label htmlFor={`${svgId}-location-filter`} className="min-w-0 rounded-lg border bg-muted/15 p-3">
            <span className="flex items-center justify-between gap-2 text-xs font-semibold text-foreground">
              Corredor o celda
              <span className="font-normal text-muted-foreground">Sin domicilio exacto</span>
            </span>
            <select
              id={`${svgId}-location-filter`}
              aria-label="Filtrar mapa por corredor o celda"
              className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
              value={mapAddressCellFilter ?? ''}
              onChange={(event) => {
                setSelectedMapPoint(null);
                setMapAddressCellFilter(event.target.value || null);
              }}
              disabled={!mapAddressCellFacets.length}
            >
              <option value="">Todas las ubicaciones</option>
              {mapAddressCellFacets.map((facet) => (
                <option key={facet.key} value={facet.key}>
                  {facet.label} · Total {formatNumber(facet.total)} · Mapeados {formatNumber(facet.mappedCount)} · Pendientes{' '}
                  {formatNumber(facet.pendingGeocodeCount)} · Revisar {formatNumber(facet.outsideJurisdictionCount)}
                </option>
              ))}
            </select>
            <span className="mt-2 block min-h-5 text-[11px] leading-5 text-muted-foreground">
              {selectedAddressCellFacet ? (
                <TerritoryFacetCounts facet={selectedAddressCellFacet} />
              ) : addressCellBreakdownProtected ? (
                `Segmentación protegida · mínimo ${effectiveMinSampleSize} registros`
              ) : mapAddressCellFacets.length ? (
                `${formatNumber(mapAddressCellFacets.length)} agrupaciones seguras disponibles`
              ) : (
                'Sin corredores ni celdas verificadas'
              )}
            </span>
          </label>
        </div>

        {hasActiveTerritorialFacet ? (
          <div data-testid="territory-active-filter-chips" className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Aplicados</span>
            {selectedCategoryFacet ? (
              <Button type="button" size="sm" variant="secondary" className="h-7 gap-1 px-2 text-xs" onClick={() => {
                setSelectedMapPoint(null);
                setMapCategoryFilter(null);
              }}>
                Categoría · {selectedCategoryFacet.label} ×
              </Button>
            ) : null}
            {selectedZoneFacet ? (
              <Button type="button" size="sm" variant="secondary" className="h-7 gap-1 px-2 text-xs" onClick={() => {
                setSelectedMapPoint(null);
                setMapZoneFilter(null);
              }}>
                Zona · {selectedZoneFacet.label} ×
              </Button>
            ) : null}
            {selectedAddressCellFacet ? (
              <Button type="button" size="sm" variant="secondary" className="h-7 gap-1 px-2 text-xs" onClick={() => {
                setSelectedMapPoint(null);
                setMapAddressCellFilter(null);
              }}>
                Corredor · {selectedAddressCellFacet.label} ×
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div
        data-testid="territory-map-layout"
        data-territory-map-layout={svgId}
        className="order-4 grid min-w-0 grid-cols-1 items-start gap-4"
      >
        <div
          data-testid="territory-map-shell"
          className="relative self-start overflow-hidden rounded-xl border border-border bg-[radial-gradient(circle_at_20%_16%,rgba(59,130,246,0.16),transparent_28%),radial-gradient(circle_at_76%_24%,rgba(20,184,166,0.14),transparent_30%),linear-gradient(145deg,hsl(var(--background)),rgba(15,23,42,0.055))] shadow-[0_24px_80px_rgba(15,23,42,0.16)]"
          style={{ perspective: '1200px' }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(59,130,246,0.18),transparent_30%),radial-gradient(circle_at_78%_30%,rgba(20,184,166,0.16),transparent_34%),radial-gradient(circle_at_48%_86%,rgba(245,158,11,0.12),transparent_36%),linear-gradient(135deg,rgba(15,23,42,0.06),rgba(15,23,42,0))]" />
          <div className="absolute inset-x-8 top-6 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent opacity-70 dark:via-white/20" />
          <div className="absolute -bottom-16 left-1/2 h-36 w-[72%] -translate-x-1/2 rounded-[999px] bg-slate-950/10 blur-3xl dark:bg-black/35" />
          <p id={mapInstructionsId} className="sr-only">
            El mapa es una visualización. Para recorrer los puntos con teclado o lector de pantalla,
            usá el botón Ver puntos en lista.
          </p>
          {showLiveMap ? (
            <div data-testid="live-territory-map" className="relative z-10 h-[520px] w-full overflow-hidden sm:h-[620px] 2xl:h-[680px]">
              <LazyMapLibreMap
                className="h-full min-h-0 w-full rounded-none border-0"
                ariaLabel="Mapa territorial interactivo de reclamos, encuestas y actividad agregada"
                ariaDescribedBy={mapInstructionsId}
                tenantSlug={tenantSlug}
                heatmapData={visibleLiveMapPoints}
                showHeatmap={renderHeatLayer}
                showPoints={renderPointLayer}
                showPointLabels={clusterDisplayMode}
                pointLabelMode="count"
                pointMinZoom={7}
                pointLabelMinZoom={clusterDisplayMode ? 7 : 10}
                heatmapRadiusScale={liveHeatmapRadiusScale}
                // En privacidad agregada conservamos la densidad, pero evitamos que la
                // paleta Faro agregue un halo/ancla sobre cada coordenada persistida.
                heatmapPalette={canShowExactPointMarkers ? 'faro' : 'default'}
                adaptiveZoomMode={false}
                onFeatureSelect={setSelectedMapPoint}
                popupContext="territory"
                provider={liveMapProvider}
                mapStyleUrl={mapConfig?.style_url}
                maptilerKey={mapConfig?.maptiler_key}
                googleMapsKey={mapConfig?.google_maps_key}
                geoLayerConfig={geoLayerConfig}
                fitToBounds={liveMapBounds}
                fitBoundsRequestKey={`${mapCategoryFilter ?? 'all'}:${mapZoneFilter ?? 'all'}:${mapAddressCellFilter ?? 'all'}`}
                boundsPadding={{ top: 40, right: 40, bottom: 40, left: 40 }}
                disableClientClustering={!clusterDisplayMode}
                showEvidenceBadge={false}
              />
            </div>
          ) : hasTerritoryBoundaries ? (
          <svg
            role="img"
            aria-label={title}
            viewBox="0 0 100 68"
              className="relative z-10 h-[520px] w-full touch-pan-y select-none sm:h-[620px] 2xl:h-[680px]"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <radialGradient id={`${svgId}-territory-hotspot`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(96, 165, 250, 0.75)" />
                <stop offset="48%" stopColor="rgba(45, 212, 191, 0.22)" />
                <stop offset="100%" stopColor="rgba(45, 212, 191, 0)" />
              </radialGradient>
              <linearGradient id={`${svgId}-surface-shine`} x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(255,255,255,0.72)" />
                <stop offset="42%" stopColor="rgba(255,255,255,0.08)" />
                <stop offset="100%" stopColor="rgba(15,23,42,0.02)" />
              </linearGradient>
              <linearGradient id={`${svgId}-scan`} x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                <stop offset="48%" stopColor="rgba(255,255,255,0.42)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </linearGradient>
              <radialGradient id={`${svgId}-radar-wedge`} cx="0%" cy="0%" r="100%">
                <stop offset="0%" stopColor="rgba(34,211,238,0.5)" />
                <stop offset="46%" stopColor="rgba(59,130,246,0.2)" />
                <stop offset="100%" stopColor="rgba(34,211,238,0)" />
              </radialGradient>
              <linearGradient id={`${svgId}-telemetry-line`} x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="rgba(34,211,238,0.06)" />
                <stop offset="52%" stopColor="rgba(255,255,255,0.62)" />
                <stop offset="100%" stopColor="rgba(168,85,247,0.12)" />
              </linearGradient>
              <filter id={`${svgId}-zone-shadow`} x="-20%" y="-20%" width="140%" height="150%">
                <feDropShadow dx="0" dy="1.2" stdDeviation="1.2" floodColor="rgba(15,23,42,0.32)" />
              </filter>
              <filter id={`${svgId}-selected-glow`} x="-35%" y="-35%" width="170%" height="170%">
                <feDropShadow dx="0" dy="0" stdDeviation="1.8" floodColor="rgba(255,255,255,0.7)" />
                <feDropShadow dx="0" dy="1.6" stdDeviation="1.6" floodColor="rgba(15,23,42,0.28)" />
              </filter>
              <pattern id={`${svgId}-territory-grid`} width="6" height="6" patternUnits="userSpaceOnUse">
                <path d="M 6 0 L 0 0 0 6" fill="none" stroke="rgba(148, 163, 184, 0.16)" strokeWidth="0.18" />
              </pattern>
              <clipPath id={`${svgId}-globe-clip`}>
                <ellipse cx="50" cy="34" rx="43" ry="30" />
              </clipPath>
              <radialGradient id={`${svgId}-globe-base`} cx="42%" cy="24%" r="70%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.72)" />
                <stop offset="34%" stopColor="rgba(125,211,252,0.18)" />
                <stop offset="70%" stopColor="rgba(15,23,42,0.06)" />
                <stop offset="100%" stopColor="rgba(15,23,42,0.18)" />
              </radialGradient>
            </defs>
            <rect width="100" height="68" fill={`url(#${svgId}-territory-grid)`} />
            <ellipse cx="50" cy="35" rx="44" ry="30.5" fill={`url(#${svgId}-globe-base)`} stroke="rgba(255,255,255,0.48)" strokeWidth="0.28" />
            <g opacity="0.32" clipPath={`url(#${svgId}-globe-clip)`}>
              {[20, 35, 50, 65, 80].map((x) => (
                <path
                  key={`meridian-${x}`}
                  d={`M${x} 6 C${x - 8} 22 ${x - 8} 46 ${x} 65`}
                  fill="none"
                  stroke="rgba(255,255,255,0.32)"
                  strokeWidth="0.16"
                />
              ))}
              {[14, 24, 34, 44, 54].map((y) => (
                <ellipse
                  key={`parallel-${y}`}
                  cx="50"
                  cy={y}
                  rx={42 - Math.abs(34 - y) * 0.42}
                  ry="2.35"
                  fill="none"
                  stroke="rgba(59,130,246,0.2)"
                  strokeWidth="0.16"
                />
              ))}
            </g>
            <path
              d="M8 59 C24 52 34 58 50 51 C66 44 72 50 94 41"
              fill="none"
              stroke="rgba(255,255,255,0.38)"
              strokeWidth="0.28"
              strokeDasharray="1.4 2.2"
            />
            <path
              d="M6 15 C23 22 38 13 51 21 C65 30 77 20 95 28"
              fill="none"
              stroke="rgba(20,184,166,0.22)"
              strokeWidth="0.24"
              strokeDasharray="1 2"
            />
            <g data-testid="territory-hud-overlay" aria-hidden="true" opacity="0.94">
              <rect x="5.5" y="6" width="27.5" height="13.6" rx="2.2" fill="rgba(15,23,42,0.58)" stroke="rgba(148,163,184,0.36)" strokeWidth="0.18" />
              <text x="8" y="10.2" className="fill-white text-[2.05px] font-semibold tracking-[0.18em]">
                MAPA OPERATIVO
              </text>
              <text x="8" y="13.7" className="fill-cyan-100 text-[1.85px] font-medium">
                {preferredVisualization.slice(0, 27)}
              </text>
              <text x="8" y="17" className="fill-slate-200 text-[1.75px]">
                foco: {(scopedTerritoryView.globalInsightsCompatible ? decisionZone.zone.label : scopedTerritoryView.label).slice(0, 20)}
              </text>
              {hudBars.map((bar, index) => {
                const y = 22.8 + index * 2.9;
                const width = 4 + (bar.value / hudMax) * 16;
                return (
                  <g key={bar.id}>
                    <text x="7" y={y + 0.7} className="fill-slate-200 text-[1.45px] uppercase">
                      {bar.label}
                    </text>
                    <rect x="15.8" y={y - 0.85} width="17.6" height="1.25" rx="0.62" fill="rgba(148,163,184,0.2)" />
                    <rect x="15.8" y={y - 0.85} width={width} height="1.25" rx="0.62" fill={bar.tone}>
                      {!shouldReduceMotion ? (
                        <animate attributeName="opacity" values="0.72;1;0.72" dur={`${3.4 + index * 0.45}s`} repeatCount="indefinite" />
                      ) : null}
                    </rect>
                  </g>
                );
              })}
            </g>
            {scopedTerritoryView.globalInsightsCompatible ? (
              <g data-testid="territory-radar-sweep" aria-hidden="true" transform={`translate(${decisionCx} ${decisionCy})`} opacity="0.78">
                <circle r={decisionRadarRadius} fill="none" stroke="rgba(34,211,238,0.28)" strokeWidth="0.24" strokeDasharray="1.4 1.6" />
                <circle r={decisionRadarRadius * 0.58} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.18" />
                <path
                  d={`M 0 0 L ${decisionRadarRadius} 0 A ${decisionRadarRadius} ${decisionRadarRadius} 0 0 1 ${decisionRadarRadius * 0.42} ${decisionRadarRadius * 0.91} Z`}
                  fill={`url(#${svgId}-radar-wedge)`}
                >
                  {!shouldReduceMotion ? (
                    <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="9s" repeatCount="indefinite" />
                  ) : null}
                </path>
                <line x1={-decisionRadarRadius} x2={decisionRadarRadius} y1="0" y2="0" stroke="rgba(255,255,255,0.22)" strokeWidth="0.12" />
                <line x1="0" x2="0" y1={-decisionRadarRadius} y2={decisionRadarRadius} stroke="rgba(255,255,255,0.22)" strokeWidth="0.12" />
              </g>
            ) : null}
            <g data-testid="territory-comet-network" aria-hidden="true" opacity={showRealtimeLayer || focusMode === 'telemetry' ? 0.82 : 0.5}>
              {telemetryRoutes.map((route, index) => (
                <g key={route.id} data-testid="territory-comet-route">
                  <path id={route.id} d={route.d} fill="none" stroke={`url(#${svgId}-telemetry-line)`} strokeWidth="0.34" strokeLinecap="round" strokeDasharray="0.8 1.4" />
                  {!shouldReduceMotion ? (
                    <circle r={index === 0 ? 0.74 : 0.58} fill={route.tone} stroke="rgba(255,255,255,0.76)" strokeWidth="0.12">
                      <animateMotion dur={route.duration} begin={route.delay} repeatCount="indefinite" rotate="auto">
                        <mpath href={`#${route.id}`} />
                      </animateMotion>
                      <animate attributeName="opacity" values="0;1;0" dur={route.duration} begin={route.delay} repeatCount="indefinite" />
                    </circle>
                  ) : null}
                </g>
              ))}
            </g>
            {aggregate.zones.map((metric) => {
              const [cx, cy] = territoryCentroid(metric.zone.polygon);
              if (!showHeatLayer || !metric.records || metric.suppressed) return null;
              const radius = 5 + metric.intensity * 13;
              return (
                <circle
                  key={`${metric.zone.id}-halo`}
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill={`url(#${svgId}-territory-hotspot)`}
                  opacity={comparisonEnabled ? 0.28 : 0.56}
                >
                  {!shouldReduceMotion ? (
                    <animate attributeName="opacity" values="0.28;0.62;0.34" dur="4.8s" repeatCount="indefinite" />
                  ) : null}
                </circle>
              );
            })}
            <g opacity={showRealtimeLayer || focusMode === 'telemetry' ? 0.52 : 0.18}>
              {animatedZones.map((metric, index) => {
                const [cx, cy] = territoryCentroid(metric.zone.polygon);
                return (
                  <g key={`${metric.zone.id}-activity`}>
                    <circle cx={cx - 2.4} cy={cy - 2.2} r="0.42" fill="rgba(255,255,255,0.9)" />
                    <circle cx={cx + 2.8} cy={cy + 1.6} r="0.34" fill="rgba(45,212,191,0.95)" />
                    {!shouldReduceMotion ? (
                      <circle cx={cx} cy={cy} r={2.8 + metric.intensity * 2.2} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.18">
                        <animate
                          attributeName="r"
                          values={`${2.6 + index};${5.8 + metric.intensity * 4};${2.6 + index}`}
                          dur={`${5.2 + index * 0.7}s`}
                          repeatCount="indefinite"
                        />
                        <animate attributeName="opacity" values="0.05;0.45;0.05" dur={`${5.2 + index * 0.7}s`} repeatCount="indefinite" />
                      </circle>
                    ) : null}
                  </g>
                );
              })}
            </g>
            {showAiLayer || focusMode === 'territory' ? (
              <g opacity={showAiLayer ? 0.86 : 0.28}>
                {aggregate.zones
                  .filter((metric) => metric.records > 0 && !metric.suppressed)
                  .slice()
                  .sort((a, b) => b.intensity - a.intensity)
                  .slice(0, 4)
                  .map((metric, index) => {
                    const [cx, cy] = territoryCentroid(metric.zone.polygon);
                    const radius = 3.2 + metric.intensity * 4.8;
                    return (
                      <g key={`${metric.zone.id}-ai-layer`}>
                        <path
                          d={`M ${cx - radius} ${cy - radius * 0.18} C ${cx - radius * 0.2} ${cy - radius} ${cx + radius * 0.78} ${cy - radius * 0.34} ${cx + radius} ${cy + radius * 0.5}`}
                          fill="none"
                          stroke={index === 0 ? 'rgba(168,85,247,0.78)' : 'rgba(99,102,241,0.52)'}
                          strokeWidth={index === 0 ? 0.52 : 0.34}
                          strokeDasharray="1.2 1.3"
                        />
                        <circle cx={cx + radius * 0.9} cy={cy + radius * 0.48} r="0.72" fill="rgba(168,85,247,0.92)" />
                      </g>
                    );
                  })}
              </g>
            ) : null}
            <g opacity="0.34" transform="translate(0 1.35)">
              {aggregate.zones.map((metric) => (
                <path
                  key={`${metric.zone.id}-extrusion`}
                  d={territoryZoneToPath(metric.zone)}
                  fill="rgba(15,23,42,0.34)"
                  stroke="rgba(15,23,42,0.08)"
                  strokeWidth="0.2"
                />
              ))}
            </g>
            {aggregate.zones.map((metric) => {
              const selected = selectedZone.zone.id === metric.zone.id;
              const [cx, cy] = territoryCentroid(metric.zone.polygon);
              return (
                <g
                  key={metric.zone.id}
                  style={{
                    transform: selected ? 'translateY(-0.65px)' : undefined,
                    transformOrigin: `${cx}px ${cy}px`,
                    transition: shouldReduceMotion ? undefined : 'transform 220ms ease, filter 220ms ease',
                  }}
                >
                  <path
                    d={territoryZoneToPath(metric.zone)}
                    fill={
                      showHeatLayer || focusMode === 'territory'
                        ? fillForIntensity(metric, selected)
                        : metric.records
                          ? 'rgba(148, 163, 184, 0.2)'
                          : 'rgba(148, 163, 184, 0.08)'
                    }
                    stroke={strokeForIntensity(metric, selected)}
                    strokeWidth={selected ? 0.72 : 0.38}
                    filter={selected ? `url(#${svgId}-selected-glow)` : `url(#${svgId}-zone-shadow)`}
                    tabIndex={0}
                    role="button"
                    aria-label={`${metric.zone.label}: ${metric.suppressed ? 'muestra insuficiente' : formatCountLabel(metric.total, 'evento', 'eventos')}`}
                    className="cursor-pointer outline-none transition duration-200 hover:brightness-110 focus-visible:brightness-125"
                    onMouseEnter={() => setSelectedZoneId(metric.zone.id)}
                    onFocus={() => setSelectedZoneId(metric.zone.id)}
                    onClick={() => setSelectedZoneId(metric.zone.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedZoneId(metric.zone.id);
                      }
                    }}
                  >
                    <title>{metric.zone.label}</title>
                  </path>
                  <path
                    d={territoryZoneToPath(metric.zone)}
                    fill={`url(#${svgId}-surface-shine)`}
                    opacity={selected ? 0.38 : focusMode === 'quality' ? 0.25 : 0.16}
                    className="pointer-events-none"
                  />
                  {showQualityLayer || focusMode === 'quality' ? (
                    <path
                      d={territoryZoneToPath(metric.zone)}
                      fill="none"
                      stroke={
                        !metric.records
                          ? 'rgba(148,163,184,0.34)'
                          : metric.suppressed
                            ? 'rgba(248,113,113,0.58)'
                            : metric.confidence === 'high'
                              ? 'rgba(34,197,94,0.62)'
                              : 'rgba(245,158,11,0.62)'
                      }
                      strokeWidth={selected ? 0.56 : 0.28}
                      strokeDasharray={metric.suppressed || !metric.records ? '0.9 0.8' : undefined}
                      className="pointer-events-none"
                    />
                  ) : null}
                  {metric.records ? (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={selected ? 1.45 : 1.05}
                      fill={metric.suppressed ? 'rgba(148, 163, 184, 0.95)' : 'rgba(255, 255, 255, 0.96)'}
                      stroke={strokeForIntensity(metric, selected)}
                      strokeWidth="0.35"
                    >
                      {!shouldReduceMotion && selected ? (
                        <animate attributeName="r" values="1.25;1.85;1.25" dur="1.8s" repeatCount="indefinite" />
                      ) : null}
                    </circle>
                  ) : null}
                  <text
                    x={cx}
                    y={cy + 4.6}
                    textAnchor="middle"
                    className="pointer-events-none fill-slate-950 text-[2.5px] font-semibold dark:fill-white"
                  >
                    {metric.zone.label}
                  </text>
                </g>
              );
            })}
            <g data-testid="territory-selected-crosshair" aria-hidden="true" transform={`translate(${selectedCx} ${selectedCy})`} className="pointer-events-none">
              <circle r="4.8" fill="none" stroke="rgba(255,255,255,0.58)" strokeWidth="0.24" strokeDasharray="0.9 0.8">
                {!shouldReduceMotion ? <animate attributeName="r" values="4.2;6.4;4.2" dur="3.2s" repeatCount="indefinite" /> : null}
              </circle>
              <circle r="1.9" fill="none" stroke="rgba(34,211,238,0.82)" strokeWidth="0.22" />
              <line x1="-7" x2="-2.4" y1="0" y2="0" stroke="rgba(255,255,255,0.62)" strokeWidth="0.18" />
              <line x1="2.4" x2="7" y1="0" y2="0" stroke="rgba(255,255,255,0.62)" strokeWidth="0.18" />
              <line x1="0" x2="0" y1="-7" y2="-2.4" stroke="rgba(255,255,255,0.62)" strokeWidth="0.18" />
              <line x1="0" x2="0" y1="2.4" y2="7" stroke="rgba(255,255,255,0.62)" strokeWidth="0.18" />
            </g>
            {!shouldReduceMotion ? (
              <rect
                x="-22"
                y="0"
                width="16"
                height="68"
                fill={`url(#${svgId}-scan)`}
                opacity="0.22"
                transform="skewX(-16)"
              >
                <animate attributeName="x" values="-24;112" dur="8.5s" repeatCount="indefinite" />
              </rect>
            ) : null}
            {showQualityLayer || focusMode === 'quality' ? (
              <g aria-hidden="true">
                <circle cx="84" cy="12" r="5.6" fill="rgba(15,23,42,0.1)" stroke="rgba(148,163,184,0.28)" strokeWidth="0.6" />
                <circle
                  cx="84"
                  cy="12"
                  r="5.6"
                  fill="none"
                  stroke={readiness.state === 'ready' ? 'rgba(34,197,94,0.86)' : 'rgba(245,158,11,0.86)'}
                  strokeWidth="1"
                  strokeLinecap="round"
                  pathLength="100"
                  strokeDasharray={coverageArc(scopedTerritoryView.coveragePercent)}
                  transform="rotate(-90 84 12)"
                />
                <text x="84" y="12.8" textAnchor="middle" className="fill-slate-950 text-[2.8px] font-semibold dark:fill-white">
                  {scopedTerritoryView.coveragePercent !== undefined
                    ? `${Math.round(scopedTerritoryView.coveragePercent)}%`
                    : '—'}
                </text>
                {geocodingCandidates.map((candidate, index) => {
                  const x = 12 + index * 4.2;
                  const y = 58 - index * 1.6;
                  const key = String(candidate.record_id ?? candidate.ticket_id ?? candidate.address ?? index);
                  return (
                    <g key={`${key}-geocode-dot`}>
                      <circle cx={x} cy={y} r="1.15" fill="rgba(245,158,11,0.92)" stroke="rgba(255,255,255,0.8)" strokeWidth="0.32" />
                      <path d={`M ${x} ${y + 1.2} L ${x - 0.9} ${y + 3.2} L ${x + 0.9} ${y + 3.2} Z`} fill="rgba(245,158,11,0.4)" />
                    </g>
                  );
                })}
              </g>
            ) : null}
            {showRealtimeLayer || focusMode === 'telemetry' ? (
              <g aria-hidden="true" opacity="0.72">
                <ellipse
                  cx="50"
                  cy="35"
                  rx="45"
                  ry="31"
                  fill="none"
                  stroke="rgba(6,182,212,0.54)"
                  strokeWidth="0.24"
                  strokeDasharray="2 2.8"
                >
                  {!shouldReduceMotion ? (
                    <animate attributeName="stroke-dashoffset" values="0;-18" dur="4.6s" repeatCount="indefinite" />
                  ) : null}
                </ellipse>
                <path
                  d="M11 38 C28 26 41 48 57 33 C70 20 82 30 90 21"
                  fill="none"
                  stroke="rgba(34,211,238,0.46)"
                  strokeWidth="0.42"
                  strokeLinecap="round"
                />
              </g>
            ) : null}
          </svg>
          ) : (
            <div
              data-testid="territory-boundary-empty-state"
              role="status"
              className="relative z-10 flex h-[450px] items-center justify-center px-6 pb-28 pt-24 text-center sm:h-[540px]"
            >
              <div className="max-w-xl rounded-xl border border-dashed border-border bg-background/90 p-6 shadow-sm backdrop-blur">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <MapPin className="h-5 w-5" />
                </div>
                <h4 className="mt-3 text-lg font-semibold">Sin delimitación territorial oficial</h4>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  No se dibujan barrios, distritos ni poblaciones estimadas. Cargá un archivo oficial de límites territoriales para habilitar
                  agregaciones, rankings y tasas por zona.
                </p>
              </div>
            </div>
          )}

          {showLiveMap ? (
            <div
              data-testid="territory-live-legend"
              className="relative z-20 border-t border-border/80 bg-background p-3 sm:p-4"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Lectura territorial</p>
                    <Badge variant="outline" className="gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {visiblePointCountProtected
                        ? `Muestra protegida · mínimo ${effectiveMinSampleSize}`
                        : formatCountLabel(visibleLiveMapPoints.length, 'punto visible', 'puntos visibles')}
                    </Badge>
                    <Badge
                      data-testid="territory-data-provenance"
                      variant="outline"
                      className={cn('gap-1', provenanceToneClass[dataProvenance.state])}
                      title={dataProvenance.detail}
                    >
                      {dataProvenance.state === 'real' ? <ShieldCheck className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                      {dataProvenance.label}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Baja</span>
                    <span
                      className="h-2 w-28 rounded-full bg-gradient-to-r from-blue-400 via-teal-500 via-55% to-amber-500"
                      aria-hidden="true"
                    />
                    <span>Alta intensidad</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {renderPointLayer
                        ? 'círculos por categoría'
                        : exactPointsSuppressed || aggregatedPrivacyMode
                          ? 'detalle puntual protegido'
                          : 'capa categórica oculta'}
                    </span>
                  </div>
                  {mapCategoryFacets.some((facet) => facet.mappedCount > 0) ? (
                    <div
                      data-testid="territory-category-legend"
                      className="mt-3 flex flex-wrap items-center gap-2"
                      aria-label="Leyenda interactiva por categoría"
                    >
                      {mapCategoryFacets
                        .filter((facet) => facet.mappedCount > 0)
                        .slice(0, 6)
                        .map((facet) => {
                          const active = selectedCategoryFacet?.key === facet.key;
                          return (
                            <Button
                              key={facet.key}
                              type="button"
                              size="sm"
                              variant={active ? 'default' : 'outline'}
                              className="h-8 gap-2 rounded-full px-3 text-xs"
                              aria-pressed={active}
                              onClick={() => {
                                setSelectedMapPoint(null);
                                setMapCategoryFilter(active ? null : facet.key);
                              }}
                            >
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/80 shadow-sm"
                                style={{ backgroundColor: facet.color ?? categoryColorFor(facet.key) }}
                                aria-hidden="true"
                              />
                              {facet.label}
                              <span className={cn('tabular-nums', active ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                                {formatNumber(facet.mappedCount)}
                              </span>
                            </Button>
                          );
                        })}
                    </div>
                  ) : null}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={comparisonEnabled ? 'default' : 'outline'}
                  className="shrink-0 gap-2 rounded-lg"
                  onClick={() => setComparisonEnabled((value) => !value)}
                  disabled={!hasTerritoryBoundaries}
                  title={!hasTerritoryBoundaries ? 'Requiere delimitaciones territoriales oficiales' : undefined}
                >
                  <TrendingUp className="h-4 w-4" />
                  Comparar zonas
                </Button>
              </div>

              {filteredMapEmpty ? (
                <div
                  data-testid="territory-filter-empty"
                  role="status"
                  className="mt-3 flex flex-col gap-3 rounded-lg border border-amber-300/70 bg-amber-50/70 px-3 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/20 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">
                      {activeZeroMappedFacet
                        ? `Sin puntos mapeados para ${activeZeroMappedFacet.label}`
                        : 'La combinación seleccionada no tiene puntos mapeados'}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {activeZeroMappedFacet
                        ? 'La categoría sigue disponible porque existen reclamos en la cola territorial; el mapa no inventa coordenadas.'
                        : 'Quitá un filtro para ampliar la lectura. Los reclamos sin coordenadas permanecen en su cola operativa.'}
                    </p>
                    {activeZeroMappedFacet ? (
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                        <Badge variant="outline">Total · {formatNumber(activeZeroMappedFacet.total)}</Badge>
                        <Badge variant="outline">Mapeados · {formatNumber(activeZeroMappedFacet.mappedCount)}</Badge>
                        <Badge variant="outline">
                          Pendientes de geocodificar · {formatNumber(activeZeroMappedFacet.pendingGeocodeCount)}
                        </Badge>
                        <Badge variant="outline" className="border-amber-400/70 text-amber-800 dark:text-amber-200">
                          Fuera de jurisdicción / revisar · {formatNumber(activeZeroMappedFacet.outsideJurisdictionCount)}
                        </Badge>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={clearMostSpecificTerritoryFilter}>
                      Quitar último filtro
                    </Button>
                    <Button type="button" size="sm" variant="default" onClick={resetTerritoryFilters}>
                      Restablecer mapa
                    </Button>
                    {Math.max(
                      scopedTerritoryView.pendingGeocodeCount ?? 0,
                      activeZeroMappedFacet?.pendingGeocodeCount ?? 0,
                    ) > 0 ? (
                      <a
                        href={`/perfil?tab=tickets&focus=open_geocoding_queue${
                          activeZeroMappedFacet ? `&facet=${encodeURIComponent(activeZeroMappedFacet.key)}` : ''
                        }`}
                        className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Abrir cola pendiente
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {selectedMapPoint ? (
                <div
                  data-testid="territory-selected-point"
                  className="mt-3 flex flex-col gap-3 rounded-lg border border-primary/25 bg-primary/[0.04] p-3 sm:flex-row sm:items-center sm:justify-between"
                  role="status"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full border-2 border-white shadow-sm"
                        style={{ backgroundColor: selectedMapPoint.categoryColor ?? categoryColorFor(selectedMapPoint.categoria) }}
                        aria-hidden="true"
                      />
                      <p className="font-semibold text-foreground">
                        {humanizeCategoryValue(selectedMapPoint.categoria ?? 'Reclamo territorial')}
                      </p>
                      {selectedMapPoint.estado ? <Badge variant="secondary">{humanizeCategoryValue(selectedMapPoint.estado)}</Badge> : null}
                      {selectedMapPoint.canal ? <Badge variant="outline">{humanizeCategoryValue(selectedMapPoint.canal)}</Badge> : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {selectedMapPoint.addressCellLabel ??
                        selectedMapPoint.barrio ??
                        selectedMapPoint.distrito ??
                        'Ubicación validada sin zona pública'}
                      {' · '}Coordenada disponible para operación autorizada
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {selectedTicketHref ? (
                      <Button asChild type="button" size="sm" variant="default">
                        <a href={selectedTicketHref}>
                          Abrir reclamo
                        </a>
                      </Button>
                    ) : (
                      <Badge variant="outline">Sin vínculo CRM verificable</Badge>
                    )}
                    <Button type="button" size="sm" variant="outline" onClick={() => setSelectedMapPoint(null)}>
                      Cerrar detalle
                    </Button>
                  </div>
                </div>
              ) : null}

            </div>
          ) : null}
        </div>

        <aside data-testid="territory-executive-rail" className="self-start 2xl:sticky 2xl:top-24">
          <details open className="group rounded-xl border border-border bg-background p-4 shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 [&::-webkit-details-marker]:hidden">
              <span className="text-sm font-semibold">Inspector territorial</span>
              <Badge data-testid="territory-boundary-status" variant={badgeVariantForReadiness(readiness.state)}>
                {territoryScopeBadgeLabel}
              </Badge>
            </summary>
            <div className="mt-4 border-t border-border/60 pt-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Estado del mapa</p>
                <h4 className="mt-1 text-lg font-semibold">{executiveReadinessLabel}</h4>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Gauge className="h-3.5 w-3.5" />
                  Cobertura
                </div>
                <p data-testid="territory-rail-coverage" className="mt-1 text-lg font-semibold">
                  {scopedCoverageLabel}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <DatabaseZap className="h-3.5 w-3.5" />
                  Ubicaciones pendientes
                </div>
                <p data-testid="territory-rail-pending" className="mt-1 text-lg font-semibold">
                  {scopedPendingLabel}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Radar className="h-3.5 w-3.5" />
                  Alertas
                </div>
                <p className="mt-1 text-lg font-semibold">
                  {scopedTerritoryView.globalInsightsCompatible && hasTerritoryBoundaries
                    ? formatNumber(aggregate.alerts)
                    : '--'}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Activity className="h-3.5 w-3.5" />
                  Frecuencia configurada
                </div>
                <p className="mt-1 text-lg font-semibold">{heatmap?.realtime?.poll_seconds ? `${formatNumber(heatmap.realtime.poll_seconds)}s` : '--'}</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {scopedTerritoryView.globalInsightsCompatible ? executiveReadinessDetail : scopedMetricsDetail}
            </p>
            {realtimeSources.length || realtimeEvents.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {[...realtimeSources, ...realtimeEvents].slice(0, 4).map((item) => (
                  <Badge key={item} variant="outline" className="capitalize">
                    {humanizeContractValue(item, 'Canal configurado')}
                  </Badge>
                ))}
              </div>
            ) : null}
            </div>
          </details>

        </aside>
      </div>

      <details
        data-testid="territory-intelligence-details"
        className="group order-6 rounded-xl border border-border/80 bg-background shadow-sm"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Layers className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">Análisis y acciones territoriales</span>
              <span className="block truncate text-xs text-muted-foreground">
                Capas, prioridades y evidencia secundaria
              </span>
            </span>
          </span>
          <span className="shrink-0 text-xs font-medium text-primary group-open:hidden">Mostrar</span>
          <span className="hidden shrink-0 text-xs font-medium text-primary group-open:inline">Ocultar</span>
        </summary>

        <section
          data-testid="territory-intelligence-workspace"
          aria-labelledby={`${svgId}-territory-intelligence-title`}
          className="grid items-start gap-4 border-t border-border/70 p-4 lg:grid-cols-2"
        >
        <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-muted/15 p-4 lg:col-span-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Inteligencia territorial</p>
            <h4 id={`${svgId}-territory-intelligence-title`} className="mt-1 text-lg font-semibold">
              Prioridades, capas y acciones en un solo espacio
            </h4>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground lg:text-right">
            El mapa conserva el foco visual; la evidencia secundaria se organiza debajo para comparar y actuar sin una columna interminable.
          </p>
        </div>

          {!scopedTerritoryView.globalInsightsCompatible ? (
            <div
              data-testid="territory-scoped-insights-note"
              className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/[0.04] p-4 lg:col-span-2"
            >
              <Filter className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-semibold">Lectura acotada · {scopedTerritoryView.label}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {scopedTerritoryView.mode === 'single'
                    ? 'Totales, cobertura y pendientes provienen de la faceta territorial canónica. Los rankings globales quedan ocultos mientras este segmento está activo.'
                    : 'Se muestran sólo los puntos que cumplen todos los filtros. Cobertura y pendientes no están disponibles porque el contrato no informa el denominador de esta intersección.'}
                </p>
              </div>
            </div>
          ) : null}

          {hasBackendMapContract && scopedTerritoryView.globalInsightsCompatible ? (
            <div data-testid="backend-map-contract-card" className="rounded-xl border border-cyan-500/20 bg-[linear-gradient(135deg,rgba(8,47,73,0.08),hsl(var(--background)),rgba(124,58,237,0.07))] p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Mapa operativo</p>
                  <h4 className="mt-1 truncate text-lg font-semibold">{backendRenderer}</h4>
                </div>
                <Badge variant="outline" className="shrink-0 gap-1">
                  <Radar className="h-3.5 w-3.5" />
                  {backendRadarEnabled ? 'radar activo' : 'capa estática'}
                </Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-lg border bg-background/65 p-3">
                  <p className="text-xs text-muted-foreground">Casos</p>
                  <p className="mt-1 text-lg font-semibold">{formatNumber(backendTotalCases)}</p>
                </div>
                <div className="rounded-lg border bg-background/65 p-3">
                  <p className="text-xs text-muted-foreground">Zonas críticas</p>
                  <p className="mt-1 text-lg font-semibold">{formatNumber(backendCriticalHotspots, '0')}</p>
                </div>
              </div>
              {backendTopCategory ? (
                <div className="mt-3 rounded-lg border bg-background/65 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Foco principal</p>
                      <p className="mt-1 truncate text-sm font-medium">{humanizeCategoryValue(backendTopCategory)}</p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 capitalize">
                      {backendFocusRiskLabel}
                    </Badge>
                  </div>
                  {backendFocusCount !== undefined ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatCountLabel(backendFocusCount, 'caso agrupado', 'casos agrupados')} en el foco operativo.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {operationalHotspots.length && scopedTerritoryView.globalInsightsCompatible ? (
            <div
              data-testid="operational-hotspots-panel"
              className="rounded-xl border border-amber-500/25 bg-[linear-gradient(135deg,rgba(245,158,11,0.10),hsl(var(--background)),rgba(59,130,246,0.07))] p-4 shadow-sm lg:col-span-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">
                    Prioridades territoriales
                  </p>
                  <h4 className="mt-1 text-lg font-semibold leading-tight">Focos para actuar primero</h4>
                </div>
                <Badge variant="outline" className="shrink-0 gap-1">
                  <Radar className="h-3.5 w-3.5" />
                  {formatNumber(operationalHotspotCount, '0')}
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-lg border bg-background/70 p-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">SLA</p>
                  <p className="mt-1 text-base font-semibold">{formatNumber(readNumber(topOperationalSignals?.breached_sla), '0')}</p>
                </div>
                <div className="rounded-lg border bg-background/70 p-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Sin resp.</p>
                  <p className="mt-1 text-base font-semibold">{formatNumber(readNumber(topOperationalSignals?.unassigned), '0')}</p>
                </div>
                <div className="rounded-lg border bg-background/70 p-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">24h</p>
                  <p className="mt-1 text-base font-semibold">{formatNumber(readNumber(topOperationalSignals?.recent_24h), '0')}</p>
                </div>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {operationalHotspots.slice(0, 3).map((hotspot, index) => {
                  const signals = asRecord(hotspot.signals);
                  const category = humanizeCategoryValue(readString(hotspot.top_category, hotspot.key, hotspot.label));
                  const channel = humanizeContractValue(readString(hotspot.top_channel), 'sin canal');
                  const signalChips = [
                    { label: 'SLA', value: readNumber(signals?.breached_sla) },
                    { label: 'sin responsable', value: readNumber(signals?.unassigned) },
                    { label: '24h', value: readNumber(signals?.recent_24h) },
                    { label: 'tickets', value: readNumber(signals?.tickets) },
                  ].filter((chip) => (chip.value ?? 0) > 0);
                  return (
                    <div
                      key={hotspot.id ?? `${category}-${index}`}
                      data-testid="operational-hotspot-item"
                      className="rounded-lg border bg-background/75 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                              {index + 1}
                            </span>
                            <p className="truncate text-sm font-semibold">{category}</p>
                          </div>
                          <div className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {channel} - {hotspot.id}
                          </div>
                        </div>
                        <Badge variant="secondary" className="shrink-0">
                          {formatNumber(readNumber(hotspot.operational_score), '0')}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge variant="outline" className="text-[10px]">
                          {operationalRankLabel(readString(hotspot.rank_reason))}
                        </Badge>
                        {signalChips.map((chip) => (
                          <Badge key={chip.label} variant="secondary" className="text-[10px]">
                            {chip.label}: {formatNumber(chip.value, '0')}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <details className="group rounded-xl border border-border bg-background p-4 shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 [&::-webkit-details-marker]:hidden">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Brain className="h-4 w-4 text-primary" />
              Capas de análisis
            </div>
              <Badge variant="outline" className="shrink-0">
                {displayLayers.slice(0, 5).length} configuradas
              </Badge>
            </summary>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {displayLayers.slice(0, 5).map((layer) => {
                const isCategoryControl = ['category', 'categoria'].some((fragment) => layer.id.includes(fragment));
                const protectedByPrivacy = isCategoryControl && !canShowExactPointMarkers;
                const active = !protectedByPrivacy && enabledLayerIds.includes(layer.id);
                return (
                <Button
                  key={`${layer.id}-summary`}
                  type="button"
                  variant="outline"
                  className={cn('h-auto min-h-16 w-full flex-col items-stretch rounded-lg px-3 py-2 text-left', active && layerToneClass[layer.tone])}
                  disabled={protectedByPrivacy}
                  aria-pressed={active}
                  title={protectedByPrivacy ? 'La política de privacidad protege el detalle puntual' : layer.description}
                  onClick={() =>
                    setLayerSelection((current) => {
                      const base = current ?? defaultEnabledLayerIds;
                      return base.includes(layer.id) ? base.filter((item) => item !== layer.id) : [...base, layer.id];
                    })
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{layer.label}</span>
                    <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full border', layerToneClass[layer.tone])} />
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{layer.description}</p>
                </Button>
              )})}
            </div>
          </details>

          {hasOperationalBrief && scopedTerritoryView.globalInsightsCompatible ? (
            <div className="rounded-xl border border-primary/15 bg-[linear-gradient(135deg,hsl(var(--background)),rgba(59,130,246,0.08),rgba(20,184,166,0.06))] p-4 shadow-sm lg:col-span-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Resumen operativo asistido
                  </div>
                  <h4 className="mt-2 text-base font-semibold leading-snug">
                    {operationalNarrativeTitle}
                  </h4>
                  {operationalNarrativeBody ? (
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{operationalNarrativeBody}</p>
                  ) : null}
                </div>
                <Badge variant={aiStatus?.requires_human_attention ? 'secondary' : 'outline'} className="shrink-0 capitalize">
                  {aiStatusLabel}
                </Badge>
              </div>

              <div className="mt-4 grid gap-2">
                <div className="rounded-lg border bg-background/65 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    <Brain className="h-3.5 w-3.5" />
                    Motor cognitivo
                  </div>
                  <p className="mt-1 text-sm font-medium capitalize">{aiModeLabel}</p>
                  {aiHintLabels.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {aiHintLabels.map((hint) => (
                        <Badge key={hint} variant="secondary" className="text-[11px] capitalize">
                          {hint}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>

                {defaultViewport ? (
                  <div className="rounded-lg border bg-background/65 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        <Compass className="h-3.5 w-3.5" />
                        Vista sugerida
                      </div>
                      {defaultViewport.default ? <Badge variant="outline">Predeterminada</Badge> : null}
                    </div>
                    <p className="mt-1 truncate text-sm font-medium">
                      {defaultViewport.label || defaultViewport.id || 'Foco territorial'}
                    </p>
                    {defaultViewportDetail ? (
                      <p className="mt-1 text-xs text-muted-foreground">{defaultViewportDetail}</p>
                    ) : null}
                  </div>
                ) : null}

                {operationalActionSummaries.length ? (
                  <div data-testid="heatmap-action-loop" className="rounded-lg border bg-background/65 p-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      <ListChecks className="h-3.5 w-3.5" />
                       Próximas acciones
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {operationalActionSummaries
                        .slice(0, 6)
                        .map((action) => (
                          <div
                            key={`${action.label}-${action.detail ?? action.uiHint ?? ''}`}
                            data-testid="heatmap-action-item"
                            className="rounded-md border border-border/60 bg-muted/25 px-2.5 py-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="min-w-0 text-sm font-medium">{action.label}</p>
                              {action.priority || action.actionType ? (
                                <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
                                  {humanizeContractValue(action.priority ?? action.actionType, 'Prioridad operativa')}
                                </Badge>
                              ) : null}
                            </div>
                            {action.detail ? (
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">{action.detail}</p>
                            ) : null}
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {action.uiHint ? (
                                <Badge variant="secondary" className="text-[10px] capitalize">
                                  {humanizeContractValue(action.uiHint, 'Acción operativa')}
                                </Badge>
                              ) : null}
                              <Badge variant={action.writesEnabled ? 'outline' : 'secondary'} className="text-[10px]">
                                {action.writesEnabled ? 'requiere confirmación' : 'preparación segura'}
                              </Badge>
                              {action.href ? (
                                <a
                                  href={action.href}
                                  className="inline-flex rounded-full border border-primary/30 px-2 py-0.5 text-[10px] font-semibold text-primary transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                                >
                                  Abrir en CRM
                                </a>
                              ) : null}
                            </div>
                          </div>
                        ))}
                    </div>
                    {heatmap?.hotspot_actions ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {heatmap.hotspot_actions.safe_by_default ? 'Acciones protegidas' : 'Revisar permisos'} -{' '}
                        {heatmap.hotspot_actions.writes_enabled ? 'requiere confirmación' : 'solo preparación operativa'}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {hasTerritoryBoundaries ? (
            <>
          <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Zona seleccionada</p>
                <h4 className="mt-1 text-xl font-semibold">{selectedZone.zone.label}</h4>
              </div>
              <Badge variant={selectedZone.suppressed ? 'secondary' : 'outline'}>
                {selectedZone.suppressed ? 'muestra insuficiente' : confidenceLabel(selectedZone.confidence)}
              </Badge>
            </div>

            {selectedZone.suppressed ? (
              <div className="mt-4 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                Muestra insuficiente. Se ocultan totales y categorías para evitar la reidentificación por segmentos.
              </div>
            ) : (
              <div className="mt-4">
                <MetricLine label="Eventos ponderados" value={formatNumber(selectedZone.total)} />
                <MetricLine label="Registros agregados" value={formatNumber(selectedZone.records)} />
                <MetricLine
                  label="Tasa cada 1.000"
                  value={formatNumber(selectedZone.ratePerThousand, 'sin población oficial')}
                />
                <MetricLine label="Variacion" value={formatVariation(selectedZone.variationPercent)} />
              </div>
            )}

            <div className="mt-4 rounded-lg bg-muted/35 p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Eye className="h-4 w-4 text-primary" />
                Recomendacion operativa
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{selectedZone.recommendation}</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <MapPin className="h-4 w-4 text-primary" />
              Intensidad por zona
            </div>
            <div className="mt-3 space-y-3">
              {topZones.length ? (
                topZones.map((metric) => (
                  <button
                    key={metric.zone.id}
                    type="button"
                    className="w-full rounded-lg border border-border/70 p-3 text-left transition hover:border-primary/60 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    onClick={() => setSelectedZoneId(metric.zone.id)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{metric.zone.label}</span>
                      <span className="text-sm text-muted-foreground">
                        {metric.suppressed ? 'muestra insuficiente' : formatNumber(metric.total)}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 via-teal-400 to-amber-400"
                        style={{ width: `${Math.max(8, metric.intensity * 100)}%` }}
                      />
                    </div>
                  </button>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Sin zonas activas para los filtros actuales.</p>
              )}
            </div>
          </div>

          {aggregate.topCategories.length ? (
            <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
              <p className="text-sm font-semibold">Categorías dominantes</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {aggregate.topCategories.map((category) => (
                  <Badge key={category.key} variant="secondary">
                    {category.label}: {formatNumber(category.total)}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
            </>
          ) : (
            <div
              data-testid="territory-zone-analytics-unavailable"
              className="rounded-xl border border-dashed border-border bg-background p-4 shadow-sm lg:col-span-2"
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                <MapPin className="h-4 w-4 text-primary" />
                Sin delimitación territorial oficial
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                El mapa conserva los puntos y celdas disponibles. {dataProvenance.detail} No calcula rankings,
                tasas por población ni comparaciones entre zonas hasta recibir límites oficiales.
              </p>
            </div>
          )}
        </section>
      </details>
    </section>
  );
}
