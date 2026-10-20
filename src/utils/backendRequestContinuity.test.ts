import { afterEach, describe, expect, it, vi } from 'vitest';
import { abortablePause, fetchWithStartupContinuity, hasUndispatchedStartupReceipt } from './backendRequestContinuity';
import { resetBackendBootstrapGateForTests } from './backendBootstrapGate';

const payload = { contract_version: 'chatboc.bootstrap.v1', status_code: 503, ok: false,
  reason_code: 'application_initializing', retryable: true, request_dispatched: false, action_hint: 'retry_after' };
const cold = (changes = {}, status = 503, headers = {}) => new Response(JSON.stringify({ ...payload, ...changes }), {
  status, headers: { 'Content-Type': 'application/json', 'X-Chatboc-Bootstrap': 'initializing', 'Retry-After': '2', ...headers },
});
const ready = () => new Response('{"ok":true}', { status: 200 });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); resetBackendBootstrapGateForTests(); });

describe('pre-dispatch startup evidence', () => {
  it('accepts the exact receipt without consuming the caller body', async () => {
    const response = cold();
    expect(await hasUndispatchedStartupReceipt(response)).toBe(true);
    expect(await response.json()).toEqual(payload);
  });
  it.each([
    { request_dispatched: true }, { request_dispatched: undefined }, { retryable: false },
    { contract_version: 'other' }, { status_code: 500 }, { ok: true }, { action_hint: 'other' },
    { reason_code: 'cutover_writer_fence_enabled' }, { reason_code: 'application_initialization_failed' },
  ])('rejects non-equivalent evidence %j', async change => {
    expect(await hasUndispatchedStartupReceipt(cold(change))).toBe(false);
  });
  it('rejects receipts without the transport boundary header', async () => {
    expect(await hasUndispatchedStartupReceipt(cold({}, 503, { 'X-Chatboc-Bootstrap': '' }))).toBe(false);
  });
  it('rejects oversized and invalid receipt bodies', async () => {
    expect(await hasUndispatchedStartupReceipt(cold({ padding: 'x'.repeat(5000) }))).toBe(false);
    const response = cold();
    const invalid = new Response('{', { status: 503, headers: response.headers });
    expect(await hasUndispatchedStartupReceipt(invalid)).toBe(false);
  });
});

