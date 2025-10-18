import type {
  PublicResponsePayload,
  SurveyAdmin,
  SurveyAnalyticsFilters,
  SurveyDemographicBreakdowns,
  SurveyDemographicBreakdownItem,
  SurveyHeatmapPoint,
  SurveyPublic,
  SurveySummary,
  SurveySummaryPregunta,
  SurveyTimeseriesPoint,
} from '@/types/encuestas';
import { generateSurveySeedPayloads } from '@/utils/surveySeed';

interface DemoDatasetOptions {
  count?: number;
  scenario?: string | null;
}

export interface SurveyDemoDataset {
  payloads: PublicResponsePayload[];
}

const normalizeString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
};

const normalizeComparisonValue = (value: unknown): string | null => {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  return normalized
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s._-]+/g, '')
    .trim();
};

const toDate = (value: unknown): Date | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return null;
};

const matchesFilterValue = (value: unknown, filter?: string | null) => {
  if (!filter) return true;
  const normalizedValue = normalizeComparisonValue(value);
  const normalizedFilter = normalizeComparisonValue(filter);
  if (!normalizedFilter) return false;
  return normalizedValue === normalizedFilter;
};

const matchesLocationFilter = (
  location: PublicResponsePayload['metadata'] extends { demographics?: { ubicacion?: infer U } }
    ? U | undefined
    : undefined,
  key: 'pais' | 'provincia' | 'ciudad' | 'barrio',
  filter?: string,
) => {
  if (!filter) return true;
  if (!location) return false;
  return matchesFilterValue((location as Record<string, unknown>)[key], filter);
};

const applyFilters = (payloads: PublicResponsePayload[], filters: SurveyAnalyticsFilters): PublicResponsePayload[] => {
  if (!payloads.length) return payloads;
  const desde = toDate(filters.desde);
  const hasta = toDate(filters.hasta);

  return payloads.filter((payload) => {
    if (filters.canal && !matchesFilterValue(payload.canal, filters.canal)) {
      return false;
    }
    if (filters.utm_source && !matchesFilterValue(payload.utm_source, filters.utm_source)) {
      return false;
    }
    if (filters.utm_campaign && !matchesFilterValue(payload.utm_campaign, filters.utm_campaign)) {
      return false;
    }

    const demographics = payload.metadata?.demographics;
    if (filters.genero && !matchesFilterValue(demographics?.genero, filters.genero)) {
      return false;
    }
    if (filters.rango_etario && !matchesFilterValue(demographics?.rangoEtario, filters.rango_etario)) {
      return false;
    }

    const location = demographics?.ubicacion;
    if (!matchesLocationFilter(location, 'pais', filters.pais)) return false;
    if (!matchesLocationFilter(location, 'provincia', filters.provincia)) return false;
    if (!matchesLocationFilter(location, 'ciudad', filters.ciudad)) return false;
    if (!matchesLocationFilter(location, 'barrio', filters.barrio)) return false;

    if (desde || hasta) {
      const submittedAt = toDate(payload.metadata?.submittedAt);
      if (!submittedAt) return false;
      if (desde && submittedAt < desde) return false;
      if (hasta && submittedAt > hasta) return false;
    }

    return true;
  });
};

const buildQuestionMap = (survey: SurveyPublic | SurveyAdmin) => {
  const map = new Map<number, SurveySummaryPregunta & { opcionesMap: Map<number | string, SurveySummaryPregunta['opciones'][number]>; tipo: string }>();

  for (const pregunta of survey.preguntas ?? []) {
    const opcionesMap = new Map<number | string, SurveySummaryPregunta['opciones'][number]>();
    const opciones: SurveySummaryPregunta['opciones'] = [];
    if (Array.isArray(pregunta.opciones)) {
      for (const opcion of pregunta.opciones) {
        const item = {
          opcion_id: opcion.id,
          texto: opcion.texto,
          respuestas: 0,
          porcentaje: 0,
        };
        opciones.push(item);
        opcionesMap.set(opcion.id, item);
      }
    }

    map.set(pregunta.id, {
      pregunta_id: pregunta.id,
      texto: pregunta.texto,
      total_respuestas: 0,
      opciones,
      opcionesMap,
      tipo: pregunta.tipo,
    });
  }

  return map;
};

