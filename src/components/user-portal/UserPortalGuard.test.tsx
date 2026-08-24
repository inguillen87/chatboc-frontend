import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import UserPortalGuard from './UserPortalGuard';

const guardMocks = vi.hoisted(() => ({
  user: null as null | { rol?: string },
  loading: false,
  refreshUser: vi.fn<() => Promise<void>>(),
  authority: {
    clerkStatus: 'disabled' as
      | 'disabled'
      | 'loading'
      | 'signed_out'
      | 'syncing'
      | 'ready',
    hasBearerSession: false,
    hasVerifiedSession: false,
  },
}));

vi.mock('@/hooks/useUser', () => ({
  useUser: () => ({
    user: guardMocks.user,
    refreshUser: guardMocks.refreshUser,
    loading: guardMocks.loading,
  }),
}));

vi.mock('@/components/access/SessionAuthorityContext', () => ({
  useSessionAuthority: () => guardMocks.authority,
}));

const LocationProbe = () => {
  const location = useLocation();
  return (
    <>
      <output data-testid="location">
        {`${location.pathname}${location.search}${location.hash}`}
      </output>
      <output data-testid="location-state">
        {JSON.stringify(location.state ?? null)}
      </output>
    </>
  );
};

const GuardHarness = ({ allowGuestPaths }: { allowGuestPaths?: string[] }) => {
  const location = useLocation();
  const isLoginRoute = /^\/(?:t\/[^/]+\/)?user\/login(?:\/|$)/i.test(
    location.pathname,
  );

  return (
    <>
      {isLoginRoute ? null : (
        <UserPortalGuard allowGuestPaths={allowGuestPaths}>
          <div>Portal content</div>
        </UserPortalGuard>
      )}
      <LocationProbe />
    </>
  );
};

const renderGuard = ({
  entry,
  allowGuestPaths,
}: {
  entry: string;
  allowGuestPaths?: string[];
}) =>
  render(
    <MemoryRouter
      initialEntries={[entry]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <GuardHarness allowGuestPaths={allowGuestPaths} />
    </MemoryRouter>,
  );

describe('UserPortalGuard session authority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    guardMocks.user = null;
    guardMocks.loading = false;
    guardMocks.refreshUser.mockResolvedValue(undefined);
    guardMocks.authority = {
      clerkStatus: 'disabled',
      hasBearerSession: false,
      hasVerifiedSession: false,
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('allows a public portal guest even when the user store contains stale backoffice data', () => {
    guardMocks.user = { rol: 'tenant_admin' };

    renderGuard({
      entry: '/t/junin/portal/reclamos',
      allowGuestPaths: ['/t/:tenant/portal/reclamos'],
    });

    expect(screen.getByText('Portal content')).toBeInTheDocument();
    expect(guardMocks.refreshUser).not.toHaveBeenCalled();
  });

  it.each(['loading', 'signed_out'] as const)(
    'does not trust stale user data while Clerk is %s',
    (clerkStatus) => {
      guardMocks.user = { rol: 'tenant_admin' };
      guardMocks.authority = {
        clerkStatus,
        hasBearerSession: clerkStatus === 'loading',
        hasVerifiedSession: false,
      };

      renderGuard({
        entry: '/t/junin/portal/dashboard',
        allowGuestPaths: ['/t/:tenant/portal/dashboard'],
      });

      expect(screen.getByText('Portal content')).toBeInTheDocument();
      expect(guardMocks.refreshUser).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      entry: '/portal/dashboard?view=compact#today',
      expectedLogin:
        '/user/login?next=%2Fportal%2Fdashboard%3Fview%3Dcompact%23today',
    },
    {
      entry: '/t/junin/portal/cuenta?tab=seguridad#datos',
      expectedLogin:
        '/t/junin/user/login?next=%2Ft%2Fjunin%2Fportal%2Fcuenta%3Ftab%3Dseguridad%23datos',
    },
  ])('preserves the exact portal destination when redirecting $entry', async ({ entry, expectedLogin }) => {
    guardMocks.user = { rol: 'tenant_admin' };

    renderGuard({ entry });

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(expectedLogin);
    });
    expect(screen.getByTestId('location-state')).toHaveTextContent(
      JSON.stringify({ redirectTo: entry }),
    );
    expect(guardMocks.refreshUser).not.toHaveBeenCalled();
  });

  it('waits for a verified bearer profile refresh before deciding that login is required', async () => {
    let resolveRefresh: (() => void) | undefined;
    guardMocks.authority = {
      clerkStatus: 'disabled',
      hasBearerSession: true,
      hasVerifiedSession: true,
    };
    guardMocks.refreshUser.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveRefresh = resolve;
      }),
    );

    renderGuard({ entry: '/t/junin/portal/cuenta?tab=datos#perfil' });

    expect(screen.getByText('Cargando tu sesión...')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/t/junin/portal/cuenta?tab=datos#perfil',
    );
    await waitFor(() => expect(guardMocks.refreshUser).toHaveBeenCalledTimes(1));

    await act(async () => {
      resolveRefresh?.();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/t/junin/user/login?next=%2Ft%2Fjunin%2Fportal%2Fcuenta%3Ftab%3Ddatos%23perfil',
      );
    });
    expect(guardMocks.refreshUser).toHaveBeenCalledTimes(1);
  });

  it('renders portal content for a hydrated user with a verified Clerk session', () => {
    guardMocks.user = { rol: 'chat_user' };
    guardMocks.authority = {
      clerkStatus: 'ready',
      hasBearerSession: false,
      hasVerifiedSession: true,
    };

    renderGuard({ entry: '/t/junin/portal/dashboard' });

    expect(screen.getByText('Portal content')).toBeInTheDocument();
    expect(guardMocks.refreshUser).not.toHaveBeenCalled();
  });

  it('sends a verified backoffice user from the standalone portal shell to the real panel', async () => {
    guardMocks.user = { rol: 'tenant_admin' };
    guardMocks.authority = {
      clerkStatus: 'disabled',
      hasBearerSession: true,
      hasVerifiedSession: true,
    };
    const assignSpy = vi.fn();
    vi.stubGlobal('location', {
      ...window.location,
      pathname: '/portal/index.html',
      assign: assignSpy,
    });

    renderGuard({
      entry: '/t/junin/portal/reclamos',
      allowGuestPaths: ['/t/:tenant/portal/reclamos'],
    });

    expect(screen.getByText('Abriendo panel...')).toBeInTheDocument();
    await waitFor(() => {
      expect(assignSpy).toHaveBeenCalledWith('/perfil');
    });
  });
});
