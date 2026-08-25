import { useMemo, useState } from 'react';
import { BarChart3, CheckCircle2, Gauge, Medal, Users } from 'lucide-react';

import { formatDemoPresentationLabel } from '@/features/demo/demoPresentationLabels';

const NUMBER_FORMATTER = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });

export interface ExecutiveSurveyOption {
  id: string;
  label: string;
  count: number;
  percentage: number;
}

export interface ExecutiveSurveySegment {
  key: string;
  items: Array<{
    id: string;
    label: string;
    count: number;
  }>;
}

export interface ExecutiveSurveyItem {
  id: string;
  title: string;
  description: string | null;
  question: string | null;
  status: string | null;
  totalResponses: number;
  seededResponses: number | null;
  interactiveDemoResponses: number | null;
  verifiedCitizenResponses: number | null;
  hasPartitionedDemoComposition: boolean;
  options: ExecutiveSurveyOption[];
  segments: ExecutiveSurveySegment[];
  segmentScope: string | null;
  isSynthetic: boolean;
  publicPagePath: string | null;
}

export interface ExecutiveSurveyVoting {
  title: string;
  description: string | null;
  totalAvailable: number;
  realPeople: boolean;
  items: ExecutiveSurveyItem[];
}

interface ExecutiveSurveyPanelProps {
  surveyVoting: ExecutiveSurveyVoting | null;
  inventoryLabel: string | null;
  fallbackTitle: string;
  fallbackDescription?: string;
}

const SEGMENT_LABELS: Record<string, string> = {
  canal: 'Canal',
  genero: 'Género',
  rango_edad: 'Edad',
  zona: 'Zona',
};

const segmentTitle = (key: string) => SEGMENT_LABELS[key] ?? formatDemoPresentationLabel(key);

const segmentValueLabel = (value: string) => {
  const normalized = value.trim().toLowerCase();
  const known: Record<string, string> = {
    whatsapp: 'WhatsApp',
    widget_chat: 'Chat web',
    web: 'Web',
    mujer: 'Mujer',
    varon: 'Varón',
    otro_prefiere_no_decir: 'Otro / prefiere no decir',
  };
  return known[normalized] ?? formatDemoPresentationLabel(value);
};

