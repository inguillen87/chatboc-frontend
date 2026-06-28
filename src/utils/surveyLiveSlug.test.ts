import { describe, expect, it } from 'vitest';

import { resolveSurveyLiveSlug } from './surveyLiveSlug';

describe('resolveSurveyLiveSlug', () => {
  it('prefers the canonical public slug used by live rooms and polling', () => {
    expect(
      resolveSurveyLiveSlug(
        {
          slug: 'internal-id',
          canonical_slug: 'canonical-room',
          slug_publico: 'public-canonical',
        },
        'short-link',
      ),
    ).toBe('public-canonical');
  });

  it('falls back from canonical fields to the requested route slug', () => {
    expect(resolveSurveyLiveSlug(null, 'route-slug')).toBe('route-slug');
    expect(resolveSurveyLiveSlug({ slug: 'survey-slug' }, 'route-slug')).toBe('survey-slug');
  });
});
