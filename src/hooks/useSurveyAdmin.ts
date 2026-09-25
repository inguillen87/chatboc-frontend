import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useId, useMemo, useRef } from 'react';
import {activeSurveyListTenant,assertSurveyListPage,assertSurveyListCollection,isSurveyReadAuthorityFailure,reportedSurveyListTotal,type SurveyListReadState} from '@/utils/surveyListReadiness';

import {
  adminCreateSurvey,
  adminCloseSurvey,
  adminDeleteSurvey,
  adminDuplicateSurvey,
  adminGetSurvey,
  adminListSurveys,
  adminSeedSurvey,
  adminUpdateSurvey,
} from '@/api/encuestas';
import type {
  SurveyAdmin,
  SurveyAdminListParams,
  SurveyAdminOverview,
  SurveyDraftPayload,
  SurveyListResponse,
} from '@/types/encuestas';
import { getErrorMessage } from '@/utils/api';
import { useTenant } from '@/context/TenantContext';
import { queryKeys } from '@/lib/queryKeys';
import { withExpectedSurveyStructureRevision } from '@/utils/surveyStructureGuard';
import { publishSurveyV2 } from '@/features/surveys/surveysApi';

interface UseSurveyAdminOptions {
  id?: number | null;
  listParams?: SurveyAdminListParams;
}

interface SurveyListProgress {
  loaded: number;
  total: number | null;
}

interface UseSurveyAdminResult {
  survey?: SurveyAdmin;
  surveys?: SurveyListResponse;
  isLoadingSurvey: boolean;
  isLoadingList: boolean;
  listReadState: SurveyListReadState;
  isLoadingMoreSurveys: boolean;
  hasMoreSurveys: boolean;
  surveyError: string | null;
  listError: string | null;
  loadMoreError: string | null;
  surveyListProgress: SurveyListProgress;
  saveSurvey: (payload: SurveyDraftPayload) => Promise<SurveyAdmin>;
  createSurvey: (payload: SurveyDraftPayload) => Promise<SurveyAdmin>;
  duplicateSurvey: (id?: number, payload?: { titulo?: string; slug?: string }) => Promise<SurveyAdmin>;
  publishSurvey: (id?: number) => Promise<void>;
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
  loadMoreSurveys: () => Promise<void>;
  tenantSlug: string | null;
  tenantScopeError: string | null;
}

const buildListKey = (params?: SurveyAdminListParams) =>
  params ? JSON.stringify(Object.fromEntries(Object.entries(params).sort())) : 'default';

const aggregateLoadedOverview = (
  surveys: SurveyAdmin[],
  fallback?: SurveyAdminOverview,
): SurveyAdminOverview | undefined => {
  if (!surveys.every((survey) => survey.metricas && survey.admin_lifecycle)) return fallback;

  const overview: SurveyAdminOverview = {
    total: surveys.length,
    por_estado: {},
    activas: 0,
    con_respuestas: 0,
    total_respuestas: 0,
    respuestas_con_coordenadas: 0,
    respuestas_ultimas_24h: 0,
    accepting_responses: 0,
    por_tipo_instrumento: { survey: 0, voting: 0 },
    participation_denominator: fallback?.participation_denominator ?? {
      available: false,
      reason_code: 'survey_eligible_population_not_configured',
    },
  };

  for (const survey of surveys) {
    const metrics = survey.metricas!;
    const lifecycle = survey.admin_lifecycle!;
    overview.por_estado[survey.estado] = (overview.por_estado[survey.estado] ?? 0) + 1;
    overview.activas += survey.esta_activa === true ? 1 : 0;
    overview.con_respuestas += metrics.total_respuestas > 0 ? 1 : 0;
    overview.total_respuestas += metrics.total_respuestas;
    overview.respuestas_con_coordenadas += metrics.respuestas_con_coordenadas;
    overview.respuestas_ultimas_24h += metrics.respuestas_ultimas_24h;
    overview.accepting_responses += lifecycle.accepts_responses ? 1 : 0;
    overview.por_tipo_instrumento[lifecycle.instrument_kind] =
      (overview.por_tipo_instrumento[lifecycle.instrument_kind] ?? 0) + 1;
  }

  return overview;
};

const mergeSurveyListPages = (pages?: SurveyListResponse[]): SurveyListResponse | undefined => {
  if (!pages?.length) return undefined;

  const seenIds = new Set<number>();
  const data: SurveyAdmin[] = [];
  for (const page of pages) {
    for (const survey of page.data) {
      if (seenIds.has(survey.id)) continue;
      seenIds.add(survey.id);
      data.push(survey);
    }
  }

  const firstPage = pages[0];
  const lastPage = pages[pages.length - 1];
  const allVersioned = pages.every((page) => page.contract_version === 'surveys.admin_list.v2');

  return {
    ...firstPage,
    freshness: lastPage.freshness ?? firstPage.freshness,
    // These contracts are explicitly scoped to one returned page. Once pages
    // are merged, retaining the first page summary would mislabel a partial
    // aggregate as the loaded collection; the view derives and labels it.
    executive_summary: pages.length === 1 ? firstPage.executive_summary : undefined,
    data_quality: pages.length === 1 ? firstPage.data_quality : undefined,
    data_provenance: pages.length === 1 ? firstPage.data_provenance : undefined,
    overview: allVersioned
      ? aggregateLoadedOverview(data, firstPage.overview)
      : firstPage.overview,
    pagination: lastPage.pagination ?? firstPage.pagination,
    data,
  };
};

