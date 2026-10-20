import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertOperationsResponseScope, createOperationsRefreshCoordinator, operationsEventMatchesTenant, operationsSourceState, operationsTenantSlug, visibleOperationsQuery } from './operationsReadState';
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>((yes) => { resolve = yes; }); return { promise, resolve }; };
describe('operational source identity and read state', () => {
  it.each([undefined, null, '', '../other', 'org-a?x=2', ' org-a'])('requires an explicit canonical tenant: %s', (value) => expect(operationsTenantSlug(value)).toBeNull());
  it.each([{ tenant_slug: 'org-a' }, { tenant: { slug: 'org-a' } }, { payload: { tenant_slug: 'org-a' } }])('accepts coherent scoped events', (event) => expect(operationsEventMatchesTenant(event, 'org-a')).toBe(true));
  it.each([undefined, {}, { tenant_slug: 'org-b' }, { tenant_slug: 'org-a', payload: { tenant_slug: 'org-b' } }, { tenant_slug: '', tenant: 'org-a' }])('rejects unscoped, foreign or ambiguous events', (event) => expect(operationsEventMatchesTenant(event, 'org-a')).toBe(false));
  it('rejects a mismatched source instead of rendering another organization', () => {
    expect(() => assertOperationsResponseScope({ tenant: { slug: 'org-b' } }, 'org-a')).toThrow();
    expect(() => assertOperationsResponseScope({ tenant_slug: 'org-b' }, 'org-a')).toThrow();
  });
  it('allows optional absent identity without claiming it replaces server authorization', () => {
    expect(assertOperationsResponseScope(null, 'org-a')).toBeNull();
    expect(assertOperationsResponseScope({ total: 0 }, 'org-a')).toEqual({ total: 0 });
  });
  it('withdraws cached data after failure without mutating the query object', () => {
    const query = { data: { private: true }, isError: true, isFetching: false };
    expect(visibleOperationsQuery(query).data).toBeUndefined(); expect(query.data.private).toBe(true);
    expect(visibleOperationsQuery({ ...query, isError: false }).data).toEqual(query.data);
  });
  it('distinguishes errors, fresh reads, absent publications and pending requests', () => {
    const source = { id: 'map', label: 'Map', isError: false, isFetching: false, isLoading: false, data: undefined };
    expect(operationsSourceState(source)).toBe('empty');
    expect(operationsSourceState({ ...source, fetchStatus: 'paused' })).toBe('paused');
    expect(operationsSourceState({ ...source, data: {} })).toBe('ready');
    expect(operationsSourceState({ ...source, isFetching: true })).toBe('loading');
    expect(operationsSourceState({ ...source, data: {}, isFetching: true })).toBe('refreshing');
    expect(operationsSourceState({ ...source, data: {}, isError: true })).toBe('error');
  });
});
describe('batched operational refresh coordinator', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });
  it('coalesces 50 socket events into one batch', async () => {
    const run = vi.fn().mockResolvedValue(undefined), queue = createOperationsRefreshCoordinator({ run, visible: () => true });
    for (let n = 0; n < 50; n++) queue.request('core');
    expect(run).not.toHaveBeenCalled(); await vi.advanceTimersByTimeAsync(250);
    expect(run).toHaveBeenCalledExactlyOnceWith('core'); queue.dispose();
  });
  it('merges timer and event work using the wider refresh without concurrent batches', async () => {
    const pending = deferred(), run = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue(undefined);
    const queue = createOperationsRefreshCoordinator({ run, visible: () => true });
    queue.request('core'); await vi.advanceTimersByTimeAsync(250);
    for (let n = 0; n < 10; n++) queue.request('core');
    queue.request('all', 'timer'); await vi.advanceTimersByTimeAsync(1000); expect(run).toHaveBeenCalledOnce();
    pending.resolve(); await vi.advanceTimersByTimeAsync(250);
    expect(run.mock.calls.map(([mode]) => mode)).toEqual(['core', 'all']); queue.dispose();
  });
  it('prevents repeated manual refreshes during the same batch', async () => {
    const pending = deferred(), run = vi.fn().mockReturnValue(pending.promise), queue = createOperationsRefreshCoordinator({ run, visible: () => true });
    queue.request('all', 'manual'); queue.request('all', 'manual');
    expect(run).toHaveBeenCalledOnce(); pending.resolve(); await vi.advanceTimersByTimeAsync(1000);
    expect(run).toHaveBeenCalledOnce(); queue.dispose();
  });
  it('does not request while hidden and consolidates pending changes on return', async () => {
    let visible = false; const run = vi.fn().mockResolvedValue(undefined), queue = createOperationsRefreshCoordinator({ run, visible: () => visible });
    queue.request('core'); queue.request('all', 'timer'); await vi.advanceTimersByTimeAsync(5000); expect(run).not.toHaveBeenCalled();
    visible = true; queue.visibilityChanged(); queue.request('all', 'resume'); await vi.advanceTimersByTimeAsync(250);
    expect(run).toHaveBeenCalledExactlyOnceWith('all'); queue.dispose();
  });
  it('cancels scheduled work when the tab becomes hidden before the timer runs', async () => {
    let visible = true; const run = vi.fn().mockResolvedValue(undefined), queue = createOperationsRefreshCoordinator({ run, visible: () => visible });
    queue.request('core'); visible = false; queue.visibilityChanged(); await vi.advanceTimersByTimeAsync(250);
    expect(run).not.toHaveBeenCalled(); queue.dispose();
  });
  it('drops scheduled work from a disposed tenant session', async () => {
    const run = vi.fn().mockResolvedValue(undefined), queue = createOperationsRefreshCoordinator({ run, visible: () => true });
    queue.request('all'); queue.dispose(); await vi.advanceTimersByTimeAsync(1000); expect(run).not.toHaveBeenCalled();
  });
  it('does not execute a trailing request after the old session is disposed', async () => {
    const pending = deferred(), run = vi.fn().mockReturnValue(pending.promise), busy = vi.fn();
    const queue = createOperationsRefreshCoordinator({ run, visible: () => true, onBusy: busy });
    queue.request('all', 'manual'); queue.request('core'); queue.dispose(); pending.resolve();
    await vi.advanceTimersByTimeAsync(1000); expect(run).toHaveBeenCalledOnce(); expect(busy.mock.calls).toEqual([[true]]);
  });
  it('recovers the scheduler after a rejected read without an automatic retry loop', async () => {
    const run = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const queue = createOperationsRefreshCoordinator({ run, visible: () => true });
    queue.request('all', 'manual'); await vi.advanceTimersByTimeAsync(1000); expect(run).toHaveBeenCalledOnce();
    queue.request('all', 'manual'); await vi.advanceTimersByTimeAsync(1); expect(run).toHaveBeenCalledTimes(2); queue.dispose();
  });
});
