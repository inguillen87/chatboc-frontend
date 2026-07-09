import { describe, expect, it } from 'vitest';

import { buildMapExperience } from './mapExperienceAdapter';

describe('buildMapExperience', () => {
  it('normalizes explicit analytics points and map metadata', () => {
    const result = buildMapExperience(
      {
        contract_version: 'analytics.heatmap.v2',
        points: [
          {
            id: 10,
            lat: '-33.086',
            lon: '-68.471',
            value: 4,
            categoria: 'Luminaria',
            canal: 'whatsapp',
          },
        ],
        location_quality: {
          coverage_pct: 93,
          with_coordinates: 31,
          without_coordinates: 2,
        },
        geo_layers: {
          style_url: 'https://tiles.example/style.json',
          tiles: { url: 'https://tiles.example/{z}/{x}/{y}.pbf', attribution: 'OSM' },
        },
      },
      { sourceKind: 'municipio' },
    );

    expect(result.points).toHaveLength(1);
    expect(result.displayPoints).toHaveLength(1);
    expect(result.displayPoints[0]).toMatchObject({
      lat: -33.086,
      lng: -68.471,
      weight: 4,
      categoria: 'Luminaria',
      canal: 'whatsapp',
    });
    expect(result.center).toEqual([-68.471, -33.086]);
    expect(result.mapStyleUrl).toBe('https://tiles.example/style.json');
    expect(result.mapTileUrl).toBe('https://tiles.example/{z}/{x}/{y}.pbf');
    expect(result.quality).toMatchObject({
      sourceContract: 'analytics.heatmap.v2',
      sourceKind: 'municipio',
      pointCount: 1,
      cellCount: 0,
      displayPointCount: 1,
      usingCellFallback: false,
      coveragePct: 93,
      withCoordinates: 31,
      withoutCoordinates: 2,
    });
  });

  it('builds operational display points from cells when raw points are unavailable', () => {
    const result = buildMapExperience({
      contract_version: 'operations.heatmap.v1',
      points: [],
      cells: [
        {
          cell_id: 'junin-centro',
          label: 'Junin Centro',
          centroid_lat: -33.086,
          centroid_lon: -68.471,
          count: 12,
          category: 'Reclamos',
        },
      ],
    });

    expect(result.points).toHaveLength(0);
    expect(result.cells).toHaveLength(1);
    expect(result.cellPoints).toHaveLength(1);
    expect(result.displayPoints).toHaveLength(1);
    expect(result.displayPoints[0]).toMatchObject({
      lat: -33.086,
      lng: -68.471,
      weight: 12,
      cellId: 'junin-centro',
      clusterSize: 12,
      source: 'cell',
    });
    expect(result.quality.usingCellFallback).toBe(true);
    expect(result.emptyReason).toBeUndefined();
  });

  it('preserves public survey privacy evidence while using aggregated cells', () => {
    const result = buildMapExperience({
      contract_version: 'surveys.live_results.v2',
      metadata: {
        privacy_mode: 'public_aggregated',
        raw_points_redacted: true,
      },
      heatmap: {
        cells: [
          {
            id: 'mesa-1',
            center: { lat: -32.89, lng: -68.84 },
            responses: 44,
            breakdown: { si: 31, no: 13 },
          },
        ],
      },
    });

    expect(result.displayPoints).toHaveLength(1);
    expect(result.displayPoints[0]).toMatchObject({
      lat: -32.89,
      lng: -68.84,
      weight: 44,
      cellId: 'mesa-1',
    });
    expect(result.quality).toMatchObject({
      sourceContract: 'surveys.live_results.v2',
      privacyMode: 'public_aggregated',
      rawPointsRedacted: true,
      usingCellFallback: true,
    });
  });

  it('keeps education/tenant map layers and GeoJSON features', () => {
    const result = buildMapExperience({
      contract_version: 'education.attendance.heatmap.v1',
      cells: [{ id: 'sede-norte', lat: -34.61, lng: -58.38, count: 9, categoria: 'Cuotas' }],
      geo_layers: {
        contract_version: 'geo.layers.v1',
        source: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: { name: 'Sede Norte', weight: 9 },
              geometry: { type: 'Point', coordinates: [-58.38, -34.61] },
            },
          ],
        },
        source_options: { cluster: true },
        layers: { points: { id: 'school-points' } },
      },
    });

    expect(result.geoLayerSource?.features).toHaveLength(1);
    expect(result.geoLayerConfig).toMatchObject({
      contract_version: 'education.attendance.heatmap.v1',
      source_options: { cluster: true },
      layers: { points: { id: 'school-points' } },
    });
    expect(result.displayPoints).toHaveLength(1);
    expect(result.quality.featureCount).toBe(1);
  });

  it('marks payloads without coordinates as empty', () => {
    const result = buildMapExperience({
      points: [{ categoria: 'Sin direccion', count: 3 }],
      cells: [{ id: 'sin-centro', count: 3 }],
    });

    expect(result.displayPoints).toHaveLength(0);
    expect(result.emptyReason).toBe('no_coordinates');
    expect(result.quality.displayPointCount).toBe(0);
  });
});
