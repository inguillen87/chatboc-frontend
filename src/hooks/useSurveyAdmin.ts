import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import {
  adminCreateSurvey,
  adminDeleteSurvey,
  adminDuplicateSurvey,
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
import { queryKeys } from '@/lib/queryKeys';
import { withExpectedSurveyStructureRevision } from '@/utils/surveyStructureGuard';

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
  duplicateSurvey: (id?: number, payload?: { titulo?: string; slug?: string }) => Promise<SurveyAdmin>;
  publishSurvey: (id?: number) => Promise<SurveyAdmin>;
  seedSurvey: (
    id: number,
    payload: { cantidad: number; reset?: boolean; geo_profile_key?: string; municipality_label?: string },
  ) => Promise<{ creadas: number; reset?: { respuestas?: number; comentarios?: number } }>;
  deleteSurvey: (id: number) => Promise<void>;
  isSaving: boolean;
  isPublishing: boolean;
  isDuplicating: boolean;
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
    queryKey: queryKeys.surveys.admin(normalizedId ?? 'missing'),
    enabled: normalizedId !== null,
    retry: false,
    queryFn: () =>
      normalizedId !== null
        ? adminGetSurvey(normalizedId, adminRequestOptions)
        : Promise.reject(new Error('No id provided')),
  });

  const listQuery = useQuery({
    queryKey: queryKeys.surveys.adminList(buildListKey(options.listParams)),
    queryFn: () => adminListSurveys(options.listParams as any, adminRequestOptions),
    retry: false,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: SurveyDraftPayload) => {
      if (normalizedId === null) throw new Error('No survey id provided');
      const guardedPayload = withExpectedSurveyStructureRevision(payload, surveyQuery.data);
      const updated = await adminUpdateSurvey(normalizedId, guardedPayload, adminRequestOptions);
      queryClient.setQueryData(queryKeys.surveys.admin(normalizedId), updated);
      await queryClient.invalidateQueries({ queryKey: queryKeys.surveys.admin(normalizedId ?? 'missing') });
      await queryClient.invalidateQueries({ queryKey: ['surveys', 'admin-list'] });
      return updated;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: SurveyDraftPayload) => {
      const created = await adminCreateSurvey(payload, adminRequestOptions);
      await queryClient.invalidateQueries({ queryKey: ['surveys', 'admin-list'] });
      return created;
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (payload?: { id?: number; titulo?: string; slug?: string }) => {
      const targetId = typeof payload?.id === 'number' ? payload.id : normalizedId;
      if (targetId === null) throw new Error('No survey id provided');
      const duplicated = await adminDuplicateSurvey(
        targetId,
        { titulo: payload?.titulo, slug: payload?.slug },
        adminRequestOptions,
      );
      await queryClient.invalidateQueries({ queryKey: ['surveys', 'admin-list'] });
      return duplicated;
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (payload?: { id?: number }) => {
      const targetId = typeof payload?.id === 'number' ? payload.id : normalizedId;
      if (targetId === null) throw new Error('No survey id provided');
      const published = await adminPublishSurvey(targetId, adminRequestOptions);
      queryClient.setQueryData(queryKeys.surveys.admin(targetId), published);
      await queryClient.invalidateQueries({ queryKey: queryKeys.surveys.admin(targetId) });
      await queryClient.invalidateQueries({ queryKey: ['surveys', 'admin-list'] });
      return published;
    },
  });

  const seedMutation = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: number;
      payload: { cantidad: number; reset?: boolean; geo_profile_key?: string; municipality_label?: string };
    }) => {
      const result = await adminSeedSurvey(id, payload, adminRequestOptions);
      await queryClient.invalidateQueries({ queryKey: queryKeys.surveys.admin(id) });
      await queryClient.invalidateQueries({ queryKey: ['surveys', 'admin-list'] });
      return result;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await adminDeleteSurvey(id, adminRequestOptions);
      await queryClient.invalidateQueries({ queryKey: queryKeys.surveys.admin(id) });
      await queryClient.invalidateQueries({ queryKey: ['surveys', 'admin-list'] });
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
    duplicateSurvey: async (id?: number, payload?: { titulo?: string; slug?: string }) =>
      duplicateMutation.mutateAsync({ id, ...payload }),
    publishSurvey: async (id?: number) => publishMutation.mutateAsync({ id }),
    seedSurvey: async (id: number, payload) => seedMutation.mutateAsync({ id, payload }),
    deleteSurvey: async (id: number) => deleteMutation.mutateAsync(id),
    isSaving: saveMutation.isPending || createMutation.isPending,
    isPublishing: publishMutation.isPending,
    isDuplicating: duplicateMutation.isPending,
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
