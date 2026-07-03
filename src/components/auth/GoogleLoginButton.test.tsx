import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import GoogleLoginButton from './GoogleLoginButton';
import { ClerkRuntimeProvider, type ClerkRuntimeValue } from './ClerkRuntimeContext';

vi.mock('@react-oauth/google', () => ({
  GoogleLogin: () => <button type="button">Continue with Google</button>,
}));

vi.mock('@/env', () => ({
  CLERK_PUBLISHABLE_KEY: '',
  GOOGLE_CLIENT_ID: 'google-client-test',
}));

vi.mock('@/hooks/useUser', () => ({
  useUser: () => ({ refreshUser: vi.fn() }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

const renderWithRuntime = (runtime: Partial<ClerkRuntimeValue>) =>
  render(
    <ClerkRuntimeProvider
      value={{
        enabled: false,
        loading: false,
        publishableKey: '',
        source: 'disabled',
        socialProviders: [],
        ...runtime,
      }}
    >
      <GoogleLoginButton />
    </ClerkRuntimeProvider>,
  );

describe('GoogleLoginButton', () => {
  it('hides the legacy Google button when Clerk is enabled', () => {
    renderWithRuntime({
      enabled: true,
      publishableKey: 'pk_test_local',
      source: 'backend',
      socialProviders: ['google', 'facebook', 'linkedin'],
    });

    expect(screen.queryByRole('button', { name: 'Continue with Google' })).not.toBeInTheDocument();
  });

  it('keeps the legacy Google fallback when Clerk is disabled', () => {
    renderWithRuntime({ enabled: false });

    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
  });
});
