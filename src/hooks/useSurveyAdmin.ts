import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import {
  adminCreateSurvey,
  adminDeleteSurvey,
  adminGetSurvey,
  adminListSurveys,
  adminPublishSurvey,
  adminSeedSurvey,
  adminUpdateSurvey,
} from '@/api/encuestas';
import type { SurveyAdmin, SurveyDraftPayload, SurveyListResponse } from '@/types/encuestas';
import { getErrorMessage } from '@/utils/api';
import { useTenant } from '@/context/TenantContext';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

interface UseSurveyAdminOptions {
  id?: number | null;
  listParams?: Record<string, unknown>;
}

interface UseSurveyAdminResult {
  survey?: SurveyAdmin;
  surveys?: SurveyListResponse;
  isLoadingSurvey: boolean;
  isLoadingList: boolean;
  surveyError: string | null;
  listError: string | null;
  saveSurvey: (payload: SurveyDraftPayload) => Promise<SurveyAdmin>;
  createSurvey: (payload: SurveyDraftPayload) => Promise<SurveyAdmin>;
  publishSurvey: (id?: number) => Promise<SurveyAdmin>;
  seedSurvey: (id: number, cantidad: number) => Promise<{ creadas: number }>;
  deleteSurvey: (id: number) => Promise<void>;
  isSaving: boolean;
  isPublishing: boolean;
  isSeeding: boolean;
  isDeleting: boolean;
  refetchSurvey: () => Promise<SurveyAdmin | undefined>;
  refetchList: () => Promise<SurveyListResponse | undefined>;
}

const buildListKey = (params?: Record<string, unknown>) =>
  params ? JSON.stringify(Object.fromEntries(Object.entries(params).sort())) : 'default';

export function useSurveyAdmin(options: UseSurveyAdminOptions = {}): UseSurveyAdminResult {
  const queryClient = useQueryClient();
  const { currentSlug } = useTenant();
  const tenantSlug = useMemo(
    () => currentSlug ?? safeLocalStorage.getItem('tenantSlug') ?? null,
    [currentSlug],
  );
  const adminRequestOptions = useMemo(
    () => ({ tenantSlug: tenantSlug ?? undefined, sendAnonId: true }),
    [tenantSlug],
  );
  const normalizedId = useMemo(() => (typeof options.id === 'number' ? options.id : null), [options.id]);

  const surveyQuery = useQuery({
    queryKey: ['survey-admin', normalizedId],
    enabled: normalizedId !== null,
    queryFn: () =>
      normalizedId !== null
        ? adminGetSurvey(normalizedId, adminRequestOptions)
        : Promise.reject(new Error('No id provided')),
  });

  const listQuery = useQuery({
    queryKey: ['survey-admin-list', buildListKey(options.listParams)],
    queryFn: () => adminListSurveys(options.listParams as any, adminRequestOptions),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: SurveyDraftPayload) => {
      if (normalizedId === null) throw new Error('No survey id provided');
      const updated = await adminUpdateSurvey(normalizedId, payload, adminRequestOptions);
      await queryClient.invalidateQueries({ queryKey: ['survey-admin', normalizedId] });
      await queryClient.invalidateQueries({ queryKey: ['survey-admin-list'] });
      return updated;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: SurveyDraftPayload) => {
      const created = await adminCreateSurvey(payload, adminRequestOptions);
      await queryClient.invalidateQueries({ queryKey: ['survey-admin-list'] });
      return created;
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (payload?: { id?: number }) => {
      const targetId = typeof payload?.id === 'number' ? payload.id : normalizedId;
      if (targetId === null) throw new Error('No survey id provided');
      const published = await adminPublishSurvey(targetId, adminRequestOptions);
      await queryClient.invalidateQueries({ queryKey: ['survey-admin', targetId] });
      await queryClient.invalidateQueries({ queryKey: ['survey-admin-list'] });
      return published;
    },
  });

  const seedMutation = useMutation({
    mutationFn: async ({ id, cantidad }: { id: number; cantidad: number }) => {
      const result = await adminSeedSurvey(id, { cantidad }, adminRequestOptions);
      await queryClient.invalidateQueries({ queryKey: ['survey-admin', id] });
      await queryClient.invalidateQueries({ queryKey: ['survey-admin-list'] });
      return result;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await adminDeleteSurvey(id, adminRequestOptions);
      await queryClient.invalidateQueries({ queryKey: ['survey-admin', id] });
      await queryClient.invalidateQueries({ queryKey: ['survey-admin-list'] });
    },
  });

  return {
    survey: surveyQuery.data,
    surveys: listQuery.data,
    isLoadingSurvey: surveyQuery.isLoading,
    isLoadingList: listQuery.isLoading,
    surveyError: surveyQuery.error ? getErrorMessage(surveyQuery.error) : null,
    listError: listQuery.error ? getErrorMessage(listQuery.error) : null,
    saveSurvey: async (payload: SurveyDraftPayload) => saveMutation.mutateAsync(payload),
    createSurvey: async (payload: SurveyDraftPayload) => createMutation.mutateAsync(payload),
    publishSurvey: async (id?: number) => publishMutation.mutateAsync({ id }),
    seedSurvey: async (id: number, cantidad: number) => seedMutation.mutateAsync({ id, cantidad }),
    deleteSurvey: async (id: number) => deleteMutation.mutateAsync(id),
    isSaving: saveMutation.isPending || createMutation.isPending,
    isPublishing: publishMutation.isPending,
    isSeeding: seedMutation.isPending,
    isDeleting: deleteMutation.isPending,
    refetchSurvey: async () => {
      const result = await surveyQuery.refetch();
      return result.data;
    },
    refetchList: async () => {
      const result = await listQuery.refetch();
      return result.data;
    },
  };
}
