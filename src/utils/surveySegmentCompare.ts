export const SEGMENT_FILTER_KEYS = ['canal', 'genero', 'rango_etario', 'barrio', 'ciudad', 'provincia', 'pais'] as const;
const GLOBAL_FILTER_KEYS = ['desde', 'hasta', ...SEGMENT_FILTER_KEYS, 'utm_source', 'utm_campaign', 'bbox'] as const;
const UI_KEYS = ['heading', 'description', 'segment_a', 'segment_b', 'base', 'answered', 'option', 'selected',
  'percent', 'delta', 'delta_unit', 'overlap', 'conflicts', 'empty', 'details'] as const;
export type SegmentFilters = Record<string, string | string[]>;
export interface SegmentCompareScope {
  surveyId: number;
  tenantId: number;
  mode: 'real' | 'synthetic';
  globalFilters: unknown;
  segmentA: unknown;
  segmentB: unknown;
}
export interface SurveySegmentComparison {
  contract_version: 'surveys.segment_compare.v1';
  scope: { survey_id: number; tenant_id: number; mode: 'real' | 'synthetic'; filtered: boolean;
    global_filters: SegmentFilters; segment_a_filters: SegmentFilters; segment_b_filters: SegmentFilters };
  basis: { selected_records: number; segment_a_records: number; segment_b_records: number; overlap_records: number; exact: true };
  questions: Array<{ id: number; label: string; type: 'single_choice' | 'multiple_choice';
    segment_a_answered: number; segment_b_answered: number; segment_a_conflicts: number; segment_b_conflicts: number;
    options: Array<{ id: number; label: string;
      segment_a_count: number; segment_b_count: number; segment_a_percent: number | null; segment_b_percent: number | null;
      delta_percentage_points: number | null }> }>;
  ui: Record<typeof UI_KEYS[number], string>;
  limitations: Array<{ id: string; title: string; detail: string }>;
  inference_authorized: false;
}
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const positiveId = (value: unknown): value is number => count(value) && value > 0;
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 &&
  value.length <= 1800 && !/[\p{Cc}\p{Cf}]/u.test(value);
const trim = (value: string) => value.replace(/^[\t\n\v\f\r ]+|[\t\n\v\f\r ]+$/g, '');

/** Normalize request/response representations only; preserve the actual backend filter values. */
export function normalizeSegmentCompareFilters(value: unknown, global = false): SegmentFilters | null {
  if (!record(value)) return null;
  const result: SegmentFilters = {};
  const allowed: readonly string[] = global ? GLOBAL_FILTER_KEYS : SEGMENT_FILTER_KEYS;
  for (const key of Object.keys(value).sort()) {
    const raw = value[key];
    if (raw === undefined || raw === null || raw === '') continue;
    if (!allowed.includes(key)) return null;
    if (key === 'bbox' && Array.isArray(raw) && raw.length === 4 && raw.every(item => typeof item === 'number' && Number.isFinite(item))) {
      result[key] = raw.join(','); continue;
    }
    if (typeof raw !== 'string' && !(Array.isArray(raw) && raw.every(item => typeof item === 'string'))) return null;
    const items = (Array.isArray(raw) ? raw : [raw]).flatMap(item => SEGMENT_FILTER_KEYS.includes(key as typeof SEGMENT_FILTER_KEYS[number]) ? item.split(',') : [item]).map(trim);
    if (!items.length || !items.every(text)) return null;
    const unique = [...new Set(items)].sort();
    result[key] = unique.length === 1 ? unique[0] : unique;
  }
  return result;
}

export function buildSegmentCompareParams(globalFilters: unknown, segmentA: unknown, segmentB: unknown, mode: unknown) {
  const global = normalizeSegmentCompareFilters(globalFilters, true);
  const a = normalizeSegmentCompareFilters(segmentA);
  const b = normalizeSegmentCompareFilters(segmentB);
  if (!global || !a || !b || !Object.keys(a).length || !Object.keys(b).length || (mode !== 'real' && mode !== 'synthetic')) return null;
  return { ...global, data_mode: mode,
    ...Object.fromEntries(Object.entries(a).map(([key, value]) => [`a_${key}`, value])),
    ...Object.fromEntries(Object.entries(b).map(([key, value]) => [`b_${key}`, value])) };
}

const sameFilters = (value: unknown, expected: unknown, global = false): SegmentFilters | null => {
  const parsed = normalizeSegmentCompareFilters(value, global);
  const wanted = normalizeSegmentCompareFilters(expected, global);
  return parsed && wanted && JSON.stringify(parsed) === JSON.stringify(wanted) ? parsed : null;
};
const validPercent = (value: unknown, numerator: number, denominator: number) => denominator === 0 ? value === null :
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 &&
  Math.abs(value - numerator / denominator * 100) <= 0.005000001;

