import type { LucideIcon } from 'lucide-react';
import { BarChart3, ClipboardList, MessageSquareText, Vote } from 'lucide-react';
import {
  EXECUTIVE_DEMO_SCENARIOS,
  resolveExecutiveDemoScenarioKey,
  type ExecutiveDemoScenario,
} from './executiveDemoScenarios';

export type ExecutiveDemoJourneyTarget = 'conversation' | 'claims' | 'surveys' | 'analytics';

type ExecutiveDemoJourneyProps = {
  activeTarget: ExecutiveDemoJourneyTarget;
  onSelect: (target: ExecutiveDemoJourneyTarget) => void;
  scenarioContext?: string | null;
  scenarioScope?: string | null;
  scenarios?: readonly ExecutiveDemoScenario[];
};

type JourneyStep = {
  target: ExecutiveDemoJourneyTarget;
  title: string;
  description: string;
  action: string;
  icon: LucideIcon;
};

const JOURNEY_STEPS: JourneyStep[] = [
  {
    target: 'conversation',
    title: 'Atención omnicanal',
    description: 'Probá el chat web y el acceso por WhatsApp.',
    action: 'Ir a atención',
    icon: MessageSquareText,
  },
  {
    target: 'claims',
    title: 'CRM de reclamos',
    description: 'Revisá prioridad, estado y seguimiento del caso.',
    action: 'Abrir reclamos',
    icon: ClipboardList,
  },
  {
    target: 'surveys',
    title: 'Encuestas y votaciones',
    description: 'Explorá participación y resultados de la demo.',
    action: 'Ver encuestas',
    icon: Vote,
  },
  {
    target: 'analytics',
    title: 'Analítica territorial',
    description: 'Leé indicadores, canales y señales del territorio.',
    action: 'Ver analítica',
    icon: BarChart3,
  },
];

const ExecutiveDemoJourney = ({
  activeTarget,
  onSelect,
  scenarioContext,
  scenarioScope,
  scenarios = EXECUTIVE_DEMO_SCENARIOS,
}: ExecutiveDemoJourneyProps) => {
  const normalizedScope = scenarioScope?.trim();
  const activeScenarioKey = resolveExecutiveDemoScenarioKey(scenarioContext, scenarios);

  return (
    <section
      aria-labelledby="demo-executive-journey-title"
      className="relative overflow-hidden rounded-3xl border border-primary/20 bg-card/90 p-5 shadow-[0_20px_55px_-38px_hsl(var(--primary)/0.65)] sm:p-6"
      data-demo-executive-journey
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl"
      />

      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">
            Recorrido ejecutivo · 30 segundos
          </p>
          <h2
            id="demo-executive-journey-title"
            className="mt-2 text-xl font-black tracking-tight text-foreground sm:text-2xl"
          >
            Un solo espacio de trabajo, del contacto a la decisión
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Seguí el circuito que conecta atención, gestión de casos, participación y lectura territorial dentro del
            mismo ámbito.
          </p>
        </div>

        <div className="flex max-w-full flex-wrap gap-2 text-xs font-bold">
          <span className="max-w-full rounded-full border border-border/80 bg-background/80 px-3 py-1.5 text-foreground">
            Ámbito: {normalizedScope || 'configurado por esta demo'}
          </span>
          <span className="rounded-full border border-amber-500/35 bg-amber-400/15 px-3 py-1.5 text-amber-950 dark:text-amber-100">
            Escenario demostrativo · no oficial
          </span>
        </div>
      </div>

      <div className="relative mt-5 rounded-2xl border border-border/70 bg-background/55 p-3 sm:p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-foreground">
            {scenarios.length} escenarios de Junín · un mismo workspace
          </p>
          <p className="text-xs leading-5 text-muted-foreground">
            Comparten acceso y canales; son demostraciones de producto, no portales oficiales independientes.
          </p>
        </div>
        <ul className="mt-3 grid gap-2 lg:grid-cols-3" aria-label="Escenarios de Junín disponibles en este workspace">
          {scenarios.map((scenario) => {
            const isCurrentScenario = scenario.key === activeScenarioKey;

            return (
              <li
                key={scenario.key}
                className={`min-w-0 rounded-xl border px-3 py-3 ${
                  isCurrentScenario
                    ? 'border-primary/45 bg-primary/10'
                    : 'border-border/65 bg-card/65'
                }`}
                data-demo-scenario={scenario.key}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-black text-foreground">{scenario.compactLabel}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${
                      isCurrentScenario
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-border/75 bg-background/80 text-muted-foreground'
                    }`}
                  >
                    {isCurrentScenario ? 'En pantalla' : 'Demo no oficial'}
                  </span>
                </div>
                <p
                  className={`mt-1.5 text-xs leading-5 ${
                    isCurrentScenario ? 'text-foreground/80' : 'text-muted-foreground'
                  }`}
                >
                  {scenario.detail}
                </p>
              </li>
            );
          })}
        </ul>
      </div>

      <ol className="relative mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Recorrido por la demo">
        {JOURNEY_STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = step.target === activeTarget;

          return (
            <li key={step.target} className="min-w-0">
              <button
                type="button"
                aria-current={isActive ? 'step' : undefined}
                className={`group flex h-full w-full min-w-0 flex-col rounded-2xl border p-4 text-left transition-[transform,border-color,background-color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none ${
                  isActive
                    ? 'border-primary/55 bg-primary/10 shadow-[0_16px_35px_-28px_hsl(var(--primary)/0.9)]'
                    : 'border-border/75 bg-background/70 hover:border-primary/35 hover:bg-background'
                }`}
                onClick={() => onSelect(step.target)}
              >
                <span className="flex w-full items-center justify-between gap-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                      isActive
                        ? 'border-primary/35 bg-primary text-primary-foreground'
                        : 'border-border/80 bg-muted/65 text-foreground group-hover:border-primary/25 group-hover:text-primary'
                    }`}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span
                    className={`text-[11px] font-black tabular-nums tracking-[0.14em] ${
                      isActive ? 'text-foreground/75' : 'text-muted-foreground'
                    }`}
                  >
                    0{index + 1}
                  </span>
                </span>
                <span className="mt-4 text-sm font-black text-foreground">{step.title}</span>
                <span
                  className={`mt-1.5 flex-1 text-xs leading-5 ${
                    isActive ? 'text-foreground/80' : 'text-muted-foreground'
                  }`}
                >
                  {step.description}
                </span>
                <span
                  className={`mt-3 text-xs font-black ${
                    isActive ? 'text-[hsl(var(--primary-dark))] dark:text-primary' : 'text-foreground'
                  }`}
                >
                  {step.action} <span aria-hidden="true">→</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <p className="relative mt-4 border-t border-border/65 pt-4 text-xs leading-5 text-muted-foreground">
        Con una cuenta autorizada, este circuito continúa en los módulos de CRM, Reclamos, Encuestas y Analíticas del
        tenant seleccionado.
      </p>
    </section>
  );
};

export default ExecutiveDemoJourney;
