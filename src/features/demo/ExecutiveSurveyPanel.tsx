import { useEffect, useId, useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';

import {
  cleanDemoText,
  formatDemoPresentationLabel,
  isDemoDisclaimerBoilerplate,
} from '@/features/demo/demoPresentationLabels';

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

const rankSurveyOptions = (survey: ExecutiveSurveyItem) => (
  [...survey.options].sort((left, right) => right.percentage - left.percentage || right.count - left.count)
);

const getInitialSurvey = (surveys: ExecutiveSurveyItem[]) => surveys.reduce<ExecutiveSurveyItem | null>(
  (currentLeader, survey) => (
    currentLeader === null || survey.totalResponses > currentLeader.totalResponses ? survey : currentLeader
  ),
  null,
);

const surveyControlId = (instanceId: string, surveyId: string, index: number) => (
  `${instanceId}-survey-trigger-${index}-${surveyId.replace(/[^a-zA-Z0-9_-]/g, '-')}`
);

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

const cleanSurveyTitle = (title: string) => cleanDemoText(title) || title;

const ExecutiveSurveyResultView = ({
  survey,
  detailPanelId,
  labelledById,
}: {
  survey: ExecutiveSurveyItem;
  detailPanelId: string;
  labelledById: string;
}) => {
  const rankedOptions = useMemo(() => rankSurveyOptions(survey), [survey.options]);
  const [activeSegmentKey, setActiveSegmentKey] = useState<string | null>(() => survey.segments[0]?.key ?? null);

  useEffect(() => {
    setActiveSegmentKey((current) =>
      survey.segments.some((segment) => segment.key === current)
        ? current
        : (survey.segments[0]?.key ?? null),
    );
  }, [survey.id, survey.segments]);

  const activeSegment =
    survey.segments.find((segment) => segment.key === activeSegmentKey) ?? survey.segments[0] ?? null;
  const leader = rankedOptions[0] ?? null;
  const runnerUp = rankedOptions[1] ?? null;
  const margin = leader && runnerUp ? Math.max(0, leader.percentage - runnerUp.percentage) : null;
  const title = cleanSurveyTitle(survey.title);
  const cleanDescription =
    survey.description && !isDemoDisclaimerBoilerplate(survey.description)
      ? cleanDemoText(survey.description)
      : '';
  const maxSegmentCount = activeSegment
    ? Math.max(...activeSegment.items.map((item) => item.count), 1)
    : 1;
  const activeSegmentTotal = activeSegment
    ? activeSegment.items.reduce((sum, item) => sum + item.count, 0)
    : 0;
  const segmentsHeadingId = useId();

  return (
    <div
      id={detailPanelId}
      role="region"
      aria-labelledby={labelledById}
      className="space-y-6"
    >
      <article
        className="rounded-[12px] border border-border bg-card p-5 sm:p-6"
        data-demo-executive-survey
      >
        <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <h3 className="chatboc-display mt-1.5 text-xl font-bold leading-snug text-foreground sm:text-2xl">
              {survey.question || title}
            </h3>
            {cleanDescription ? (
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{cleanDescription}</p>
            ) : null}
          </div>
          {survey.publicPagePath ? (
            <a
              href={survey.publicPagePath}
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-[8px] bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Votar en esta encuesta
            </a>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <p className="text-muted-foreground">
            <strong className="font-semibold tabular-nums text-foreground">
              {NUMBER_FORMATTER.format(survey.totalResponses)}
            </strong>{' '}
            {survey.totalResponses === 1 ? 'respuesta' : 'respuestas'}
            {leader ? (
              <>
                {' — '}
                <strong className="font-semibold text-foreground">{leader.label}</strong> lidera con{' '}
                <strong className="font-semibold tabular-nums text-foreground">
                  {NUMBER_FORMATTER.format(leader.percentage)}%
                </strong>
                {margin !== null && runnerUp
                  ? ` (+${NUMBER_FORMATTER.format(margin)} p.p. sobre ${runnerUp.label})`
                  : ''}
              </>
            ) : null}
          </p>
        </div>

        <section
          className="mt-5"
          aria-label={`Resultados de ${title}`}
          data-demo-survey-bars
        >
          {rankedOptions.length ? (
            <ol className="space-y-4">
              {rankedOptions.map((option, index) => (
                <li key={`option-slot-${index}`}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                    <span className={`min-w-0 truncate ${index === 0 ? 'font-semibold text-foreground' : 'font-medium text-foreground'}`} title={option.label}>
                      {option.label}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {NUMBER_FORMATTER.format(option.count)}
                      <strong className="ml-2 font-semibold text-foreground">
                        {NUMBER_FORMATTER.format(option.percentage)}%
                      </strong>
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
                      className={`h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none ${
                        index === 0 ? 'bg-primary' : 'bg-primary/55'
                      }`}
                      style={{ width: `${option.percentage}%` }}
                    />
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-[8px] border border-dashed border-border bg-muted/15 px-4 py-5 text-sm text-muted-foreground">
              Esta encuesta todavía no tiene respuestas cargadas.
            </p>
          )}
        </section>
      </article>

      {survey.segments.length ? (
        <section
          className="rounded-[12px] border border-border bg-card p-5 sm:p-6"
          aria-labelledby={segmentsHeadingId}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <h4 id={segmentsHeadingId} className="chatboc-display text-lg font-semibold text-foreground">
                Quiénes respondieron
              </h4>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Desglose por zona y canal de participación
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Elegir corte">
              {survey.segments.map((segment) => {
                const active = segment.key === activeSegment?.key;
                return (
                  <button
                    key={segment.key}
                    type="button"
                    aria-pressed={active}
                    className={`min-h-11 rounded-[8px] border px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
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
            <ul className="mt-4 space-y-3">
              {[...activeSegment.items]
                .sort((left, right) => right.count - left.count)
                .map((item) => {
                  const share = activeSegmentTotal > 0 ? (item.count / activeSegmentTotal) * 100 : 0;
                  return (
                    <li
                      key={item.id}
                      className="grid grid-cols-[minmax(6rem,0.9fr)_minmax(5rem,1.2fr)_auto] items-center gap-3 text-sm"
                    >
                      <span className="truncate font-medium text-foreground" title={segmentValueLabel(item.label)}>
                        {segmentValueLabel(item.label)}
                      </span>
                      <span className="h-2 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-primary/65 transition-[width] duration-500 ease-out motion-reduce:transition-none"
                          style={{ width: `${Math.min(100, (item.count / maxSegmentCount) * 100)}%` }}
                        />
                      </span>
                      <span className="w-20 text-right text-xs tabular-nums text-muted-foreground">
                        <strong className="font-semibold text-foreground">{item.count}</strong>
                        <span className="ml-2">{NUMBER_FORMATTER.format(share)}%</span>
                      </span>
                    </li>
                  );
                })}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
};

const ExecutiveSurveyPanel = ({
  surveyVoting,
  fallbackTitle,
}: ExecutiveSurveyPanelProps) => {
  const instanceId = `demo-surveys-${useId().replace(/:/g, '')}`;
  const listHeadingId = useId();
  const surveys = surveyVoting?.items ?? [];
  const defaultSurvey = getInitialSurvey(surveys);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(() => defaultSurvey?.id ?? null);
  const activeSurvey = surveys.find((survey) => survey.id === selectedSurveyId) ?? defaultSurvey;
  const activeSurveyIndex = activeSurvey ? surveys.findIndex((survey) => survey.id === activeSurvey.id) : -1;
  const detailPanelId = `${instanceId}-active-detail`;

  if (!surveys.length || !activeSurvey) {
    return (
      <section className="rounded-[12px] border border-dashed border-border bg-muted/15 p-8 text-center" data-demo-survey-voting>
        <BarChart3 className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <h3 className="mt-3 text-base font-semibold text-foreground">{surveyVoting?.title || fallbackTitle}</h3>
        <p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
          Todavía no hay encuestas publicadas en esta vista.
        </p>
      </section>
    );
  }

  return (
    <div
      className={
        surveys.length > 1
          ? 'grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]'
          : 'space-y-6'
      }
      data-demo-survey-voting
      data-demo-survey-master-detail
    >
      <ExecutiveSurveyResultView
        survey={activeSurvey}
        detailPanelId={detailPanelId}
        labelledById={surveyControlId(instanceId, activeSurvey.id, Math.max(0, activeSurveyIndex))}
      />

      {surveys.length > 1 ? (
        <aside
          className="overflow-hidden rounded-[12px] border border-border bg-card lg:sticky lg:top-24"
          aria-labelledby={listHeadingId}
        >
          <div className="flex items-baseline justify-between gap-2 border-b border-border px-5 py-4">
            <h3 id={listHeadingId} className="chatboc-display text-base font-semibold text-foreground">
              Otras encuestas
            </h3>
            <span className="text-xs tabular-nums text-muted-foreground">
              {surveys.length} consultas
            </span>
          </div>
          <div role="list" aria-label="Elegir encuesta para ver resultados" className="divide-y divide-border">
            {surveys.map((survey, index) => {
              const isActive = survey.id === activeSurvey.id;
              const title = cleanSurveyTitle(survey.title);

              return (
                <div key={survey.id} role="listitem">
                  <button
                    id={surveyControlId(instanceId, survey.id, index)}
                    type="button"
                    aria-label={`${title}: ${isActive ? 'resultados visibles' : 'ver resultados'}`}
                    aria-expanded={isActive}
                    aria-controls={detailPanelId}
                    onClick={() => setSelectedSurveyId(survey.id)}
                    className={`relative block w-full min-h-11 px-5 py-4 text-left transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
                      isActive
                        ? 'bg-primary/[0.06] text-foreground'
                        : 'bg-card text-foreground hover:bg-muted/40'
                    }`}
                  >
                    {isActive ? (
                      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 bg-primary" />
                    ) : null}
                    <span className="block text-sm font-semibold leading-5 text-foreground">
                      {title}
                    </span>
                    {survey.question ? (
                      <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {survey.question}
                      </span>
                    ) : null}
                    <span className="mt-2 block text-xs tabular-nums text-muted-foreground">
                      {NUMBER_FORMATTER.format(survey.totalResponses)} respuestas
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </aside>
      ) : null}
    </div>
  );
};

export default ExecutiveSurveyPanel;
