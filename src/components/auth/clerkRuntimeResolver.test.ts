import { describe, expect, it } from 'vitest';

import {
  buildClerkBackendUnavailableRuntime,
  buildPublicClerkBypassRuntime,
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
