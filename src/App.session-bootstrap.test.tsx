import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { apiFetch } from '@/utils/api';
import { usePanelSessionStore } from '@/stores';
import { CLERK_RUNTIME_BOOTSTRAP_TIMEOUT_MS } from '@/components/auth/clerkRuntimeResolver';

const bootstrapMocks = vi.hoisted(() => ({
  tenantInfo: vi.fn(),
  followedTenants: vi.fn(),
  cart: vi.fn(),
  backofficeNavigation: vi.fn(),
  clerkConfig: vi.fn(),
  publicMounts: vi.fn(),
  publicMutation: vi.fn(),
  publicUnmounts: vi.fn(),
}));

const clerkMocks = vi.hoisted(() => ({
  auth: {
    isLoaded: true,
    isSignedIn: false as boolean | undefined,
    userId: null as string | null,
    sessionId: null as string | null,
  },
  bridgeReady: false,
  bridgeMounts: vi.fn(),
  bridgeUnmounts: vi.fn(),
}));

vi.mock('@clerk/clerk-react', () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => clerkMocks.auth,
}));

vi.mock('@/components/auth/ClerkAuthBridge', async () => {
  const ReactModule = await import('react');
  return {
    default: ({
      onSessionPending,
      onSessionReady,
      onSessionReset,
    }: {
      onSessionPending?: (identity: string) => void;
      onSessionReady?: (identity: string) => void;
      onSessionReset?: () => void;
    }) => {
      ReactModule.useEffect(() => {
        clerkMocks.bridgeMounts();
        return () => clerkMocks.bridgeUnmounts();
      }, []);

      ReactModule.useEffect(() => {
        const { isLoaded, isSignedIn, userId, sessionId } = clerkMocks.auth;
        if (!isLoaded) return;
        if (!isSignedIn || !userId) {
          onSessionReset?.();
          return;
        }
        const identity = `${userId}:${sessionId || ''}`;
        onSessionPending?.(identity);
        if (clerkMocks.bridgeReady) onSessionReady?.(identity);
      }, [
        clerkMocks.auth.isLoaded,
        clerkMocks.auth.isSignedIn,
        clerkMocks.auth.sessionId,
        clerkMocks.auth.userId,
        clerkMocks.bridgeReady,
        onSessionPending,
        onSessionReady,
        onSessionReset,
      ]);
      return null;
    },
  };
});

vi.mock('./routesConfig', async () => {
  const ReactModule = await import('react');
  const { Navigate } = await import('react-router-dom');

  const ProfileProbe = () => {
    ReactModule.useEffect(() => {
      bootstrapMocks.backofficeNavigation('/api/app/backoffice/navigation');
    }, []);
    return ReactModule.createElement('div', null, 'profile');
  };

  const PublicContinuityProbe = () => {
    const [draft, setDraft] = ReactModule.useState('');
    const [mutationStatus, setMutationStatus] = ReactModule.useState('idle');

    ReactModule.useEffect(() => {
      bootstrapMocks.publicMounts();
      return () => bootstrapMocks.publicUnmounts();
    }, []);

    const submitMutation = async () => {
      setMutationStatus('pending');
      await bootstrapMocks.publicMutation('/api/bootstrap-continuity', { method: 'POST' });
      setMutationStatus('confirmed');
    };

    return ReactModule.createElement(
      'section',
      { 'aria-label': 'Continuidad publica' },
      ReactModule.createElement('label', { htmlFor: 'continuity-draft' }, 'Borrador transitorio'),
      ReactModule.createElement('input', {
        id: 'continuity-draft',
        value: draft,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => setDraft(event.target.value),
      }),
      ReactModule.createElement(
        'button',
        { type: 'button', onClick: () => void submitMutation() },
        'Confirmar operacion',
      ),
      ReactModule.createElement('output', { 'data-testid': 'mutation-status' }, mutationStatus),
    );
  };

  return {
    default: [
      {
        path: '/t/:tenant/inbox',
        element: ReactModule.createElement('div', null, 'inbox'),
        roles: ['tenant_admin', 'employee', 'superadmin'],
        requiredCapabilities: ['tickets.read'],
      },
      {
        path: '/t/:tenant/market',
        element: ReactModule.createElement('div', null, 'market'),
        allowGuest: true,
      },
      {
        path: '/bootstrap-continuity',
        element: ReactModule.createElement(PublicContinuityProbe),
        allowGuest: true,
      },
      {
        path: '/demo',
        element: ReactModule.createElement(PublicContinuityProbe),
        allowGuest: true,
      },
      {
        path: '/admin',
        element: ReactModule.createElement(Navigate, { to: '/perfil', replace: true }),
        requiresSession: true,
      },
      { path: '/perfil', element: ReactModule.createElement(ProfileProbe), requiresSession: true },
      {
        path: '/perfil/pedidos',
        element: ReactModule.createElement(Navigate, { to: '/pedidos', replace: true }),
        requiresSession: true,
      },
      {
        path: '/tickets',
        element: ReactModule.createElement(Navigate, { to: '/perfil', replace: true }),
        requiresSession: true,
      },
      { path: '/login', element: ReactModule.createElement('div', null, 'login') },
      { path: '/403', element: ReactModule.createElement('div', null, 'forbidden') },
    ],
  };
});

