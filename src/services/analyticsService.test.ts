import { describe, expect, it, vi, beforeEach } from 'vitest';

const apiFetchMock = vi.fn();

vi.mock('@/utils/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  ApiError: class ApiError extends Error {
    status: number;
    body?: unknown;
    constructor(message: string, status = 500) {
      super(message);
      this.status = status;
    }
  },
}));

import { analyticsService } from '@/services/analyticsService';
import { ApiError } from '@/utils/api';

describe('analyticsService.getSummary', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('normalizes totals.total_interactions when kpis are missing', async () => {
    apiFetchMock.mockResolvedValue({
      totals: { total_interactions: 12, active_users: 7 },
      top_categories: [{ category: 'A', count: 2 }],
    });

    const result = await analyticsService.getSummary({ tenant_id: 1, scope: 'municipio' });

    expect(result.kpis.total_interactions).toBe(12);
    expect(result.kpis.active_users).toBe(7);
    expect(result.volume_by_day).toEqual([]);
  });
});


describe('analyticsService.getHub', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('falls back across hub aliases and returns navigation when primary endpoint is unavailable', async () => {
    apiFetchMock
      .mockRejectedValueOnce(new ApiError('forbidden', 403))
      .mockResolvedValueOnce({
        sections: {
          general: { totals: { total_interactions: 99 } },
        },
        navigation: {
          primary: [{ key: 'encuestas', path: '/admin/encuestas', active: false }],
        },
      });

    const hub = await analyticsService.getHub({ scope: 'municipio' });

    expect(apiFetchMock).toHaveBeenNthCalledWith(1, '/api/admin/analytics/hub?scope=municipio', expect.any(Object));
    expect(apiFetchMock).toHaveBeenNthCalledWith(2, '/api/admin/analytics/dashboard?scope=municipio', expect.any(Object));
    expect(hub?.navigation?.primary?.[0]?.key).toBe('encuestas');
  });

  it('uses hub general section to normalize summary before overview fallback', async () => {
    apiFetchMock.mockResolvedValueOnce({
      sections: {
        general: {
          totals: { total_interactions: 21, active_users: 11 },
        },
      },
    });

    const result = await analyticsService.getSummary({ scope: 'municipio', context: 'overview' });

    expect(result.kpis.total_interactions).toBe(21);
    expect(result.kpis.active_users).toBe(11);
  });

  it('falls back to legacy overview when hub section is an empty placeholder', async () => {
    apiFetchMock
      .mockResolvedValueOnce({ sections: { general: {} } })
      .mockResolvedValueOnce({ totals: { total_interactions: 33, active_users: 12 } });

    const result = await analyticsService.getSummary({ scope: 'municipio', context: 'overview' });

    expect(result.kpis.total_interactions).toBe(33);
    expect(apiFetchMock).toHaveBeenNthCalledWith(2, '/admin/analytics/overview?scope=municipio', expect.any(Object));
  });

  it('builds realtime hub query with tenant_id, scope and window_minutes', async () => {
    apiFetchMock.mockResolvedValueOnce({ totals: { events: 10 } });

    const result = await analyticsService.getRealtimeHub({ tenant_id: 7, scope: 'municipio', window_minutes: 30, tenantSlug: 'demo' });

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/admin/analytics/realtime-hub?tenant_id=7&scope=municipio&window_minutes=30',
      expect.objectContaining({ tenantSlug: 'demo' }),
    );
    expect(result?.totals?.events).toBe(10);
  });

  it('passes heatmap segmentation filters to query params', async () => {
    apiFetchMock
      .mockResolvedValueOnce({ sections: {} })
      .mockResolvedValueOnce({ points: [] });

    await analyticsService.getHeatmap({
      tenant_id: 44,
      scope: 'municipio',
      categoria: 'seguridad',
      sexo: 'f',
      rango_edad: '25-34',
      barrio: 'centro',
      distrito: 'norte',
      canal: 'voice',
      categorias: ['reclamos', 'pedidos'],
      geo_limit: 1200,
      bbox: '-58.55,-34.72,-58.31,-34.52',
    });

    const [, heatmapUrl] = apiFetchMock.mock.calls.map((call) => call[0] as string);
    expect(heatmapUrl).toContain('/admin/analytics/heatmap?');
    expect(heatmapUrl).toContain('tenant_id=44');
    expect(heatmapUrl).toContain('scope=municipio');
    expect(heatmapUrl).toContain('categoria=seguridad');
    expect(heatmapUrl).toContain('sexo=f');
    expect(heatmapUrl).toContain('rango_edad=25-34');
    expect(heatmapUrl).toContain('barrio=centro');
    expect(heatmapUrl).toContain('distrito=norte');
    expect(heatmapUrl).toContain('canal=voice');
    expect(heatmapUrl).toContain('geo_limit=1200');
    expect(heatmapUrl).toContain('bbox=-58.55%2C-34.72%2C-58.31%2C-34.52');
    expect(heatmapUrl).toContain('categorias=reclamos');
    expect(heatmapUrl).toContain('categorias=pedidos');
  });


  it('falls back to geo_layers category points when root points are missing', async () => {
    apiFetchMock
      .mockResolvedValueOnce({ sections: {} })
      .mockResolvedValueOnce({
        geo_layers: {
          categories: [
            {
              categoria: 'seguridad',
              points: [{ lat: -34.6, lng: -58.38, weight: 4 }],
            },
          ],
        },
      });

    const heatmap = await analyticsService.getHeatmap({ scope: 'municipio' });

    expect(heatmap.points).toHaveLength(1);
    expect(heatmap.points[0]?.categoria).toBe('seguridad');
    expect(heatmap.points[0]?.weight).toBe(4);
  });

  it('normalizes heatmap geo_layers and segments from hub mapas.geo', async () => {
    apiFetchMock.mockResolvedValueOnce({
      sections: {
        mapas: {
          geo: {
            points: [{ lat: -34.6, lng: -58.38, weight: 8 }],
            geo_layers: {
              categories: [{ categoria: 'seguridad', color: '#EF4444', event_count: 12 }],
            },
            segments: {
              sexo: [{ label: 'f', count: 7 }],
            },
          },
        },
      },
    });

    const heatmap = await analyticsService.getHeatmap({ scope: 'municipio' });

    expect(heatmap.points).toHaveLength(1);
    expect(heatmap.geo_layers?.categories?.[0]?.categoria).toBe('seguridad');
    expect(heatmap.segments?.sexo?.[0]?.label).toBe('f');
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });

  it('extracts points from nested category_layers and hotspots payloads', async () => {
    apiFetchMock
      .mockResolvedValueOnce({ sections: {} })
      .mockResolvedValueOnce({
        payload: {
          category_layers: [
            {
              category: 'alumbrado',
              hotspots: [
                { latitude: -34.61, longitude: -58.37, count: 3 },
              ],
            },
          ],
        },
      });

    const heatmap = await analyticsService.getHeatmap({ scope: 'municipio' });

    expect(heatmap.points).toHaveLength(1);
    expect(heatmap.points[0]).toEqual({
      lat: -34.61,
      lng: -58.37,
      weight: 3,
      categoria: 'alumbrado',
    });
  });

  it('normalizes severity and state aliases for heatmap points', async () => {
    apiFetchMock
      .mockResolvedValueOnce({ sections: {} })
      .mockResolvedValueOnce({
        points: [
          { latitude: -34.62, longitude: -58.4, count: 9, category: 'seguridad', channel: 'web', severity: 'alta', status: 'abierto' },
          { lat: -34.63, lng: -58.41, weight: 2, categoria: 'alumbrado', canal: 'whatsapp', priority: 'media', state: 'pendiente' },
        ],
      });

    const heatmap = await analyticsService.getHeatmap({ scope: 'municipio' });

    expect(heatmap.points).toHaveLength(2);
    expect(heatmap.points[0]).toEqual({
      lat: -34.62,
      lng: -58.4,
      weight: 9,
      categoria: 'seguridad',
      canal: 'web',
      severidad: 'alta',
      estado: 'abierto',
    });
    expect(heatmap.points[1]).toEqual({
      lat: -34.63,
      lng: -58.41,
      weight: 2,
      categoria: 'alumbrado',
      canal: 'whatsapp',
      severidad: 'media',
      estado: 'pendiente',
    });
  });

});
