import React from 'react';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isSessionAuthorityPending, type SessionAuthorityValue } from '@/components/access/SessionAuthorityContext';

const state = vi.hoisted(() => ({
  authority: { clerkStatus: 'syncing', hasBearerSession: true, hasVerifiedSession: true } as SessionAuthorityValue,
  verified: true,
}));
vi.mock('@/components/access/SessionAuthorityContext', async (original) => ({
  ...await original<typeof import('@/components/access/SessionAuthorityContext')>(),
  useSessionAuthority: () => state.authority,
}));
vi.mock('@/hooks/useUser', () => ({
  useUser: () => ({
    loading: false,
    hasVerifiedSession: state.verified,
    organizationProfileVerified: state.verified,
    user: state.verified ? { id: 9, rol: 'admin_municipio', tipo_chat: 'municipio', tenant_slug: 'org-sintetica',
      organization_profile: { tenant: { id: 31, slug: 'org-sintetica' } } } : null,
  }),
}));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => ({ tenant: null, isLoadingTenant: false, tenantError: null }) }));

import { usePrivateAnalyticsScope } from './usePrivateAnalyticsScope';

const render = () => renderHook(() => usePrivateAnalyticsScope(), {
  wrapper: ({ children }) => <MemoryRouter initialEntries={['/estadisticas']}>{children}</MemoryRouter>,
});

describe('private analytics with a native session and a foreign Clerk SDK identity', () => {
  beforeEach(() => {
    state.authority = { clerkStatus: 'syncing', hasBearerSession: true, hasVerifiedSession: true };
    state.verified = true;
  });

  it('does not wait forever for Clerk when the native session is already verified', () => {
    const { result } = render();
    expect(result.current.pending).toBe(false);
    expect(result.current.scope).toMatchObject({ tenantSlug: 'org-sintetica', tenantId: 31 });
  });

  it('still waits for Clerk while no session is verified', () => {
    state.authority = { clerkStatus: 'syncing', hasBearerSession: true, hasVerifiedSession: false };
    state.verified = false;
    expect(render().result.current).toMatchObject({ pending: true, scope: null });
  });
});

describe('isSessionAuthorityPending', () => {
  it.each([
    ['loading', false, true], ['syncing', false, true], ['loading', true, false],
    ['syncing', true, false], ['ready', true, false], ['signed_out', false, false], ['disabled', false, false],
  ] as const)('clerk %s with verified=%s → pending %s', (clerkStatus, hasVerifiedSession, pending) => {
    expect(isSessionAuthorityPending({ clerkStatus, hasVerifiedSession })).toBe(pending);
  });
});
