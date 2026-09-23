import { describe, expect, it } from 'vitest';
import fixtures from '../../tests/fixtures/survey-segment-compare.json';
import { buildSegmentCompareParams, normalizeSegmentCompareFilters, readSurveySegmentComparison, type SegmentCompareScope } from './surveySegmentCompare';

const context = (report: typeof fixtures.main): SegmentCompareScope => ({ surveyId: report.scope.survey_id, tenantId: report.scope.tenant_id,
  mode: report.scope.mode as 'real' | 'synthetic', globalFilters: report.scope.global_filters,
  segmentA: report.scope.segment_a_filters, segmentB: report.scope.segment_b_filters });
const source = () => structuredClone(fixtures.main);
const read = (value: unknown, expected = context(fixtures.main)) => readSurveySegmentComparison(value, expected);

describe('exact survey segment comparison', () => {
  it.each(Object.keys(fixtures) as Array<keyof typeof fixtures>)('accepts real HTTP %s contract', key => {
    const report = fixtures[key]; const parsed = read(report, context(report));
    expect(parsed).not.toBeNull();
    expect(parsed?.basis).toEqual(report.basis);
    expect(parsed?.questions).toEqual(report.questions);
  });
  it.each([null, undefined, {}, [], { buckets: [{ segment_a: 10, segment_b: 20 }] }])('never infers exact results from unsupported payload %#', value => {
    expect(read(value)).toBeNull();
  });
  it('binds identity, origin and every global or group filter value', () => {
    const report = source();
    for (const patch of [{ surveyId: 999 }, { tenantId: 999 }, { mode: 'synthetic' },
      { globalFilters: { barrio: 'Otro' } }, { segmentA: report.scope.segment_b_filters },
      { segmentB: report.scope.segment_a_filters }]) {
      expect(read(report, { ...context(report), ...patch } as SegmentCompareScope)).toBeNull();
    }
  });
  it('rejects incomplete or contradictory provenance', () => {
    for (const patch of [{ contract_version: 'legacy' }, { server_trusted_classification: false }, { exact_aggregates: false },
      { mode: 'synthetic' }, { population_size: 1 }, { sample_size: 500 }, { sample_limit: 500 },
      { aggregate_scope: 'latest' }, { raw_responses_materialized: 1 }, { contains_synthetic: true },
      { unverified_responses_included: 1 }, { real_responses_included: '600' }, { synthetic_responses_included: 1 }]) {
      const report = source(); Object.assign(report.data_provenance, patch);
      expect(read(report)).toBeNull();
    }
  });
  it('reconciles group memberships and overlapping populations', () => {
    for (const patch of [{ selected_records: 1 }, { segment_a_records: -1 }, { segment_b_records: 0.5 },
      { overlap_records: 101 }, { exact: false }]) {
      const report = source(); Object.assign(report.basis, patch); expect(read(report)).toBeNull();
    }
    const overlap = structuredClone(fixtures.overlap); overlap.basis.segment_a_records = 450; overlap.basis.overlap_records = 0;
    expect(read(overlap, context(overlap))).toBeNull();
  });
  it('validates question bases, conflicts and deduplicated option counts', () => {
    for (const patch of [{ segment_a_answered: 101 }, { segment_a_answered: '99' }, { segment_a_conflicts: -1 }, { segment_a_conflicts: 2 }]) {
      const report = source(); Object.assign(report.questions[0], patch); expect(read(report)).toBeNull();
    }
    const duplicate = source(); duplicate.questions[0].options.push(duplicate.questions[0].options[0]);
    expect(read(duplicate)).toBeNull();
    const missing = source(); missing.questions[0].options = [];
    expect(read(missing)).toBeNull();
  });
  it('accepts multiple-choice option sums above 100 percent without clamping', () => {
    const report = source(); const question = report.questions.find(item => item.type === 'multiple_choice')!;
    expect(question.options.reduce((sum, item) => sum + (item.segment_a_percent ?? 0), 0)).toBeGreaterThan(100);
    expect(read(report)).not.toBeNull();
  });
  it('requires A minus B in percentage points, never relative percentage change', () => {
    const report = source(); const option = report.questions[0].options[0];
    expect(read(report)?.questions[0].options[0].delta_percentage_points).toBe(option.delta_percentage_points);
    option.delta_percentage_points = -option.delta_percentage_points;
    expect(read(report)).toBeNull();
  });
  it('rejects fabricated or nonfinite percentages', () => {
    for (const patch of [{ segment_a_percent: 1 }, { segment_a_percent: Infinity }, { segment_b_percent: -1 },
      { segment_a_percent: null }, { delta_percentage_points: NaN }]) {
      const report = source(); Object.assign(report.questions[0].options[0], patch); expect(read(report)).toBeNull();
    }
  });
  it('keeps rates and differences unavailable when a question base is zero', () => {
    const empty = structuredClone(fixtures.empty);
    expect(read(empty, context(empty))).not.toBeNull();
    expect(empty.questions[0].options[0].segment_a_percent).toBeNull();
    Object.assign(empty.questions[0].options[0], { delta_percentage_points: 0 });
    expect(read(empty, context(empty))).toBeNull();
  });
  it('requires bounded server labels and rejects inference claims', () => {
    const report = source();
    expect(read({ ...report, inference_authorized: true })).toBeNull();
    expect(read({ ...report, ui: {} })).toBeNull();
    expect(read({ ...report, ui: { ...report.ui, heading: 'x\u202Ey' } })).toBeNull();
    expect(read({ ...report, limitations: [] })).toBeNull();
  });
  it('reconstructs the approved contract without hidden respondent details', () => {
    const report = source(); const parsed = read({ ...report, email: 'private@example.test',
      questions: report.questions.map(question => ({ ...question, raw_responses: ['private'] })) });
    expect(parsed).not.toBeNull();
    expect(JSON.stringify(parsed)).not.toContain('private');
    expect(parsed).not.toHaveProperty('segment_a');
  });
});

describe('segment comparison request scope', () => {
  it('includes global filters and source mode together with both groups', () => {
    expect(buildSegmentCompareParams({ barrio: 'Centro QA', desde: '2026-09-01' }, { canal: 'web' }, { canal: 'whatsapp' }, 'real'))
      .toEqual({ barrio: 'Centro QA', desde: '2026-09-01', data_mode: 'real', a_canal: 'web', b_canal: 'whatsapp' });
  });
  it('normalizes only representation differences and preserves filter punctuation', () => {
    expect(normalizeSegmentCompareFilters({ barrio: [' Zona|A:centro ', 'Zona|A:centro'] })).toEqual({ barrio: 'Zona|A:centro' });
    expect(normalizeSegmentCompareFilters({ genero: ' B, A ' })).toEqual({ genero: ['A', 'B'] });
    expect(normalizeSegmentCompareFilters({ bbox: [-68, -33, -67, -32] }, true)).toEqual({ bbox: '-68,-33,-67,-32' });
  });
  it('does not request an empty, unsupported or ambiguous group', () => {
    expect(buildSegmentCompareParams({}, {}, { canal: 'web' }, 'real')).toBeNull();
    expect(buildSegmentCompareParams({}, { ignored: 'x' }, { canal: 'web' }, 'real')).toBeNull();
    expect(buildSegmentCompareParams({}, { canal: 'whatsapp' }, { canal: 'web' }, 'unknown')).toBeNull();
    expect(buildSegmentCompareParams({ exclude_demo: false }, { canal: 'whatsapp' }, { canal: 'web' }, 'real')).toBeNull();
  });
});
