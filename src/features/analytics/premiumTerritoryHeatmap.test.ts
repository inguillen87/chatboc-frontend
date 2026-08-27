import { describe, expect, it } from 'vitest';

import {
  aggregateTerritoryHeatmap,
  DEVELOPMENT_TERRITORY_ZONES,
  getDemoTerritoryHeatmapPoints,
  isTerritoryDemoFallbackEnabled,
  PREMIUM_HEATMAP_MIN_SAMPLE_SIZE,
  resolveOfficialTerritoryZones,
  resolveTerritoryDataProvenance,
  resolveTerritoryLayerDescriptors,
  resolveTerritoryMapReadiness,
} from './premiumTerritoryHeatmap';
import type { OperationsHeatmapPoint, OperationsHeatmapV1 } from './analyticsTypes';

const OFFICIAL_TEST_ZONES = [
  {
    id: 'centro',
    label: 'Centro',
    polygon: [[20, 20], [80, 20], [80, 55], [20, 55]] as [number, number][],
    geoPolygons: [[[-61, -34.7], [-60.8, -34.7], [-60.8, -34.5], [-61, -34.5]]] as [number, number][][],
    population: 32000,
    populationSource: 'censo_2022',
    source: 'official' as const,
  },
];

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
  it('derives map provenance without treating missing or untrusted metadata as real', () => {
    expect(resolveTerritoryDataProvenance(undefined)).toMatchObject({
      state: 'unvalidated',
      label: 'Procedencia no validada',
    });
    expect(resolveTerritoryDataProvenance(undefined, true)).toMatchObject({
      state: 'demo',
      label: 'Escenario de demostración',
    });
    expect(
      resolveTerritoryDataProvenance({
        response_provenance: {
          mode: 'synthetic',
          server_trusted_classification: true,
          contains_synthetic: true,
          synthetic_responses_included: 20,
        },
      }),
    ).toMatchObject({ state: 'synthetic', label: 'Datos sintéticos declarados' });
    expect(
      resolveTerritoryDataProvenance({
        response_provenance: {
          mode: 'real',
          server_trusted_classification: true,
          contains_synthetic: false,
          real_responses_included: 8,
          unverified_responses_included: 0,
        },
      }, false, [{ id: 'survey_response:1', source: 'survey', lat: -34.6, lng: -60.9 }]),
    ).toMatchObject({ state: 'real', label: 'Procedencia validada por backend' });
    expect(
      resolveTerritoryDataProvenance({
        response_provenance: {
          mode: 'real',
          server_trusted_classification: true,
          real_responses_included: 8,
        },
      }, false, [{ id: 'ticket:1', source: 'ticket', lat: -34.6, lng: -60.9 }]),
    ).toMatchObject({ state: 'unvalidated', label: 'Procedencia parcial' });
    expect(
      resolveTerritoryDataProvenance({
        response_provenance: {
          mode: 'real',
          server_trusted_classification: false,
          real_responses_included: 8,
        },
      }),
    ).toMatchObject({ state: 'unvalidated' });
  });

  it('keeps low sample zones private', () => {
    const result = aggregateTerritoryHeatmap({
      points: buildPoints(PREMIUM_HEATMAP_MIN_SAMPLE_SIZE - 1),
      zones: OFFICIAL_TEST_ZONES,
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
      zones: OFFICIAL_TEST_ZONES,
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

    expect(DEVELOPMENT_TERRITORY_ZONES).toHaveLength(8);
    expect(zoneNames.size).toBeGreaterThanOrEqual(8);
    expect(categories.size).toBeGreaterThanOrEqual(4);
  });

  it('does not aggregate real points when official boundaries are absent', () => {
    const result = aggregateTerritoryHeatmap({
      points: buildPoints(12),
      zones: [],
    });

    expect(result).toMatchObject({
      zones: [],
      totalEvents: 0,
      totalRecords: 0,
      unassignedRecords: 12,
      hasBoundaries: false,
    });
  });

  it('builds zones only from explicit backend boundaries and keeps supplied population provenance', () => {
    const heatmap = {
      contract_version: 'operations.heatmap.v1',
      points: [],
      cells: [],
      hotspots: [],
      facets: [],
      category_layers: [],
      privacy: {
        population_source: 'INDEC 2022',
        boundaries_source: 'Catastro municipal 2026',
      },
      geo_layers: {
        boundaries: {
          type: 'FeatureCollection',
          metadata: { official: true, source: 'Catastro municipal 2026' },
          features: [
            {
              type: 'Feature',
              id: 'centro',
              geometry: {
                type: 'Polygon',
                coordinates: [[[-60.95, -34.62], [-60.9, -34.62], [-60.9, -34.57], [-60.95, -34.57], [-60.95, -34.62]]],
              },
              properties: { nombre: 'Centro', poblacion: 31400 },
            },
          ],
        },
      },
    } satisfies OperationsHeatmapV1;

    expect(resolveOfficialTerritoryZones(heatmap)).toEqual([
      expect.objectContaining({
        id: 'centro',
        label: 'Centro',
        population: 31400,
        populationSource: 'INDEC 2022',
        boundarySource: 'Catastro municipal 2026',
        source: 'official',
      }),
    ]);
  });

  it('rejects boundary collections explicitly marked as synthetic', () => {
    const heatmap = {
      points: [],
      cells: [],
      hotspots: [],
      facets: [],
      category_layers: [],
      geo_layers: {
        boundaries: {
          type: 'FeatureCollection',
          metadata: { synthetic: true },
          features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [] }, properties: {} }],
        },
      },
    } satisfies OperationsHeatmapV1;

    expect(resolveOfficialTerritoryZones(heatmap)).toEqual([]);
  });

  it('rejects boundaries without positive official provenance evidence', () => {
    const heatmap = {
      points: [],
      cells: [],
      hotspots: [],
      facets: [],
      category_layers: [],
      geo_layers: {
        boundaries: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              id: 'centro',
              geometry: {
                type: 'Polygon',
                coordinates: [[[-60.95, -34.62], [-60.9, -34.62], [-60.9, -34.57], [-60.95, -34.57]]],
              },
              properties: { nombre: 'Centro', poblacion: 31400 },
            },
          ],
        },
      },
    } satisfies OperationsHeatmapV1;

    expect(resolveOfficialTerritoryZones(heatmap)).toEqual([]);
  });

  it('does not use a population value without explicit population provenance', () => {
    const heatmap = {
      points: [],
      cells: [],
      hotspots: [],
      facets: [],
      category_layers: [],
      geo_layers: {
        boundaries: {
          type: 'FeatureCollection',
          metadata: { official: true, source: 'Catastro municipal' },
          features: [
            {
              type: 'Feature',
              id: 'centro',
              geometry: {
                type: 'Polygon',
                coordinates: [[[-60.95, -34.62], [-60.9, -34.62], [-60.9, -34.57], [-60.95, -34.57]]],
              },
              properties: { nombre: 'Centro', poblacion: 999999 },
            },
          ],
        },
      },
    } satisfies OperationsHeatmapV1;

    expect(resolveOfficialTerritoryZones(heatmap)[0]).toMatchObject({
      label: 'Centro',
      population: undefined,
      populationSource: undefined,
    });
  });

  it('keeps the visual demo fallback disabled outside explicitly flagged local development', () => {
    expect(isTerritoryDemoFallbackEnabled('production', 'true')).toBe(false);
    expect(isTerritoryDemoFallbackEnabled('development', undefined)).toBe(false);
    expect(isTerritoryDemoFallbackEnabled('development', 'true')).toBe(true);
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

  it('promotes ai status layer hints into selectable map layers', () => {
    const layers = resolveTerritoryLayerDescriptors({
      contract_version: 'operations.heatmap.v1',
      points: [],
      cells: [],
      hotspots: [],
      facets: [],
      category_layers: [],
      ai_status: {
        status: 'local_fallback',
        map_layer_hints: ['risk_pulses', 'whatsapp_activity', 'geocoding_queue'],
      },
    } as any);

    expect(layers.map((layer) => layer.id)).toEqual([
      'risk_pulses',
      'whatsapp_activity',
      'geocoding_queue',
    ]);
    expect(layers.find((layer) => layer.id === 'whatsapp_activity')?.tone).toBe('realtime');
  });

  it('publishes commerce activity as a dedicated privacy-safe map layer', () => {
    const layers = resolveTerritoryLayerDescriptors({
      contract_version: 'operations.heatmap.v1',
      points: [],
      cells: [],
      hotspots: [],
      facets: [],
      category_layers: [],
      render_contract: {
        layers: ['base_heatmap', 'commerce_activity'],
      },
    } as any);

    const commerce = layers.find((layer) => layer.id === 'commerce_activity');
    expect(commerce).toMatchObject({
      label: 'Pedidos y ventas',
      tone: 'commerce',
      source: 'backend',
    });
    expect(commerce?.description).toContain('sin datos personales');
  });
});
