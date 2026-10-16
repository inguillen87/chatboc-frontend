import type { LucideIcon } from 'lucide-react';
import { ClipboardList, LayoutDashboard, MapPinned, MessageSquareText, Vote } from 'lucide-react';
import {
  EXECUTIVE_DEMO_SCENARIOS,
  resolveExecutiveDemoScenarioKey,
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
};

type JourneyStep = {
  target: ExecutiveDemoJourneyTarget;
  label: string;
  icon: LucideIcon;
};

const JOURNEY_STEPS: JourneyStep[] = [
  { target: 'overview', label: 'Resumen', icon: LayoutDashboard },
  { target: 'conversation', label: 'Atención', icon: MessageSquareText },
  { target: 'claims', label: 'Reclamos', icon: ClipboardList },
  { target: 'surveys', label: 'Participación', icon: Vote },
  { target: 'analytics', label: 'Territorio', icon: MapPinned },
];

const ExecutiveDemoJourney = ({
  activeTarget,
  onSelect,
  onChangeContext,
  scenarioContext,
  scenarioScope,
  scenarios = EXECUTIVE_DEMO_SCENARIOS,
}: ExecutiveDemoJourneyProps) => {
  const normalizedScope = scenarioScope?.trim();
  const activeScenarioKey = resolveExecutiveDemoScenarioKey(scenarioContext, scenarios);
  const activeScenario = scenarios.find((scenario) => scenario.key === activeScenarioKey);

  return (
    <section
      aria-labelledby="demo-executive-journey-title"
      className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm"
      data-demo-executive-journey
    >
      <div className="flex flex-col gap-4 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">Chatboc · Gestión ciudadana</p>
          <h1 id="demo-executive-journey-title" className="mt-1 text-xl font-black tracking-tight text-foreground sm:text-2xl">
            Centro de gestión ciudadana
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Atención, reclamos, participación y territorio en una sola vista.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 text-[11px] font-semibold">
          <span className="rounded-full border border-border/80 bg-muted/25 px-2.5 py-1 text-foreground">
            {normalizedScope ? `Ámbito: ${normalizedScope}` : 'Ámbito: por configurar'}
          </span>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-amber-900 dark:text-amber-100">
            Demo no oficial · datos simulados
          </span>
        </div>
      </div>

      <nav
        className="border-t border-border/70 bg-muted/15 px-2 py-2 sm:px-3"
        aria-label="Vistas de la demo ejecutiva"
      >
        <div className="flex max-w-full gap-1 overflow-x-auto">
          {JOURNEY_STEPS.map((step) => {
            const Icon = step.icon;
            const isActive = step.target === activeTarget;

            return (
              <button
                key={step.target}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  isActive
                    ? 'bg-foreground text-background shadow-sm'
                    : 'text-muted-foreground hover:bg-background hover:text-foreground'
                }`}
                onClick={() => onSelect(step.target)}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {step.label}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-4 py-2 text-[11px] text-muted-foreground sm:px-5">
        <p>
          {activeScenario
            ? `Escenario activo: ${activeScenario.compactLabel}.`
            : `${scenarios.length} escenarios demostrativos disponibles en el mismo workspace.`}
        </p>
        {onChangeContext ? (
          <button
            type="button"
            className="font-semibold text-foreground underline decoration-border underline-offset-4 hover:text-primary"
            onClick={onChangeContext}
          >
            Cambiar demo
          </button>
        ) : null}
      </div>
    </section>
  );
};

export default ExecutiveDemoJourney;
