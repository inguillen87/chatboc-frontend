import { useQuery } from '@tanstack/react-query';

import { ApiError } from '@/utils/api';
import { getInterviewInboxV2 } from './interviewsApi';

export const interviewInboxQueryKey = (tenantSlug: string) =>
  ['interviews', 'inbox', tenantSlug] as const;

export const useInterviewInbox = (
  tenantSlug: string | null | undefined,
  options: { enabled?: boolean } = {},
) => {
  const normalizedTenantSlug = tenantSlug?.trim() || '';

  return useQuery({
    queryKey: interviewInboxQueryKey(normalizedTenantSlug),
    queryFn: () => getInterviewInboxV2(normalizedTenantSlug),
    enabled: Boolean(normalizedTenantSlug) && options.enabled !== false,
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    retry: (failureCount, error) => {
      if (failureCount >= 1) return false;
      return !(error instanceof ApiError) || error.status >= 500;
    },
  });
};
