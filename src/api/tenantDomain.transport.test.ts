import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { usePanelSessionStore, useTenantStore, useWidgetSessionStore } from '@/stores';
import { domainPayload, domainScope } from '@/test/fixtures/tenantDomain';
import { getTenantDomain, readTenantDomain, saveTenantDomain } from './tenantDomain';

vi.mock('@/utils/api', async () => await vi.importActual('@/utils/api'));
vi.mock('@/config', async original => ({ ...await original<typeof import('@/config')>(),
  API_BASE_CANDIDATES: ['/api', 'https://other.example.invalid'], BASE_API_URL: '/api', SAME_ORIGIN_PROXY_BASE: '/api' }));
vi.mock('@/utils/backendBootstrapGate', () => ({ ensureBackendRuntimeReady: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/utils/anonId', () => ({ ensureRemoteAnonId: vi.fn().mockResolvedValue('synthetic-visitor') }));

const originalFetch = global.fetch;
const endpoint = '/api/admin/tenants/government-east/domain';
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
beforeEach(() => {
  safeLocalStorage.clear(); useTenantStore.getState().setTenant('old-home');
  usePanelSessionStore.setState({ authToken: 'synthetic-owner-token', user: null });
  useWidgetSessionStore.setState({ chatAuthToken: 'synthetic-widget-token', entityToken: 'synthetic-entity' });
  safeLocalStorage.setItem('tenantSlug', 'old-home');
  (window as any).CHATBOC_CONFIG = { entityToken: 'synthetic-public-entity' };
});
afterEach(() => {
  global.fetch = originalFetch; vi.restoreAllMocks(); safeLocalStorage.clear();
  useTenantStore.getState().clearTenant(); usePanelSessionStore.setState({ authToken: null, user: null });
  useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
  delete (window as any).CHATBOC_CONFIG; window.history.replaceState({}, '', '/');
});
const expectPrivateScopedTransport = (method: 'GET' | 'PUT') => {
  expect(global.fetch).toHaveBeenCalledOnce();
  const [url, init] = vi.mocked(global.fetch).mock.calls[0];
  const target = new URL(String(url), window.location.origin), headers = new Headers(init?.headers);
  expect(target.pathname).toBe(endpoint); expect(target.search).toBe('');
  expect(init?.method).toBe(method); expect(init?.credentials).toBe('include'); expect(init?.redirect).toBe('error');
  expect(headers.get('Authorization')).toBe('Bearer synthetic-owner-token');
  expect(headers.get('X-Tenant')).toBe(domainScope.slug); expect(headers.get('X-Tenant-Slug')).toBe(domainScope.slug);
  expect(headers.has('X-Entity-Token')).toBe(false); expect(headers.has('X-Token')).toBe(false);
  expect(headers.has('X-Chat-Session-Id')).toBe(false);
  expect(safeLocalStorage.getItem('tenantSlug')).toBe('old-home'); expect(useTenantStore.getState().slug).toBe('old-home');
  return init;
};
describe('actual private domain HTTP transport with synthetic responses', () => {
  it.each(['/t/government-east/integracion', '/widget/government-east'])('uses the exact path and scope headers without forbidden query aliases on %s', async route => {
    window.history.replaceState({}, '', route);
    global.fetch = vi.fn().mockResolvedValue(json(domainPayload()));
    expect(await getTenantDomain(domainScope, () => true)).toMatchObject({ tenant: domainScope, status: 'pending_dns' });
    expectPrivateScopedTransport('GET');
  });
  it('keeps the revision command and private scope while omitting query aliases from PUT', async () => {
    global.fetch = vi.fn().mockResolvedValue(json({ contract_version: 'organization.domain_save.v1', saved: true,
      domain: domainPayload({ revision: 'c'.repeat(64) }) }));
    await saveTenantDomain(domainScope, readTenantDomain(domainPayload(), domainScope), 'verify_dns', undefined, () => true);
    const init = expectPrivateScopedTransport('PUT');
    expect(JSON.parse(String(init?.body))).toEqual({ expected_revision: 'a'.repeat(64), operation: 'verify_dns' });
  });
  it('does not retry an unconfirmed PUT on another API base', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('synthetic response lost'));
    await expect(saveTenantDomain(domainScope, readTenantDomain(domainPayload(), domainScope), 'revoke', undefined, () => true)).rejects.toThrow();
    expectPrivateScopedTransport('PUT');
  });
});
