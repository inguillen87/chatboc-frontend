import React, { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/utils/api';
import type { SurveyPublic } from '@/types/encuestas';

const apiMocks = vi.hoisted(() => ({
  getPublicSurvey: vi.fn(),
  postPublicResponse: vi.fn(),
}));

vi.mock('@/api/encuestas', () => apiMocks);

import { useSurveyPublic } from './useSurveyPublic';

const survey: SurveyPublic = {
  slug: 'consulta-segura',
  titulo: 'Consulta segura',
  tipo: 'opinion',
  inicio_at: '2026-07-01T00:00:00.000Z',
  fin_at: '2026-08-01T00:00:00.000Z',
  politica_unicidad: 'libre',
  preguntas: [],
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useSurveyPublic submission conflicts', () => {
  beforeEach(() => {
    apiMocks.getPublicSurvey.mockReset().mockResolvedValue(survey);
    apiMocks.postPublicResponse.mockReset();
  });

  it.each([
    ['survey_response_duplicate', true],
    ['survey_submission_id_conflict', false],
    ['survey_instrument_revision_conflict', false],
  ] as const)('classifies %s without treating every 409 as a duplicate', async (reasonCode, duplicate) => {
    const apiError = new ApiError('Conflict', 409, { reason_code: reasonCode });
    apiMocks.postPublicResponse.mockRejectedValueOnce(apiError);
    const { result } = renderHook(() => useSurveyPublic('consulta-segura'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.survey).toEqual(survey));
    let thrown: unknown;
    await act(async () => {
      try {
        await result.current.submit({ respuestas: [] });
      } catch (error) {
        thrown = error;
      }
    });

    expect(thrown).toBe(apiError);
    await waitFor(() => {
      expect(result.current.submitReasonCode).toBe(reasonCode);
      expect(result.current.duplicateDetected).toBe(duplicate);
    });
  });
});
