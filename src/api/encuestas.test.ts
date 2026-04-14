import { describe, it, expect, vi, beforeEach } from 'vitest';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

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

import { getHeatmap, getPublicSurvey, listPublicSurveys, postPublicResponse } from '@/api/encuestas';
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

  it('uses canonical /api/public endpoint when legacy fallback is disabled', async () => {
    apiFetchMock.mockResolvedValueOnce({
      contract_version: 'encuestas.public.v1',
      encuesta: {
        slug: 'movilidad-y-transporte-junin',
        titulo: 'Movilidad',
        tipo: 'opinion',
        inicio_at: '2026-01-01',
        fin_at: '2026-12-31',
        politica_unicidad: 'libre',
        preguntas: [],
      },
    });

    const survey = await getPublicSurvey('movilidad-y-transporte-junin');

    expect(survey.slug).toBe('movilidad-y-transporte-junin');
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/public/encuestas/v1/movilidad-y-transporte-junin',
      expect.any(Object),
    );
  });
});


describe('listPublicSurveys', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('keeps tenant scoping options when tenantSlug is provided', async () => {
    apiFetchMock.mockResolvedValueOnce([{ slug: 'rio-grande', titulo: 'RG', tipo: 'opinion', inicio_at: '2026-01-01', fin_at: '2026-01-31', politica_unicidad: 'libre', preguntas: [] }]);

    await listPublicSurveys('rio-grande');

    const [, options] = apiFetchMock.mock.calls[0];
    expect(options).toEqual(expect.objectContaining({ tenantSlug: 'rio-grande' }));
    expect((options as Record<string, unknown>).omitTenant).toBe(true);
  });

  it('returns flagged empty list on API errors instead of mock fallback in v1 strict mode', async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError('Server exploded', 500));

    const result = await listPublicSurveys('rio-grande');

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
    expect(result.__badPayload).toBe(true);
    expect(result.__status).toBe(500);
  });
});

describe('postPublicResponse', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    safeLocalStorage.removeItem('chatboc_public_chat_context');
  });

  it('persists returned contact_key and conversation_id into public chat context', async () => {
    apiFetchMock.mockResolvedValueOnce({
      contract_version: 'encuestas.public_response.v1',
      ok: true,
      id: 9,
      contact_key: 'ck-survey-1',
      conversation_id: 'conv-survey-1',
    });

    await postPublicResponse('mi-encuesta', { respuestas: [{ pregunta_id: 101, opcion_ids: [1] }] }, 'rio-grande');

    const persistedRaw = safeLocalStorage.getItem('chatboc_public_chat_context');
    const persisted = persistedRaw ? JSON.parse(persistedRaw) : null;

    expect(persisted).toEqual(
      expect.objectContaining({
        contact_key: 'ck-survey-1',
        conversation_id: 'conv-survey-1',
        tenantSlug: 'rio-grande',
      }),
    );
  });

  it('returns contract_version in survey response ack when available', async () => {
    apiFetchMock.mockResolvedValueOnce({
      contract_version: 'encuestas.public_response.v1',
      ok: true,
      id: 99,
    });

    const response = await postPublicResponse(
      'mi-encuesta',
      { respuestas: [{ pregunta_id: 101, opcion_ids: [1] }] },
      'rio-grande',
    );

    expect(response.contract_version).toBe('encuestas.public_response.v1');
  });
});
