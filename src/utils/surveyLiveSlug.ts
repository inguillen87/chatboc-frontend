import type { SurveyPublic } from '@/types/encuestas';

type SurveyLiveSlugSource = Pick<SurveyPublic, 'slug' | 'slug_publico' | 'canonical_slug'>;

const cleanSlug = (value?: string | null) => {
  const normalized = value?.trim();
  return normalized || '';
};

export const resolveSurveyLiveSlug = (
  survey?: SurveyLiveSlugSource | null,
  routeSlug?: string | null,
) =>
  cleanSlug(survey?.slug_publico) ||
  cleanSlug(survey?.canonical_slug) ||
  cleanSlug(survey?.slug) ||
  cleanSlug(routeSlug);
