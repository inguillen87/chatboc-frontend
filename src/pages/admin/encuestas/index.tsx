import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BarChart3, Loader2, MessageSquareText, Plus, Radio, ShieldAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { SurveyCard } from '@/components/surveys/SurveyCard';
import { SurveyOperationsOverview } from '@/components/surveys/SurveyOperationsOverview';
import { Button } from '@/components/ui/button';
import { useSurveyAdmin } from '@/hooks/useSurveyAdmin';
import type {
  SurveyAdmin,
  SurveyAdminOperationalScope,
  SurveyAdminOverview,
} from '@/types/encuestas';
import { toast } from '@/components/ui/use-toast';
import { getPublicSurveyUrlFromRecord } from '@/utils/publicSurveyUrl';
import SectionErrorBoundary from '@/components/errors/SectionErrorBoundary';
import { prioritizeMendozaDemoSurveys } from '@/utils/surveyDemoPriority';
import { isSurveySyntheticSeedQaEnabled } from '@/utils/surveySyntheticSeedGate';
import {
  SURVEY_RESPONSE_DUPLICATE_ADMIN_MESSAGE,
  SURVEY_RESPONSE_DUPLICATE_ADMIN_TITLE,
  isSurveyResponseDuplicateError,
} from '@/utils/surveySubmissionErrors';
import { resolveSurveyPublicationFailure, type SurveyPublicationFailure } from '@/utils/surveyPublicationError';
import { resolveSurveyJurisdictionScope } from '@/utils/surveyJurisdictionScope';

type SurveyFocusMode = 'live' | 'comments' | null;

const normalizeFocusMode = (value: string | null): SurveyFocusMode => {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'live' || normalized === 'realtime' || normalized === 'votaciones') return 'live';
  if (normalized === 'comments' || normalized === 'comentarios' || normalized === 'debate') return 'comments';
  return null;
};

const matchesFocus = (survey: SurveyAdmin, focusMode: SurveyFocusMode) => {
  if (!focusMode) return false;
  if (focusMode === 'live') {
    return Boolean(
      survey.es_votacion_envivo ||
        survey.mostrar_resultados_envivo ||
        survey.tipo === 'votacion',
    );
  }
  return Boolean(survey.permitir_comentarios);
};

export const isSurveyJurisdictionConflict = (survey: SurveyAdmin) =>
  resolveSurveyJurisdictionScope(survey).classification === 'conflict';

export const isSurveyJurisdictionCompatible = (survey: SurveyAdmin) =>
  resolveSurveyJurisdictionScope(survey).classification === 'compatible';

const responseCount = (survey: SurveyAdmin) =>
  survey.admin_lifecycle?.participation.responses ?? survey.metricas?.total_respuestas ?? 0;

export const buildOperationalSurveyOverview = (
  items: SurveyAdmin[],
  authoritativeScope?: SurveyAdminOperationalScope,
): SurveyAdminOverview => {
  const porEstado = items.reduce<Record<string, number>>((accumulator, survey) => {
    accumulator[survey.estado] = (accumulator[survey.estado] ?? 0) + 1;
    return accumulator;
  }, {});
  const totalResponses = items.reduce((sum, survey) => sum + responseCount(survey), 0);
  const responsesWithCoordinates = items.reduce(
    (sum, survey) => sum + (survey.metricas?.respuestas_con_coordenadas ?? 0),
    0,
  );
  const responsesLast24h = items.reduce(
    (sum, survey) =>
      sum + (survey.admin_lifecycle?.participation.responses_last_24h ?? survey.metricas?.respuestas_ultimas_24h ?? 0),
    0,
  );
  const denominatorAvailable =
    items.length > 0 &&
    items.every((survey) => survey.admin_lifecycle?.participation.denominator_status.available === true);

  const authoritative = authoritativeScope?.instruments.included === items.length
    ? authoritativeScope
    : undefined;

  return {
    total: authoritative?.instruments.included ?? items.length,
    por_estado: porEstado,
    activas: authoritative?.instruments.active ?? items.filter(
      (survey) => survey.admin_lifecycle?.accepts_responses ?? survey.estado === 'publicada',
    ).length,
    con_respuestas: authoritative?.instruments.with_responses ?? items.filter(
      (survey) => responseCount(survey) > 0,
    ).length,
    total_respuestas: authoritative?.participation.real_responses ?? totalResponses,
    respuestas_con_coordenadas: authoritative?.territorial.responses_with_coordinates ?? responsesWithCoordinates,
    respuestas_ultimas_24h: authoritative?.participation.responses_last_24h ?? responsesLast24h,
    accepting_responses: authoritative?.instruments.accepting_responses ?? items.filter(
      (survey) => survey.admin_lifecycle?.accepts_responses ?? survey.estado === 'publicada',
    ).length,
    por_tipo_instrumento: {
      survey: authoritative?.instruments.surveys ?? items.filter(
        (survey) => (survey.admin_lifecycle?.instrument_kind ?? (survey.tipo === 'votacion' ? 'voting' : 'survey')) === 'survey',
      ).length,
      voting: authoritative?.instruments.votings ?? items.filter(
        (survey) => (survey.admin_lifecycle?.instrument_kind ?? (survey.tipo === 'votacion' ? 'voting' : 'survey')) === 'voting',
      ).length,
    },
    participation_denominator: {
      available: denominatorAvailable,
      reason_code: denominatorAvailable ? null : 'survey_eligible_population_not_configured',
    },
  };
};

