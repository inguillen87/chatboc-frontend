import { useMemo, useCallback, useEffect, useId, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Activity, AlertTriangle, Layers, MapPin, Radio, Radar, ShieldCheck, Target, type LucideIcon } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import MapLibreMap from '@/components/LazyMapLibreMap';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { MapProviderToggle } from '@/components/MapProviderToggle';
import { useMapProvider } from '@/hooks/useMapProvider';
import type { MapProvider, MapProviderUnavailableReason } from '@/hooks/useMapProvider';
import type {
  SurveyAnalyticsFilters,
  SurveyDemographicBreakdownItem,
  SurveyAnalyticsHeatmap,
  SurveyAnalyticsProvenance,
  SurveyHeatmapPoint,
  SurveySummary,
  SurveyTimeseriesPoint,
} from '@/types/encuestas';
import { enterpriseService } from '@/services/enterpriseService';
import { MeasuredContainer } from '@/components/analytics/MeasuredContainer';
import { SurveyResponseProvenanceBadge } from '@/components/surveys/SurveyResponseProvenanceBadge';

interface SurveyAnalyticsProps {
  summary?: SurveySummary;
  timeseries?: SurveyTimeseriesPoint[];
  heatmap?: SurveyHeatmapPoint[];
  heatmapPayload?: SurveyAnalyticsHeatmap;
  heatmapMeta?: SurveyAnalyticsHeatmap['metadata'];
  provenance?: SurveyAnalyticsProvenance;
  onExport: () => Promise<void>;
  isExporting?: boolean;
  filters?: SurveyAnalyticsFilters;
  onFiltersChange?: (next: SurveyAnalyticsFilters) => void;
  tenantSlug?: string;
  tenantId?: number;
  route?: string;
}

const palette = ['#2563eb', '#7c3aed', '#059669', '#ea580c', '#f59e0b', '#db2777'];
const CHART_ANIMATION_DURATION = 650;
const CHART_ANIMATION_EASING = 'ease-out';

const colorFromCategory = (value: string, fallbackIndex = 0) => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return palette[fallbackIndex % palette.length];
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) hash = (hash << 5) - hash + normalized.charCodeAt(i);
  return palette[Math.abs(hash) % palette.length];
};
const DEMOGRAPHIC_LABELS: Record<string, string> = {
  genero: 'Género',
  generos: 'Género',
  rango_etario: 'Rango etario',
  rangos_etarios: 'Rangos etarios',
  rangoEtario: 'Rango etario',
  rangosEtarios: 'Rangos etarios',
  pais: 'País',
  paises: 'País',
  provincia: 'Provincia',
  provincias: 'Provincia',
  ciudad: 'Ciudad',
  ciudades: 'Ciudad',
  barrio: 'Barrio',
  barrios: 'Barrio',
};

const normalizeDemographicLabel = (key: string) =>
  DEMOGRAPHIC_LABELS[key] ?? key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());

const buildDemographicData = (items: SurveyDemographicBreakdownItem[]) =>
  items
    .filter((item) => typeof item?.respuestas === 'number')
    .map((item, index) => {
      const label = item.etiqueta ?? item.clave ?? 'Sin dato';
      return {
        label,
        value: item.respuestas,
        percentage: typeof item.porcentaje === 'number' ? item.porcentaje : undefined,
        key: `${item.clave ?? label}-${index}`,
      };
    });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

type SurveyTerritoryEvidenceGate = {
  ready: boolean;
  reasonCode: string;
  title: string;
  detail: string;
  nextAction: string;
};

const normalizedEvidenceText = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim().replace(/\/+$/, '').toLowerCase() : null;

const normalizedEvidenceSha = (value: unknown) => {
  const normalized = normalizedEvidenceText(value);
  return normalized && /^[a-f0-9]{64}$/.test(normalized) ? normalized : null;
};

export const resolveSurveyTerritoryEvidenceGate = (
  metadataValue: unknown,
  rawPoints: unknown[],
): SurveyTerritoryEvidenceGate => {
  const metadata = isRecord(metadataValue) ? metadataValue : null;
  const jurisdiction = isRecord(metadata?.jurisdiction) ? metadata.jurisdiction : null;
  const jurisdictionState = normalizedEvidenceText(jurisdiction?.state)?.replace(/[_-]+/g, ' ');
  if (jurisdiction?.required === false && jurisdictionState === 'not required') {
    return {
      ready: true,
      reasonCode: 'survey_territory_evidence_not_required',
      title: 'Contrato territorial habilitado',
      detail: 'El backend declaró explícitamente que este instrumento no requiere jurisdicción gubernamental.',
      nextAction: 'Mantener render_ready y la procedencia no sintética en cada actualización.',
    };
  }
  const authority = isRecord(jurisdiction?.boundary_authority) ? jurisdiction.boundary_authority : null;
  const provenance = isRecord(metadata?.provenance) ? metadata.provenance : null;
  const authoritySource = normalizedEvidenceText(authority?.source_ref ?? authority?.source_url);
  const evidenceSource = normalizedEvidenceText(provenance?.source_ref ?? provenance?.source_url);
  const authoritySha = normalizedEvidenceSha(authority?.snapshot_sha256 ?? authority?.sha256);
  const evidenceSha = normalizedEvidenceSha(provenance?.snapshot_sha256 ?? provenance?.sha256);
  const method = normalizedEvidenceText(jurisdiction?.containment_method)?.replace(/[_-]+/g, ' ');
  const provenanceMatchesAuthority = provenance !== null && (
    evidenceSource === authoritySource && evidenceSha === authoritySha
  );

  const authoritativeContract =
    jurisdiction?.enforced === true &&
    jurisdiction?.containment_verified === true &&
    ['official', 'authoritative'].includes(normalizedEvidenceText(authority?.kind ?? authority?.type) || '') &&
    ['point in polygon', 'official polygon'].includes(method || '') &&
    Boolean(authoritySource && authoritySha) &&
    provenanceMatchesAuthority;

  if (!authoritativeContract) {
    return {
      ready: false,
      reasonCode: 'survey_territory_authority_unverified',
      title: 'Lectura territorial bloqueada',
      detail: 'El servidor no publicó una autoridad territorial verificable y enlazada al snapshot de esta analítica.',
      nextAction: 'Vinculá la fuente oficial, su SHA-256 y el contrato de contención antes de usar el mapa.',
    };
  }

  const everyPointContained = rawPoints.length > 0 && rawPoints.every((value) => {
    if (!isRecord(value)) return false;
    const containment = isRecord(value.containment) ? value.containment : value;
    const status = normalizedEvidenceText(
      containment.coordinate_jurisdiction_status ?? containment.jurisdiction_status ?? containment.status,
    )?.replace(/[_-]+/g, ' ');
    const pointSource = normalizedEvidenceText(containment.source_ref ?? containment.boundary_source_ref);
    const pointSha = normalizedEvidenceSha(containment.snapshot_sha256 ?? containment.boundary_snapshot_sha256);
    return containment.containment_verified === true &&
      status === 'within' &&
      pointSource === authoritySource &&
      pointSha === authoritySha;
  });

  if (!everyPointContained) {
    return {
      ready: false,
      reasonCode: 'survey_territory_point_containment_unverified',
      title: 'Puntos territoriales pendientes de validación',
      detail: 'Uno o más puntos no acreditan contención y enlace exacto con la fuente y el snapshot oficial vigente.',
      nextAction: 'Reprocesá la contención y publicá en cada punto estado within, fuente oficial y SHA-256 coincidentes.',
    };
  }

  return {
    ready: true,
    reasonCode: 'survey_territory_authoritative',
    title: 'Evidencia territorial verificada',
    detail: 'La autoridad oficial y su snapshot son válidos; todos los puntos fueron incluidos como contenidos.',
    nextAction: 'Mantener la evidencia enlazada en cada actualización.',
  };
};

const isFeatureCollection = (value: unknown): value is { type: 'FeatureCollection'; features: unknown[] } => {
  if (!isRecord(value)) return false;
  return value.type === 'FeatureCollection' && Array.isArray(value.features);
};

const HEATMAP_METADATA_KEYS = [
  'headline',
  'legend',
  'empty_state',
  'recommended_action',
  'render_contract',
  'map',
  'map_experience',
  'category_layers',
  'ai_layers',
  'quality',
  'privacy',
  'privacy_mode',
  'coordinate_precision',
  'using_synthetic_points',
  'jurisdiction',
  'provenance',
] as const;

const getNestedValue = (value: unknown, path: string[]): unknown => {
  let current: unknown = value;
  for (const segment of path) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
};

const extractNumberFromRecord = (
  record: Record<string, unknown> | null,
  keys: Array<string | string[]>,
): number | null => {
  if (!record) return null;

  for (const key of keys) {
    const path = Array.isArray(key) ? key : [key];
    const raw = getNestedValue(record, path);
    const normalized = toFiniteNumber(raw);
    if (normalized !== null) {
      return normalized;
    }
  }

  return null;
};

const getArray = <T = unknown,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (isRecord(value)) {
    const { data, items, results, values, entries, list } = value as {
      data?: unknown;
      items?: unknown;
      results?: unknown;
      values?: unknown;
      entries?: unknown;
      list?: unknown;
    };
    if (Array.isArray(data)) return data as T[];
    if (Array.isArray(items)) return items as T[];
    if (Array.isArray(results)) return results as T[];
    if (Array.isArray(values)) return values as T[];
    if (Array.isArray(entries)) return entries as T[];
    if (Array.isArray(list)) return list as T[];
    const numericKeys = Object.keys(value).every((key) => /^\d+$/.test(key));
    if (numericKeys) return Object.values(value) as T[];
  }
  return [];
};

