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
  getSurveyDashboardBundle,
  getHeatmap,
  getPublicSurvey,
  getPublicSurveyLiveResults,
  getSurveyComments,
  listPublicSurveys,
  normalizePublicSurveyLiveResults,
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

    expect(result.points).toEqual([expect.objectContaining({ lat: -34.6, lng: -58.4, respuestas: 3, value: 3 })]);
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

  it('preserves rich heatmap render contract from backend payloads', async () => {
    apiFetchMock.mockResolvedValueOnce({
      headline: 'Participacion territorial activa',
      points: [{ lat: '-33.086', lon: '-68.471', value: 12, categoria: 'Centro' }],
      render_contract: { state: 'live', preferred_visualization: 'territory_map' },
      map: { provider_hint: 'maplibre', render_ready: true },
      category_layers: {
        categories: [{ categoria: 'Centro', color: '#22d3ee', event_count: 12 }],
      },
      ai_layers: { hotspots: [{ label: 'Centro' }] },
    });

    const result = await getHeatmap(30);

    expect(result.points).toEqual([
      expect.objectContaining({ lat: -33.086, lng: -68.471, respuestas: 12, value: 12, categoria: 'Centro' }),
    ]);
    expect(result.render_contract).toEqual({ state: 'live', preferred_visualization: 'territory_map' });
    expect(result.metadata).toEqual(
      expect.objectContaining({
        render_contract: { state: 'live', preferred_visualization: 'territory_map' },
        map: { provider_hint: 'maplibre', render_ready: true },
        category_layers: {
          categories: [{ categoria: 'Centro', color: '#22d3ee', event_count: 12 }],
        },
        ai_layers: { hotspots: [{ label: 'Centro' }] },
      }),
    );
  });
});

describe('getSurveyDashboardBundle', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('preserves publication links while normalizing the embedded heatmap', async () => {
    apiFetchMock.mockResolvedValueOnce({
      survey_publication: {
        contract_version: 'surveys.dashboard_publication.v1',
        public_state: 'published',
        links: {
          public_page_path: '/e/voto-plaza',
          live_results_endpoint: '/api/v2/public/surveys/voto-plaza/live-results?tenant_slug=junin',
        },
        actions: [{ id: 'open_live_results' }],
      },
      public_links: {
        share_url: '/e/voto-plaza',
      },
      modules: {
        heatmap: {
          points: [{ lat: '-32.92', lon: '-68.81', value: 5, categoria: 'Centro' }],
          metadata: { using_synthetic_points: false },
        },
        publication: {
          public_state: 'published',
        },
      },
    });

    const bundle = await getSurveyDashboardBundle(55, { canal: 'web' });

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/admin/encuestas/55/analytics/dashboard?canal=web',
      expect.any(Object),
    );
    expect(bundle.survey_publication?.links?.live_results_endpoint).toContain('/live-results');
    expect(bundle.public_links?.share_url).toBe('/e/voto-plaza');
    expect(bundle.modules?.publication?.public_state).toBe('published');
    expect(bundle.modules?.heatmap?.points[0]).toEqual(
      expect.objectContaining({ lat: -32.92, lng: -68.81, respuestas: 5, value: 5 }),
    );
  });
});


