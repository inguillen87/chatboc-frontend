import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { createSnapshot, listSnapshots, simulateSnapshotAnchor, verifyResponse } from '@/api/encuestas';
import type {
  SnapshotCreatePayload,
  SnapshotVerificationResult,
  SurveySnapshot,
} from '@/types/encuestas';
import { getErrorMessage } from '@/utils/api';
import { queryKeys } from '@/lib/queryKeys';
import { useTenant } from '@/context/TenantContext';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

interface UseAnchorResult {
  snapshots: SurveySnapshot[] | undefined;
  isLoading: boolean;
  error: string | null;
  create: (payload: SnapshotCreatePayload) => Promise<SurveySnapshot>;
  simulate: (snapshotId: number) => Promise<SurveySnapshot>;
  verify: (snapshotId: number, respuestaId: number) => Promise<SnapshotVerificationResult>;
  isCreating: boolean;
  isPublishing: boolean;
  isVerifying: boolean;
}

export function useAnchor(id?: number | null, tenantSlugOverride?: string | null): UseAnchorResult {
  const queryClient = useQueryClient();
  const { currentSlug } = useTenant();
  const tenantSlug = useMemo(
    () => tenantSlugOverride ?? currentSlug ?? safeLocalStorage.getItem('tenantSlug') ?? null,
    [currentSlug, tenantSlugOverride],
  );
  const normalizedId = useMemo(() => (typeof id === 'number' ? id : null), [id]);
  const requestOptions = useMemo(
    () => ({ tenantSlug: tenantSlug ?? undefined, sendAnonId: true }),
    [tenantSlug],
  );

  const query = useQuery({
    queryKey: queryKeys.surveys.snapshots(normalizedId ?? 'missing', tenantSlug),
    enabled: normalizedId !== null,
    retry: false,
    queryFn: () =>
      normalizedId !== null ? listSnapshots(normalizedId, requestOptions) : Promise.reject('No id provided'),
  });

  const createMutation = useMutation({
    mutationFn: async (payload: SnapshotCreatePayload) => {
      if (normalizedId === null) throw new Error('No survey id provided');
      const snapshot = await createSnapshot(normalizedId, payload, requestOptions);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.surveys.snapshots(normalizedId, tenantSlug),
      });
      return snapshot;
    },
  });

  const simulateMutation = useMutation({
    mutationFn: async (snapshotId: number) => {
      if (normalizedId === null) throw new Error('No survey id provided');
      const snapshot = await simulateSnapshotAnchor(normalizedId, snapshotId, requestOptions);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.surveys.snapshots(normalizedId, tenantSlug),
      });
      return snapshot;
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ snapshotId, respuestaId }: { snapshotId: number; respuestaId: number }) => {
      if (normalizedId === null) throw new Error('No survey id provided');
      return verifyResponse(normalizedId, snapshotId, respuestaId, requestOptions);
    },
  });

  return {
    snapshots: query.data,
    isLoading: query.isLoading,
    error: query.error ? getErrorMessage(query.error) : null,
    create: async (payload) => createMutation.mutateAsync(payload),
    simulate: async (snapshotId: number) => simulateMutation.mutateAsync(snapshotId),
    verify: async (snapshotId: number, respuestaId: number) =>
      verifyMutation.mutateAsync({ snapshotId, respuestaId }),
    isCreating: createMutation.isPending,
    isPublishing: simulateMutation.isPending,
    isVerifying: verifyMutation.isPending,
  };
}