const getArrayOrObjectValues = <T = unknown,>(value: unknown): T[] => {
  const directArray = getArray<T>(value);
  if (directArray.length) return directArray;
  if (isRecord(value)) {
    const objectValues = Object.values(value);
    const hasCollectionValues = objectValues.some((item) => Array.isArray(item) || isRecord(item));
    if (hasCollectionValues) return objectValues as T[];
    return [value as T];
  }
  return [];
};

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toNonEmptyString = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
};


const normalizeMapProvider = (value: unknown): MapProvider | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'maplibre' || normalized === 'maptiler') return 'maplibre';
  if (normalized === 'google') return 'google';
  return null;
};

const toStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
};

const extractTimeseriesPoint = (value: unknown): SurveyTimeseriesPoint | null => {
  if (!isRecord(value)) return null;
  const rawDate =
    toNonEmptyString(value.fecha ?? value.date ?? value.dia ?? value.day ?? value.periodo ?? value.period) ?? null;
  const respuestas =
    toFiniteNumber(value.respuestas ?? value.total ?? value.count ?? value.valor ?? value.value) ?? null;
  if (!rawDate || respuestas === null) return null;
  return { fecha: rawDate, respuestas } satisfies SurveyTimeseriesPoint;
};

const buildTimeseriesData = (points?: SurveyTimeseriesPoint[] | unknown) => {
  const candidates = getArray(points);
  const source = candidates.length ? candidates : isRecord(points) ? [points] : [];
  return source
    .map((point) => extractTimeseriesPoint(point))
    .filter((point): point is SurveyTimeseriesPoint => Boolean(point))
    .map((point) => ({
      fecha: new Date(point.fecha).toLocaleDateString(),
      respuestas: point.respuestas,
    }));
};

type OptionCandidate = { value: unknown; fallbackLabel?: string };

interface QuestionEligibilityContext {
  respuestasElegibles: number | null;
  respuestasRespondidas: number | null;
  tasaRespuestaElegible: number | null;
  tipo: string | null;
}

interface OptionBreakdownItem {
  pregunta: string;
  opcion: string;
  respuestas: number;
  porcentaje?: number;
  respuestasSeleccionaron: number;
  porcentajeTotalEncuesta?: number;
  porcentajeElegibles?: number;
  porcentajeRespuestasPregunta?: number;
  respuestasElegibles?: number;
  respuestasRespondidas?: number;
  tasaRespuestaElegible?: number;
  participacion: number;
  usaBaseElegible: boolean;
  baseParticipacion: 'elegibles' | 'respuestas_pregunta' | 'total_encuesta' | 'legacy';
  esSeleccionMultiple: boolean;
}

const collectOptionCandidates = (raw: unknown): OptionCandidate[] => {
  const arrayCandidates = getArray(raw);
  if (arrayCandidates.length) {
    return arrayCandidates.map((value) => ({ value }));
  }
  if (isRecord(raw)) {
    const looksLikeSingleItem =
      'texto' in raw ||
      'opcion' in raw ||
      'label' in raw ||
      'nombre' in raw ||
      'name' in raw ||
      'respuestas' in raw ||
      'total' in raw ||
      'count' in raw ||
      'valor' in raw ||
      'value' in raw;
    if (looksLikeSingleItem) {
      return [{ value: raw }];
    }
    return Object.entries(raw).map(([key, value]) => ({ value, fallbackLabel: key }));
  }
  if (raw !== null && raw !== undefined) {
    return [{ value: raw }];
  }
  return [];
};

const extractOptionItem = (
  candidate: OptionCandidate,
  preguntaLabel: string,
  index: number,
  eligibility: QuestionEligibilityContext,
): OptionBreakdownItem | null => {
  const { value, fallbackLabel } = candidate;
  const container = isRecord(value) ? value : {};
  const opcion =
    toNonEmptyString(
      container.texto ??
        container.opcion ??
        container.label ??
        container.nombre ??
        container.name ??
        (typeof value === 'string' ? value : undefined) ??
        fallbackLabel,
    ) ?? `Opción ${index + 1}`;
  const respuestas =
    toFiniteNumber(
      container.respuestas ??
        container.total ??
        container.count ??
        container.valor ??
        container.value ??
        (typeof value === 'number' ? value : null),
    );
  if (respuestas === null) return null;
  const porcentaje =
    toFiniteNumber(container.porcentaje ?? container.percent ?? container.pct ?? container.percentage) ?? undefined;
  const respuestasSeleccionaron =
    toFiniteNumber(
      container.respuestas_seleccionaron ??
        container.respuestasSeleccionaron,
    ) ?? respuestas;
  const porcentajeTotalEncuesta =
    toFiniteNumber(
      container.porcentaje_total_encuesta ??
        container.porcentajeTotalEncuesta,
    ) ?? undefined;
  const porcentajeElegibles =
    toFiniteNumber(
      container.porcentaje_elegibles ??
        container.porcentajeElegibles,
    ) ?? undefined;
  const porcentajeRespuestasPregunta =
    toFiniteNumber(
      container.porcentaje_respuestas_pregunta ??
        container.porcentajeRespuestasPregunta,
    ) ?? undefined;
  const hasOptionEligibilityMetric =
    porcentajeElegibles !== undefined ||
    porcentajeRespuestasPregunta !== undefined;
  const usaBaseElegible =
    eligibility.respuestasElegibles !== null ||
    eligibility.respuestasRespondidas !== null ||
    eligibility.tasaRespuestaElegible !== null ||
    hasOptionEligibilityMetric;
  const computedEligiblePercentage =
    eligibility.respuestasElegibles !== null
      ? eligibility.respuestasElegibles > 0
        ? (respuestasSeleccionaron / eligibility.respuestasElegibles) * 100
        : 0
      : null;
  const tasaRespuestaElegible =
    eligibility.tasaRespuestaElegible ??
    (eligibility.respuestasElegibles !== null &&
    eligibility.respuestasRespondidas !== null
      ? eligibility.respuestasElegibles > 0
        ? (eligibility.respuestasRespondidas /
            eligibility.respuestasElegibles) *
          100
        : 0
      : null);
  const participacionElegible =
    porcentajeElegibles ?? computedEligiblePercentage ?? undefined;
  const baseParticipacion: OptionBreakdownItem['baseParticipacion'] =
    participacionElegible !== undefined
      ? 'elegibles'
      : porcentajeRespuestasPregunta !== undefined
        ? 'respuestas_pregunta'
        : porcentajeTotalEncuesta !== undefined
          ? 'total_encuesta'
          : 'legacy';
  const participacion = Math.max(
    0,
    participacionElegible ??
      porcentajeRespuestasPregunta ??
      porcentajeTotalEncuesta ??
      porcentaje ??
      0,
  );
  return {
    pregunta: preguntaLabel,
    opcion,
    respuestas,
    porcentaje: porcentaje ?? undefined,
    respuestasSeleccionaron: Math.max(0, respuestasSeleccionaron),
    porcentajeTotalEncuesta,
    porcentajeElegibles,
    porcentajeRespuestasPregunta,
    ...(eligibility.respuestasElegibles !== null
      ? { respuestasElegibles: Math.max(0, eligibility.respuestasElegibles) }
      : {}),
    ...(eligibility.respuestasRespondidas !== null
      ? { respuestasRespondidas: Math.max(0, eligibility.respuestasRespondidas) }
      : {}),
    ...(tasaRespuestaElegible !== null
      ? { tasaRespuestaElegible: Math.max(0, tasaRespuestaElegible) }
      : {}),
    participacion: Number.isFinite(participacion) ? participacion : 0,
    usaBaseElegible,
    baseParticipacion,
    esSeleccionMultiple: ['opcion_multiple', 'multiple', 'multiple_choice'].includes(
      eligibility.tipo?.trim().toLowerCase() ?? '',
    ),
  };
};

