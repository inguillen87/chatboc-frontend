import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import fixtures from '../../../tests/fixtures/survey-segment-compare.json';
import { readSurveySegmentComparison } from '@/utils/surveySegmentCompare';
import { SurveySegmentComparison, formatSegmentDelta } from './SurveySegmentComparison';

afterEach(cleanup);
const report = (key: keyof typeof fixtures = 'main') => {
  const value = fixtures[key]; const scope = value.scope;
  return readSurveySegmentComparison(value, { surveyId: scope.survey_id, tenantId: scope.tenant_id,
    mode: scope.mode as 'real' | 'synthetic', globalFilters: scope.global_filters, segmentA: scope.segment_a_filters, segmentB: scope.segment_b_filters })!;
};
describe('survey comparison with explicit denominators', () => {
  it('shows option percentages, count/base and signed point differences', () => {
    const comparison = report(); const { container } = render(<SurveySegmentComparison comparison={comparison} />);
    expect(screen.getByRole('heading', { name: comparison.ui.heading })).toBeVisible();
    expect(screen.getByTestId('survey-segment-compare')).toHaveAttribute('data-selected-records', '600');
    const question = comparison.questions[0]; const option = question.options[0];
    const row = container.querySelector(`[data-question-id="${question.id}"] [data-option-id="${option.id}"]`)! as HTMLElement;
    expect(row).toHaveTextContent(`${option.segment_a_count} / ${question.segment_a_answered}`);
    expect(within(row).getByText('100 %')).toBeVisible();
    expect(within(row).getByText('+49,9 p.p.')).toBeVisible();
    expect(screen.getByText(new RegExp(comparison.ui.conflicts))).toBeVisible();
  });
  it('distinguishes overlapping group membership without adding the groups together', () => {
    const comparison = report('overlap'); render(<SurveySegmentComparison comparison={comparison} />);
    const label = screen.getByText(comparison.ui.overlap);
    expect(label.parentElement).toHaveTextContent(String(comparison.basis.overlap_records));
  });
  it('renders empty bases with unavailable rates and no made-up delta', () => {
    const comparison = report('empty'); render(<SurveySegmentComparison comparison={comparison} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.queryByText('0 p.p.')).toBeNull();
  });
  it('uses a keyboard-native disclosure for limitations and has no export action', () => {
    const comparison = report(); const { container } = render(<SurveySegmentComparison comparison={comparison} />);
    const details = container.querySelector('details')!;
    expect(details.querySelector('summary')).toHaveTextContent(comparison.ui.details);
    expect(details).not.toHaveAttribute('open'); details.open = true;
    expect(within(details).getByText(comparison.limitations[0].detail)).toBeVisible();
    expect(screen.queryByRole('button')).toBeNull(); expect(screen.queryByRole('link')).toBeNull();
  });
  it('formats A minus B in points including negative and unavailable values', () => {
    expect(formatSegmentDelta(50, 'p.p.')).toBe('+50 p.p.');
    expect(formatSegmentDelta(-50, 'p.p.')).toBe('-50 p.p.');
    expect(formatSegmentDelta(null, 'p.p.')).toBe('—');
  });
});
