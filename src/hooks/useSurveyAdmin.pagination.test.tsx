import React, { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SurveyAdmin, SurveyListResponse } from '@/types/encuestas';

const apiMocks = vi.hoisted(() => ({
  adminCreateSurvey: vi.fn(),
  adminCloseSurvey: vi.fn(),
  adminDeleteSurvey: vi.fn(),
  adminDuplicateSurvey: vi.fn(),
  adminGetSurvey: vi.fn(),
  adminListSurveys: vi.fn(),
  adminPublishSurvey: vi.fn(),
  adminSeedSurvey: vi.fn(),
  adminUpdateSurvey: vi.fn(),
}));

const surveyApiMocks = vi.hoisted(() => ({
  publishSurveyV2: vi.fn(),
}));

vi.mock('@/api/encuestas', () => apiMocks);
vi.mock('@/features/surveys/surveysApi', () => surveyApiMocks);
vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({ currentSlug: 'org-demo' }),
}));
vi.mock('@/utils/safeLocalStorage', () => ({
  safeLocalStorage: { getItem: vi.fn(() => null) },
}));

import { useSurveyAdmin } from './useSurveyAdmin';

const makeSurvey = (id: number, responses: number): SurveyAdmin => ({
  id,
  tenant_id: 12,
  slug: `consulta-${id}`,
  titulo: `Consulta ${id}`,
  tipo: 'opinion',
  estado: 'publicada',
  inicio_at: '2026-08-01T12:00:00Z',
  fin_at: '2026-08-20T12:00:00Z',
  politica_unicidad: 'libre',
  preguntas: [],
  esta_activa: true,
  metricas: {
    total_respuestas: responses,
    respuestas_ultimas_24h: responses,
    respuestas_con_coordenadas: 0,
    participantes_unicos: responses,
    ultima_respuesta_at: '2026-08-02T11:30:00Z',
  },
  admin_lifecycle: {
    contract_version: 'surveys.admin_lifecycle.v1',
    instrument_kind: 'survey',
    phase: 'collecting',
    persisted_state: 'publicada',
    accepts_responses: true,
    schedule: {
      opens_at: '2026-08-01T12:00:00Z',
      closes_at: '2026-08-20T12:00:00Z',
      evaluated_at: '2026-08-02T12:00:00Z',
    },
    participation: {
      responses,
      unique_participants: responses,
      responses_last_24h: responses,
      last_response_at: '2026-08-02T11:30:00Z',
      eligible_population: null,
      participation_rate: null,
      abstentions: null,
      denominator_status: {
        available: false,
        reason_code: 'survey_eligible_population_not_configured',
      },
    },
    capabilities: {
      can_publish: false,
      can_close: true,
      can_delete: false,
      can_share: true,
      can_view_results: responses > 0,
    },
    actions: {
      publish: {
        method: 'POST',
        endpoint: `/api/v2/surveys/${id}/publish`,
        enabled: false,
      },
      close: {
        method: 'POST',
        endpoint: `/api/v2/surveys/${id}/close`,
        enabled: true,
        confirmation_required: true,
        irreversible: true,
      },
    },
  },
});