export function useSurveyAdmin(options: UseSurveyAdminOptions = {}): UseSurveyAdminResult {
  const queryClient = useQueryClient();
  const { currentSlug } = useTenant();
  const tenantSlug = useMemo(
    () => activeSurveyListTenant(currentSlug),
    [currentSlug],
  );
  const normalizedId = useMemo(() => (typeof options.id === 'number' ? options.id : null), [options.id]);
  const listParams: SurveyAdminListParams = {
    ...options.listParams,
    limit: options.listParams?.limit ?? 50,
  };
  const listParamsKey = buildListKey(listParams);
  const mounted=useRef(false);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const readInstance=useId();
  const readScopeKey=JSON.stringify([tenantSlug,listParamsKey]);
  const readScope=useRef({key:readScopeKey,generation:0});
  if(readScope.current.key!==readScopeKey)readScope.current={key:readScopeKey,generation:readScope.current.generation+1};
  const generation=readScope.current.generation;
  // Never reuse a former organization session (including A -> B -> A).
  // The existing adminLists prefix still invalidates active instances after writes.
  const listQueryKey=[...queryKeys.surveys.adminList(listParamsKey,tenantSlug),readInstance,generation] as const;
  const operation=useRef<{generation:number}|null>(null);

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

  const listQuery = useInfiniteQuery({
    queryKey: listQueryKey,
    enabled: Boolean(tenantSlug),
    initialPageParam: null as string | null,
    queryFn: async ({pageParam}) => {
      const result=await adminListSurveys(pageParam ? {...listParams,cursor:pageParam,page:undefined} : listParams,requireAdminRequestOptions());
      assertSurveyListPage(result,tenantSlug!,pageParam??listParams.cursor??null);
      return result;
    },
    getNextPageParam: (lastPage,allPages) => {
      const next=lastPage.pagination?.has_more?lastPage.pagination.next_cursor:undefined;
      return next && !allPages.slice(0,-1).some(page=>page.pagination?.next_cursor===next) ? next : undefined;
    },
    retry: false,
    refetchOnWindowFocus: false,
    gcTime: 0,
  });
  const collection=useMemo(()=>{
    if(!tenantSlug||!listQuery.data?.pages)return undefined;
    try {assertSurveyListCollection(listQuery.data.pages,tenantSlug,listParams.cursor??null);
      return {value:mergeSurveyListPages(listQuery.data.pages),error:null};
    } catch(error) {return {value:undefined,error};}
  },[tenantSlug,listQuery.data?.pages,listParams.cursor]);
  const refreshing=Boolean(tenantSlug&&listQuery.isFetching&&!listQuery.isFetchingNextPage);
  const fatalError=collection?.error || (listQuery.error&&(!listQuery.isFetchNextPageError||isSurveyReadAuthorityFailure(listQuery.error))?listQuery.error:null);
  const surveys=tenantSlug&&!refreshing&&!fatalError?collection?.value:undefined;
  const listReadState:SurveyListReadState={
    phase:!tenantSlug?'missing_scope':refreshing?(listQuery.data?'refreshing':'loading'):fatalError?'error':surveys?(listQuery.isFetchNextPageError?'partial_error':'ready'):'loading',
    pages:surveys?listQuery.data?.pages.length??0:0,
    receivedAt:surveys&&listQuery.dataUpdatedAt?listQuery.dataUpdatedAt:null,
  };
  const surveyListProgress=useMemo<SurveyListProgress>(()=>({loaded:surveys?.data.length??0,total:reportedSurveyListTotal(surveys)}),[surveys]);

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
      if (!tenantSlug) throw new Error('survey_admin_tenant_required');
      const published = await publishSurveyV2(targetId, tenantSlug);
      if (!published || published.id !== String(targetId)) {
        throw new Error('No pudimos verificar la confirmación de publicación del servidor. Actualizá el listado antes de reintentar.');
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.surveys.admin(targetId, tenantSlug) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.surveys.adminLists(tenantSlug) });
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
    retry: false,
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
    surveys,
    isLoadingSurvey: Boolean(tenantSlug) && surveyQuery.isLoading,
    isLoadingList: listReadState.phase==='loading'||listReadState.phase==='refreshing',
    listReadState,
    isLoadingMoreSurveys: listQuery.isFetchingNextPage,
    hasMoreSurveys: Boolean(surveys && listQuery.hasNextPage),
    surveyError: tenantScopeError ?? (surveyQuery.error ? getErrorMessage(surveyQuery.error) : null),
    listError: tenantScopeError ?? (!refreshing && fatalError ? getErrorMessage(fatalError) : null),
    loadMoreError:
      surveys && listQuery.isFetchNextPageError && listQuery.error
        ? getErrorMessage(listQuery.error)
        : null,
    surveyListProgress,
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
      if(!mounted.current||!tenantSlug||readScope.current.generation!==generation||operation.current?.generation===generation||queryClient.isFetching({queryKey:listQueryKey,exact:true}))return undefined;
      const pending={generation};operation.current=pending;
      try {
        const result=await listQuery.refetch({cancelRefetch:false});
        if(!mounted.current||result.isError||readScope.current.generation!==generation)return undefined;
        const pages=result.data?.pages;
        if(pages)assertSurveyListCollection(pages,tenantSlug,listParams.cursor??null);
        return mergeSurveyListPages(pages);
      } catch { return undefined; }
      finally {if(operation.current===pending)operation.current=null;}
    },
    loadMoreSurveys: async () => {
      if(!mounted.current||!tenantSlug||!surveys||!listQuery.hasNextPage||readScope.current.generation!==generation||operation.current?.generation===generation||queryClient.isFetching({queryKey:listQueryKey,exact:true}))return;
      const pending={generation};operation.current=pending;
      try {await listQuery.fetchNextPage({cancelRefetch:false});}
      finally {if(operation.current===pending)operation.current=null;}
    },
    tenantSlug,
    tenantScopeError,
  };
}
