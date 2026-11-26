import {
  DEMO_DATA_NOTICE,
} from './demoPresentationLabels';
import {
  EXECUTIVE_DEMO_SCENARIOS,
  type ExecutiveDemoScenario,
} from './executiveDemoScenarios';

export type ExecutiveDemoJourneyTarget = 'overview' | 'conversation' | 'claims' | 'surveys' | 'analytics';

type ExecutiveDemoJourneyProps = {
  activeTarget: ExecutiveDemoJourneyTarget;
  onSelect: (target: ExecutiveDemoJourneyTarget) => void;
  onChangeContext?: () => void;
  scenarioContext?: string | null;
  scenarioScope?: string | null;
  scenarios?: readonly ExecutiveDemoScenario[];
  /** Sector de la demo: define cómo se nombra el espacio y sus vistas. */
  sector?: string | null;
  /** Aviso único sobre el origen de los datos en pantalla. */
  dataNotice?: string | null;
};

type JourneyStep = {
  target: ExecutiveDemoJourneyTarget;
  label: string;
};

type JourneyFraming = {
  title: string;
  description: string;
  steps: JourneyStep[];
};

const GOVERNMENT_FRAMING: JourneyFraming = {
  title: 'Centro de gestión ciudadana',
  description: 'Atención, reclamos, participación y territorio en una sola vista.',
  steps: [
    { target: 'overview', label: 'Resumen' },
    { target: 'conversation', label: 'Atención' },
    { target: 'claims', label: 'Reclamos' },
    { target: 'surveys', label: 'Participación' },
    { target: 'analytics', label: 'Territorio' },
  ],
};

// Una empresa o un colegio no gestionan «reclamos ciudadanos»: el mismo
// espacio se presenta con el vocabulario del sector que la persona eligió.
const BUSINESS_FRAMING: JourneyFraming = {
  title: 'Centro de ventas y atención',
  description: 'Atención, pedidos, opinión de clientes y cobertura en una sola vista.',
  steps: [
    { target: 'overview', label: 'Resumen' },
    { target: 'conversation', label: 'Atención' },
    { target: 'claims', label: 'Pedidos y casos' },
    { target: 'surveys', label: 'Encuestas' },
    { target: 'analytics', label: 'Cobertura' },
  ],
};

const EDUCATION_FRAMING: JourneyFraming = {
  title: 'Centro de atención a familias',
  description: 'Consultas, solicitudes, encuestas y alcance en una sola vista.',
  steps: [
    { target: 'overview', label: 'Resumen' },
    { target: 'conversation', label: 'Atención' },
    { target: 'claims', label: 'Solicitudes' },
    { target: 'surveys', label: 'Encuestas' },
    { target: 'analytics', label: 'Alcance' },
  ],
};

export const resolveJourneyFraming = (sector?: string | null): JourneyFraming => {
  const key = (sector ?? '').trim().toLowerCase();
  if (key === 'empresas') return BUSINESS_FRAMING;
  if (key === 'educacion') return EDUCATION_FRAMING;
  // Sin sector, o con uno que no conocemos, se conserva el marco original.
  return GOVERNMENT_FRAMING;
};

const ExecutiveDemoJourney = ({
  activeTarget,
  onSelect,
  onChangeContext,
  scenarioScope,
  sector,
  dataNotice,
}: ExecutiveDemoJourneyProps) => {
  const framing = resolveJourneyFraming(sector);
  const normalizedScope = scenarioScope?.trim();
  const notice = dataNotice?.trim() || DEMO_DATA_NOTICE;

  return (
    <header
      aria-labelledby="demo-executive-journey-title"
      className="overflow-hidden rounded-[12px] border border-border bg-card"
      data-demo-executive-journey
    >
      <div className="flex flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1
              id="demo-executive-journey-title"
              className="chatboc-display text-xl font-bold tracking-tight text-foreground sm:text-2xl"
            >
              {framing.title}
            </h1>
            <span className="text-sm text-muted-foreground">
              {normalizedScope ? `Ámbito: ${normalizedScope}` : 'Ámbito: por configurar'}
            </span>
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            {framing.description}
          </p>
        </div>

        {onChangeContext ? (
          <div className="flex shrink-0 items-center">
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-[8px] border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              onClick={onChangeContext}
            >
              Cambiar demo
            </button>
          </div>
        ) : null}
      </div>

      <nav
        className="border-t border-border px-2 sm:px-4"
        aria-label="Vistas de la demo ejecutiva"
      >
        <div className="flex max-w-full gap-1 overflow-x-auto">
          {framing.steps.map((step) => {
            const isActive = step.target === activeTarget;

            return (
              <button
                key={step.target}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                className={`relative inline-flex min-h-11 shrink-0 items-center border-b-2 px-3.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
                  isActive
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => onSelect(step.target)}
              >
                {step.label}
              </button>
            );
          })}
        </div>
      </nav>

      <div
        className="border-t border-border bg-muted/25 px-4 py-2 text-xs leading-5 text-muted-foreground sm:px-6"
        role="note"
        data-demo-unified-notice
      >
        {notice}
      </div>
    </header>
  );
};

export default ExecutiveDemoJourney;
