import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderIdentityError, ORDER_REQUEST_TIMEOUT_MS, useVerifiedOrder } from './useVerifiedOrder';
type Order = { id: string; estado: string };
const pending = (data: Order) => data.estado === 'pending';
const flush = async () => { await act(async () => { await Promise.resolve(); }); };
const deferred = () => { let resolve!: (value: Order) => void;
  const promise = new Promise<Order>((r) => { resolve = r; }); return { promise, resolve }; };

describe('order continuity and permission-safe recovery', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true); });
  afterEach(() => { cleanup(); vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });
  it('retains same-order details and timestamp while manually refreshing', async () => {
    const waiting = deferred(), order = { id: '1', estado: 'paid' };
    const load = vi.fn().mockResolvedValueOnce(order).mockReturnValue(waiting.promise);
    const { result } = renderHook(() => useVerifiedOrder('a:1', load, pending)); await flush();
    const previous = result.current.lastCheckedAt;
    await act(async () => { result.current.refresh(); });
    expect(result.current.data).toEqual(order); expect(result.current.isLoading).toBe(true);
    expect(result.current.lastCheckedAt).toBe(previous);
    await act(async () => { waiting.resolve(order); });
    expect(result.current.isLoading).toBe(false);
  });
  it('retains last data on transient network failure but marks verification failed', async () => {
    const order = { id: '1', estado: 'paid' };
    const load = vi.fn().mockResolvedValueOnce(order).mockRejectedValue(new Error('secret-url'));
    const { result } = renderHook(() => useVerifiedOrder('a:1', load, pending)); await flush();
    await act(async () => { result.current.refresh(); });
    expect(result.current.data).toEqual(order); expect(result.current.error).not.toContain('secret-url');
    expect(result.current.autoRefreshStopped).toBe(true);
  });
  it.each([401, 403, 404])('removes data and timestamp if access is rejected with %s', async (status) => {
    const load = vi.fn().mockResolvedValueOnce({ id: '1', estado: 'paid' }).mockRejectedValue({ status });
    const { result } = renderHook(() => useVerifiedOrder('a:1', load, pending)); await flush();
    await act(async () => { result.current.refresh(); });
    expect(result.current.data).toBeNull(); expect(result.current.lastCheckedAt).toBeNull();
    expect(result.current.error).toContain('acceder');
  });
  it('clears a previously confirmed order if the server changes its identity', async () => {
    const load = vi.fn().mockResolvedValueOnce({ id: '1', estado: 'paid' }).mockRejectedValue(new OrderIdentityError());
    const { result } = renderHook(() => useVerifiedOrder('a:1', load, pending)); await flush();
    await act(async () => { result.current.refresh(); }); expect(result.current.data).toBeNull();
  });
  it('clears previous data even if only the loader identity changes', async () => {
    const first = vi.fn().mockResolvedValue({ id: '1', estado: 'paid' });
    const second = vi.fn(() => new Promise<Order>(() => {}));
    const { result, rerender } = renderHook(({ load }) => useVerifiedOrder('a:1', load, pending), { initialProps: { load: first } });
    await flush(); rerender({ load: second }); expect(result.current.data).toBeNull();
  });
  it('times out a stalled read, aborts it, and ignores its eventual response', async () => {
    const waiting = deferred(), load = vi.fn(() => waiting.promise);
    const { result } = renderHook(() => useVerifiedOrder('a:1', load, pending)); await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync(ORDER_REQUEST_TIMEOUT_MS); });
    expect(load.mock.calls[0][0].aborted).toBe(true); expect(result.current.isLoading).toBe(false);
    expect(result.current.error).not.toBeNull();
    await act(async () => { waiting.resolve({ id: '1', estado: 'paid' }); });
    expect(result.current.data).toBeNull(); expect(load).toHaveBeenCalledTimes(1);
  });
  it('does not use network or recurring timers offline, then resumes once', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const load = vi.fn().mockResolvedValue({ id: '1', estado: 'paid' });
    const { result } = renderHook(() => useVerifiedOrder('a:1', load, pending)); await flush();
    expect(result.current.pauseReason).toBe('offline'); expect(result.current.isLoading).toBe(false);
    expect(vi.getTimerCount()).toBe(0); expect(load).not.toHaveBeenCalled();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    await act(async () => { window.dispatchEvent(new Event('online')); });
    expect(load).toHaveBeenCalledTimes(1); expect(result.current.pauseReason).toBeNull();
  });
  it('does not restart a completed or failed check on focus or reconnect', async () => {
    const load = vi.fn().mockResolvedValue({ id: '1', estado: 'paid' });
    renderHook(() => useVerifiedOrder('a:1', load, pending)); await flush();
    await act(async () => { window.dispatchEvent(new Event('online')); document.dispatchEvent(new Event('visibilitychange')); });
    expect(load).toHaveBeenCalledTimes(1);
  });
});
