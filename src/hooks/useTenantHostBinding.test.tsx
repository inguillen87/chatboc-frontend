import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTenantHostBinding } from './useTenantHostBinding';
import { tenantHostFixture } from '@/test/fixtures/tenantHost';
import { publishTenantHostRuntime, readActiveTenantHostRuntime, requiresTenantHostBinding,
  TenantHostNotPublishedError, TenantHostUnavailableError } from '@/utils/tenantHostBinding';
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
  it.each(['atencion.example.test', 'synthetic-alias.vercel.app'])('withdraws %s at expiration without releasing it to generic Preview', async hostname => {
    host(hostname);
    vi.useFakeTimers(); const binding = tenantHostFixture(hostname); binding.binding.valid_until = Math.floor(Date.now()/1000)+5;
    lookup.mockResolvedValue(binding); const view = renderHook(() => useTenantHostBinding());
    await act(async () => { await Promise.resolve(); });
    expect(view.result.current.binding?.tenant.slug).toBe('government-east');
    expect(readActiveTenantHostRuntime(hostname)).not.toBeNull();
    await act(async () => { vi.advanceTimersByTime(5001); });
    expect(view.result.current.status).toBe('unavailable'); expect(view.result.current.binding).toBeNull();
    expect(readActiveTenantHostRuntime(hostname)).toBeNull();
    expect(view.result.current.required).toBe(true); expect(requiresTenantHostBinding(hostname)).toBe(true);
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
  it('discovers an exact alias before releasing an explicitly unbound Preview, without effect loops', async () => {
    host('synthetic-preview.vercel.app');
    let reject!: (error: Error) => void;
    lookup.mockReturnValueOnce(new Promise((_resolve, fail) => { reject = fail; }));
    const view = renderHook(() => useTenantHostBinding());
    expect(view.result.current.required).toBe(true); expect(view.result.current.binding).toBeNull();
    expect(requiresTenantHostBinding('synthetic-preview.vercel.app')).toBe(true);
    await act(async () => { reject(new TenantHostNotPublishedError()); });
    expect(view.result.current.status).toBe('platform'); expect(view.result.current.required).toBe(false);
    expect(requiresTenantHostBinding('synthetic-preview.vercel.app')).toBe(false);
    expect(requiresTenantHostBinding('another-preview.vercel.app')).toBe(true);
    view.rerender();
    expect(lookup).toHaveBeenCalledTimes(1);
    lookup.mockResolvedValueOnce(tenantHostFixture('synthetic-preview.vercel.app'));
    act(() => view.result.current.refresh());
    expect(requiresTenantHostBinding('synthetic-preview.vercel.app')).toBe(true);
    await act(async () => { await Promise.resolve(); });
    expect(view.result.current.required).toBe(true);
    expect(view.result.current.binding?.tenant.slug).toBe('government-east');
  });
  it.each([new TenantHostUnavailableError(), new Error('timeout'), new SyntaxError('malformed JSON')])
    ('keeps a deployment alias unavailable when discovery fails instead of explicitly declining it', async error => {
      host('synthetic-preview.vercel.app'); lookup.mockRejectedValue(error);
      const view = renderHook(() => useTenantHostBinding());
      await act(async () => { await Promise.resolve(); });
      expect(view.result.current.status).toBe('unavailable'); expect(view.result.current.required).toBe(true);
      expect(requiresTenantHostBinding('synthetic-preview.vercel.app')).toBe(true);
    });
  it('does not treat an unbound custom hostname as generic Preview', async () => {
    lookup.mockRejectedValue(new TenantHostNotPublishedError());
    const view = renderHook(() => useTenantHostBinding());
    await act(async () => { await Promise.resolve(); });
    expect(view.result.current.status).toBe('unavailable'); expect(view.result.current.required).toBe(true);
  });
  it('ignores a retired negative response after an alias refresh finds a valid binding', async () => {
    host('synthetic-preview.vercel.app');
    let reject!: (error: Error) => void;
    lookup.mockReturnValueOnce(new Promise((_resolve, fail) => { reject = fail; }))
      .mockResolvedValueOnce(tenantHostFixture('synthetic-preview.vercel.app'));
    const view = renderHook(() => useTenantHostBinding());
    act(() => view.result.current.refresh());
    await act(async () => { await Promise.resolve(); });
    await act(async () => { reject(new TenantHostNotPublishedError()); });
    expect(view.result.current.status).toBe('active'); expect(view.result.current.required).toBe(true);
    expect(readActiveTenantHostRuntime('synthetic-preview.vercel.app')?.tenant.slug).toBe('government-east');
  });
});
