import { describe, expect, it } from 'vitest';

import { extractHeatmapDataset, extractOperationalCharts } from './statsService';

describe('statsService heatmap normalization', () => {
  it('keeps operational location and channel fields from explicit heatmap points', () => {
    const dataset = extractHeatmapDataset({
      points: [
        {
          id: 123,
          lat: -33.086,
          lng: -68.471,
          barrio: 'Centro',
          distrito: 'Ciudad',
          categoria: 'Luminaria',
          estado: 'Nuevo',
          canal: 'whatsapp',
          fuente: 'municipal',
          severidad: 'alta',
          direccion: 'Don Bosco 55',
          ticket: 'M-123',
          weight: 4,
        },
      ],
    });

    expect(dataset.points).toHaveLength(1);
    expect(dataset.points[0]).toMatchObject({
      id: 123,
      barrio: 'Centro',
      distrito: 'Ciudad',
      categoria: 'Luminaria',
      estado: 'Nuevo',
      canal: 'whatsapp',
      fuente: 'municipal',
      severidad: 'alta',
      direccion: 'Don Bosco 55',
      ticket: 'M-123',
      weight: 4,
    });
  });
});

describe('statsService operational chart normalization', () => {
  it('ignores nested map metadata and only renders real operational series', () => {
    const charts = extractOperationalCharts({
      heatmap_contract: {
        charts: {
          supported_formats: { points: 1 },
          kpi: { activity_score: 6, coverage_score: 2.7 },
          top_points: { lat: -34.58, lng: -60.95, rank: 1 },
          legend: { low: 1, medium: 2, high: 3 },
        },
      },
      stats: {
        estados: [
          { estado: 'Nuevo', total: 7 },
          { estado: 'En proceso', total: 4 },
        ],
        por_categoria: [
          { categoria: 'Alumbrado', total: 5 },
          { categoria: 'Arbolado', total: 6 },
        ],
        por_canal: [
          { canal: 'WhatsApp', total: 8 },
          { canal: 'Web', total: 3 },
        ],
      },
    });

    expect(charts).toEqual([
      { title: 'Reclamos por estado', data: { Nuevo: 7, 'En proceso': 4 } },
      { title: 'Reclamos por categoría', data: { Alumbrado: 5, Arbolado: 6 } },
      { title: 'Canales de ingreso', data: { WhatsApp: 8, Web: 3 } },
    ]);
    expect(charts.map((chart) => chart.title)).not.toEqual(
      expect.arrayContaining(['Supported Formats', 'Kpi', 'Top Points', 'Legend']),
    );
  });
});
