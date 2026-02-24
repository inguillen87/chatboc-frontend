import { describe, it, expect, vi, beforeEach } from 'vitest';

const apiFetchMock = vi.fn();

vi.mock('@/utils/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  ApiError: class ApiError extends Error {
    status: number;
    body?: Record<string, unknown>;
    constructor(message: string, status = 500) {
      super(message);
      this.status = status;
    }
  },
}));

import { getHeatmap, getPublicSurvey } from '@/api/encuestas';
import { ApiError } from '@/utils/api';

describe('getHeatmap', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('normalizes legacy array payloads into points contract', async () => {
    apiFetchMock.mockResolvedValueOnce([
      { lat: -34.6, lng: -58.4, respuestas: 3 },
    ]);

    const result = await getHeatmap(10);

    expect(result.points).toEqual([{ lat: -34.6, lng: -58.4, respuestas: 3 }]);
    expect(result.metadata).toBeUndefined();
  });

  it('keeps metadata for synthetic points contract', async () => {
    apiFetchMock.mockResolvedValueOnce({
      points: [{ lat: -34.61, lng: -58.38, respuestas: 5 }],
      cells: [],
      metadata: { using_synthetic_points: true },
    });

    const result = await getHeatmap(20);

    expect(result.points).toHaveLength(1);
    expect(result.metadata).toEqual({ using_synthetic_points: true });
    expect(result.cells).toEqual([]);
  });
});


describe('getPublicSurvey', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('retries using /public endpoint when /api/public returns forbidden', async () => {
    apiFetchMock
      .mockRejectedValueOnce(new ApiError('Forbidden', 403))
      .mockResolvedValueOnce({ slug: 'movilidad-y-transporte-junin', titulo: 'Movilidad', tipo: 'opinion', inicio_at: '2026-01-01', fin_at: '2026-12-31', politica_unicidad: 'libre', preguntas: [] });

    const survey = await getPublicSurvey('movilidad-y-transporte-junin');

    expect(survey.slug).toBe('movilidad-y-transporte-junin');
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/public/encuestas/movilidad-y-transporte-junin',
      expect.any(Object),
    );
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      2,
      '/public/encuestas/movilidad-y-transporte-junin',
      expect.any(Object),
    );
  });
});
