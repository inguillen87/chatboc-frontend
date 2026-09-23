import { describe, expect, it } from 'vitest';
import fixtures from '../../tests/fixtures/survey-fieldwork-coverage.json';
import { hasSurveyFieldworkFilters, readSurveyFieldworkCoverage } from './surveyFieldworkCoverage';

const source = () => structuredClone(fixtures.partial);
const read = (summary: typeof fixtures.partial, value: unknown = summary.fieldwork_coverage,
  surveyId: unknown = summary.fieldwork_coverage.scope.survey_id,
  tenantId: unknown = summary.fieldwork_coverage.scope.tenant_id,
  filtered = summary.fieldwork_coverage.scope.filtered) =>
  readSurveyFieldworkCoverage(value, surveyId, tenantId, summary, filtered);

describe('authenticated fieldwork coverage contract', () => {
  it.each(Object.keys(fixtures) as Array<keyof typeof fixtures>)('accepts backend-generated %s evidence', key => {
    const summary = fixtures[key];
    expect(read(summary)).toEqual(summary.fieldwork_coverage);
  });
  it.each([null, undefined, {}, [], { contract_version: 'unknown' }])('does not construct unavailable evidence %#', value => {
    const summary = source(); const scope = summary.fieldwork_coverage.scope;
    expect(readSurveyFieldworkCoverage(value, scope.survey_id, scope.tenant_id, summary, scope.filtered)).toBeNull();
  });
  it('rejects another organization, instrument, filter scope or parent summary', () => {
    const summary = source();
    expect(read(summary, summary.fieldwork_coverage, 999999)).toBeNull();
    expect(read(summary, summary.fieldwork_coverage, summary.fieldwork_coverage.scope.survey_id, 999999)).toBeNull();
    expect(read(summary, summary.fieldwork_coverage, null)).toBeNull();
    expect(read(summary, summary.fieldwork_coverage, String(summary.fieldwork_coverage.scope.survey_id))).toBeNull();
    expect(read(summary, summary.fieldwork_coverage, summary.fieldwork_coverage.scope.survey_id,
      summary.fieldwork_coverage.scope.tenant_id, !summary.fieldwork_coverage.scope.filtered)).toBeNull();
    summary.total_respuestas += 1;
    expect(read(summary)).toBeNull();
  });
  it('requires exact, trusted and matching source classification', () => {
    for (const patch of [{ mode: 'synthetic' }, { server_trusted_classification: false },
      { exact_aggregates: false }, { contract_version: 'legacy' }, { contains_synthetic: true },
      { synthetic_responses_included: 1 }, { real_responses_included: -1 }, { population_size: 999999 },
      { population_size: '8' }, { unverified_responses_included: 1 }, { real_responses_included: NaN }]) {
      const summary = source();
      Object.assign(summary.data_provenance, patch);
      expect(read(summary)).toBeNull();
    }
  });
  it.each([
    { recorded_count: -1 }, { recorded_count: 0.5 }, { recorded_count: Infinity }, { missing_count: NaN },
    { recorded_count: '2' }, { missing_count: 999999 }, { coverage_percent: Infinity },
    { coverage_percent: null }, { coverage_percent: -1 }, { coverage_percent: 101 },
  ])('rejects invalid counts or ratios %#', patch => {
    const summary = source(); Object.assign(summary.fieldwork_coverage.dimensions[0], patch);
    expect(read(summary)).toBeNull();
  });
  it('rejects plausible but incorrect percentages instead of clamping', () => {
    const summary = source(); const dimension = summary.fieldwork_coverage.dimensions[0];
    dimension.coverage_percent = dimension.coverage_percent === 50 ? 51 : 50;
    expect(read(summary)).toBeNull();
  });
  it('requires every fixed dimension once, in the canonical order', () => {
    const summary = source(); summary.fieldwork_coverage.dimensions.pop();
    expect(read(summary)).toBeNull();
    const duplicate = source(); duplicate.fieldwork_coverage.dimensions[1] = duplicate.fieldwork_coverage.dimensions[0];
    expect(read(duplicate)).toBeNull();
    const reordered = source(); reordered.fieldwork_coverage.dimensions.reverse();
    expect(read(reordered)).toBeNull();
  });
  it('represents an empty base with null percentages, never zero coverage', () => {
    expect(read(fixtures.empty)).not.toBeNull();
    const summary = structuredClone(fixtures.empty);
    Object.assign(summary.fieldwork_coverage.dimensions[0], { coverage_percent: 0 });
    expect(read(summary)).toBeNull();
  });
  it('does not accept inferred response rates or population authorization', () => {
    const summary = source();
    expect(read(summary, { ...summary.fieldwork_coverage, inference_authorized: true })).toBeNull();
    expect(read(summary, { ...summary.fieldwork_coverage, response_rate: 75 })).toBeNull();
    expect(read(summary, { ...summary.fieldwork_coverage, basis: { ...summary.fieldwork_coverage.basis, exact: false } })).toBeNull();
  });
  it('requires bounded server-owned copy and unique interpretation notes', () => {
    const summary = source();
    for (const heading of ['', 'x'.repeat(1801), 'x\u0000y', 'x\u202Ey']) {
      expect(read(summary, { ...summary.fieldwork_coverage, ui: { ...summary.fieldwork_coverage.ui, heading } })).toBeNull();
    }
    expect(read(summary, { ...summary.fieldwork_coverage, ui: {} })).toBeNull();
    expect(read(summary, { ...summary.fieldwork_coverage, limitations: [] })).toBeNull();
    const duplicate = { ...summary.fieldwork_coverage,
      limitations: [summary.fieldwork_coverage.limitations[0], summary.fieldwork_coverage.limitations[0]] };
    expect(read(summary, duplicate)).toBeNull();
  });
  it('strips extra transport data at each level without mutating the input', () => {
    const summary = source();
    const report = { ...summary.fieldwork_coverage, email: 'private@example.test',
      scope: { ...summary.fieldwork_coverage.scope, filter_values: ['private'] },
      basis: { ...summary.fieldwork_coverage.basis, identifiers: ['private'] },
      dimensions: summary.fieldwork_coverage.dimensions.map(row => ({ ...row, raw_values: ['private'] })),
      ui: { ...summary.fieldwork_coverage.ui, export_url: 'https://private.example.test' },
      limitations: summary.fieldwork_coverage.limitations.map(note => ({ ...note, private: true })) };
    expect(read(summary, report)).toEqual(summary.fieldwork_coverage);
    expect(report.email).toBe('private@example.test');
  });
});

describe('coverage filter presence', () => {
  it('matches only the backend analysis filter keys', () => {
    expect(hasSurveyFieldworkFilters({ data_mode: 'synthetic', exclude_demo: true })).toBe(false);
    expect(hasSurveyFieldworkFilters({ barrio: '', canal: null, desde: undefined })).toBe(false);
    expect(hasSurveyFieldworkFilters({ desde: '2026-09-01' })).toBe(true);
    expect(hasSurveyFieldworkFilters({ bbox: [0, 0, 1, 1] })).toBe(true);
  });
});
