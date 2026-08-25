import { describe, expect, it } from 'vitest';

import {
  isPublicDemoChatBootstrapReady,
  isPublicDemoSurveyPath,
  isUserPortalSurfacePath,
  restoreDialogFocus,
  resolvePublicDemoSurveyBootstrap,
  resolveStandaloneLauncherBottom,
} from './ChatWidgetInner';

describe('ChatWidgetInner public demo survey bootstrap', () => {
  it('binds demo survey routes to the explicit tenant and sector', () => {
    expect(
      resolvePublicDemoSurveyBootstrap(
        '/e/demo-gobierno-municipio-prioridades-barriales',
        '?tenant_slug=municipio',
      ),
    ).toEqual({
      key: 'gobierno:municipio',
      sector: 'gobierno',
      tenantSlug: 'municipio',
      rubro: 'municipio',
    });
  });

  it('does not mint demo sessions for ordinary surveys or missing tenant scope', () => {
    expect(
      resolvePublicDemoSurveyBootstrap('/e/prioridades-barriales', '?tenant_slug=municipio'),
    ).toBeNull();
    expect(
      resolvePublicDemoSurveyBootstrap('/e/demo-gobierno-prioridades', ''),
    ).toBeNull();
    expect(isPublicDemoSurveyPath('/e/demo-gobierno-prioridades')).toBe(true);
    expect(isPublicDemoSurveyPath('/e/prioridades-barriales')).toBe(false);
  });

  it('recognizes the other explicit demo sectors without reading stale storage', () => {
    expect(
      resolvePublicDemoSurveyBootstrap(
        '/e/demo-educacion-colegios-familias',
        '?tenant=colegio-demo',
      ),
    ).toMatchObject({ sector: 'educacion', tenantSlug: 'colegio-demo' });
    expect(
      resolvePublicDemoSurveyBootstrap(
        '/e/demo-empresas-bodega-clientes',
        '?tenant_slug=bodega&tenant=bodega',
      ),
    ).toMatchObject({ sector: 'empresas', tenantSlug: 'bodega' });
  });

  it('rejects conflicting, duplicated, empty, and malformed tenant selectors', () => {
    const path = '/e/demo-gobierno-prioridades';
    expect(
      resolvePublicDemoSurveyBootstrap(path, '?tenant_slug=municipio&tenant=junin'),
    ).toBeNull();
    expect(
      resolvePublicDemoSurveyBootstrap(path, '?tenant_slug=municipio&tenant_slug=junin'),
    ).toBeNull();
    expect(resolvePublicDemoSurveyBootstrap(path, '?tenant_slug=')).toBeNull();
    expect(
      resolvePublicDemoSurveyBootstrap(path, '?tenant_slug=..%2Fotro'),
    ).toBeNull();
  });

  it('requires an exact signed bootstrap before enabling the public demo chat', () => {
    const bootstrap = {
      headers: {
        'X-Tenant-Slug': 'municipio',
        'X-Demo-Session-Id': 'signed-demo-session',
        'X-Chat-Session-Id': 'chat-session-1',
      },
      payload: { tenant_slug: 'municipio' },
      query: { tenant_slug: 'municipio' },
    };

    expect(
      isPublicDemoChatBootstrapReady({
        activeTenantSlug: 'municipio',
        bootstrap,
        expectedTenantSlug: 'municipio',
      }),
    ).toBe(true);
    expect(
      isPublicDemoChatBootstrapReady({
        activeTenantSlug: 'otro',
        bootstrap,
        expectedTenantSlug: 'municipio',
      }),
    ).toBe(false);
    expect(
      isPublicDemoChatBootstrapReady({
        activeTenantSlug: 'municipio',
        bootstrap: {
          ...bootstrap,
          headers: { ...bootstrap.headers, 'X-Tenant-Slug': 'otro' },
        },
        expectedTenantSlug: 'municipio',
      }),
    ).toBe(false);
    expect(
      isPublicDemoChatBootstrapReady({
        activeTenantSlug: 'municipio',
        bootstrap: {
          ...bootstrap,
          headers: { 'X-Tenant-Slug': 'municipio' },
        },
        expectedTenantSlug: 'municipio',
      }),
    ).toBe(false);
    expect(
      isPublicDemoChatBootstrapReady({
        activeTenantSlug: 'municipio',
        bootstrap: {
          ...bootstrap,
          headers: {
            ...bootstrap.headers,
            'x-tenant-slug': 'otro',
          },
        },
        expectedTenantSlug: 'municipio',
      }),
    ).toBe(false);
    expect(
      isPublicDemoChatBootstrapReady({
        activeTenantSlug: 'municipio',
        bootstrap: {
          ...bootstrap,
          payload: {
            ...bootstrap.payload,
            demo_session_id: 'different-demo-session',
          },
        },
        demoSessionId: 'signed-demo-session',
        expectedTenantSlug: 'municipio',
      }),
    ).toBe(false);
  });
});

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

describe('ChatWidgetInner dialog focus restoration', () => {
  it('focuses the newly mounted launcher when the opening launcher was unmounted', () => {
    const openingLauncher = document.createElement('button');
    document.body.append(openingLauncher);
    openingLauncher.focus();
    openingLauncher.remove();

    const mountedLauncher = document.createElement('button');
    document.body.append(mountedLauncher);

    expect(restoreDialogFocus(openingLauncher, mountedLauncher)).toBe(true);
    expect(document.activeElement).toBe(mountedLauncher);

    mountedLauncher.remove();
  });

  it('preserves a connected external trigger instead of moving focus to the launcher', () => {
    const externalTrigger = document.createElement('button');
    const mountedLauncher = document.createElement('button');
    document.body.append(externalTrigger, mountedLauncher);
    mountedLauncher.focus();

    expect(restoreDialogFocus(externalTrigger, mountedLauncher)).toBe(true);
    expect(document.activeElement).toBe(externalTrigger);

    externalTrigger.remove();
    mountedLauncher.remove();
  });

  it('keeps restoration pending when neither target is mounted yet', () => {
    const detachedOpeningLauncher = document.createElement('button');

    expect(restoreDialogFocus(detachedOpeningLauncher, null)).toBe(false);
  });
});
