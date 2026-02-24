import { describe, expect, it } from 'vitest';

import { getAutoSeedCantidad, prioritizeMendozaDemoSurveys } from '@/utils/surveyDemoPriority';

describe('surveyDemoPriority', () => {
  it('keeps backward-compatible no-op ordering helper', () => {
    const input = [{ slug: 'b' }, { slug: 'a' }];
    expect(prioritizeMendozaDemoSurveys(input)).toEqual(input);
  });

  it('reads auto_seed_demo cantidad from top-level and recursos', () => {
    expect(getAutoSeedCantidad({ slug: 'a', auto_seed_demo: { cantidad: 42 } } as any)).toBe(42);
    expect(getAutoSeedCantidad({ slug: 'a', recursos: { auto_seed_demo: { cantidad: 12 } } } as any)).toBe(12);
    expect(getAutoSeedCantidad({ slug: 'a' } as any)).toBeNull();
  });
});
