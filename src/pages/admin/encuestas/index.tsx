import '@/components/surveys/surveyWorkspace.css';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  BarChart3,
  Loader2,
  MessageSquareText,
  Plus,
  Radio,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { SurveyCard } from '@/components/surveys/SurveyCard';
import { SurveyOperationsOverview } from '@/components/surveys/SurveyOperationsOverview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { resolveSurveyPublicationEvidenceGate } from '@/utils/surveyPublicationEvidenceGate';
import {
  getSurveyGovernanceWorkspacePath,
  isGovernedSurvey,
} from '@/utils/surveyPublicationLifecycle';
export { resolveSurveyPublicationEvidenceGate } from '@/utils/surveyPublicationEvidenceGate';

type SurveyFocusMode = 'live' | 'comments' | null;
type SurveyWorkspaceStatusFilter =
  | 'all'
  | 'draft'
  | 'scheduled'
  | 'collecting'
  | 'finished'
  | 'unverified';
type SurveyWorkspaceKindFilter = 'all' | 'survey' | 'voting';
type SurveyWorkspaceStatus = Exclude<SurveyWorkspaceStatusFilter, 'all'>;

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

const getWorkspaceStatus = (survey: SurveyAdmin): SurveyWorkspaceStatus => {
  switch (survey.admin_lifecycle?.phase) {
    case 'draft':
      return 'draft';
    case 'scheduled':
      return 'scheduled';
    case 'collecting':
    case 'live_voting':
      return 'collecting';
    case 'window_ended':
    case 'closed':
    case 'archived':
      return 'finished';
    case 'unknown':
    default:
      // A persisted state without the lifecycle contract is insufficient to
      // claim that an instrument is receiving responses.
      return 'unverified';
  }
};

const matchesWorkspaceStatus = (survey: SurveyAdmin, filter: SurveyWorkspaceStatusFilter) => {
  if (filter === 'all') return true;
  return getWorkspaceStatus(survey) === filter;
};

const getInstrumentKind = (survey: SurveyAdmin): Exclude<SurveyWorkspaceKindFilter, 'all'> =>
  survey.admin_lifecycle?.instrument_kind ?? (survey.tipo === 'votacion' ? 'voting' : 'survey');

const normalizeWorkspaceQuery = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('es-AR');