const buildOptionBreakdown = (
  summary?: SurveySummary,
  summaryRecord: Record<string, unknown> | null = null,
) => {
  const record =
    summaryRecord ?? (summary && typeof summary === 'object'
      ? (summary as unknown as Record<string, unknown>)
      : null);

  const candidates: unknown[] = [];

  if (record) {
    const questionPaths: Array<string | string[]> = [
      'preguntas',
      'questions',
      ['data', 'preguntas'],
      ['data', 'questions'],
      ['preguntas', 'data'],
      'items',
      'results',
      'questionBreakdown',
      'question_breakdown',
      'questionStats',
      'preguntas_resumen',
    ];

    for (const path of questionPaths) {
      const value = Array.isArray(path) ? getNestedValue(record, path) : record[path];
      if (value !== undefined && value !== null) {
        candidates.push(value);
      }
    }
  }

  candidates.push(summary?.preguntas);

  let preguntas: unknown[] = [];
  for (const candidate of candidates) {
    const normalized = getArrayOrObjectValues(candidate);
    if (normalized.length) {
      preguntas = normalized;
      break;
    }
  }

  if (!preguntas.length) return [];

  return preguntas.flatMap((pregunta, preguntaIndex) => {
    if (!pregunta) return [];
    const preguntaContainer = isRecord(pregunta) ? pregunta : {};
    const preguntaLabel =
      toNonEmptyString(
        preguntaContainer.texto ??
          preguntaContainer.pregunta ??
          preguntaContainer.titulo ??
          preguntaContainer.title ??
          preguntaContainer.nombre ??
          preguntaContainer.name,
      ) ?? `Pregunta ${preguntaIndex + 1}`;
    const eligibility: QuestionEligibilityContext = {
      respuestasElegibles: toFiniteNumber(
        preguntaContainer.respuestas_elegibles ??
          preguntaContainer.respuestasElegibles,
      ),
      respuestasRespondidas: toFiniteNumber(
        preguntaContainer.respuestas_respondidas ??
          preguntaContainer.respuestasRespondidas,
      ),
      tasaRespuestaElegible: toFiniteNumber(
        preguntaContainer.tasa_respuesta_elegible ??
          preguntaContainer.tasaRespuestaElegible,
      ),
      tipo: toNonEmptyString(
        preguntaContainer.tipo_interno ??
          preguntaContainer.tipoInterno ??
          preguntaContainer.tipo ??
          preguntaContainer.type,
      ),
    };
    const optionCandidates = collectOptionCandidates(
      preguntaContainer.opciones ??
        preguntaContainer.options ??
        preguntaContainer.choices ??
        preguntaContainer.respuestas ??
        preguntaContainer.answers ??
        preguntaContainer.data,
    );
    if (!optionCandidates.length) return [];

    return optionCandidates
      .map((candidate, optionIndex) =>
        extractOptionItem(
          candidate,
          preguntaLabel,
          optionIndex,
          eligibility,
        ),
      )
      .filter(
        (item): item is OptionBreakdownItem => Boolean(item),
      );
  });
};

const normalizeHeatmapPoints = (points?: SurveyHeatmapPoint[] | unknown): SurveyHeatmapPoint[] =>
  ((): unknown[] => {
    const rawPoints = getArray(points);
    if (rawPoints.length) return rawPoints;
    if (isRecord(points)) return [points];
    return [];
  })()
    .map((rawPoint) => {
      if (!isRecord(rawPoint)) return null;
      const lat = toFiniteNumber(rawPoint.lat);
      const lng = toFiniteNumber(rawPoint.lng ?? rawPoint.lon ?? rawPoint.longitud ?? rawPoint.long);
      const respuestas =
        toFiniteNumber(rawPoint.respuestas ?? rawPoint.value ?? rawPoint.votes ?? rawPoint.votos ?? rawPoint.weight ?? rawPoint.total ?? rawPoint.count) ?? 0;
      if (lat === null || lng === null) return null;
      const categoria =
        toNonEmptyString(rawPoint.categoria ?? rawPoint.category ?? rawPoint.tipo ?? rawPoint.segmento) ?? undefined;
      const canal =
        toNonEmptyString(rawPoint.canal ?? rawPoint.channel ?? rawPoint.source ?? rawPoint.fuente) ?? undefined;
      return {
        lat,
        lng,
        respuestas,
        ...(categoria ? { categoria } : {}),
        ...(canal ? { canal } : {}),
      } satisfies SurveyHeatmapPoint;
    })
    .filter((point): point is SurveyHeatmapPoint => Boolean(point));

type ChannelBreakdownItem = { canal: string; respuestas: number };

const extractChannelItem = (value: unknown, fallbackCanal?: string | null): ChannelBreakdownItem | null => {
  if (!value && !fallbackCanal) return null;
  const container = isRecord(value) ? value : {};
  const canal = toNonEmptyString(container.canal ?? fallbackCanal);
  const respuestas =
    toFiniteNumber(container.respuestas ?? container.total ?? container.count ?? value) ?? undefined;
  if (!canal || respuestas === undefined) return null;
  return { canal, respuestas };
};

const normalizeChannelBreakdown = (raw: unknown): ChannelBreakdownItem[] => {
  const normalized: ChannelBreakdownItem[] = [];
  for (const item of getArray(raw)) {
    const parsed = extractChannelItem(item);
    if (parsed) normalized.push(parsed);
  }
  if (!normalized.length && isRecord(raw)) {
    const singleItem = extractChannelItem(raw);
    if (singleItem) {
      normalized.push(singleItem);
    } else {
      for (const [key, value] of Object.entries(raw)) {
        const parsed = extractChannelItem(value, key);
        if (parsed) normalized.push(parsed);
      }
    }
  }
  return normalized;
};

type UtmBreakdownItem = { fuente: string; campania?: string; respuestas: number };

const extractUtmItem = (value: unknown, fallbackFuente?: string | null): UtmBreakdownItem | null => {
  if (!value && !fallbackFuente) return null;
  const container = isRecord(value) ? value : {};
  const fuente = toNonEmptyString(container.fuente ?? container.source ?? fallbackFuente);
  const campania = toNonEmptyString(container.campania ?? container.campaign ?? container.nombre ?? container.name);
  const respuestas =
    toFiniteNumber(container.respuestas ?? container.total ?? container.count ?? value) ?? undefined;
  if (!fuente || respuestas === undefined) return null;
  return { fuente, campania: campania ?? undefined, respuestas };
};

const normalizeUtmBreakdown = (raw: unknown): UtmBreakdownItem[] => {
  const normalized: UtmBreakdownItem[] = [];
  for (const item of getArray(raw)) {
    const parsed = extractUtmItem(item);
    if (parsed) normalized.push(parsed);
  }
  if (!normalized.length && isRecord(raw)) {
    const singleItem = extractUtmItem(raw);
    if (singleItem) {
      normalized.push(singleItem);
    } else {
      for (const [key, value] of Object.entries(raw)) {
        const parsed = extractUtmItem(value, key);
        if (parsed) normalized.push(parsed);
      }
    }
  }
  return normalized;
};

type SurveyGeoIntensity = {
  totalWeight: number;
  maxWeight: number;
  avgWeight: number;
  hotspots: SurveyHeatmapPoint[];
};

type SurveyTerritoryNode = {
  id: string;
  x: number;
  y: number;
  weight: number;
  label: string;
  channel?: string;
};

type SurveyTerritoryReadiness = {
  label: string;
  detail: string;
  toneClass: string;
  icon: LucideIcon;
};

const SURVEY_TERRITORY_WIDTH = 760;
const SURVEY_TERRITORY_HEIGHT = 390;

const providerLabel = (provider?: MapProvider | null) => {
  if (provider === 'google') return 'Google Maps';
  if (provider === 'maplibre') return 'MapLibre GL';
  return 'Auto';
};

const formatSurveyNumber = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('es-AR') : '--';

const formatSurveyPercentage = (value: number | null | undefined) => {
  const safeValue = typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
  return `${safeValue.toLocaleString('es-AR', { maximumFractionDigits: 2 })}%`;
};

const formatSurveyPointLabel = (point: SurveyHeatmapPoint, index: number) =>
  point.categoria || point.canal || `Zona ${index + 1}`;

const buildSurveyTerritoryNodes = (points: SurveyHeatmapPoint[]): SurveyTerritoryNode[] => {
  const numericPoints = points
    .map((point, index) => ({
      point,
      index,
      lat: Number(point.lat),
      lng: Number(point.lng),
      weight: Math.max(1, Number(point.respuestas || 1)),
    }))
    .filter(({ lat, lng }) => Number.isFinite(lat) && Number.isFinite(lng))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 18);

  if (!numericPoints.length) return [];

  const lats = numericPoints.map((item) => item.lat);
  const lngs = numericPoints.map((item) => item.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = Math.max(0.0001, maxLat - minLat);
  const lngSpan = Math.max(0.0001, maxLng - minLng);

  return numericPoints.map(({ point, index, lat, lng, weight }) => ({
    id: `${lat.toFixed(5)}:${lng.toFixed(5)}:${index}`,
    x: 62 + ((lng - minLng) / lngSpan) * (SURVEY_TERRITORY_WIDTH - 124),
    y: 54 + (1 - (lat - minLat) / latSpan) * (SURVEY_TERRITORY_HEIGHT - 108),
    weight,
    label: formatSurveyPointLabel(point, index),
    channel: point.canal,
  }));
};

const buildSurveyTerritoryRoute = (nodes: SurveyTerritoryNode[]) => {
  const routeNodes = nodes.slice(0, 5);
  if (routeNodes.length < 2) return '';
  const [first, ...rest] = routeNodes;
  return rest.reduce((path, node, index) => {
    const previous = routeNodes[index];
    const controlX = (previous.x + node.x) / 2;
    const controlY = Math.min(previous.y, node.y) - 40 - index * 8;
    return `${path} Q ${controlX.toFixed(1)} ${controlY.toFixed(1)} ${node.x.toFixed(1)} ${node.y.toFixed(1)}`;
  }, `M ${first.x.toFixed(1)} ${first.y.toFixed(1)}`);
};

