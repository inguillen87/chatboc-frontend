import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock('@/utils/api', () => ({
  apiFetch: apiFetchMock,
}));

import {
  completeClerkOnboarding,
  fetchClerkFrontendConfig,
  syncClerkSession,
} from './clerkAuth';

describe('Clerk same-origin API contracts', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockResolvedValue({ contract_version: 'auth.clerk.v1' });
  });

  it('keeps every browser auth request below the proxied /api namespace', async () => {
    await fetchClerkFrontendConfig();
    await syncClerkSession('token', { id: 'user_1' });
    await completeClerkOnboarding('token', {
      tenant_name: 'Municipalidad de Junín',
      vertical: 'gobierno',
      rubro: 'municipio',
      terms_accepted: true,
      terms_version: '2026-08',
    });

    expect(apiFetchMock.mock.calls.map(([path]) => path)).toEqual([
      '/api/auth/clerk/config',
      '/api/auth/clerk/session',
      '/api/auth/clerk/onboarding',
    ]);
  });

  it('isolates only session sync while preserving its explicit bearer and cookie transport', async () => {
    const controller = new AbortController();
    let current = true;
    await syncClerkSession('synthetic-clerk-bearer', { id: 'synthetic-user' },
      { intent: 'tenant_owner' }, controller.signal, () => current);
    const [path, options] = apiFetchMock.mock.calls[0];
    expect(path).toBe('/api/auth/clerk/session');
    expect(options).toMatchObject({
      method: 'POST', skipAuth: true, omitTenant: true, omitCredentials: false,
      omitEntityToken: true, omitChatSessionId: true, isWidgetRequest: false,
      persistTenantSlug: false, signal: controller.signal,
      headers: { Authorization: 'Bearer synthetic-clerk-bearer' },
      body: { user: { id: 'synthetic-user' }, intent: 'tenant_owner' },
    });
    expect(options.isCurrent()).toBe(true);
    current = false;
    expect(options.isCurrent()).toBe(false);
  });
});
