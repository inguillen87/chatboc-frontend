import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { getPublicSurvey, postPublicResponse } from '@/api/encuestas';
import type { PublicResponsePayload, SurveyPublic } from '@/types/encuestas';
import { ApiError, getErrorMessage } from '@/utils/api';

export interface UseSurveyPublicOptions {
  tenantSlug?: string | null;
}

interface UseSurveyPublicResult {
  survey?: SurveyPublic;
  isLoading: boolean;
  error: string | null;
  submit: (payload: PublicResponsePayload) => Promise<void>;
  isSubmitting: boolean;
  lastResponseId?: number;
  duplicateDetected: boolean;
  submitError: string | null;
  submitStatus: number | null;
}

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
    error,
  } = useQuery({
    queryKey: ['survey-public', normalizedSlug, normalizedTenantSlug],
    enabled: Boolean(normalizedSlug),
    queryFn: () => getPublicSurvey(normalizedSlug, normalizedTenantSlug || undefined),
    staleTime: 1000 * 60,
  });

  const mutation = useMutation({
    mutationKey: ['survey-public-submit', normalizedSlug, normalizedTenantSlug],
    mutationFn: async (payload: PublicResponsePayload) => {
      if (!normalizedSlug) throw new Error('Encuesta no disponible.');
      const response = await postPublicResponse(
        normalizedSlug,
        payload,
        normalizedTenantSlug || undefined,
      );
      await queryClient.invalidateQueries({
        queryKey: ['survey-public', normalizedSlug, normalizedTenantSlug],
      });
      return response;
    },
  });

  return {
    survey: data,
    isLoading,
    error: error ? getErrorMessage(error) : null,
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