const ensureQuestionEntry = (
  map: Map<number, SurveySummaryPregunta & { opcionesMap: Map<number | string, SurveySummaryPregunta['opciones'][number]>; tipo: string }>,
  preguntaId: number,
) => {
  let entry = map.get(preguntaId);
  if (!entry) {
    entry = {
      pregunta_id: preguntaId,
      texto: `Pregunta ${preguntaId}`,
      total_respuestas: 0,
      opciones: [],
      opcionesMap: new Map(),
      tipo: 'opcion_unica',
    };
    map.set(preguntaId, entry);
  }
  return entry;
};

const incrementOption = (
  question: SurveySummaryPregunta & { opcionesMap: Map<number | string, SurveySummaryPregunta['opciones'][number]>; tipo: string },
  opcionId: number | string,
  texto: string,
) => {
  let option = question.opcionesMap.get(opcionId);
  if (!option) {
    const fallbackId =
      typeof opcionId === 'number' && Number.isFinite(opcionId)
        ? opcionId
        : -Math.abs(question.opciones.length + 1);
    option = {
      opcion_id: fallbackId,
      texto,
      respuestas: 0,
      porcentaje: 0,
    };
    question.opciones.push(option);
    question.opcionesMap.set(opcionId, option);
  }
  option.respuestas += 1;
};

const buildSummary = (
  survey: SurveyPublic | SurveyAdmin,
  payloads: PublicResponsePayload[],
): SurveySummary => {
  const questionMap = buildQuestionMap(survey);
  const uniqueParticipants = new Set<string>();
  let completionAccumulator = 0;

  for (const payload of payloads) {
    if (payload.dni) uniqueParticipants.add(`dni:${payload.dni}`);
    else if (payload.phone) uniqueParticipants.add(`phone:${payload.phone}`);
    else uniqueParticipants.add(`anon:${uniqueParticipants.size}`);

    const answered = typeof payload.metadata?.answeredQuestions === 'number' ? payload.metadata.answeredQuestions : null;
    const totalQuestions = typeof payload.metadata?.totalQuestions === 'number' ? payload.metadata.totalQuestions : null;
    const completionRatio = totalQuestions && totalQuestions > 0 ? Math.min(1, Math.max(0, (answered ?? totalQuestions) / totalQuestions)) : 1;
    completionAccumulator += completionRatio;

    for (const respuesta of payload.respuestas ?? []) {
      const preguntaId = typeof respuesta.pregunta_id === 'number' ? respuesta.pregunta_id : Number(respuesta.pregunta_id);
      if (!Number.isFinite(preguntaId)) continue;
      const question = ensureQuestionEntry(questionMap, preguntaId);
      question.total_respuestas += 1;

      if (Array.isArray(respuesta.opcion_ids) && respuesta.opcion_ids.length) {
        for (const opcionId of respuesta.opcion_ids) {
          const original = question.opcionesMap.get(opcionId);
          const label = original?.texto ?? `Opción ${opcionId}`;
          incrementOption(question, opcionId, label);
        }
      } else if (typeof respuesta.texto_libre === 'string' && respuesta.texto_libre.trim()) {
        incrementOption(question, `open:${respuesta.texto_libre}`, respuesta.texto_libre.trim());
      }
    }
  }

  const questions: SurveySummaryPregunta[] = [];
  for (const entry of questionMap.values()) {
    if (!entry.total_respuestas) {
      questions.push({
        pregunta_id: entry.pregunta_id,
        texto: entry.texto,
        total_respuestas: 0,
        opciones: entry.opciones,
      });
      continue;
    }

    const total = entry.opciones.reduce((sum, option) => sum + option.respuestas, 0) || entry.total_respuestas;
    const opciones = entry.opciones.map((option) => ({
      ...option,
      porcentaje: total > 0 ? (option.respuestas / total) * 100 : 0,
    }));

    questions.push({
      pregunta_id: entry.pregunta_id,
      texto: entry.texto,
      total_respuestas: entry.total_respuestas,
      opciones,
    });
  }

  const completionRate = payloads.length ? completionAccumulator / payloads.length : 0;

  return {
    total_respuestas: payloads.length,
    participantes_unicos: uniqueParticipants.size || payloads.length,
    tasa_completitud: completionRate,
    preguntas: questions,
    canales: buildChannelBreakdown(payloads),
    utms: buildUtmBreakdown(payloads),
    demografia: buildDemographics(payloads),
  };
};

