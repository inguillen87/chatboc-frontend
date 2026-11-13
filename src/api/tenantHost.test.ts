import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tenantHostPayload } from '@/test/fixtures/tenantHost';
import { getTenantHostBinding } from './tenantHost';
import { TenantHostNotPublishedError } from '@/utils/tenantHostBinding';

beforeEach(() => { localStorage.setItem('tenantSlug','old-workspace'); localStorage.setItem('authToken','synthetic-private-token'); });
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });
describe('anonymous same-origin host resolution', () => {
  it('uses the complete normalized host without sending ambient credentials or following redirects', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(tenantHostPayload()), { headers: { 'Content-Type': 'application/json' } })); vi.stubGlobal('fetch',fetchMock);
    expect((await getTenantHostBinding('ATENCION.example.test.')).tenant.slug).toBe('government-east');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/public/host-resolution?host=atencion.example.test');
    expect(options).toMatchObject({ method:'GET',credentials:'omit',cache:'no-store',redirect:'error',headers:{Accept:'application/json'} });
    expect(JSON.stringify(options)).not.toMatch(/old-workspace|synthetic-private-token|X-Tenant|Authorization|widget_token/);
    expect(localStorage.getItem('tenantSlug')).toBe('old-workspace');
  });
  it.each([400,404,503])('returns a fixed unavailable error for HTTP %s without provider/private diagnostics', async status => {
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({tenant:{slug:'old-workspace'},message:'private provider diagnostic'}), {status,headers:{'Content-Type':'application/json'}})));
    await expect(getTenantHostBinding('atencion.example.test')).rejects.toThrow('Este dominio no tiene un espacio activo y verificado.');
  });
  it('rejects HTML or excessive response content and never probes a guessed tenant endpoint', async () => {
    const fetchMock=vi.fn().mockResolvedValueOnce(new Response('<html>private diagnostic</html>',{headers:{'Content-Type':'text/html'}})).mockResolvedValueOnce(new Response(' '.repeat(16385),{headers:{'Content-Type':'application/json'}})); vi.stubGlobal('fetch',fetchMock);
    await expect(getTenantHostBinding('atencion.example.test')).rejects.toThrow();
    await expect(getTenantHostBinding('atencion.example.test')).rejects.toThrow();
    expect(fetchMock.mock.calls.every(([url])=>String(url).startsWith('/api/public/host-resolution?host='))).toBe(true);
  });
  it('distinguishes an explicit no-binding 404 from provider failure or malformed errors', async () => {
    const empty = { contract_version: 'public.tenant_host.v1', reason_code: 'host_not_available', tenant: null };
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(new Response(JSON.stringify(empty), { status: 404, headers: { 'Content-Type': 'application/json' } }));
    await expect(getTenantHostBinding('synthetic-preview.vercel.app')).rejects.toBeInstanceOf(TenantHostNotPublishedError);
    for (const [status, payload] of [[503, empty], [404, { ...empty, contract_version: 'other' }],
      [404, { ...empty, tenant: { slug: 'government-east' } }], [404, { ...empty, binding: { verified: true } }],
      [200, empty], [404, { reason_code: 'host_not_available' }]] as const) {
      fetchMock.mockResolvedValue(new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } }));
      await getTenantHostBinding('synthetic-preview.vercel.app').then(() => { throw new Error('Unexpected binding'); },
        error => expect(error).not.toBeInstanceOf(TenantHostNotPublishedError));
    }
  });
});
