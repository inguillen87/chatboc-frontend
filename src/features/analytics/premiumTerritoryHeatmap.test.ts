import { describe, expect, it } from 'vitest';

import {
  aggregateTerritoryHeatmap,
  DEFAULT_TERRITORY_ZONES,
  getDemoTerritoryHeatmapPoints,
  PREMIUM_HEATMAP_MIN_SAMPLE_SIZE,
  resolveTerritoryLayerDescriptors,
  resolveTerritoryMapReadiness,
} from './premiumTerritoryHeatmap';
import type { OperationsHeatmapPoint } from './analyticsTypes';

const buildPoints = (count: number, overrides?: Partial<OperationsHeatmapPoint>): OperationsHeatmapPoint[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `point-${index}`,
    lat: -34.6 + index * 0.0001,
    lng: -60.94 + index * 0.0001,
    weight: 1,
    barrio: 'Centro',
    categoria: 'reclamos',
    genero: 'femenino',
    rango_edad: '30-44',
    canal: 'whatsapp',
    estado: 'nuevo',
    source: 'tickets',
    ...overrides,
  }));

describe('premium territory heatmap aggregation', () => {
  it('keeps low sample zones private', () => {
    const result = aggregateTerritoryHeatmap({
      points: buildPoints(PREMIUM_HEATMAP_MIN_SAMPLE_SIZE - 1),
    });
    const centro = result.zones.find((metric) => metric.zone.id === 'centro');

    expect(centro?.suppressed).toBe(true);
    expect(centro?.topCategories).toEqual([]);
    expect(centro?.recommendation).toContain('Ampliar muestra');
  });

  it('aggregates filters, top categories and variation from real points', () => {
    const points = [
      ...buildPoints(12, { categoria: 'reclamos', weight: 2, previous: 1 }),
      ...buildPoints(7, { categoria: 'turnos', weight: 2, previous: 1 }),
      ...buildPoints(8, { categoria: 'salud', genero: 'masculino', previous: 1 }),
    ];

    const result = aggregateTerritoryHeatmap({
      points,
      filters: { genero: 'femenino' },
    });
    const centro = result.zones.find((metric) => metric.zone.id === 'centro');

    expect(centro?.suppressed).toBe(false);
    expect(centro?.records).toBe(19);
    expect(centro?.topCategories[0]).toMatchObject({ key: 'reclamos', total: 24 });
    expect(centro?.variationPercent).toBeGreaterThan(0);
  });

  it('provides a local demo seed with eight zones and multiple category families', () => {
    const demoPoints = getDemoTerritoryHeatmapPoints('gobierno');
    const zoneNames = new Set(demoPoints.map((point) => point.barrio));
    const categories = new Set(demoPoints.map((point) => point.categoria));

    expect(DEFAULT_TERRITORY_ZONES).toHaveLength(8);
    expect(zoneNames.size).toBeGreaterThanOrEqual(8);
    expect(categories.size).toBeGreaterThanOrEqual(4);
  });

  it('normalizes low quality heatmap readiness from backend quality and summary fields', () => {
    const readiness = resolveTerritoryMapReadiness(
      {
        points: buildPoints(12),
        quality: {
          state: 'degraded',
          label: 'Cobertura parcial',
          coverage_rate: 0.42,
          visible_points: 12,
          pending_geocode: 8,
          can_render_heatmap: true,
        },
        summary: {
          coordinate_coverage_pct: 42,
        },
      },
      12,
    );

    expect(readiness).toMatchObject({
      state: 'low',
      label: 'Cobertura parcial',
      coveragePercent: 42,
      visiblePoints: 12,
      pendingGeocode: 8,
      canRenderHeatmap: true,
    });
  });

  it('honors render contract blocking even when point data exists', () => {
    const readiness = resolveTerritoryMapReadiness(
      {
        render_contract: {
          state: 'ready',
          can_render_heatmap: false,
        },
        points: buildPoints(18),
        quality: {
          state: 'ready',
          label: 'Mapa operativo confiable',
          coverage_percent: 92,
          visible_points: 18,
          can_render_heatmap: true,
        },
      },
      18,
    );

    expect(readiness).toMatchObject({
      state: 'empty',
      label: 'Mapa no renderizable',
      visiblePoints: 18,
      canRenderHeatmap: false,
    });
  });

  it('deduplicates contract, ai and derived map layers', () => {
    const layers = resolveTerritoryLayerDescriptors({
      contract_version: 'operations.heatmap.v1',
      points: [],
      cells: [],
      hotspots: [],
      facets: [],
      category_layers: [],
      render_contract: {
        layers: ['base_heatmap', 'ai_risk_layers'],
      },
      map_experience: {
        layer_groups: ['base_heatmap', 'whatsapp_activity'],
      },
      quality: {
        state: 'ready',
      },
      geocoding: {
        status: 'queued',
      },
      ai_layers: {
        contract_version: 'huggingface.map_ai_layers.v1',
        layers: {
          risk_pulses: { type: 'animated_scatter', count: 2 },
          whatsapp_activity: { type: 'pulse_points', count: 4 },
          survey_participation: { type: 'territory_heat', count: 1 },
        },
        frontend_contract: {
          layer_groups: ['priority_forecast'],
        },
      },
      layer_style_contract: {
        layers: [{ id: 'geocoding_queue', label: 'Geocoding' }],
      },
    } as any);

    expect(layers.map((layer) => layer.id)).toEqual([
      'base_heatmap',
      'whatsapp_activity',
      'ai_risk_layers',
      'risk_pulses',
      'survey_participation',
      'priority_forecast',
      'geocoding_queue',
      'coverage_quality',
    ]);
    expect(layers.find((layer) => layer.id === 'ai_risk_layers')?.tone).toBe('ai');
  });
});
