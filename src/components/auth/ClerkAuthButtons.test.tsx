import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ClerkAuthButtons from './ClerkAuthButtons';
import { ClerkRuntimeProvider, type ClerkRuntimeValue } from './ClerkRuntimeContext';

const clerkMocks = vi.hoisted(() => ({
  signInAuthenticateWithRedirect: vi.fn(),
  signUpAuthenticateWithRedirect: vi.fn(),
}));

vi.mock('@clerk/clerk-react', () => ({
  SignedOut: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignedIn: () => null,
  SignInButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignUpButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  UserButton: () => <span data-testid="clerk-user-button" />,
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

const renderWithRuntime = (runtime: Partial<ClerkRuntimeValue> = {}) =>
  render(
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
      <ClerkAuthButtons mode="register" />
    </ClerkRuntimeProvider>,
  );

describe('ClerkAuthButtons', () => {
  beforeEach(() => {
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
});
