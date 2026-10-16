import { afterEach, describe, expect, it, vi } from 'vitest';
import { AsyncOperationTimeoutError } from './asyncTimeout';
import { STARTUP_CONTINUITY_BUDGET_MS } from './backendRequestContinuity';

const runtime = vi.hoisted(() => ({ ready: vi.fn() }));
vi.mock('./backendBootstrapGate', () => ({
  ensureBackendRuntimeReady: runtime.ready,
  invalidateBackendRuntimeReady: vi.fn(),
}));
import { withBackendReadTimeout } from './backendReadTimeout';

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe('private read deadlines across Vercel startup', () => {
  it('keeps a valid read available when readiness takes longer than the old screen deadline', async () => {
    vi.useFakeTimers();
    let finishStartup!: () => void;
    runtime.ready.mockReturnValue(new Promise<void>(resolve => { finishStartup = resolve; }));
    const read = vi.fn().mockResolvedValue({ tenant: { slug: 'junin' }, modules: ['operations'] });
    const result = withBackendReadTimeout(read, 8_000, 'Navigation', '/api/app/backoffice/navigation');
    await vi.advanceTimersByTimeAsync(9_000);
    expect(read).not.toHaveBeenCalled();
    finishStartup();
    await expect(result).resolves.toEqual({ tenant: { slug: 'junin' }, modules: ['operations'] });
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('does not issue a private read after readiness fails', async () => {
    runtime.ready.mockRejectedValue(new Error('startup unavailable'));
    const read = vi.fn();
    await expect(withBackendReadTimeout(read, 8_000, 'Navigation', '/api/app/backoffice/navigation'))
      .rejects.toThrow('startup unavailable');
    expect(read).not.toHaveBeenCalled();
  });

  it('retires a read without dispatch when its session changes during startup', async () => {
    let finishStartup!: () => void;
    let current = true;
    runtime.ready.mockReturnValue(new Promise<void>(resolve => { finishStartup = resolve; }));
    const read = vi.fn();
    const result = withBackendReadTimeout(read, 8_000, 'Navigation', '/api/app/backoffice/navigation', () => current);
    const rejection = expect(result).rejects.toThrow('Private read scope expired');
    current = false;
    finishStartup();
    await rejection;
    expect(read).not.toHaveBeenCalled();
  });

  it('allows bounded safe startup recovery after dispatch, then fails a hung read', async () => {
    vi.useFakeTimers();
    runtime.ready.mockResolvedValue(undefined);
    const read = vi.fn().mockReturnValue(new Promise(() => {}));
    const result = withBackendReadTimeout(read, 8_000, 'Navigation', '/api/app/backoffice/navigation');
    const rejection = expect(result).rejects.toBeInstanceOf(AsyncOperationTimeoutError);
    await vi.advanceTimersByTimeAsync(STARTUP_CONTINUITY_BUDGET_MS + 8_000);
    await rejection;
    expect(read).toHaveBeenCalledTimes(1);
  });
});
