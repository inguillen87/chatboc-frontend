import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ClerkAuthButtons from './ClerkAuthButtons';
import { ClerkRuntimeProvider, type ClerkRuntimeValue } from './ClerkRuntimeContext';

vi.mock('@clerk/clerk-react', () => ({
  SignedOut: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignedIn: () => null,
  SignInButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignUpButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  UserButton: () => <span data-testid="clerk-user-button" />,
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
  it('uses the social providers exposed by the Clerk runtime contract', () => {
    renderWithRuntime();

    expect(screen.getByRole('button', { name: /crear cuenta segura/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /google, facebook, linkedin o email/i })).toBeInTheDocument();
  });

  it('stays hidden when Clerk runtime is disabled', () => {
    renderWithRuntime({ enabled: false, publishableKey: '', source: 'disabled', socialProviders: [] });

    expect(screen.queryByRole('button', { name: /crear cuenta segura/i })).not.toBeInTheDocument();
  });
});
