import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ORDER_REFRESH_DELAYS_MS, useVerifiedOrder } from './useVerifiedOrder';
type Order = { id: string; estado: string };
const pending = (order: Order) => order.estado === 'pending';
const flush = async () => { await act(async () => { await Promise.resolve(); }); };

describe('bounded verified order reads', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible'); });
  afterEach(() => { cleanup(); vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });
  it('does not fetch without a scoped order', async () => {
    const load = vi.fn();
    const { result } = renderHook(() => useVerifiedOrder(null, load, pending));
    await flush();
    expect(load).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });
  it('stops polling after the backend confirms payment', async () => {
    const load = vi.fn().mockResolvedValueOnce({ id: '1', estado: 'pending' }).mockResolvedValue({ id: '1', estado: 'paid' });
    const { result } = renderHook(() => useVerifiedOrder('tenant:1', load, pending));
    await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(result.current.data?.estado).toBe('paid');
    await act(async () => { await vi.advanceTimersByTimeAsync(120000); });
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('limits pending reads to one initial request plus six retries', async () => {
    const load = vi.fn().mockResolvedValue({ id: '1', estado: 'pending' });
    const { result } = renderHook(() => useVerifiedOrder('tenant:1', load, pending));
    await flush();
    for (const delay of ORDER_REFRESH_DELAYS_MS) {
      await act(async () => { await vi.advanceTimersByTimeAsync(delay); });
    }
    expect(result.current.autoRefreshStopped).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(120000); });
    expect(load).toHaveBeenCalledTimes(7);
  });
  it('aborts on unmount and clears pending retries', async () => {
    const load = vi.fn().mockResolvedValue({ id: '1', estado: 'pending' });
    const { unmount } = renderHook(() => useVerifiedOrder('tenant:1', load, pending));
    await flush();
    const signal = load.mock.calls[0][0] as AbortSignal;
    unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(120000); });
    expect(load).toHaveBeenCalledTimes(1);
  });
  it('allows an explicit retry after failure without leaking the exception', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('private-provider-detail')).mockResolvedValue({ id: '1', estado: 'paid' });
    const { result } = renderHook(() => useVerifiedOrder('tenant:1', load, pending));
    await flush();
    expect(result.current.error).not.toContain('private-provider-detail');
    await act(async () => { result.current.refresh(); });
    expect(result.current.data?.estado).toBe('paid');
    expect(result.current.error).toBeNull();
  });
  it('does not overlap requests while a read is in flight', async () => {
    const load = vi.fn(() => new Promise<Order>(() => {}));
    renderHook(() => useVerifiedOrder('tenant:1', load, pending));
    await act(async () => { await vi.advanceTimersByTimeAsync(120000); });
    expect(load).toHaveBeenCalledTimes(1);
  });
  it('pauses network reads while the tab is hidden', async () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    const load = vi.fn().mockResolvedValue({ id: '1', estado: 'paid' });
    renderHook(() => useVerifiedOrder('tenant:1', load, pending));
    await flush();
    expect(load).not.toHaveBeenCalled();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(load).toHaveBeenCalledTimes(1);
  });
  it('ignores a late response after the tenant or order changes', async () => {
    let complete!: (value: Order) => void;
    const first = vi.fn(() => new Promise<Order>((resolve) => { complete = resolve; }));
    const second = vi.fn().mockResolvedValue({ id: '2', estado: 'paid' });
    const { result, rerender } = renderHook(({ scope, load }) => useVerifiedOrder(scope, load, pending), { initialProps: { scope: 'a:1', load: first } });
    await flush();
    rerender({ scope: 'b:2', load: second });
    await flush();
    await act(async () => { complete({ id: '1', estado: 'paid' }); });
    expect(result.current.data?.id).toBe('2');
    expect(result.current.scope).toBe('b:2');
  });
});
