import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usePanelSessionStore } from '@/stores';
import { apiFetch } from '@/utils/api';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { useUser, UserProvider } from './useUser';
import { SessionAuthorityProvider } from '@/components/access/SessionAuthorityContext';

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
