import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usePanelSessionStore } from '@/stores';
import { apiFetch } from '@/utils/api';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { useUser, UserProvider } from './useUser';

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