const focusCopy = {
  live: {
    title: 'Foco operativo: votaciones y resultados en vivo',
    description: 'Priorizamos encuestas con live results para que el equipo vea actividad, mapa y senales IA sin buscar manualmente.',
    badge: 'Live',
    empty: 'No hay votaciones en vivo activas para este tenant.',
    icon: Radio,
  },
  comments: {
    title: 'Foco operativo: comentarios ciudadanos',
    description: 'Priorizamos encuestas con debate habilitado para responder y moderar conversaciones publicas.',
    badge: 'Comentarios',
    empty: 'No hay encuestas con comentarios habilitados.',
    icon: MessageSquareText,
  },
} satisfies Record<Exclude<SurveyFocusMode, null>, {
  title: string;
  description: string;
  badge: string;
  empty: string;
  icon: LucideIcon;
}>;

const AdminSurveysIndex = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const focusMode = normalizeFocusMode(searchParams.get('focus'));
  const {
    surveys,
    isLoadingList,
    isLoadingMoreSurveys,
    hasMoreSurveys,
    listError,
    loadMoreError,
    surveyListProgress,
    publishSurvey,
    closeSurvey,
    deleteSurvey,
    seedSurvey,
    isPublishing,
    isClosing,
    isDeleting,
    isSeeding,
    refetchList,
    loadMoreSurveys,
    tenantSlug,
  } = useSurveyAdmin();
  const [publishingId, setPublishingId] = useState<number | null>(null);
  const [closingId, setClosingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [seedingId, setSeedingId] = useState<number | null>(null);
  const [publishFailure, setPublishFailure] = useState<(SurveyPublicationFailure & { surveyId: number }) | null>(null);

  const handlePublish = async (survey: SurveyAdmin) => {
    try {
      setPublishingId(survey.id);
      setPublishFailure(null);
      await publishSurvey(survey.id);
      toast({ title: 'Encuesta publicada', description: 'Ya podés compartir el enlace público.' });
      await refetchList();
    } catch (error) {
      const failure = resolveSurveyPublicationFailure(error);
      setPublishFailure({ ...failure, surveyId: survey.id });
      toast({ title: failure.title, description: failure.message, variant: 'destructive' });
      // A 409 frequently means the backend advanced or blocked the lifecycle.
      // Refresh regardless so the card never keeps offering an action from a stale state.
      await refetchList().catch(() => undefined);
    } finally {
      setPublishingId(null);
    }
  };

  const handleCopyLink = async (survey: SurveyAdmin) => {
    const publicUrl = getPublicSurveyUrlFromRecord(survey, { tenantSlug });
    if (!publicUrl) {
      toast({
        title: 'No se pudo generar el enlace público',
        description: 'Verificá que la encuesta tenga un slug configurado.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast({ title: 'Link copiado', description: 'Compartilo en redes, mailings o un QR impreso.' });
    } catch (error) {
      toast({ title: 'No se pudo copiar el enlace', description: String((error as Error)?.message ?? error), variant: 'destructive' });
    }
  };

  const handleClose = async (survey: SurveyAdmin) => {
    try {
      setClosingId(survey.id);
      await closeSurvey(survey.id);
      toast({
        title: survey.admin_lifecycle?.instrument_kind === 'voting' ? 'Votación cerrada' : 'Encuesta cerrada',
        description: 'La participación quedó cerrada y las respuestas registradas se conservaron.',
      });
      await refetchList();
    } catch (error) {
      toast({
        title: 'No pudimos cerrar la participación',
        description: String((error as Error)?.message ?? error),
        variant: 'destructive',
      });
      throw error;
    } finally {
      setClosingId(null);
    }
  };

  const handleDelete = async (survey: SurveyAdmin) => {
    try {
      setDeletingId(survey.id);
      await deleteSurvey(survey.id);
      toast({ title: 'Encuesta eliminada', description: 'La encuesta se borró correctamente.' });
      await refetchList();
    } catch (error) {
      toast({
        title: 'No pudimos borrar la encuesta',
        description: String((error as Error)?.message ?? error),
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleSeed = async (survey: SurveyAdmin) => {
    try {
      setSeedingId(survey.id);
      const result = await seedSurvey(survey.id, { cantidad: 100, reset: true });
      toast({
        title: 'Datos generados',
        description: `Se agregaron ${result.creadas} respuestas de prueba.`
      });
      // Optionally refresh analytics data if needed, but refetchList might not be enough if it doesn't return analytics counts
      await refetchList();
    } catch (error) {
      if (isSurveyResponseDuplicateError(error)) {
        toast({
          title: SURVEY_RESPONSE_DUPLICATE_ADMIN_TITLE,
          description: SURVEY_RESPONSE_DUPLICATE_ADMIN_MESSAGE,
        });
        return;
      }
      toast({
        title: 'Error al generar datos',
        description: String((error as Error)?.message ?? error),
        variant: 'destructive',
      });
    } finally {
      setSeedingId(null);
    }
  };

  const classifiedItems = useMemo(() => {
    const prioritized = prioritizeMendozaDemoSurveys(surveys?.data ?? []);
    const order = { compatible: 0, conflict: 1, unverified: 2 } as const;
    return prioritized.map((survey) => ({
      survey,
      scope: resolveSurveyJurisdictionScope(survey),
    })).sort((a, b) => {
      const jurisdictionOrder = order[a.scope.classification] - order[b.scope.classification];
      if (jurisdictionOrder !== 0) return jurisdictionOrder;
      if (!focusMode) return 0;
      return Number(matchesFocus(b.survey, focusMode)) - Number(matchesFocus(a.survey, focusMode));
    });
  }, [focusMode, surveys?.data]);
  const compatibleItems = useMemo(
    () => classifiedItems.filter(({ scope }) => scope.classification === 'compatible').map(({ survey }) => survey),
    [classifiedItems],
  );
  const conflictItems = useMemo(
    () => classifiedItems.filter(({ scope }) => scope.classification === 'conflict'),
    [classifiedItems],
  );
  const unverifiedItems = useMemo(
    () => classifiedItems.filter(({ scope }) => scope.classification === 'unverified'),
    [classifiedItems],
  );
  const operationalClassifiedItems = useMemo(
    () => classifiedItems.filter(({ scope }) => scope.classification !== 'conflict'),
    [classifiedItems],
  );
  const operationalItems = useMemo(
    () => operationalClassifiedItems.map(({ survey }) => survey),
    [operationalClassifiedItems],
  );
  const focusedItems = useMemo(
    () => (focusMode ? operationalItems.filter((survey) => matchesFocus(survey, focusMode)) : []),
    [focusMode, operationalItems],
  );
  const operationalOverview = useMemo(
    () => buildOperationalSurveyOverview(
      operationalItems,
      surveys?.executive_summary?.operational_scope,
    ),
    [operationalItems, surveys?.executive_summary?.operational_scope],
  );
  const focusMeta = focusMode ? focusCopy[focusMode] : null;
  const FocusIcon = focusMeta?.icon;
  const firstFocusedSurvey = focusedItems[0];

  return (
    <SectionErrorBoundary
      title="No pudimos cargar las encuestas"
      description="Reintentá o volvé al inicio mientras recuperamos el panel de encuestas."
      onRetry={() => refetchList()}
    >
      <div className="space-y-6">
      <a
        href="#survey-instrument-list"
        className="sr-only rounded-md bg-background px-3 py-2 text-sm font-medium text-foreground shadow focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
      >
        Ir al listado de instrumentos
      </a>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Centro de participación ciudadana</h1>
          <p className="text-sm text-muted-foreground">Encuestas, sondeos y votaciones con operación, evidencia y resultados en un solo lugar.</p>
        </div>
        <Button onClick={() => navigate('/admin/encuestas/new')} className="inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> Nueva encuesta
        </Button>
      </div>

      {focusMeta ? (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              {FocusIcon ? (
                <span className="mt-0.5 rounded-xl bg-primary/10 p-2 text-primary">
                  <FocusIcon className="h-4 w-4" aria-hidden="true" />
                </span>
              ) : null}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold">{focusMeta.title}</h2>
                  <span className="rounded-full border border-primary/25 bg-background px-2 py-0.5 text-xs text-primary">
                    {focusedItems.length} priorizadas
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{focusMeta.description}</p>
                {!focusedItems.length ? (
                  <p className="mt-2 text-xs text-amber-600">{focusMeta.empty}</p>
                ) : null}
              </div>
            </div>
            {firstFocusedSurvey ? (
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                onClick={() => navigate(`/admin/encuestas/${firstFocusedSurvey.id}/analytics?focus=${focusMode}`)}
              >
                <BarChart3 className="mr-2 h-4 w-4" />
                Abrir analytics
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {surveys?.overview && tenantSlug && !listError ? (
        <SurveyOperationsOverview
          overview={operationalOverview}
          freshness={surveys.freshness}
          tenantSlug={tenantSlug}
          instruments={operationalItems}
          loadedCount={operationalItems.length}
          totalCount={surveyListProgress.total}
          isPartial={hasMoreSurveys}
          excludedScopeCount={conflictItems.length}
          confirmedConflictCount={conflictItems.length}
          unverifiedScopeCount={unverifiedItems.length}
          sourceTotalCount={surveyListProgress.total}
          executiveSummary={surveys.executive_summary}
          dataQuality={surveys.data_quality}
        />
      ) : null}

      {listError ? (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="font-medium text-destructive">No pudimos cargar el panel operativo</p>
          <p className="mt-1 text-sm text-muted-foreground">{listError}</p>
          {tenantSlug ? (
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void refetchList()}>
              Reintentar
            </Button>
          ) : null}
        </div>
      ) : null}

      {isLoadingList ? (
        <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-live="polite">
          <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
          <span className="sr-only">Cargando encuestas y votaciones</span>
        </div>
      ) : !listError ? (
        <section
          id="survey-instrument-list"
          aria-labelledby="survey-instrument-list-title"
          className="grid scroll-mt-6 gap-4"
        >
          <h2 id="survey-instrument-list-title" className="sr-only">Instrumentos de participación</h2>
          {operationalClassifiedItems.map(({ survey, scope }) => (
            <div key={survey.id} className={focusMode && matchesFocus(survey, focusMode) ? 'rounded-2xl border border-primary/25 bg-primary/[0.03] p-2' : undefined}>
              {focusMode && matchesFocus(survey, focusMode) ? (
                <div className="mb-2 inline-flex rounded-full border border-primary/25 bg-background px-2 py-0.5 text-xs font-medium text-primary">
                  {focusMeta?.badge}
                </div>
              ) : null}
              {publishFailure?.surveyId === survey.id ? (
                <div
                  role="alert"
                  data-testid={`survey-publish-failure-${survey.id}`}
                  className="mb-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3"
                >
                  <p className="text-sm font-semibold text-destructive">{publishFailure.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{publishFailure.message}</p>
                  {publishFailure.action !== 'retry' ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => navigate(`/admin/encuestas/${survey.id}`)}
                    >
                      Revisar configuración
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {scope.classification === 'unverified' ? (
                <div
                  role="status"
                  aria-label={`Alcance pendiente de verificación para ${survey.titulo}`}
                  className="mb-3 flex items-start gap-2 rounded-xl border border-amber-400/40 bg-amber-500/5 p-3 text-sm text-amber-900 dark:text-amber-100"
                >
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <p>
                    <span className="font-semibold">Alcance pendiente de verificación.</span>{' '}
                    Permanece en la operación provisoria y conserva únicamente las acciones habilitadas por el backend.
                  </p>
                </div>
              ) : null}
              <SurveyCard
                survey={survey}
                tenantSlug={tenantSlug}
                onEdit={() => navigate(`/admin/encuestas/${survey.id}`)}
                onAnalytics={() => navigate(`/admin/encuestas/${survey.id}/analytics${focusMode ? `?focus=${focusMode}` : ''}`)}
                onPublish={
                  survey.admin_lifecycle?.capabilities.can_publish && !isSurveyJurisdictionConflict(survey)
                    ? () => handlePublish(survey)
                    : undefined
                }
                publishing={isPublishing && publishingId === survey.id}
                onClose={survey.admin_lifecycle?.capabilities.can_close ? () => handleClose(survey) : undefined}
                closing={isClosing && closingId === survey.id}
                onCopyLink={survey.admin_lifecycle?.capabilities.can_share ? () => handleCopyLink(survey) : undefined}
                onDelete={survey.admin_lifecycle?.capabilities.can_delete ? () => handleDelete(survey) : undefined}
                onSeed={
                  isSurveySyntheticSeedQaEnabled({ tenantId: survey.tenant_id }) && survey.estado !== 'cerrada'
                    ? () => handleSeed(survey)
                    : undefined
                }
                seeding={isSeeding && seedingId === survey.id}
              />
            </div>
          ))}
          {!operationalItems.length && (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No hay instrumentos operativos cargados para esta organización. Creá uno nuevo o revisá los conflictos separados.
            </div>
          )}
          {conflictItems.length ? (
            <details className="group rounded-xl border border-amber-400/40 bg-amber-500/5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                <span>Conflictos de alcance · {conflictItems.length.toLocaleString('es-AR')} instrumentos</span>
                <span className="text-xs font-normal text-muted-foreground group-open:hidden">Ver auditoría</span>
                <span className="hidden text-xs font-normal text-muted-foreground group-open:inline">Ocultar</span>
              </summary>
              <div className="space-y-3 border-t border-amber-400/30 p-3">
                <p className="text-sm text-muted-foreground">
                  {conflictItems.length.toLocaleString('es-AR')} con conflicto jurisdiccional confirmado. Se conservan
                  para auditoría y no integran el alcance operativo. Las acciones seguras que el backend mantenga
                  habilitadas continúan disponibles.
                </p>
                {conflictItems.map(({ survey, scope }) => (
                  <div key={survey.id} className="space-y-2">
                    <div
                      role="status"
                      className="inline-flex rounded-full border border-amber-400/40 bg-background px-2.5 py-1 text-xs font-medium text-amber-800 dark:text-amber-200"
                      title={`Fuente: ${scope.source}. Razón: ${scope.reasonCode}`}
                    >
                      {scope.classification === 'conflict'
                        ? 'Conflicto jurisdiccional confirmado'
                        : 'Alcance pendiente de verificación'}
                    </div>
                    <SurveyCard
                      survey={survey}
                      tenantSlug={tenantSlug}
                      onEdit={() => navigate(`/admin/encuestas/${survey.id}`)}
                      onAnalytics={() => navigate(`/admin/encuestas/${survey.id}/analytics`)}
                      onPublish={
                        survey.admin_lifecycle?.capabilities.can_publish && !isSurveyJurisdictionConflict(survey)
                          ? () => handlePublish(survey)
                          : undefined
                      }
                      publishing={isPublishing && publishingId === survey.id}
                      onClose={survey.admin_lifecycle?.capabilities.can_close ? () => handleClose(survey) : undefined}
                      closing={isClosing && closingId === survey.id}
                      onCopyLink={survey.admin_lifecycle?.capabilities.can_share ? () => handleCopyLink(survey) : undefined}
                      onDelete={survey.admin_lifecycle?.capabilities.can_delete ? () => handleDelete(survey) : undefined}
                    />
                  </div>
                ))}
              </div>
            </details>
          ) : null}
          {classifiedItems.length ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-border/70 bg-muted/20 p-4 text-center">
              <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
                {surveyListProgress.total === null
                  ? `${surveyListProgress.loaded.toLocaleString('es-AR')} instrumentos recibidos · ${operationalItems.length.toLocaleString('es-AR')} operativos · ${unverifiedItems.length.toLocaleString('es-AR')} por verificar`
                  : `Mostrando ${surveyListProgress.loaded.toLocaleString('es-AR')} de ${surveyListProgress.total.toLocaleString('es-AR')} registros · ${operationalItems.length.toLocaleString('es-AR')} operativos (${compatibleItems.length.toLocaleString('es-AR')} compatibles · ${unverifiedItems.length.toLocaleString('es-AR')} por verificar) · ${conflictItems.length.toLocaleString('es-AR')} conflictos separados`}
              </p>
              {loadMoreError ? (
                <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
                  Conservamos los instrumentos ya cargados. Reintentá para continuar con el listado.
                </div>
              ) : null}
              {hasMoreSurveys ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void loadMoreSurveys()}
                  disabled={isLoadingMoreSurveys}
                  aria-describedby="survey-list-progress"
                >
                  {isLoadingMoreSurveys ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                      Cargando más…
                    </>
                  ) : (
                    'Cargar más encuestas'
                  )}
                </Button>
              ) : null}
              <span id="survey-list-progress" className="sr-only">
                El listado conserva los instrumentos ya cargados al solicitar la página siguiente.
              </span>
            </div>
          ) : null}
        </section>
      ) : null}
      </div>
    </SectionErrorBoundary>
  );
};

export default AdminSurveysIndex;
