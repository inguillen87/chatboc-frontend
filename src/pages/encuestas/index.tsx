import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowRight, Bot, CalendarDays, Copy, Download, Loader2, MessageCircle, Share2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { listPublicSurveys } from '@/api/encuestas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from '@/components/ui/use-toast';
import { getErrorMessage } from '@/utils/api';
import type { PublicSurveyListResult } from '@/api/encuestas';
import type { SurveyPublic, SurveyTipo } from '@/types/encuestas';
import { getPublicSurveyQrUrl, getPublicSurveyUrl } from '@/utils/publicSurveyUrl';

const TIPO_LABELS: Record<SurveyTipo, string> = {
  opinion: 'Opinión',
  votacion: 'Votación',
  sondeo: 'Sondeo',
};

const formatDate = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return format(parsed, "d 'de' MMMM yyyy", { locale: es });
};

const getStatus = (survey: SurveyPublic) => {
  const now = new Date();
  const start = survey.inicio_at ? new Date(survey.inicio_at) : null;
  const end = survey.fin_at ? new Date(survey.fin_at) : null;

  if (start && Number.isNaN(start.getTime())) {
    return { label: 'Disponible', variant: 'secondary' as const };
  }
  if (end && Number.isNaN(end.getTime())) {
    return { label: 'Disponible', variant: 'secondary' as const };
  }

  if (start && now < start) {
    return { label: 'Próximamente', variant: 'secondary' as const };
  }

  if (end && now > end) {
    return { label: 'Finalizada', variant: 'outline' as const };
  }

  return { label: 'En curso', variant: 'default' as const };
};

const POSITION_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

