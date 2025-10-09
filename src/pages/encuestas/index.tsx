import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowRight, CalendarDays, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { listPublicSurveys } from '@/api/encuestas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getErrorMessage } from '@/utils/api';
import type { PublicSurveyListResult } from '@/api/encuestas';
import type { SurveyPublic, SurveyTipo } from '@/types/encuestas';
import { getPublicSurveyUrl } from '@/utils/publicSurveyUrl';

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

      <div className="grid gap-4">
        {surveys.map((survey) => {
          const status = getStatus(survey);
          const inicio = formatDate(survey.inicio_at);
          const fin = formatDate(survey.fin_at);
          const rango = inicio && fin ? `${inicio} – ${fin}` : inicio || fin || null;

          const participationPath = getPublicSurveyUrl(survey.slug, { absolute: false }) || '#';

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
              <CardContent className="flex flex-wrap items-center justify-between gap-4 border-t bg-muted/30 px-6 py-4">
                <span className="text-sm text-muted-foreground">
                  Compartí esta encuesta para ampliar la participación.
                </span>
                <Button asChild>
                  <Link to={participationPath} className="inline-flex items-center gap-2">
                    Participar
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default SurveysPublicIndex;