const resolveSurveyTerritoryReadiness = (
  usingSyntheticPoints: boolean,
  mapRenderReady: boolean,
  pointCount: number,
): SurveyTerritoryReadiness => {
  if (usingSyntheticPoints) {
    return {
      label: 'Fallback sintético',
      detail: 'El backend marcó datos demo o sintéticos. No se presentan como precisión territorial real.',
      toneClass: 'border-amber-300/35 bg-amber-300/10 text-amber-50',
      icon: ShieldCheck,
    };
  }
  if (!mapRenderReady) {
    return {
      label: 'Contrato pendiente',
      detail: 'La respuesta trae geometría, pero el contrato todavía no está listo para render operativo.',
      toneClass: 'border-violet-300/35 bg-violet-300/10 text-violet-50',
      icon: Layers,
    };
  }
  if (pointCount > 0) {
    return {
      label: 'Evidencia territorial activa',
      detail: 'Usando coordenadas con contención verificada y capas enlazadas al snapshot oficial.',
      toneClass: 'border-emerald-300/35 bg-emerald-300/10 text-emerald-50',
      icon: ShieldCheck,
    };
  }
  return {
    label: 'Sin geometría',
    detail: 'Hay que capturar ubicación, barrio o coordenadas para activar la lectura territorial.',
    toneClass: 'border-rose-300/35 bg-rose-300/10 text-rose-50',
    icon: MapPin,
  };
};

