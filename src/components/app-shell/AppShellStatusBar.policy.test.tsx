import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShellStatusBar } from './AppShellStatusBar';
const policy = vi.hoisted(() => ({ enabled: false, run: vi.fn() }));
vi.mock('@/utils/runtimeRecoveryPolicy', () => ({ isRuntimeRecoveryEnabled: () => policy.enabled }));
vi.mock('@/utils/backendBootstrapGate', async original => ({
  ...(await original<typeof import('@/utils/backendBootstrapGate')>()), ensureBackendRuntimeReady: policy.run,
}));
beforeEach(() => { policy.enabled = false; policy.run.mockReset().mockResolvedValue(undefined); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const event = (name: string) => act(() => window.dispatchEvent(new Event(name)));
describe('disabled recovery visibility', () => {
  it('does not display offline state when initially offline and disabled', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    render(<AppShellStatusBar />);
    expect(screen.queryByTestId('runtime-recovery-bar')).toBeNull();
    expect(policy.run).not.toHaveBeenCalled();
  });
  it('does not display offline state after an offline event when disabled', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    render(<AppShellStatusBar />); event('offline');
    expect(screen.queryByTestId('runtime-recovery-bar')).toBeNull();
    expect(policy.run).not.toHaveBeenCalled();
  });
  it('hides an existing offline state when the current route is excluded', () => {
    policy.enabled = true; vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    render(<AppShellStatusBar />); expect(screen.getByTestId('runtime-recovery-bar')).toBeVisible();
    policy.enabled = false; event('offline');
    expect(screen.queryByTestId('runtime-recovery-bar')).toBeNull();
  });
  it('performs no reconnect probe after an excluded offline event', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    render(<AppShellStatusBar />); event('offline'); event('online');
    await act(async () => { await Promise.resolve(); });
    expect(policy.run).not.toHaveBeenCalled();
    expect(screen.queryByTestId('runtime-recovery-bar')).toBeNull();
  });
});
