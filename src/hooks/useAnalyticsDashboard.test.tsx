import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const analyticsMocks = vi.hoisted(() => ({
  summary: vi.fn(),
  timeseries: vi.fn(),
  breakdown: vi.fn(),
  heatmap: vi.fn(),
  points: vi.fn(),
  top: vi.fn(),
  operations: vi.fn(),
  cohorts: vi.fn(),
  templates: vi.fn(),
  filters: {
    tenantId: 'junin',
    from: '2026-09-01',
    to: '2026-09-05',
    canal: [],
    categoria: [],
    estado: [],
    agente: [],
    zona: [],
    etiquetas: [],
    bbox: null,
    search: '',
  },
}));

vi.mock('@/context/AnalyticsFiltersContext', () => ({
  useAnalyticsFilters: () => ({
    filters: analyticsMocks.filters,
  }),
}));

vi.mock('@/services/analyticsService', () => ({
  analyticsService: analyticsMocks,
}));

import { useAnalyticsDashboard } from './useAnalyticsDashboard';

const emptyResponses = () => {
  analyticsMocks.summary.mockResolvedValue({
    generatedAt: '2026-09-05T12:00:00.000Z',
    tenantId: 'junin',
    totals: { tickets: 0, abiertos: 0, backlog: 0, adjuntos: 0 },
    sla: {},
    efficiency: {},
    volume: { perDay: [], byChannel: [], byCategory: [], byZone: [] },
    quality: { byType: [], byAgent: [] },
  });
  analyticsMocks.timeseries.mockResolvedValue({ metric: 'tickets_total', group: 'categoria', series: [] });
  analyticsMocks.breakdown.mockImplementation(({ dimension }: { dimension: string }) =>
    Promise.resolve({ dimension, items: [] }),
  );
  analyticsMocks.heatmap.mockResolvedValue({ points: [], cells: [], hotspots: [], chronic: [] });
  analyticsMocks.points.mockResolvedValue({ points: [] });
  analyticsMocks.top.mockResolvedValue({ subject: 'zonas', items: [] });
  analyticsMocks.operations.mockResolvedValue({
    abiertos: 0,
    slaBreaches: 0,
    automated: 0,
    agingBuckets: {},
    agents: [],
  });
  analyticsMocks.cohorts.mockResolvedValue({ cohorts: [] });
  analyticsMocks.templates.mockResolvedValue({ templates: [] });
};

describe('useAnalyticsDashboard operational data boundary', () => {
  beforeEach(() => {
    [
      analyticsMocks.summary,
      analyticsMocks.timeseries,
      analyticsMocks.breakdown,
      analyticsMocks.heatmap,
      analyticsMocks.points,
      analyticsMocks.top,
      analyticsMocks.operations,
      analyticsMocks.cohorts,
      analyticsMocks.templates,
    ].forEach((mock) => mock.mockReset());
    emptyResponses();
  });

  it('keeps an authenticated empty dashboard empty instead of fabricating demo metrics', async () => {
    const { result } = renderHook(() => useAnalyticsDashboard('municipio'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data.summary).toBeNull();
    expect(result.current.data.heatmap).toBeNull();
    expect(result.current.data.points).toBeNull();
    expect(result.current.data.operations).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.warning).toContain('No hay actividad real para este periodo');
    expect(result.current.warning).toContain('no se muestran datos de ejemplo');
  });

  it('preserves real partial data while identifying failed sections', async () => {
    analyticsMocks.summary.mockResolvedValue({
      generatedAt: '2026-09-05T12:00:00.000Z',
      tenantId: 'junin',
      totals: { tickets: 12, abiertos: 4, backlog: 2, adjuntos: 1 },
      sla: {},
      efficiency: {},
      volume: { perDay: [], byChannel: [], byCategory: [], byZone: [] },
      quality: { byType: [], byAgent: [] },
    });
    analyticsMocks.heatmap.mockRejectedValue(new Error('map unavailable'));

    const { result } = renderHook(() => useAnalyticsDashboard('municipio'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data.summary?.totals.tickets).toBe(12);
    expect(result.current.data.heatmap).toBeNull();
    expect(result.current.warning).toContain('mapa de calor');
    expect(result.current.warning).not.toContain('datos de ejemplo');
  });
});
