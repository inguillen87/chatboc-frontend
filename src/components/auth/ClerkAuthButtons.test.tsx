import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import ClerkAuthButtons from './ClerkAuthButtons';
import { ClerkRuntimeProvider, type ClerkRuntimeValue } from './ClerkRuntimeContext';
import { readClerkAuthContext } from '@/utils/clerkAuthContext';
import { safeSessionStorage } from '@/utils/safeLocalStorage';
import {registerActiveClerkIdentity,retireLocalSessionAuthority} from '@/utils/sessionRetirement';
import {advanceChatbocSessionRevision} from '@/utils/chatbocSessionRevision';

const clerkMocks = vi.hoisted(() => ({
  signedIn: false,
  session: null as { id: string } | null,
  signOut: vi.fn(),
  logoutChatbocSession: vi.fn(),
  signInAuthenticateWithRedirect: vi.fn(),
  signUpAuthenticateWithRedirect: vi.fn(),
}));

vi.mock('@clerk/clerk-react', () => ({
  SignedOut: ({ children }: { children: React.ReactNode }) => clerkMocks.signedIn ? null : <>{children}</>,
  SignedIn: ({ children }: { children: React.ReactNode }) => clerkMocks.signedIn ? <>{children}</> : null,
  SignInButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignUpButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSignIn: () => ({
    isLoaded: true,
    signIn: {
      authenticateWithRedirect: clerkMocks.signInAuthenticateWithRedirect,
    },
  }),
  useSignUp: () => ({
    isLoaded: true,
    signUp: {
      authenticateWithRedirect: clerkMocks.signUpAuthenticateWithRedirect,
    },
  }),
  useClerk: () => ({
    get session() { return clerkMocks.session; },
    signOut: clerkMocks.signOut,
    client: {
      signIn: { authenticateWithRedirect: clerkMocks.signInAuthenticateWithRedirect },
      signUp: { authenticateWithRedirect: clerkMocks.signUpAuthenticateWithRedirect },
    },
  }),
}));

vi.mock('@/utils/sessionLogout', () => ({
  logoutChatbocSession: clerkMocks.logoutChatbocSession,
}));

const renderWithRuntime = (
  runtime: Partial<ClerkRuntimeValue> = {},
  props: Partial<React.ComponentProps<typeof ClerkAuthButtons>> = {},
) =>
  render(
    <MemoryRouter>
      <ClerkRuntimeProvider
        value={{
          enabled: true,
          loading: false,
          publishableKey: 'pk_test_local',
          source: 'backend',
          socialProviders: ['linkedin', 'google', 'facebook'],
          ...runtime,
        }}
      >
        <ClerkAuthButtons mode="register" {...props} />
      </ClerkRuntimeProvider>
    </MemoryRouter>,
  );

