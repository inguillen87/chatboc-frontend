import { describe, expect, it } from 'vitest';
import fixtures from '../../tests/fixtures/analytics-evidence.json';
import { formatCompletionPercent, readAnalyticsEvidence } from './surveyAnalyticsEvidence';
const source = () => structuredClone(fixtures.low);
const read = (value: unknown, summary: unknown = fixtures.low, surveyId: unknown = 301, tenantId: unknown = 7) =>
  readAnalyticsEvidence(value, surveyId, tenantId, summary);

describe('canonical percentage units', () => {
  it.each([[0, '0.0%'], [0.5, '0.5%'], [0.88, '0.9%'], [1, '1.0%'], [1.01, '1.0%'], [88, '88.0%'], [100, '100.0%']])('formats %s as percentage points', (value, expected) => {
    expect(formatCompletionPercent(value, 200)).toBe(expected);
  });
  it.each([-1, 101, Infinity, NaN, true, '0.5', null, undefined])('does not clamp or fabricate %s', value => {
    expect(formatCompletionPercent(value, 200)).toBe('\u2014');
  });
  it('does not display zero percent when there are no records', () => { expect(formatCompletionPercent(0, 0)).toBe('\u2014'); });
});

describe('backend analytics evidence contract', () => {
  it.each(Object.keys(fixtures) as Array<keyof typeof fixtures>)('accepts exact backend %s payload', key => {
    const summary = fixtures[key];
    expect(read(summary.analytics_evidence, summary)).toEqual(summary.analytics_evidence);
  });
  it.each([[302,7], [301,8], [null,7], [301,null], ['301',7]])('rejects mismatched or absent identity %s / %s', (sid, tid) => {
    expect(read(fixtures.low.analytics_evidence, fixtures.low, sid, tid)).toBeNull();
  });
  it('rejects a report attached to a different summary', () => {
    expect(read(fixtures.low.analytics_evidence, {...fixtures.low, total_respuestas: 201})).toBeNull();
  });
  it.each([null, undefined, [], {}, {...fixtures.low.analytics_evidence, contract_version:'unknown'}])('does not synthesize a missing report %#', value => {
    expect(read(value)).toBeNull();
  });
  it('accepts the backend rounding at a half-cent tie without accepting an incorrect ratio', () => {
    const summary=structuredClone(fixtures.partial);
    summary.total_respuestas=800;summary.participantes_unicos=800;summary.respuestas_completas=640;
    Object.assign(summary.analytics_evidence.basis,{selected_records:800,detail_records:1,complete_records:640,detail_coverage_percent:0.12});
    summary.analytics_evidence.cards[0].value=800;summary.analytics_evidence.cards[1].value=800;
    expect(read(summary.analytics_evidence,summary)).not.toBeNull();
    summary.analytics_evidence.basis.detail_coverage_percent=0.14;
    expect(read(summary.analytics_evidence,summary)).toBeNull();
  });
  it('rejects sample and denominator contradictions', () => {
    for (const update of [{detail_records:201}, {detail_limit:2}, {partial:true}, {detail_coverage_percent:99}, {complete_records:201}]) {
      const summary = source();Object.assign(summary.analytics_evidence.basis, update);
      expect(read(summary.analytics_evidence)).toBeNull();
    }
  });
  it('rejects nonfinite metrics, unsupported units, and changed meanings', () => {
    for (const update of [{value:Infinity}, {value:50}, {unit:'fraction'}, {basis:'observed'}]) {
      const summary=structuredClone(fixtures.partial);Object.assign(summary.analytics_evidence.cards[2], update);
      expect(read(summary.analytics_evidence,summary)).toBeNull();
    }
  });
  it('does not accept population inference or a fabricated precision value', () => {
    expect(read({...fixtures.low.analytics_evidence,inference_authorized:true})).toBeNull();
    expect(read({...fixtures.low.analytics_evidence,margin_of_error:3})).toBeNull();
  });
  it('strips unknown fields without mutating the input', () => {
    const summary=source(); const report={...summary.analytics_evidence, email:'private@example.test', respondent:{name:'private'}};
    const parsed=read(report);
    expect(parsed).toEqual(fixtures.low.analytics_evidence);
    expect(JSON.stringify(parsed)).not.toContain('private');
    expect(report.email).toBe('private@example.test');
  });
  it('requires all server-owned labels and bounded, control-free text', () => {
    const summary=source();
    delete (summary.analytics_evidence.ui as Record<string, unknown>).heading;
    expect(read(summary.analytics_evidence)).toBeNull();
    expect(read({...fixtures.low.analytics_evidence, ui:{...fixtures.low.analytics_evidence.ui,heading:'x'.repeat(1801)}})).toBeNull();
    expect(read({...fixtures.low.analytics_evidence, ui:{...fixtures.low.analytics_evidence.ui,heading:'x\u0000y'}})).toBeNull();
  });
  it('rejects duplicate explanation IDs or unbounded lists', () => {
    const summary=source();summary.analytics_evidence.limitations[1].id=summary.analytics_evidence.limitations[0].id;
    expect(read(summary.analytics_evidence)).toBeNull();
    expect(read({...fixtures.low.analytics_evidence,facts:[]})).toBeNull();
  });
});
