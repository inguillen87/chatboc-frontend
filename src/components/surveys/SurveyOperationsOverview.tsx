import { Activity, ClipboardList, Clock3, MessageSquareText } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SurveyAdminOverview, SurveyListResponse } from '@/types/encuestas';

interface SurveyOperationsOverviewProps {
  overview: SurveyAdminOverview;
  freshness?: SurveyListResponse['freshness'];
  tenantSlug: string;
}

const formatFreshness = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(parsed);
};

export const SurveyOperationsOverview = ({
  overview,
  freshness,
  tenantSlug,
}: SurveyOperationsOverviewProps) => {
  const generatedAt = formatFreshness(freshness?.generated_at);
  const surveys = overview.por_tipo_instrumento.survey ?? 0;
  const votings = overview.por_tipo_instrumento.voting ?? 0;
  const cards = [
    {
      label: 'Instrumentos',
      value: overview.total,
      detail: `${surveys} encuestas · ${votings} votaciones`,
      icon: ClipboardList,
    },
    {
      label: 'Recibiendo ahora',
      value: overview.accepting_responses,
      detail: 'Según estado y ventana vigente',
      icon: Activity,
    },
    {
      label: 'Respuestas acumuladas',
      value: overview.total_respuestas,
      detail: `${overview.con_respuestas} instrumentos con participación`,
      icon: MessageSquareText,
    },
    {
      label: 'Últimas 24 h',
      value: overview.respuestas_ultimas_24h,
      detail: 'Respuestas persistidas',
      icon: Clock3,
    },
  ] as const;

  return (
    <section aria-labelledby="survey-operations-title" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="survey-operations-title" className="text-lg font-semibold">
            Estado operativo
          </h2>
          <p className="text-sm text-muted-foreground">
            Métricas persistidas del tenant <span className="font-medium text-foreground">{tenantSlug}</span>.
          </p>
        </div>
        {generatedAt ? (
          <p className="text-xs text-muted-foreground" aria-label={`Datos actualizados ${generatedAt}`}>
            Actualizado {generatedAt}
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, detail, icon: Icon }) => (
          <Card key={label} className="border-border/70 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">{value.toLocaleString('es-AR')}</p>
              <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {!overview.participation_denominator.available ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          Participación porcentual y abstención no se calculan porque este instrumento no tiene una población
          elegible configurada. El panel no infiere esos valores a partir de las respuestas.
        </p>
      ) : null}
    </section>
  );
};
