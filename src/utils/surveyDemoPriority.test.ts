import { describe, expect, it } from 'vitest';

import { getAutoSeedCantidad, isMendozaTenant, prioritizeMendozaDemoSurveys } from '@/utils/surveyDemoPriority';

describe('surveyDemoPriority', () => {
  it('detects mendoza tenant slugs', () => {
    expect(isMendozaTenant('mendoza')).toBe(true);
    expect(isMendozaTenant('demo-mendoza-campana')).toBe(true);
    expect(isMendozaTenant('junin')).toBe(false);
  });

  it('prioritizes petri demo surveys for mendoza without depending on input order', () => {
    const input = [
      { slug: 'otra-encuesta' },
      { slug: 'luis-petri-sondeo-territorial-mendoza' },
      { slug: 'luis-petri-tracking-campana-mendoza' },
      { slug: 'luis-petri-votacion-prioridades-mendoza' },
    ];

    const output = prioritizeMendozaDemoSurveys(input, 'mendoza');

    expect(output.map((item) => item.slug)).toEqual([
      'luis-petri-tracking-campana-mendoza',
      'luis-petri-votacion-prioridades-mendoza',
      'luis-petri-sondeo-territorial-mendoza',
      'otra-encuesta',
    ]);
  });

  it('keeps original order for non-mendoza tenants', () => {
    const input = [{ slug: 'b' }, { slug: 'a' }];
    const output = prioritizeMendozaDemoSurveys(input, 'junin');
    expect(output).toEqual(input);
  });

  it('reads auto_seed_demo cantidad from top-level and recursos', () => {
    expect(getAutoSeedCantidad({ slug: 'a', auto_seed_demo: { cantidad: 42 } } as any)).toBe(42);
    expect(getAutoSeedCantidad({ slug: 'a', recursos: { auto_seed_demo: { cantidad: 12 } } } as any)).toBe(12);
    expect(getAutoSeedCantidad({ slug: 'a' } as any)).toBeNull();
  });
});
