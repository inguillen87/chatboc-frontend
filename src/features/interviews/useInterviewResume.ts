import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@/utils/api';
import {
  getInterviewResumeV2,
  normalizeInterviewSessionId,
} from './interviewsApi';

export const interviewResumeQueryKey = (
  tenantSlug: string,
  sessionId: number | null,
) => ['interviews', 'resume', tenantSlug, sessionId] as const;

export const useInterviewResume = (
  sessionId: string | number | null | undefined,
  tenantSlug: string | null | undefined,
) => {
  const normalizedSessionId = normalizeInterviewSessionId(sessionId);
  const normalizedTenantSlug = tenantSlug?.trim() || '';

  return useQuery({
    queryKey: interviewResumeQueryKey(
      normalizedTenantSlug,
      normalizedSessionId,
    ),
    queryFn: () =>
      getInterviewResumeV2(normalizedSessionId as number, normalizedTenantSlug),
    enabled: Boolean(normalizedSessionId && normalizedTenantSlug),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    retry: (failureCount, error) => {
      if (failureCount >= 1) return false;
      return !(error instanceof ApiError) || error.status >= 500;
    },
  });
};
