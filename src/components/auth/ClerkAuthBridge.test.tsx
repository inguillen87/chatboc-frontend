import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { logoutChatbocSession } from '@/utils/sessionLogout';
import { usePanelSessionStore, useWidgetSessionStore } from '@/stores';
import ClerkAuthBridge from './ClerkAuthBridge';
import { ClerkRuntimeProvider } from './ClerkRuntimeContext';

const clerkMocks = vi.hoisted(() => ({
  auth: {
    isLoaded: true,
    isSignedIn: true as boolean | undefined,
    getToken: vi.fn(),
    signOut: vi.fn(),
  },
  clerkUser: {
    id: 'user_clerk_1',
    firstName: 'Lucia',
    lastName: 'Auth',
    updatedAt: new Date('2026-07-11T12:00:00Z'),
    emailAddresses: [],
    phoneNumbers: [],
    externalAccounts: [],
  } as Record<string, unknown> | null,
  syncClerkSession: vi.fn(),
  backendLogout: vi.fn(),
  refreshUser: vi.fn(),
}));

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => clerkMocks.auth,
  useUser: () => ({ user: clerkMocks.clerkUser }),
}));

vi.mock('@/api/clerkAuth', () => ({
  completeClerkOnboarding: vi.fn(),
  syncClerkSession: clerkMocks.syncClerkSession,
}));

vi.mock('@/hooks/useUser', () => ({
  useUser: () => ({ refreshUser: clerkMocks.refreshUser }),
}));

vi.mock('@/utils/api', () => ({
  apiFetch: clerkMocks.backendLogout,
}));

vi.mock('./ClerkTenantOnboardingDialog', () => ({
  default: ({ open, userProfile }: { open: boolean; userProfile?: { id?: string | null } }) =>
    open ? <div data-testid="clerk-onboarding-user">{userProfile?.id}</div> : null,
}));

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
};

const jwtWithClaims = (claims: Record<string, unknown>) => {
  const payload = btoa(JSON.stringify(claims))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `header.${payload}.signature`;
};

const renderBridge = () =>
  render(
    <MemoryRouter initialEntries={['/login']}>
      <ClerkRuntimeProvider
        value={{
          enabled: true,
          loading: false,
          publishableKey: 'pk_test_local',
          source: 'backend',
          socialProviders: ['google'],
        }}
      >
        <ClerkAuthBridge />
      </ClerkRuntimeProvider>
    </MemoryRouter>,
  );

