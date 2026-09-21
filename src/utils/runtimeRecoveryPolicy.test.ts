import { afterEach, describe, expect, it, vi } from 'vitest';
import { isRuntimeRecoveryEnabled } from './runtimeRecoveryPolicy';
import { isBackendBootstrapGateEnabled } from './backendBootstrapGate';
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); window.history.replaceState({}, '', '/'); });
describe('read-only recovery policy', () => {
  it('supports ordinary domains without enabling pre-mount startup blocking', () => {
    vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
    expect(isBackendBootstrapGateEnabled()).toBe(false);
    expect(isRuntimeRecoveryEnabled()).toBe(true);
  });
  it('does not treat an offline browser hint as a service or authorization gate', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(isRuntimeRecoveryEnabled()).toBe(true);
  });
  it.each(['false', '0', 'off', 'unexpected'])('honors disabled or invalid override %s', value => {
    vi.stubEnv('VITE_RUNTIME_RECOVERY_ENABLED', value); expect(isRuntimeRecoveryEnabled()).toBe(false);
  });
  it.each(['true', '1', 'on'])('honors enabled override %s', value => {
    vi.stubEnv('VITE_RUNTIME_RECOVERY_ENABLED', value); expect(isRuntimeRecoveryEnabled()).toBe(true);
  });
  it('keeps the API-independent institutional presentation excluded', () => {
    window.history.replaceState({}, '', '/demo/institucional/tdf-discapacidad');
    expect(isRuntimeRecoveryEnabled()).toBe(false);
  });
});
