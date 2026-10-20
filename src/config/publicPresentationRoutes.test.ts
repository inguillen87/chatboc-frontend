import { describe, expect, it } from 'vitest';

import {
  DISABILITY_AI_AGENT_DEMO_PATH,
  isDisabilityAIAgentDemoPath,
  resolvePublicDemoPreloadTarget,
} from './publicPresentationRoutes';

describe('public presentation routes', () => {
  it('allowlists only the exact institutional disability presentation', () => {
    expect(isDisabilityAIAgentDemoPath(DISABILITY_AI_AGENT_DEMO_PATH)).toBe(true);
    expect(isDisabilityAIAgentDemoPath(`${DISABILITY_AI_AGENT_DEMO_PATH}/`)).toBe(true);
    expect(isDisabilityAIAgentDemoPath('/DEMO/INSTITUCIONAL/TDF-DISCAPACIDAD')).toBe(true);

    expect(isDisabilityAIAgentDemoPath('/demo/institucional')).toBe(false);
    expect(isDisabilityAIAgentDemoPath(`${DISABILITY_AI_AGENT_DEMO_PATH}/interno`)).toBe(false);
    expect(isDisabilityAIAgentDemoPath('/demo/institucional/tdf-discapacidad-extra')).toBe(false);
  });

  it('preloads the chunk that actually owns each public demo route', () => {
    expect(resolvePublicDemoPreloadTarget('/demo')).toBe('executive-demo');
    expect(resolvePublicDemoPreloadTarget('/demo/gobierno')).toBe('sector-landing');
    expect(resolvePublicDemoPreloadTarget(DISABILITY_AI_AGENT_DEMO_PATH)).toBe(
      'disability-ai-agent',
    );
    expect(resolvePublicDemoPreloadTarget('/demo/institucional/otra')).toBeNull();
    expect(resolvePublicDemoPreloadTarget('/perfil')).toBeNull();
  });
});
