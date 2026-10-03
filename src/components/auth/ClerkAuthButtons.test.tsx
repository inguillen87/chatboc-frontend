import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