describe('same-destination recovery', () => {
  it.each([['GET', '/api/admin/tenants'], ['POST', '/api/auth/clerk/session']])(
    'continues only an unexecuted %s request', async (method, url) => {
      const fetcher = vi.fn().mockResolvedValueOnce(cold()).mockResolvedValueOnce(ready());
      const wait = vi.fn().mockResolvedValue(undefined), probe = vi.fn().mockResolvedValue(undefined);
      const init = { method, headers: { 'X-Tenant': 'synthetic-tenant' }, body: method === 'POST' ? '{"synthetic":true}' : undefined };
      const result = await fetchWithStartupContinuity(url, init, { fetcher, wait, ready: probe });
      expect(result.status).toBe(200); expect(fetcher).toHaveBeenCalledTimes(2);
      expect(fetcher.mock.calls.every(call => call[0] === url)).toBe(true);
      expect(wait).toHaveBeenCalledWith(2000, undefined);
      expect(fetcher.mock.calls[1][1]).toMatchObject(init);
      if (method === 'POST') expect(fetcher.mock.calls[1][1].redirect).toBe('error');
    },
  );
  it.each([['PUT', '/api/orders'], ['POST', '/api/orders'], ['PATCH', '/api/team'], ['DELETE', '/api/item'], ['POST', '/api/auth/clerk/onboarding']])(
    'does not replay %s %s', async (method, url) => {
      const fetcher = vi.fn().mockResolvedValue(cold()), wait = vi.fn();
      expect((await fetchWithStartupContinuity(url, { method }, { fetcher, wait })).status).toBe(503);
      expect(fetcher).toHaveBeenCalledOnce(); expect(wait).not.toHaveBeenCalled();
    },
  );
  it.each([401,403,409,429,500,502,503,504])('does not retry generic HTTP %i', async status => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status }));
    expect((await fetchWithStartupContinuity('/api/auth/clerk/session', { method: 'POST' }, { fetcher })).status).toBe(status);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('does not retry a lost network response', async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError('network'));
    await expect(fetchWithStartupContinuity('/api/auth/clerk/session', { method: 'POST' }, { fetcher })).rejects.toThrow('network');
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it.each(['GET','POST'])('preserves singleAttempt for %s', async method => {
    const fetcher = vi.fn().mockResolvedValue(cold());
    await fetchWithStartupContinuity('/api/auth/clerk/session', { method }, { fetcher, singleAttempt: true });
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('stops after six attempts instead of retrying indefinitely', async () => {
    const fetcher = vi.fn().mockImplementation(async () => cold());
    const wait = vi.fn().mockResolvedValue(undefined), probe = vi.fn().mockResolvedValue(undefined);
    expect((await fetchWithStartupContinuity('/api/read', {}, { fetcher, wait, ready: probe })).status).toBe(503);
    expect(fetcher).toHaveBeenCalledTimes(6); expect(wait).toHaveBeenCalledTimes(5);
  });
  it('allows only the opt-in exact password exchange and preserves its body and URL', async () => {
    const fetcher=vi.fn().mockResolvedValueOnce(cold()).mockResolvedValueOnce(ready());
    const init={method:'POST',body:JSON.stringify({email:'qa@example.invalid',password:'fixture-only'})};
    const response=await fetchWithStartupContinuity('/api/auth/admin/login',init,{
      fetcher,wait:async()=>undefined,ready:async()=>undefined,allowCredentialLoginRecovery:true,
    });
    expect(response.status).toBe(200);expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0]).toEqual(fetcher.mock.calls[1]);
    expect(fetcher.mock.calls[0][1]).toMatchObject({...init,redirect:'error'});
  });
  it.each(['/api/auth/admin/login/other','/api/auth/admin/reset-password','/api/orders'])
    ('cannot opt a different POST %s into password exchange recovery',async url=>{
      const fetcher=vi.fn().mockResolvedValue(cold());
      await fetchWithStartupContinuity(url,{method:'POST'},{fetcher,allowCredentialLoginRecovery:true});
      expect(fetcher).toHaveBeenCalledOnce();
    });
  it('keeps password login single attempt without explicit opt-in',async()=>{
    const fetcher=vi.fn().mockResolvedValue(cold());
    await fetchWithStartupContinuity('/api/auth/admin/login',{method:'POST'},{fetcher});
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('stops within the deadline even with attempts remaining',async()=>{
    let now=0;vi.spyOn(Date,'now').mockImplementation(()=>now);
    const fetcher=vi.fn().mockImplementation(async()=>{now+=8000;return cold();});
    const wait=vi.fn().mockImplementation(async ms=>{now+=ms;});
    await fetchWithStartupContinuity('/api/auth/admin/login',{method:'POST'},{
      fetcher,wait,ready:async()=>undefined,allowCredentialLoginRecovery:true,
    });
    expect(fetcher).toHaveBeenCalledTimes(3);expect(now).toBe(28000);
  });
  it('does not shorten a long server Retry-After', async () => {
    const fetcher = vi.fn().mockResolvedValue(cold({},503,{'Retry-After':'60'})), wait = vi.fn();
    await fetchWithStartupContinuity('/api/read', {}, { fetcher, wait });
    expect(wait).not.toHaveBeenCalled(); expect(fetcher).toHaveBeenCalledOnce();
  });
  it('cancels a retained request when its identity changes during startup', async () => {
    let current = true;
    const fetcher = vi.fn().mockResolvedValue(cold());
    const wait = vi.fn().mockImplementation(async () => { current = false; });
    await expect(fetchWithStartupContinuity('/api/read', {}, { fetcher, wait, isCurrent: () => current })).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('discards a late response whose request identity retired while it was in flight',async()=>{
    let current=true;
    const fetcher=vi.fn().mockImplementation(async()=>{current=false;return ready();});
    await expect(fetchWithStartupContinuity('/api/auth/admin/login',{method:'POST'},{
      fetcher,isCurrent:()=>current,allowCredentialLoginRecovery:true,
    })).rejects.toMatchObject({name:'AbortError'});
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('does not dispatch an already cancelled request', async () => {
    const controller = new AbortController(); controller.abort();
    const fetcher = vi.fn();
    await expect(fetchWithStartupContinuity('/api/read', { signal: controller.signal }, { fetcher })).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('aborts a pending delay promptly', async () => {
    const controller = new AbortController();
    const result = abortablePause(10_000, controller.signal);
    const rejected = expect(result).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort(); await rejected;
  });
  it('does not send another request if readiness rejects', async () => {
    const fetcher = vi.fn().mockResolvedValue(cold());
    await expect(fetchWithStartupContinuity('/api/read', {}, { fetcher,
      wait: async () => undefined, ready: async () => { throw new Error('readiness rejected'); },
    })).rejects.toThrow('readiness rejected');
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
