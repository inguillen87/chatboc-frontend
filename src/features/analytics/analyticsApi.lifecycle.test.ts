import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePanelSessionStore, useWidgetSessionStore } from '@/stores';
import { resetBackendBootstrapGateForTests } from '@/utils/backendBootstrapGate';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

// Synthetic responses test the original analytics -> panelApi -> apiFetch
// transport. They are not remote backend/provider acceptance evidence.
vi.mock('@/config', async original => ({ ...await original<typeof import('@/config')>(),
  API_BASE_CANDIDATES: ['/api', 'https://retired.example.invalid'],
  BASE_API_URL: '/api', SAME_ORIGIN_PROXY_BASE: '/api',
}));
vi.mock('@/utils/api', async () => await vi.importActual<typeof import('@/utils/api')>('@/utils/api'));
vi.mock('@/api/v2/client', async () => await vi.importActual<typeof import('@/api/v2/client')>('@/api/v2/client'));

import {
  getOperationsDashboardV2, getOperationsHeatmapV2, getOperationsActionCenterV2,
  getOperationsAIBriefV2, getOperationsAIOpsQueueV2, getOperationsAIProviderStatusV2,
  getOperationsFreshnessV2, getPublicMapConfigV1,
} from './analyticsApi';

const originalFetch = global.fetch;
const reads = [
  ['dashboard', getOperationsDashboardV2], ['heatmap', getOperationsHeatmapV2],
  ['action-center', getOperationsActionCenterV2], ['ai-brief', getOperationsAIBriefV2],
  ['ai-ops-queue', getOperationsAIOpsQueueV2], ['ai-provider-status', getOperationsAIProviderStatusV2],
  ['freshness', getOperationsFreshnessV2], ['map-config', getPublicMapConfigV1],
] as const;
const cold = () => new Response(JSON.stringify({ contract_version: 'chatboc.bootstrap.v1',
  status_code: 503, ok: false, reason_code: 'application_initializing', retryable: true,
  request_dispatched: false, action_hint: 'retry_after',
}), { status: 503, headers: { 'Content-Type': 'application/json',
  'X-Chatboc-Bootstrap': 'initializing', 'Retry-After': '0' } });

beforeEach(() => {
  vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
  resetBackendBootstrapGateForTests();
  safeLocalStorage.clear();
  usePanelSessionStore.setState({ authToken: 'synthetic-operations-panel',
    user: { id: 'synthetic-actor', email: 'actor@example.invalid', rol: 'admin' } });
  useWidgetSessionStore.setState({ entityToken: null, chatAuthToken: null });
});
afterEach(() => {
  global.fetch = originalFetch;
  vi.unstubAllEnvs();
  resetBackendBootstrapGateForTests();
  safeLocalStorage.clear();
  usePanelSessionStore.setState({ authToken: null, user: null });
  useWidgetSessionStore.setState({ entityToken: null, chatAuthToken: null });
});

describe('operations GET lifecycle with actual apiFetch', () => {
  it.each(reads)('never redispatches %s after retirement during startup recovery', async (_name, read) => {
    let active = true;
    global.fetch = vi.fn().mockImplementation(async url => {
      if (url === '/api/version') {
        // Query cancellation may happen after the first undispatched receipt,
        // while its readiness probe is finishing on a different warm worker.
        active = false;
        safeLocalStorage.setItem('tenantSlug', 'unrelated-public-tenant');
        useWidgetSessionStore.setState({ chatAuthToken: 'synthetic-public-token' });
        return new Response('{"backend":"synthetic-sha","frontend":"web"}');
      }
      return cold();
    });
    await expect(read({ tenantSlug: 'panel-tenant', isCurrent: () => active }))
      .rejects.toMatchObject({ name: 'AbortError' });
    const calls = vi.mocked(global.fetch).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[1][0]).toBe('/api/version');
    expect(calls.every(([url]) => !String(url).includes('retired'))).toBe(true);
    const init = calls[0][1];
    const headers = new Headers(init?.headers);
    expect(init?.method || 'GET').toBe('GET');
    expect(init?.body).toBeUndefined();
    expect(init?.credentials).toBe('include');
    expect(headers.get('Authorization')).toBe('Bearer synthetic-operations-panel');
    expect(headers.get('X-Tenant')).toBe('panel-tenant');
    expect(headers.has('X-Entity-Token')).toBe(false);
    expect(headers.has('X-Chat-Session')).toBe(false);
    expect(String(calls[0][0])).not.toContain('isCurrent');
  });
});
