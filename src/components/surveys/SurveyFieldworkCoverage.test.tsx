import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import fixtures from '../../../tests/fixtures/survey-fieldwork-coverage.json';
import { readSurveyFieldworkCoverage } from '@/utils/surveyFieldworkCoverage';
import { SurveyFieldworkCoverage } from './SurveyFieldworkCoverage';

afterEach(cleanup);
const report = (key: keyof typeof fixtures = 'partial') => {
  const summary = fixtures[key]; const { survey_id, tenant_id, filtered } = summary.fieldwork_coverage.scope;
  return readSurveyFieldworkCoverage(summary.fieldwork_coverage, survey_id, tenant_id, summary, filtered)!;
};

describe('visible segmentation coverage', () => {
  it('shows the recorded numerator and selected denominator for every dimension', () => {
    const coverage = report(); render(<SurveyFieldworkCoverage coverage={coverage} />);
    const panel = screen.getByTestId('survey-fieldwork-coverage');
    expect(panel).toHaveAttribute('data-selected-records', String(coverage.basis.selected_records));
    expect(screen.getByRole('heading', { name: coverage.ui.heading })).toBeVisible();
    for (const dimension of coverage.dimensions) {
      const row = panel.querySelector(`[data-dimension="${dimension.id}"]`)! as HTMLElement;
      expect(within(row).getByRole('heading', { name: dimension.label })).toBeVisible();
      expect(row).toHaveTextContent(`${dimension.recorded_count} / ${coverage.basis.selected_records}`);
      expect(within(row).getByText(coverage.ui.missing)).toBeVisible();
    }
  });
  it('uses neutral server-owned explanations and a native keyboard disclosure', () => {
    const coverage = report(); const { container } = render(<SurveyFieldworkCoverage coverage={coverage} />);
    const details = container.querySelector('details')!;
    expect(details).not.toHaveAttribute('open');
    expect(details.querySelector('summary')).toHaveTextContent(coverage.ui.details);
    details.open = true;
    expect(within(details).getByText(coverage.dimensions[0].detail)).toBeVisible();
    expect(within(details).getByText(coverage.limitations[0].detail)).toBeVisible();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });
  it('shows unavailable percentages and the backend explanation for an empty base', () => {
    const coverage = report('empty'); render(<SurveyFieldworkCoverage coverage={coverage} />);
    expect(screen.getByRole('status')).toHaveTextContent(coverage.ui.empty);
    expect(screen.getAllByText('—')).toHaveLength(9);
    expect(screen.queryByText('0 %')).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
  it('preserves source mode without treating synthetic counts as real responses', () => {
    const coverage = report('synthetic'); render(<SurveyFieldworkCoverage coverage={coverage} />);
    expect(screen.getByTestId('survey-fieldwork-coverage')).toHaveAttribute('data-mode', 'synthetic');
    expect(screen.getByText(coverage.ui.description)).toBeVisible();
  });
  it('escapes server-provided markup and uses its copy without institutional defaults', () => {
    const coverage = report(); coverage.ui.heading = '<img src=x onerror=alert(1)>';
    const { container } = render(<SurveyFieldworkCoverage coverage={coverage} />);
    expect(screen.getByRole('heading', { name: coverage.ui.heading })).toBeVisible();
    expect(container.querySelector('img')).toBeNull();
  });
});
