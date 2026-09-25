import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usePanelSessionStore } from '@/stores';
import { apiFetch } from '@/utils/api';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { useUser, UserProvider } from './useUser';
import { SessionAuthorityProvider } from '@/components/access/SessionAuthorityContext';
import profileFixture from '../../tests/fixtures/organization-profile-settings.json';
import workspaceFixtures from '../../tests/fixtures/organization-workspaces.json';

const SessionVisibleUserProbe = () => {
  const { user } = useUser();
  return <output data-testid="visible-user">{user ? `${user.name}|${user.email}` : 'guest'}</output>;
};

const VerifiedClerkBridgeProbe = () => {
  const { refreshUser } = useUser();
  React.useEffect(() => {
    void refreshUser();
  }, [refreshUser]);
  return <div>verified profile hydration</div>;
};

const InstitutionalVerificationProbe = () => {
  const { user, organizationProfileVerified } = useUser();
  return <output data-testid="institutional-verification">{`${user?.tenant_slug}|${organizationProfileVerified}`}</output>;
};
const verifiedAuthority = { clerkStatus: 'disabled' as const, hasBearerSession: true, hasVerifiedSession: true };
const jwt = (id: number) => `header.${btoa(JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`;

describe('UserProvider Clerk cookie profile hydration', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset().mockResolvedValue({
      id: 42,
      name: 'Portal User',
      email: 'portal@example.test',
      rubro: 'municipio',
      tipo_chat: 'municipio',
      rol: 'usuario',
    });
    safeLocalStorage.clear();
    usePanelSessionStore.setState({ authToken: null, user: null });
  });

  it('preserves authenticated institutional contracts separately from the personal avatar', async () => {
    safeLocalStorage.setItem('authProvider', 'clerk');
    safeLocalStorage.setItem('clerkUserId', 'user_clerk_cookie');
    const workspace = { ...workspaceFixtures.gobierno, tenant: profileFixture.tenant };
    vi.mocked(apiFetch).mockResolvedValue({ id: 42, name: 'Operator', rol: 'tenant_admin', tipo_chat: 'municipio', rubro: 'gobierno',
      tenant_slug: 'tenant-a', organization_profile: profileFixture, organization_workspace: workspace });
    render(<UserProvider><VerifiedClerkBridgeProbe /></UserProvider>);
    await waitFor(() => expect(usePanelSessionStore.getState().user).toMatchObject({
      organization_profile: profileFixture, organization_workspace: workspace, tenant_slug: 'tenant-a',
    }));
  });

  it('revalidates a complete persisted profile once after reload and hides institutional identity until the response', async () => {
    const token = jwt(42);
    safeLocalStorage.setItem('authToken', token);
    usePanelSessionStore.setState({ authToken: token, user: { id: '42', email: 'operator@example.test', rol: 'tenant_admin', rubro: 'gobierno', tenant_slug: 'tenant-a' } });
    let finish!: (value: unknown) => void;
    vi.mocked(apiFetch).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    render(<UserProvider><SessionAuthorityProvider value={verifiedAuthority}><InstitutionalVerificationProbe /></SessionAuthorityProvider></UserProvider>);
    expect(screen.getByTestId('institutional-verification')).toHaveTextContent('tenant-a|false');
    expect(apiFetch).toHaveBeenCalledTimes(1);
    await act(async () => finish({ id: 42, rol: 'tenant_admin', rubro: 'gobierno', tipo_chat: 'municipio', tenant_slug: 'tenant-a' }));
    expect(screen.getByTestId('institutional-verification')).toHaveTextContent('tenant-a|true');
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it('does not verify a late profile response after the credential session changes', async () => {
    const token = jwt(42);
    safeLocalStorage.setItem('authToken', token);
    usePanelSessionStore.setState({ authToken: token, user: { id: '42', email: 'a@example.test', rol: 'tenant_admin', rubro: 'gobierno', tenant_slug: 'tenant-a' } });
    let finishOld!: (value: unknown) => void;
    vi.mocked(apiFetch).mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }));
    render(<UserProvider><SessionAuthorityProvider value={verifiedAuthority}><InstitutionalVerificationProbe /></SessionAuthorityProvider></UserProvider>);
    vi.mocked(apiFetch).mockResolvedValue({ id: 43, rol: 'tenant_admin', tipo_chat: 'municipio', rubro: 'gobierno', tenant_slug: 'tenant-b' });
    act(() => { usePanelSessionStore.getState().setAuthToken(jwt(43)); usePanelSessionStore.getState().setUser({ id: '43', email: 'b@example.test', rol: 'tenant_admin', tenant_slug: 'tenant-b' }); });
    await waitFor(() => expect(screen.getByTestId('institutional-verification')).toHaveTextContent('tenant-b|true'));
    await act(async () => finishOld({ id: 42, rol: 'tenant_admin', tipo_chat: 'municipio', tenant_slug: 'tenant-a' }));
    expect(screen.getByTestId('institutional-verification')).toHaveTextContent('tenant-b|true');
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });

  it.each(['loading', 'signed_out'] as const)(
    'masks stale profile PII while Clerk is %s',
    (clerkStatus) => {
      usePanelSessionStore.setState({
        authToken: null,
        user: {
          id: 77,
          name: 'Persona Stale Privada',
          email: 'stale-private@example.test',
        } as any,
      });

      render(
        <UserProvider>
          <SessionAuthorityProvider
            value={{
              clerkStatus,
              hasBearerSession: clerkStatus === 'loading',
              hasVerifiedSession: false,
            }}
          >
            <SessionVisibleUserProbe />
          </SessionAuthorityProvider>
        </UserProvider>,
      );

      expect(screen.getByTestId('visible-user')).toHaveTextContent('guest');
      expect(screen.queryByText(/Persona Stale Privada|stale-private@example\.test/)).not.toBeInTheDocument();
      expect(apiFetch).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      label: 'Clerk ready cookie-only',
      authority: {
        clerkStatus: 'ready' as const,
        hasBearerSession: false,
        hasVerifiedSession: true,
      },
    },
    {
      label: 'verified legacy bearer',
      authority: {
        clerkStatus: 'disabled' as const,
        hasBearerSession: true,
        hasVerifiedSession: true,
      },
    },
  ])('exposes the hydrated profile for $label authority', ({ authority }) => {
    usePanelSessionStore.setState({
      authToken: authority.hasBearerSession ? 'legacy-token' : null,
      user: {
        id: 78,
        name: 'Persona Verificada',
        email: 'verified@example.test',
      } as any,
    });

    render(
      <UserProvider>
        <SessionAuthorityProvider value={authority}>
          <SessionVisibleUserProbe />
        </SessionAuthorityProvider>
      </UserProvider>,
    );

    expect(screen.getByTestId('visible-user')).toHaveTextContent(
      'Persona Verificada|verified@example.test',
    );
  });

  it('does not trust a local Clerk marker to hydrate /api/me', async () => {
    safeLocalStorage.setItem('authProvider', 'clerk');
    safeLocalStorage.setItem('clerkUserId', 'user_clerk_cookie');
    safeLocalStorage.setItem('entityToken', 'stale-tenant-owner-token');
    safeLocalStorage.setItem('tenantSlug', 'stale-tenant');

    render(
      <UserProvider>
        <div>profile hydration</div>
      </UserProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('uses only the HttpOnly session when the verified Clerk bridge requests hydration', async () => {
    safeLocalStorage.setItem('authProvider', 'clerk');
    safeLocalStorage.setItem('clerkUserId', 'user_clerk_cookie');
    safeLocalStorage.setItem('entityToken', 'stale-tenant-owner-token');
    safeLocalStorage.setItem('tenantSlug', 'stale-tenant');

    render(
      <UserProvider>
        <VerifiedClerkBridgeProbe />
      </UserProvider>,
    );

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/me',
        expect.objectContaining({
          omitEntityToken: true,
          omitTenant: true,
          preserveAuthOn401: true,
          suppressPanel401Redirect: true,
        }),
      );
    });
  });
});
