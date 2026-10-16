import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enterpriseService } from './enterpriseService';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { usePanelSessionStore, useWidgetSessionStore } from '@/stores';

// Exercise actual request construction, not only the options passed to apiFetch.
vi.mock('@/utils/api', async () => await vi.importActual('@/utils/api'));

const reads: Array<[string, (slug?: string) => Promise<unknown>, string]> = [
  ['pipeline', slug => enterpriseService.getLeadsPipeline({ since_days: 30 }, slug), '/api/admin/leads/pipeline'],
  ['interactions', slug => enterpriseService.getLeadInteractions({ limit: 20 }, slug), '/api/admin/leads/interactions'],
  ['catalog', slug => enterpriseService.getCatalogQuality({ limit: 100 }, slug), '/api/admin/catalog/quality'],
  ['strategy', slug => enterpriseService.getStrategicOverview({ since_days: 30 }, slug), '/api/admin/leads/strategic-overview'],
  ['heatmap', slug => enterpriseService.getStrategicHeatmapCategoriesZones({ since_days: 30 }, slug), '/api/admin/analytics/heatmap-categories-zones'],
  ['realtime', slug => enterpriseService.getRealtimeAiOverview({ minutes: 60 }, slug), '/api/admin/analytics/realtime-ai'],
  ['surveys', slug => enterpriseService.getGlobalEncuestasOverview(slug), '/api/admin/encuestas/overview'],
  ['health', slug => enterpriseService.getTenantHealth({ since_days: 30 }, slug), '/api/admin/analytics/tenant-health'],
];

const lastRequest = () => {
  const [url, init] = vi.mocked(fetch).mock.calls.at(-1)!;
  return { url: new URL(String(url), 'https://local.test'), headers: new Headers(init?.headers), init };
};

describe('enterprise platform read scope', () => {
  beforeEach(() => {
    safeLocalStorage.clear();
    useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
    usePanelSessionStore.getState().setAuthToken('synthetic-native-session');
    safeLocalStorage.setItem('tenantSlug', 'previous-business');
    window.history.replaceState({}, '', '/superadmin?tenant_slug=old-route-tenant');
    vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(
      JSON.stringify({ items: [] }), { headers: { 'Content-Type': 'application/json' } },
    )));
  });
  afterEach(() => {
    window.history.replaceState({}, '', '/');
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    usePanelSessionStore.setState({ authToken: null, user: null });
    useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
    safeLocalStorage.clear();
  });

  it.each(reads)('%s ignores a previous business and stale route when the caller requests platform data', async (_name, read, path) => {
    await read();
    const request = lastRequest();
    expect(request.url.pathname).toBe(path);
    expect(request.url.searchParams.has('tenant_slug')).toBe(false);
    expect(request.url.searchParams.has('tenant')).toBe(false);
    expect(request.headers.has('X-Tenant')).toBe(false);
    expect(request.headers.has('X-Tenant-Slug')).toBe(false);
    expect(request.headers.get('Authorization')).toBe('Bearer synthetic-native-session');
    expect(request.init?.credentials).toBe('include');
    expect(safeLocalStorage.getItem('tenantSlug')).toBe('previous-business');
  });

  it.each(reads)('%s retains an explicitly selected organization', async (name, read, path) => {
    await read('chosen-organization');
    const request = lastRequest();
    expect(request.url.pathname).toBe(name === 'health' ? '/api/v2/tenants/chosen-organization/health' : path);
    expect(request.url.searchParams.get('tenant_slug')).toBe('chosen-organization');
    expect(request.headers.get('X-Tenant-Slug')).toBe('chosen-organization');
    expect(request.headers.get('Authorization')).toBe('Bearer synthetic-native-session');
  });

  it.each([
    ['pipeline', () => enterpriseService.getLeadsPipeline({ tenant_slug: 'chosen-filter', since_days: 30 })],
    ['interactions', () => enterpriseService.getLeadInteractions({ tenant_slug: 'chosen-filter', limit: 20 })],
    ['catalog', () => enterpriseService.getCatalogQuality({ tenant_slug: 'chosen-filter', limit: 100 })],
  ] as const)('%s preserves an explicit query filter without replacing it with stored or URL context', async (_name, read) => {
    await read();
    const request = lastRequest();
    expect(request.url.searchParams.get('tenant_slug')).toBe('chosen-filter');
    expect(request.url.searchParams.has('tenant')).toBe(false);
    expect(request.headers.get('X-Tenant-Slug')).toBe('chosen-filter');
    expect(safeLocalStorage.getItem('tenantSlug')).toBe('previous-business');
  });

  it('keeps the numeric tenant filter used by the scoped analytics page', async () => {
    await enterpriseService.getLeadInteractions({ tenant_id: 42, from: '2026-09-01', limit: 20 }, 'chosen-organization');
    const request = lastRequest();
    expect(request.url.searchParams.get('tenant_id')).toBe('42');
    expect(request.url.searchParams.get('from')).toBe('2026-09-01');
    expect(request.headers.get('X-Tenant-Slug')).toBe('chosen-organization');
  });
});
