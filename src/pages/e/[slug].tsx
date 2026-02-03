import { useCallback, useMemo, useState, useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Loader2, MessageSquareText, Timer, Users } from 'lucide-react';

import { SurveyForm } from '@/components/surveys/SurveyForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useSurveyPublic } from '@/hooks/useSurveyPublic';
import type { PublicResponsePayload, SurveyComment, SurveyLiveResults } from '@/types/encuestas';
import { toast } from '@/components/ui/use-toast';
import { ApiError } from '@/utils/api';
import { usePageMetadata } from '@/hooks/usePageMetadata';
import { PublicSurveyShareActions } from '@/components/surveys/PublicSurveyShareActions';
import { trackSurveySubmission } from '@/utils/surveyAnalytics';
import { useSurveySocket } from '@/hooks/useSurveySocket';
import { SurveyComments, type SurveyCommentsCopy } from '@/components/surveys/SurveyComments';

const PublicSurveyPage = () => {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const tenantSlug = searchParams.get('tenant');
  const mode = searchParams.get('mode'); // 'embed' or undefined
  const [submitted, setSubmitted] = useState(false);
  const [livePollTotalVotes, setLivePollTotalVotes] = useState<number | null>(null);
  const [lastSubmission, setLastSubmission] = useState<PublicResponsePayload | null>(null);
  const {
    survey,
    isLoading,
    error,
    submit,
    isSubmitting,
    submitError,
    duplicateDetected,
    submitStatus,
  } = useSurveyPublic(slug, { tenantSlug });

  const [liveResults, setLiveResults] = useState<SurveyLiveResults | undefined>(undefined);
  const [liveComments, setLiveComments] = useState<SurveyComment[]>([]);

  // Sync initial live results from survey data
  useEffect(() => {
    if (survey?.resultados_envivo) {
        setLiveResults(survey.resultados_envivo);
    }
  }, [survey?.resultados_envivo]);

  // Handle Socket.IO connection
  useSurveySocket({
      slug: slug || '',
      enabled: Boolean(survey?.mostrar_resultados_envivo || survey?.permitir_comentarios),
      onUpdate: (data) => {
          setLiveResults(data);
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
    image: '/images/og-encuestas.svg',
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

  const handleSubmit = useCallback(
    async (payload: PublicResponsePayload) => {
      try {
        const finalPayload: PublicResponsePayload = { ...payload, ...metadata };
        await submit(finalPayload);
        setLastSubmission(finalPayload);
        setSubmitted(true);
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
        if (err instanceof ApiError && err.status === 409) {
          toast({
            title: safeText(votacionMessages?.toast_duplicate_title),
            description: safeText(votacionMessages?.toast_duplicate_detail),
          });
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        toast({
          title: safeText(votacionMessages?.toast_error_title),
          description: submitError ?? message ?? safeText(votacionMessages?.toast_error_detail),
          variant: 'destructive',
        });
      }
    },
    [metadata, submit, survey, submitError],
  );

  const handleReset = useCallback(() => {
    setSubmitted(false);
    setLastSubmission(null);
  }, []);

  // Embed Mode Styles
  const containerClass = mode === 'embed' ? "w-full min-h-screen bg-background" : "mx-auto w-full max-w-3xl py-10";

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !survey) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl items-center justify-center">
        <Card className="w-full">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-lg font-medium">No pudimos cargar esta encuesta.</p>
            <p className="text-sm text-muted-foreground">{error || 'El enlace puede estar vencido o no existe.'}</p>
            {mode !== 'embed' && (
                <Button asChild>
                <Link to="/">Volver al inicio</Link>
                </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const votingOptionsCount = useMemo(() => {
    const question = survey?.preguntas?.[0];
    return question?.opciones?.length ?? 0;
  }, [survey?.preguntas]);

  const totalVotes = useMemo(() => {
    if (!survey) return null;
    if (survey?.resultados_envivo?.total_respuestas) {
      return survey.resultados_envivo.total_respuestas;
    }
    if (typeof liveResults?.total_respuestas === 'number') {
      return liveResults.total_respuestas;
    }
    if (survey?.resultados_envivo?.preguntas) {
      const question = Object.values(survey.resultados_envivo.preguntas)[0];
      if (question?.opciones?.length) {
        return question.opciones.reduce((acc, curr) => acc + curr.votos, 0);
      }
    }
    return null;
  }, [survey, liveResults]);

  useEffect(() => {
    if (typeof totalVotes === 'number') {
      setLivePollTotalVotes(totalVotes);
    }
  }, [totalVotes]);

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

  const isClosed = Boolean(survey?.estado === 'cerrada' || survey?.status === 'closed');
  const closedMessage =
    (survey?.recursos as Record<string, unknown> | undefined)?.mensaje_cierre ??
    (survey as Record<string, unknown> | undefined)?.mensaje_cierre ??
    (survey as Record<string, unknown> | undefined)?.mensaje_institucional ??
    null;

  if (submitted && survey) {
    return (
      <div className={containerClass}>
        <Card className="w-full border-none shadow-none sm:border sm:shadow-sm">
          <CardContent className="flex flex-col items-center gap-6 py-12 text-center">
            <div className="space-y-3 max-w-xl">
              <h1 className="text-2xl font-semibold">{safeText(votacionMessages?.titulo_gracias)}</h1>
              {survey.puntos_recompensa ? (
                <p className="text-lg font-bold text-primary animate-pulse">
                  {safeText(votacionMessages?.puntos_label)} {survey.puntos_recompensa}
                </p>
              ) : null}
              <p className="text-muted-foreground">{safeText(votacionMessages?.detalle_gracias)}</p>
            </div>

            {/* Show Results Here if enabled */}
            {survey.mostrar_resultados_envivo && (
              <div className="w-full max-w-xl text-left border rounded-xl p-6 bg-accent/10">
                <h3 className="mb-4 font-semibold text-lg">{safeText(votacionUi?.resultados_titulo)}</h3>
                <SurveyForm
                  survey={survey}
                  onSubmit={async () => {}}
                  loading={false}
                  liveResults={liveResults}
                  showLiveResults={true}
                  readOnly={true}
                  showHeader={false}
                  submitLabel={safeText(votacionUi?.resultados_boton)}
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
                  <Link to="/">{safeText(votacionUi?.volver_inicio)}</Link>
                </Button>
              )}
              <Button variant="outline" onClick={handleReset}>
                {safeText(votacionUi?.volver_encuesta)}
              </Button>
            </div>

            {survey.permitir_comentarios && (
              <SurveyComments
                slug={slug || ''}
                tenantSlug={tenantSlug || undefined}
                realtimeComments={liveComments}
                copy={comentariosCopy}
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
                liveResults={liveResults}
                showLiveResults={true}
                readOnly={true}
                showHeader={false}
                submitLabel={safeText(votacionUi?.resultados_finales_boton)}
                variant="votacion"
              />
            </div>
            {survey.permitir_comentarios && (
              <SurveyComments
                slug={slug || ''}
                tenantSlug={tenantSlug || undefined}
                realtimeComments={liveComments}
                copy={comentariosCopy}
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
                liveResults={liveResults}
                showLiveResults={true}
                readOnly={true}
                showHeader={false}
                submitLabel="Resultados finales"
                variant="votacion"
              />
            </div>
            {survey.permitir_comentarios && (
              <SurveyComments
                slug={slug || ''}
                tenantSlug={tenantSlug || undefined}
                realtimeComments={liveComments}
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
        <div className="space-y-6">
          <Card className="border border-border/60 bg-gradient-to-br from-background via-background to-primary/5">
            <CardContent className="space-y-6 px-6 py-8 sm:px-8">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-600">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    {safeText(votacionUi?.badge_en_vivo)}
                  </span>
                  {survey?.recursos?.demoMode ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600">
                      {safeText(votacionUi?.badge_demo)}
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
                <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/70 px-4 py-3">
                  <Users className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">{safeText(votacionUi?.stat_total_label)}</p>
                    <p className="text-lg font-semibold">{livePollTotalVotes ?? '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/70 px-4 py-3">
                  <Timer className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">{safeText(votacionUi?.stat_tiempo_label)}</p>
                    <p className="text-lg font-semibold">
                      {survey.fin_at ? new Date(survey.fin_at).toLocaleString() : '—'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/70 px-4 py-3">
                  <MessageSquareText className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">{safeText(votacionUi?.stat_opciones_label)}</p>
                    <p className="text-lg font-semibold">{votingOptionsCount || '—'}</p>
                  </div>
                </div>
              </div>

              {mode !== 'embed' && (
                <div className="flex justify-start">
                  <PublicSurveyShareActions survey={survey} submission={lastSubmission} />
                </div>
              )}

              <div className="space-y-3">
                <SurveyForm
                  survey={survey}
                  onSubmit={handleSubmit}
                  loading={isSubmitting}
                  defaultMetadata={metadata}
                  submitErrorMessage={submitError}
                  submitErrorStatus={submitStatus}
                  duplicateDetected={duplicateDetected}
                  showHeader={false}
                  submitLabel={
                    survey.tipo === 'votacion'
                      ? safeText(votacionUi?.boton_votar)
                      : safeText(votacionUi?.boton_enviar)
                  }
                  liveResults={liveResults}
                  showLiveResults={Boolean(survey.mostrar_resultados_envivo)}
                />
              </div>
            </CardContent>
          </Card>

          {survey.permitir_comentarios && (
            <SurveyComments
              slug={slug || ''}
              tenantSlug={tenantSlug || undefined}
              realtimeComments={liveComments}
              copy={comentariosCopy}
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
            duplicateDetected={duplicateDetected}
          />
          {survey.permitir_comentarios && (
            <SurveyComments
              slug={slug || ''}
              tenantSlug={tenantSlug || undefined}
              realtimeComments={liveComments}
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