describe('getPublicSurvey', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('uses canonical public v2 endpoint first for survey detail', async () => {
    apiFetchMock.mockResolvedValueOnce({
      contract_version: 'surveys.public.v2',
      slug: 'movilidad-y-transporte-junin',
      titulo: 'Movilidad',
      tipo: 'opinion',
      inicio_at: '2026-01-01',
      fin_at: '2026-12-31',
      politica_unicidad: 'libre',
      preguntas: [],
      links: {
        respond_endpoint: '/api/v2/public/surveys/movilidad-y-transporte-junin/respond',
        live_results_endpoint: '/api/v2/public/surveys/movilidad-y-transporte-junin/live-results',
      },
      realtime: { contract_version: 'surveys.realtime.v2', enabled: true },
    });

    const survey = await getPublicSurvey('movilidad-y-transporte-junin');

    expect(survey.slug).toBe('movilidad-y-transporte-junin');
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/v2/public/surveys/movilidad-y-transporte-junin',
      expect.any(Object),
    );
  });

  it('falls back to legacy public v1 detail when v2 cannot resolve the survey', async () => {
    apiFetchMock
      .mockRejectedValueOnce(new ApiError('Not Found', 404))
      .mockResolvedValueOnce({
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

    const survey = await getPublicSurvey('movilidad-y-transporte-junin', 'junin');

    expect(survey.slug).toBe('movilidad-y-transporte-junin');
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v2/public/surveys/movilidad-y-transporte-junin?tenant_slug=junin',
      expect.objectContaining({ tenantSlug: 'junin', omitTenant: true }),
    );
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/public/encuestas/v1/movilidad-y-transporte-junin?tenant_slug=junin',
      expect.objectContaining({ tenantSlug: 'junin', omitTenant: true }),
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
        contract_version: 'surveys.public.v2',
        slug: 'consulta-barrial',
        titulo: 'Consulta barrial',
        tipo: 'opinion',
        preguntas: [],
      })
      .mockResolvedValueOnce({
        contract_version: 'surveys.live_results.v2',
        slug_publico: 'consulta-barrial',
        total_respuestas: 0,
        realtime: { contract_version: 'surveys.realtime.v2', room: 'encuesta_consulta-barrial' },
      })
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ id: 12, texto: 'Buen punto' });

    await getPublicSurvey('consulta-barrial', 'junin');
    await getPublicSurveyLiveResults('consulta-barrial', 'junin', { include_heatmap: 0, window_minutes: 20 });
    await getSurveyComments('consulta-barrial', 'junin', 25, 10);
    await postSurveyComment('consulta-barrial', { texto: 'Buen punto' }, 'junin');

    expect(apiFetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v2/public/surveys/consulta-barrial?tenant_slug=junin',
      expect.objectContaining({ omitTenant: true, tenantSlug: 'junin' }),
    );
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v2/public/surveys/consulta-barrial/live-results?include_heatmap=0&window_minutes=20&tenant_slug=junin',
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

  it('does not fall back to legacy live-results when v2 intentionally hides results', async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError('Live results hidden', 403));

    await expect(
      getPublicSurveyLiveResults('consulta-barrial', 'junin', { include_heatmap: 0 }),
    ).rejects.toMatchObject({ status: 403 });

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/v2/public/surveys/consulta-barrial/live-results?include_heatmap=0&tenant_slug=junin',
      expect.objectContaining({ omitTenant: true, tenantSlug: 'junin' }),
    );
  });
});

