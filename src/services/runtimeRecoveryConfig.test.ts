import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../tests/fixtures/runtime-recovery-ui.json';
import { getRuntimeRecoveryUI, loadRuntimeRecoveryUI, resetRuntimeRecoveryUIForTests } from './runtimeRecoveryConfig';
const response = (value: unknown = fixture) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
const fetcher = vi.fn();
beforeEach(() => { resetRuntimeRecoveryUIForTests(); fetcher.mockReset(); vi.stubGlobal('fetch', fetcher); });
afterEach(() => { resetRuntimeRecoveryUIForTests(); vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('public configuration loading', () => {
  it('shares one anonymous request and keeps only validated in-memory copy', async () => {
    fetcher.mockResolvedValue(response()); const first = loadRuntimeRecoveryUI();
    expect(loadRuntimeRecoveryUI()).toBe(first);
    expect(await first).toEqual(fixture); expect(await loadRuntimeRecoveryUI()).toEqual(fixture);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith('/api/config/runtime-recovery', expect.objectContaining({
      method: 'GET', credentials: 'omit', cache: 'no-store', headers: { Accept: 'application/json' },
    }));
  });
  it('leaves an old backend without this endpoint compatible and retryable', async () => {
    fetcher.mockResolvedValueOnce(new Response('', { status: 404 })).mockResolvedValueOnce(response());
    expect(await loadRuntimeRecoveryUI()).toBeNull(); expect(getRuntimeRecoveryUI()).toBeNull();
    expect(await loadRuntimeRecoveryUI()).toEqual(fixture); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('does not invent local copy when the network fails', async () => {
    fetcher.mockRejectedValue(new TypeError('offline'));
    expect(await loadRuntimeRecoveryUI()).toBeNull(); expect(getRuntimeRecoveryUI()).toBeNull();
  });
  it('rejects HTML, invalid JSON, oversized bodies and tenant-scoped contracts', async () => {
    for (const value of [new Response('<html>login</html>', { headers: { 'content-type': 'text/html' } }),
      new Response('not-json', { headers: { 'content-type': 'application/json' } }),
      new Response(' '.repeat(16385), { headers: { 'content-type': 'application/json' } }), response({ ...fixture, scope: 'tenant' })]) {
      fetcher.mockResolvedValueOnce(value); expect(await loadRuntimeRecoveryUI()).toBeNull();
    }
  });
  it('bounds an unresponsive request and aborts the fetch', async () => {
    vi.useFakeTimers(); fetcher.mockImplementation(() => new Promise(() => {}));
    const request = loadRuntimeRecoveryUI(); await vi.advanceTimersByTimeAsync(8001);
    expect(await request).toBeNull(); expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
  });
  it('does not cache a superseded response after test/reset invalidation', async () => {
    let finish!: (value: Response) => void; fetcher.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const request = loadRuntimeRecoveryUI(); resetRuntimeRecoveryUIForTests(); finish(response());
    await request; expect(getRuntimeRecoveryUI()).toBeNull();
  });
});
