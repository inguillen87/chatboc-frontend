import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { createSnapshot, listSnapshots, publishSnapshot, verifyResponse } from '@/api/encuestas';
import type { SurveySnapshot } from '@/types/encuestas';
import { getErrorMessage } from '@/utils/api';

interface UseAnchorResult {
  snapshots: SurveySnapshot[] | undefined;
  isLoading: boolean;
  error: string | null;
  create: (payload?: { rango?: string }) => Promise<SurveySnapshot>;
  publish: (snapshotId: number) => Promise<SurveySnapshot>;
  verify: (snapshotId: number, respuestaId: number) => Promise<{ ok: boolean; valido: boolean }>;
  isCreating: boolean;
  isPublishing: boolean;
  isVerifying: boolean;
}

export function useAnchor(id?: number | null): UseAnchorResult {
  const queryClient = useQueryClient();
  const normalizedId = useMemo(() => (typeof id === 'number' ? id : null), [id]);

  const query = useQuery({
    queryKey: ['survey-snapshots', normalizedId],
    enabled: normalizedId !== null,
    queryFn: () => (normalizedId !== null ? listSnapshots(normalizedId) : Promise.reject('No id provided')),
  });

  const createMutation = useMutation({
    mutationFn: async (payload?: { rango?: string }) => {
      if (normalizedId === null) throw new Error('No survey id provided');
      const snapshot = await createSnapshot(normalizedId, payload);
      await queryClient.invalidateQueries({ queryKey: ['survey-snapshots', normalizedId] });
      return snapshot;
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (snapshotId: number) => {
      if (normalizedId === null) throw new Error('No survey id provided');
      const snapshot = await publishSnapshot(normalizedId, snapshotId);
      await queryClient.invalidateQueries({ queryKey: ['survey-snapshots', normalizedId] });
      return snapshot;
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ snapshotId, respuestaId }: { snapshotId: number; respuestaId: number }) => {
      if (normalizedId === null) throw new Error('No survey id provided');
      return verifyResponse(normalizedId, snapshotId, respuestaId);
    },
  });

  return {
    snapshots: query.data,
    isLoading: query.isLoading,
    error: query.error ? getErrorMessage(query.error) : null,
    create: async (payload) => createMutation.mutateAsync(payload),
    publish: async (snapshotId: number) => publishMutation.mutateAsync(snapshotId),
    verify: async (snapshotId: number, respuestaId: number) =>
      verifyMutation.mutateAsync({ snapshotId, respuestaId }),
    isCreating: createMutation.isPending,
    isPublishing: publishMutation.isPending,
    isVerifying: verifyMutation.isPending,
  };
}
