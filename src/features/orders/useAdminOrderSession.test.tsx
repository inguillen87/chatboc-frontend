import React from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ adminGetOrder: vi.fn(), adminUpdateOrder: vi.fn(), adminListOrders: vi.fn(), getFulfillmentConfig: vi.fn() }));
vi.mock('@/api/client', () => ({ apiClient: api }));
import { useAdminOrderSession } from './useAdminOrderSession';
const order = (id = 'market:42', status = 'confirmed') => ({ id, status, items: [], total: 100, created_at: '2026-09-23T12:00:00Z' });
const deferred = <T,>() => { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
beforeEach(() => { Object.values(api).forEach((mock) => mock.mockReset()); api.adminGetOrder.mockResolvedValue(order()); api.getFulfillmentConfig.mockResolvedValue({ tenant: {} }); });
afterEach(cleanup);
const setup = async (tenant = 'junin', id = 'market:42') => {
  const view = renderHook(() => useAdminOrderSession(tenant, id));
  await waitFor(() => expect(view.result.current.loading).toBe(false)); return view;
};
describe('scoped administrative order session', () => {
  it('loads only the requested order, never a global list fallback', async () => {
    const view = await setup(); expect(view.result.current.order?.id).toBe('market:42'); expect(api.adminGetOrder).toHaveBeenCalledExactlyOnceWith('junin', 'market:42'); expect(api.adminListOrders).not.toHaveBeenCalled();
  });
  it.each([401, 403, 404, 500])('does not fetch a list after a detail failure %s', async (status) => {
    api.adminGetOrder.mockRejectedValue({ status }); const view = await setup();
    expect(view.result.current.order).toBeNull(); expect(view.result.current.error).toMatch(/verificar/); expect(api.adminListOrders).not.toHaveBeenCalled();
  });
  it('does not fetch with a path-injected tenant', async () => { const view = await setup('../other'); expect(view.result.current.order).toBeNull(); expect(api.adminGetOrder).not.toHaveBeenCalled(); });
  it('rejects a mismatched read identity', async () => { api.adminGetOrder.mockResolvedValue(order('conversational:42')); const view = await setup(); expect(view.result.current.order).toBeNull(); });
  it('issues exactly one mutation despite concurrent calls and does not announce before the receipt', async () => {
    const view = await setup(), pending = deferred<ReturnType<typeof order>>(); api.adminUpdateOrder.mockReturnValue(pending.promise);
    let first!: Promise<unknown>;
    await act(async () => { first = view.result.current.mutate({ status: 'shipped' }); expect(await view.result.current.mutate({ status: 'cancelled' })).toBeNull(); });
    expect(api.adminUpdateOrder).toHaveBeenCalledExactlyOnceWith('junin', 'market:42', { status: 'shipped' });
    expect(view.result.current.order?.status).toBe('confirmed'); expect(view.result.current.busy).toBe(true);
    await act(async () => { pending.resolve(order('market:42', 'shipped')); await first; });
    expect(view.result.current.order?.status).toBe('shipped'); expect(view.result.current.busy).toBe(false);
  });
  it('retains previous state and blocks writes on an incoherent success until explicit refresh', async () => {
    const view = await setup(); api.adminUpdateOrder.mockResolvedValue(order('other', 'shipped'));
    await act(async () => { await expect(view.result.current.mutate({ status: 'shipped' })).rejects.toThrow(); });
    expect(view.result.current.order?.status).toBe('confirmed'); expect(view.result.current.requiresRefresh).toBe(true);
    await act(async () => { expect(await view.result.current.mutate({ status: 'shipped' })).toBeNull(); });
    expect(api.adminUpdateOrder).toHaveBeenCalledTimes(1);
    await act(async () => { await view.result.current.refresh(); });
    expect(view.result.current.requiresRefresh).toBe(false); expect(api.adminUpdateOrder).toHaveBeenCalledTimes(1);
  });
  it.each([401, 403, 404])('removes detail and dispatch information on denied write %s', async (status) => {
    api.getFulfillmentConfig.mockResolvedValue({ tenant: { dispatch_email: 'private@example.test' } }); const view = await setup(); api.adminUpdateOrder.mockRejectedValue({ status });
    await act(async () => { await expect(view.result.current.mutate({ status: 'shipped' })).rejects.toEqual({ status }); });
    expect(view.result.current.order).toBeNull(); expect(view.result.current.dispatchInfo).toEqual({});
  });
  it('does not restore dispatch data from a late read after a denied write', async () => {
    const pending = deferred<{ tenant: { dispatch_email: string } }>(); api.getFulfillmentConfig.mockReturnValue(pending.promise);
    const view = await setup(); api.adminUpdateOrder.mockRejectedValue({ status: 403 });
    await act(async () => { await expect(view.result.current.mutate({ status: 'shipped' })).rejects.toEqual({ status: 403 }); });
    await act(async () => pending.resolve({ tenant: { dispatch_email: 'private@example.test' } }));
    expect(view.result.current.order).toBeNull(); expect(view.result.current.dispatchInfo).toEqual({});
  });
  it('never retries an uncertain mutation', async () => {
    const view = await setup(); api.adminUpdateOrder.mockRejectedValue(new Error('network'));
    await act(async () => { await expect(view.result.current.mutate({ status: 'shipped' })).rejects.toThrow(); });
    expect(view.result.current.requiresRefresh).toBe(true); expect(api.adminUpdateOrder).toHaveBeenCalledTimes(1);
  });
  it('ignores a read from an unmounted organization while another session loads the same ID', async () => {
    const old = deferred<ReturnType<typeof order>>(); api.adminGetOrder.mockReturnValueOnce(old.promise);
    const first = renderHook(() => useAdminOrderSession('junin', 'market:42')); first.unmount();
    const second = await setup('tierra-del-fuego');
    await act(async () => old.resolve({ ...order(), total: 999999 }));
    expect(second.result.current.order?.total).toBe(100);
  });
  it('returns no success to an old page after a write completes in another session', async () => {
    const first = await setup(), pending = deferred<ReturnType<typeof order>>(); api.adminUpdateOrder.mockReturnValue(pending.promise);
    let result!: Promise<unknown>; act(() => { result = first.result.current.mutate({ status: 'shipped' }); }); first.unmount();
    const second = await setup('tierra-del-fuego');
    await act(async () => { pending.resolve(order('market:42', 'shipped')); expect(await result).toBeNull(); });
    expect(second.result.current.order?.status).toBe('confirmed');
  });
  it('supports StrictMode remount effects without accepting the obsolete first read', async () => {
    const old = deferred<ReturnType<typeof order>>(); api.adminGetOrder.mockReturnValueOnce(old.promise);
    const view = renderHook(() => useAdminOrderSession('junin', 'market:42'), { wrapper: ({ children }) => <React.StrictMode>{children}</React.StrictMode> });
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    await act(async () => old.resolve({ ...order(), total: 999 })); expect(view.result.current.order?.total).toBe(100);
  });
});
