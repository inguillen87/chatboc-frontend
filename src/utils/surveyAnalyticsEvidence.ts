/** Server-owned disclosure, never a substitute for tenant authorization. */
export interface AnalyticsEvidence {
  contract_version: 'surveys.analytics_evidence.v1';
  evidence_revision: string;
  scope: { survey_id: number; tenant_id: number; mode: 'real' | 'synthetic'; filtered: boolean };
  basis: { selected_records: number; detail_records: number; detail_limit: number;
    detail_coverage_percent: number | null; partial: boolean; complete_records: number };
  cards: Array<{ id: string; label: string; value: number | null; unit: 'count' | 'percent';
    basis: 'observed' | 'estimated' | 'unavailable'; detail: string }>;
  facts: Array<{ id: string; label: string; value: string; note: string }>;
  limitations: Array<{ id: string; title: string; detail: string }>;
  ui: Record<string, string>;
  inference_authorized: false;
  margin_of_error: null;
}
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const count = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const percent = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= 1800 && !/\p{Cc}/u.test(v);
const id = (v: unknown): v is string => typeof v === 'string' && /^[a-z][a-z_]{0,39}$/.test(v);
const unique = (rows: Array<{id: string}>) => new Set(rows.map(x => x.id)).size === rows.length;
const UI = ['heading','eyebrow','description','details','mode','observed','estimated','unavailable','coverage'];

export function readAnalyticsEvidence(value: unknown, surveyId: unknown, tenantId: unknown, summary: unknown): AnalyticsEvidence | null {
  if (!object(value) || value.contract_version !== 'surveys.analytics_evidence.v1' ||
      !count(surveyId) || !surveyId || !count(tenantId) || !tenantId || !object(summary) ||
      !object(value.scope) || value.scope.survey_id !== surveyId || value.scope.tenant_id !== tenantId ||
      !['real','synthetic'].includes(value.scope.mode) || typeof value.scope.filtered !== 'boolean' ||
      value.inference_authorized !== false || value.margin_of_error !== null ||
      typeof value.evidence_revision !== 'string' || !/^[a-f0-9]{64}$/.test(value.evidence_revision)) return null;
  const b = value.basis;
  if (!object(b) || ![b.selected_records,b.detail_records,b.detail_limit,b.complete_records].every(count) ||
      b.detail_records > b.selected_records || b.detail_records > b.detail_limit || b.complete_records > b.selected_records ||
      b.partial !== (b.detail_records < b.selected_records) || b.selected_records !== summary.total_respuestas ||
      (b.detail_coverage_percent !== null && !percent(b.detail_coverage_percent))) return null;
  const coverage = b.selected_records ? b.detail_records / b.selected_records * 100 : null;
  // Python and JS differ at exact half-cent ties; accept either valid two-decimal rounding.
  if (coverage === null ? b.detail_coverage_percent !== null
    : b.detail_coverage_percent === null || Math.abs(b.detail_coverage_percent - coverage) > 0.005000001) return null;
  if (!Array.isArray(value.cards) || value.cards.length !== 3 || !value.cards.every((c: unknown) => object(c) &&
      id(c.id) && text(c.label) && text(c.detail) && ['count','percent'].includes(c.unit) &&
      ['observed','estimated','unavailable'].includes(c.basis) &&
      (c.value === null ? c.basis === 'unavailable' : c.unit === 'count' ? count(c.value) : percent(c.value)))) return null;
  const [total, identities, completion] = value.cards;
  const expectedBasis = !b.selected_records || !b.detail_records ? 'unavailable' : b.partial ? 'estimated' : 'observed';
  if (total.id !== 'responses' || total.value !== b.selected_records || total.unit !== 'count' || total.basis !== 'observed' ||
      identities.id !== 'identities' || identities.unit !== 'count' || identities.basis !== 'observed' ||
      identities.value !== summary.participantes_unicos || identities.value > b.selected_records ||
      completion.id !== 'completion' || completion.unit !== 'percent' || completion.basis !== expectedBasis ||
      completion.value !== (expectedBasis === 'unavailable' ? null : summary.tasa_completitud)) return null;
  if (completion.value !== null && Math.abs(completion.value - b.complete_records / b.selected_records * 100) > 0.011) return null;
  if (!Array.isArray(value.facts) || value.facts.length !== 5 || !value.facts.every((f: unknown) => object(f) &&
      id(f.id) && text(f.label) && text(f.value) && text(f.note)) || !unique(value.facts)) return null;
  if (!Array.isArray(value.limitations) || value.limitations.length < 4 || value.limitations.length > 6 ||
      !value.limitations.every((n: unknown) => object(n) && id(n.id) && text(n.title) && text(n.detail)) || !unique(value.limitations)) return null;
  if (!object(value.ui) || !UI.every(key => text(value.ui[key]))) return null;
  // Reconstruct the approved fields so a JSON download cannot carry hidden payloads.
  return {
    contract_version: 'surveys.analytics_evidence.v1', evidence_revision: value.evidence_revision,
    scope: { survey_id: surveyId, tenant_id: tenantId, mode: value.scope.mode, filtered: value.scope.filtered },
    basis: { selected_records: b.selected_records, detail_records: b.detail_records, detail_limit: b.detail_limit,
      detail_coverage_percent: b.detail_coverage_percent, partial: b.partial, complete_records: b.complete_records },
    cards: value.cards.map(({id,label,value,unit,basis,detail}: AnalyticsEvidence['cards'][number]) => ({id,label,value,unit,basis,detail})),
    facts: value.facts.map(({id,label,value,note}: AnalyticsEvidence['facts'][number]) => ({id,label,value,note})),
    limitations: value.limitations.map(({id,title,detail}: AnalyticsEvidence['limitations'][number]) => ({id,title,detail})),
    ui: Object.fromEntries(UI.map(key => [key,value.ui[key]])), inference_authorized: false, margin_of_error: null,
  };
}

/** Canonical API tasa_completitud is in percentage points, including 0..1. */
export function formatCompletionPercent(value: unknown, total?: number | null): string {
  if (!percent(value) || total === 0) return '\u2014';
  return `${value.toFixed(1)}%`;
}
