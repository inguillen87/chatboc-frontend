import { describe, expect, it } from 'vitest';

import { buildLoginPathWithNext, getSafeAuthNextPath } from './authRedirect';

describe('authRedirect', () => {
  it('preserves profile tabs through login', () => {
    expect(buildLoginPathWithNext('/perfil', '?tab=tickets')).toBe('/login?next=%2Fperfil%3Ftab%3Dtickets');
    expect(getSafeAuthNextPath('?next=%2Fperfil%3Ftab%3Dtickets')).toBe('/perfil?tab=tickets');
  });

  it('rejects external and looping redirects', () => {
    expect(getSafeAuthNextPath('?next=https%3A%2F%2Fevil.test')).toBeNull();
    expect(getSafeAuthNextPath('?next=%2F%2Fevil.test')).toBeNull();
    expect(getSafeAuthNextPath('?next=%2Flogin')).toBeNull();
  });
});
