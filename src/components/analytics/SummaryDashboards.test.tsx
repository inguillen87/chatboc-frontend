import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { AnalyticsSummary } from '@/services/analyticsService';
import MunicipioDashboard from './MunicipioDashboard';
import PymeDashboard from './PymeDashboard';

const data = (kpis: Partial<AnalyticsSummary['kpis']> = {}): AnalyticsSummary => ({
  kpis: { total_interactions: 17, active_users: 5, avg_response_time_s: 2, ...kpis },
  top_categories: [], volume_by_day: [], heatmap_points: [], insights: [],
});

const card = (title: string) => screen.getByRole('heading', { name: title }).parentElement?.parentElement as HTMLElement;
const views = [
  { title: 'Reclamos Abiertos', Component: MunicipioDashboard, field: 'backlog_open', suffix: '' },
  { title: 'SLA Vencido', Component: MunicipioDashboard, field: 'sla_breaches', suffix: '' },
  { title: 'Conversión', Component: PymeDashboard, field: 'conversion_rate', suffix: '%' },
] as const;

afterEach(cleanup);

describe.each(views)('optional $field in $title', ({ title, Component, field, suffix }) => {
  it.each([undefined, Number.NaN, Number.POSITIVE_INFINITY])('shows unavailable for an absent or invalid value %s', (value) => {
    render(<Component data={data({ [field]: value })} />);
    expect(card(title)).toHaveTextContent('No disponible');
    expect(card(title)).not.toHaveTextContent(/0|%/);
  });

  it.each([0, 9])('preserves the supplied measured value %s', (value) => {
    render(<Component data={data({ [field]: value })} />);
    expect(card(title)).toHaveTextContent(`${value}${suffix}`);
    expect(card(title)).not.toHaveTextContent('No disponible');
    if (!suffix) expect(card(title)).not.toHaveTextContent('%');
  });
});
