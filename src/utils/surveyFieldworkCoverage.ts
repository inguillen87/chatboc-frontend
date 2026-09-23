/** Authenticated descriptive coverage. It does not establish sampling or eligibility. */
export const FIELDWORK_DIMENSIONS = [
  'channel', 'campaign', 'gender', 'age_range', 'neighborhood', 'city', 'province', 'country', 'coordinates',
] as const;
export type FieldworkDimensionId = typeof FIELDWORK_DIMENSIONS[number];
const UI_KEYS = ['heading', 'eyebrow', 'description', 'recorded', 'missing', 'coverage', 'empty', 'details'] as const;
const FILTER_KEYS = ['desde', 'hasta', 'canal', 'barrio', 'ciudad', 'provincia', 'pais', 'genero', 'rango_etario', 'bbox', 'utm_source', 'utm_campaign'] as const;
type FieldworkUIKey = typeof UI_KEYS[number];

export interface SurveyFieldworkCoverage {
  contract_version: 'surveys.fieldwork_coverage.v1';
  scope: { survey_id: number; tenant_id: number; mode: 'real' | 'synthetic'; filtered: boolean };
  basis: { selected_records: number; exact: true };
  dimensions: Array<{ id: FieldworkDimensionId; label: string; recorded_count: number; missing_count: number;
    coverage_percent: number | null; detail: string }>;
  ui: Record<FieldworkUIKey, string>;
  limitations: Array<{ id: string; title: string; detail: string }>;
  inference_authorized: false;
  response_rate: null;
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 &&
  value.length <= 1800 && !/[\p{Cc}\p{Cf}]/u.test(value);

export const hasSurveyFieldworkFilters = (filters: unknown): boolean => record(filters) &&
  FILTER_KEYS.some(key => filters[key] !== undefined && filters[key] !== null && filters[key] !== '');

/** Reconstruct only approved properties; mismatched, partial or absent disclosures stay absent. */
export function readSurveyFieldworkCoverage(
  value: unknown, surveyId: unknown, tenantId: unknown, summary: unknown, expectedFiltered: boolean,
): SurveyFieldworkCoverage | null {
  if (!record(value) || value.contract_version !== 'surveys.fieldwork_coverage.v1' ||
      !count(surveyId) || surveyId === 0 || !count(tenantId) || tenantId === 0 || !record(summary) ||
      !record(value.scope) || value.scope.survey_id !== surveyId || value.scope.tenant_id !== tenantId ||
      (value.scope.mode !== 'real' && value.scope.mode !== 'synthetic') || typeof expectedFiltered !== 'boolean' ||
      value.scope.filtered !== expectedFiltered ||
      value.inference_authorized !== false || value.response_rate !== null) return null;
  if (summary.encuesta_id !== undefined && summary.encuesta_id !== surveyId) return null;
  const provenance = summary.data_provenance;
  if (!record(provenance) || provenance.contract_version !== 'surveys.response_provenance.v1' ||
      provenance.server_trusted_classification !== true || provenance.exact_aggregates !== true ||
      provenance.mode !== value.scope.mode) return null;
  const basis = value.basis;
  if (!record(basis) || basis.exact !== true || !count(basis.selected_records) ||
      basis.selected_records !== summary.total_respuestas) return null;
  const selected = basis.selected_records;
  const synthetic = value.scope.mode === 'synthetic';
  if (provenance.population_size !== selected || provenance.unverified_responses_included !== 0 ||
      provenance.contains_synthetic !== (synthetic && selected > 0) ||
      provenance.real_responses_included !== (synthetic ? 0 : selected) ||
      provenance.synthetic_responses_included !== (synthetic ? selected : 0)) return null;
  if (!Array.isArray(value.dimensions) || value.dimensions.length !== FIELDWORK_DIMENSIONS.length) return null;
  const dimensions: SurveyFieldworkCoverage['dimensions'] = [];
  for (const [index, row] of value.dimensions.entries()) {
    if (!record(row) || row.id !== FIELDWORK_DIMENSIONS[index] || !text(row.label) || !text(row.detail) ||
        !count(row.recorded_count) || !count(row.missing_count) || row.recorded_count > selected ||
        row.missing_count !== selected - row.recorded_count) return null;
    const expected = selected > 0 ? row.recorded_count / selected * 100 : null;
    if (expected === null ? row.coverage_percent !== null :
        typeof row.coverage_percent !== 'number' || !Number.isFinite(row.coverage_percent) ||
        row.coverage_percent < 0 || row.coverage_percent > 100 ||
        Math.abs(row.coverage_percent - expected) > 0.005000001) return null;
    dimensions.push({ id: FIELDWORK_DIMENSIONS[index], label: row.label, recorded_count: row.recorded_count,
      missing_count: row.missing_count, coverage_percent: row.coverage_percent as number | null, detail: row.detail });
  }
  const sourceUI = value.ui;
  if (!record(sourceUI) || !UI_KEYS.every(key => text(sourceUI[key]))) return null;
  const ui = Object.fromEntries(UI_KEYS.map(key => [key, sourceUI[key]])) as SurveyFieldworkCoverage['ui'];
  if (!Array.isArray(value.limitations) || value.limitations.length < 1 || value.limitations.length > 8) return null;
  const limitations: SurveyFieldworkCoverage['limitations'] = [];
  const ids = new Set<string>();
  for (const note of value.limitations) {
    if (!record(note) || typeof note.id !== 'string' || !/^[a-z][a-z_]{0,39}$/.test(note.id) || ids.has(note.id) ||
        !text(note.title) || !text(note.detail)) return null;
    ids.add(note.id);
    limitations.push({ id: note.id, title: note.title, detail: note.detail });
  }
  return { contract_version: 'surveys.fieldwork_coverage.v1',
    scope: { survey_id: surveyId, tenant_id: tenantId, mode: value.scope.mode as 'real' | 'synthetic', filtered: expectedFiltered },
    basis: { selected_records: selected, exact: true }, dimensions, ui, limitations,
    inference_authorized: false, response_rate: null };
}
