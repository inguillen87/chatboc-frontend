import { describe, expect, it } from 'vitest';

import {
  buildClerkBackendUnavailableRuntime,
  buildClerkRuntimeFromEnv,
} from './clerkRuntimeResolver';

describe('clerkRuntimeResolver', () => {
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