function SurveyTerritoryCommandCenter({
  points,
  geoIntensity,
  geoCoverageLabel,
  totalResponses,
  provider,
  providerHint,
  fallbackProvider,
  usingSyntheticPoints,
  mapRenderReady,
  boundingBoxValue,
  channelBreakdown,
  categoryLayerCount,
  evidenceGate,
}: {
  points: SurveyHeatmapPoint[];
  geoIntensity: SurveyGeoIntensity;
  geoCoverageLabel: string;
  totalResponses: number | null;
  provider: MapProvider;
  providerHint: MapProvider | null;
  fallbackProvider: MapProvider;
  usingSyntheticPoints: boolean;
  mapRenderReady: boolean;
  boundingBoxValue?: string;
  channelBreakdown: ChannelBreakdownItem[];
  categoryLayerCount: number;
  evidenceGate: SurveyTerritoryEvidenceGate;
}) {
  const shouldReduceMotion = useReducedMotion();
  const reactId = useId().replace(/:/g, '');
  const gridId = `${reactId}-survey-grid`;
  const heatGradientId = `${reactId}-survey-heat`;
  const routeGradientId = `${reactId}-survey-route`;
  const nodes = useMemo(() => buildSurveyTerritoryNodes(points), [points]);
  const routePath = useMemo(() => buildSurveyTerritoryRoute(nodes), [nodes]);
  const readiness = useMemo(
    () => resolveSurveyTerritoryReadiness(usingSyntheticPoints, mapRenderReady, points.length),
    [mapRenderReady, points.length, usingSyntheticPoints],
  );
  const ReadinessIcon = readiness.icon;
  const focusNode = nodes[0];
  const primaryHotspot = geoIntensity.hotspots[0];
  const topChannel = channelBreakdown[0];
  const categoryCount =
    categoryLayerCount || new Set(points.map((point) => point.categoria).filter(Boolean)).size;
  const activeSignal = usingSyntheticPoints
    ? 'demo/fallback'
    : mapRenderReady && points.length
      ? 'contención verificada'
      : 'pendiente geo';

  if (!points.length) {
    const hasResponses = typeof totalResponses === 'number' && totalResponses > 0;
    return (
      <Card
        className="border-border/70 bg-card shadow-sm"
        data-testid="survey-territory-command-center"
      >
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-xl">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                Cobertura territorial pendiente
              </CardTitle>
              <CardDescription>
                {!evidenceGate.ready
                  ? evidenceGate.detail
                  : hasResponses
                  ? 'Hay respuestas registradas, pero ninguna tiene ubicación utilizable para construir un mapa real.'
                  : 'El mapa se habilitará cuando ingresen respuestas con ubicación consentida.'}
              </CardDescription>
            </div>
            <Badge variant="outline">0 registros georreferenciados</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {evidenceGate.ready ? (
            <>
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Respuestas</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{formatSurveyNumber(totalResponses)}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Cobertura geográfica</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">0%</p>
              </div>
            </>
          ) : null}
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3 sm:col-span-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Próximo control</p>
            <p className="mt-1 text-sm font-medium">
              {!evidenceGate.ready ? evidenceGate.nextAction : 'Capturar barrio o coordenadas con consentimiento'}
            </p>
          </div>
          <p className="text-sm text-muted-foreground sm:col-span-3">
            No se generan puntos, zonas ni focos artificiales. Revisá el formulario y los canales de ingreso para solicitar ubicación de forma opcional y trazable.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className="overflow-hidden border-slate-700/60 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.24),transparent_28%),linear-gradient(135deg,#06111f,#111827_48%,#1f2937)] text-slate-100 shadow-xl"
      data-testid="survey-territory-command-center"
    >
      <CardHeader className="border-b border-white/10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100">
              <Radar className="h-3.5 w-3.5" />
              Centro territorial
            </div>
            <div>
              <CardTitle className="text-2xl text-white">Mapa vivo de participación</CardTitle>
              <CardDescription className="text-slate-300">
                Lectura ejecutiva de cobertura, focos y calidad geográfica antes de abrir el mapa interactivo.
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${readiness.toneClass}`}>
              <ReadinessIcon className="h-3.5 w-3.5" />
              {readiness.label}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1 text-slate-200">
              <Radio className="h-3.5 w-3.5 text-cyan-200" />
              {providerLabel(provider)}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5 p-4 lg:grid-cols-[1.25fr_0.9fr]">
        <div className="relative min-h-[340px] overflow-hidden rounded-xl border border-white/10 bg-slate-950/50">
          <div className="absolute left-4 top-4 z-10 rounded-lg border border-white/10 bg-slate-950/82 px-3 py-2 text-xs shadow-lg backdrop-blur">
            <p className="font-semibold text-white">Radar de encuesta</p>
            <p className="text-slate-400">{nodes.length ? `${nodes.length} nodos activos` : 'Esperando coordenadas'}</p>
          </div>
          <svg
            className="h-full min-h-[340px] w-full"
            viewBox={`0 0 ${SURVEY_TERRITORY_WIDTH} ${SURVEY_TERRITORY_HEIGHT}`}
            preserveAspectRatio="none"
            data-testid="survey-territory-telemetry"
            aria-hidden="true"
          >
            <defs>
              <pattern id={gridId} width="38" height="38" patternUnits="userSpaceOnUse">
                <path d="M 38 0 L 0 0 0 38" fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth="1" />
              </pattern>
              <radialGradient id={heatGradientId} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(251,191,36,0.62)" />
                <stop offset="45%" stopColor="rgba(34,211,238,0.24)" />
                <stop offset="100%" stopColor="rgba(15,23,42,0)" />
              </radialGradient>
              <linearGradient id={routeGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#22d3ee" />
                <stop offset="52%" stopColor="#a78bfa" />
                <stop offset="100%" stopColor="#fbbf24" />
              </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill={`url(#${gridId})`} />
            <rect width="100%" height="100%" fill="rgba(2,6,23,0.18)" />
            {focusNode ? (
              <g transform={`translate(${focusNode.x} ${focusNode.y})`}>
                <circle r="112" fill={`url(#${heatGradientId})`} opacity="0.72" />
                <circle r="42" fill="none" stroke="rgba(34,211,238,0.46)" strokeWidth="1.4">
                  {!shouldReduceMotion ? (
                    <>
                      <animate attributeName="r" values="42;94;42" dur="5s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.78;0.12;0.78" dur="5s" repeatCount="indefinite" />
                    </>
                  ) : null}
                </circle>
                <g opacity="0.66">
                  <line x1="-96" x2="96" y1="0" y2="0" stroke="rgba(125,211,252,0.58)" strokeWidth="1" />
                  <line x1="0" x2="0" y1="-96" y2="96" stroke="rgba(125,211,252,0.58)" strokeWidth="1" />
                  {!shouldReduceMotion ? (
                    <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="13s" repeatCount="indefinite" />
                  ) : null}
                </g>
              </g>
            ) : null}
            {routePath ? (
              <g>
                <path
                  id={`${reactId}-survey-route-path`}
                  d={routePath}
                  fill="none"
                  stroke={`url(#${routeGradientId})`}
                  strokeDasharray="9 11"
                  strokeLinecap="round"
                  strokeWidth="2.2"
                  opacity="0.78"
                />
                {!shouldReduceMotion ? (
                  <circle r="5" fill="#fbbf24">
                    <animateMotion dur="7.5s" repeatCount="indefinite" rotate="auto">
                      <mpath href={`#${reactId}-survey-route-path`} />
                    </animateMotion>
                  </circle>
                ) : null}
              </g>
            ) : null}
            {nodes.map((node, index) => {
              const radius = Math.max(6, Math.min(18, 5 + node.weight * 1.3));
              return (
                <g key={node.id} transform={`translate(${node.x} ${node.y})`}>
                  <circle r={radius + 10} fill="rgba(34,211,238,0.08)" />
                  <circle r={radius} fill={index === 0 ? '#fbbf24' : '#38bdf8'} opacity="0.88" />
                  <circle r={radius + 5} fill="none" stroke="rgba(255,255,255,0.26)" strokeWidth="1">
                    {!shouldReduceMotion ? (
                      <>
                        <animate attributeName="r" values={`${radius + 5};${radius + 18};${radius + 5}`} dur={`${4 + index * 0.35}s`} repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.65;0.06;0.65" dur={`${4 + index * 0.35}s`} repeatCount="indefinite" />
                      </>
                    ) : null}
                  </circle>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.05] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Estado operativo</p>
                <p className="mt-2 text-lg font-semibold text-white">{readiness.label}</p>
              </div>
              <Target className="h-5 w-5 text-amber-200" />
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">{readiness.detail}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.05] p-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Cobertura</p>
              <p className="mt-2 text-2xl font-semibold text-white">{geoCoverageLabel}</p>
              <p className="text-xs text-slate-400">{formatSurveyNumber(totalResponses)} respuestas totales</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.05] p-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Hotspots</p>
              <p className="mt-2 text-2xl font-semibold text-white">{geoIntensity.hotspots.length}</p>
              <p className="text-xs text-slate-400">{geoIntensity.maxWeight || '--'} pico por zona</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.05] p-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Capas</p>
              <p className="mt-2 text-2xl font-semibold text-white">{categoryCount || '--'}</p>
              <p className="text-xs text-slate-400">categorias territoriales</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.05] p-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Señal</p>
              <p className="mt-2 text-lg font-semibold text-white">{activeSignal}</p>
              <p className="text-xs text-slate-400">{boundingBoxValue ? 'zona filtrada' : 'vista completa'}</p>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.05] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Playbook</p>
              <Activity className="h-4 w-4 text-emerald-200" />
            </div>
            <div className="mt-3 space-y-2 text-sm text-slate-300">
              <p>
                Foco: {primaryHotspot ? `${formatSurveyPointLabel(primaryHotspot, 0)} con ${primaryHotspot.respuestas} respuestas` : 'sin zona dominante'}.
              </p>
              <p>
                Canal fuerte: {topChannel ? `${topChannel.canal} (${topChannel.respuestas})` : 'sin canal dominante'}.
              </p>
              <p className="text-xs text-slate-400">
                Preferido: {providerLabel(providerHint)}. Fallback: {providerLabel(fallbackProvider)}.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


export const SurveyAnalytics = ({
  summary,
  timeseries,
  heatmap,
  heatmapPayload,
  heatmapMeta,
  provenance,
  onExport,
  isExporting,
  filters,
  onFiltersChange,
  tenantSlug,
  tenantId,
  route = '/admin/encuestas/:id/analytics',
}: SurveyAnalyticsProps) => {
  const timeseriesData = useMemo(() => buildTimeseriesData(timeseries), [timeseries]);
  const summaryRecord = useMemo(
    () => (summary && typeof summary === 'object' ? (summary as unknown as Record<string, unknown>) : null),
    [summary],
  );
  const optionData = useMemo(() => buildOptionBreakdown(summary, summaryRecord), [summary, summaryRecord]);
  const hasEligibilityMetrics = optionData.some((item) => item.usaBaseElegible);
  const hasMultipleChoiceRates = optionData.some(
    (item) => item.usaBaseElegible && item.esSeleccionMultiple,
  );
  const hasRowsWithoutEligibleBase = optionData.some(
    (item) => !item.usaBaseElegible,
  );
  const heatmapPayloadRecord = useMemo(
    () => (heatmapPayload && typeof heatmapPayload === 'object' ? (heatmapPayload as Record<string, unknown>) : null),
    [heatmapPayload],
  );
  const heatmapPointsInput = useMemo(
    () => (heatmap && heatmap.length ? heatmap : heatmapPayload?.points),
    [heatmap, heatmapPayload?.points],
  );
  const heatmapPoints = useMemo(() => normalizeHeatmapPoints(heatmapPointsInput), [heatmapPointsInput]);
  const aggregatedHeatmapPoints = useMemo(() => {
    if (!heatmapPoints.length) return [] as Array<SurveyHeatmapPoint & { categoria?: string; canal?: string }>;

    const grouped = new Map<string, SurveyHeatmapPoint & { categoria?: string; canal?: string }>();
    heatmapPoints.forEach((point) => {
      const lat = Number(point.lat.toFixed(4));
      const lng = Number(point.lng.toFixed(4));
      const key = `${lat}:${lng}`;
      const previous = grouped.get(key);

      if (!previous) {
        grouped.set(key, { lat, lng, respuestas: Math.max(0, point.respuestas ?? 0), categoria: point.categoria, canal: point.canal });
        return;
      }

      grouped.set(key, {
        lat,
        lng,
        respuestas: Math.max(0, previous.respuestas ?? 0) + Math.max(0, point.respuestas ?? 0),
        categoria: previous.categoria || point.categoria,
        canal: previous.canal || point.canal,
      });
    });

    return Array.from(grouped.values());
  }, [heatmapPoints]);
  const heatmapMetaRecord = useMemo(() => {
    const payloadMetadata = isRecord(heatmapPayloadRecord?.metadata)
      ? (heatmapPayloadRecord.metadata as Record<string, unknown>)
      : {};
    const explicitMetadata = isRecord(heatmapMeta) ? (heatmapMeta as Record<string, unknown>) : {};
    const topLevelMetadata = HEATMAP_METADATA_KEYS.reduce<Record<string, unknown>>((accumulator, key) => {
      const value = heatmapPayloadRecord?.[key];
      if (value !== undefined) accumulator[key] = value;
      return accumulator;
    }, {});
    const merged = { ...topLevelMetadata, ...payloadMetadata, ...explicitMetadata };
    return Object.keys(merged).length ? merged : null;
  }, [heatmapMeta, heatmapPayloadRecord]);
  const categoryLayersRecord = useMemo(() => {
    const direct = heatmapMetaRecord?.category_layers;
    if (isRecord(direct)) return direct;
    const nestedMetadata = heatmapMetaRecord?.metadata;
    if (isRecord(nestedMetadata) && isRecord(nestedMetadata.category_layers)) return nestedMetadata.category_layers;
    return null;
  }, [heatmapMetaRecord]);
  const categoryLayerCategories = useMemo(
    () => getArray<Record<string, unknown>>(categoryLayersRecord?.categories),
    [categoryLayersRecord],
  );
  const categoryLayerSource = useMemo(
    () => (isFeatureCollection(categoryLayersRecord?.source) ? categoryLayersRecord.source : null),
    [categoryLayersRecord],
  );
  const territoryEvidencePoints = useMemo(() => {
    const direct = getArray(heatmapPointsInput);
    if (direct.length) return direct;
    return getArray<Record<string, unknown>>(categoryLayersRecord?.categories)
      .flatMap((category) => getArray(category.points));
  }, [categoryLayersRecord, heatmapPointsInput]);
  const mapMetaRecord = useMemo(() => {
    const mapValue = heatmapMetaRecord?.map;
    return mapValue && typeof mapValue === 'object' ? (mapValue as Record<string, unknown>) : null;
  }, [heatmapMetaRecord]);
  const renderContractRecord = useMemo(() => {
    const contractValue = heatmapMetaRecord?.render_contract;
    return contractValue && typeof contractValue === 'object' ? (contractValue as Record<string, unknown>) : null;
  }, [heatmapMetaRecord]);
  const usingSyntheticPoints = useMemo(
    () =>
      Boolean(
        heatmapMetaRecord?.using_synthetic_points ||
          (typeof renderContractRecord?.state === 'string' && renderContractRecord.state === 'demo_fallback'),
      ),
    [heatmapMetaRecord, renderContractRecord],
  );
  const territoryEvidenceGate = useMemo(
    () => resolveSurveyTerritoryEvidenceGate(heatmapMetaRecord, territoryEvidencePoints),
    [heatmapMetaRecord, territoryEvidencePoints],
  );
  const mapRenderReady = useMemo(() => {
    if (usingSyntheticPoints) return false;
    if (!territoryEvidenceGate.ready) return false;
    return mapMetaRecord?.render_ready === true;
  }, [mapMetaRecord, territoryEvidenceGate.ready, usingSyntheticPoints]);
  const authorizedTerritoryPoints = useMemo(
    () => (mapRenderReady ? aggregatedHeatmapPoints : []),
    [aggregatedHeatmapPoints, mapRenderReady],
  );
  const providerHint = useMemo(() => normalizeMapProvider(mapMetaRecord?.provider_hint), [mapMetaRecord]);
  const fallbackProvider = useMemo(
    () => normalizeMapProvider(mapMetaRecord?.fallback_provider) ?? 'maplibre',
    [mapMetaRecord],
  );
  const availableProviders = useMemo(
    () => toStringList(mapMetaRecord?.available_providers).map((item) => normalizeMapProvider(item)).filter(Boolean) as MapProvider[],
    [mapMetaRecord],
  );

  const categoryColorMap = useMemo(() => {
    const backendPairs = categoryLayerCategories
      .map((category, index) => {
        const name = toNonEmptyString(category.categoria ?? category.category ?? category.label);
        const color = toNonEmptyString(category.color) ?? colorFromCategory(name ?? '', index);
        return name ? ([name, color] as const) : null;
      })
      .filter((pair): pair is readonly [string, string] => Boolean(pair));
    const map = new Map<string, string>(backendPairs);
    const categories = Array.from(new Set(authorizedTerritoryPoints.map((point) => point.categoria).filter(Boolean) as string[]));
    categories.forEach((category, index) => {
      if (!map.has(category)) map.set(category, colorFromCategory(category, index));
    });
    return map;
  }, [authorizedTerritoryPoints, categoryLayerCategories]);

  const heatmapData = useMemo(() => {
    if (usingSyntheticPoints) return [];
    const sourcePoints = authorizedTerritoryPoints.length ? authorizedTerritoryPoints : [];
    const allZero = sourcePoints.length > 0 && sourcePoints.every((point) => point.respuestas <= 0);
    return sourcePoints.map((point) => ({
      lat: point.lat,
      lng: point.lng,
      weight: allZero ? Math.max(1, point.respuestas || 0) : point.respuestas,
      categoria: point.categoria,
      canal: point.canal,
      categoryColor: point.categoria ? categoryColorMap.get(point.categoria) : undefined,
    }));
  }, [authorizedTerritoryPoints, categoryColorMap, usingSyntheticPoints]);
  const { provider, setProvider } = useMapProvider();
  const hasGoogleKey = useMemo(() => ((import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '').trim().length > 0), []);
  const providerIsConfigured = useCallback(
    (candidate: MapProvider) => {
      if (availableProviders.length > 0 && !availableProviders.includes(candidate)) return false;
      if (candidate === 'google') return hasGoogleKey;
      return true;
    },
    [availableProviders, hasGoogleKey],
  );
  const googleProviderAvailable = providerIsConfigured('google');
  const normalizedFilters: SurveyAnalyticsFilters = filters ?? {};
  const boundingBoxValue = useMemo(() => {
    const bbox = normalizedFilters.bbox;
    if (!bbox) return undefined;
    if (typeof bbox === 'string') {
      return bbox;
    }
    if (Array.isArray(bbox) && bbox.length === 4 && bbox.every((value) => Number.isFinite(value))) {
      return bbox.map((value) => Number(value).toFixed(6)).join(',');
    }
    return undefined;
  }, [normalizedFilters]);

  useEffect(() => {
    if (!providerIsConfigured(provider)) {
      setProvider(fallbackProvider);
      return;
    }

    if (providerHint && providerHint !== provider && providerIsConfigured(providerHint)) {
      setProvider(providerHint);
    }
  }, [fallbackProvider, provider, providerHint, providerIsConfigured, setProvider]);

  const handleProviderUnavailable = useCallback(
    (currentProvider: MapProvider, reason: MapProviderUnavailableReason, details?: unknown) => {
      console.warn('[SurveyAnalytics] Map provider unavailable, falling back to MapLibre', {
        provider: currentProvider,
        reason,
        details,
      });
      setProvider(fallbackProvider);
    },
    [fallbackProvider, setProvider],
  );
  const skipNextBoundingUpdateRef = useRef(false);
  const boundingBoxDebounceRef = useRef<number | null>(null);
  const handleBoundingBoxChange = useCallback(
    (bbox: [number, number, number, number] | null) => {
      if (!onFiltersChange) return;
      if (skipNextBoundingUpdateRef.current) {
        skipNextBoundingUpdateRef.current = false;
        return;
      }

      if (boundingBoxDebounceRef.current !== null) {
        window.clearTimeout(boundingBoxDebounceRef.current);
      }

      boundingBoxDebounceRef.current = window.setTimeout(() => {
        const current = filters ?? {};
        if (!bbox) {
          if (!boundingBoxValue) return;
          const nextFilters = { ...current };
          delete nextFilters.bbox;
          onFiltersChange(nextFilters);
          return;
        }

        if (bbox.length !== 4 || bbox.some((value) => !Number.isFinite(value))) {
          return;
        }

        const formatted = bbox.map((value) => Number(value).toFixed(6)).join(',');
        if (formatted === boundingBoxValue) {
          return;
        }

        onFiltersChange({ ...current, bbox: formatted });
      }, 350);
    },
    [filters, onFiltersChange, boundingBoxValue, skipNextBoundingUpdateRef],
  );
  const handleClearBoundingBox = useCallback(() => {
    if (!onFiltersChange || !boundingBoxValue) return;
    const current = filters ?? {};
    const nextFilters = { ...current };
    delete nextFilters.bbox;
    skipNextBoundingUpdateRef.current = true;
    onFiltersChange(nextFilters);
  }, [filters, onFiltersChange, boundingBoxValue, skipNextBoundingUpdateRef]);

  useEffect(() => {
    return () => {
      if (boundingBoxDebounceRef.current !== null) {
        window.clearTimeout(boundingBoxDebounceRef.current);
      }
    };
  }, []);
  const heatmapCenter = useMemo(() => {
    if (!heatmapData.length) return undefined;
    const totalWeight = heatmapData.reduce((sum, point) => sum + (point.weight ?? 1), 0);
    const divisor = totalWeight > 0 ? totalWeight : heatmapData.length;
    const avgLat = heatmapData.reduce((sum, point) => sum + point.lat * (point.weight ?? 1), 0) / divisor;
    const avgLng = heatmapData.reduce((sum, point) => sum + point.lng * (point.weight ?? 1), 0) / divisor;
    if (!Number.isFinite(avgLat) || !Number.isFinite(avgLng)) {
      return undefined;
    }
    return [avgLng, avgLat] as [number, number];
  }, [heatmapData]);
  const heatmapBounds = useMemo(
    () =>
      heatmapData
        .map((point) => [point.lng, point.lat] as [number, number])
        .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat)),
    [heatmapData],
  );
  const surveyMapEvidence = useMemo(
    () => ({
      metadata: heatmapMetaRecord ?? undefined,
      source: toNonEmptyString(heatmapMetaRecord?.source ?? heatmapMetaRecord?.fuente) ?? 'survey_heatmap',
      provider,
      requestId: toNonEmptyString(heatmapMetaRecord?.request_id),
      contractVersion: toNonEmptyString(
        categoryLayersRecord?.contract_version ??
          heatmapMetaRecord?.contract_version ??
          renderContractRecord?.contract_version,
      ),
      usingSyntheticPoints,
      pointCount: heatmapData.length,
      featureCount: categoryLayerSource?.features?.length ?? 0,
      coveragePct:
        toFiniteNumber(mapMetaRecord?.coverage_pct ?? mapMetaRecord?.coverage ?? heatmapMetaRecord?.coverage_pct) ??
        undefined,
    }),
    [
      categoryLayerSource?.features?.length,
      categoryLayersRecord?.contract_version,
      heatmapData.length,
      heatmapMetaRecord,
      mapMetaRecord,
      provider,
      renderContractRecord,
      usingSyntheticPoints,
    ],
  );
  const totalResponsesValue = useMemo(
    () =>
      extractNumberFromRecord(summaryRecord, [
        'total_respuestas',
        'totalResponses',
        'total_responses',
        'total',
        'responses',
        ['totals', 'responses'],
        ['totals', 'total'],
        ['overview', 'responses'],
        ['overview', 'total'],
      ]),
    [summaryRecord],
  );

  const uniqueParticipantsValue = useMemo(
    () =>
      extractNumberFromRecord(summaryRecord, [
        'participantes_unicos',
        'participantesUnicos',
        'unique_participants',
        'uniqueParticipants',
        'participantsUnique',
        'uniqueRespondents',
        ['totals', 'participants'],
        ['totals', 'unique'],
        ['overview', 'participants'],
      ]),
    [summaryRecord],
  );

  const completionRateValue = useMemo(
    () =>
      extractNumberFromRecord(summaryRecord, [
        'tasa_completitud',
        'tasaCompletitud',
        'completion_rate',
        'completionRate',
        'completion',
        'completionPercentage',
        ['totals', 'completionRate'],
        ['totals', 'completion'],
      ]),
    [summaryRecord],
  );

  const channelBreakdown = useMemo(() => {
    const candidates = summaryRecord
      ? [
          summaryRecord['canales'],
          summaryRecord['channels'],
          summaryRecord['channelBreakdown'],
          summaryRecord['channelsBreakdown'],
          summaryRecord['porCanal'],
          summaryRecord['por_canal'],
          getNestedValue(summaryRecord, ['totals', 'channels']),
        ]
      : [];

    candidates.push(summary?.canales);

    for (const candidate of candidates) {
      const normalized = normalizeChannelBreakdown(candidate);
      if (normalized.length) {
        return normalized;
      }
    }

    return [];
  }, [summary, summaryRecord]);

  const utmBreakdown = useMemo(() => {
    const candidates = summaryRecord
      ? [
          summaryRecord['utms'],
          summaryRecord['utm'],
          summaryRecord['utmBreakdown'],
          summaryRecord['porUtm'],
          summaryRecord['por_utm'],
          summaryRecord['campaigns'],
          summaryRecord['campaignBreakdown'],
          getNestedValue(summaryRecord, ['totals', 'utms']),
        ]
      : [];

    candidates.push(summary?.utms);

    for (const candidate of candidates) {
      const normalized = normalizeUtmBreakdown(candidate);
      if (normalized.length) {
        return normalized;
      }
    }

    return [];
  }, [summary, summaryRecord]);

  const completionRateLabel = useMemo(() => {
    if (completionRateValue === null) {
      return '—';
    }

    let normalized = completionRateValue;

    if (!Number.isFinite(normalized)) {
      return '—';
    }

    if (normalized > 1 && normalized <= 100) {
      normalized /= 100;
    }

    if (normalized > 100) {
      normalized = 1;
    }

    if (normalized < 0) {
      normalized = 0;
    }

    return `${(normalized * 100).toFixed(1)}%`;
  }, [completionRateValue]);


  const geoIntensity = useMemo(() => {
    if (!authorizedTerritoryPoints.length) return { totalWeight: 0, maxWeight: 0, avgWeight: 0, hotspots: [] as SurveyHeatmapPoint[] };
    const sorted = [...authorizedTerritoryPoints].sort((a, b) => b.respuestas - a.respuestas);
    const totalWeight = sorted.reduce((acc, point) => acc + (point.respuestas || 0), 0);
    const maxWeight = sorted[0]?.respuestas ?? 0;
    const avgWeight = totalWeight / sorted.length;
    return {
      totalWeight,
      maxWeight,
      avgWeight,
      hotspots: sorted.slice(0, 5),
    };
  }, [authorizedTerritoryPoints]);

  const geoCoverageLabel = useMemo(() => {
    if (!authorizedTerritoryPoints.length) return '—';
    const backendCoverage = toFiniteNumber(
      mapMetaRecord?.coverage_pct ?? mapMetaRecord?.coverage_percent ?? mapMetaRecord?.coverage,
    );
    if (backendCoverage !== null) {
      const normalizedCoverage = backendCoverage > 0 && backendCoverage <= 1 ? backendCoverage * 100 : backendCoverage;
      return `${Math.max(0, Math.min(100, normalizedCoverage)).toFixed(1)}%`;
    }
    if (!totalResponsesValue || totalResponsesValue <= 0) return `${authorizedTerritoryPoints.length} zonas`;
    const ratio = Math.min(1, geoIntensity.totalWeight / totalResponsesValue);
    return `${(ratio * 100).toFixed(1)}%`;
  }, [authorizedTerritoryPoints.length, geoIntensity.totalWeight, mapMetaRecord, totalResponsesValue]);

  const demographicSections = useMemo(() => {
    const candidates = summaryRecord
      ? [
          summaryRecord['demografia'],
          summaryRecord['demographics'],
          summaryRecord['demographicBreakdown'],
          summaryRecord['demografia_resumen'],
        ]
      : [];

    let demographics: Record<string, unknown> | null = null;
    for (const candidate of candidates) {
      if (isRecord(candidate) && Object.keys(candidate).length) {
        demographics = candidate;
        break;
      }
    }

    if (!demographics) {
      return [] as Array<{
        id: string;
        title: string;
        data: ReturnType<typeof buildDemographicData>;
      }>;
    }

    return Object.entries(demographics)
      .map(([id, items]) => {
        const normalizedItems = getArrayOrObjectValues<SurveyDemographicBreakdownItem>(items);
        if (!normalizedItems.length) return null;
        const data = buildDemographicData(normalizedItems);
        if (!data.length) return null;
        return {
          id,
          title: normalizeDemographicLabel(id),
          data,
        };
      })
      .filter((section): section is { id: string; title: string; data: ReturnType<typeof buildDemographicData> } => Boolean(section));
  }, [summaryRecord]);

  useEffect(() => {
    const event = heatmapData.length > 0 ? 'analytics_heatmap_rendered' : 'analytics_heatmap_empty';
    const payload = {
      tenant_slug: tenantSlug || null,
      route,
      build_version: import.meta.env.VITE_APP_VERSION || 'dev',
      point_count: heatmapData.length,
      error_code: heatmapData.length > 0 ? null : 'empty_dataset',
    };

    void enterpriseService.trackEvent({ event, tenant_id: tenantId, payload }, tenantSlug).catch(() => undefined);
  }, [heatmapData.length, route, tenantId, tenantSlug]);

  return (
    <div className="space-y-6">
      {provenance?.synthetic ? (
        <div
          role="status"
          data-testid="survey-analytics-synthetic-notice"
          className="flex items-start gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Datos sinteticos de demostracion - no son respuestas reales.</p>
            <p className="mt-1 text-xs">
              Modulos afectados: {provenance.affected_modules.join(', ')}. Este fallback solo esta habilitado en desarrollo o pruebas.
            </p>
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Analítica de participación</h2>
          <p className="text-sm text-muted-foreground">Seguimiento de respuestas, canales y preferencias de la comunidad.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <SurveyResponseProvenanceBadge sources={[summary, heatmapPayload]} />
          <Button onClick={onExport} disabled={isExporting}>
            {isExporting ? 'Generando CSV…' : 'Exportar CSV'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total de respuestas</CardTitle>
            <CardDescription>Incluye formularios completos recibidos.</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {totalResponsesValue ?? '—'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Participantes únicos</CardTitle>
            <CardDescription>Personas distintas, según la política de unicidad.</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {uniqueParticipantsValue ?? '—'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tasa de completitud</CardTitle>
            <CardDescription>Porcentaje de formularios finalizados.</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {completionRateLabel}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Evolución diaria</CardTitle>
          <CardDescription>Visualizá el ritmo de participación a lo largo del tiempo.</CardDescription>
        </CardHeader>
        <CardContent><MeasuredContainer className="h-72 min-w-0">
          {timeseriesData.length ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={220}>
              <LineChart data={timeseriesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="fecha" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="respuestas"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot
                  isAnimationActive
                  animationDuration={CHART_ANIMATION_DURATION}
                  animationEasing={CHART_ANIMATION_EASING}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Aún no hay datos de series temporales.
            </div>
          )}
        </MeasuredContainer></CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferencias por opción</CardTitle>
          <CardDescription>
            {hasEligibilityMetrics
              ? 'Tasas independientes por pregunta y opción, calculadas sobre participantes elegibles.'
              : 'Resultados acumulados por pregunta y opción.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <MeasuredContainer className="h-72 min-w-0">
            {optionData.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={220}>
                <BarChart data={optionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="opcion" interval={0} angle={-25} textAnchor="end" height={90} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey={hasEligibilityMetrics ? 'respuestasSeleccionaron' : 'respuestas'}
                    fill="#7c3aed"
                    isAnimationActive
                    animationDuration={CHART_ANIMATION_DURATION}
                    animationEasing={CHART_ANIMATION_EASING}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No hay respuestas registradas para mostrar.
              </div>
            )}
          </MeasuredContainer>
          {optionData.length && hasEligibilityMetrics ? (
            <div
              className="h-72 min-w-0 overflow-auto rounded-lg border"
              data-testid="survey-eligible-option-rates"
            >
              <p
                id="survey-eligible-option-rates-description"
                className="border-b bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
              >
                {hasMultipleChoiceRates
                  ? 'Cada porcentaje es una tasa de selección independiente. En selección múltiple pueden sumar más de 100%.'
                  : hasRowsWithoutEligibleBase
                    ? 'Las filas sin base elegible informada se muestran explícitamente con su porcentaje legacy.'
                    : 'Cada porcentaje usa la base elegible de su propia pregunta.'}
              </p>
              <table
                className="w-full min-w-[640px] text-left text-sm"
                aria-describedby="survey-eligible-option-rates-description"
              >
                <caption className="sr-only">
                  Tasas por pregunta y opción con sus denominadores
                </caption>
                <thead className="border-b bg-muted/20 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3" scope="col">Pregunta</th>
                    <th className="px-4 py-3" scope="col">Opción</th>
                    <th className="px-4 py-3 text-right" scope="col">Selecciones</th>
                    <th className="px-4 py-3 text-right" scope="col">Tasa por opción</th>
                    <th className="px-4 py-3" scope="col">Base</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {optionData.map((entry, index) => (
                    <tr key={`${entry.pregunta}-${entry.opcion}-${index}`}>
                      <th className="px-4 py-3 font-medium" scope="row">
                        {entry.pregunta}
                      </th>
                      <td className="px-4 py-3">{entry.opcion}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatSurveyNumber(entry.respuestasSeleccionaron)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {formatSurveyPercentage(entry.participacion)}
                        <span className="block text-xs font-normal text-muted-foreground">
                          {entry.baseParticipacion === 'elegibles'
                            ? 'sobre elegibles'
                            : entry.baseParticipacion === 'respuestas_pregunta'
                              ? 'sobre respuestas de la pregunta'
                              : entry.baseParticipacion === 'total_encuesta'
                                ? 'sobre total de encuesta'
                                : 'porcentaje legacy'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {!entry.usaBaseElegible
                          ? 'Base elegible no informada'
                          : entry.respuestasElegibles !== undefined
                            ? `${formatSurveyNumber(entry.respuestasElegibles)} elegibles`
                            : entry.baseParticipacion === 'respuestas_pregunta'
                              ? 'Base: respuestas de la pregunta'
                              : 'Base elegible parcial'}
                        {entry.respuestasRespondidas !== undefined ? (
                          <span className="block text-xs">
                            {formatSurveyNumber(entry.respuestasRespondidas)} respondieron
                            {entry.tasaRespuestaElegible !== undefined
                              ? ` · ${formatSurveyPercentage(entry.tasaRespuestaElegible)}`
                              : ''}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <MeasuredContainer className="h-72 min-w-0">
              {optionData.length ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={220}>
                  <PieChart>
                    <Pie
                      data={optionData}
                      dataKey="porcentaje"
                      nameKey="opcion"
                      cx="50%"
                      cy="50%"
                      outerRadius={110}
                      innerRadius={60}
                      isAnimationActive
                      animationDuration={CHART_ANIMATION_DURATION}
                      animationEasing={CHART_ANIMATION_EASING}
                    >
                      {optionData.map((entry, index) => (
                        <Cell key={`${entry.opcion}-${index}`} fill={palette[index % palette.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Sin datos para graficar.
                </div>
              )}
            </MeasuredContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Canales y campañas</CardTitle>
          <CardDescription>Analizá desde dónde llegan las respuestas.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Por canal</h3>
            <Separator className="my-2" />
            <ul className="space-y-2 text-sm">
              {channelBreakdown.map((item, index) => (
                <li key={`${item.canal}-${index}`} className="flex items-center justify-between">
                  <span className="font-medium capitalize">{item.canal}</span>
                  <span>{item.respuestas}</span>
                </li>
              ))}
              {!channelBreakdown.length && (
                <li className="text-muted-foreground">Sin datos de canales todavía.</li>
              )}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Por UTM</h3>
            <Separator className="my-2" />
            <ul className="space-y-2 text-sm">
              {utmBreakdown.map((item, index) => (
                <li key={`${item.fuente}-${item.campania ?? 'n/a'}-${index}`} className="flex items-center justify-between">
                  <span>
                    <span className="font-medium">{item.fuente}</span>
                    {item.campania ? <span className="text-muted-foreground"> · {item.campania}</span> : null}
                  </span>
                  <span>{item.respuestas}</span>
                </li>
              ))}
              {!utmBreakdown.length && (
                <li className="text-muted-foreground">Aún no se registraron campañas etiquetadas.</li>
              )}
            </ul>
          </div>
        </CardContent>
      </Card>

      <SurveyTerritoryCommandCenter
        points={authorizedTerritoryPoints}
        geoIntensity={geoIntensity}
        geoCoverageLabel={geoCoverageLabel}
        totalResponses={totalResponsesValue}
        provider={provider}
        providerHint={providerHint}
        fallbackProvider={fallbackProvider}
        usingSyntheticPoints={usingSyntheticPoints}
        mapRenderReady={mapRenderReady}
        boundingBoxValue={boundingBoxValue}
        channelBreakdown={channelBreakdown}
        categoryLayerCount={categoryColorMap.size}
        evidenceGate={territoryEvidenceGate}
      />

      {!territoryEvidenceGate.ready ? (
        <div
          role="status"
          aria-live="polite"
          data-testid="survey-territory-evidence-block"
          className="rounded-xl border border-amber-400/50 bg-amber-500/10 p-4 text-sm text-amber-950 dark:text-amber-100"
        >
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">{territoryEvidenceGate.title}</p>
              <p className="mt-1">{territoryEvidenceGate.detail}</p>
              <p className="mt-2 font-medium">Próxima acción: {territoryEvidenceGate.nextAction}</p>
            </div>
          </div>
        </div>
      ) : null}

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>Mapa de Calor y Cobertura Territorial</CardTitle>
            <CardDescription>
              Georreferenciación, focos de concentración y distribución espacial de las respuestas recibidas.
            </CardDescription>
          </div>
          <div className="flex flex-col items-start gap-1 md:items-end">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Vista del Mapa
            </span>
            <MapProviderToggle
              value={provider}
              onChange={setProvider}
              size="sm"
              googleAvailable={googleProviderAvailable}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {usingSyntheticPoints ? (
            <div className="inline-flex rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-300">
              Visualización en modo simulación de muestra territorial.
            </div>
          ) : null}
          {mapRenderReady && heatmapData.length && boundingBoxValue ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
              Filtrando resultados por la zona visible del mapa.
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto px-0 text-primary"
                onClick={handleClearBoundingBox}
                disabled={!onFiltersChange}
              >
                Quitar filtro
              </Button>
            </div>
          ) : null}
          {categoryColorMap.size ? (
            <div className="flex flex-wrap gap-2 text-xs">
              {Array.from(categoryColorMap.entries()).map(([category, color]) => (
                <span key={category} className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background px-2.5 py-1 text-xs">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                  {category}
                </span>
              ))}
            </div>
          ) : null}
          {mapRenderReady && heatmapData.length ? (
            <MeasuredContainer minWidth={280} minHeight={380} className="h-[420px] w-full min-w-0 overflow-hidden rounded-xl border border-border/60">
              <MapLibreMap
                className="h-full w-full rounded-xl"
                center={heatmapCenter}
                heatmapData={heatmapData}
                fitToBounds={heatmapBounds.length ? heatmapBounds : undefined}
                initialZoom={heatmapBounds.length ? 12 : 4}
                provider={provider}
                onProviderUnavailable={handleProviderUnavailable}
                onBoundingBoxChange={handleBoundingBoxChange}
                geoLayerConfig={
                  categoryLayersRecord
                    ? {
                        contract_version: toNonEmptyString(categoryLayersRecord.contract_version) ?? undefined,
                        style_url: toNonEmptyString(categoryLayersRecord.style_url) ?? undefined,
                        source: categoryLayerSource,
                        source_options: isRecord(categoryLayersRecord.source_options) ? categoryLayersRecord.source_options : undefined,
                        interactions: isRecord(categoryLayersRecord.interactions) ? (categoryLayersRecord.interactions as any) : undefined,
                        layers: isRecord(categoryLayersRecord.layers) ? (categoryLayersRecord.layers as any) : undefined,
                        telemetry: isRecord(categoryLayersRecord.telemetry) ? (categoryLayersRecord.telemetry as any) : undefined,
                      }
                    : undefined
                }
                mapStyleUrl={toNonEmptyString(categoryLayersRecord?.style_url) ?? undefined}
                evidence={surveyMapEvidence}
              />
            </MeasuredContainer>
          ) : heatmapData.length ? (
            <div className="flex h-[320px] flex-col items-center justify-center rounded-xl border border-border/60 bg-muted/10 p-4 text-center">
              <div className="h-2 w-40 animate-pulse rounded-full bg-primary/30" />
              <p className="mt-3 text-sm font-medium">Preparando el mapa con las respuestas geolocalizadas...</p>
            </div>
          ) : (
            <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/15 p-5 text-center">
              <MapPin className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-foreground">
                {toNonEmptyString(mapMetaRecord?.empty_state) ?? 'Todavía no hay respuestas georreferenciadas.'}
              </p>
              <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">
                El mapa permanece vacío hasta recibir barrio o coordenadas consentidas. No completamos la vista con ubicaciones simuladas.
              </p>
            </div>
          )}

          {authorizedTerritoryPoints.length ? (
            <div className="overflow-x-auto rounded-xl border border-border/60 bg-background/50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Ranking de Participación por Zona y Barrio
                </p>
                <Badge variant="outline" className="text-[11px]">
                  {authorizedTerritoryPoints.length} focos detectados
                </Badge>
              </div>
              <table className="min-w-full divide-y divide-border/60 text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground font-medium">
                    <th className="py-2.5 pr-4">Zona / Barrio</th>
                    <th className="py-2.5 pr-4">Volumen</th>
                    <th className="py-2.5 pr-4">Distribución Relativa</th>
                    <th className="py-2.5 pr-4">Categoría Principal</th>
                    <th className="py-2.5 pr-4">Canal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {authorizedTerritoryPoints.slice(0, 15).map((point, index) => {
                    const maxVol = Math.max(1, ...authorizedTerritoryPoints.map((p) => p.respuestas || 1));
                    const pct = Math.round(((point.respuestas || 0) / maxVol) * 100);
                    const zoneName = point.barrio || point.ciudad || `Zona ${index + 1} (${point.lat.toFixed(2)}, ${point.lng.toFixed(2)})`;
                    return (
                      <tr key={`${point.lat}-${point.lng}-${index}`} className="hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 pr-4 font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                              {index + 1}
                            </span>
                            <span>{zoneName}</span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-4 font-semibold text-foreground">
                          {point.respuestas} {point.respuestas === 1 ? 'voto' : 'votos'}
                        </td>
                        <td className="py-2.5 pr-4 min-w-[140px]">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-28 rounded-full bg-muted/60 overflow-hidden">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(8, pct)}%` }} />
                            </div>
                            <span className="text-[10px] text-muted-foreground">{pct}%</span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-4">
                          {point.categoria ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-[11px]">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: categoryColorMap.get(point.categoria) || '#38bdf8' }} />
                              {point.categoria}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4">
                          <Badge variant="secondary" className="text-[10px] font-normal uppercase">
                            {point.canal || 'Web'}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {demographicSections.length ? (
        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle>Segmentación demográfica</CardTitle>
            <CardDescription>Distribución de respuestas según género, edad y territorio declarado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {demographicSections.map((section, sectionIndex) => (
              <div key={section.id} className="space-y-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {section.title}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Participación segmentada para este atributo.
                  </p>
                </div>
                <MeasuredContainer className="h-64 w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={220}>
                    <BarChart
                      data={section.data}
                      layout="vertical"
                      margin={{ left: 0, right: 16, top: 16, bottom: 16 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={160}
                        tick={{ fontSize: 12 }}
                        interval={0}
                      />
                      <Tooltip
                        formatter={(value: number, _name, payload) => {
                          const percentage = payload?.payload?.percentage;
                          return percentage
                            ? [`${value} respuestas (${percentage.toFixed(1)}%)`, '']
                            : [`${value} respuestas`, ''];
                        }}
                      />
                      <Bar
                        dataKey="value"
                        fill={palette[sectionIndex % palette.length]}
                        isAnimationActive
                        animationDuration={CHART_ANIMATION_DURATION}
                        animationEasing={CHART_ANIMATION_EASING}
                      >
                        {section.data.map((item, index) => (
                          <Cell
                            key={item.key}
                            fill={palette[(sectionIndex + index) % palette.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </MeasuredContainer>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};
