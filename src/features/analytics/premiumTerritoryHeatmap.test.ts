import { describe, expect, it } from 'vitest';

import {
  aggregateTerritoryHeatmap,
  DEFAULT_TERRITORY_ZONES,
  getDemoTerritoryHeatmapPoints,
  PREMIUM_HEATMAP_MIN_SAMPLE_SIZE,
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
});
