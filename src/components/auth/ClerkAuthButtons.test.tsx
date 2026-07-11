import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import ClerkAuthButtons from './ClerkAuthButtons';
import { ClerkRuntimeProvider, type ClerkRuntimeValue } from './ClerkRuntimeContext';

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
    clerkMocks.signedIn = false;
    clerkMocks.logoutChatbocSession.mockReset().mockResolvedValue(undefined);
    clerkMocks.signInAuthenticateWithRedirect.mockReset();
    clerkMocks.signUpAuthenticateWithRedirect.mockReset();
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
    renderWithRuntime();

    fireEvent.click(screen.getByRole('button', { name: /crear con google/i }));

    await waitFor(() => {
      expect(clerkMocks.signUpAuthenticateWithRedirect).toHaveBeenCalledWith({
        strategy: 'oauth_google',
        redirectUrl: 'http://localhost:3000/sso-callback',
        redirectUrlComplete: 'http://localhost:3000/',
      });
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

  it('uses the coordinated backend and Clerk logout instead of Clerk UserButton', async () => {
    clerkMocks.signedIn = true;
    renderWithRuntime();

    fireEvent.click(screen.getByRole('button', { name: /cerrar sesion/i }));

    await waitFor(() => {
      expect(clerkMocks.logoutChatbocSession).toHaveBeenCalledTimes(1);
    });
  });
});
