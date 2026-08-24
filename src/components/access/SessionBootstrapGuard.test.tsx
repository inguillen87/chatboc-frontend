import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SessionBootstrapGuard from './SessionBootstrapGuard';
import type { ClerkBootstrapStatus } from './SessionBootstrapGuard';
import { useSessionAuthority } from './SessionAuthorityContext';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

const privateBootstrapMocks = {
  tenantInfo: vi.fn(),
  followedTenants: vi.fn(),
  cart: vi.fn(),
  backofficeNavigation: vi.fn(),
};

const PrivateBootstrapProbe = () => {
  React.useEffect(() => {
    privateBootstrapMocks.tenantInfo('/api/pwa/public/tenant-info');
    privateBootstrapMocks.followedTenants('/api/app/me/tenants');
    privateBootstrapMocks.cart('/api/junin/carrito');
    privateBootstrapMocks.backofficeNavigation('/api/app/backoffice/navigation');
  }, []);

  return <div>private-bootstrap-mounted</div>;
};

const PassiveRouteProbe = () => {
  const location = useLocation();
  return <output data-testid="passive-route">{`${location.pathname}${location.search}`}</output>;
};

const SessionAuthorityProbe = () => {
  const authority = useSessionAuthority();
  return <output data-testid="session-authority">{JSON.stringify(authority)}</output>;
};