const formatCount = (count: number, singular: string, plural: string) =>
  `${count.toLocaleString('es-AR')} ${count === 1 ? singular : plural}`;

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
  const [workspaceQuery, setWorkspaceQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<SurveyWorkspaceStatusFilter>('all');
  const [kindFilter, setKindFilter] = useState<SurveyWorkspaceKindFilter>('all');

  const handlePublish = async (survey: SurveyAdmin) => {
    if (isGovernedSurvey(survey)) {
      navigate(getSurveyGovernanceWorkspacePath(survey.id));
      return;
    }
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
      throw error;
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
  const normalizedWorkspaceQuery = useMemo(
    () => normalizeWorkspaceQuery(workspaceQuery),
    [workspaceQuery],
  );
  const filteredOperationalClassifiedItems = useMemo(
    () => operationalClassifiedItems.filter(({ survey }) => {
      const searchableValue = normalizeWorkspaceQuery([
        survey.id,
        survey.titulo,
        survey.slug,
        survey.descripcion,
      ].filter(Boolean).join(' '));
      const matchesQuery = !normalizedWorkspaceQuery || searchableValue.includes(normalizedWorkspaceQuery);
      const matchesStatus = matchesWorkspaceStatus(survey, statusFilter);
      const matchesKind = kindFilter === 'all' || getInstrumentKind(survey) === kindFilter;
      return matchesQuery && matchesStatus && matchesKind;
    }),
    [kindFilter, normalizedWorkspaceQuery, operationalClassifiedItems, statusFilter],
  );
  const workspaceCounts = useMemo(() => ({
    all: operationalItems.length,
    draft: operationalItems.filter((survey) => matchesWorkspaceStatus(survey, 'draft')).length,
    scheduled: operationalItems.filter((survey) => matchesWorkspaceStatus(survey, 'scheduled')).length,
    collecting: operationalItems.filter((survey) => matchesWorkspaceStatus(survey, 'collecting')).length,
    finished: operationalItems.filter((survey) => matchesWorkspaceStatus(survey, 'finished')).length,
    unverified: operationalItems.filter((survey) => matchesWorkspaceStatus(survey, 'unverified')).length,
    surveys: operationalItems.filter((survey) => getInstrumentKind(survey) === 'survey').length,
    votings: operationalItems.filter((survey) => getInstrumentKind(survey) === 'voting').length,
  }), [operationalItems]);
  const hasWorkspaceFilters = Boolean(normalizedWorkspaceQuery || statusFilter !== 'all' || kindFilter !== 'all');
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
      description="Volvé a cargar el listado o regresá al panel."
      onRetry={() => refetchList()}
      resetKeys={[tenantSlug]}
      fallbackAction={<a href="/perfil">Volver al panel</a>}
    >
      <div className="survey-admin-workspace space-y-6">
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
                    {focusedItems.length.toLocaleString('es-AR')} {focusedItems.length === 1 ? 'priorizada' : 'priorizadas'}
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
          className="scroll-mt-6 space-y-4"
        >
          <div className="rounded-2xl border border-border/70 bg-card p-3 shadow-sm sm:p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-primary/10 p-2 text-primary">
                    <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 id="survey-instrument-list-title" className="text-base font-semibold">
                      Instrumentos operativos
                    </h2>
                    <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
                      {hasMoreSurveys
                        ? `${filteredOperationalClassifiedItems.length.toLocaleString('es-AR')} visibles entre ${formatCount(operationalItems.length, 'instrumento operativo cargado', 'instrumentos operativos cargados')}`
                        : `${filteredOperationalClassifiedItems.length.toLocaleString('es-AR')} visibles de ${formatCount(operationalItems.length, 'instrumento operativo', 'instrumentos operativos')}`}
                      {' · '}
                      {formatCount(conflictItems.length, 'conflicto separado', 'conflictos separados')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-2 xl:max-w-4xl xl:flex-row xl:items-center xl:justify-end">
                <label className="relative block min-w-0 flex-1 xl:max-w-xs">
                  <span className="sr-only">Buscar instrumentos</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    type="search"
                    value={workspaceQuery}
                    onChange={(event) => setWorkspaceQuery(event.target.value)}
                    placeholder="Buscar por nombre o identificador"
                    className="h-9 pl-9"
                  />
                </label>

                <div
                  role="group"
                  aria-label="Filtrar por estado operativo"
                  className="flex max-w-full gap-1 overflow-x-auto rounded-lg border border-border/70 bg-muted/25 p-1"
                >
                  {([
                    ['all', 'Todos', workspaceCounts.all],
                    ['draft', 'Borradores', workspaceCounts.draft],
                    ['scheduled', 'Programadas', workspaceCounts.scheduled],
                    ['collecting', 'Recibiendo', workspaceCounts.collecting],
                    ['finished', 'Finalizados', workspaceCounts.finished],
                    ['unverified', 'Sin verificar', workspaceCounts.unverified],
                  ] as const).map(([value, label, count]) => (
                    <Button
                      key={value}
                      type="button"
                      variant={statusFilter === value ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-7 shrink-0 gap-1 px-2 text-xs"
                      aria-pressed={statusFilter === value}
                      onClick={() => setStatusFilter(value)}
                    >
                      {label} <span className="tabular-nums text-muted-foreground">{count.toLocaleString('es-AR')}</span>
                    </Button>
                  ))}
                </div>

                <div
                  role="group"
                  aria-label="Filtrar por tipo de instrumento"
                  className="flex gap-1 rounded-lg border border-border/70 bg-muted/25 p-1"
                >
                  {([
                    ['all', 'Ambos', workspaceCounts.all],
                    ['survey', 'Encuestas', workspaceCounts.surveys],
                    ['voting', 'Votaciones', workspaceCounts.votings],
                  ] as const).map(([value, label, count]) => (
                    <Button
                      key={value}
                      type="button"
                      variant={kindFilter === value ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-7 gap-1 px-2 text-xs"
                      aria-pressed={kindFilter === value}
                      aria-label={`${label}: ${count.toLocaleString('es-AR')}`}
                      onClick={() => setKindFilter(value)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>

                {hasWorkspaceFilters ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 shrink-0 gap-1 px-2 text-xs"
                    onClick={() => {
                      setWorkspaceQuery('');
                      setStatusFilter('all');
                      setKindFilter('all');
                    }}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" /> Limpiar
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid items-start gap-4 xl:grid-cols-2">
          {filteredOperationalClassifiedItems.map(({ survey, scope }) => (
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
                      onClick={() => navigate(
                        publishFailure.action === 'governance'
                          ? getSurveyGovernanceWorkspacePath(survey.id)
                          : `/admin/encuestas/${survey.id}`,
                      )}
                    >
                      {publishFailure.action === 'governance'
                        ? 'Revisar y publicar release'
                        : 'Revisar configuración'}
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {(survey.admin_lifecycle?.phase === 'draft' || (!survey.admin_lifecycle && survey.estado === 'borrador')) &&
              resolveSurveyPublicationEvidenceGate(survey).required &&
              !resolveSurveyPublicationEvidenceGate(survey).ready ? (
                <div
                  role="status"
                  aria-label={`Publicación bloqueada para ${survey.titulo}`}
                  className="mb-3 flex items-start gap-2 rounded-xl border border-amber-400/40 bg-amber-500/5 p-3 text-sm text-amber-900 dark:text-amber-100"
                >
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <p>
                    <span className="font-semibold">Publicación institucional pendiente.</span>{' '}
                    {resolveSurveyPublicationEvidenceGate(survey).nextAction}
                  </p>
                </div>
              ) : null}
              <SurveyCard
                survey={survey}
                tenantSlug={tenantSlug}
                onEdit={() => navigate(`/admin/encuestas/${survey.id}`)}
                onAnalytics={() => navigate(`/admin/encuestas/${survey.id}/analytics${focusMode ? `?focus=${focusMode}` : ''}`)}
                onPublish={
                  survey.admin_lifecycle?.capabilities.can_publish && resolveSurveyPublicationEvidenceGate(survey).ready
                    ? () => handlePublish(survey)
                    : undefined
                }
                onManageGovernance={
                  isGovernedSurvey(survey)
                    ? () => navigate(getSurveyGovernanceWorkspacePath(survey.id))
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
          {!operationalItems.length ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {hasMoreSurveys ? (
                <>
                  <p className="font-medium text-foreground">
                    No hay instrumentos operativos entre los {formatCount(surveyListProgress.loaded, 'registro cargado', 'registros cargados')}.
                  </p>
                  <p className="mt-1">Todavía puede haber instrumentos en las páginas pendientes.</p>
                </>
              ) : (
                'No hay instrumentos operativos cargados para esta organización. Creá uno nuevo o revisá los conflictos separados.'
              )}
            </div>
          ) : !filteredOperationalClassifiedItems.length ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground xl:col-span-2">
              <p className="font-medium text-foreground">
                {hasMoreSurveys
                  ? `No hay coincidencias entre ${formatCount(operationalItems.length, 'instrumento operativo cargado', 'instrumentos operativos cargados')}.`
                  : 'No hay instrumentos que coincidan con esta vista.'}
              </p>
              <p className="mt-1">
                {hasMoreSurveys
                  ? 'Todavía puede haber coincidencias en las páginas pendientes.'
                  : 'Ajustá la búsqueda o limpiá los filtros; los registros no fueron eliminados.'}
              </p>
              {hasMoreSurveys ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => void loadMoreSurveys()}
                  disabled={isLoadingMoreSurveys}
                >
                  {isLoadingMoreSurveys ? 'Cargando más…' : 'Cargar más resultados'}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="ml-2 mt-3"
                onClick={() => {
                  setWorkspaceQuery('');
                  setStatusFilter('all');
                  setKindFilter('all');
                }}
              >
                Limpiar filtros
              </Button>
            </div>
          ) : null}
          </div>
          {conflictItems.length ? (
            <details className="group rounded-xl border border-amber-400/40 bg-amber-500/5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                <span>
                  {conflictItems.length === 1 ? 'Conflicto de alcance' : 'Conflictos de alcance'} ·{' '}
                  {formatCount(conflictItems.length, 'instrumento', 'instrumentos')}
                </span>
                <span className="text-xs font-normal text-muted-foreground group-open:hidden">Ver auditoría</span>
                <span className="hidden text-xs font-normal text-muted-foreground group-open:inline">Ocultar</span>
              </summary>
              <div className="space-y-3 border-t border-amber-400/30 p-3">
                <p className="text-sm text-muted-foreground">
                  {formatCount(conflictItems.length, 'instrumento', 'instrumentos')} con conflicto jurisdiccional confirmado.{' '}
                  {conflictItems.length === 1 ? 'Se conserva' : 'Se conservan'}
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
                    {(survey.admin_lifecycle?.phase === 'draft' || (!survey.admin_lifecycle && survey.estado === 'borrador')) &&
                    resolveSurveyPublicationEvidenceGate(survey).required &&
                    !resolveSurveyPublicationEvidenceGate(survey).ready ? (
                      <div
                        role="status"
                        aria-label={`Publicación bloqueada para ${survey.titulo}`}
                        className="flex items-start gap-2 rounded-xl border border-amber-400/40 bg-background p-3 text-sm text-amber-900 dark:text-amber-100"
                      >
                        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <p>{resolveSurveyPublicationEvidenceGate(survey).nextAction}</p>
                      </div>
                    ) : null}
                    <SurveyCard
                      survey={survey}
                      tenantSlug={tenantSlug}
                      onEdit={() => navigate(`/admin/encuestas/${survey.id}`)}
                      onAnalytics={() => navigate(`/admin/encuestas/${survey.id}/analytics`)}
                      onPublish={
                        survey.admin_lifecycle?.capabilities.can_publish && resolveSurveyPublicationEvidenceGate(survey).ready
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
                  ? `${formatCount(surveyListProgress.loaded, 'instrumento recibido', 'instrumentos recibidos')} · ${formatCount(operationalItems.length, 'operativo', 'operativos')} · ${unverifiedItems.length.toLocaleString('es-AR')} por verificar`
                  : `Mostrando ${surveyListProgress.loaded.toLocaleString('es-AR')} de ${formatCount(surveyListProgress.total, 'registro', 'registros')} · ${formatCount(operationalItems.length, 'operativo', 'operativos')} (${formatCount(compatibleItems.length, 'compatible', 'compatibles')} · ${unverifiedItems.length.toLocaleString('es-AR')} por verificar) · ${formatCount(conflictItems.length, 'conflicto separado', 'conflictos separados')}`}
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
