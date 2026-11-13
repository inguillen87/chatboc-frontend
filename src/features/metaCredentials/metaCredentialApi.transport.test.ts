// @vitest-environment-options {"url":"https://www.chatboc.ar/integracion/meta/credenciales"}
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { usePanelSessionStore, useTenantStore, useWidgetSessionStore } from '@/stores';
import { metaCredentialApi } from './metaCredentialApi';
import { planFor, planPayload, statusFor, tokenFor } from './__tests__/fixtures';

vi.mock('@/utils/api', async () => await vi.importActual('@/utils/api'));
vi.mock('@/utils/backendBootstrapGate', () => ({ ensureBackendRuntimeReady: async () => undefined }));
vi.mock('@/config', async original => ({ ...await original<typeof import('@/config')>(),
  API_BASE_CANDIDATES: ['/api', 'https://never-used.example.invalid'], BASE_API_URL: '/api', SAME_ORIGIN_PROXY_BASE: '/api' }));
const originalFetch = global.fetch;
const token = tokenFor('junin-production');
const scope = { isCurrent: () => true };
let logs: ReturnType<typeof vi.spyOn>[];

beforeEach(() => {
  safeLocalStorage.clear();
  usePanelSessionStore.setState({ authToken: null, user: null });
  useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
  useTenantStore.getState().clearTenant();
  safeLocalStorage.setItem('authProvider', 'clerk');
  safeLocalStorage.setItem('clerkSessionTransport', 'cookie');
  safeLocalStorage.setItem('clerkUserId', 'synthetic-admin');
  safeLocalStorage.setItem('entityToken', 'synthetic-widget-must-not-be-used');
  safeLocalStorage.setItem('tenantSlug', 'presentation-tenant-must-not-be-used');
  safeLocalStorage.setItem('CHATBOC_DEBUG_API', 'true');
  logs = ['log', 'warn', 'error', 'debug'].map(method => vi.spyOn(console, method as 'log').mockImplementation(() => undefined));
});
afterEach(() => {
  global.fetch = originalFetch;
  safeLocalStorage.clear();
  usePanelSessionStore.setState({ authToken: null, user: null });
  useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
  useTenantStore.getState().clearTenant();
  vi.restoreAllMocks();
});

describe('private credentials over the real authenticated API client', () => {
  it('uses one HTTPS cookie request with no widget identity or private body in debug logs/storage', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(planPayload()), { headers: { 'Content-Type': 'application/json' } }));
    await metaCredentialApi.plan(statusFor('junin-production'), token, scope);
    expect(global.fetch).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(global.fetch).mock.calls[0];
    expect(url).toBe('https://www.chatboc.ar/api/internal/meta-credentials/plan');
    expect(init).toMatchObject({ method: 'POST', credentials: 'include', redirect: 'error', cache: 'no-store' });
    const headers = new Headers(init?.headers);
    for (const header of ['Authorization', 'X-Entity-Token', 'X-Token', 'X-Tenant-Slug', 'X-Chat-Session-Id']) expect(headers.has(header)).toBe(false);
    expect(JSON.parse(init!.body as string).access_token).toBe(token);
    expect(JSON.stringify(logs.flatMap(log => log.mock.calls))).not.toContain(token);
    expect(JSON.stringify(window.localStorage)).not.toContain(token);
  });

  it.each(['denial', 'bad_ack', 'network'])('does not replay an apply after %s or log private response details', async failure => {
    if (failure === 'network') global.fetch = vi.fn().mockRejectedValue(new TypeError('network disconnected'));
    else global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      reason_code: 'meta_operation_unavailable', detail: token,
    }), { status: failure === 'denial' ? 503 : 200, headers: { 'Content-Type': 'application/json' } }));
    await expect(metaCredentialApi.apply(planFor(statusFor('junin-production')), token, scope)).rejects.toMatchObject({ outcomeUnverified: true });
    expect(global.fetch).toHaveBeenCalledOnce();
    expect(vi.mocked(global.fetch).mock.calls[0][0]).toBe('https://www.chatboc.ar/api/internal/meta-credentials/apply');
    expect(JSON.stringify(logs.flatMap(log => log.mock.calls))).not.toContain(token);
    expect(JSON.stringify(window.localStorage)).not.toContain(token);
  });
});
