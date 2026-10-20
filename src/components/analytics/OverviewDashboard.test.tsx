import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { AnalyticsSummary } from '@/services/analyticsService';
import OverviewDashboard from './OverviewDashboard';

const summary = (): AnalyticsSummary => ({
  kpis: {
    total_interactions: 1376,
    active_users: 89,
    avg_response_time_s: 3.7,
    conversion_rate: 22.5,
    backlog_open: 14,
    sla_breaches: 6,
    voice_interactions_pct: 36.8,
    video_avatar_interactions_pct: 11.2,
    no_typing_completion_rate: 18.9,
    accessibility_usage_rate: 9.3,
  },
  volume_by_day: [
    { date: '2026-10-07', count: 120 },
    { date: '2026-10-08', count: 430 },
    { date: '2026-10-09', count: 95 },
  ],
  top_categories: [{ category: 'Turnos', count: 12 }, { category: 'Reclamos', count: 61 }],
  heatmap_points: [],
  insights: [],
});

const tile = (title: string) => {
  const heading = screen.getByRole('heading', { name: title, exact: true, hidden: true });
  return heading.closest('.group') as HTMLElement;
};

afterEach(cleanup);

describe('OverviewDashboard period evidence', () => {
  it('shows supplied period metrics and SLA as a count without fabricated comparisons', () => {
    render(<OverviewDashboard data={summary()} showSla showConversion />);

    expect(tile('Interacciones')).toHaveTextContent('1.376');
    expect(tile('Usuarios activos')).toHaveTextContent('89');
    expect(tile('Tiempo respuesta')).toHaveTextContent('3,7s');
    expect(tile('Conversión')).toHaveTextContent('22,5%');
    expect(tile('Tickets abiertos')).toHaveTextContent('14');
    expect(within(tile('Fuera de SLA')).getByText('6')).toBeInTheDocument();
    expect(tile('Fuera de SLA')).not.toHaveTextContent('%');
    expect(screen.getByRole('region', { name: 'Indicadores del período' })).not.toHaveTextContent(/12\.4%|8\.1%|5\.6%|4\.2%|▲|▼/);
  });

  it('keeps actual series volume, peak and category leader beside the charts', () => {
    render(<OverviewDashboard data={summary()} />);

    expect(screen.getByText('Volumen de la serie').nextElementSibling).toHaveTextContent('645');
    expect(screen.getByText('Pico diario').nextElementSibling).toHaveTextContent('430 · 2026-10-08');
    expect(screen.getByText('Categoría líder').nextElementSibling).toHaveTextContent('Reclamos · 61 tickets');
    expect(screen.queryByText('Volumen total')).not.toBeInTheDocument();
  });

  it('moves channel and accessibility details after the charts and starts them collapsed', () => {
    render(<OverviewDashboard data={summary()} />);
    const disclosure = screen.getByText('Canales y accesibilidad');

    expect(disclosure.closest('details')).not.toHaveAttribute('open');
    expect(screen.getByText('Interacciones por voz')).not.toBeVisible();
    expect(screen.getByRole('heading', { name: 'Top categorías' }).compareDocumentPosition(disclosure) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(disclosure);
    expect(disclosure.closest('details')).toHaveAttribute('open');
    expect(screen.getByText('Interacciones por voz')).toBeVisible();
    expect(tile('Interacciones por voz')).toHaveTextContent('36,8%');
    expect(tile('Video / avatar')).toHaveTextContent('11,2%');
    expect(tile('Finalización sin escribir')).toHaveTextContent('18,9%');
    expect(tile('Uso de accesibilidad')).toHaveTextContent('9,3%');
  });

  it('renders absent optional metrics as unavailable without estimating zero or adding a percent sign', () => {
    const data = summary();
    data.kpis = { total_interactions: 15, active_users: 9, avg_response_time_s: 2 };
    render(<OverviewDashboard data={data} showSla showConversion />);

    for (const title of ['Conversión', 'Tickets abiertos', 'Fuera de SLA', 'Interacciones por voz', 'Video / avatar', 'Finalización sin escribir', 'Uso de accesibilidad']) {
      expect(tile(title)).toHaveTextContent('No disponible');
      expect(tile(title)).not.toHaveTextContent(/0|%/);
    }
  });

  it('keeps supplied zero values distinct from missing metrics and missing series', () => {
    const data = summary();
    data.kpis = {
      total_interactions: 0, active_users: 0, avg_response_time_s: 0,
      conversion_rate: 0, backlog_open: 0, sla_breaches: 0,
      voice_interactions_pct: 0, video_avatar_interactions_pct: 0,
      no_typing_completion_rate: 0, accessibility_usage_rate: 0,
    };
    data.volume_by_day = [{ date: '2026-10-09', count: 0 }];
    data.top_categories = [{ category: 'Turnos', count: 0 }];
    render(<OverviewDashboard data={data} showSla showConversion />);

    expect(tile('Conversión')).toHaveTextContent('0%');
    expect(tile('Fuera de SLA')).toHaveTextContent('0');
    expect(tile('Interacciones por voz')).toHaveTextContent('0%');
    expect(screen.getByText('Volumen de la serie').nextElementSibling).toHaveTextContent('0');
    expect(screen.getByText('Pico diario').nextElementSibling).toHaveTextContent('0 · 2026-10-09');
    expect(screen.getByText('Categoría líder').nextElementSibling).toHaveTextContent('Turnos · 0 tickets');
    expect(screen.queryByText('No disponible')).not.toBeInTheDocument();
  });

  it('does not present empty series or non-finite optional values as measured zero', () => {
    const data = summary();
    data.volume_by_day = [];
    data.top_categories = [];
    data.kpis.conversion_rate = Number.NaN;
    data.kpis.sla_breaches = Number.POSITIVE_INFINITY;
    render(<OverviewDashboard data={data} showSla showConversion />);

    expect(tile('Conversión')).toHaveTextContent('No disponible');
    expect(tile('Fuera de SLA')).toHaveTextContent('No disponible');
    expect(screen.getByText('Volumen de la serie').nextElementSibling).toHaveTextContent('No disponible');
    expect(screen.getByText('Pico diario').nextElementSibling).toHaveTextContent('No disponible');
    expect(screen.getByText('Categoría líder').nextElementSibling).toHaveTextContent('No disponible');
    expect(screen.getByText('No hay datos de volumen disponibles para este período.')).toBeInTheDocument();
    expect(screen.getByText('No hay categorías disponibles para este período.')).toBeInTheDocument();
  });

  it('only exposes conversion and SLA cards when their existing flags are enabled', () => {
    render(<OverviewDashboard data={summary()} />);
    expect(screen.queryByRole('heading', { name: 'Conversión' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Tickets abiertos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Fuera de SLA' })).not.toBeInTheDocument();
  });
});
