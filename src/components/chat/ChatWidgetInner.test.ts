import { describe, expect, it } from 'vitest';

import {
  isUserPortalSurfacePath,
  resolveStandaloneLauncherBottom,
} from './ChatWidgetInner';

describe('ChatWidgetInner standalone launcher placement', () => {
  it('clears the mobile portal navigation at 390x844 including the safe area', () => {
    expect(isUserPortalSurfacePath('/t/junin/portal/reclamos')).toBe(true);

    expect(
      resolveStandaloneLauncherBottom({
        pathname: '/t/junin/portal/reclamos',
        viewportWidth: 390,
        isMobileView: true,
        closedOffsetBottom: 16,
      }),
    ).toBe('calc(env(safe-area-inset-bottom) + 4rem + 16px)');
  });

  it('covers the full bottom-navigation breakpoint without treating public tenant pages as portal pages', () => {
    expect(isUserPortalSurfacePath('/junin/portal/reclamos')).toBe(true);
    expect(isUserPortalSurfacePath('/municipio/junin/portal/reclamos')).toBe(true);
    expect(isUserPortalSurfacePath('/admin/tools/portal')).toBe(false);

    expect(
      resolveStandaloneLauncherBottom({
        pathname: '/portal/dashboard',
        viewportWidth: 700,
        isMobileView: false,
        closedOffsetBottom: 20,
      }),
    ).toBe('calc(env(safe-area-inset-bottom) + 4rem + 20px)');

    expect(isUserPortalSurfacePath('/t/junin/reclamos/nuevo')).toBe(false);
    expect(
      resolveStandaloneLauncherBottom({
        pathname: '/t/junin/reclamos/nuevo',
        viewportWidth: 390,
        isMobileView: true,
        closedOffsetBottom: 16,
      }),
    ).toBe('calc(env(safe-area-inset-bottom) + 16px)');
  });

  it('preserves the desktop launcher offset on portal routes', () => {
    expect(
      resolveStandaloneLauncherBottom({
        pathname: '/t/junin/portal/reclamos',
        viewportWidth: 1280,
        isMobileView: false,
        closedOffsetBottom: 24,
      }),
    ).toBe('24px');
  });
});
