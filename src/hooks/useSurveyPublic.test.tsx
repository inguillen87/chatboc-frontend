import React, { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/utils/api';
import type { PublicResponsePayload, SurveyPublic } from '@/types/encuestas';
import { SURVEY_RESPONSE_DUPLICATE_MESSAGE } from '@/utils/surveySubmissionErrors';

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
    const apiError = new ApiError('duplicate key value violates unique constraint survey_response_identity', 409, {
      reason_code: reasonCode,
    });
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
    expect(apiMocks.postPublicResponse).toHaveBeenCalledTimes(1);
    expect(result.current.submitError).toBe(
      duplicate
        ? SURVEY_RESPONSE_DUPLICATE_MESSAGE
        : 'duplicate key value violates unique constraint survey_response_identity',
    );
  });

  it('keeps the credential outside React Query mutation variables', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const credential = 'sec1_ephemeral-only';
    const payload: PublicResponsePayload = {
      submission_id: '018f4c8e-1e56-7f38-a4df-83fd68394911',
      respuestas: [{ pregunta_id: 101, opcion_ids: [1] }],
    };
    const expectedAck = { ok: true, ack_kind: 'durable_response' as const, id: 99 };
    apiMocks.postPublicResponse.mockResolvedValueOnce(expectedAck);
    const { result } = renderHook(() => useSurveyPublic('consulta-segura'), { wrapper });
    await waitFor(() => expect(result.current.survey).toEqual(survey));

    let returnedAck: unknown;
    await act(async () => {
      returnedAck = await result.current.submit(payload, {
        eligibilityCredential: credential,
        eligibilityExpectation: {
          contractVersion: 'surveys.public_eligibility.v1',
          releaseId: 51,
          policyVersion: 'eligibility-v1',
          mode: 'institution_attested',
        },
      });
    });

    expect(returnedAck).toBe(expectedAck);
    expect(apiMocks.postPublicResponse).toHaveBeenCalledWith(
      'consulta-segura',
      payload,
      undefined,
      expect.objectContaining({ eligibilityCredential: credential }),
    );
    const cachedVariables = queryClient.getMutationCache().getAll().map((entry) => entry.state.variables);
    expect(cachedVariables).toEqual([payload]);
    expect(JSON.stringify(cachedVariables)).not.toContain(credential);
  });

  it('isolates credentials across concurrent programmatic submissions', async () => {
    const firstPayload: PublicResponsePayload = {
      submission_id: '018f4c8e-1e56-7f38-a4df-83fd68394921',
      respuestas: [{ pregunta_id: 101, opcion_ids: [1] }],
    };
    const secondPayload: PublicResponsePayload = {
      submission_id: '018f4c8e-1e56-7f38-a4df-83fd68394922',
      respuestas: [{ pregunta_id: 101, opcion_ids: [2] }],
    };
    const expectation = {
      contractVersion: 'surveys.public_eligibility.v1' as const,
      releaseId: 51,
      policyVersion: 'eligibility-v1',
      mode: 'institution_attested' as const,
    };
    let releaseRequests: (() => void) | undefined;
    const requestGate = new Promise<void>((resolve) => {
      releaseRequests = resolve;
    });
    apiMocks.postPublicResponse.mockImplementation(async () => {
      await requestGate;
      return { ok: true, ack_kind: 'durable_response' as const, id: 99 };
    });
    const { result } = renderHook(() => useSurveyPublic('consulta-segura'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.survey).toEqual(survey));

    let firstRequest!: Promise<unknown>;
    let secondRequest!: Promise<unknown>;
    act(() => {
      firstRequest = result.current.submit(firstPayload, {
        eligibilityCredential: 'sec1_first-credential',
        eligibilityExpectation: expectation,
      });
      secondRequest = result.current.submit(secondPayload, {
        eligibilityCredential: 'sec1_second-credential',
        eligibilityExpectation: expectation,
      });
    });

    await waitFor(() => expect(apiMocks.postPublicResponse).toHaveBeenCalledTimes(2));
    expect(apiMocks.postPublicResponse.mock.calls).toEqual(
      expect.arrayContaining([
        [
          'consulta-segura',
          expect.objectContaining({ submission_id: firstPayload.submission_id }),
          undefined,
          expect.objectContaining({ eligibilityCredential: 'sec1_first-credential' }),
        ],
        [
          'consulta-segura',
          expect.objectContaining({ submission_id: secondPayload.submission_id }),
          undefined,
          expect.objectContaining({ eligibilityCredential: 'sec1_second-credential' }),
        ],
      ]),
    );

    releaseRequests?.();
    await act(async () => {
      await Promise.all([firstRequest, secondRequest]);
    });
  });
});
