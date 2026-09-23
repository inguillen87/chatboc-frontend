import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import fixtures from '../../../tests/fixtures/analytics-evidence.json';
import { readAnalyticsEvidence } from '@/utils/surveyAnalyticsEvidence';
import { SurveyAnalyticsEvidence } from './SurveyAnalyticsEvidence';

afterEach(cleanup);
const report=(key: keyof typeof fixtures='low') => readAnalyticsEvidence(fixtures[key].analytics_evidence,301,7,fixtures[key])!;
describe('visible survey measurement basis',()=>{
  it('renders 0.5 percent without a factor-of-100 error',()=>{
    render(<SurveyAnalyticsEvidence evidence={report()} />);
    expect(screen.getByText('0,5 %')).toBeVisible();
    expect(screen.queryByText('50 %')).toBeNull();
  });
  it('marks an estimate and discloses its recent subset and denominator',()=>{
    const data=report('partial'); render(<SurveyAnalyticsEvidence evidence={data} />);
    expect(screen.getByText(/80 %/)).toHaveTextContent('\u2248 80 %');
    expect(screen.getByText('500 / 1.200')).toBeVisible();
    expect(screen.getByRole('progressbar')).toHaveAttribute('value','41.67');
    fireEvent.click(screen.getByText(data.ui.details));
    expect(screen.getByText(data.limitations.find(n=>n.id==='recent_subset')!.detail)).toBeInTheDocument();
  });
  it('does not calculate completion or processing coverage for an empty base',()=>{
    render(<SurveyAnalyticsEvidence evidence={report('empty')} />);
    expect(screen.getByText('\u2014')).toBeVisible();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
  it('distinguishes a synthetic view without an inference claim',()=>{
    const data=report('synthetic');render(<SurveyAnalyticsEvidence evidence={data} />);
    expect(screen.getByText(data.ui.mode)).toBeVisible();
    expect(screen.getByTestId('analytics-evidence')).toHaveAttribute('data-mode','synthetic');
    fireEvent.click(screen.getByText(data.ui.details));
    expect(screen.getByText(data.limitations[0].detail)).toBeInTheDocument();
  });
  it('uses the server copy and escapes markup-like content',()=>{
    const data=report();data.ui.heading='Panel de evidencia publicado';data.cards[0].label='<img src=x onerror=alert(1)>';
    const {container}=render(<SurveyAnalyticsEvidence evidence={data} />);
    expect(screen.getByRole('heading',{name:data.ui.heading})).toBeVisible();
    expect(screen.getByText(data.cards[0].label)).toBeVisible();
    expect(container.querySelector('img')).toBeNull();
  });
  it('does not introduce an unaudited report export or disclosure of raw filters',()=>{
    const data=report('partial');render(<SurveyAnalyticsEvidence evidence={data} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByText('web',{exact:true})).toBeNull();
  });
});