describe('ClerkAuthBridge session lifecycle', () => {
  beforeEach(() => {
    safeLocalStorage.clear();
    usePanelSessionStore.setState({ authToken: null, user: null });
    useWidgetSessionStore.setState({
      status: 'idle',
      errorMessage: null,
      anonId: null,
      sessionId: null,
      chatAuthToken: null,
      entityToken: null,
      contactKey: null,
      conversationId: null,
    });
    clerkMocks.auth.isLoaded = true;
    clerkMocks.auth.isSignedIn = true;
    clerkMocks.auth.getToken.mockReset().mockResolvedValue('clerk-jwt');
    clerkMocks.auth.signOut.mockReset().mockResolvedValue(undefined);
    clerkMocks.clerkUser = {
      id: 'user_clerk_1',
      firstName: 'Lucia',
      lastName: 'Auth',
      updatedAt: new Date('2026-07-11T12:00:00Z'),
      emailAddresses: [],
      phoneNumbers: [],
      externalAccounts: [],
    };
    clerkMocks.syncClerkSession.mockReset().mockResolvedValue({
      contract_version: 'auth.clerk.v1',
      token: 'chatboc-token',
      auth_provider: 'clerk',
      user: {
        id: 42,
        email: 'lucia@chatboc.test',
        rol: 'tenant_admin',
        tenant_slug: 'lucia-tenant',
      },
      tenant: { id: 7, slug: 'lucia-tenant' },
      onboarding: { required: false },
    });
    clerkMocks.refreshUser.mockReset().mockResolvedValue(undefined);
    clerkMocks.backendLogout.mockReset().mockResolvedValue({ ok: true });
  });

  it('marks synchronized sessions as Clerk sessions', async () => {
    renderBridge();

    await waitFor(() => {
      expect(safeLocalStorage.getItem('authProvider')).toBe('clerk');
    });

    expect(safeLocalStorage.getItem('authToken')).toBe('chatboc-token');
    expect(safeLocalStorage.getItem('chatAuthToken')).toBe('chatboc-token');
    expect(safeLocalStorage.getItem('clerkUserId')).toBe('user_clerk_1');
    expect(usePanelSessionStore.getState().user).toMatchObject({
      authProvider: 'clerk',
      auth_provider: 'clerk',
    });
  });

  it('clears local tokens and stores only after Clerk signs out', async () => {
    const view = renderBridge();

    await waitFor(() => {
      expect(usePanelSessionStore.getState().authToken).toBe('chatboc-token');
    });
    safeLocalStorage.setItem('entityToken', 'entity-token');
    safeLocalStorage.setItem('owner_token', 'owner-token');
    useWidgetSessionStore.setState({ entityToken: 'entity-token' });

    clerkMocks.auth.isSignedIn = false;
    clerkMocks.clerkUser = null;
    view.rerender(
      <MemoryRouter initialEntries={['/login']}>
        <ClerkRuntimeProvider
          value={{
            enabled: true,
            loading: false,
            publishableKey: 'pk_test_local',
            source: 'backend',
            socialProviders: ['google'],
          }}
        >
          <ClerkAuthBridge />
        </ClerkRuntimeProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(usePanelSessionStore.getState().authToken).toBeNull();
      expect(useWidgetSessionStore.getState().chatAuthToken).toBeNull();
    });
    expect(usePanelSessionStore.getState().user).toBeNull();
    expect(useWidgetSessionStore.getState().entityToken).toBeNull();
    expect(safeLocalStorage.getItem('authToken')).toBeNull();
    expect(safeLocalStorage.getItem('chatAuthToken')).toBeNull();
    expect(safeLocalStorage.getItem('entityToken')).toBeNull();
    expect(safeLocalStorage.getItem('owner_token')).toBeNull();
    expect(safeLocalStorage.getItem('user')).toBeNull();
    expect(safeLocalStorage.getItem('authProvider')).toBeNull();
    expect(safeLocalStorage.getItem('clerkUserId')).toBeNull();
  });

  it('preserves a legacy session on the initial signed-out render', async () => {
    clerkMocks.auth.isSignedIn = false;
    clerkMocks.clerkUser = null;
    safeLocalStorage.setItem('authToken', 'legacy-token');
    usePanelSessionStore.setState({ authToken: 'legacy-token' });

    renderBridge();

    await waitFor(() => {
      expect(safeLocalStorage.getItem('authToken')).toBe('legacy-token');
    });
    expect(usePanelSessionStore.getState().authToken).toBe('legacy-token');
    expect(clerkMocks.syncClerkSession).not.toHaveBeenCalled();
  });

  it('clears a persisted Clerk session on the initial signed-out render', async () => {
    clerkMocks.auth.isSignedIn = false;
    clerkMocks.clerkUser = null;
    safeLocalStorage.setItem('authProvider', 'clerk');
    safeLocalStorage.setItem('authToken', 'stale-clerk-token');
    usePanelSessionStore.setState({ authToken: 'stale-clerk-token' });

    renderBridge();

    await waitFor(() => {
      expect(safeLocalStorage.getItem('authToken')).toBeNull();
    });
    expect(safeLocalStorage.getItem('authProvider')).toBeNull();
    expect(usePanelSessionStore.getState().authToken).toBeNull();
    expect(clerkMocks.syncClerkSession).not.toHaveBeenCalled();
  });

  it('detects and clears a pre-migration Clerk session from JWT claims', async () => {
    clerkMocks.auth.isSignedIn = false;
    clerkMocks.clerkUser = null;
    safeLocalStorage.setItem('authToken', jwtWithClaims({
      auth_provider: 'clerk',
      session_kind: 'clerk',
    }));
    usePanelSessionStore.setState({ authToken: safeLocalStorage.getItem('authToken') });

    renderBridge();

    await waitFor(() => {
      expect(safeLocalStorage.getItem('authToken')).toBeNull();
    });
    expect(usePanelSessionStore.getState().authToken).toBeNull();
    expect(clerkMocks.backendLogout).toHaveBeenCalledTimes(1);
    expect(clerkMocks.syncClerkSession).not.toHaveBeenCalled();
  });

  it('clears user A before exposing pending onboarding for Clerk user B', async () => {
    const view = renderBridge();

    await waitFor(() => {
      expect(usePanelSessionStore.getState().authToken).toBe('chatboc-token');
    });
    safeLocalStorage.setItem('entityToken', 'entity-a');
    safeLocalStorage.setItem('owner_token', 'owner-a');
    useWidgetSessionStore.setState({ entityToken: 'entity-a' });

    const tokenForB = deferred<string | null>();
    clerkMocks.auth.getToken.mockReturnValueOnce(tokenForB.promise);
    clerkMocks.syncClerkSession.mockResolvedValueOnce({
      contract_version: 'auth.clerk.v1',
      token: null,
      auth_provider: 'clerk',
      user: {
        id: 84,
        email: 'user-b@chatboc.test',
        rol: 'tenant_admin',
      },
      tenant: null,
      onboarding: { required: true, status: 'pending' },
    });
    clerkMocks.clerkUser = {
      id: 'user_clerk_b',
      firstName: 'Bruno',
      lastName: 'Pending',
      updatedAt: new Date('2026-07-11T13:00:00Z'),
      emailAddresses: [],
      phoneNumbers: [],
      externalAccounts: [],
    };

    view.rerender(
      <MemoryRouter initialEntries={['/login']}>
        <ClerkRuntimeProvider
          value={{
            enabled: true,
            loading: false,
            publishableKey: 'pk_test_local',
            source: 'backend',
            socialProviders: ['google'],
          }}
        >
          <ClerkAuthBridge />
        </ClerkRuntimeProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(usePanelSessionStore.getState()).toMatchObject({ authToken: null, user: null });
    });
    expect(useWidgetSessionStore.getState()).toMatchObject({
      chatAuthToken: null,
      entityToken: null,
    });
    expect(safeLocalStorage.getItem('authToken')).toBeNull();
    expect(safeLocalStorage.getItem('chatAuthToken')).toBeNull();
    expect(safeLocalStorage.getItem('entityToken')).toBeNull();
    expect(safeLocalStorage.getItem('owner_token')).toBeNull();
    expect(clerkMocks.syncClerkSession).toHaveBeenCalledTimes(1);

    await act(async () => {
      tokenForB.resolve('clerk-jwt-b');
      await tokenForB.promise;
    });

    await waitFor(() => expect(clerkMocks.syncClerkSession).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId('clerk-onboarding-user')).toHaveTextContent('user_clerk_b');
  });

  it('invalidates user A before Clerk user B getToken resolves null', async () => {
    const view = renderBridge();
    await waitFor(() => expect(usePanelSessionStore.getState().authToken).toBe('chatboc-token'));
    const tokenForB = deferred<string | null>();
    clerkMocks.auth.getToken.mockReturnValueOnce(tokenForB.promise);
    clerkMocks.clerkUser = {
      id: 'user_clerk_b',
      firstName: 'Bruno',
      lastName: 'Sin token',
      updatedAt: new Date('2026-07-11T14:00:00Z'),
      emailAddresses: [],
      phoneNumbers: [],
      externalAccounts: [],
    };

    view.rerender(
      <MemoryRouter initialEntries={['/login']}>
        <ClerkRuntimeProvider
          value={{
            enabled: true,
            loading: false,
            publishableKey: 'pk_test_local',
            source: 'backend',
            socialProviders: ['google'],
          }}
        >
          <ClerkAuthBridge />
        </ClerkRuntimeProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(clerkMocks.auth.getToken).toHaveBeenCalledTimes(2));
    expect(usePanelSessionStore.getState()).toMatchObject({ authToken: null, user: null });
    expect(safeLocalStorage.getItem('authToken')).toBeNull();
    expect(clerkMocks.syncClerkSession).toHaveBeenCalledTimes(1);

    await act(async () => {
      tokenForB.resolve(null);
      await tokenForB.promise;
    });

    expect(usePanelSessionStore.getState()).toMatchObject({ authToken: null, user: null });
    expect(safeLocalStorage.getItem('authToken')).toBeNull();
    expect(clerkMocks.syncClerkSession).toHaveBeenCalledTimes(1);
  });

  it('keeps user A invalidated when Clerk user B token retrieval fails', async () => {
    const view = renderBridge();
    await waitFor(() => expect(usePanelSessionStore.getState().authToken).toBe('chatboc-token'));
    clerkMocks.auth.getToken.mockRejectedValueOnce(new Error('Clerk unavailable'));
    clerkMocks.clerkUser = {
      id: 'user_clerk_b',
      firstName: 'Bruno',
      lastName: 'Error',
      updatedAt: new Date('2026-07-11T15:00:00Z'),
      emailAddresses: [],
      phoneNumbers: [],
      externalAccounts: [],
    };

    view.rerender(
      <MemoryRouter initialEntries={['/login']}>
        <ClerkRuntimeProvider
          value={{
            enabled: true,
            loading: false,
            publishableKey: 'pk_test_local',
            source: 'backend',
            socialProviders: ['google'],
          }}
        >
          <ClerkAuthBridge />
        </ClerkRuntimeProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(clerkMocks.auth.getToken).toHaveBeenCalledTimes(2));
    expect(usePanelSessionStore.getState()).toMatchObject({ authToken: null, user: null });
    expect(safeLocalStorage.getItem('authToken')).toBeNull();
    expect(clerkMocks.syncClerkSession).toHaveBeenCalledTimes(1);
  });

  it('does not let a late user A sync overwrite an already synchronized user B', async () => {
    const lateUserA = deferred<Record<string, unknown>>();
    clerkMocks.syncClerkSession.mockImplementation(
      (_token: string, profile: { id?: string | null }) =>
        profile.id === 'user_clerk_1'
          ? lateUserA.promise
          : Promise.resolve({
              contract_version: 'auth.clerk.v1',
              token: 'chatboc-token-b',
              auth_provider: 'clerk',
              user: {
                id: 84,
                email: 'user-b@chatboc.test',
                rol: 'tenant_admin',
                tenant_slug: 'tenant-b',
              },
              tenant: { id: 8, slug: 'tenant-b' },
              onboarding: { required: false },
            }),
    );
    safeLocalStorage.setItem('authProvider', 'clerk');
    safeLocalStorage.setItem('clerkUserId', 'user_clerk_1');
    safeLocalStorage.setItem('authToken', 'user-a-token');
    safeLocalStorage.setItem('chatAuthToken', 'user-a-token');
    usePanelSessionStore.setState({ authToken: 'user-a-token', user: { id: 'user-a' } as any });
    useWidgetSessionStore.setState({ chatAuthToken: 'user-a-token' });

    const view = renderBridge();
    await waitFor(() => expect(clerkMocks.syncClerkSession).toHaveBeenCalledTimes(1));

    clerkMocks.clerkUser = {
      id: 'user_clerk_b',
      firstName: 'Bruno',
      lastName: 'Seguro',
      updatedAt: new Date('2026-07-11T16:00:00Z'),
      emailAddresses: [],
      phoneNumbers: [],
      externalAccounts: [],
    };
    view.rerender(
      <MemoryRouter initialEntries={['/login']}>
        <ClerkRuntimeProvider
          value={{
            enabled: true,
            loading: false,
            publishableKey: 'pk_test_local',
            source: 'backend',
            socialProviders: ['google'],
          }}
        >
          <ClerkAuthBridge />
        </ClerkRuntimeProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(safeLocalStorage.getItem('authToken')).toBe('chatboc-token-b'));
    expect(safeLocalStorage.getItem('clerkUserId')).toBe('user_clerk_b');

    await act(async () => {
      lateUserA.resolve({
        contract_version: 'auth.clerk.v1',
        token: 'late-user-a-token',
        auth_provider: 'clerk',
        user: { id: 42, email: 'user-a@chatboc.test', rol: 'tenant_admin' },
        tenant: { id: 7, slug: 'tenant-a' },
        onboarding: { required: false },
      });
      await lateUserA.promise;
    });

    expect(safeLocalStorage.getItem('authToken')).toBe('chatboc-token-b');
    expect(safeLocalStorage.getItem('clerkUserId')).toBe('user_clerk_b');
    expect(usePanelSessionStore.getState().user).toMatchObject({ id: 84 });
  });

  it('does not rehydrate a late Clerk sync response after logout', async () => {
    const lateSync = deferred<Record<string, unknown>>();
    clerkMocks.syncClerkSession.mockReturnValueOnce(lateSync.promise);
    safeLocalStorage.setItem('authProvider', 'clerk');
    safeLocalStorage.setItem('authToken', 'user-a-token');
    safeLocalStorage.setItem('chatAuthToken', 'user-a-token');
    safeLocalStorage.setItem('user', JSON.stringify({ id: 'user-a' }));
    usePanelSessionStore.setState({ authToken: 'user-a-token', user: { id: 'user-a' } as any });
    useWidgetSessionStore.setState({ chatAuthToken: 'user-a-token' });

    renderBridge();
    await waitFor(() => expect(clerkMocks.syncClerkSession).toHaveBeenCalledTimes(1));

    await act(async () => {
      await logoutChatbocSession({ clerkEnabled: true });
    });
    expect(clerkMocks.auth.signOut).toHaveBeenCalledTimes(1);
    expect(usePanelSessionStore.getState()).toMatchObject({ authToken: null, user: null });

    await act(async () => {
      lateSync.resolve({
        contract_version: 'auth.clerk.v1',
        token: 'late-user-a-token',
        auth_provider: 'clerk',
        user: { id: 42, email: 'user-a@chatboc.test', rol: 'tenant_admin' },
        tenant: { id: 7, slug: 'user-a' },
        onboarding: { required: false },
      });
      await lateSync.promise;
    });

    expect(safeLocalStorage.getItem('authToken')).toBeNull();
    expect(safeLocalStorage.getItem('chatAuthToken')).toBeNull();
    expect(safeLocalStorage.getItem('user')).toBeNull();
    expect(usePanelSessionStore.getState()).toMatchObject({ authToken: null, user: null });
    expect(useWidgetSessionStore.getState().chatAuthToken).toBeNull();
  });
});
