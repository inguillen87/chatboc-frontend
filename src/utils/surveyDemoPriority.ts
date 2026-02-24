import type { SurveyAdmin, SurveyPublic } from '@/types/encuestas';

const MENDOZA_PRIORITY_SLUGS = [
  'luis-petri-tracking-campana-mendoza',
  'luis-petri-votacion-prioridades-mendoza',
  'luis-petri-sondeo-territorial-mendoza',
] as const;

type SurveyLike = Pick<SurveyPublic, 'slug'> | Pick<SurveyAdmin, 'slug'>;

export const isMendozaTenant = (tenantSlug?: string | null): boolean =>
  typeof tenantSlug === 'string' && tenantSlug.toLowerCase().includes('mendoza');

export const prioritizeMendozaDemoSurveys = <T extends SurveyLike>(
  surveys: T[],
  tenantSlug?: string | null,
): T[] => {
  if (!isMendozaTenant(tenantSlug)) return surveys;

  const priorityIndex = new Map<string, number>(MENDOZA_PRIORITY_SLUGS.map((slug, index) => [slug, index]));

  return [...surveys].sort((a, b) => {
    const aIndex = priorityIndex.get(a.slug ?? '') ?? Number.MAX_SAFE_INTEGER;
    const bIndex = priorityIndex.get(b.slug ?? '') ?? Number.MAX_SAFE_INTEGER;
    if (aIndex !== bIndex) return aIndex - bIndex;
    return 0;
  });
};

const getAutoSeedPayload = (survey: SurveyPublic | SurveyAdmin): Record<string, unknown> | null => {
  const direct = (survey as Record<string, unknown>).auto_seed_demo;
  if (direct && typeof direct === 'object') return direct as Record<string, unknown>;
  const recursos = survey.recursos;
  if (recursos && typeof recursos === 'object') {
    const nested = (recursos as Record<string, unknown>).auto_seed_demo;
    if (nested && typeof nested === 'object') return nested as Record<string, unknown>;
  }
  return null;
};

export const getAutoSeedCantidad = (survey: SurveyPublic | SurveyAdmin): number | null => {
  const payload = getAutoSeedPayload(survey);
  if (!payload) return null;
  const raw = payload.cantidad;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
  return null;
};