describe('normalizePublicSurveyLiveResults', () => {
  it('normalizes mixed backend live-results shapes for webviews and public dashboards', () => {
    const normalized = normalizePublicSurveyLiveResults({
      contract_version: 'surveys.live_results.v2',
      total_responses: '21',
      preguntas: {
        q1: {
          titulo: 'Prioridad del barrio',
          opciones: {
            a: { texto: 'Luminaria', votos: '12', porcentaje: '57.1' },
            b: { label: 'Arbolado', count: 9, pct: 42.9 },
          },
        },
      },
      timeline: [{ timestamp: '2026-07-02T12:00:00Z', count: '4' }],
      heatmap: {
        points: [{ latitude: '-33.079', lon: '-68.47', respuestas: '7', barrio: 'Centro' }],
        cells: [{ centroid_lat: '-33.08', centroid_lon: '-68.472', count: '11', barrio: 'Centro' }],
        metadata: { points_count: 40, cells_count: 12, truncated_points: true },
      },
      realtime: {
        contract_version: 'surveys.realtime.v2',
        rooms: ['contract-primary', 'contract-legacy'],
        socket: {
          join_payloads: [{ room: 'contract-primary' }],
          events: [{ name: 'survey.vote.created' }],
        },
      },
    });

    expect(normalized.total_respuestas).toBe(21);
    expect(normalized.preguntas).toHaveLength(1);
    expect(normalized.preguntas?.[0]).toMatchObject({
      titulo: 'Prioridad del barrio',
      total_votos: 21,
    });
    expect(normalized.preguntas?.[0]?.opciones?.[0]).toMatchObject({
      texto: 'Luminaria',
      votos: 12,
      porcentaje: 57.1,
    });
    expect(normalized.timeline_minute?.[0]).toMatchObject({ respuestas: 4, total: 4 });
    expect(normalized.heatmap?.points?.[0]).toMatchObject({ lat: -33.079, lng: -68.47, value: 7 });
    expect(normalized.heatmap?.cells?.[0]).toMatchObject({ lat: -33.08, lng: -68.472, value: 11 });
    expect(normalized.heatmap?.metadata).toMatchObject({ points_count: 40, truncated_points: true });
    expect(normalized.realtime?.rooms).toEqual(['contract-primary', 'contract-legacy']);
    expect(normalized.realtime?.socket?.events?.[0]).toMatchObject({ name: 'survey.vote.created' });
  });

  it('normalizes realtime socket aliases to the polling live-results contract', () => {
    const normalized = normalizePublicSurveyLiveResults({
      contractVersion: 'surveys.live_results.v2',
      resultVersion: '7',
      snapshotVersion: 20260710,
      total_votes: '31',
      questions: [
        {
          question_id: 'prioridad',
          title: 'Prioridad barrial',
          total_votes: '31',
          options: [{ key: 'luz', label: 'Luminaria', votes: '31', percent: '100' }],
        },
      ],
      series: [{ minute: '20:10', value: '31' }],
      points: [{ latitude: '-33.086', lon: '-68.471', votes: '31', barrio: 'Centro' }],
      celdas: [{ centroid_lat: '-33.08', centroid_lng: '-68.472', count: '31', barrio: 'Centro' }],
      heatmap_metadata: { points_count: 1, cells_count: 1, raw_points_redacted: true },
    });

    expect(normalized.contract_version).toBe('surveys.live_results.v2');
    expect(normalized.result_version).toBe(7);
    expect(normalized.snapshot_version).toBe('20260710');
    expect(normalized.total_respuestas).toBe(31);
    expect(normalized.preguntas?.[0]).toMatchObject({ id: 'prioridad', total_votos: 31 });
    expect(normalized.preguntas?.[0]?.opciones?.[0]).toMatchObject({ value: 'luz', votos: 31, porcentaje: 100 });
    expect(normalized.timeline_minute?.[0]).toMatchObject({ respuestas: 31, total: 31 });
    expect(normalized.heatmap?.points?.[0]).toMatchObject({ lat: -33.086, lng: -68.471, value: 31 });
    expect(normalized.heatmap?.cells?.[0]).toMatchObject({ lat: -33.08, lng: -68.472, value: 31 });
    expect(normalized.heatmap?.metadata).toMatchObject({ raw_points_redacted: true });
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
      '/api/v2/public/surveys/mi-encuesta/respond?tenant_slug=rio-grande',
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
      contract_version: 'surveys.public_response.v2',
      ok: true,
      response_id: 99,
      live_results_url: '/api/v2/public/surveys/mi-encuesta/live-results?tenant_slug=rio-grande',
      realtime: { contract_version: 'surveys.realtime.v2', room: 'encuesta_mi-encuesta' },
    });

    const response = await postPublicResponse(
      'mi-encuesta',
      { respuestas: [{ pregunta_id: 101, opcion_ids: [1] }] },
      'rio-grande',
    );

    expect(response.contract_version).toBe('surveys.public_response.v2');
    expect(response.id).toBe(99);
    expect(response.live_results_url).toBe('/api/v2/public/surveys/mi-encuesta/live-results?tenant_slug=rio-grande');
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
