import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOperationsRefresh } from './useOperationsRefresh';
const listeners = new Map<string, (payload?: unknown) => void>();
const socket = { on: vi.fn((event, fn) => { listeners.set(event, fn); }), off: vi.fn((event) => { listeners.delete(event); }) };
let hidden = false;
beforeEach(() => { vi.useFakeTimers(); hidden = false; listeners.clear(); vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden); });
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
const options = (run = vi.fn().mockResolvedValue(undefined)) => ({ scopeKey: 'org-a:7', tenantSlug: 'org-a', pollSeconds: 20, socket, connected: true, eventNames: ['ticket.updated'], run });
describe('operational refresh lifecycle', () => {
  it('pauses periodic reads when hidden and refreshes once after returning', async () => {
    const input = options(), view = renderHook(() => useOperationsRefresh(input));
    act(() => { hidden = true; document.dispatchEvent(new Event('visibilitychange')); });
    expect(view.result.current.paused).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
    expect(input.run).not.toHaveBeenCalled();
    act(() => { hidden = false; document.dispatchEvent(new Event('visibilitychange')); });
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(input.run).toHaveBeenCalledExactlyOnceWith('all'); view.unmount();
  });
  it('does not run the old scheduled event under a new organization or filter', async () => {
    const first = options(), second = { ...options(), tenantSlug: 'org-b', scopeKey: 'org-b:7' };
    const view = renderHook((input) => useOperationsRefresh(input), { initialProps: first });
    act(() => listeners.get('ticket.updated')?.({ tenant_slug: 'org-a' }));
    view.rerender(second);
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(first.run).not.toHaveBeenCalled(); expect(second.run).not.toHaveBeenCalled(); view.unmount();
  });
  it('ignores events without a coherent organization and detaches all work on unmount', async () => {
    const input = options(), view = renderHook(() => useOperationsRefresh(input));
    act(() => { listeners.get('ticket.updated')?.({}); listeners.get('ticket.updated')?.({ tenant_slug: 'org-b' }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(input.run).not.toHaveBeenCalled();
    view.unmount(); expect(listeners.size).toBe(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); }); expect(input.run).not.toHaveBeenCalled();
  });
});
