import { RefreshCw, Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { SurveyResponseAnswer, SurveyResponseRecord } from '@/types/encuestas';

interface SurveyRecentResponsesProps {
  responses: SurveyResponseRecord[];
  loading?: boolean;
  refreshing?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  emptyHintUrl?: string | null;
}

const formatDateTime = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const extractAnswerValue = (answer: SurveyResponseAnswer) => {
  if (Array.isArray(answer.opciones) && answer.opciones.length) {
    return answer.opciones.filter(Boolean).join(', ');
  }
  const candidate = [answer.respuesta, answer.valor, answer.texto, answer.texto_libre, answer.opcion, answer.resumen].find(
    (value) => typeof value === 'string' && value.trim().length,
  );
  return candidate ? candidate.trim() : null;
};

const buildPreview = (response: SurveyResponseRecord) => {
  if (Array.isArray(response.respuestas) && response.respuestas.length) {
    const fragments = response.respuestas
      .map((answer) => {
        const value = extractAnswerValue(answer);
        if (!value) return null;
        const label = answer.pregunta?.trim();
        return label ? `${label}: ${value}` : value;
      })
      .filter((value): value is string => Boolean(value))
      .slice(0, 2);
    if (fragments.length) {
      return fragments.join(' · ');
    }
  }

  if (Array.isArray(response.resumen) && response.resumen.length) {
    const fragments = response.resumen
      .map((item) => {
        const label = item.pregunta?.trim();
        const value = item.respuesta?.trim();
        if (!value) return null;
        return label ? `${label}: ${value}` : value;
      })
      .filter((value): value is string => Boolean(value))
      .slice(0, 2);
    if (fragments.length) {
      return fragments.join(' · ');
    }
  }

  if (typeof response.resumen === 'string' && response.resumen.trim()) {
    return response.resumen.trim();
  }

  return null;
};

const renderDetails = (response: SurveyResponseRecord) => {
  if (Array.isArray(response.respuestas) && response.respuestas.length) {
    return (
      <div className="mt-2 space-y-2">
        {response.respuestas.map((answer, index) => (
          <div key={`${response.id ?? response.respuesta_id}-${index}`} className="rounded-md border border-border/40 bg-muted/30 p-2">
            <p className="text-xs font-medium text-foreground">
              {answer.pregunta || `Pregunta ${index + 1}`}
            </p>
            <p className="text-xs text-muted-foreground break-words">
              {extractAnswerValue(answer) || 'Respuesta registrada'}
            </p>
          </div>
        ))}
      </div>
    );
  }

  if (Array.isArray(response.resumen) && response.resumen.length) {
    return (
      <div className="mt-2 space-y-2">
        {response.resumen.map((item, index) => (
          <div key={`${response.id ?? response.respuesta_id}-summary-${index}`} className="rounded-md border border-border/40 bg-muted/30 p-2">
            <p className="text-xs font-medium text-foreground">{item.pregunta || `Pregunta ${index + 1}`}</p>
            <p className="text-xs text-muted-foreground break-words">{item.respuesta || 'Respuesta registrada'}</p>
          </div>
        ))}
      </div>
    );
  }

  if (typeof response.resumen === 'string' && response.resumen.trim()) {
    return <p className="mt-2 text-xs text-muted-foreground">{response.resumen.trim()}</p>;
  }

  return (
    <p className="mt-2 text-xs text-muted-foreground">
      Descargá el CSV para revisar el detalle completo de esta respuesta.
    </p>
  );
};

export const SurveyRecentResponses = ({
  responses,
  loading,
  refreshing,
  error,
  onRefresh,
  emptyHintUrl,
}: SurveyRecentResponsesProps) => (
  <Card>
    <CardHeader className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
      <div>
        <CardTitle>Últimas respuestas</CardTitle>
        <CardDescription>
          Seguimiento en tiempo real de las participaciones más recientes.
        </CardDescription>
      </div>
      {onRefresh ? (
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={Boolean(loading) || Boolean(refreshing)}
          className="inline-flex items-center gap-2"
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Actualizar
        </Button>
      ) : null}
    </CardHeader>
    <CardContent className="space-y-4">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : responses.length ? (
        <ul className="space-y-3">
          {responses.map((response, index) => {
            const key = response.id ?? response.respuesta_id ?? index;
            const displayId = typeof key === 'number' || typeof key === 'string' ? String(key) : `R-${index + 1}`;
            const timestamp =
              formatDateTime(response.respondido_at) ||
              formatDateTime(response.created_at) ||
              formatDateTime(response.creado_at) ||
              formatDateTime(response.updated_at);
            const preview = buildPreview(response);

            return (
              <li
                key={displayId}
                className="rounded-lg border border-border/60 bg-background p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">Respuesta #{displayId}</p>
                    <p className="text-xs text-muted-foreground">{timestamp || 'Fecha no disponible'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {response.canal ? (
                      <Badge variant="secondary" className="capitalize">
                        {response.canal}
                      </Badge>
                    ) : null}
                    {response.origen ? (
                      <Badge variant="outline">Origen: {response.origen}</Badge>
                    ) : null}
                    {response.utm_source ? (
                      <Badge variant="outline">UTM fuente: {response.utm_source}</Badge>
                    ) : null}
                    {response.utm_campaign ? (
                      <Badge variant="outline">UTM campaña: {response.utm_campaign}</Badge>
                    ) : null}
                  </div>
                </div>
                {preview ? (
                  <p className="mt-3 text-sm text-muted-foreground">{preview}</p>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Registramos la participación. Consultá el detalle debajo para más información.
                  </p>
                )}
                <details className="mt-3 text-xs text-muted-foreground">
                  <summary className="cursor-pointer select-none text-xs font-medium text-foreground">
                    Ver detalle de la respuesta
                  </summary>
                  {renderDetails(response)}
                </details>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {emptyHintUrl ? (
            <>
              Todavía no recibimos respuestas. Compartí el enlace{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">{emptyHintUrl}</code> o el código QR para sumar
              participación.
            </>
          ) : (
            'Todavía no registramos respuestas. Difundí el enlace público para comenzar a medir resultados.'
          )}
        </p>
      )}
    </CardContent>
  </Card>
);
