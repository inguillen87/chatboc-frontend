import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { safeLocalStorage, safeSessionStorage } from '@/utils/safeLocalStorage';
import { logoutChatbocSession } from '@/utils/sessionLogout';
import { persistClerkAuthContext } from '@/utils/clerkAuthContext';
import { usePanelSessionStore, useWidgetSessionStore } from '@/stores';
import { completeClerkOnboarding } from '@/api/clerkAuth';
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
  resolveTenantSlug: vi.fn(() => 'junin'),
}));

vi.mock('./ClerkTenantOnboardingDialog', () => ({
  default: ({
    open,
    userProfile,
    completion,
    onSubmit,
    onCompletionPrimary,
  }: {
    open: boolean;
    userProfile?: { id?: string | null };
    completion?: { primaryActionLabel?: string } | null;
    onSubmit: (payload: Record<string, unknown>) => Promise<void> | void;
    onCompletionPrimary?: () => void;
  }) =>
    open ? (
      <div>
        <div data-testid="clerk-onboarding-user">{userProfile?.id}</div>
        {completion ? (
          <div data-testid="clerk-onboarding-completion">
            <button type="button" onClick={onCompletionPrimary}>{completion.primaryActionLabel}</button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              void onSubmit({
                tenant_name: 'Ferreteria Modelo',
                vertical: 'pyme',
                rubro: 'ventas',
                terms_accepted: true,
                terms_version: '2026-07-11',
              });
            }}
          >
            Completar onboarding
          </button>
        )}
      </div>
    ) : null,
}));

const mockedCompleteClerkOnboarding = vi.mocked(completeClerkOnboarding);

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

const renderBridge = (initialEntry = '/login') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
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
    safeSessionStorage.clear();
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
    mockedCompleteClerkOnboarding.mockReset().mockResolvedValue({
      contract_version: 'auth.clerk.v1',
      token: 'chatboc-token',
      auth_provider: 'clerk',
      user: {
        id: 42,
        email: 'lucia@chatboc.test',
        rol: 'tenant_admin',
        tenant_slug: 'lucia-tenant',
      },
      tenant: { id: 7, slug: 'lucia-tenant', nombre: 'Ferreteria Modelo' },
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
    expect(safeLocalStorage.getItem('chatAuthToken')).toBeNull();
    expect(safeLocalStorage.getItem('clerkUserId')).toBe('user_clerk_1');
    expect(usePanelSessionStore.getState().user).toMatchObject({
      authProvider: 'clerk',
      auth_provider: 'clerk',
      authIntent: 'tenant_owner',
    });
  });

  it('persists a cookie-backed Clerk session without exposing a JWT in storage', async () => {
    clerkMocks.syncClerkSession.mockResolvedValueOnce({
      contract_version: 'auth.clerk.v1',
      token: null,
      auth_provider: 'clerk',
      auth_intent: 'tenant_owner',
      session_transport: 'cookie',
      user: {
        id: 42,
        email: 'lucia@chatboc.test',
        rol: 'tenant_admin',
        tenant_slug: 'lucia-tenant',
      },
      tenant: { id: 7, slug: 'lucia-tenant' },
      onboarding: { required: false },
    });

    renderBridge();

    await waitFor(() => expect(safeLocalStorage.getItem('authProvider')).toBe('clerk'));
    expect(safeLocalStorage.getItem('authToken')).toBeNull();
    expect(safeLocalStorage.getItem('chatAuthToken')).toBeNull();
    expect(safeLocalStorage.getItem('clerkSessionTransport')).toBe('cookie');
    expect(usePanelSessionStore.getState().user).toMatchObject({ id: 42 });
    expect(clerkMocks.refreshUser).toHaveBeenCalledTimes(1);
  });

  it('keeps a portal cookie session scoped after dashboard navigation', async () => {
    persistClerkAuthContext({
      intent: 'tenant_portal',
      tenantSlug: 'junin',
      returnTo: '/t/junin/portal/dashboard',
    });
    clerkMocks.syncClerkSession.mockResolvedValue({
      contract_version: 'auth.clerk.v1',
      token: null,
      auth_provider: 'clerk',
      auth_intent: 'tenant_portal',
      session_transport: 'cookie',
      user: {
        id: 42,
        email: 'vecina@chatboc.test',
        rol: 'user',
        tenant_slug: 'junin',
      },
      tenant: { id: 7, slug: 'junin' },
      onboarding: { required: false },
    });

    renderBridge('/t/junin/user/login');

    await waitFor(() => expect(clerkMocks.refreshUser).toHaveBeenCalledTimes(1));
    await act(async () => {
      await Promise.resolve();
    });
    expect(clerkMocks.syncClerkSession).toHaveBeenCalledTimes(1);
    expect(clerkMocks.syncClerkSession).toHaveBeenCalledWith(
      'clerk-jwt',
      expect.any(Object),
      { intent: 'tenant_portal', tenant_slug: 'junin' },
    );
    expect(safeLocalStorage.getItem('clerkAuthIntent')).toBe('tenant_portal');
  });

  it('preserves the WhatsApp return path until the completed tenant handoff is confirmed', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    persistClerkAuthContext({
      intent: 'tenant_owner',
      returnTo: '/t/lucia-tenant/integracion?channel=whatsapp&action=register-whatsapp',
    });
    clerkMocks.syncClerkSession.mockResolvedValueOnce({
      contract_version: 'auth.clerk.v1',
      token: null,
      auth_provider: 'clerk',
      user: {
        id: 42,
        email: 'lucia@chatboc.test',
        rol: 'tenant_admin',
      },
      tenant: null,
      onboarding: {
        required: true,
        status: 'pending',
        modal: { mode: 'tenant_setup' },
      },
    });

    renderBridge('/register');

    fireEvent.click(await screen.findByRole('button', { name: /completar onboarding/i }));

    const continueButton = await screen.findByRole('button', { name: /continuar con whatsapp/i });
    expect(consoleLogSpy).not.toHaveBeenCalledWith(
      'Mocked navigate to: /t/lucia-tenant/integracion?channel=whatsapp&action=register-whatsapp',
    );
    expect(safeSessionStorage.getItem('chatboc.clerk.auth-context.v1')).not.toBeNull();

    fireEvent.click(continueButton);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Mocked navigate to: /t/lucia-tenant/integracion?channel=whatsapp&action=register-whatsapp',
    );
    expect(safeSessionStorage.getItem('chatboc.clerk.auth-context.v1')).toBeNull();
    consoleLogSpy.mockRestore();
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
