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

import {
  adminDuplicateSurvey,
  adminPublishSurvey,
  getHeatmap,
  getPublicSurvey,
  getPublicSurveyLiveResults,
  getSurveyComments,
  listPublicSurveys,
  postPublicResponse,
  postSurveyComment,
} from '@/api/encuestas';
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

  it('uses canonical /api/public v1 endpoint first when legacy fallback is disabled', async () => {
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

  it('accepts raw encuestas.public.v1 payload without wrapper', async () => {
    apiFetchMock.mockResolvedValueOnce({
      contract_version: 'encuestas.public.v1',
      slug: 'luis-petri-votacion-prioridades-junin-8887',
      slug_publico: 'luis-petri-votacion-prioridades-junin-8887-1c5aa4',
      canonical_slug: 'luis-petri-votacion-prioridades-junin-8887-1c5aa4',
      titulo: 'Votacion',
      tipo: 'votacion',
      inicio_at: '2026-01-01',
      fin_at: '2026-12-31',
      politica_unicidad: 'libre',
      preguntas: [
        {
          id: 1,
          orden: 1,
          tipo: 'single_choice',
          texto: 'Prioridad',
          obligatoria: true,
          opciones: [],
        },
      ],
    });

    const survey = await getPublicSurvey('luis-petri-votacion-prioridades-junin-8887');

    expect(survey.slug).toBe('luis-petri-votacion-prioridades-junin-8887');
    expect(survey.slug_publico).toBe('luis-petri-votacion-prioridades-junin-8887-1c5aa4');
    expect(survey.preguntas[0].tipo).toBe('opcion_unica');
  });
});

describe('adminPublishSurvey', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('unwraps publish responses and keeps canonical share fields', async () => {
    apiFetchMock.mockResolvedValueOnce({
      ok: true,
      slug_publico: 'luis-petri-votacion-prioridades-junin-8887',
      url_publica: 'https://www.chatboc.ar/e/luis-petri-votacion-prioridades-junin-8887',
      encuesta: {
        id: 627,
        slug: 'luis-petri-votacion-prioridades-junin-8887',
        estado: 'publicada',
        titulo: 'Votacion',
        tipo: 'votacion',
        inicio_at: '2026-01-01',
        fin_at: '2026-12-31',
        politica_unicidad: 'libre',
        preguntas: [],
      },
    });

    const survey = await adminPublishSurvey(627);

    expect(survey.id).toBe(627);
    expect(survey.estado).toBe('publicada');
    expect(survey.slug_publico).toBe('luis-petri-votacion-prioridades-junin-8887');
    expect(survey.url_publica).toBe('https://www.chatboc.ar/e/luis-petri-votacion-prioridades-junin-8887');
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/admin/encuestas/627/publicar',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('adminDuplicateSurvey', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('unwraps duplicate responses into the editable survey copy', async () => {
    apiFetchMock.mockResolvedValueOnce({
      ok: true,
      source_id: 627,
      encuesta: {
        id: 628,
        slug: 'luis-petri-votacion-prioridades-junin-8887-nueva-version',
        estado: 'borrador',
        titulo: 'Votacion nueva version',
        tipo: 'votacion',
        inicio_at: '2026-01-01',
        fin_at: '2026-12-31',
        politica_unicidad: 'libre',
        preguntas: [],
      },
    });

    const survey = await adminDuplicateSurvey(627);

    expect(survey.id).toBe(628);
    expect(survey.estado).toBe('borrador');
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/admin/encuestas/627/duplicar',
      expect.objectContaining({ method: 'POST', body: {} }),
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

    const [path, options] = apiFetchMock.mock.calls[0];
    expect(path).toBe('/api/public/encuestas/v1?tenant_slug=rio-grande');
    expect(options).toEqual(expect.objectContaining({ tenantSlug: 'rio-grande' }));
    expect((options as Record<string, unknown>).omitTenant).toBe(true);
  });

  it('returns flagged empty list on API errors instead of mock fallback in v1 strict mode', async () => {
    apiFetchMock
      .mockRejectedValueOnce(new ApiError('Server exploded', 500))
      .mockRejectedValueOnce(new ApiError('Server exploded', 500));

    const result = await listPublicSurveys('rio-grande');

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
    expect(result.__badPayload).toBe(true);
    expect(result.__status).toBe(500);
  });

  it('never falls back to demo/mock surveys on generic public list failures', async () => {
    apiFetchMock
      .mockRejectedValueOnce(new Error('network down'))
      .mockRejectedValueOnce(new Error('network down'));

    const result = await listPublicSurveys('rio-grande');

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
    expect(result.__badPayload).toBe(true);
  });

  it('does not retry non-v1 or /public aliases when strict v1 contract fails', async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError('Not Found', 404));

    const result = await listPublicSurveys();

    expect(result).toHaveLength(0);
    expect(result.__badPayload).toBe(true);
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/public/encuestas/v1',
      expect.any(Object),
    );
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('public survey tenant query contract', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('adds tenant_slug to public detail and live-results paths while omitting ambient tenant headers', async () => {
    apiFetchMock
      .mockResolvedValueOnce({
        slug: 'consulta-barrial',
        titulo: 'Consulta barrial',
        tipo: 'opinion',
        preguntas: [],
      })
      .mockResolvedValueOnce({
        contract_version: 'encuestas.live_results.v1',
        slug_publico: 'consulta-barrial',
        total_respuestas: 0,
      })
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ id: 12, texto: 'Buen punto' });

    await getPublicSurvey('consulta-barrial', 'junin');
    await getPublicSurveyLiveResults('consulta-barrial', 'junin', { include_heatmap: 0, window_minutes: 20 });
    await getSurveyComments('consulta-barrial', 'junin', 25, 10);
    await postSurveyComment('consulta-barrial', { texto: 'Buen punto' }, 'junin');

    expect(apiFetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/public/encuestas/v1/consulta-barrial?tenant_slug=junin',
      expect.objectContaining({ omitTenant: true, tenantSlug: 'junin' }),
    );
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/public/encuestas/v1/consulta-barrial/live-results?include_heatmap=0&window_minutes=20&tenant_slug=junin',
      expect.objectContaining({ omitTenant: true, tenantSlug: 'junin' }),
    );
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/public/encuestas/v1/consulta-barrial/comentarios?limit=25&offset=10&tenant_slug=junin',
      expect.objectContaining({ omitTenant: true, tenantSlug: 'junin' }),
    );
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      4,
      '/api/public/encuestas/v1/consulta-barrial/comentarios?tenant_slug=junin',
      expect.objectContaining({ method: 'POST', omitTenant: true, tenantSlug: 'junin' }),
    );
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

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/public/encuestas/v1/mi-encuesta/responder?tenant_slug=rio-grande',
      expect.objectContaining({ method: 'POST', omitTenant: true, tenantSlug: 'rio-grande' }),
    );

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

  it('accepts explicit demo survey response contract', async () => {
    apiFetchMock.mockResolvedValueOnce({
      contract_version: 'demo.survey_response_ack.v1',
      ok: true,
      accepted: true,
      respuesta_id: 'demo_resp_1',
    });

    const response = await postPublicResponse(
      'demo-empresas-chatboc-demo-promo-semana',
      { respuestas: [{ pregunta_id: 101, opcion_ids: ['q_14900184516_op_1'] }] },
      'chatboc-demo',
    );

    expect(response.contract_version).toBe('demo.survey_response_ack.v1');
  });
});
