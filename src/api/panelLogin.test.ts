import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loginPanelWithCredentials } from './panelLogin';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { readPanelLoginScope } from '@/utils/panelLoginScope';

vi.mock('@/utils/api', async () => await vi.importActual('@/utils/api'));

describe('panel credential login transport', () => {
  beforeEach(() => {
    safeLocalStorage.clear();
    safeLocalStorage.setItem('tenantSlug', 'previous-public-space');
    safeLocalStorage.setItem('authToken', 'previous-session');
    safeLocalStorage.setItem('entityToken', 'previous-widget');
    vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify({ token: 'new-session', user: { tenant_slug: 'organization-a' } }), { headers: { 'Content-Type': 'application/json' } })));
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); safeLocalStorage.clear(); });

  it('sends global credentials without a previously visited tenant, entity token or bearer', async () => {
    await loginPanelWithCredentials('operator@example.test', 'test-only-password', '/login');
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).not.toMatch(/tenant[=_]/);
    expect(JSON.parse(String(init?.body))).toEqual({ email: 'operator@example.test', password: 'test-only-password' });
    const headers = new Headers(init?.headers);
    for (const key of ['X-Tenant', 'X-Tenant-Slug', 'X-Entity-Token', 'X-Token', 'Authorization', 'X-Chat-Session-Id']) expect(headers.has(key)).toBe(false);
    expect(init?.credentials).toBe('include');
    expect(safeLocalStorage.getItem('tenantSlug')).toBe('previous-public-space');
  });

  it.each(['/t/organization-a/login', '/municipio/organization-a/login', '/organization-a/login'])('uses the explicit organization in %s without persisting it before authentication', async path => {
    await loginPanelWithCredentials('operator@example.test', 'test-only-password', path);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(new URL(String(url), 'https://local.test').searchParams.get('tenant_slug')).toBe('organization-a');
    expect(JSON.parse(String(init?.body)).tenant_slug).toBe('organization-a');
    expect(new Headers(init?.headers).get('X-Tenant')).toBe('organization-a');
    expect(safeLocalStorage.getItem('tenantSlug')).toBe('previous-public-space');
  });

  it.each(['/t/default/login', '/t/a%2Fb/login', '/t/%ZZ/login', '/t/org/login/extra'])('rejects an ambiguous login route %s before sending credentials', async path => {
    await expect(loginPanelWithCredentials('operator@example.test', 'test-only-password', path)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('normalizes route casing and accepts the global trailing slash', () => {
    expect(readPanelLoginScope('/login/')).toEqual({ valid: true, tenantSlug: null });
    expect(readPanelLoginScope('/t/Organization-A/login/')).toEqual({ valid: true, tenantSlug: 'organization-a' });
  });
});
