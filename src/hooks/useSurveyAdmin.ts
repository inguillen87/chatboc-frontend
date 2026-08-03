import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import {
  adminCreateSurvey,
  adminCloseSurvey,
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
  closeSurvey: (id?: number) => Promise<SurveyAdmin>;
  seedSurvey: (
    id: number,
    payload: { cantidad: number; reset?: boolean; geo_profile_key?: string; municipality_label?: string },
  ) => Promise<{ creadas: number; reset?: { respuestas?: number; comentarios?: number } }>;
  deleteSurvey: (id: number) => Promise<void>;
  isSaving: boolean;
  isPublishing: boolean;
  isClosing: boolean;
  isDuplicating: boolean;
  isSeeding: boolean;
  isDeleting: boolean;
  refetchSurvey: () => Promise<SurveyAdmin | undefined>;
  refetchList: () => Promise<SurveyListResponse | undefined>;
  tenantSlug: string | null;
  tenantScopeError: string | null;
}

const buildListKey = (params?: Record<string, unknown>) =>
  params ? JSON.stringify(Object.fromEntries(Object.entries(params).sort())) : 'default';

export function useSurveyAdmin(options: UseSurveyAdminOptions = {}): UseSurveyAdminResult {
  const queryClient = useQueryClient();
  const { currentSlug } = useTenant();
  const tenantSlug = useMemo(
    () => (currentSlug ?? safeLocalStorage.getItem('tenantSlug') ?? '').trim() || null,
    [currentSlug],
  );
  const normalizedId = useMemo(() => (typeof options.id === 'number' ? options.id : null), [options.id]);
  const tenantScopeError = tenantSlug
    ? null
    : 'Seleccioná una organización antes de administrar encuestas y votaciones.';
  const requireAdminRequestOptions = useCallback(() => {
    if (!tenantSlug) {
      throw new Error('survey_admin_tenant_required');
    }
    return { tenantSlug, sendAnonId: true };
  }, [tenantSlug]);

  const surveyQuery = useQuery({
    queryKey: queryKeys.surveys.admin(normalizedId ?? 'missing', tenantSlug),
    enabled: normalizedId !== null && Boolean(tenantSlug),
    retry: false,
    queryFn: () =>
      normalizedId !== null
        ? adminGetSurvey(normalizedId, requireAdminRequestOptions())
        : Promise.reject(new Error('No id provided')),
  });

  const listQuery = useQuery({
    queryKey: queryKeys.surveys.adminList(buildListKey(options.listParams), tenantSlug),
    enabled: Boolean(tenantSlug),
    queryFn: () => adminListSurveys(options.listParams as any, requireAdminRequestOptions()),
    retry: false,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: SurveyDraftPayload) => {
      if (normalizedId === null) throw new Error('No survey id provided');
      const guardedPayload = withExpectedSurveyStructureRevision(payload, surveyQuery.data);
      const updated = await adminUpdateSurvey(normalizedId, guardedPayload, requireAdminRequestOptions());
      queryClient.setQueryData(queryKeys.surveys.admin(normalizedId, tenantSlug), updated);
      await queryClient.invalidateQueries({ queryKey: queryKeys.surveys.admin(normalizedId, tenantSlug) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.surveys.adminLists(tenantSlug) });
      return updated;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: SurveyDraftPayload) => {
      const created = await adminCreateSurvey(payload, requireAdminRequestOptions());
      await queryClient.invalidateQueries({ queryKey: queryKeys.surveys.adminLists(tenantSlug) });
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
        requireAdminRequestOptions(),
      );
      await queryClient.invalidateQueries({ queryKey: queryKeys.surveys.adminLists(tenantSlug) });
      return duplicated;
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (payload?: { id?: number }) => {
      const targetId = typeof payload?.id === 'number' ? payload.id : normalizedId;
      if (targetId === null) throw new Error('No survey id provided');
      const published = await adminPublishSurvey(targetId, requireAdminRequestOptions());
      queryClient.setQueryData(queryKeys.surveys.admin(targetId, tenantSlug), published);
      await queryClient.invalidateQueries({ queryKey: queryKeys.surveys.admin(targetId, tenantSlug) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.surveys.adminLists(tenantSlug) });
      return published;
    },
  });

  const closeMutation = useMutation({
    mutationFn: async (payload?: { id?: number }) => {
      const targetId = typeof payload?.id === 'number' ? payload.id : normalizedId;
      if (targetId === null) throw new Error('No survey id provided');
      const closed = await adminCloseSurvey(targetId, requireAdminRequestOptions());
      queryClient.setQueryData(queryKeys.surveys.admin(targetId, tenantSlug), closed);
      await queryClient.invalidateQueries({ queryKey: queryKeys.surveys.admin(targetId, tenantSlug) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.surveys.adminLists(tenantSlug) });
      return closed;
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
      const result = await adminSeedSurvey(id, payload, requireAdminRequestOptions());
      await queryClient.invalidateQueries({ queryKey: queryKeys.surveys.admin(id, tenantSlug) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.surveys.adminLists(tenantSlug) });
      return result;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await adminDeleteSurvey(id, requireAdminRequestOptions());
      await queryClient.invalidateQueries({ queryKey: queryKeys.surveys.admin(id, tenantSlug) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.surveys.adminLists(tenantSlug) });
    },
  });

  return {
    survey: surveyQuery.data,
    surveys: listQuery.data,
    isLoadingSurvey: Boolean(tenantSlug) && surveyQuery.isLoading,
    isLoadingList: Boolean(tenantSlug) && listQuery.isLoading,
    surveyError: tenantScopeError ?? (surveyQuery.error ? getErrorMessage(surveyQuery.error) : null),
    listError: tenantScopeError ?? (listQuery.error ? getErrorMessage(listQuery.error) : null),
    saveSurvey: async (payload: SurveyDraftPayload) => saveMutation.mutateAsync(payload),
    createSurvey: async (payload: SurveyDraftPayload) => createMutation.mutateAsync(payload),
    duplicateSurvey: async (id?: number, payload?: { titulo?: string; slug?: string }) =>
      duplicateMutation.mutateAsync({ id, ...payload }),
    publishSurvey: async (id?: number) => publishMutation.mutateAsync({ id }),
    closeSurvey: async (id?: number) => closeMutation.mutateAsync({ id }),
    seedSurvey: async (id: number, payload) => seedMutation.mutateAsync({ id, payload }),
    deleteSurvey: async (id: number) => deleteMutation.mutateAsync(id),
    isSaving: saveMutation.isPending || createMutation.isPending,
    isPublishing: publishMutation.isPending,
    isClosing: closeMutation.isPending,
    isDuplicating: duplicateMutation.isPending,
    isSeeding: seedMutation.isPending,
    isDeleting: deleteMutation.isPending,
    refetchSurvey: async () => {
      if (!tenantSlug) return undefined;
      const result = await surveyQuery.refetch();
      return result.data;
    },
    refetchList: async () => {
      if (!tenantSlug) return undefined;
      const result = await listQuery.refetch();
      return result.data;
    },
    tenantSlug,
    tenantScopeError,
  };
}
