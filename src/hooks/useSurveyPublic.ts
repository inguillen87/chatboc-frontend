import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { getPublicSurvey, postPublicResponse } from '@/api/encuestas';
import type { PublicResponsePayload, SurveyPublic } from '@/types/encuestas';
import { ApiError, NetworkError, getErrorMessage } from '@/utils/api';
import { queryKeys } from '@/lib/queryKeys';

export interface UseSurveyPublicOptions {
  tenantSlug?: string | null;
}

interface UseSurveyPublicResult {
  survey?: SurveyPublic;
  isLoading: boolean;
  isRefetching: boolean;
  error: string | null;
  errorStatus: number | null;
  errorDetails: Record<string, unknown> | null;
  errorReasonCode: string | null;
  retryLoad: () => Promise<unknown>;
  submit: (payload: PublicResponsePayload) => Promise<void>;
  isSubmitting: boolean;
  lastResponseId?: number;
  duplicateDetected: boolean;
  submitError: string | null;
  submitStatus: number | null;
}

const getSurveyPublicErrorReasonCode = (error: unknown): string | null => {
  if (!(error instanceof ApiError)) return null;
  const reasonCode = (error.body as Record<string, unknown> | undefined)?.reason_code;
  return typeof reasonCode === 'string' && reasonCode.trim() ? reasonCode.trim() : null;
};

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

  const {
    data,
    isLoading,
    isRefetching,
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
      );
      await queryClient.invalidateQueries({
        queryKey: queryKeys.surveys.public(normalizedSlug, normalizedTenantSlug),
      });
      return response;
    },
  });

  const errorReasonCode = getSurveyPublicErrorReasonCode(error);
  const errorStatus = error instanceof ApiError ? error.status : null;
  const errorDetails =
    error instanceof ApiError && error.body && typeof error.body === 'object'
      ? (error.body as Record<string, unknown>)
      : null;

  return {
    survey: data,
    isLoading,
    isRefetching,
    error: error ? getErrorMessage(error) : null,
    errorStatus,
    errorDetails,
    errorReasonCode,
    retryLoad: () => refetch(),
    submit: async (payload: PublicResponsePayload) => {
      try {
        await mutation.mutateAsync(payload);
      } catch (err) {
        throw err;
      }
    },
    isSubmitting: mutation.isPending,
    lastResponseId: mutation.data?.id,
    duplicateDetected: mutation.error instanceof ApiError && mutation.error.status === 409,
    submitError: mutation.error ? getErrorMessage(mutation.error) : null,
    submitStatus: mutation.error instanceof ApiError ? mutation.error.status : null,
  };
}