const ExecutiveMetric = ({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) => (
  <div className="min-w-0 rounded-xl border border-border/60 bg-card/70 px-3 py-3 shadow-sm">
    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
    <p className="mt-1 truncate text-lg font-bold tabular-nums text-foreground" title={value}>{value}</p>
    <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{detail}</p>
  </div>
);

const ExecutiveSurveyCard = ({ survey }: { survey: ExecutiveSurveyItem }) => {
  const rankedOptions = useMemo(
    () => [...survey.options].sort((left, right) => right.percentage - left.percentage || right.count - left.count),
    [survey.options],
  );
  const [activeSegmentKey, setActiveSegmentKey] = useState(() => survey.segments[0]?.key ?? null);
  const activeSegment = survey.segments.find((segment) => segment.key === activeSegmentKey) ?? survey.segments[0] ?? null;
  const leader = rankedOptions[0] ?? null;
  const runnerUp = rankedOptions[1] ?? null;
  const margin = leader && runnerUp ? Math.max(0, leader.percentage - runnerUp.percentage) : null;
  const optionCountTotal = survey.options.reduce((sum, option) => sum + option.count, 0);
  const distributionIsComplete = Math.abs(optionCountTotal - survey.totalResponses) < 0.001;
  const maxSegmentCount = activeSegment
    ? Math.max(...activeSegment.items.map((item) => item.count), 1)
    : 1;
  const activeSegmentTotal = activeSegment
    ? activeSegment.items.reduce((sum, item) => sum + item.count, 0)
    : 0;

  return (
    <article className="overflow-hidden rounded-2xl border border-border/70 bg-background/80 shadow-sm" data-demo-executive-survey>
      <div className="border-b border-border/60 bg-gradient-to-br from-primary/[0.07] via-background to-background p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              {formatDemoPresentationLabel(survey.status || 'Encuesta publicada')}
            </p>
            <h4 className="mt-1 text-base font-bold leading-6 text-foreground">{survey.title}</h4>
            {survey.description ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{survey.description}</p> : null}
          </div>
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
            survey.isSynthetic
              ? 'border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-200'
              : 'border-primary/25 bg-primary/10 text-primary'
          }`}>
            {survey.totalResponses} {survey.hasPartitionedDemoComposition
              ? 'respuestas demo'
              : survey.isSynthetic
                ? 'respuestas sintéticas'
                : 'respuestas'}
          </span>
        </div>

        {survey.hasPartitionedDemoComposition ? (
          <div
            className="mt-3 rounded-xl border border-primary/15 bg-background/75 px-3 py-2 text-xs leading-5 text-foreground"
            role="note"
            aria-label={`Composición de respuestas de ${survey.title}`}
            data-demo-survey-composition
          >
            <span className="font-semibold">Composición verificable · </span>
            <span className="tabular-nums">
              {survey.seededResponses} base sintética + {survey.interactiveDemoResponses} participaciones demo = {survey.totalResponses} total
            </span>
            <span className="block text-foreground">0 respuestas ciudadanas verificadas.</span>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 p-4 sm:p-5">
        {survey.question ? (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Pregunta analizada</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-foreground">{survey.question}</p>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2" data-demo-survey-executive-summary>
          <ExecutiveMetric
            label="Respuestas"
            value={NUMBER_FORMATTER.format(survey.totalResponses)}
            detail="volumen registrado"
          />
          <ExecutiveMetric
            label="Opción principal"
            value={leader?.label ?? 'Sin resultado'}
            detail={leader ? `${NUMBER_FORMATTER.format(leader.percentage)}% de las respuestas` : 'sin distribución publicada'}
          />
          <ExecutiveMetric
            label="Brecha 1° / 2°"
            value={margin === null ? 'No calculable' : `${NUMBER_FORMATTER.format(margin)} p.p.`}
            detail={runnerUp ? `frente a ${runnerUp.label}` : 'requiere al menos dos opciones'}
          />
          <ExecutiveMetric
            label="Universo convocado"
            value="No informado"
            detail="no se calcula tasa de participación"
          />
        </div>

        <section aria-label={`Distribución de respuestas de ${survey.title}`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" aria-hidden="true" />
              <h5 className="text-xs font-bold uppercase tracking-[0.12em] text-foreground">Distribución de respuestas</h5>
            </div>
            <span className="text-[10px] font-medium text-muted-foreground">Ordenada por resultado</span>
          </div>
          <div className="grid gap-3">
            {rankedOptions.length ? (
              rankedOptions.map((option, index) => (
                <div key={option.id} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2">
                  <span className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                    index === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`} aria-label={`Puesto ${index + 1}`}>
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                      <span className="truncate font-semibold text-foreground" title={option.label}>{option.label}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {NUMBER_FORMATTER.format(option.count)} · <strong className="font-semibold text-foreground">{NUMBER_FORMATTER.format(option.percentage)}%</strong>
                      </span>
                    </div>
                    <div
                      className="h-2.5 overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-label={`${option.label}: ${NUMBER_FORMATTER.format(option.percentage)} %`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(option.percentage)}
                    >
                      <div
                        className={`h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${
                          index === 0 ? 'bg-primary' : 'bg-primary/45'
                        }`}
                        style={{ width: `${option.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-dashed bg-muted/10 px-3 py-4 text-xs leading-5 text-muted-foreground">
                La encuesta está publicada, pero la API todavía no entregó una distribución de resultados. No se completan valores estimados.
              </p>
            )}
          </div>
          {!distributionIsComplete && survey.options.length ? (
            <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] leading-4 text-amber-900 dark:text-amber-100">
              La suma de las opciones no coincide con el total informado; se muestra el contrato recibido sin completar respuestas faltantes.
            </p>
          ) : null}
        </section>

        {leader && margin !== null ? (
          <div className="flex items-start gap-3 rounded-xl border border-primary/15 bg-primary/[0.04] px-3 py-3">
            <Medal className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <p className="text-xs leading-5 text-foreground">
              <span className="font-semibold">Lectura del escenario: </span>
              {leader.label} encabeza la distribución con {NUMBER_FORMATTER.format(leader.percentage)}%, una diferencia de {NUMBER_FORMATTER.format(margin)} puntos porcentuales sobre {runnerUp?.label}.
            </p>
          </div>
        ) : null}

        {survey.segments.length ? (
          <section className="rounded-xl border border-border/60 bg-muted/[0.12] p-3" aria-label={`Cortes descriptivos de ${survey.title}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-foreground">Cortes descriptivos</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Distribución de respuestas por dimensión informada.</p>
              </div>
              <div className="flex flex-wrap gap-1" role="group" aria-label="Seleccionar dimensión">
                {survey.segments.map((segment) => {
                  const active = segment.key === activeSegment?.key;
                  return (
                    <button
                      key={segment.key}
                      type="button"
                      aria-pressed={active}
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        active
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={() => setActiveSegmentKey(segment.key)}
                    >
                      {segmentTitle(segment.key)}
                    </button>
                  );
                })}
              </div>
            </div>
            {activeSegment ? (
              <div className="mt-3 grid gap-2">
                {[...activeSegment.items]
                  .sort((left, right) => right.count - left.count)
                  .map((item) => {
                    const share = activeSegmentTotal > 0 ? (item.count / activeSegmentTotal) * 100 : 0;
                    return (
                      <div key={item.id} className="grid grid-cols-[minmax(6rem,0.9fr)_minmax(5rem,1.1fr)_auto] items-center gap-2 text-[11px]">
                        <span className="truncate font-medium text-foreground" title={segmentValueLabel(item.label)}>{segmentValueLabel(item.label)}</span>
                        <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <span
                            className="block h-full rounded-full bg-primary/55"
                            style={{ width: `${Math.min(100, (item.count / maxSegmentCount) * 100)}%` }}
                          />
                        </span>
                        <span className="w-16 text-right tabular-nums text-muted-foreground">{item.count} · {NUMBER_FORMATTER.format(share)}%</span>
                      </div>
                    );
                  })}
              </div>
            ) : null}
            {survey.segmentScope === 'seeded_synthetic_responses_only' ? (
              <p className="mt-3 text-[10px] leading-4 text-muted-foreground">
                Segmentación calculada exclusivamente sobre la base sintética del escenario.
              </p>
            ) : null}
          </section>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
          <div className="flex items-center gap-1.5 text-[10px] leading-4 text-muted-foreground">
            {survey.verifiedCitizenResponses === 0 ? (
              <><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> 0 respuestas ciudadanas verificadas</>
            ) : (
              <><Gauge className="h-3.5 w-3.5" aria-hidden="true" /> Volumen sin denominador poblacional</>
            )}
          </div>
          {survey.publicPagePath ? (
            <a
              href={survey.publicPagePath}
              className="inline-flex rounded-full border border-primary/25 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Abrir encuesta demo
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
};

const ExecutiveSurveyPanel = ({
  surveyVoting,
  inventoryLabel,
  fallbackTitle,
  fallbackDescription,
}: ExecutiveSurveyPanelProps) => {
  const totalVisibleResponses = surveyVoting?.items.reduce((sum, survey) => sum + survey.totalResponses, 0) ?? 0;
  const allCitizenCountsKnown = Boolean(
    surveyVoting?.items.length && surveyVoting.items.every((survey) => survey.verifiedCitizenResponses !== null),
  );
  const verifiedCitizenResponses = allCitizenCountsKnown
    ? surveyVoting?.items.reduce((sum, survey) => sum + (survey.verifiedCitizenResponses ?? 0), 0) ?? 0
    : null;

  return (
    <section className="grid gap-3" aria-labelledby="demo-surveys-title" data-demo-survey-voting>
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-background/75 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 p-4 sm:p-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Participación ciudadana</p>
                <h3 id="demo-surveys-title" className="mt-0.5 text-base font-bold text-foreground">
                  {surveyVoting?.title || fallbackTitle}
                </h3>
              </div>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              {surveyVoting?.description || fallbackDescription ||
                'Resultados separados por fuente para demostrar votaciones y analítica sin presentarlos como información oficial.'}
            </p>
          </div>
          {surveyVoting ? (
            <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:text-amber-200">
              {inventoryLabel}
            </span>
          ) : null}
        </div>

        {surveyVoting?.items.length ? (
          <div className="grid grid-cols-2 gap-px bg-border/60 sm:grid-cols-4" aria-label="Resumen de encuestas visibles">
            <div className="bg-background px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Encuestas visibles</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{surveyVoting.items.length}</p>
            </div>
            <div className="bg-background px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Respuestas visibles</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{NUMBER_FORMATTER.format(totalVisibleResponses)}</p>
            </div>
            <div className="bg-background px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Ciudadanas verificadas</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
                {verifiedCitizenResponses === null ? 'No informado' : NUMBER_FORMATTER.format(verifiedCitizenResponses)}
              </p>
            </div>
            <div className="bg-background px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Tasa de participación</p>
              <p className="mt-1 text-sm font-bold text-foreground">Sin denominador</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">universo no informado</p>
            </div>
          </div>
        ) : null}

        {surveyVoting && surveyVoting.realPeople === false ? (
          <div className="border-t border-amber-500/20 bg-amber-500/[0.08] px-4 py-3 text-xs leading-5 text-foreground" role="note">
            Base sintética determinística: las respuestas no pertenecen a personas reales ni representan opinión pública municipal.
          </div>
        ) : null}
      </div>

      {surveyVoting?.items.length ? (
        <div className="grid gap-3 2xl:grid-cols-2">
          {surveyVoting.items.map((survey) => <ExecutiveSurveyCard key={survey.id} survey={survey} />)}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 p-6 text-center">
          <BarChart3 className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-foreground">Sin encuestas publicadas en este contrato</p>
          <p className="mx-auto mt-1 max-w-xl text-xs leading-5 text-muted-foreground">
            El backend no devolvió resultados para el escenario seleccionado. El panel queda vacío de forma explícita y no genera métricas sustitutas.
          </p>
        </div>
      )}
    </section>
  );
};

export default ExecutiveSurveyPanel;