describe('ClerkAuthButtons', () => {
  beforeEach(() => {
    safeSessionStorage.clear();
    registerActiveClerkIdentity('',null);
    clerkMocks.signedIn = false;
    clerkMocks.session = null;
    clerkMocks.signOut.mockReset().mockImplementation(async () => {
      clerkMocks.session = null;
      clerkMocks.signedIn = false;
    });
    clerkMocks.logoutChatbocSession.mockReset().mockResolvedValue(undefined);
    clerkMocks.signInAuthenticateWithRedirect.mockReset();
    clerkMocks.signUpAuthenticateWithRedirect.mockReset();
  });

  it('offers normal sign-in when the SDK still reports the locally retired session',()=>{
    clerkMocks.signedIn=true;registerActiveClerkIdentity('synthetic-a','synthetic-sid-a');
    retireLocalSessionAuthority(null,'synthetic-a',true);advanceChatbocSessionRevision();
    renderWithRuntime({}, {mode:'login'});
    expect(screen.getByRole('button',{name:'Ingresar con email'})).toBeInTheDocument();
    expect(screen.queryByText('Cuenta conectada')).not.toBeInTheDocument();
  });

  it('uses the social providers exposed by the Clerk runtime contract', () => {
    renderWithRuntime();

    expect(screen.getByRole('button', { name: /crear con google/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crear con facebook/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crear con linkedin/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crear con email/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ya tengo cuenta/i })).toBeInTheDocument();
  });

  const retiredSdk = () => {
    clerkMocks.signedIn = true;
    clerkMocks.session = { id: 'synthetic-sid-a' };
    registerActiveClerkIdentity('synthetic-a', 'synthetic-sid-a');
    retireLocalSessionAuthority(null, 'synthetic-a', true);
    advanceChatbocSessionRevision();
  };

  it('closes only the retired SDK session before starting fresh Google sign-in', async () => {
    retiredSdk();
    renderWithRuntime({}, { mode: 'login' });
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar con Google' }));
    await waitFor(() => expect(clerkMocks.signInAuthenticateWithRedirect).toHaveBeenCalledTimes(1));
    expect(clerkMocks.signOut).toHaveBeenCalledExactlyOnceWith(expect.any(Function), { sessionId: 'synthetic-sid-a' });
    expect(clerkMocks.signOut.mock.invocationCallOrder[0]).toBeLessThan(clerkMocks.signInAuthenticateWithRedirect.mock.invocationCallOrder[0]);
  });

  it('does not start OAuth or restore authority when SDK signout fails', async () => {
    retiredSdk();
    clerkMocks.signOut.mockRejectedValue(new Error('synthetic_failure'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderWithRuntime({}, { mode: 'login' });
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar con Google' }));
    await screen.findByText('No se pudo abrir Google. Probá con email o intentá nuevamente.');
    expect(clerkMocks.signInAuthenticateWithRedirect).not.toHaveBeenCalled();
    expect(readClerkAuthContext()).toBeNull();
    log.mockRestore();
  });

  it('refuses a mismatched SDK snapshot before any signout request', async () => {
    retiredSdk();
    clerkMocks.session = { id: 'synthetic-sid-b' };
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderWithRuntime({}, { mode: 'login' });
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar con Google' }));
    await screen.findByText('No se pudo abrir Google. Probá con email o intentá nuevamente.');
    expect(clerkMocks.signOut).not.toHaveBeenCalled();
    expect(clerkMocks.signInAuthenticateWithRedirect).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it('never signs out a replacement SDK session or starts OAuth from its identity', async () => {
    retiredSdk();
    let finish!: () => void;
    clerkMocks.signOut.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderWithRuntime({}, { mode: 'login' });
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar con Google' }));
    clerkMocks.session = { id: 'synthetic-sid-b' };
    finish();
    await screen.findByText('No se pudo abrir Google. Probá con email o intentá nuevamente.');
    expect(clerkMocks.signOut).toHaveBeenCalledExactlyOnceWith(expect.any(Function), { sessionId: 'synthetic-sid-a' });
    expect(clerkMocks.session.id).toBe('synthetic-sid-b');
    expect(clerkMocks.signInAuthenticateWithRedirect).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it('abandons a pending OAuth intention after another Chatboc session transition', async () => {
    retiredSdk();
    let finish!: () => void;
    clerkMocks.signOut.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
    renderWithRuntime({}, { mode: 'login' });
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar con Google' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar con Google' }));
    await act(async () => {
      advanceChatbocSessionRevision();
      clerkMocks.session = null;
      finish();
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Ingresar con Google' })).toBeEnabled());
    expect(clerkMocks.signOut).toHaveBeenCalledTimes(1);
    expect(clerkMocks.signInAuthenticateWithRedirect).not.toHaveBeenCalled();
    expect(readClerkAuthContext()).toBeNull();
  });

  it('starts the direct Google OAuth redirect for sign up', async () => {
    renderWithRuntime({}, {
      authIntent: 'tenant_portal',
      tenantSlug: 'junin',
      returnTo: '/t/junin/portal/dashboard',
    });

    fireEvent.click(screen.getByRole('button', { name: /crear con google/i }));

    await waitFor(() => {
      expect(clerkMocks.signUpAuthenticateWithRedirect).toHaveBeenCalledWith({
        strategy: 'oauth_google',
        redirectUrl: 'http://localhost:3000/sso-callback',
        redirectUrlComplete: 'http://localhost:3000/',
      });
    });
    expect(readClerkAuthContext()).toMatchObject({
      intent: 'tenant_portal',
      tenantSlug: 'junin',
      returnTo: '/t/junin/portal/dashboard',
    });
  });

  it('stays hidden when Clerk runtime is disabled', () => {
    renderWithRuntime({ enabled: false, publishableKey: '', source: 'disabled', socialProviders: [] });

    expect(screen.queryByRole('button', { name: /crear con google/i })).not.toBeInTheDocument();
  });

  it('blocks social and email registration until consent is available', () => {
    renderWithRuntime({}, { disabled: true });

    expect(screen.getByRole('button', { name: /crear con google/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /crear con email/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /ya tengo cuenta/i })).toBeDisabled();
  });

  it('retires locally and navigates immediately while remote retirement stays pending', async () => {
    clerkMocks.signedIn = true;
    let resolve!:(value:unknown)=>void;clerkMocks.logoutChatbocSession.mockReturnValue(new Promise(r=>{resolve=r;}));
    const navigation=vi.spyOn(console,'log').mockImplementation(()=>{});
    renderWithRuntime();

    fireEvent.click(screen.getByRole('button', { name: /cerrar sesion/i }));

    await waitFor(() => {
      expect(clerkMocks.logoutChatbocSession).toHaveBeenCalledTimes(1);
    });
    expect(navigation).toHaveBeenCalledWith('Mocked navigate to: /login');
    resolve({status:'uncertain'});await Promise.resolve();
    expect(navigation.mock.calls.filter(call=>call[0]==='Mocked navigate to: /login')).toHaveLength(1);navigation.mockRestore();
  });
});
