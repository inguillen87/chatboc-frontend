import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ api: vi.fn(), heatmap: vi.fn() }));
vi.mock('@/utils/api', () => ({ apiFetch: mocks.api, ApiError: class extends Error { status = 500; } }));
vi.mock('@/hooks/useRequireRole', () => ({ default: () => null }));
vi.mock('@/components/analytics/ExecutiveMayorTrafficLight', () => ({ default: () => null }));
vi.mock('@/components/analytics/Heatmap', () => ({ AnalyticsHeatmap: () => <div>Mapa</div> }));
vi.mock('@/components/TicketStatsCharts', () => ({ default: () => null }));
vi.mock('@/services/exportService', () => ({ exportMunicipalAnalyticsExcel: vi.fn(), exportMunicipalAnalyticsPdf: vi.fn() }));
vi.mock('@/utils/endpointAvailability', () => ({ isEndpointMarkedUnavailable: () => false, markEndpointUnavailable: vi.fn(), clearEndpointUnavailable: vi.fn() }));
vi.mock('@/services/statsService', () => ({ getHeatmapDataset: mocks.heatmap, getTicketStats: async () => ({ charts: [] }), getMunicipalTicketStates: async () => [] }));
vi.mock('recharts', () => Object.fromEntries(['ResponsiveContainer', 'BarChart', 'Bar', 'XAxis', 'YAxis', 'Tooltip', 'Legend', 'PieChart', 'Pie', 'Cell'].map(name => [name, () => null])));
import MunicipalAnalytics from './MunicipalAnalytics';
beforeEach(() => {
  mocks.api.mockResolvedValue({ municipalities: [{ name: 'Organización', totalTickets: 10, categories: {}, averageResponseHours: null }] });
  mocks.heatmap.mockResolvedValue({ points: [{ lat: -33, lng: -68, weight: 1000 }], raw: {} });
});
afterEach(cleanup);
describe('municipal metric availability', () => {
  it('keeps absent response time and geographic coverage unavailable even when intensity is high', async () => {
    render(<MunicipalAnalytics />);
    await screen.findByText('Analíticas Profesionales');
    expect(screen.getAllByText('No disponible')).toHaveLength(2);
    expect(screen.getByText('Cobertura geo').parentElement).toHaveTextContent('No informada');
    expect(screen.queryByText('0 h')).not.toBeInTheDocument();
  });
  it.each(['coverage_pct', 'coordinate_coverage_pct'])('shows only explicit %s and preserves a real zero response time', async field => {
    mocks.api.mockResolvedValue({ municipalities: [{ name: 'Organización', totalTickets: 10, categories: {}, averageResponseHours: 0 }] });
    mocks.heatmap.mockResolvedValue({ points: [{ lat: -33, lng: -68, weight: 1000 }], raw: { location_quality: { total: 200, with_coordinates: 1, without_coordinates: 199, [field]: 0.5 } } });
    render(<MunicipalAnalytics />);
    await screen.findByText('Analíticas Profesionales');
    expect(screen.getByText('Cobertura geo').parentElement).toHaveTextContent('0,5%');
    expect(screen.getByText('0.0 h')).toBeVisible();
  });
});