vi.mock('@/api/tenant', () => ({
  followTenant: vi.fn(),
  getTenantPublicInfoFlexible: bootstrapMocks.tenantInfo,
  listFollowedTenants: bootstrapMocks.followedTenants,
  unfollowTenant: vi.fn(),
}));

vi.mock('@/api/market', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/market')>();
  return {
    ...actual,
    fetchMarketCart: bootstrapMocks.cart,
  };
});

vi.mock('@/api/clerkAuth', () => ({
  fetchClerkFrontendConfig: bootstrapMocks.clerkConfig,
}));

vi.mock('@/utils/anonId', () => ({
  ensureRemoteAnonId: vi.fn().mockResolvedValue('anon-test'),
}));

vi.mock('@/components/app-shell/AppShellStatusBar', () => ({
  AppShellStatusBar: () => null,
}));

vi.mock('@/components/app-shell/AppAccessibility', () => ({
  AppAccessibility: () => null,
}));

vi.mock('@/components/app-shell/PwaInstallPrompt', () => ({
  PwaInstallPrompt: () => null,
}));

vi.mock('@/components/guidance/ScrollMascotGuide', () => ({
  default: () => null,
}));

vi.mock('@/components/chat/ChatWidget', () => ({
  default: () => null,
}));

import App from './App';

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const expectNoPrivateBootstrapCalls = () => {
  expect(bootstrapMocks.tenantInfo).not.toHaveBeenCalled();
  expect(bootstrapMocks.followedTenants).not.toHaveBeenCalled();
  expect(bootstrapMocks.cart).not.toHaveBeenCalled();
  expect(bootstrapMocks.backofficeNavigation).not.toHaveBeenCalled();
  expect(
    vi.mocked(apiFetch).mock.calls.some(([path]) => path === '/api/me'),
  ).toBe(false);
};

