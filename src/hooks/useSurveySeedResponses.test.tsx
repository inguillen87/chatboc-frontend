import React, { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SurveyAdmin } from '@/types/encuestas';
import { ApiError } from '@/utils/api';

const apiMocks = vi.hoisted(() => ({
  adminSeedSurvey: vi.fn(),
  postPublicResponse: vi.fn(),
}));

vi.mock('@/api/encuestas', () => apiMocks);

import { useSurveySeedResponses } from './useSurveySeedResponses';

const survey: SurveyAdmin = {
  id: 42,
  slug: 'consulta-segura',
  titulo: 'Consulta segura',
  tipo: 'opinion',
  estado: 'publicada',
  inicio_at: '2026-07-01T00:00:00.000Z',
  fin_at: '2026-08-01T00:00:00.000Z',
  politica_unicidad: 'por_usuario',
  preguntas: [],
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      // Deliberately hostile global policy: the hook must still fail closed.
      mutations: { retry: 3 },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useSurveySeedResponses duplicate contract', () => {
  beforeEach(() => {
    apiMocks.adminSeedSurvey.mockReset();
    apiMocks.postPublicResponse.mockReset();
  });

  it('treats the exact admin duplicate as terminal without retry or public fallback', async () => {
    apiMocks.adminSeedSurvey.mockRejectedValueOnce(new ApiError('technical duplicate', 409, {
      reason_code: 'survey_response_duplicate',
    }));
    const { result } = renderHook(() => useSurveySeedResponses(), { wrapper: createWrapper() });

    let summary: Awaited<ReturnType<typeof result.current.seed>> | undefined;
    await act(async () => {
      summary = await result.current.seed({ survey, count: 2 });
    });

    expect(summary).toEqual({ total: 2, success: 0, duplicates: 2, failures: 0, errors: [] });
    expect(apiMocks.adminSeedSurvey).toHaveBeenCalledTimes(1);
    expect(apiMocks.postPublicResponse).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.progress).toEqual({
      processed: 2,
      total: 2,
      success: 0,
      duplicates: 2,
      failures: 0,
    }));
  });

  it('does not relabel or retry a different HTTP 409 conflict', async () => {
    const conflict = new ApiError('Instrument changed', 409, {
      reason_code: 'survey_instrument_revision_conflict',
    });
    apiMocks.adminSeedSurvey.mockRejectedValueOnce(conflict);
    const { result } = renderHook(() => useSurveySeedResponses(), { wrapper: createWrapper() });

    let thrown: unknown;
    await act(async () => {
      try {
        await result.current.seed({ survey, count: 2 });
      } catch (error) {
        thrown = error;
      }
    });

    expect(thrown).toBe(conflict);
    expect(apiMocks.adminSeedSurvey).toHaveBeenCalledTimes(1);
    expect(apiMocks.postPublicResponse).not.toHaveBeenCalled();
  });

  it.each([
    ['forbidden administrative capability', 403],
    ['unavailable administrative service', 503],
  ])('fails closed for %s without public submissions', async (_label, status) => {
    const adminFailure = new ApiError('Administrative seeding unavailable', status, {
      reason_code: status === 403
        ? 'survey_demo_seeding_disabled'
        : 'survey_seed_service_unavailable',
    });
    apiMocks.adminSeedSurvey.mockRejectedValueOnce(adminFailure);
    const { result } = renderHook(() => useSurveySeedResponses(), { wrapper: createWrapper() });

    let thrown: unknown;
    await act(async () => {
      try {
        await result.current.seed({ survey, count: 2, scenario: 'balanced' });
      } catch (error) {
        thrown = error;
      }
    });

    expect(thrown).toBe(adminFailure);
    expect(apiMocks.adminSeedSurvey).toHaveBeenCalledTimes(1);
    expect(apiMocks.adminSeedSurvey).toHaveBeenCalledWith(42, {
      cantidad: 2,
      municipality_label: undefined,
      scenario: 'balanced',
    });
    expect(apiMocks.postPublicResponse).not.toHaveBeenCalled();
    expect(result.current.progress).toBeNull();
  });
});
