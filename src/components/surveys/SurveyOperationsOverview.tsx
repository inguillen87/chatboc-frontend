import {
  Activity,
  CheckCircle2,
  ClipboardList,
  Clock3,
  MapPinned,
  MessageSquareText,
  ShieldCheck,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

const statusLabels: Record<string, string> = {
  borrador: 'Borradores',
  publicada: 'Publicadas',
  cerrada: 'Cerradas',
  archivada: 'Archivadas',
};

const sourceLabels: Record<string, string> = {
  enc_encuesta_and_enc_respuesta: 'Encuestas y respuestas persistidas',
};

const asPercent = (numerator: number, denominator: number) =>
  denominator > 0 ? Math.round((numerator / denominator) * 100) : null;

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
  instruments,
  loadedCount,
  totalCount,
  isPartial: partialOverride,
  excludedScopeCount = 0,
  confirmedConflictCount = 0,
  unverifiedScopeCount = 0,
  sourceTotalCount,
  executiveSummary,
  dataQuality,
}: SurveyOperationsOverviewProps) => {
  const generatedAt = formatFreshness(freshness?.generated_at);
  const surveys = overview.por_tipo_instrumento.survey ?? 0;
  const votings = overview.por_tipo_instrumento.voting ?? 0;
  const loaded = loadedCount ?? overview.total;
  const knownTotal = typeof totalCount === 'number' ? totalCount : null;
  const isPartial = partialOverride ?? (knownTotal !== null && knownTotal > loaded);
  const territorialCoverage = asPercent(overview.respuestas_con_coordenadas, overview.total_respuestas);
  const loadedInstruments = instruments ?? [];
  const certificationScopeAvailable = instruments !== undefined;
  const explicitlyCertified = loadedInstruments.filter(
    (instrument) => instrument.governance?.result_certified === true,
  ).length;
  const explicitlyNotCertified = loadedInstruments.filter(
    (instrument) => instrument.governance?.result_certified === false,
  ).length;
  const certificationUnknown = Math.max(
    0,
    loadedInstruments.length - explicitlyCertified - explicitlyNotCertified,
  );
  const lifecycleTotal = Object.values(overview.por_estado).reduce((sum, value) => sum + value, 0);
  const statusRows = Object.entries(overview.por_estado)
    .filter(([, value]) => value > 0)
    .sort(([, left], [, right]) => right - left);
  const sourceLabel = freshness?.source
    ? sourceLabels[freshness.source] ?? freshness.source.replaceAll('_', ' ')
    : 'Fuente no informada';
  const serverJurisdiction = executiveSummary?.jurisdiction ?? dataQuality?.jurisdiction;
  const serverAggregationScope = executiveSummary?.aggregation_scope ?? dataQuality?.aggregation_scope;
  const serverScopeMatchesLoaded = Boolean(
    serverAggregationScope &&
    serverAggregationScope.returned_items === loaded + excludedScopeCount,
  );
  const cards = [
    {
      label: isPartial ? 'Instrumentos cargados' : 'Instrumentos',
      value: overview.total,
      detail: `${surveys} encuestas · ${votings} votaciones${isPartial
        ? knownTotal !== null
          ? ` · ${knownTotal.toLocaleString('es-AR')} registrados`
          : ' · quedan páginas pendientes'
        : ''}`,
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
      label: 'Cobertura territorial',
      value: territorialCoverage === null ? '—' : `${territorialCoverage}%`,
      detail: `${overview.respuestas_con_coordenadas.toLocaleString('es-AR')} de ${overview.total_respuestas.toLocaleString('es-AR')} respuestas con coordenadas`,
      icon: MapPinned,
    },
  ] as const;

  return (
    <section aria-labelledby="survey-operations-title" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="survey-operations-title" className="text-lg font-semibold">
            Centro ejecutivo de participación
          </h2>
          <p className="text-sm text-muted-foreground">
            {isPartial ? (
              <>
                Indicadores de alcance operativo para {loaded.toLocaleString('es-AR')} instrumentos cargados
                {knownTotal !== null
                  ? `, dentro de ${knownTotal.toLocaleString('es-AR')}`
                  : '; todavía quedan páginas pendientes'}{' '}
                en{' '}
                <span className="font-medium text-foreground">{tenantSlug}</span>.
              </>
            ) : (
              <>
                Indicadores de alcance operativo derivados de métricas persistidas en{' '}
                <span className="font-medium text-foreground">{tenantSlug}</span>.
              </>
            )}
          </p>
          {excludedScopeCount > 0 || unverifiedScopeCount > 0 ? (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              Alcance operativo: {loaded.toLocaleString('es-AR')} cargados. Se excluyen{' '}
              {confirmedConflictCount.toLocaleString('es-AR')} conflictos confirmados.{' '}
              {unverifiedScopeCount.toLocaleString('es-AR')} instrumentos sin verificar se incluyen de forma provisional
              y permanecen señalizados para revisión
              {typeof sourceTotalCount === 'number'
                ? ` dentro de ${sourceTotalCount.toLocaleString('es-AR')} registros recibidos`
                : ''}.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-muted-foreground">
          <span
            className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background px-2.5 py-1"
            title={`Fuente: ${freshness?.source ?? 'no informada'}`}
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            {freshness
              ? freshness.synthetic
                ? 'Datos sintéticos etiquetados'
                : 'Datos persistidos'
              : 'Procedencia no informada'}
          </span>
          {generatedAt ? (
            <span aria-label={`Datos actualizados ${generatedAt}`}>Actualizado {generatedAt}</span>
          ) : (
            <span>Actualización no informada</span>
          )}
          <span
            className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background px-2.5 py-1"
            title={serverScopeMatchesLoaded
              ? 'El agregado jurisdiccional del backend coincide con la página recibida.'
              : 'El alcance se recompone desde los contratos cargados por instrumento.'}
          >
            <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            {serverScopeMatchesLoaded ? 'Alcance backend validado' : 'Alcance de página cargada'}
          </span>
        </div>
      </div>

      {serverJurisdiction && serverScopeMatchesLoaded ? (
        <div
          role="status"
          aria-label="Resumen jurisdiccional de la página recibida"
          className="grid gap-2 rounded-xl border border-border/70 bg-muted/20 p-3 text-xs sm:grid-cols-3"
        >
          <p>
            <span className="font-semibold tabular-nums text-foreground">
              {serverJurisdiction.compatible.toLocaleString('es-AR')}
            </span>{' '}
            compatibles
          </p>
          <p>
            <span className="font-semibold tabular-nums text-foreground">
              {serverJurisdiction.conflict.toLocaleString('es-AR')}
            </span>{' '}
            conflictos confirmados
          </p>
          <p>
            <span className="font-semibold tabular-nums text-foreground">
              {serverJurisdiction.unverified.toLocaleString('es-AR')}
            </span>{' '}
            pendientes de verificar
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, detail, icon: Icon }) => (
          <Card key={label} className="border-border/70 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">
                {typeof value === 'number' ? value.toLocaleString('es-AR') : value}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.15fr_1fr_1fr]">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Cartera por estado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {statusRows.length ? statusRows.map(([status, count]) => {
              const percentage = asPercent(count, lifecycleTotal) ?? 0;
              return (
                <div key={status} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span>{statusLabels[status] ?? status}</span>
                    <span className="font-semibold tabular-nums">
                      {count.toLocaleString('es-AR')} · {percentage}%
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={`${statusLabels[status] ?? status}: ${count} de ${lifecycleTotal}`}
                    aria-valuemin={0}
                    aria-valuemax={lifecycleTotal || 1}
                    aria-valuenow={count}
                    className="h-2 overflow-hidden rounded-full bg-muted"
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            }) : (
              <p className="text-sm text-muted-foreground">No hay estados persistidos para resumir.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Pulso operativo</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border/70 text-sm">
              <div className="flex items-center justify-between gap-3 py-2 first:pt-0">
                <dt className="inline-flex items-center gap-2 text-muted-foreground">
                  <Clock3 className="h-4 w-4" aria-hidden="true" /> Últimas 24 h
                </dt>
                <dd className="font-semibold tabular-nums">
                  {overview.respuestas_ultimas_24h.toLocaleString('es-AR')}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2">
                <dt className="inline-flex items-center gap-2 text-muted-foreground">
                  <Activity className="h-4 w-4" aria-hidden="true" /> Con participación
                </dt>
                <dd className="font-semibold tabular-nums">
                  {overview.con_respuestas.toLocaleString('es-AR')}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3 py-2 last:pb-0">
                <dt className="inline-flex items-center gap-2 text-muted-foreground">
                  <MapPinned className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> Evidencia territorial
                </dt>
                <dd className="text-right font-semibold">
                  {territorialCoverage === null ? 'Sin respuestas' : `${territorialCoverage}% georreferenciado`}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="inline-flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
              Alcance y certificación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              {!certificationScopeAvailable
                ? 'El contrato de certificación no está disponible en este resumen.'
                : explicitlyCertified > 0
                ? `${explicitlyCertified.toLocaleString('es-AR')} instrumentos informan resultado certificado en su contrato.`
                : 'Ningún instrumento cargado informa un resultado certificado.'}
            </p>
            {certificationScopeAvailable && explicitlyNotCertified > 0 ? (
              <p className="text-xs text-muted-foreground">
                {explicitlyNotCertified.toLocaleString('es-AR')} declarados como no certificados.
              </p>
            ) : null}
            {certificationScopeAvailable && certificationUnknown > 0 ? (
              <p className="text-xs text-muted-foreground">
                {certificationUnknown.toLocaleString('es-AR')} sin alcance de certificación en este resumen.
              </p>
            ) : null}
            <p className="rounded-lg border border-dashed border-border px-2.5 py-2 text-xs text-muted-foreground">
              Este centro no presenta sondeos o votaciones como elecciones oficiales. La gobernanza se revisa por instrumento.
            </p>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Fuente:</span> {sourceLabel}. Los indicadores operativos se
        construyen con instrumentos compatibles y, cuando existen, registros sin verificación marcados como provisionales;
        los conflictos confirmados quedan fuera.
        {dataQuality ? ' El contrato de calidad del backend fue validado para la página recibida.' : ''}
      </p>

      {!overview.participation_denominator.available ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          Participación porcentual y abstención no se calculan cuando los instrumentos no tienen una población
          elegible configurada. El panel no infiere esos valores a partir de las respuestas.
        </p>
      ) : null}
    </section>
  );
};