describe('App session bootstrap ordering', () => {
  beforeEach(() => {
    safeLocalStorage.clear();
    usePanelSessionStore.getState().clearSession();
    vi.mocked(apiFetch).mockClear();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    Object.values(bootstrapMocks).forEach((mock) => mock.mockReset());
    bootstrapMocks.followedTenants.mockResolvedValue([]);
    bootstrapMocks.tenantInfo.mockResolvedValue({
      slug: 'junin',
      nombre: 'Municipalidad de Junín',
      logo_url: null,
      tema: null,
      tipo: 'municipio',
      descripcion: null,
      public_base_url: null,
      public_cart_url: null,
      public_catalog_url: null,
      whatsapp_share_url: null,
    });
    bootstrapMocks.cart.mockResolvedValue({ items: [] });
    bootstrapMocks.clerkConfig.mockResolvedValue({
      enabled: false,
      environment: 'production',
      production_ready: false,
      ready_for_session_sync: false,
      social_providers: [],
      configuration_warnings: [],
    });
    clerkMocks.auth.isLoaded = true;
    clerkMocks.auth.isSignedIn = false;
    clerkMocks.auth.userId = null;
    clerkMocks.auth.sessionId = null;
    clerkMocks.bridgeReady = false;
    clerkMocks.bridgeMounts.mockReset();
    clerkMocks.bridgeUnmounts.mockReset();
    bootstrapMocks.publicMounts.mockReset();
    bootstrapMocks.publicMutation.mockReset().mockResolvedValue({ ok: true });
    bootstrapMocks.publicUnmounts.mockReset();
  });

  it.each([
    {
      label: 'disabled',
      config: {
        enabled: false,
        environment: 'production',
        production_ready: false,
        ready_for_session_sync: false,
        social_providers: [],
        configuration_warnings: [],
      },
    },
    {
      label: 'enabled',
      config: {
        enabled: true,
        environment: 'development',
        production_ready: true,
        ready_for_session_sync: true,
        publishable_key: 'pk_test_verified',
        social_providers: [],
        configuration_warnings: [],
      },
    },
  ])('mounts a stateful public route once after deferred Clerk resolves $label', async ({ config }) => {
    const runtimeConfig = deferred<Record<string, unknown>>();
    bootstrapMocks.clerkConfig.mockReturnValue(runtimeConfig.promise);
    window.history.replaceState({}, '', '/bootstrap-continuity');

    const view = render(<App />);

    expect(screen.getByRole('heading', { name: 'Preparando Chatboc' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Borrador transitorio')).not.toBeInTheDocument();
    expect(bootstrapMocks.publicMounts).not.toHaveBeenCalled();

    await act(async () => {
      runtimeConfig.resolve(config);
      await runtimeConfig.promise;
    });

    const draft = await screen.findByLabelText('Borrador transitorio');
    fireEvent.change(draft, { target: { value: 'estado que debe sobrevivir' } });
    expect(draft).toHaveValue('estado que debe sobrevivir');

    view.rerender(<App />);

    expect(screen.getByLabelText('Borrador transitorio')).toHaveValue('estado que debe sobrevivir');
    expect(bootstrapMocks.publicMounts).toHaveBeenCalledTimes(1);
    expect(bootstrapMocks.publicUnmounts).not.toHaveBeenCalled();
    expect(bootstrapMocks.clerkConfig).toHaveBeenCalledTimes(1);
  });

  it('exposes a deferred public POST only after bootstrap and executes it once', async () => {
    const runtimeConfig = deferred<Record<string, unknown>>();
    const mutation = deferred<{ ok: boolean }>();
    bootstrapMocks.clerkConfig.mockReturnValue(runtimeConfig.promise);
    bootstrapMocks.publicMutation.mockReturnValue(mutation.promise);
    window.history.replaceState({}, '', '/bootstrap-continuity');

    const view = render(<App />);

    expect(screen.queryByRole('button', { name: 'Confirmar operacion' })).not.toBeInTheDocument();
    expect(bootstrapMocks.publicMutation).not.toHaveBeenCalled();

    await act(async () => {
      runtimeConfig.resolve({
        enabled: false,
        environment: 'production',
        production_ready: false,
        ready_for_session_sync: false,
        social_providers: [],
        configuration_warnings: [],
      });
      await runtimeConfig.promise;
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar operacion' }));
    expect(screen.getByTestId('mutation-status')).toHaveTextContent('pending');
    expect(bootstrapMocks.publicMutation).toHaveBeenCalledTimes(1);
    expect(bootstrapMocks.publicMutation).toHaveBeenCalledWith(
      '/api/bootstrap-continuity',
      { method: 'POST' },
    );

    view.rerender(<App />);
    expect(bootstrapMocks.publicMutation).toHaveBeenCalledTimes(1);
    expect(bootstrapMocks.publicUnmounts).not.toHaveBeenCalled();

    await act(async () => {
      mutation.resolve({ ok: true });
      await mutation.promise;
    });

    expect(screen.getByTestId('mutation-status')).toHaveTextContent('confirmed');
    expect(bootstrapMocks.publicMutation).toHaveBeenCalledTimes(1);
    expect(bootstrapMocks.publicMounts).toHaveBeenCalledTimes(1);
    expect(bootstrapMocks.publicUnmounts).not.toHaveBeenCalled();
  });

  it('settles once on timeout and ignores a late Clerk response without remounting public state', async () => {
    vi.useFakeTimers();
    const runtimeConfig = deferred<Record<string, unknown>>();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    bootstrapMocks.clerkConfig.mockReturnValue(runtimeConfig.promise);
    window.history.replaceState({}, '', '/bootstrap-continuity');

    try {
      render(<App />);

      expect(screen.getByRole('heading', { name: 'Preparando Chatboc' })).toBeInTheDocument();
      expect(bootstrapMocks.publicMounts).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(CLERK_RUNTIME_BOOTSTRAP_TIMEOUT_MS);
      });

      const draft = screen.getByLabelText('Borrador transitorio');
      fireEvent.change(draft, { target: { value: 'fallback estable' } });
      expect(draft).toHaveValue('fallback estable');
      expect(bootstrapMocks.publicMounts).toHaveBeenCalledTimes(1);
      expect(bootstrapMocks.publicUnmounts).not.toHaveBeenCalled();

      await act(async () => {
        runtimeConfig.resolve({
          enabled: true,
          environment: 'development',
          production_ready: true,
          ready_for_session_sync: true,
          publishable_key: 'pk_test_late',
          social_providers: [],
          configuration_warnings: [],
        });
        await runtimeConfig.promise;
      });

      expect(screen.getByLabelText('Borrador transitorio')).toHaveValue('fallback estable');
      expect(bootstrapMocks.publicMounts).toHaveBeenCalledTimes(1);
      expect(bootstrapMocks.publicUnmounts).not.toHaveBeenCalled();
      expect(clerkMocks.bridgeMounts).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('se aplica el fallback seguro'),
      );
    } finally {
      warn.mockRestore();
      vi.useRealTimers();
    }
  });

  it('mounts the explicit public Preview presentation without waiting for Clerk', async () => {
    const runtimeConfig = deferred<Record<string, unknown>>();
    bootstrapMocks.clerkConfig.mockReturnValue(runtimeConfig.promise);
    window.history.replaceState({}, '', '/demo?tenant_slug=junin&remote_preview_qa=1');

    render(<App />);

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Preparando Chatboc' })).not.toBeInTheDocument();
      expect(screen.getByLabelText('Borrador transitorio')).toBeInTheDocument();
    });
    expect(bootstrapMocks.publicMounts).toHaveBeenCalledTimes(1);
    expect(bootstrapMocks.clerkConfig).not.toHaveBeenCalled();
    expect(clerkMocks.bridgeMounts).not.toHaveBeenCalled();
  });

  it('reaches /403 from a sessionless tenant inbox with zero tenant, cart or private calls', async () => {
    safeLocalStorage.setItem('tenantSlug', 'junin');
    window.history.replaceState({}, '', '/t/junin/inbox');

    render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe('/403'));
    expectNoPrivateBootstrapCalls();
  });

  it('reaches login from sessionless /admin with zero tenant, cart or backoffice calls', async () => {
    safeLocalStorage.setItem('tenantSlug', 'junin');
    window.history.replaceState({}, '', '/admin');

    render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe('/login'));
    expect(window.location.search).toBe('?next=%2Fperfil');
    expectNoPrivateBootstrapCalls();
  });

  it.each(['/tickets', '/perfil/pedidos'])(
    'resolves private alias %s before tenant, cart or backoffice providers mount',
    async (privateAlias) => {
      safeLocalStorage.setItem('tenantSlug', 'junin');
      window.history.replaceState({}, '', privateAlias);

      render(<App />);

      await waitFor(() => expect(window.location.pathname).toBe('/login'));
      expectNoPrivateBootstrapCalls();
    },
  );

  it('keeps a public tenant marketplace on the active bootstrap path', async () => {
    window.history.replaceState({}, '', '/t/junin/market');

    render(<App />);

    await waitFor(() => expect(bootstrapMocks.tenantInfo).toHaveBeenCalledWith('junin', null));
    await waitFor(() => expect(bootstrapMocks.cart).toHaveBeenCalled());
    expect(window.location.pathname).toBe('/t/junin/market');
  });

  it('keeps an authenticated profile on the active private bootstrap path', async () => {
    usePanelSessionStore.getState().setAuthToken('authenticated-panel-token');
    usePanelSessionStore.getState().setUser({
      id: 'user-1',
      email: 'admin@junin.gob.ar',
      rol: 'admin_municipio',
      rubro: 'municipio',
      tipo_chat: 'municipio',
      tenant_slug: 'junin',
    });
    safeLocalStorage.setItem('tenantSlug', 'junin');
    window.history.replaceState({}, '', '/perfil');

    render(<App />);

    await waitFor(() => expect(bootstrapMocks.backofficeNavigation).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(bootstrapMocks.tenantInfo).toHaveBeenCalledWith('junin', null));
    expect(window.location.pathname).toBe('/perfil');
  });

  it('keeps a Clerk cookie deep-link pending until the backend session is ready', async () => {
    bootstrapMocks.clerkConfig.mockResolvedValue({
      enabled: true,
      environment: 'development',
      production_ready: true,
      ready_for_session_sync: true,
      publishable_key: 'pk_test_verified',
      social_providers: [],
      configuration_warnings: [],
    });
    clerkMocks.auth.isLoaded = false;
    window.history.replaceState({}, '', '/t/junin/inbox');

    const view = render(<App />);

    await waitFor(() => expect(bootstrapMocks.clerkConfig).toHaveBeenCalled());
    expect(window.location.pathname).toBe('/t/junin/inbox');
    expectNoPrivateBootstrapCalls();

    await act(async () => {
      clerkMocks.auth.isLoaded = true;
      clerkMocks.auth.isSignedIn = true;
      clerkMocks.auth.userId = 'clerk-user-1';
      clerkMocks.auth.sessionId = 'clerk-session-1';
      view.rerender(<App />);
    });

    expect(window.location.pathname).toBe('/t/junin/inbox');
    expectNoPrivateBootstrapCalls();

    await act(async () => {
      clerkMocks.bridgeReady = true;
      usePanelSessionStore.getState().setUser({
        id: 'clerk-user-1',
        email: 'admin@junin.gob.ar',
        rol: 'tenant_admin',
        rubro: 'municipio',
        tipo_chat: 'municipio',
        tenant_slug: 'junin',
      });
      view.rerender(<App />);
    });

    await waitFor(() => expect(bootstrapMocks.tenantInfo).toHaveBeenCalledWith('junin', null));
    expect(window.location.pathname).toBe('/t/junin/inbox');
  });

  it('does not trust a stale Clerk marker after Clerk confirms signed-out', async () => {
    bootstrapMocks.clerkConfig.mockResolvedValue({
      enabled: true,
      environment: 'development',
      production_ready: true,
      ready_for_session_sync: true,
      publishable_key: 'pk_test_verified',
      social_providers: [],
      configuration_warnings: [],
    });
    safeLocalStorage.setItem('authProvider', 'clerk');
    safeLocalStorage.setItem('clerkUserId', 'stale-user');
    window.history.replaceState({}, '', '/t/junin/inbox');

    render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe('/403'));
    expectNoPrivateBootstrapCalls();
  });

  it('does not trust a stale Clerk bearer while Clerk loads or after signed-out', async () => {
    const runtimeConfig = deferred<Record<string, unknown>>();
    bootstrapMocks.clerkConfig.mockReturnValue(runtimeConfig.promise);
    safeLocalStorage.setItem('authProvider', 'clerk');
    safeLocalStorage.setItem('clerkUserId', 'stale-user');
    safeLocalStorage.setItem('authToken', 'stale-clerk-bearer');
    usePanelSessionStore.getState().setUser({
      id: 'stale-user',
      email: 'stale@junin.gob.ar',
      rol: 'tenant_admin',
      tenant_slug: 'junin',
    });
    clerkMocks.auth.isLoaded = true;
    clerkMocks.auth.isSignedIn = false;
    window.history.replaceState({}, '', '/t/junin/inbox');

    render(<App />);

    await waitFor(() => expect(bootstrapMocks.clerkConfig).toHaveBeenCalled());
    expect(window.location.pathname).toBe('/t/junin/inbox');
    expectNoPrivateBootstrapCalls();

    await act(async () => {
      runtimeConfig.resolve({
        enabled: true,
        environment: 'development',
        production_ready: true,
        ready_for_session_sync: true,
        publishable_key: 'pk_test_verified',
        social_providers: [],
        configuration_warnings: [],
      });
      await runtimeConfig.promise;
    });

    await waitFor(() => expect(window.location.pathname).toBe('/403'));
    expectNoPrivateBootstrapCalls();
  });

  it('mounts the Clerk bridge once while runtime bootstrap changes from passive to active', async () => {
    bootstrapMocks.clerkConfig.mockResolvedValue({
      enabled: true,
      environment: 'development',
      production_ready: true,
      ready_for_session_sync: true,
      publishable_key: 'pk_test_verified',
      social_providers: [],
      configuration_warnings: [],
    });
    clerkMocks.auth.isSignedIn = true;
    clerkMocks.auth.userId = 'clerk-user-1';
    clerkMocks.auth.sessionId = 'clerk-session-1';
    clerkMocks.bridgeReady = true;
    window.history.replaceState({}, '', '/login');

    render(<App />);

    await waitFor(() => expect(clerkMocks.bridgeMounts).toHaveBeenCalledTimes(1));
    act(() => {
      window.history.pushState({}, '', '/t/junin/inbox');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    await waitFor(() => expect(bootstrapMocks.tenantInfo).toHaveBeenCalledWith('junin', null));
    expect(clerkMocks.bridgeMounts).toHaveBeenCalledTimes(1);
    expect(clerkMocks.bridgeUnmounts).not.toHaveBeenCalled();
  });
});
