export const DISABILITY_AI_AGENT_DEMO_PATH = '/demo/institucional/tdf-discapacidad';

const normalizePathname = (pathname?: string) =>
  String(pathname || '').trim().toLowerCase().replace(/\/+$/, '') || '/';

export const isDisabilityAIAgentDemoPath = (pathname?: string): boolean =>
  normalizePathname(pathname) === DISABILITY_AI_AGENT_DEMO_PATH;

export type PublicDemoPreloadTarget =
  | 'executive-demo'
  | 'disability-ai-agent'
  | 'sector-landing'
  | null;

export const resolvePublicDemoPreloadTarget = (pathname?: string): PublicDemoPreloadTarget => {
  const normalized = normalizePathname(pathname);
  if (normalized === DISABILITY_AI_AGENT_DEMO_PATH) return 'disability-ai-agent';
  if (normalized === '/demo') return 'executive-demo';
  if (/^\/demo\/[^/]+$/.test(normalized)) return 'sector-landing';
  return null;
};
