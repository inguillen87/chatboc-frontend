import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTenantHostBinding } from './useTenantHostBinding';
import { tenantHostFixture } from '@/test/fixtures/tenantHost';
import { publishTenantHostRuntime, readActiveTenantHostRuntime } from '@/utils/tenantHostBinding';
const lookup = vi.hoisted(() => vi.fn());
vi.mock('@/api/tenantHost', () => ({ getTenantHostBinding: lookup }));
function host(hostname: string) {
  const original = window;
  vi.stubGlobal('window', new Proxy(original, { get(target, key) {
    return key === 'location' ? { hostname, origin: `https://${hostname}`, pathname: '/' } : Reflect.get(target, key);
  } }));
}
beforeEach(() => { lookup.mockReset(); host('atencion.example.test'); publishTenantHostRuntime(null); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); publishTenantHostRuntime(null); });
describe('complete host binding lifecycle', () => {
  it('withdraws the public binding at expiration and aborts the original request on unmount', async () => {
    vi.useFakeTimers(); const binding = tenantHostFixture(); binding.binding.valid_until = Math.floor(Date.now()/1000)+5;
    lookup.mockResolvedValue(binding); const view = renderHook(() => useTenantHostBinding());
    await act(async () => { await Promise.resolve(); });
    expect(view.result.current.binding?.tenant.slug).toBe('government-east');
    expect(readActiveTenantHostRuntime('atencion.example.test')).not.toBeNull();
    await act(async () => { vi.advanceTimersByTime(5001); });
    expect(view.result.current.status).toBe('unavailable'); expect(view.result.current.binding).toBeNull();
    expect(readActiveTenantHostRuntime('atencion.example.test')).toBeNull();
    view.unmount(); expect(lookup.mock.calls[0][1].aborted).toBe(true);
  });
  it('rejects a retired response when a refresh has already started', async () => {
    let resolve!: (value: ReturnType<typeof tenantHostFixture>) => void;
    lookup.mockReturnValueOnce(new Promise(done => { resolve = done; })).mockResolvedValueOnce(tenantHostFixture('atencion.example.test', 'new-organization'));
    const view = renderHook(() => useTenantHostBinding());
    act(() => view.result.current.refresh());
    await act(async () => { await Promise.resolve(); });
    expect(view.result.current.binding?.tenant.slug).toBe('new-organization');
    await act(async () => { resolve(tenantHostFixture()); });
    expect(view.result.current.binding?.tenant.slug).toBe('new-organization');
    expect(readActiveTenantHostRuntime('atencion.example.test')?.tenant.slug).toBe('new-organization');
    expect(lookup.mock.calls[0][1].aborted).toBe(true);
  });
  it('does not resolve a custom binding on the shared Chatboc host', () => {
    host('www.chatboc.ar'); const view = renderHook(() => useTenantHostBinding());
    expect(view.result.current.status).toBe('platform'); expect(lookup).not.toHaveBeenCalled();
    expect(view.result.current.binding).toBeNull();
  });
});