const buildChannelBreakdown = (payloads: PublicResponsePayload[]) => {
  const counts = new Map<string, number>();
  for (const payload of payloads) {
    const canal = normalizeString(payload.canal) ?? 'otros';
    counts.set(canal, (counts.get(canal) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([canal, respuestas]) => ({ canal, respuestas }));
};

const buildUtmBreakdown = (payloads: PublicResponsePayload[]) => {
  const counts = new Map<string, { fuente: string; campania?: string | null; respuestas: number }>();
  for (const payload of payloads) {
    const fuente = normalizeString(payload.utm_source) ?? 'sin_fuente';
    const campania = normalizeString(payload.utm_campaign);
    const key = `${fuente}|${campania ?? ''}`;
    const current = counts.get(key) ?? { fuente, campania, respuestas: 0 };
    current.respuestas += 1;
    counts.set(key, current);
  }
  return Array.from(counts.values()).map((item) => ({
    fuente: item.fuente,
    campania: item.campania ?? undefined,
    respuestas: item.respuestas,
  }));
};

const incrementDemographic = (
  store: Map<string, { respuestas: number; etiqueta: string }>,
  value: unknown,
  fallbackLabel?: string,
) => {
  const normalized = normalizeString(value);
  if (!normalized) return;
  const key = normalizeComparisonValue(normalized) ?? normalized;
  const current = store.get(key) ?? { respuestas: 0, etiqueta: normalized };
  current.respuestas += 1;
  if (fallbackLabel && !current.etiqueta) {
    current.etiqueta = fallbackLabel;
  }
  store.set(key, current);
};

const finalizeDemographic = (
  store: Map<string, { respuestas: number; etiqueta: string }>,
  total: number,
): SurveyDemographicBreakdownItem[] =>
  Array.from(store.values()).map((entry) => ({
    clave: entry.etiqueta,
    etiqueta: entry.etiqueta,
    respuestas: entry.respuestas,
    porcentaje: total > 0 ? (entry.respuestas / total) * 100 : 0,
  }));

const buildDemographics = (payloads: PublicResponsePayload[]): SurveyDemographicBreakdowns => {
  const breakdownMaps: Record<string, Map<string, { respuestas: number; etiqueta: string }>> = {};
  const ensureStore = (key: string) => {
    if (!breakdownMaps[key]) {
      breakdownMaps[key] = new Map();
    }
    return breakdownMaps[key]!;
  };

  for (const payload of payloads) {
    const demographics = payload.metadata?.demographics;
    if (!demographics) continue;
    incrementDemographic(ensureStore('genero'), demographics.genero);
    incrementDemographic(ensureStore('rango_etario'), demographics.rangoEtario);
    incrementDemographic(ensureStore('nivel_educativo'), demographics.nivelEducativo);
    incrementDemographic(ensureStore('situacion_laboral'), demographics.situacionLaboral);
    incrementDemographic(ensureStore('ocupacion'), demographics.ocupacion);
    incrementDemographic(ensureStore('tiempo_residencia'), demographics.tiempoResidencia);

    const ubicacion = demographics.ubicacion;
    if (ubicacion) {
      incrementDemographic(ensureStore('pais'), ubicacion.pais, ubicacion.pais ?? undefined);
      incrementDemographic(ensureStore('provincia'), ubicacion.provincia, ubicacion.provincia ?? undefined);
      incrementDemographic(ensureStore('ciudad'), ubicacion.ciudad, ubicacion.ciudad ?? undefined);
      incrementDemographic(ensureStore('barrio'), ubicacion.barrio, ubicacion.barrio ?? undefined);
    }
  }

  const total = payloads.length;
  const result: SurveyDemographicBreakdowns = {};
  for (const [key, store] of Object.entries(breakdownMaps)) {
    const items = finalizeDemographic(store, total);
    if (items.length) {
      result[key] = items;
    }
  }
  return result;
};

const buildTimeseries = (payloads: PublicResponsePayload[]): SurveyTimeseriesPoint[] => {
  const counts = new Map<string, number>();
  for (const payload of payloads) {
    const submittedAt = toDate(payload.metadata?.submittedAt);
    if (!submittedAt) continue;
    const key = submittedAt.toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([fecha, respuestas]) => ({ fecha, respuestas }));
};

const buildHeatmap = (payloads: PublicResponsePayload[]): SurveyHeatmapPoint[] => {
  const points: SurveyHeatmapPoint[] = [];
  for (const payload of payloads) {
    const location = payload.metadata?.demographics?.ubicacion;
    if (!location) continue;
    const lat = typeof location.lat === 'number' ? location.lat : null;
    const lng = typeof location.lng === 'number' ? location.lng : null;
    if (lat === null || lng === null) continue;
    points.push({ lat, lng, respuestas: 1 });
  }
  return points;
};

export interface SurveyDemoAnalyticsResult {
  summary: SurveySummary;
  timeseries: SurveyTimeseriesPoint[];
  heatmap: SurveyHeatmapPoint[];
}

export const generateSurveyDemoDataset = (
  survey: SurveyPublic | SurveyAdmin,
  options: DemoDatasetOptions = {},
): SurveyDemoDataset => {
  const { payloads } = generateSurveySeedPayloads(survey, {
    count: options.count ?? 100,
    scenario: options.scenario ?? null,
    municipalityLabel: survey.municipio_nombre ?? undefined,
  });
  return { payloads };
};

export const buildSurveyDemoAnalyticsFromDataset = (
  survey: SurveyPublic | SurveyAdmin,
  dataset: SurveyDemoDataset,
  filters: SurveyAnalyticsFilters = {},
): SurveyDemoAnalyticsResult => {
  const filteredPayloads = applyFilters(dataset.payloads, filters);
  const summary = buildSummary(survey, filteredPayloads);
  const timeseries = buildTimeseries(filteredPayloads);
  const heatmap = buildHeatmap(filteredPayloads);

  return { summary, timeseries, heatmap };
};

export const buildSurveyDemoAnalytics = (
  survey: SurveyPublic | SurveyAdmin,
  options: DemoDatasetOptions = {},
  filters: SurveyAnalyticsFilters = {},
): SurveyDemoAnalyticsResult => {
  const dataset = generateSurveyDemoDataset(survey, options);
  return buildSurveyDemoAnalyticsFromDataset(survey, dataset, filters);
};

export const mergeSurveyAnalytics = (
  primary: SurveySummary | undefined,
  fallback: SurveySummary | undefined,
): SurveySummary | undefined => {
  if (!primary && !fallback) return undefined;
  if (!primary) return fallback;
  if (!fallback) return primary;

  const merged: SurveySummary = {
    ...fallback,
    ...primary,
    total_respuestas: primary.total_respuestas ?? fallback.total_respuestas,
    participantes_unicos: primary.participantes_unicos ?? fallback.participantes_unicos,
    tasa_completitud: typeof primary.tasa_completitud === 'number' ? primary.tasa_completitud : fallback.tasa_completitud,
    preguntas:
      Array.isArray(primary.preguntas) && primary.preguntas.length
        ? primary.preguntas
        : fallback.preguntas,
    canales:
      Array.isArray(primary.canales) && primary.canales.length ? primary.canales : fallback.canales,
    utms: Array.isArray(primary.utms) && primary.utms.length ? primary.utms : fallback.utms,
    demografia:
      primary.demografia && Object.keys(primary.demografia).length
        ? primary.demografia
        : fallback.demografia,
  };

  return merged;
};

export const pickTimeseries = (
  primary: SurveyTimeseriesPoint[] | undefined,
  fallback: SurveyTimeseriesPoint[] | undefined,
): SurveyTimeseriesPoint[] | undefined => {
  if (primary && primary.length) return primary;
  return fallback;
};

export const pickHeatmap = (
  primary: SurveyHeatmapPoint[] | undefined,
  fallback: SurveyHeatmapPoint[] | undefined,
): SurveyHeatmapPoint[] | undefined => {
  if (primary && primary.length) return primary;
  return fallback;
};
