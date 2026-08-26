export type ExecutiveDemoScenario = {
  key: string;
  compactLabel: string;
  detail: string;
  matchTerms: readonly string[];
  slugFamily: 'demo-gobierno-junin-*';
};

// Local catalog until the demo contract publishes this collection. Keep URLs
// and tenant identifiers out of the presentation layer. All entries share the
// verified Junín demo-survey family so an API catalog can replace this array.
export const EXECUTIVE_DEMO_SCENARIOS: readonly ExecutiveDemoScenario[] = [
  {
    key: 'prioridades-barriales',
    compactLabel: 'Prioridades barriales',
    detail: 'Participación ciudadana y lectura territorial de prioridades.',
    matchTerms: [
      'prioridades barriales',
      'prioridad barrial',
      'junin participa',
      'participa prioridades barriales',
    ],
    slugFamily: 'demo-gobierno-junin-*',
  },
  {
    key: 'obras-servicios-90-dias',
    compactLabel: 'Obras y servicios',
    detail: 'Seguimiento demostrativo de obras y servicios en un horizonte de 90 días.',
    matchTerms: ['obras y servicios', 'obras servicios', '90 días', '90 dias', '90 dias obras servicios'],
    slugFamily: 'demo-gobierno-junin-*',
  },
  {
    key: 'tramites-atencion-digital',
    compactLabel: 'Trámites y atención digital',
    detail: 'Atención, reclamos y trazabilidad de trámites dentro del mismo circuito.',
    matchTerms: [
      'trámites y atención digital',
      'tramites y atencion digital',
      'trámites y atención ciudadana',
      'tramites y atencion ciudadana',
      'digital tramites atencion',
      'atención digital',
      'atencion digital',
    ],
    slugFamily: 'demo-gobierno-junin-*',
  },
];

const normalizeScenarioText = (value?: string | null) =>
  value
    ?.trim()
    .toLocaleLowerCase('es-AR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ') ?? '';

export const resolveExecutiveDemoScenarioKey = (
  scenarioContext: string | null | undefined,
  scenarios: readonly ExecutiveDemoScenario[] = EXECUTIVE_DEMO_SCENARIOS,
) => {
  const normalizedContext = normalizeScenarioText(scenarioContext);
  if (!normalizedContext) return null;

  return (
    scenarios.find((scenario) =>
      scenario.matchTerms.some((term) => normalizedContext.includes(normalizeScenarioText(term))),
    )?.key ?? null
  );
};
