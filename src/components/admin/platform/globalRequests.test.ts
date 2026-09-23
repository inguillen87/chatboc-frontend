import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/api/client';
import { usePanelSessionStore, useWidgetSessionStore } from '@/stores';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
vi.mock('@/utils/api', async () => await vi.importActual('@/utils/api'));

beforeEach(() => {
  safeLocalStorage.clear();
  usePanelSessionStore.setState({ authToken: 'synthetic-panel-session', user: null });
  useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null, sessionId: null });
  safeLocalStorage.setItem('authToken', 'synthetic-panel-session');
  safeLocalStorage.setItem('tenantSlug', 'previous-business');
  window.history.replaceState({}, '', '/superadmin?tenant_slug=another-business');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ tenants: [], numbers: [], total: 0 }), { status: 200, headers: { 'content-type': 'application/json' } })));
});
afterEach(() => { vi.unstubAllGlobals(); safeLocalStorage.clear(); usePanelSessionStore.setState({ authToken: null, user: null }); window.history.replaceState({}, '', '/'); });

describe('platform directory and channel request scope', () => {
  it.each([
    ['directory', () => apiClient.superAdminListTenants(2, 100)],
    ['inventory', () => apiClient.superAdminListWhatsappNumbers()],
  ] as const)('%s does not inherit a previous organization but retains authentication', async (_name, request) => {
    await request();
    const [input, options] = vi.mocked(fetch).mock.calls[0];
    const url = new URL(String(input), window.location.origin);
    const headers = new Headers(options?.headers);
    expect(url.searchParams.has('tenant_slug')).toBe(false);
    expect(url.searchParams.has('tenant')).toBe(false);
    expect(headers.has('X-Tenant-Slug')).toBe(false);
    expect(headers.get('Authorization')).toBe('Bearer synthetic-panel-session');
    expect(safeLocalStorage.getItem('tenantSlug')).toBe('previous-business');
  });
  it('retains an explicit inventory filter without replacing it with ambient scope', async () => {
    await apiClient.superAdminListWhatsappNumbers({ tenant_slug: 'selected-filter', status: 'assigned' });
    const [input, options] = vi.mocked(fetch).mock.calls[0];
    const url = new URL(String(input), window.location.origin);
    expect(url.searchParams.get('tenant_slug')).toBe('selected-filter');
    expect(url.searchParams.get('status')).toBe('assigned');
    expect(new Headers(options?.headers).get('Authorization')).toBe('Bearer synthetic-panel-session');
  });
});
