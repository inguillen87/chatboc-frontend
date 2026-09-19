import { afterEach, describe, expect, it, vi } from 'vitest';
import { ensureBackendRuntimeReady, resetBackendBootstrapGateForTests, BackendBootstrapError } from './backendBootstrapGate';
import { READINESS_LEASE_MS } from './backendReadinessLease';
const SHA = 'a'.repeat(40), OTHER = 'b'.repeat(40);
const ready = (sha = SHA) => new Response(JSON.stringify({backend:sha,frontend:'web'}),{status:200});
const starting = () => new Response(JSON.stringify({contract_version:'chatboc.bootstrap.v1',
  reason_code:'application_initializing',retryable:true}),{status:503,headers:{'Retry-After':'2'}});
afterEach(() => { resetBackendBootstrapGateForTests(); vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('resumed runtime and coordinated release', () => {
  it('rechecks readiness after an idle lease and waits for an explicit bootstrap', async () => {
    vi.useFakeTimers(); vi.setSystemTime(1_000);
    const fetcher = vi.fn().mockResolvedValueOnce(ready()).mockResolvedValueOnce(starting()).mockResolvedValueOnce(ready());
    const wait = vi.fn().mockResolvedValue(undefined);
    await ensureBackendRuntimeReady({enabled:true,fetcher,wait});
    await ensureBackendRuntimeReady({enabled:true,fetcher,wait});
    expect(fetcher).toHaveBeenCalledTimes(1);
    vi.setSystemTime(1_000 + READINESS_LEASE_MS);
    await Promise.all([ensureBackendRuntimeReady({enabled:true,fetcher,wait}),ensureBackendRuntimeReady({enabled:true,fetcher,wait})]);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledWith(2_000);
    expect(fetcher.mock.calls.every(([,options])=>options.method==='GET'&&options.credentials==='omit')).toBe(true);
  });
  it('blocks an unpaired backend revision without retrying a successful but wrong response', async () => {
    const fetcher = vi.fn().mockResolvedValue(ready(OTHER));
    await expect(ensureBackendRuntimeReady({enabled:true,fetcher,expectedRevision:SHA})).rejects.toMatchObject({
      status:409,body:{reason_code:'backend_revision_mismatch'}});
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('reads a build-time backend revision pin', async () => {
    vi.stubEnv('VITE_EXPECTED_BACKEND_REVISION',SHA);
    const fetcher = vi.fn().mockResolvedValue(ready(OTHER));
    await expect(ensureBackendRuntimeReady({enabled:true,fetcher})).rejects.toBeInstanceOf(BackendBootstrapError);
  });
  it('cannot reuse an unpinned success to satisfy a pinned release', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(ready(OTHER)).mockResolvedValueOnce(ready(SHA));
    await ensureBackendRuntimeReady({enabled:true,fetcher});
    await ensureBackendRuntimeReady({enabled:true,fetcher,expectedRevision:SHA});
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each([NaN, Infinity, -Infinity, 1.5])('rejects invalid attempts %s instead of skipping all checks', async (maxAttempts) => {
    const fetcher = vi.fn();
    await expect(ensureBackendRuntimeReady({enabled:true,fetcher,maxAttempts})).rejects.toBeInstanceOf(BackendBootstrapError);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([NaN, Infinity, -Infinity])('rejects non-finite timeout %s', async (timeoutMs) => {
    const fetcher = vi.fn();
    await expect(ensureBackendRuntimeReady({enabled:true,fetcher,timeoutMs})).rejects.toBeInstanceOf(BackendBootstrapError);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(['','main','ABCDEF','a'.repeat(39)])('rejects an invalid backend revision %s', async (expectedRevision) => {
    const fetcher = vi.fn();
    await expect(ensureBackendRuntimeReady({enabled:true,fetcher,expectedRevision})).rejects.toBeInstanceOf(BackendBootstrapError);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('does not turn a terminal initialization failure into repeated requests', async () => {
    const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({contract_version:'chatboc.bootstrap.v1',
      reason_code:'application_initialization_failed',retryable:false}),{status:503}));
    await expect(ensureBackendRuntimeReady({enabled:true,fetcher})).rejects.toBeInstanceOf(BackendBootstrapError);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('does not renew an expired lease when a generic service failure occurs', async () => {
    vi.useFakeTimers(); vi.setSystemTime(1_000);
    const fetcher=vi.fn().mockResolvedValueOnce(ready()).mockResolvedValueOnce(new Response('{}',{status:503}));
    await ensureBackendRuntimeReady({enabled:true,fetcher});
    vi.setSystemTime(1_000+READINESS_LEASE_MS);
    await expect(ensureBackendRuntimeReady({enabled:true,fetcher})).rejects.toBeInstanceOf(BackendBootstrapError);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
