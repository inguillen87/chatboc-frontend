import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import UserPortalGuard from './UserPortalGuard';

const guardMocks = vi.hoisted(() => ({
  user: null as null | { rol?: string },
  refreshUser: vi.fn(),
}));

vi.mock('@/hooks/useUser', () => ({
  useUser: () => ({
    user: guardMocks.user,
    refreshUser: guardMocks.refreshUser,
    loading: false,
  }),
}));

vi.mock('@/utils/authTokens', () => ({
  getValidStoredToken: vi.fn(() => null),
}));

describe('UserPortalGuard standalone portal redirects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    guardMocks.user = null;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends backoffice users from the standalone portal shell to the real panel instead of hash 404', async () => {
    guardMocks.user = { rol: 'tenant_admin' };
    const assignSpy = vi.fn();
    vi.stubGlobal('location', {
      ...window.location,
      pathname: '/portal/index.html',
      assign: assignSpy,
    });

    render(
      <MemoryRouter initialEntries={['/t/junin/portal/reclamos']}>
        <UserPortalGuard allowGuestPaths={['/t/:tenant/portal/reclamos']}>
          <div>Portal reclamos</div>
        </UserPortalGuard>
      </MemoryRouter>,
    );

    expect(screen.getByText('Abriendo panel...')).toBeInTheDocument();
    await waitFor(() => {
      expect(assignSpy).toHaveBeenCalledWith('/perfil');
    });
  });
});
