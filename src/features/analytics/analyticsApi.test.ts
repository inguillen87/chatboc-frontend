import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  panelGet: vi.fn(),
}));

vi.mock('@/api/v2/client', () => ({
  panelApi: {
    get: mocks.panelGet,
  },
}));

import { getOperationsHeatmapV2, getPublicMapConfigV1 } from './analyticsApi';

describe('operations heatmap v2 contract', () => {
  beforeEach(() => {
    mocks.panelGet.mockReset();
  });

  it('passes segment filters and normalizes real category, age and gender facets', async () => {
    mocks.panelGet.mockResolvedValue({
      contract_version: 'operations.heatmap.v1',
      facets: [
        {
          key: 'categoria',
          label: 'Categorias',
          items: [{ value: 'alumbrado', label: 'Alumbrado', count: 4 }],
        },
      ],
      segments: {
        category: [{ key: 'alumbrado', label: 'Alumbrado', count: 4 }],
        gender: [{ key: 'femenino', label: 'Femenino', count: 3 }],
        age_range: [{ key: '35-44', label: '35-44', count: 2 }],
        source: [{ key: 'tickets', label: 'Tickets', count: 4 }],
      },
      applied_filters: {
        categoria: 'alumbrado',
        genero: 'femenino',
        rango_edad: '35-44',
        source: 'tickets',
      },
      demographics: {
        source: 'real_metadata_only',
        gender: [{ key: 'unknown', label: 'unknown', count: 1 }],
        age_ranges: [{ key: '35-44', label: '35-44', count: 2 }],
        known_gender_points: 3,
        known_age_points: 2,
        unknown_gender_points: 1,
        unknown_age_points: 0,
      },
      category_layers: [{ key: 'alumbrado', label: 'Alumbrado', count: 4 }],
      points: [
        {
          id: 10,
          lat: '-34.58',
          lng: '-60.94',
          weight: '2',
          categoria: 'alumbrado',
          genero: 'femenino',
          rango_edad: '35-44',
          canal: 'whatsapp',
          source: 'tickets',
          barrio: 'Centro',
          estado: 'nuevo',
        },
      ],
    });

    const response = await getOperationsHeatmapV2({
      tenantSlug: 'junin',
      categoria: 'alumbrado',
      genero: 'femenino',
      rango_edad: '35-44',
      source: 'tickets',
      range: 'all',
      scope: 'historical',
      canal: 'whatsapp',
      barrio: 'Centro',
      estado: 'nuevo',
    });

    const [url, options] = mocks.panelGet.mock.calls[0];
    expect(url).toContain('/api/v2/analytics/operations/heatmap?');
    expect(url).toContain('categoria=alumbrado');
    expect(url).toContain('genero=femenino');
    expect(url).toContain('rango_edad=35-44');
    expect(url).toContain('source=tickets');
    expect(url).toContain('range=all');
    expect(url).toContain('scope=historical');
    expect(url).toContain('canal=whatsapp');
    expect(url).toContain('barrio=Centro');
    expect(url).toContain('estado=nuevo');
    expect(options).toMatchObject({ tenantSlug: 'junin' });

    expect(response.points).toHaveLength(1);
    expect(response.points[0]).toMatchObject({
      lat: -34.58,
      lng: -60.94,
      weight: 2,
      categoria: 'alumbrado',
      genero: 'femenino',
      rango_edad: '35-44',
      canal: 'whatsapp',
      source: 'tickets',
      barrio: 'Centro',
      estado: 'nuevo',
    });
    expect(response.facets[0].items[0]).toMatchObject({ label: 'Alumbrado', count: 4 });
    expect(response.segments?.gender?.[0]).toMatchObject({ label: 'Femenino', count: 3 });
    expect(response.filters_applied?.categoria).toBe('alumbrado');
    expect(response.applied_filters?.source).toBe('tickets');
    expect(response.demographics?.source).toBe('real_metadata_only');
    expect(response.demographics?.gender[0]).toMatchObject({ label: 'unknown', count: 1 });
    expect(response.category_layers[0]).toMatchObject({ label: 'Alumbrado', count: 4 });
  });

  it('reads the backend map config contract for operational maps', async () => {
    mocks.panelGet.mockResolvedValue({
      contract_version: 'public.map_config.v1',
      provider: 'maplibre',
      available_providers: ['google', 'maplibre'],
      style_url: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      style_url_source: 'configured',
      style_url_warning: null,
      maptiler_key: '',
      google_maps_key: 'test-google-key',
    });

    const response = await getPublicMapConfigV1({ tenantSlug: 'junin-1' });

    const [url, options] = mocks.panelGet.mock.calls[0];
    expect(url).toContain('/api/map/config?');
    expect(url).toContain('tenant_slug=junin-1');
    expect(url).toContain('tenant=junin-1');
    expect(options).toMatchObject({ tenantSlug: 'junin-1' });
    expect(response).toMatchObject({
      contract_version: 'public.map_config.v1',
      provider: 'maplibre',
      style_url: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      google_maps_key: 'test-google-key',
    });
  });
});