/** Accept only an exact, scoped descriptive comparison for the currently requested groups. */
export function readSurveySegmentComparison(value: unknown, expected: SegmentCompareScope): SurveySegmentComparison | null {
  if (!record(value) || value.contract_version !== 'surveys.segment_compare.v1' || value.inference_authorized !== false ||
      !positiveId(expected.surveyId) || !positiveId(expected.tenantId) || !record(value.scope) ||
      value.scope.survey_id !== expected.surveyId || value.scope.tenant_id !== expected.tenantId ||
      value.scope.mode !== expected.mode || (expected.mode !== 'real' && expected.mode !== 'synthetic')) return null;
  const global = sameFilters(value.scope.global_filters, expected.globalFilters, true);
  const a = sameFilters(value.scope.segment_a_filters, expected.segmentA);
  const b = sameFilters(value.scope.segment_b_filters, expected.segmentB);
  if (!global || !a || !b || value.scope.filtered !== (Object.keys(global).length > 0)) return null;
  const basis = value.basis;
  if (!record(basis) || basis.exact !== true ||
      ![basis.selected_records, basis.segment_a_records, basis.segment_b_records, basis.overlap_records].every(count)) return null;
  const { selected_records: total, segment_a_records: totalA, segment_b_records: totalB, overlap_records: overlap } = basis as SurveySegmentComparison['basis'];
  if (totalA > total || totalB > total || overlap > Math.min(totalA, totalB) || overlap < Math.max(0, totalA - (total - totalB))) return null;
  const provenance = value.data_provenance;
  const synthetic = expected.mode === 'synthetic';
  if (!record(provenance) || provenance.contract_version !== 'surveys.response_provenance.v1' ||
      provenance.server_trusted_classification !== true || provenance.exact_aggregates !== true ||
      provenance.aggregate_scope !== 'all_selected_records' || provenance.mode !== expected.mode ||
      provenance.population_size !== total || provenance.sample_size !== 0 || provenance.sample_limit !== 0 ||
      provenance.raw_responses_materialized !== 0 || provenance.unverified_responses_included !== 0 ||
      provenance.contains_synthetic !== (synthetic && total > 0) ||
      provenance.real_responses_included !== (synthetic ? 0 : total) ||
      provenance.synthetic_responses_included !== (synthetic ? total : 0)) return null;
  if (!Array.isArray(value.questions)) return null;
  const questions: SurveySegmentComparison['questions'] = [];
  const questionIds = new Set<number>();
  for (const question of value.questions) {
    if (!record(question) || !positiveId(question.id) || questionIds.has(question.id) || !text(question.label) ||
        (question.type !== 'single_choice' && question.type !== 'multiple_choice') ||
        !count(question.segment_a_answered) || !count(question.segment_b_answered) ||
        !count(question.segment_a_conflicts) || !count(question.segment_b_conflicts) ||
        question.segment_a_answered > totalA || question.segment_b_answered > totalB ||
        question.segment_a_conflicts > totalA - question.segment_a_answered ||
        question.segment_b_conflicts > totalB - question.segment_b_answered ||
        question.type === 'multiple_choice' && (question.segment_a_conflicts !== 0 || question.segment_b_conflicts !== 0) ||
        !Array.isArray(question.options)) return null;
    questionIds.add(question.id);
    const options: SurveySegmentComparison['questions'][number]['options'] = [];
    const optionIds = new Set<number>();
    for (const option of question.options) {
      if (!record(option) || !positiveId(option.id) || optionIds.has(option.id) || !text(option.label) ||
          !count(option.segment_a_count) || !count(option.segment_b_count) || option.segment_a_count > question.segment_a_answered ||
          option.segment_b_count > question.segment_b_answered ||
          !validPercent(option.segment_a_percent, option.segment_a_count, question.segment_a_answered) ||
          !validPercent(option.segment_b_percent, option.segment_b_count, question.segment_b_answered)) return null;
      const expectedDelta = question.segment_a_answered && question.segment_b_answered
        ? option.segment_a_count / question.segment_a_answered * 100 - option.segment_b_count / question.segment_b_answered * 100 : null;
      if (expectedDelta === null ? option.delta_percentage_points !== null :
          typeof option.delta_percentage_points !== 'number' || !Number.isFinite(option.delta_percentage_points) ||
          Math.abs(option.delta_percentage_points - expectedDelta) > 0.010000001) return null;
      optionIds.add(option.id);
      options.push({ id: option.id, label: option.label, segment_a_count: option.segment_a_count, segment_b_count: option.segment_b_count,
        segment_a_percent: option.segment_a_percent as number | null, segment_b_percent: option.segment_b_percent as number | null,
        delta_percentage_points: option.delta_percentage_points as number | null });
    }
    const selectedA = options.reduce((sum, option) => sum + option.segment_a_count, 0);
    const selectedB = options.reduce((sum, option) => sum + option.segment_b_count, 0);
    if (question.type === 'single_choice'
      ? selectedA !== question.segment_a_answered || selectedB !== question.segment_b_answered
      : selectedA < question.segment_a_answered || selectedB < question.segment_b_answered) return null;
    questions.push({ id: question.id, label: question.label, type: question.type, segment_a_answered: question.segment_a_answered,
      segment_b_answered: question.segment_b_answered, segment_a_conflicts: question.segment_a_conflicts,
      segment_b_conflicts: question.segment_b_conflicts, options });
  }
  const sourceUI = value.ui;
  if (!record(sourceUI) || !UI_KEYS.every(key => text(sourceUI[key])) || !Array.isArray(value.limitations) || value.limitations.length === 0) return null;
  const limitations: SurveySegmentComparison['limitations'] = [];
  const noteIds = new Set<string>();
  for (const note of value.limitations) {
    if (!record(note) || typeof note.id !== 'string' || !/^[a-z][a-z_]{0,59}$/.test(note.id) || noteIds.has(note.id) || !text(note.title) || !text(note.detail)) return null;
    noteIds.add(note.id); limitations.push({ id: note.id, title: note.title, detail: note.detail });
  }
  return { contract_version: 'surveys.segment_compare.v1', scope: { survey_id: expected.surveyId, tenant_id: expected.tenantId,
    mode: expected.mode, filtered: Object.keys(global).length > 0, global_filters: global, segment_a_filters: a, segment_b_filters: b },
    basis: { selected_records: total, segment_a_records: totalA, segment_b_records: totalB, overlap_records: overlap, exact: true },
    questions, ui: Object.fromEntries(UI_KEYS.map(key => [key, sourceUI[key]])) as SurveySegmentComparison['ui'], limitations,
    inference_authorized: false };
}
