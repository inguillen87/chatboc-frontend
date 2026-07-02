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

  it('uses operations heatmap v2 and preserves cells, hotspots, segments and geocoding candidates', async () => {
    apiFetchMock.mockResolvedValueOnce({
      contract_version: 'operations.heatmap.v1',
      request_id: 'req-ops-heatmap',
      points: [
        {
          lat: '-34.6',
          lng: '-58.38',
          weight: '2',
          categoria: 'seguridad',
          genero: 'femenino',
          rango_edad: '25-34',
          source: 'tickets',
          actions: [
            { id: 'open_record', label: 'Abrir ticket', method: 'GET', endpoint: '/api/v2/tickets/91' },
            {
              id: 'update_location',
              label: 'Actualizar ubicacion',
              method: 'PATCH',
              endpoint: '/api/v2/tickets/91',
              requires: ['location.lat', 'location.lng'],
              body_template: { location: { lat: 'number', lng: 'number' } },
            },
          ],
        },
        {
          direccion: 'Calle sin coordenadas',
          categoria: 'seguridad',
        },
      ],
      cells: [
        {
          key: 'cell-1',
          count: 3,
          actions: [{ id: 'open_cell', label: 'Abrir celda', action_type: 'client_filter', target: { type: 'cell', cell_id: 'cell-1' } }],
        },
      ],
      hotspots: [{ key: 'hot-1', weight: 8 }],
      category_layers: [{ key: 'seguridad', label: 'Seguridad', count: 3 }],
      segments: {
        genero: [{ key: 'femenino', label: 'Femenino', count: 1 }],
        source: [{ key: 'tickets', label: 'Tickets', count: 1 }],
      },
      location_quality: {
        with_coordinates: 1,
        without_coordinates: 1,
        coverage_pct: 50,
      },
      geocoding: {
        candidates: [
          {
            ticket_id: 99,
            direccion: 'Calle sin coordenadas',
            actions: [
              { id: 'open_record', label: 'Abrir ticket', method: 'GET', endpoint: '/api/v2/tickets/99' },
              {
                id: 'update_location',
                label: 'Actualizar ubicacion',
                method: 'PATCH',
                endpoint: '/api/v2/tickets/99',
                body_template: { location: { lat: 'number', lng: 'number', address: 'string' } },
              },
            ],
          },
        ],
      },
    });

    const heatmap = await analyticsService.getHeatmap({
      scope: 'municipio',
      tenantSlug: 'junin',
      genero: 'femenino',
      source: 'tickets',
      rango_edad: '25-34',
    });

    const [url, options] = apiFetchMock.mock.calls[0];
    expect(url as string).toContain('/api/v2/analytics/operations/heatmap?');
    expect(url as string).toContain('tenant_slug=junin');
    expect(url as string).toContain('genero=femenino');
    expect(url as string).toContain('source=tickets');
    expect(options).toMatchObject({ tenantSlug: 'junin' });
    expect(heatmap.contract_version).toBe('operations.heatmap.v1');
    expect(heatmap.points).toEqual([
      {
        lat: -34.6,
        lng: -58.38,
        weight: 2,
        categoria: 'seguridad',
        sexo: 'femenino',
        genero: 'femenino',
        rango_edad: '25-34',
        source: 'tickets',
        fuente: 'tickets',
        actions: [
          { id: 'open_record', label: 'Abrir ticket', title: 'Abrir ticket', method: 'GET', endpoint: '/api/v2/tickets/91' },
          {
            id: 'update_location',
            label: 'Actualizar ubicacion',
            title: 'Actualizar ubicacion',
            method: 'PATCH',
            endpoint: '/api/v2/tickets/91',
            requires: ['location.lat', 'location.lng'],
            body_template: { location: { lat: 'number', lng: 'number' } },
          },
        ],
      },
    ]);
    expect(heatmap.cells?.[0]).toMatchObject({
      key: 'cell-1',
      count: 3,
      actions: [{ id: 'open_cell', label: 'Abrir celda', action_type: 'client_filter' }],
    });
    expect(heatmap.hotspots?.[0]).toMatchObject({ key: 'hot-1', weight: 8 });
    expect(heatmap.category_layers?.[0]).toMatchObject({ key: 'seguridad' });
    expect(heatmap.location_quality?.coverage_pct).toBe(50);
    expect(heatmap.geocoding?.candidates?.[0]).toMatchObject({
      ticket_id: 99,
      actions: [
        { id: 'open_record', label: 'Abrir ticket', method: 'GET', endpoint: '/api/v2/tickets/99' },
        {
          id: 'update_location',
          label: 'Actualizar ubicacion',
          method: 'PATCH',
          endpoint: '/api/v2/tickets/99',
          body_template: { location: { lat: 'number', lng: 'number', address: 'string' } },
        },
      ],
    });
  });

  it('builds operations PDF export URL with tenant slug and segment filters', () => {
    const url = analyticsService.exportPdfUrl({
      tenant_id: 7,
      tenantSlug: 'junin',
      categoria: 'seguridad',
      genero: 'femenino',
      rango_edad: '25-34',
      source: 'tickets',
    });

    expect(url).toContain('/api/v2/analytics/operations/export.pdf?');
    expect(url).toContain('tenant_slug=junin');
    expect(url).toContain('tenant=junin');
    expect(url).toContain('categoria=seguridad');
    expect(url).toContain('genero=femenino');
    expect(url).toContain('rango_edad=25-34');
    expect(url).toContain('source=tickets');
  });

  it('supports canonical category/categories query params for geo filters', async () => {
    apiFetchMock
      .mockResolvedValueOnce({ sections: {} })
      .mockResolvedValueOnce({ points: [] });

    await analyticsService.getHeatmap({
      scope: 'municipio',
      category: 'bache',
      categories: ['luz', 'seguridad'],
    });

    const [, heatmapUrl] = apiFetchMock.mock.calls.map((call) => call[0] as string);
    expect(heatmapUrl).toContain('category=bache');
    expect(heatmapUrl).toContain('categories=luz');
    expect(heatmapUrl).toContain('categories=seguridad');
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

  it('uses hub geo_layers even when legacy points are not present', async () => {
    apiFetchMock.mockResolvedValueOnce({
      sections: {
        mapas: {
          geo: {
            geo_layers: {
              contract_version: '2026.04-maplibre-v1',
              source: {
                type: 'FeatureCollection',
                features: [
                  {
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [-58.38, -34.6] },
                    properties: { weight: 8 },
                  },
                ],
              },
              categories: [{ categoria: 'seguridad', color: '#EF4444', event_count: 12 }],
            },
            segments_filters_applied: { canal: 'voice' },
          },
        },
      },
    });

    const heatmap = await analyticsService.getHeatmap({ scope: 'municipio' });

    expect(heatmap.points).toEqual([]);
    expect(heatmap.geo_layers?.source?.features).toHaveLength(1);
    expect(heatmap.geo_layers?.categories?.[0]?.color).toBe('#EF4444');
    expect(heatmap.segments_filters_applied?.canal).toBe('voice');
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });

  it('preserves request_id and map_layers from heatmap payload', async () => {
    apiFetchMock
      .mockResolvedValueOnce({ sections: {} })
      .mockResolvedValueOnce({
        request_id: 'req-geo-123',
        map_layers: {
          contract_version: 'analytics.geo_layers.v1',
          provider: { name: 'openstreetmap' },
          category_heatmap: {
            top_categories: [{ slug: 'bache', label: 'Baches', events: 20 }],
            applied_categories: ['bache'],
          },
        },
        points: [{ lat: -34.6, lng: -58.38, weight: 8 }],
      });

    const heatmap = await analyticsService.getHeatmap({ scope: 'municipio', category: 'bache' });

    expect(heatmap.request_id).toBe('req-geo-123');
    expect(heatmap.map_layers).toMatchObject({
      contract_version: 'analytics.geo_layers.v1',
      provider: { name: 'openstreetmap' },
    });
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

  it('normalizes ticket coordinates and demographic aliases from backend payloads', async () => {
    apiFetchMock
      .mockResolvedValueOnce({ sections: {} })
      .mockResolvedValueOnce({
        points: [
          {
            geo: { lat: '-34.60', lng: '-58.38' },
            metadata: { category: 'turnos', gender: 'femenino', age_range: '25-34', district: 'centro' },
            contact: { barrio: 'microcentro' },
            channel: 'whatsapp',
            status: 'abierto',
          },
          {
            geometry: { type: 'Point', coordinates: [-58.41, -34.62] },
            ticket: { categoria: 'reclamos', estado: 'pendiente' },
            genero: 'masculino',
            rango_edad: '35-44',
          },
        ],
      });

    const heatmap = await analyticsService.getHeatmap({ scope: 'municipio' });

    expect(heatmap.points).toEqual([
      {
        lat: -34.6,
        lng: -58.38,
        categoria: 'turnos',
        canal: 'whatsapp',
        estado: 'abierto',
        sexo: 'femenino',
        genero: 'femenino',
        rango_edad: '25-34',
        barrio: 'microcentro',
        distrito: 'centro',
      },
      {
        lat: -34.62,
        lng: -58.41,
        categoria: 'reclamos',
        estado: 'pendiente',
        sexo: 'masculino',
        genero: 'masculino',
        rango_edad: '35-44',
      },
    ]);
  });

  it('rejects invalid limit values for geo points endpoint before issuing request', async () => {
    await expect(analyticsService.getGeoPoints({ scope: 'municipio', limit: 0 })).rejects.toMatchObject({ status: 400 });
    await expect(analyticsService.getGeoPoints({ scope: 'municipio', limit: 5001 })).rejects.toMatchObject({ status: 400 });
    await expect(analyticsService.getGeoPoints({ scope: 'municipio', limit: 12.3 })).rejects.toMatchObject({ status: 400 });
    expect(apiFetchMock).toHaveBeenCalledTimes(0);
  });

  it('reuses mapas.geo points from hub response for geo points helper when available', async () => {
    apiFetchMock.mockResolvedValueOnce({
      sections: {
        mapas: {
          geo: {
            request_id: 'req-hub-geo-1',
            points: [{ lat: -34.59, lng: -58.41, weight: 5 }],
            map_layers: {
              contract_version: 'analytics.geo_layers.v1',
            },
          },
        },
      },
    });

    const geo = await analyticsService.getGeoPoints({ scope: 'municipio', tenantSlug: 'tenant-a', limit: 100 });

    expect(geo.request_id).toBe('req-hub-geo-1');
    expect(geo.points).toHaveLength(1);
    expect(geo.map_layers).toMatchObject({ contract_version: 'analytics.geo_layers.v1' });
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });

});
