import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Login from './Login';
import { ClerkRuntimeProvider } from '@/components/auth/ClerkRuntimeContext';
import { tenantHostFixture } from '@/test/fixtures/tenantHost';

const mocks = vi.hoisted(() => ({
  credentialLogin: vi.fn(),
  googleExchange: vi.fn(),
  oauthRedirect: vi.fn(),
  passkeyLogin: vi.fn(),
  tenantContext: vi.fn(),
}));

vi.mock('@clerk/clerk-react', () => ({
  SignedOut: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignedIn: () => null,
  SignInButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignUpButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSignIn: () => ({ isLoaded: true, signIn: { authenticateWithRedirect: mocks.oauthRedirect } }),
  useSignUp: () => ({ isLoaded: true, signUp: { authenticateWithRedirect: mocks.oauthRedirect } }),
  useClerk: () => ({ session: null, client: { signIn: { authenticateWithRedirect: mocks.oauthRedirect }, signUp: { authenticateWithRedirect: mocks.oauthRedirect } } }),
}));
vi.mock('@react-oauth/google', () => ({
  GoogleLogin: ({ onSuccess }: { onSuccess: (response: { credential: string }) => void }) => (
    <button type="button" onClick={() => onSuccess({ credential: 'unused-fixture-credential' })}>Legacy Google</button>
  ),
}));
vi.mock('@/env', async original => ({ ...await original<typeof import('@/env')>(), GOOGLE_CLIENT_ID: 'fixture-client' }));
vi.mock('@/api/panelLogin', () => ({ loginPanelWithCredentials: mocks.credentialLogin }));
vi.mock('@/api/v2/auth', () => ({ loginWithGoogle: mocks.googleExchange }));
vi.mock('@/hooks/useUser', () => ({ useUser: () => ({ setUser: vi.fn(), refreshUser: vi.fn().mockResolvedValue(undefined) }) }));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => mocks.tenantContext() }));
vi.mock('@/hooks/useDateSettings', () => ({ useDateSettings: () => ({ timezone: 'America/Argentina/Buenos_Aires', locale: 'es-AR', updateSettings: vi.fn() }) }));
vi.mock('@/services/passkeys', () => ({ isPasskeySupported: () => Promise.resolve(true), loginPasskey: mocks.passkeyLogin }));
vi.mock('@/services/enterpriseService', async original => ({
  ...await original<typeof import('@/services/enterpriseService')>(),
  enterpriseService: { getDemoCatalog: vi.fn().mockResolvedValue({ tenant_demos: [], tenants: [] }) },
}));
vi.mock('@/api/rubros', () => ({ getRubrosHierarchy: vi.fn().mockResolvedValue([]) }));

const renderLogin = (clerkEnabled: boolean) => render(
  <MemoryRouter initialEntries={['/login']}>
    <ClerkRuntimeProvider value={{ enabled: clerkEnabled, loading: false, publishableKey: clerkEnabled ? 'pk_test_fixture' : '', source: clerkEnabled ? 'backend' : 'disabled', socialProviders: clerkEnabled ? ['google', 'facebook', 'linkedin'] : [] }}>
      <Login />
    </ClerkRuntimeProvider>
  </MemoryRouter>,
);

const submitCredentials = () => {
  fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'fixture@example.invalid' } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'unused-fixture' } });
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar Sesión' }));
};

describe('Login in-progress authentication', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.clearAllMocks();
    mocks.tenantContext.mockReturnValue({ currentSlug: null, tenant: null, isLoadingTenant: false });
    mocks.credentialLogin.mockReturnValue(new Promise(() => {}));
    mocks.passkeyLogin.mockReturnValue(new Promise(() => {}));
  });

  it('prevents OAuth redirects and email modal actions while credentials are pending, then recovers after failure', async () => {
    let reject!: (error: Error) => void;
    mocks.credentialLogin.mockReturnValue(new Promise((_resolve, rejectRequest) => { reject = rejectRequest; }));
    renderLogin(true);
    submitCredentials();
    expect(mocks.credentialLogin).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar con Google' }));
    expect(mocks.oauthRedirect).not.toHaveBeenCalled();
    for (const name of ['Ingresar con Google', 'Ingresar con Facebook', 'Ingresar con LinkedIn', 'Ingresar con email', 'Crear cuenta nueva']) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
    await act(async () => { reject(new Error('fixture service unavailable')); });
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor');
    expect(screen.getByLabelText('Correo electrónico')).toHaveValue('fixture@example.invalid');
    expect(screen.getByRole('button', { name: 'Ingresar con Google' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar con Google' }));
    expect(mocks.oauthRedirect).toHaveBeenCalledOnce();
  });

  it('rejects a legacy Google callback during a pending credential request', () => {
    renderLogin(false);
    submitCredentials();
    fireEvent.click(screen.getByRole('button', { name: 'Legacy Google' }));
    expect(mocks.googleExchange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Legacy Google' }).parentElement).toHaveAttribute('aria-disabled', 'true');
  });

  it('scopes a bound-host root login to its exact published tenant without platform demos', async () => {
    const binding = tenantHostFixture();
    mocks.tenantContext.mockReturnValue({ hostBinding: binding, currentSlug: binding.tenant.slug, tenant: { slug: binding.tenant.slug, publishedIdentity: binding.identity }, isLoadingTenant: false });
    renderLogin(false);
    expect(screen.getByRole('heading', { name: 'Ingresar a Organización de prueba' })).toBeInTheDocument();
    expect(screen.queryByText('Entrar a una demo guiada')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir al acceso central de ChatBoc' })).toHaveAttribute('href', 'https://www.chatboc.ar/login');
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'fixture@example.invalid' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'unused-fixture' } });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar Sesión' }));
    expect(mocks.credentialLogin).toHaveBeenCalledWith('fixture@example.invalid', 'unused-fixture', '/t/government-east/login', expect.any(Function));
  });

  it('keeps the same exclusion for a pending passkey request', async () => {
    renderLogin(true);
    const passkey = await screen.findByRole('button', { name: 'Entrar con Passkey' });
    await waitFor(() => expect(passkey).toBeEnabled());
    fireEvent.click(passkey);
    expect(mocks.passkeyLogin).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar con Google' }));
    expect(mocks.oauthRedirect).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Ingresar con email' })).toBeDisabled();
  });
});
