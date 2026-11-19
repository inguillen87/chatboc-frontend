import { describe, expect, it } from 'vitest';

import {
  buildClerkBackendUnavailableRuntime,
  buildGuestPublicHomeRuntime,
  buildPublicClerkBypassRuntime,
  hasSessionTrace,
  isGuestPublicHomePresentation,
  isGuestPublicHomeRuntime,
  isOrganizationPublicHomePath,
  buildPublicPreviewPresentationRuntime,
  buildClerkRuntimeFromEnv,
  isClerkOriginCompatible,
  isPublicClerkBypassPresentation,
  isPublicClerkBypassRuntime,
  isPublicPreviewPresentation,
  isPublicPreviewPresentationRuntime,
  shouldReloadAfterPublicPreviewNavigation,
} from './clerkRuntimeResolver';

describe('clerkRuntimeResolver', () => {
  it('only mounts live Clerk keys on the Chatboc production domain', () => {
    expect(isClerkOriginCompatible({
      environment: 'production',
      hostname: 'www.chatboc.ar',
      publishableKey: 'pk_live_example',
    })).toBe(true);
    expect(isClerkOriginCompatible({
      environment: 'production',
      hostname: '127.0.0.1',
      publishableKey: 'pk_live_example',
    })).toBe(false);
    expect(isClerkOriginCompatible({
      environment: 'production',
      hostname: 'chatboc-preview.vercel.app',
      publishableKey: 'pk_live_example',
    })).toBe(false);
  });

  it('allows test Clerk keys on local development origins', () => {
    expect(isClerkOriginCompatible({
      environment: 'development',
      hostname: 'localhost',
      publishableKey: 'pk_test_example',
    })).toBe(true);
  });

  it('recognizes only the explicit public Preview presentation URL', () => {
    expect(isPublicPreviewPresentation({
      hostname: 'chatboc-r2-preview.vercel.app',
      pathname: '/demo',
      search: '?tenant_slug=junin&remote_preview_qa=1',
    })).toBe(true);
    expect(isPublicPreviewPresentation({
      hostname: 'localhost',
      pathname: '/demo/',
      search: '?remote_preview_qa=1',
    })).toBe(true);
    expect(isPublicPreviewPresentation({
      hostname: 'chatboc-r2-preview.vercel.app',
      pathname: '/demo',
      search: '?remote_preview_qa=0',
    })).toBe(false);
    expect(isPublicPreviewPresentation({
      hostname: 'chatboc-r2-preview.vercel.app',
      pathname: '/perfil',
      search: '?remote_preview_qa=1',
    })).toBe(false);
    expect(isPublicPreviewPresentation({
      hostname: 'chatboc.ar',
      pathname: '/demo',
      search: '?remote_preview_qa=1',
    })).toBe(false);
    expect(isPublicPreviewPresentation({
      hostname: 'chatboc-frontend.vercel.app',
      pathname: '/demo',
      search: '?remote_preview_qa=1',
    })).toBe(false);
  });

  it('keeps Clerk fail-closed for the public Preview presentation', () => {
    const runtime = buildPublicPreviewPresentationRuntime('pk_live_public_key');

    expect(runtime).toMatchObject({
      enabled: false,
      loading: false,
      readyForSessionSync: false,
      source: 'disabled',
    });
    expect(runtime.configurationWarnings?.[0]?.code).toBe('public_preview_presentation');
    expect(isPublicPreviewPresentationRuntime(runtime)).toBe(true);
    expect(isPublicPreviewPresentationRuntime({
      configurationWarnings: [],
    })).toBe(false);
    expect(shouldReloadAfterPublicPreviewNavigation({
      runtime,
      hostname: 'chatboc-r2-preview.vercel.app',
      pathname: '/login',
      search: '',
    })).toBe(true);
    expect(shouldReloadAfterPublicPreviewNavigation({
      runtime,
      hostname: 'chatboc-r2-preview.vercel.app',
      pathname: '/demo',
      search: '?remote_preview_qa=1',
    })).toBe(false);
  });

  it('bypasses Clerk only for the exact static institutional presentation', () => {
    expect(isPublicClerkBypassPresentation({
      hostname: 'chatboc.ar',
      pathname: '/demo/institucional/tdf-discapacidad',
      search: '',
    })).toBe(true);
    expect(isPublicClerkBypassPresentation({
      hostname: 'chatboc-r2-preview.vercel.app',
      pathname: '/demo/institucional/tdf-discapacidad/',
      search: '',
    })).toBe(true);
    expect(isPublicClerkBypassPresentation({
      hostname: 'chatboc.ar',
      pathname: '/demo/institucional/tdf-discapacidad/interno',
      search: '',
    })).toBe(false);
    expect(isPublicClerkBypassPresentation({
      hostname: 'chatboc.ar',
      pathname: '/demo/otra-presentacion',
      search: '',
    })).toBe(false);
  });

  it('reloads when crossing either side of the public no-Clerk topology', () => {
    const runtime = buildPublicClerkBypassRuntime('pk_live_public_key');

    expect(isPublicClerkBypassRuntime(runtime)).toBe(true);
    expect(runtime.enabled).toBe(false);
    expect(shouldReloadAfterPublicPreviewNavigation({
      runtime,
      hostname: 'chatboc.ar',
      pathname: '/demo/institucional/tdf-discapacidad',
      search: '',
    })).toBe(false);
    expect(shouldReloadAfterPublicPreviewNavigation({
      runtime,
      hostname: 'chatboc.ar',
      pathname: '/perfil',
      search: '',
    })).toBe(true);
    expect(shouldReloadAfterPublicPreviewNavigation({
      runtime: { configurationWarnings: [] },
      hostname: 'chatboc.ar',
      pathname: '/demo/institucional/tdf-discapacidad',
      search: '',
    })).toBe(true);
  });

  it('opens an organization public home without the sign-in runtime only for a browser with no session trace', () => {
    for (const pathname of ['/t/tierra-del-fuego', '/t/Tierra-del-Fuego/', '/t/junin']) {
      expect(isOrganizationPublicHomePath(pathname)).toBe(true);
      expect(isGuestPublicHomePresentation({ pathname, search: '', cookie: '', storedSession: false })).toBe(true);
    }
    // Every other route keeps the normal runtime, whatever the visitor is.
    for (const pathname of ['/', '/t', '/t/', '/t/junin/login', '/t/junin/noticias', '/t/junin/admin/knowledge', '/junin', '/demo', '/admin/knowledge']) {
      expect(isOrganizationPublicHomePath(pathname)).toBe(false);
      expect(isGuestPublicHomePresentation({ pathname, search: '', cookie: '', storedSession: false })).toBe(false);
    }
    // A first visit, or a browser that signed out, carries no trace.
    expect(hasSessionTrace({ cookie: 'chatboc_anon_id=abc; __client_uat=0; __client_uat_cfwnN0UG=0' })).toBe(false);
    expect(hasSessionTrace({ cookie: '', search: '?pwa=1' })).toBe(false);
    // Any sign of a session keeps the provider: its own markers, a redirect back from it, or a stored session.
    for (const cookie of ['__client_uat=1795000000', 'a=1; __client_uat_cfwnN0UG=1795000000', '__session=token', '__session_cfwnN0UG=token', '__clerk_db_jwt=dev']) {
      expect(hasSessionTrace({ cookie })).toBe(true);
      expect(isGuestPublicHomePresentation({ pathname: '/t/junin', cookie })).toBe(false);
    }
    expect(isGuestPublicHomePresentation({ pathname: '/t/junin', search: '?__clerk_status=verified' })).toBe(false);
    expect(isGuestPublicHomePresentation({ pathname: '/t/junin', search: '?next=%2F&__clerk_handshake=x' })).toBe(false);
    expect(isGuestPublicHomePresentation({ pathname: '/t/junin', storedSession: true })).toBe(false);
    // A cookie that merely resembles the marker is not one.
    expect(hasSessionTrace({ cookie: 'my__client_uat=1795000000; client_uat=1; __client_uatx=5' })).toBe(false);
  });

  it('reloads once on the way out of the light home, and never on the way in', () => {
    const runtime = buildGuestPublicHomeRuntime('pk_live_public_key');

    expect(runtime.enabled).toBe(false);
    expect(runtime.readyForSessionSync).toBe(false);
    expect(isGuestPublicHomeRuntime(runtime)).toBe(true);
    // It is not one of the static presentations, which reload on both sides.
    expect(isPublicClerkBypassRuntime(runtime)).toBe(false);
    expect(isGuestPublicHomeRuntime(buildPublicClerkBypassRuntime('pk_live_public_key'))).toBe(false);

    const at = (pathname: string, search = '') => shouldReloadAfterPublicPreviewNavigation({ runtime, hostname: 'www.chatboc.ar', pathname, search });
    expect(at('/t/tierra-del-fuego')).toBe(false);
    expect(at('/t/tierra-del-fuego/')).toBe(false);
    expect(at('/t/otra-organizacion')).toBe(false);
    expect(at('/t/tierra-del-fuego/login')).toBe(true);
    expect(at('/t/tierra-del-fuego/noticias')).toBe(true);
    expect(at('/perfil')).toBe(true);
    // The provider sending the visitor back to the home needs its runtime there.
    expect(at('/t/tierra-del-fuego', '?__clerk_status=verified')).toBe(true);

    // A page that already loaded the runtime keeps it when the visitor goes to the home.
    for (const loaded of [{ configurationWarnings: [] }, { configurationWarnings: [{ code: 'backend_config_unavailable' }] }]) {
      expect(shouldReloadAfterPublicPreviewNavigation({ runtime: loaded, hostname: 'www.chatboc.ar', pathname: '/t/tierra-del-fuego', search: '' })).toBe(false);
      expect(shouldReloadAfterPublicPreviewNavigation({ runtime: loaded, hostname: 'www.chatboc.ar', pathname: '/t/tierra-del-fuego/noticias', search: '' })).toBe(false);
    }
  });

  it('keeps production fail-closed when the backend contract is unavailable', () => {
    const runtime = buildClerkBackendUnavailableRuntime({
      allowEnvFallback: false,
      envEnabled: true,
      publishableKey: 'pk_live_public_key',
    });

    expect(runtime.enabled).toBe(false);
    expect(runtime.readyForSessionSync).toBe(false);
    expect(runtime.source).toBe('disabled');
    expect(runtime.environment).toBe('production');
    expect(runtime.productionReady).toBe(false);
    expect(runtime.configurationWarnings?.[0]?.code).toBe('backend_config_unavailable');
    expect(runtime.configurationWarnings?.[0]?.message).toContain('deshabilitado en produccion');
  });

  it('allows env fallback only for local development', () => {
    const runtime = buildClerkRuntimeFromEnv({
      allowEnvFallback: true,
      envEnabled: true,
      publishableKey: 'pk_test_local',
    });

    expect(runtime.enabled).toBe(true);
    expect(runtime.readyForSessionSync).toBe(true);
    expect(runtime.source).toBe('env');
    expect(runtime.environment).toBe('development');
    expect(runtime.productionReady).toBe(false);
  });
});