const renderGuard = (initialEntry: string, clerkStatus: ClerkBootstrapStatus = 'disabled') =>
  render(
    <MemoryRouter
      initialEntries={[initialEntry]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <SessionBootstrapGuard
        clerkStatus={clerkStatus}
        renderRuntime={(tenantBootstrapEnabled) =>
          <>
            <SessionAuthorityProbe />
            {tenantBootstrapEnabled ? <PrivateBootstrapProbe /> : <PassiveRouteProbe />}
          </>
        }
      />
    </MemoryRouter>,
  );

const expectNoPrivateBootstrap = () => {
  expect(privateBootstrapMocks.tenantInfo).not.toHaveBeenCalled();
  expect(privateBootstrapMocks.followedTenants).not.toHaveBeenCalled();
  expect(privateBootstrapMocks.cart).not.toHaveBeenCalled();
  expect(privateBootstrapMocks.backofficeNavigation).not.toHaveBeenCalled();
};

describe('SessionBootstrapGuard', () => {
  beforeEach(() => {
    safeLocalStorage.clear();
    Object.values(privateBootstrapMocks).forEach((mock) => mock.mockReset());
  });

  it('redirects a sessionless tenant inbox to /403 before any private bootstrap mounts', async () => {
    safeLocalStorage.setItem('tenantSlug', 'junin');

    renderGuard('/t/junin/inbox');

    await waitFor(() => expect(screen.getByTestId('passive-route')).toHaveTextContent('/403'));
    expectNoPrivateBootstrap();
  });

  it('resolves sessionless /admin to login before tenant, cart or profile APIs mount', async () => {
    safeLocalStorage.setItem('tenantSlug', 'junin');

    renderGuard('/admin');

    await waitFor(() =>
      expect(screen.getByTestId('passive-route')).toHaveTextContent('/login?next=%2Fperfil'),
    );
    expectNoPrivateBootstrap();
  });

  it('keeps public tenant marketplace routes bootstrappable without a session', () => {
    renderGuard('/t/junin/market');

    expect(screen.getByText('private-bootstrap-mounted')).toBeInTheDocument();
    expect(privateBootstrapMocks.tenantInfo).toHaveBeenCalledTimes(1);
    expect(privateBootstrapMocks.followedTenants).toHaveBeenCalledTimes(1);
    expect(privateBootstrapMocks.cart).toHaveBeenCalledTimes(1);
    expect(privateBootstrapMocks.backofficeNavigation).toHaveBeenCalledTimes(1);
  });

  it('keeps a tenant-scoped user login on the public bootstrap path', () => {
    renderGuard('/t/junin/user/login');

    expect(screen.getByText('private-bootstrap-mounted')).toBeInTheDocument();
    expect(privateBootstrapMocks.tenantInfo).toHaveBeenCalledTimes(1);
  });

  it('does not block a public survey response route', () => {
    renderGuard('/e/encuesta-ciudadana');

    expect(screen.getByText('private-bootstrap-mounted')).toBeInTheDocument();
    expect(privateBootstrapMocks.tenantInfo).toHaveBeenCalledTimes(1);
  });

  it('keeps an authenticated profile on the active provider path', () => {
    safeLocalStorage.setItem('authToken', 'authenticated-panel-token');

    renderGuard('/perfil');

    expect(screen.getByText('private-bootstrap-mounted')).toBeInTheDocument();
    expect(privateBootstrapMocks.tenantInfo).toHaveBeenCalledTimes(1);
    expect(privateBootstrapMocks.followedTenants).toHaveBeenCalledTimes(1);
    expect(privateBootstrapMocks.cart).toHaveBeenCalledTimes(1);
    expect(privateBootstrapMocks.backofficeNavigation).toHaveBeenCalledTimes(1);
  });

  it('keeps a legacy bearer active while the optional Clerk runtime loads', () => {
    safeLocalStorage.setItem('authToken', 'authenticated-legacy-token');

    renderGuard('/perfil', 'loading');

    expect(screen.getByText('private-bootstrap-mounted')).toBeInTheDocument();
    expect(screen.getByTestId('session-authority')).toHaveTextContent(
      '"hasBearerSession":true,"hasVerifiedSession":true',
    );
  });

  it.each(['loading', 'signed_out'] as const)(
    'keeps a public guest route unverified when a stale Clerk marker is %s',
    (clerkStatus) => {
      safeLocalStorage.setItem('authProvider', 'clerk');
      safeLocalStorage.setItem('clerkUserId', 'user-stale');

      renderGuard('/t/junin/market', clerkStatus);

      expect(screen.getByText('private-bootstrap-mounted')).toBeInTheDocument();
      expect(screen.getByTestId('session-authority')).toHaveTextContent(
        `"clerkStatus":"${clerkStatus}","hasBearerSession":false,"hasVerifiedSession":false`,
      );
    },
  );

  it('publishes a synchronized Clerk session as verified authority', () => {
    renderGuard('/t/junin/market', 'ready');

    expect(screen.getByTestId('session-authority')).toHaveTextContent(
      '"clerkStatus":"ready","hasBearerSession":false,"hasVerifiedSession":true',
    );
  });

  it('rejects an expired bearer before mounting private providers', async () => {
    const expiredPayload = window.btoa(JSON.stringify({ exp: 1 }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    safeLocalStorage.setItem('authToken', `header.${expiredPayload}.signature`);

    renderGuard('/perfil', 'disabled');

    await waitFor(() => expect(screen.getByTestId('passive-route')).toHaveTextContent('/login'));
    expect(safeLocalStorage.getItem('authToken')).toBeNull();
    expectNoPrivateBootstrap();
  });

  it('ignores a stale Clerk marker when Clerk confirms the user is signed out', async () => {
    safeLocalStorage.setItem('authProvider', 'clerk');
    safeLocalStorage.setItem('clerkUserId', 'user-stale');

    renderGuard('/t/junin/inbox', 'signed_out');

    await waitFor(() => expect(screen.getByTestId('passive-route')).toHaveTextContent('/403'));
    expectNoPrivateBootstrap();
  });

  it('does not treat a Clerk-origin bearer as verified while Clerk is loading', () => {
    safeLocalStorage.setItem('authProvider', 'clerk');
    safeLocalStorage.setItem('clerkUserId', 'user-stale');
    safeLocalStorage.setItem('authToken', 'stale-clerk-bearer');

    renderGuard('/t/junin/inbox', 'loading');

    expect(screen.getByText('Validando acceso seguro')).toBeInTheDocument();
    expectNoPrivateBootstrap();
  });

  it('rejects a Clerk-origin bearer after Clerk confirms signed-out', async () => {
    safeLocalStorage.setItem('authProvider', 'clerk');
    safeLocalStorage.setItem('clerkUserId', 'user-stale');
    safeLocalStorage.setItem('authToken', 'stale-clerk-bearer');

    renderGuard('/t/junin/inbox', 'signed_out');

    await waitFor(() => expect(screen.getByTestId('passive-route')).toHaveTextContent('/403'));
    expectNoPrivateBootstrap();
  });

  it.each(['loading', 'syncing'] as const)(
    'keeps a private deep-link pending without mounting providers while Clerk is %s',
    (clerkStatus) => {
      renderGuard('/t/junin/inbox', clerkStatus);

      expect(screen.getByText('Validando acceso seguro')).toBeInTheDocument();
      expectNoPrivateBootstrap();
    },
  );

  it('allows a private deep-link only after the current Clerk session is ready', () => {
    renderGuard('/t/junin/inbox', 'ready');

    expect(screen.getByText('private-bootstrap-mounted')).toBeInTheDocument();
  });

  it.each(['/tickets', '/perfil/pedidos'])(
    'blocks private alias %s before any provider mounts',
    async (privateAlias) => {
      renderGuard(privateAlias, 'signed_out');

      await waitFor(() => expect(screen.getByTestId('passive-route')).toHaveTextContent('/login'));
      expectNoPrivateBootstrap();
    },
  );
});