const page = ({
  survey,
  cursor,
  nextCursor,
  hasMore,
  total,
}: {
  survey: SurveyAdmin;
  cursor: string | null;
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
}): SurveyListResponse => ({
  contract_version: 'surveys.admin_list.v2',
  tenant: { id: 12, slug: 'org-demo' },
  freshness: {
    generated_at: '2026-08-02T12:00:00Z',
    source: 'enc_encuesta_and_enc_respuesta',
    synthetic: false,
  },
  executive_summary: {
    contract_version: 'surveys.admin_executive_overview.v1',
    aggregation_scope: {
      mode: 'returned_page',
      returned_items: 1,
      query_total_items: total,
      complete_for_query: !hasMore && cursor === null,
    },
  } as SurveyListResponse['executive_summary'],
  data_quality: {
    contract_version: 'surveys.admin_data_quality.v1',
    aggregation_scope: {
      mode: 'returned_page',
      returned_items: 1,
      query_total_items: total,
      complete_for_query: !hasMore && cursor === null,
    },
  } as SurveyListResponse['data_quality'],
  data: [survey],
  overview: {
    total: 1,
    por_estado: { publicada: 1 },
    activas: 1,
    con_respuestas: survey.metricas!.total_respuestas > 0 ? 1 : 0,
    total_respuestas: survey.metricas!.total_respuestas,
    respuestas_con_coordenadas: 0,
    respuestas_ultimas_24h: survey.metricas!.respuestas_ultimas_24h,
    accepting_responses: 1,
    por_tipo_instrumento: { survey: 1, voting: 0 },
    participation_denominator: {
      available: false,
      reason_code: 'survey_eligible_population_not_configured',
    },
  },
  pagination: {
    contract_version: 'surveys.pagination.v1',
    limit: 50,
    page: cursor ? null : 1,
    cursor,
    next_cursor: nextCursor,
    next_page: cursor || !hasMore ? null : 2,
    has_more: hasMore,
    returned: 1,
    total_items: total,
    ordering: 'id_desc',
  },
});

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useSurveyAdmin paginated listing', () => {
  beforeEach(() => {
    Object.values(apiMocks).forEach((mock) => mock.mockReset());
    Object.values(surveyApiMocks).forEach((mock) => mock.mockReset());
  });

  it('loads the next cursor without replacing prior instruments and aggregates only loaded metrics', async () => {
    apiMocks.adminListSurveys
      .mockResolvedValueOnce(page({
        survey: makeSurvey(52, 7),
        cursor: null,
        nextCursor: 'cursor-51',
        hasMore: true,
        total: 2,
      }))
      .mockResolvedValueOnce(page({
        survey: makeSurvey(51, 5),
        cursor: 'cursor-51',
        nextCursor: null,
        hasMore: false,
        total: 2,
      }));

    const { result } = renderHook(() => useSurveyAdmin(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.surveys?.data).toHaveLength(1));
    expect(result.current.hasMoreSurveys).toBe(true);
    expect(result.current.surveys?.executive_summary).toBeDefined();
    expect(result.current.surveyListProgress).toEqual({ loaded: 1, total: 2 });

    await act(async () => {
      await result.current.loadMoreSurveys();
    });

    await waitFor(() => expect(result.current.surveys?.data).toHaveLength(2));
    expect(result.current.surveys?.data.map((survey) => survey.id)).toEqual([52, 51]);
    expect(result.current.surveys?.overview).toMatchObject({
      total: 2,
      total_respuestas: 12,
      respuestas_ultimas_24h: 12,
    });
    expect(result.current.surveys?.executive_summary).toBeUndefined();
    expect(result.current.surveys?.data_quality).toBeUndefined();
    expect(result.current.surveyListProgress).toEqual({ loaded: 2, total: 2 });
    expect(result.current.hasMoreSurveys).toBe(false);
    expect(apiMocks.adminListSurveys).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ limit: 50, cursor: 'cursor-51', page: undefined }),
      expect.objectContaining({ tenantSlug: 'org-demo' }),
    );
  });

  it('keeps the first page visible when loading the next cursor fails', async () => {
    apiMocks.adminListSurveys
      .mockResolvedValueOnce(page({
        survey: makeSurvey(52, 7),
        cursor: null,
        nextCursor: 'cursor-51',
        hasMore: true,
        total: 2,
      }))
      .mockRejectedValueOnce(new Error('network unavailable'));

    const { result } = renderHook(() => useSurveyAdmin(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.surveys?.data).toHaveLength(1));

    await act(async () => {
      await result.current.loadMoreSurveys();
    });

    await waitFor(() => expect(result.current.loadMoreError).toBeTruthy());
    expect(result.current.listError).toBeNull();
    expect(result.current.surveys?.data.map((survey) => survey.id)).toEqual([52]);
    expect(result.current.surveyListProgress).toEqual({ loaded: 1, total: 2 });
  });

  it('publishes a non-governed instrument through the tenant-scoped V2 client', async () => {
    apiMocks.adminListSurveys.mockResolvedValue(page({
      survey: makeSurvey(52, 0),
      cursor: null,
      nextCursor: null,
      hasMore: false,
      total: 1,
    }));
    surveyApiMocks.publishSurveyV2.mockResolvedValue({
      id: '52',
      title: 'Consulta 52',
      questions: [],
      raw: { id: 52, estado: 'publicada' },
    });

    const { result } = renderHook(() => useSurveyAdmin(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.surveys?.data).toHaveLength(1));

    await act(async () => {
      await result.current.publishSurvey(52);
    });

    expect(surveyApiMocks.publishSurveyV2).toHaveBeenCalledWith(52, 'org-demo');
    expect(apiMocks.adminPublishSurvey).not.toHaveBeenCalled();
  });

  it('fails clearly when the V2 publication acknowledgment does not match the instrument', async () => {
    apiMocks.adminListSurveys.mockResolvedValue(page({
      survey: makeSurvey(52, 0),
      cursor: null,
      nextCursor: null,
      hasMore: false,
      total: 1,
    }));
    surveyApiMocks.publishSurveyV2.mockResolvedValue({
      id: '99',
      title: 'Otra consulta',
      questions: [],
    });

    const { result } = renderHook(() => useSurveyAdmin(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.surveys?.data).toHaveLength(1));

    await expect(result.current.publishSurvey(52)).rejects.toThrow(
      'No pudimos verificar la confirmación de publicación del servidor.',
    );
  });
});
