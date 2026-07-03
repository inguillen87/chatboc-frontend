import { describe, expect, it } from 'vitest';

import { extractHeatmapDataset } from './statsService';

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
