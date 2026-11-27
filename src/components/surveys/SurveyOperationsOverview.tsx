import type {
  SurveyAdmin,
  SurveyAdminDataQuality,
  SurveyAdminExecutiveOverview,
  SurveyAdminOverview,
  SurveyListResponse,
} from '@/types/encuestas';

interface SurveyOperationsOverviewProps {
  overview: SurveyAdminOverview;
  freshness?: SurveyListResponse['freshness'];
  tenantSlug: string;
  instruments?: SurveyAdmin[];
  loadedCount?: number;
  totalCount?: number | null;
  isPartial?: boolean;
  excludedScopeCount?: number;
  confirmedConflictCount?: number;
  unverifiedScopeCount?: number;
  sourceTotalCount?: number | null;
  executiveSummary?: SurveyAdminExecutiveOverview;
  dataQuality?: SurveyAdminDataQuality;
}

export const SurveyOperationsOverview = ({ overview }: SurveyOperationsOverviewProps) => {
  const metrics = [
    {
      label: 'Encuestas y votaciones',
      value: overview.total,
    },
    {
      label: 'Abiertas ahora',
      value: overview.accepting_responses,
    },
    {
      label: 'Respuestas recibidas',
      value: overview.total_respuestas,
    },
    {
      label: 'Respuestas con ubicación',
      value: overview.respuestas_con_coordenadas,
    },
  ] as const;

  return (
    <section aria-labelledby="survey-summary-title" className="space-y-3">
      <h2 id="survey-summary-title" className="text-lg font-semibold">
        Resumen
      </h2>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map(({ label, value }) => (
          <div key={label} className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm">
            <dt className="text-sm leading-snug text-muted-foreground">{label}</dt>
            <dd className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
              {value.toLocaleString('es-AR')}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
};