const buildWidgetUrl = (url: string): string => {
  try {
    const target = new URL(url);
    target.searchParams.set('canal', 'widget_chat');
    return target.toString();
  } catch (error) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}canal=widget_chat`;
  }
};

const buildShareLink = (title: string, url: string): string => {
  const message = `${title}\n${url}`;
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
};

const SurveysPublicIndex = () => {
  const { data, isLoading, error, refetch, isFetching } = useQuery<PublicSurveyListResult>({
    queryKey: ['public-surveys'],
    queryFn: () => listPublicSurveys(),
    staleTime: 1000 * 60,
  });

  const hasBadPayload = Boolean(data && (data as any).__badPayload);
  const fallbackNotice =
    data && typeof (data as any).__fallbackNotice === 'string'
      ? (data as any).__fallbackNotice
      : null;
  const surveys = Array.isArray(data) ? data : [];
  const rawPayload = hasBadPayload && typeof (data as any).__raw === 'string' ? (data as any).__raw : null;
  const statusCode = hasBadPayload && typeof (data as any).__status === 'number' ? (data as any).__status : null;
  const showRawFallback = hasBadPayload && !surveys.length;

  const summary = useMemo(() => {
    const now = new Date();
    return surveys.reduce(
      (acc, survey) => {
        const start = survey.inicio_at ? new Date(survey.inicio_at) : null;
        const end = survey.fin_at ? new Date(survey.fin_at) : null;
        if (start && Number.isNaN(start.getTime())) {
          return acc;
        }
        if (end && Number.isNaN(end.getTime())) {
          return acc;
        }
        if (end && now > end) {
          acc.finished += 1;
        } else if (start && now < start) {
          acc.upcoming += 1;
        } else {
          acc.active += 1;
        }
        return acc;
      },
      { active: 0, upcoming: 0, finished: 0 },
    );
  }, [surveys]);

  const latestSurveys = useMemo(() => surveys.slice(0, 10), [surveys]);

  const aggregatedShareMessage = useMemo(() => {
    if (!latestSurveys.length) {
      return null;
    }

    const lines: string[] = ['Participá en estas encuestas ciudadanas y compartilas con tu comunidad:', ''];

    latestSurveys.forEach((survey, index) => {
      const participationUrl = getPublicSurveyUrl(survey.slug);
      if (!participationUrl) {
        return;
      }

      const position = POSITION_EMOJIS[index] ?? `${index + 1}.`;
      lines.push(`${position} ${survey.titulo}`);
      if (survey.descripcion) {
        lines.push(`   ${survey.descripcion}`);
      }
      lines.push(`   👉 ${participationUrl}`);

      const widgetUrl = buildWidgetUrl(participationUrl);
      lines.push(`   💬 Widget chat: ${widgetUrl}`);

      const qrUrl = getPublicSurveyQrUrl(survey.slug, { size: 512 });
      if (qrUrl) {
        lines.push(`   🧾 QR: ${qrUrl}`);
      }

      const whatsappShare = buildShareLink(survey.titulo, participationUrl);
      lines.push(`   📲 Reenviar por WhatsApp: ${whatsappShare}`);
      lines.push('');
    });

    return lines.join('\n').trimEnd();
  }, [latestSurveys]);

  const handleShareDigestOnWhatsApp = () => {
    if (!aggregatedShareMessage) return;
    const url = `https://wa.me/?text=${encodeURIComponent(aggregatedShareMessage)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopyDigest = async () => {
    if (!aggregatedShareMessage) return;
    try {
      await navigator.clipboard.writeText(aggregatedShareMessage);
      toast({
        title: 'Resumen copiado',
        description: 'Pegalo en WhatsApp, email o redes para difundir las últimas encuestas.',
      });
    } catch (copyError) {
      toast({
        title: 'No se pudo copiar el resumen',
        description: String((copyError as Error)?.message ?? copyError),
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex min-h-[50vh] w-full max-w-2xl items-center justify-center">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-center text-lg">No pudimos cargar las encuestas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 text-center">
            <p className="text-sm text-muted-foreground">{getErrorMessage(error)}</p>
            <Button onClick={() => refetch()} disabled={isFetching}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showRawFallback) {
    return (
      <div className="mx-auto flex min-h-[50vh] w-full max-w-2xl items-center justify-center">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-center text-lg">No pudimos cargar las encuestas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 text-center">
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                El servidor devolvió un formato inesperado{statusCode ? ` (código ${statusCode})` : ''}. Intentá nuevamente en unos
                minutos.
              </p>
              {rawPayload ? (
                <div className="max-h-64 w-full overflow-auto rounded-md border bg-muted/40 p-3 text-left font-mono text-xs">
                  {rawPayload.split('\n').map((line, index) => {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('http')) {
                      return (
                        <div key={`${line}-${index}`} className="py-0.5">
                          <a
                            href={trimmed}
                            target="_blank"
                            rel="noreferrer"
                            className="break-all text-primary underline"
                          >
                            {trimmed}
                          </a>
                        </div>
                      );
                    }
                    return (
                      <div key={`${line}-${index}`} className="whitespace-pre-wrap py-0.5">
                        {line}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
            <Button onClick={() => refetch()} disabled={isFetching}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!surveys.length) {
    return (
      <div className="mx-auto flex min-h-[50vh] w-full max-w-2xl items-center justify-center">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-center text-lg">Por ahora no hay encuestas activas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-center text-sm text-muted-foreground">
            <p>Volvé más tarde para participar de las próximas instancias de consulta ciudadana.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-6">
      {fallbackNotice ? (
        <Alert className="border-amber-500/40 bg-amber-50 text-amber-900 dark:border-amber-400/50 dark:bg-amber-950/30 dark:text-amber-100">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Mostrando enlaces recuperados</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{fallbackNotice}</p>
            {statusCode ? (
              <p className="text-xs opacity-80">Código devuelto por el servidor: {statusCode}</p>
            ) : null}
            {rawPayload ? (
              <details className="text-xs">
                <summary className="cursor-pointer font-medium">Ver respuesta original</summary>
                <pre className="mt-2 max-h-32 overflow-auto rounded border bg-background/60 p-2 text-foreground/90">
                  {rawPayload}
                </pre>
              </details>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Encuestas ciudadanas</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Conocé los procesos abiertos, respondé y compartí el enlace para sumar más voces.
        </p>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border px-3 py-1">Activas: {summary.active}</span>
          <span className="rounded-full border px-3 py-1">Próximas: {summary.upcoming}</span>
          <span className="rounded-full border px-3 py-1">Finalizadas: {summary.finished}</span>
        </div>
      </header>

      {aggregatedShareMessage ? (
        <Card className="border-dashed border-primary/40 bg-primary/5 dark:bg-primary/10">
          <CardContent className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Compartir las últimas encuestas</p>
              <p className="text-xs text-muted-foreground">
                Generá un mensaje compacto con hasta 10 encuestas recientes listo para enviar por WhatsApp.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button className="inline-flex items-center gap-2" onClick={handleShareDigestOnWhatsApp}>
                <Share2 className="h-4 w-4" /> Enviar por WhatsApp
              </Button>
              <Button variant="outline" className="inline-flex items-center gap-2" onClick={handleCopyDigest}>
                <Copy className="h-4 w-4" /> Copiar resumen
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4">
        {surveys.map((survey) => {
          const status = getStatus(survey);
          const inicio = formatDate(survey.inicio_at);
          const fin = formatDate(survey.fin_at);
          const rango = inicio && fin ? `${inicio} – ${fin}` : inicio || fin || null;

          const participationPath = getPublicSurveyUrl(survey.slug, { absolute: false }) || '#';
          const participationUrl = getPublicSurveyUrl(survey.slug) || '';
          const qrUrl = getPublicSurveyQrUrl(survey.slug, { size: 512 });
          const widgetUrl = participationUrl ? buildWidgetUrl(participationUrl) : '';
          const whatsappShareUrl = participationUrl ? buildShareLink(survey.titulo, participationUrl) : '';

          const handleCopyLink = async () => {
            if (!participationUrl) return;
            try {
              await navigator.clipboard.writeText(participationUrl);
              toast({
                title: 'Enlace copiado',
                description: 'Pegalo en redes, mails o el chat para sumar más respuestas.',
              });
            } catch (error) {
              toast({
                title: 'No se pudo copiar',
                description: String((error as Error)?.message ?? error),
                variant: 'destructive',
              });
            }
          };

          const handleShareWhatsApp = () => {
            if (!participationUrl) return;
            const whatsappUrl = buildShareLink(survey.titulo, participationUrl);
            window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
          };

          return (
            <Card key={`${survey.slug}-${survey.id ?? survey.slug}`} className="overflow-hidden">
              <CardHeader className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <CardTitle className="text-2xl font-semibold leading-tight">{survey.titulo}</CardTitle>
                    {survey.descripcion && (
                      <p className="text-sm text-muted-foreground">{survey.descripcion}</p>
                    )}
                  </div>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <Badge variant="outline" className="bg-transparent font-normal capitalize tracking-wide">
                    {TIPO_LABELS[survey.tipo] ?? survey.tipo}
                  </Badge>
                  {rango && (
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-4 w-4" />
                      {rango}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4 border-t bg-muted/30 px-6 py-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Compartí esta encuesta para ampliar la participación ciudadana.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" className="inline-flex items-center gap-2" onClick={handleCopyLink}>
                        <Copy className="h-4 w-4" /> Copiar enlace
                      </Button>
                      <Button
                        variant="outline"
                        className="inline-flex items-center gap-2"
                        onClick={() => {
                          if (!widgetUrl) return;
                          navigator.clipboard
                            .writeText(widgetUrl)
                            .then(() => {
                              toast({
                                title: 'Widget listo para compartir',
                                description: 'Pegalo donde necesites para abrir el chat directo.',
                              });
                            })
                            .catch((widgetError) => {
                              console.warn('No se pudo copiar el enlace del widget', widgetError);
                              toast({
                                title: 'No se pudo copiar el enlace del widget',
                                description: String((widgetError as Error)?.message ?? widgetError),
                                variant: 'destructive',
                              });
                            });
                        }}
                      >
                        <Bot className="h-4 w-4" /> Link del widget
                      </Button>
                      <Button variant="outline" className="inline-flex items-center gap-2" onClick={handleShareWhatsApp}>
                        <MessageCircle className="h-4 w-4" /> Enviar por WhatsApp
                      </Button>
                    </div>
                    <div className="grid max-w-md gap-1 text-xs text-muted-foreground">
                      {widgetUrl ? (
                        <a
                          href={widgetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex max-w-full items-center gap-1 text-primary hover:underline"
                        >
                          <Bot className="h-3.5 w-3.5" />
                          <span className="truncate">{widgetUrl}</span>
                        </a>
                      ) : null}
                      {whatsappShareUrl ? (
                        <a
                          href={whatsappShareUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex max-w-full items-center gap-1 text-primary hover:underline"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          <span className="truncate">Compartir directo en WhatsApp</span>
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {qrUrl ? (
                      <div className="flex flex-col items-center gap-2">
                        <img
                          src={qrUrl}
                          alt={`Código QR de ${survey.titulo}`}
                          className="h-28 w-28 rounded-md border border-border bg-background p-2"
                          loading="lazy"
                        />
                        <Button variant="ghost" size="sm" asChild>
                          <a href={qrUrl} download>
                            <Download className="h-4 w-4" /> Descargar QR
                          </a>
                        </Button>
                      </div>
                    ) : null}
                    <Button asChild>
                      <Link to={participationPath} className="inline-flex items-center gap-2">
                        Participar
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default SurveysPublicIndex;
