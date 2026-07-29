import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Download, Loader2, MessageSquareText, RefreshCw, Timer, TrendingUp, Users } from 'lucide-react';

import { SurveyForm } from '@/components/surveys/SurveyForm';
import { SurveyErrorState } from '@/components/surveys/SurveyErrorState';
import { SurveyLiveHeatmapPreview } from '@/components/surveys/SurveyLiveHeatmapPreview';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useSurveyPublic } from '@/hooks/useSurveyPublic';
import type { PublicResponsePayload, SurveyComment, SurveyLivePublicResultsPayload, SurveyLiveResults } from '@/types/encuestas';
import { toast } from '@/components/ui/use-toast';
import { isSurveyResponseDuplicateError } from '@/utils/surveySubmissionErrors';
import { usePageMetadata } from '@/hooks/usePageMetadata';
import { PublicSurveyShareActions } from '@/components/surveys/PublicSurveyShareActions';
import {
  trackSurveyLoadError,
  trackSurveyCtaClicked,
  trackSurveyErrorRendered,
  trackSurveyPageView,
  trackSurveyRetryTriggered,
  trackSurveySubmission,
} from '@/utils/surveyAnalytics';
import { mapSurveyError } from '@/utils/mapSurveyError';
import { useSurveySocket } from '@/hooks/useSurveySocket';
import { SurveyComments, type SurveyCommentsCopy } from '@/components/surveys/SurveyComments';
import { hasSurveyLiveActivity, useSurveyLiveResults, type SurveyLiveRequestParams } from '@/hooks/useSurveyLiveResults';
import { safeSessionStorage } from '@/utils/safeLocalStorage';
import { resolveSurveyLiveSlug } from '@/utils/surveyLiveSlug';
import {
  SURVEY_ANALYTICS_RANGE_OPTIONS,
  createDefaultSurveyLiveRequestParams,
  fromLocalDateTimeInputValue,
  normalizeStoredSurveyLiveRequestParams,
  selectSurveyAnalyticsRange,
  toLocalDateTimeInputValue,
  type SurveyAnalyticsRangeSelection,
} from './surveyAnalyticsRange';

const LIVE_FILTERS_STORAGE_KEY = 'survey-live-filters-v2';

const appendDemoVoteToLiveResults = (
  source: SurveyLiveResults | undefined,
  payload: PublicResponsePayload,
): SurveyLiveResults | undefined => {
  if (!source?.preguntas || !Array.isArray(payload.respuestas)) return source;

  const preguntas = { ...source.preguntas };
  let changed = false;

  for (const respuesta of payload.respuestas) {
    const key = String(respuesta.pregunta_id);
    const questionStats = preguntas[key];
    if (!questionStats?.opciones?.length || !respuesta.opcion_ids?.length) continue;

    const selectedIds = new Set(respuesta.opcion_ids.map((id) => String(id)));
    preguntas[key] = {
      ...questionStats,
      opciones: questionStats.opciones.map((option) =>
        selectedIds.has(String(option.id)) ? { ...option, votos: option.votos + 1 } : option,
      ),
    };
    changed = true;
  }

  if (!changed) return source;

  return {
    ...source,
    total_respuestas: (Number(source.total_respuestas) || 0) + 1,
    preguntas,
  };
};

const isLiveResultsV2 = (
  value: SurveyLiveResults | SurveyLivePublicResultsPayload | undefined,
): value is SurveyLivePublicResultsPayload =>
  Boolean(value?.contract_version === 'surveys.live_results.v2' && Array.isArray((value as SurveyLivePublicResultsPayload).preguntas));

const toLegacyLiveResults = (
  value: SurveyLiveResults | SurveyLivePublicResultsPayload | undefined,
): SurveyLiveResults | undefined => {
  if (!value) return undefined;
  if (!isLiveResultsV2(value)) return value as SurveyLiveResults;

  const preguntas: SurveyLiveResults['preguntas'] = {};
  for (const question of value.preguntas ?? []) {
    const questionId = question.id;
    if (questionId === undefined || questionId === null) continue;
    preguntas[String(questionId)] = {
      tipo: String(question.tipo || 'opcion_unica'),
      opciones: (question.opciones ?? []).map((option) => ({
        id: option.id ?? option.value ?? '',
        texto: String(option.texto ?? option.label ?? option.value ?? ''),
        votos: Number(option.votos ?? option.value ?? 0) || 0,
      })),
    };
  }

  return {
    contract_version: value.contract_version,
    result_version: value.result_version,
    snapshot_version: value.snapshot_version,
    updated_at: value.updated_at,
    total_respuestas: Number(value.total_respuestas ?? 0) || 0,
    preguntas,
  };
};

const getLivePayloadVersion = (payload?: SurveyLivePublicResultsPayload) => {
  const resultVersion = Number(payload?.result_version);
  if (Number.isFinite(resultVersion)) return resultVersion;
  const updatedAt = Date.parse(String(payload?.updated_at || ''));
  return Number.isFinite(updatedAt) ? updatedAt : 0;
};

const parseLiveRequestParams = (): SurveyLiveRequestParams => {
  const raw = safeSessionStorage.getItem(LIVE_FILTERS_STORAGE_KEY);
  if (!raw) return createDefaultSurveyLiveRequestParams();

  try {
    return normalizeStoredSurveyLiveRequestParams(JSON.parse(raw));
  } catch {
    return createDefaultSurveyLiveRequestParams();
  }
};

const PublicSurveyPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantSlug = searchParams.get('tenant');
  const mode = searchParams.get('mode'); // 'embed' or undefined
  const [submitted, setSubmitted] = useState(false);
  const [livePollTotalVotes, setLivePollTotalVotes] = useState<number | null>(null);
  const [lastSubmission, setLastSubmission] = useState<PublicResponsePayload | null>(null);
  const {
    survey,
    isLoading,
    isRefetching,
    failureCount,
    error,
    errorStatus,
    errorDetails,
    errorReasonCode,
    isTransientError,
    retryLoad,
    submit,
    isSubmitting,
    submitError,
    submitStatus,
    submitErrorDetails,
    submitReasonCode,
  } = useSurveyPublic(slug, { tenantSlug });

  const [liveResults, setLiveResults] = useState<SurveyLiveResults | undefined>(undefined);
  const [socketLiveDashboard, setSocketLiveDashboard] = useState<SurveyLivePublicResultsPayload | undefined>(undefined);
  const [liveComments, setLiveComments] = useState<SurveyComment[]>([]);
  const [liveRequestParams, setLiveRequestParams] = useState<SurveyLiveRequestParams>(() => parseLiveRequestParams());
  const [showLoadingSkeleton, setShowLoadingSkeleton] = useState(true);
  const surveyResources = survey?.recursos as Record<string, unknown> | undefined;
  const isDemoParticipationSurvey = Boolean(
    surveyResources?.demoMode ||
      surveyResources?.demo_mode ||
      searchParams.get('demo_participation') === '1',
  );
  const shouldRevealLiveResults = Boolean(
    survey?.mostrar_resultados_envivo && (!isDemoParticipationSurvey || submitted),
  );
  const liveSlug = useMemo(() => resolveSurveyLiveSlug(survey, slug), [survey, slug]);
  const {
    liveResults: polledLiveDashboard,
    isLoading: isLoadingLiveDashboard,
    isFetching: isFetchingLiveDashboard,
    error: liveDashboardError,
    consecutiveErrors: liveDashboardConsecutiveErrors,
    liveStatus,
    pollingIntervalMs,
    refetch: refetchLiveDashboard,
  } = useSurveyLiveResults(
    shouldRevealLiveResults ? liveSlug : undefined,
    tenantSlug,
    liveRequestParams,
  );
  const hasActiveLiveFilters = Boolean(
    liveRequestParams.range_preset ||
      liveRequestParams.desde ||
      liveRequestParams.hasta ||
      liveRequestParams.canal ||
      liveRequestParams.barrio ||
      liveRequestParams.ciudad ||
      liveRequestParams.provincia,
  );
  const liveDashboard = useMemo(() => {
    if (!socketLiveDashboard || hasActiveLiveFilters) return polledLiveDashboard;
    if (!polledLiveDashboard) return socketLiveDashboard;
    return getLivePayloadVersion(socketLiveDashboard) >= getLivePayloadVersion(polledLiveDashboard)
      ? socketLiveDashboard
      : polledLiveDashboard;
  }, [hasActiveLiveFilters, polledLiveDashboard, socketLiveDashboard]);
  const renderedLiveResults = useMemo(() => {
    const dashboardResults = toLegacyLiveResults(liveDashboard);
    if (!dashboardResults) return liveResults;
    return isDemoParticipationSurvey && submitted && lastSubmission
      ? appendDemoVoteToLiveResults(dashboardResults, lastSubmission)
      : dashboardResults;
  }, [isDemoParticipationSurvey, lastSubmission, liveDashboard, liveResults, submitted]);
  const surveySocketRooms = useMemo(() => {
    const realtime = survey?.realtime as Record<string, unknown> | undefined;
    const explicitRooms = Array.isArray(realtime?.rooms)
      ? realtime.rooms.filter((room): room is string => typeof room === 'string' && room.trim().length > 0)
      : [];
    const contractRooms = [
      typeof realtime?.primary_room === 'string' ? realtime.primary_room : null,
      typeof realtime?.room === 'string' ? realtime.room : null,
      typeof realtime?.legacy_room === 'string' ? realtime.legacy_room : null,
      ...explicitRooms,
    ].filter((room): room is string => Boolean(room && room.trim()));

    if (contractRooms.length > 0) {
      return Array.from(new Set(contractRooms));
    }

    if (!liveSlug) return [];
    return tenantSlug
      ? [`encuesta:${tenantSlug}:${liveSlug}`, `encuesta_${liveSlug}`]
      : [`encuesta_${liveSlug}`];
  }, [liveSlug, survey?.realtime, tenantSlug]);

  useEffect(() => {
    safeSessionStorage.setItem(LIVE_FILTERS_STORAGE_KEY, JSON.stringify(liveRequestParams));
  }, [liveRequestParams]);

  useEffect(() => {
    if (isLoading) {
      setShowLoadingSkeleton(true);
      return;
    }
    const timeout = window.setTimeout(() => setShowLoadingSkeleton(false), 400);
    return () => window.clearTimeout(timeout);
  }, [isLoading]);

  useEffect(() => {
    trackSurveyPageView({
      slug,
      host: typeof window !== 'undefined' ? window.location.host : null,
      tenant: tenantSlug,
    });
  }, [slug, tenantSlug]);

  const previousFailureCount = useRef(0);
  useEffect(() => {
    if (!isTransientError) return;
    if (failureCount <= 0) {
      previousFailureCount.current = 0;
      return;
    }
    if (failureCount !== previousFailureCount.current) {
      trackSurveyRetryTriggered({
        slug,
        host: typeof window !== 'undefined' ? window.location.host : null,
        tenant: tenantSlug,
        attempt: failureCount,
        mode: 'auto',
      });
      previousFailureCount.current = failureCount;
    }
  }, [failureCount, isTransientError, slug, tenantSlug]);

  useEffect(() => {
    if (!error) return;
    trackSurveyLoadError({
      slug,
      host: typeof window !== 'undefined' ? window.location.host : null,
      tenant: tenantSlug,
      statusCode: errorStatus,
      reasonCode: errorReasonCode,
      message: error,
    });
  }, [error, errorReasonCode, errorStatus, slug, tenantSlug]);

  useEffect(() => {
    const host = typeof window !== 'undefined' ? window.location.host : '';
    const expectedHostFromError = typeof errorDetails?.expected_host === 'string' ? errorDetails.expected_host : null;
    const expectedHostFromSurvey = typeof (survey?.recursos as Record<string, unknown> | undefined)?.public_host === 'string'
      ? String((survey?.recursos as Record<string, unknown>).public_host)
      : null;
    const expectedHost = expectedHostFromError ?? expectedHostFromSurvey;
    if (!host || !expectedHost || expectedHost === host) return;

    const message = `[survey-public-host-mismatch] host=${host} expected=${expectedHost} slug=${slug ?? ''}`;
    const sentry = (window as { Sentry?: { captureMessage?: (msg: string, context?: Record<string, unknown>) => void } }).Sentry;
    if (typeof sentry?.captureMessage === 'function') {
      sentry.captureMessage(message, {
        level: 'warning',
        tags: { module: 'encuestas-public' },
        extra: { tenantSlug, slug, host, expectedHost },
      });
      return;
    }
    console.warn(message, { tenantSlug, slug, host, expectedHost });
  }, [errorDetails, slug, survey?.recursos, tenantSlug]);

  // Sync initial live results from survey data
  useEffect(() => {
    if (!shouldRevealLiveResults) {
      setLiveResults(undefined);
      return;
    }
    if (survey?.resultados_envivo) {
      setLiveResults(
        isDemoParticipationSurvey && submitted && lastSubmission
          ? appendDemoVoteToLiveResults(survey.resultados_envivo, lastSubmission)
          : survey.resultados_envivo,
      );
    }
  }, [isDemoParticipationSurvey, lastSubmission, shouldRevealLiveResults, submitted, survey?.resultados_envivo]);

  // Handle Socket.IO connection
  useSurveySocket({
      slug: liveSlug || '',
      tenantSlug,
      rooms: surveySocketRooms,
      enabled: Boolean(shouldRevealLiveResults || survey?.permitir_comentarios),
      onUpdate: (data) => {
          const legacyResults = toLegacyLiveResults(data);
          setLiveResults(
            isDemoParticipationSurvey && submitted && lastSubmission
              ? appendDemoVoteToLiveResults(legacyResults, lastSubmission)
              : legacyResults,
          );
          if (isLiveResultsV2(data)) {
            setSocketLiveDashboard(data);
          } else {
            void refetchLiveDashboard();
          }
      },
      onComment: (comment) => {
          setLiveComments((prev) => [comment, ...prev]);
      }
  });

  usePageMetadata({
    title: survey?.titulo ? `${survey.titulo} · Encuesta ciudadana` : 'Encuesta ciudadana',
    description:
      survey?.descripcion ??
      'Respondé la encuesta y ayudá a tomar decisiones basadas en la voz de la comunidad.',
    image: '/images/og-chatboc.png',
  });

  const metadata = useMemo(() => {
    const canalParam = searchParams.get('canal') || searchParams.get('source');
    const normalizedCanal = canalParam === 'qr' || canalParam === 'web' || canalParam === 'whatsapp' || canalParam === 'email'
      ? canalParam
      : undefined;
    return {
      utm_source: searchParams.get('utm_source') || undefined,
      utm_campaign: searchParams.get('utm_campaign') || undefined,
      canal: normalizedCanal,
    } as Pick<PublicResponsePayload, 'utm_source' | 'utm_campaign' | 'canal'>;
  }, [searchParams]);

  const safeText = (value?: unknown) => (typeof value === 'string' ? value : '');
  const textOr = (value: unknown, fallback: string) => {
    const normalized = safeText(value).trim();
    return normalized.length ? normalized : fallback;
  };
  const toDisplayText = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const candidate =
        record.texto ?? record.label ?? record.title ?? record.titulo ?? record.nombre ?? record.pregunta ?? record.value;
      if (typeof candidate === 'string' || typeof candidate === 'number' || typeof candidate === 'boolean') {
        return String(candidate);
      }
      const leader = record.lider;
      if (leader && typeof leader === 'object') {
        const leaderRecord = leader as Record<string, unknown>;
        const leaderCandidate = leaderRecord.texto ?? leaderRecord.label ?? leaderRecord.title ?? leaderRecord.value;
        if (
          typeof leaderCandidate === 'string' ||
          typeof leaderCandidate === 'number' ||
          typeof leaderCandidate === 'boolean'
        ) {
          return String(leaderCandidate);
        }
      }
    }
    return '';
  };

  const handleSubmit = useCallback(
    async (payload: PublicResponsePayload) => {
      try {
        const finalPayload: PublicResponsePayload = { ...payload, ...metadata };
        await submit(finalPayload);
        setLastSubmission(finalPayload);
        setSubmitted(true);
        if (survey?.resultados_envivo) {
          setLiveResults(
            isDemoParticipationSurvey
              ? appendDemoVoteToLiveResults(survey.resultados_envivo, finalPayload)
              : survey.resultados_envivo,
          );
        }
        if (survey) {
          trackSurveySubmission({ survey, payload: finalPayload });
        }

        let description = safeText(votacionMessages?.toast_success_detail);
        if (survey?.puntos_recompensa && survey.puntos_recompensa > 0) {
          description = `${safeText(votacionMessages?.toast_puntos_prefix)} ${survey.puntos_recompensa}`;
        }

        toast({ title: safeText(votacionMessages?.toast_success_title), description });
      } catch (err) {
        setLastSubmission(null);
        if (isSurveyResponseDuplicateError(err)) {
          toast({
            title: safeText(votacionMessages?.toast_duplicate_title),
            description: safeText(votacionMessages?.toast_duplicate_detail),
          });
          throw err;
        }
        const message = err instanceof Error ? err.message : String(err);
        toast({
          title: safeText(votacionMessages?.toast_error_title),
          description: submitError ?? message ?? safeText(votacionMessages?.toast_error_detail),
          variant: 'destructive',
        });
        throw err;
      }
    },
    [isDemoParticipationSurvey, metadata, submit, survey, submitError],
  );

  const handleReset = useCallback(() => {
    setSubmitted(false);
    setLastSubmission(null);
  }, []);

  // Embed Mode Styles
  const containerClass = mode === 'embed' ? "w-full min-h-screen bg-background" : "mx-auto w-full max-w-5xl px-3 py-6 sm:px-4 sm:py-8 lg:py-10";

  const votingOptionsCount = useMemo(() => {
    const question = survey?.preguntas?.[0];
    return question?.opciones?.length ?? 0;
  }, [survey?.preguntas]);

  const totalVotes = useMemo(() => {
    if (!survey) return null;
    if (isDemoParticipationSurvey && !submitted) return null;
    if (typeof liveResults?.total_respuestas === 'number') {
      return liveResults.total_respuestas;
    }
    if (survey?.resultados_envivo?.total_respuestas) {
      return survey.resultados_envivo.total_respuestas;
    }
    if (survey?.resultados_envivo?.preguntas) {
      const question = Object.values(survey.resultados_envivo.preguntas)[0];
      if (question?.opciones?.length) {
        return question.opciones.reduce((acc, curr) => acc + curr.votos, 0);
      }
    }
    return null;
  }, [isDemoParticipationSurvey, liveResults, submitted, survey]);

  useEffect(() => {
    if (typeof totalVotes === 'number') {
      setLivePollTotalVotes(totalVotes);
    } else if (isDemoParticipationSurvey && !submitted) {
      setLivePollTotalVotes(null);
    }
  }, [isDemoParticipationSurvey, submitted, totalVotes]);

  const pollSubtitle = useMemo(() => {
    if (!survey?.descripcion) return null;
    return survey.descripcion;
  }, [survey?.descripcion]);

  const votacionUi = useMemo(
    () => ((survey?.recursos as Record<string, unknown> | undefined)?.votacion_ui as Record<string, unknown>) ?? {},
    [survey?.recursos],
  );
  const votacionMessages = useMemo(
    () => ((survey?.recursos as Record<string, unknown> | undefined)?.votacion_mensajes as Record<string, unknown>) ?? {},
    [survey?.recursos],
  );
  const comentariosCopy = useMemo(
    () =>
      ((survey?.recursos as Record<string, unknown> | undefined)?.comentarios_ui as SurveyCommentsCopy) ?? {},
    [survey?.recursos],
  );


  const liveResultsUi = useMemo(
    () => ((survey?.recursos as Record<string, unknown> | undefined)?.live_results_ui as Record<string, unknown>) ?? {},
    [survey?.recursos],
  );
  const liveTimeline = useMemo(() => liveDashboard?.timeline_minute ?? [], [liveDashboard?.timeline_minute]);
  const liveTimelineMaxValue = useMemo(
    () => Math.max(...liveTimeline.map((point) => Number(point.respuestas ?? point.value ?? point.total ?? 0)), 1),
    [liveTimeline],
  );
  const liveQuestions = useMemo(() => liveDashboard?.preguntas ?? [], [liveDashboard?.preguntas]);
  const liveHeatmap = liveDashboard?.heatmap;
  const hasLiveDashboardActivity = useMemo(() => hasSurveyLiveActivity(liveDashboard), [liveDashboard]);
  const trend = liveDashboard?.momentum?.trend;
  const trendChipClass = trend === 'subiendo'
    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
    : trend === 'bajando'
      ? 'border-amber-500/40 bg-amber-500/10 text-amber-600'
      : 'border-blue-500/40 bg-blue-500/10 text-blue-600';
  const liveStatusToneClass = liveStatus.status === 'live'
    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700'
    : liveStatus.status === 'syncing' || liveStatus.status === 'loading'
      ? 'border-blue-500/40 bg-blue-500/10 text-blue-700'
      : liveStatus.status === 'empty' || liveStatus.status === 'stale'
        ? 'border-slate-500/30 bg-slate-500/10 text-slate-700'
        : 'border-amber-500/40 bg-amber-500/10 text-amber-700';
  const updatedAtLabel = useMemo(() => {
    if (!liveDashboard?.updated_at) return null;
    const date = new Date(liveDashboard.updated_at);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString();
  }, [liveDashboard?.updated_at]);
  const refreshIntervalLabel = useMemo(() => {
    if (!pollingIntervalMs) return null;
    const seconds = Math.max(1, Math.round(pollingIntervalMs / 1000));
    return textOr(liveResultsUi?.refresh_interval_label, `Actualiza cada ${seconds}s`);
  }, [liveResultsUi, pollingIntervalMs]);
  const liveStatusLabel = textOr(liveResultsUi?.[`status_${liveStatus.status}_label`], liveStatus.label);
  const liveStatusDescription = textOr(liveResultsUi?.[`status_${liveStatus.status}_description`], liveStatus.description);
  const liveEmptyStateLabel = textOr(
    liveDashboard?.render_contract?.empty_state,
    textOr(liveResultsUi?.empty_state, 'Todavia no hay respuestas para los filtros actuales.'),
  );
  const manualUpdateLabel = textOr(liveResultsUi?.manual_refresh_label, 'Actualizar resultados en vivo');
  const handleExportLiveCsv = useCallback(() => {
    if (!liveDashboard) return;
    const rows = [
      ['tipo', 'clave', 'value', 'votos', 'porcentaje'].join(','),
      ...liveQuestions.flatMap((question, qIndex) =>
        (question.opciones ?? []).map((option, oIndex) =>
          [
            'pregunta',
            String(question.id ?? qIndex),
            JSON.stringify(option.value ?? ''),
            String(option.votos ?? 0),
            String(option.porcentaje ?? 0),
          ].join(','),
        ),
      ),
    ];

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${liveSlug || slug || 'encuesta'}-live-results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [liveDashboard, liveQuestions, liveSlug, slug]);

  const isClosed = Boolean(survey?.estado === 'cerrada' || survey?.status === 'closed');
  const closedMessage =
    (survey?.recursos as Record<string, unknown> | undefined)?.mensaje_cierre ??
    (survey as Record<string, unknown> | undefined)?.mensaje_cierre ??
    (survey as Record<string, unknown> | undefined)?.mensaje_institucional ??
    null;

  const errorView = useMemo(() => {
    const start = typeof errorDetails?.inicio_at === 'string' ? errorDetails.inicio_at : null;
    const end = typeof errorDetails?.fin_at === 'string' ? errorDetails.fin_at : null;
    const payloadPrimaryCta = typeof errorDetails?.primary_cta === 'string' ? errorDetails.primary_cta : null;
    const payloadSecondaryCta = typeof errorDetails?.secondary_cta === 'string' ? errorDetails.secondary_cta : null;
    const formatDate = (raw: string | null) => {
      if (!raw) return null;
      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) return null;
      return date.toLocaleString();
    };
    const formattedStart = formatDate(start);
    const formattedEnd = formatDate(end);
    const activeWindow = formattedStart && formattedEnd ? `${formattedStart} — ${formattedEnd}` : null;

    const mapped = mapSurveyError({
      errorStatus,
      reasonCode: errorReasonCode,
      details: errorDetails,
    });

    const normalizedDescription =
      mapped.reasonCode === 'survey_outside_active_window'
        ? activeWindow ?? mapped.description
        : mapped.description;

    return {
      ...mapped,
      title: mapped.title,
      subtitle: normalizedDescription,
      primaryLabel: payloadPrimaryCta ?? mapped.primaryCta,
      secondaryLabel: mode !== 'embed' ? payloadSecondaryCta ?? mapped.secondaryCta : null,
    };
  }, [errorDetails, errorReasonCode, errorStatus, mode]);

  useEffect(() => {
    if (!error) return;
    trackSurveyErrorRendered({
      slug,
      host: typeof window !== 'undefined' ? window.location.host : null,
      tenant: tenantSlug,
      statusCode: errorView.statusCode,
      reasonCode: errorView.reasonCode,
      actionHint: errorView.actionHint,
      requestId: errorView.requestId,
    });
    if (errorView.requestId) {
      console.debug('[survey-public] request_id', errorView.requestId);
    }
  }, [error, errorView.actionHint, errorView.reasonCode, errorView.requestId, errorView.statusCode, slug, tenantSlug]);

  const handleErrorPrimaryAction = useCallback(() => {
    const actionHint = (errorView.actionHint || '').toLowerCase();
    trackSurveyCtaClicked({
      slug,
      host: typeof window !== 'undefined' ? window.location.host : null,
      tenant: tenantSlug,
      actionHint: errorView.actionHint,
      ctaLabel: errorView.primaryLabel,
      requestId: errorView.requestId,
    });

    if (actionHint === 'view_other_surveys' || actionHint === 'go_home') {
      navigate(actionHint === 'go_home' ? '/' : '/encuestas');
      return;
    }

    trackSurveyRetryTriggered({
      slug,
      host: typeof window !== 'undefined' ? window.location.host : null,
      tenant: tenantSlug,
      attempt: Math.max(1, failureCount + 1),
      mode: 'manual',
    });
    void retryLoad();
  }, [errorView.actionHint, errorView.primaryLabel, errorView.requestId, failureCount, navigate, retryLoad, slug, tenantSlug]);

  if (showLoadingSkeleton || isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl px-3 py-6 sm:px-4 sm:py-8 lg:py-10">
        <Card className="w-full border border-border/60">
          <CardContent className="space-y-6 px-6 py-8 sm:px-8">
            <div className="space-y-3">
              <Skeleton className="h-9 w-4/5" />
              <Skeleton className="h-5 w-2/3" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-16 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !survey) {
    return (
      <SurveyErrorState
        title={errorView.title}
        description={errorView.subtitle || error || 'El enlace puede estar vencido o no existe.'}
        primaryLabel={errorView.primaryLabel}
        secondaryLabel={errorView.secondaryLabel}
        onPrimary={handleErrorPrimaryAction}
        onSecondaryHome
        busy={isRefetching}
        reasonCode={errorView.reasonCode}
        requestId={errorView.requestId}
      />
    );
  }

  if (submitted && survey) {
    return (
      <div className={containerClass}>
        <Card className="w-full border-none shadow-none sm:border sm:shadow-sm">
          <CardContent className="flex flex-col items-center gap-6 py-12 text-center">
            <div className="space-y-3 max-w-xl">
              <h1 className="text-2xl font-semibold">{textOr(votacionMessages?.titulo_gracias, '¡Gracias por participar!')}</h1>
              {survey.puntos_recompensa ? (
                <p className="text-lg font-bold text-primary animate-pulse">
                  {textOr(votacionMessages?.puntos_label, 'Puntos obtenidos:')} {survey.puntos_recompensa}
                </p>
              ) : null}
              <p className="text-muted-foreground">
                {isDemoParticipationSurvey
                  ? textOr(
                      votacionMessages?.detalle_gracias_demo,
                      'Tu voto se sumo a la simulacion: ahora ves 100 respuestas demo mas tu participacion.',
                    )
                  : textOr(votacionMessages?.detalle_gracias, 'Tu respuesta quedó registrada correctamente.')}
              </p>
            </div>

            {/* Show Results Here if enabled */}
            {shouldRevealLiveResults && (
              <div className="w-full max-w-xl text-left border rounded-xl p-6 bg-accent/10">
                <h3 className="mb-4 font-semibold text-lg">{textOr(votacionUi?.resultados_titulo, 'Resultados en vivo')}</h3>
                <SurveyForm
                  survey={survey}
                  onSubmit={async () => {}}
                  loading={false}
                  liveResults={renderedLiveResults}
                  showLiveResults={true}
                  readOnly={true}
                  showHeader={false}
                  submitLabel={textOr(votacionUi?.resultados_boton, 'Ver resultados')}
                  variant="votacion"
                />
              </div>
            )}

            {mode !== 'embed' && (
                <PublicSurveyShareActions survey={survey} submission={lastSubmission} />
            )}

            <div className="flex flex-wrap items-center justify-center gap-3">
              {mode !== 'embed' && (
                <Button asChild>
                  <Link to="/">{textOr(votacionUi?.volver_inicio, 'Volver al inicio')}</Link>
                </Button>
              )}
              <Button variant="outline" onClick={handleReset}>
                {textOr(votacionUi?.volver_encuesta, 'Responder nuevamente')}
              </Button>
            </div>

            {survey.permitir_comentarios && (
              <SurveyComments
                slug={liveSlug || slug || ''}
                tenantSlug={tenantSlug || undefined}
                realtimeComments={liveComments}
                copy={comentariosCopy}
                commentConfig={survey.commentConfig}
              />
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isClosed && survey) {
    return (
      <div className={containerClass}>
        <Card className="w-full border border-border/60">
          <CardContent className="space-y-6 px-6 py-8 text-center sm:px-8">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold sm:text-3xl">{survey.titulo}</h1>
              {closedMessage ? (
                <p className="text-muted-foreground">{String(closedMessage)}</p>
              ) : null}
            </div>
            <div className="w-full max-w-2xl mx-auto text-left">
              <SurveyForm
                survey={survey}
                onSubmit={async () => {}}
                loading={false}
                liveResults={renderedLiveResults}
                showLiveResults={true}
                readOnly={true}
                showHeader={false}
                submitLabel={textOr(votacionUi?.resultados_finales_boton, 'Ver resultados finales')}
                variant="votacion"
              />
            </div>
            {survey.permitir_comentarios && (
              <SurveyComments
                slug={liveSlug || slug || ''}
                tenantSlug={tenantSlug || undefined}
                realtimeComments={liveComments}
                copy={comentariosCopy}
                commentConfig={survey.commentConfig}
              />
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      {survey.es_votacion_envivo ? (
        <div className="space-y-6 animate-in fade-in-50 duration-500">
          <Card className="border border-border/60 bg-gradient-to-br from-background via-background to-primary/5 shadow-sm">
            <CardContent className="space-y-6 px-6 py-8 sm:px-8">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-600">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    {textOr(votacionUi?.badge_en_vivo, 'En vivo')}
                  </span>
                  {isDemoParticipationSurvey ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600">
                      {textOr(votacionUi?.badge_demo, 'Demo')}
                    </span>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <h1 className="text-2xl font-semibold sm:text-3xl">{survey.titulo}</h1>
                  {pollSubtitle && (
                    <p className="text-muted-foreground text-base sm:text-lg">{pollSubtitle}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/70 px-4 py-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                  <Users className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">{textOr(votacionUi?.stat_total_label, 'Total de respuestas')}</p>
                    <p className="text-lg font-semibold">
                      {livePollTotalVotes ?? (isDemoParticipationSurvey ? 'Tras votar' : '—')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/70 px-4 py-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                  <Timer className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">{textOr(votacionUi?.stat_tiempo_label, 'Última actualización')}</p>
                    <p className="text-lg font-semibold">
                      {survey.fin_at ? new Date(survey.fin_at).toLocaleString() : '—'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/70 px-4 py-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                  <MessageSquareText className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">{textOr(votacionUi?.stat_opciones_label, 'Opciones activas')}</p>
                    <p className="text-lg font-semibold">{votingOptionsCount || '—'}</p>
                  </div>
                </div>
              </div>

              {mode !== 'embed' && (
                <div className="flex justify-start">
                  <PublicSurveyShareActions survey={survey} submission={lastSubmission} />
                </div>
              )}

              {isDemoParticipationSurvey && !submitted ? (
                <div className="rounded-2xl border border-primary/25 bg-primary/10 p-4 text-sm text-foreground shadow-sm">
                  Vota primero para desbloquear los resultados. Despues vas a ver la base demo de 100 respuestas
                  sinteticas mas tu participacion en vivo.
                </div>
              ) : null}

              {shouldRevealLiveResults && liveDashboard ? (
                <div className="space-y-4 rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{textOr(liveResultsUi?.header_title, survey.titulo)}</span>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${liveStatusToneClass}`}
                        role="status"
                        aria-live="polite"
                        title={liveStatusDescription}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full bg-current ${isFetchingLiveDashboard ? 'animate-pulse' : ''}`} aria-hidden="true" />
                        {liveStatusLabel}
                      </span>
                      {trend ? (
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${trendChipClass}`}>
                          {trend === 'subiendo' ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                          {String(trend)}
                        </span>
                      ) : null}
                      {updatedAtLabel ? <span className="text-xs text-muted-foreground">Actualizado: {updatedAtLabel}</span> : null}
                      {refreshIntervalLabel ? <span className="text-xs text-muted-foreground">{refreshIntervalLabel}</span> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={handleExportLiveCsv}>
                        <Download className="mr-2 h-3.5 w-3.5" />
                        {textOr(liveResultsUi?.export_csv_label, textOr(votacionUi?.resultados_finales_boton, 'Exportar CSV'))}
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={manualUpdateLabel}
                        title={manualUpdateLabel}
                        disabled={isFetchingLiveDashboard}
                        onClick={() => void refetchLiveDashboard()}
                      >
                        <RefreshCw className={`h-4 w-4 text-muted-foreground ${isFetchingLiveDashboard ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>
                  </div>

                  {liveDashboardConsecutiveErrors > 2 && liveDashboardError ? (
                    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
                      {liveDashboardError}
                    </div>
                  ) : null}

                  {shouldRevealLiveResults ? (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <select
                        aria-label={textOr(liveResultsUi?.filter_heatmap_label, 'Mapa de calor')}
                        className="rounded-md border bg-background px-2 py-1.5 text-xs"
                        value={String(liveRequestParams.include_heatmap ?? 1)}
                        onChange={(event) =>
                          setLiveRequestParams((prev) => ({ ...prev, include_heatmap: Number(event.target.value) === 0 ? 0 : 1 }))
                        }
                      >
                        <option value="1">{textOr(liveResultsUi?.filter_heatmap_on_label, 'Mapa activado')}</option>
                        <option value="0">{textOr(liveResultsUi?.filter_heatmap_off_label, 'Mapa desactivado')}</option>
                      </select>
                      <select
                        aria-label={textOr(liveResultsUi?.filter_window_label, 'Rango analítico')}
                        className="rounded-md border bg-background px-2 py-1.5 text-xs"
                        value={liveRequestParams.range_preset ?? 'custom'}
                        onChange={(event) =>
                          setLiveRequestParams((prev) =>
                            selectSurveyAnalyticsRange(
                              prev,
                              event.target.value as SurveyAnalyticsRangeSelection,
                            ),
                          )
                        }
                      >
                        {SURVEY_ANALYTICS_RANGE_OPTIONS.map((option) => {
                          const copyKey = option.value === 'last_60m'
                            ? 'preset_last_hour_label'
                            : option.value === 'today'
                              ? 'preset_today_label'
                              : 'preset_last_24h_label';
                          return (
                            <option key={option.value} value={option.value}>
                              {textOr(liveResultsUi?.[copyKey], option.label)}
                            </option>
                          );
                        })}
                        <option value="custom">
                          {textOr(liveResultsUi?.preset_custom_label, 'Rango personalizado')}
                        </option>
                      </select>
                      {!liveRequestParams.range_preset ? (
                        <>
                          <input
                            type="datetime-local"
                            aria-label={textOr(liveResultsUi?.filter_from_label, 'Desde')}
                            className="rounded-md border bg-background px-2 py-1.5 text-xs"
                            value={toLocalDateTimeInputValue(liveRequestParams.desde)}
                            max={toLocalDateTimeInputValue(liveRequestParams.hasta)}
                            onChange={(event) => {
                              const desde = fromLocalDateTimeInputValue(event.target.value);
                              if (desde) setLiveRequestParams((prev) => ({ ...prev, desde }));
                            }}
                          />
                          <input
                            type="datetime-local"
                            aria-label={textOr(liveResultsUi?.filter_to_label, 'Hasta')}
                            className="rounded-md border bg-background px-2 py-1.5 text-xs"
                            value={toLocalDateTimeInputValue(liveRequestParams.hasta)}
                            min={toLocalDateTimeInputValue(liveRequestParams.desde)}
                            onChange={(event) => {
                              const hasta = fromLocalDateTimeInputValue(event.target.value);
                              if (hasta) setLiveRequestParams((prev) => ({ ...prev, hasta }));
                            }}
                          />
                        </>
                      ) : null}
                      <input
                        aria-label={textOr(liveResultsUi?.filter_channel_label, 'Canal')}
                        className="rounded-md border bg-background px-2 py-1.5 text-xs"
                        placeholder={textOr(liveResultsUi?.filter_channel_placeholder, 'Filtrar por canal')}
                        value={liveRequestParams.canal ?? ''}
                        onChange={(event) => setLiveRequestParams((prev) => ({ ...prev, canal: event.target.value || undefined }))}
                      />
                      <input
                        aria-label={textOr(liveResultsUi?.filter_barrio_label, 'Barrio')}
                        className="rounded-md border bg-background px-2 py-1.5 text-xs"
                        placeholder={textOr(liveResultsUi?.filter_barrio_placeholder, 'Filtrar por barrio')}
                        value={liveRequestParams.barrio ?? ''}
                        onChange={(event) => setLiveRequestParams((prev) => ({ ...prev, barrio: event.target.value || undefined }))}
                      />
                      <input
                        aria-label={textOr(liveResultsUi?.filter_ciudad_label, 'Ciudad')}
                        className="rounded-md border bg-background px-2 py-1.5 text-xs"
                        placeholder={textOr(liveResultsUi?.filter_ciudad_placeholder, 'Filtrar por ciudad')}
                        value={liveRequestParams.ciudad ?? ''}
                        onChange={(event) => setLiveRequestParams((prev) => ({ ...prev, ciudad: event.target.value || undefined }))}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setLiveRequestParams(createDefaultSurveyLiveRequestParams())}
                      >
                        {textOr(liveResultsUi?.filters_reset_label, 'Limpiar filtros')}
                      </Button>
                    </div>
                  ) : null}

                  {!hasLiveDashboardActivity ? (
                    <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4" role="status" aria-live="polite">
                      <p className="text-sm font-medium">{liveEmptyStateLabel}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{liveStatusDescription}</p>
                    </div>
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-border/60 bg-background/70 p-3 transition-all duration-300 hover:shadow-sm">
                      <p className="text-xs text-muted-foreground">{textOr(liveResultsUi?.kpi_responses_last_hour_label, 'Respuestas en la última hora')}</p>
                      <p className="text-lg font-semibold">{liveDashboard.kpis?.responses_last_hour ?? '—'}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-background/70 p-3 transition-all duration-300 hover:shadow-sm">
                      <p className="text-xs text-muted-foreground">{textOr(liveResultsUi?.kpi_participation_per_minute_label, 'Participación por minuto')}</p>
                      <p className="text-lg font-semibold">{liveDashboard.kpis?.participation_per_minute ?? '—'}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-background/70 p-3 transition-all duration-300 hover:shadow-sm">
                      <p className="text-xs text-muted-foreground">{textOr(liveResultsUi?.kpi_heatmap_coverage_cells_label, 'Cobertura del mapa')}</p>
                      <p className="text-lg font-semibold">{liveDashboard.kpis?.heatmap_coverage_cells ?? '—'}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-background/70 p-3 transition-all duration-300 hover:shadow-sm">
                      <p className="text-xs text-muted-foreground">{textOr(liveResultsUi?.kpi_leader_label, 'Opción líder')}</p>
                      <p className="text-lg font-semibold">
                        {liveDashboard.kpis?.leader_label || toDisplayText(liveDashboard.kpis?.leader) || '—'}
                      </p>
                    </div>
                  </div>

                  {liveTimeline.length > 0 ? (
                    <div className="rounded-xl border border-border/60 bg-background/70 p-3 transition-all duration-300 hover:shadow-sm">
                      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <TrendingUp className="h-3.5 w-3.5" />
                        {textOr(liveResultsUi?.timeline_title, 'Evolución minuto a minuto')}
                      </div>
                      <div
                        className="flex h-20 items-end gap-1"
                        role="img"
                        aria-label={`${textOr(liveResultsUi?.timeline_title, 'Evolucion minuto a minuto')}: ${liveTimeline.length} puntos`}
                      >
                        {liveTimeline.slice(-60).map((item, index) => {
                          const value = Number(item.respuestas ?? item.value ?? item.total ?? 0);
                          const height = Math.max((value / liveTimelineMaxValue) * 100, 4);
                          const label = item.label ?? item.minute ?? item.timestamp ?? `Punto ${index + 1}`;
                          return (
                            <div
                              key={`${index}-${item.minute ?? item.timestamp ?? item.label ?? ''}`}
                              aria-hidden="true"
                              className="flex-1 rounded-sm bg-primary/40"
                              style={{ height: `${height}%` }}
                              title={`${label}: ${value}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {liveQuestions.length > 0 ? (
                    <div className="grid gap-3 lg:grid-cols-2">
                      {liveQuestions.map((question, qIndex) => (
                        <div key={`${question.id ?? 'question'}-${qIndex}`} className="rounded-xl border border-border/60 bg-background/70 p-3">
                          <div className="mb-2 flex items-start justify-between gap-3">
                            <p className="text-sm font-medium">{toDisplayText(question.texto ?? question.titulo)}</p>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                              {question.total_votos ?? 0} votos
                            </span>
                          </div>
                          <div className="space-y-2">
                            {(question.opciones ?? []).map((option, optionIndex) => {
                              const optionLabel = toDisplayText(option.texto ?? option.label ?? option.value) || `Opcion ${optionIndex + 1}`;
                              const optionVotes = Number(option.votos ?? 0);
                              const optionPercentage = Math.max(0, Math.min(100, Number(option.porcentaje ?? 0)));
                              return (
                              <div key={`${question.id ?? qIndex}-${option.id ?? option.value ?? option.label ?? 'option'}-${optionIndex}`} className="space-y-1">
                                <div className="flex items-center justify-between gap-3 text-xs">
                                  <span className="min-w-0 truncate">{optionLabel}</span>
                                  <span className="shrink-0" title={`${optionVotes} votos`}>
                                    {option.votos ?? 0} votos · {option.porcentaje ?? 0}%
                                  </span>
                                </div>
                                <div
                                  className="h-2 rounded-full bg-muted"
                                  role="progressbar"
                                  aria-label={`${optionLabel}: ${optionPercentage}%`}
                                  aria-valuemin={0}
                                  aria-valuemax={100}
                                  aria-valuenow={optionPercentage}
                                >
                                  <div className="h-2 rounded-full bg-primary transition-all duration-700" style={{ width: `${optionPercentage}%` }} />
                                </div>
                              </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {Number(liveRequestParams.include_heatmap ?? 1) !== 0 ? (
                    <SurveyLiveHeatmapPreview
                      heatmap={liveHeatmap}
                      aiSignal={liveDashboard.ai_signal}
                      operatorRecommendations={liveDashboard.operator_recommendations}
                      pointsLabel={textOr(liveResultsUi?.heatmap_points_label, 'Puntos')}
                      cellsLabel={textOr(liveResultsUi?.heatmap_cells_label, 'Celdas')}
                    />
                  ) : null}

                  {liveDashboard.ai_summary ? (
                    <div className="rounded-xl border border-border/60 bg-background/70 p-3 transition-all duration-300 hover:shadow-sm">
                      <p className="text-xs text-muted-foreground">{textOr(liveResultsUi?.ai_summary_title, 'Resumen automático')}</p>
                      <p className="text-sm">{toDisplayText(liveDashboard.ai_summary)}</p>
                      {liveDashboard.ai_insights?.length ? (
                        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                          {liveDashboard.ai_insights.slice(0, 3).map((insight, index) => (
                            <li key={`${index}-${insight}`}>{insight}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {shouldRevealLiveResults && !liveDashboard && (isLoadingLiveDashboard || isFetchingLiveDashboard) ? (
                <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/80 p-4 text-sm text-muted-foreground" role="status" aria-live="polite">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>{textOr(liveResultsUi?.loading_label, 'Cargando resultados en vivo...')}</span>
                </div>
              ) : null}

              {shouldRevealLiveResults && !liveDashboard && liveDashboardError && !isLoadingLiveDashboard && !isFetchingLiveDashboard ? (
                <div
                  className="flex flex-col gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between"
                  role="alert"
                  aria-live="assertive"
                >
                  <div>
                    <p className="font-medium">No pudimos cargar los resultados en vivo.</p>
                    <p className="mt-1 text-xs">{liveDashboardError}</p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => void refetchLiveDashboard()}>
                    <RefreshCw className="mr-2 h-3.5 w-3.5" />
                    Reintentar
                  </Button>
                </div>
              ) : null}

              <div className="space-y-3">
                <SurveyForm
                  survey={survey}
                  onSubmit={handleSubmit}
                  loading={isSubmitting}
                  defaultMetadata={metadata}
                  submitErrorMessage={submitError}
                  submitErrorStatus={submitStatus}
                  submitErrorDetails={submitErrorDetails}
                  submitReasonCode={submitReasonCode}
                  showHeader={false}
                  submitLabel={
                    survey.tipo === 'votacion'
                      ? textOr(votacionUi?.boton_votar, 'Enviar voto')
                      : textOr(votacionUi?.boton_enviar, 'Enviar respuesta')
                  }
                  liveResults={renderedLiveResults}
                  showLiveResults={shouldRevealLiveResults}
                />
              </div>
            </CardContent>
          </Card>

          {survey.permitir_comentarios && (
            <SurveyComments
              slug={liveSlug || slug || ''}
              tenantSlug={tenantSlug || undefined}
              realtimeComments={liveComments}
              copy={comentariosCopy}
              commentConfig={survey.commentConfig}
            />
          )}
        </div>
      ) : (
        <>
          <SurveyForm
            survey={survey}
            onSubmit={handleSubmit}
            loading={isSubmitting}
            defaultMetadata={metadata}
            submitErrorMessage={submitError}
            submitErrorStatus={submitStatus}
            submitErrorDetails={submitErrorDetails}
            submitReasonCode={submitReasonCode}
          />
          {survey.permitir_comentarios && (
            <SurveyComments
              slug={liveSlug || slug || ''}
              tenantSlug={tenantSlug || undefined}
              realtimeComments={liveComments}
              commentConfig={survey.commentConfig}
            />
          )}
        </>
      )}
      {/* If comments are allowed, do we show them during voting? Yes, usually debate influences vote or vice versa.
          YouTube shows chat alongside poll.
      */}
    </div>
  );
};

export default PublicSurveyPage;
