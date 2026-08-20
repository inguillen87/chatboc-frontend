import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef } from 'react';

import { getPublicSurvey, postPublicResponse } from '@/api/encuestas';
import type { PublicResponsePayload, PublicSurveySubmitOptions, SurveyPublic } from '@/types/encuestas';
import { ApiError, NetworkError, getErrorMessage } from '@/utils/api';
import { queryKeys } from '@/lib/queryKeys';
import {
  getSurveySubmissionReasonCode,
  getSurveySubmissionUserMessage,
  isSurveyResponseDuplicateError,
} from '@/utils/surveySubmissionErrors';

export interface UseSurveyPublicOptions {
  tenantSlug?: string | null;
}

interface UseSurveyPublicResult {
  survey?: SurveyPublic;
  isLoading: boolean;
  isRefetching: boolean;
  failureCount: number;
  error: string | null;
  errorStatus: number | null;
  errorDetails: Record<string, unknown> | null;
  errorReasonCode: string | null;
  isTransientError: boolean;
  retryLoad: () => Promise<unknown>;
  submit: (payload: PublicResponsePayload, options?: PublicSurveySubmitOptions) => Promise<void>;
  isSubmitting: boolean;
  lastResponseId?: number;
  duplicateDetected: boolean;
  submitError: string | null;
  submitStatus: number | null;
  submitErrorDetails: Record<string, unknown> | null;
  submitReasonCode: string | null;
}

const RETRY_DELAYS_MS = [700, 1500] as const;

const isTransientPublicSurveyError = (error: unknown): boolean => {
  if (error instanceof NetworkError) return true;
  if (error instanceof ApiError) return error.status >= 500;
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return message.includes('network') || message.includes('timeout');
};

export function useSurveyPublic(
  slug?: string | null,
  options?: UseSurveyPublicOptions,
): UseSurveyPublicResult {
  const queryClient = useQueryClient();
  const normalizedSlug = useMemo(() => slug?.trim() || '', [slug]);
  const normalizedTenantSlug = useMemo(
    () => options?.tenantSlug?.trim() || '',
    [options?.tenantSlug],
  );
  const transientSubmitOptionsRef = useRef(
    new WeakMap<PublicResponsePayload, PublicSurveySubmitOptions>(),
  );

  const {
    data,
    isLoading,
    isRefetching,
    failureCount,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.surveys.public(normalizedSlug, normalizedTenantSlug),
    enabled: Boolean(normalizedSlug),
    queryFn: () => getPublicSurvey(normalizedSlug, normalizedTenantSlug || undefined),
    staleTime: 1000 * 60,
    retry: (failureCount, err) => {
      if (!isTransientPublicSurveyError(err)) return false;
      return failureCount <= RETRY_DELAYS_MS.length;
    },
    retryDelay: (attemptIndex) => RETRY_DELAYS_MS[attemptIndex - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1],
  });

  const mutation = useMutation({
    mutationKey: queryKeys.surveys.submitPublic(normalizedSlug, normalizedTenantSlug),
    mutationFn: async (payload: PublicResponsePayload) => {
      if (!normalizedSlug) throw new Error('Encuesta no disponible.');
      const response = await postPublicResponse(
        normalizedSlug,
        payload,
        normalizedTenantSlug || undefined,
        transientSubmitOptionsRef.current.get(payload),
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.surveys.public(normalizedSlug, normalizedTenantSlug),
      });
      return response;
    },
    // A public submission is already idempotent at transport level. Never let
    // a global QueryClient policy replay a POST, especially after a 409.
    retry: false,
  });

  const errorReasonCode = getSurveySubmissionReasonCode(error);
  const errorStatus = error instanceof ApiError ? error.status : null;
  const errorDetails =
    error instanceof ApiError && error.body && typeof error.body === 'object'
      ? (error.body as Record<string, unknown>)
      : null;

  return {
    survey: data,
    isLoading,
    isRefetching,
    failureCount,
    error: error ? getErrorMessage(error) : null,
    errorStatus,
    errorDetails,
    errorReasonCode,
    isTransientError: isTransientPublicSurveyError(error),
    retryLoad: () => refetch(),
    submit: async (payload: PublicResponsePayload, options?: PublicSurveySubmitOptions) => {
      // Each mutation receives a distinct non-secret payload object. The raw
      // credential stays in a WeakMap keyed by that exact object, so concurrent
      // programmatic submissions cannot borrow another attempt's credential
      // and React Query still persists only non-secret mutation variables.
      const mutationPayload = { ...payload };
      if (options) {
        transientSubmitOptionsRef.current.set(mutationPayload, options);
      }
      try {
        await mutation.mutateAsync(mutationPayload);
      } finally {
        transientSubmitOptionsRef.current.delete(mutationPayload);
      }
    },
    isSubmitting: mutation.isPending,
    lastResponseId: mutation.data?.id,
    duplicateDetected: isSurveyResponseDuplicateError(mutation.error),
    submitError: mutation.error
      ? getSurveySubmissionUserMessage(mutation.error) ?? getErrorMessage(mutation.error)
      : null,
    submitStatus: mutation.error instanceof ApiError ? mutation.error.status : null,
    submitErrorDetails:
      mutation.error instanceof ApiError && mutation.error.body && typeof mutation.error.body === 'object'
        ? (mutation.error.body as Record<string, unknown>)
        : null,
    submitReasonCode: getSurveySubmissionReasonCode(mutation.error),
  };
}
