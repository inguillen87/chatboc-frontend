import { describe, expect, it } from 'vitest';

import {
  EXECUTIVE_DEMO_SCENARIOS,
  resolveExecutiveDemoScenarioKey,
} from './executiveDemoScenarios';

describe('executive demo scenario catalog', () => {
  it('keeps the three institutional scenarios under one data-driven catalog', () => {
    expect(EXECUTIVE_DEMO_SCENARIOS.map((scenario) => scenario.compactLabel)).toEqual([
      'Prioridades barriales',
      'Obras y servicios',
      'Trámites y atención digital',
    ]);
    expect(EXECUTIVE_DEMO_SCENARIOS.every((scenario) => scenario.slugFamily === 'demo-gobierno-junin-*')).toBe(true);
  });

  it('resolves each Junín scenario from API-ready labels or the verified slug family', () => {
    expect(resolveExecutiveDemoScenarioKey('demo-gobierno-junin-participa-prioridades-barriales')).toBe(
      'prioridades-barriales',
    );
    expect(resolveExecutiveDemoScenarioKey('demo-gobierno-junin-90-dias-obras-servicios')).toBe(
      'obras-servicios-90-dias',
    );
    expect(resolveExecutiveDemoScenarioKey('demo-gobierno-junin-digital-tramites-atencion')).toBe(
      'tramites-atencion-digital',
    );
  });
});
