import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import GoogleLoginButton from './GoogleLoginButton';
import { ClerkRuntimeProvider, type ClerkRuntimeValue } from './ClerkRuntimeContext';

const googleMocks = vi.hoisted(() => ({
  loginWithGoogle: vi.fn(),
  refreshUser: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('@react-oauth/google', () => ({
  GoogleLogin: ({ onSuccess }: { onSuccess: (response: { credential: string }) => void }) => (
    <button type="button" onClick={() => onSuccess({ credential: 'google-id-token' })}>
      Continue with Google
    </button>
  ),
}));

vi.mock('@/env', () => ({
  CLERK_PUBLISHABLE_KEY: '',
  GOOGLE_CLIENT_ID: 'google-client-test',
}));

vi.mock('@/hooks/useUser', () => ({
  useUser: () => ({ refreshUser: googleMocks.refreshUser }),
}));

vi.mock('@/api/v2/auth', () => ({
  loginWithGoogle: googleMocks.loginWithGoogle,
}));

vi.mock('@/utils/postMessage', () => ({
  broadcastAuthTokenToHost: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => googleMocks.navigate,
  };
});

const renderWithRuntime = (
  runtime: Partial<ClerkRuntimeValue>,
  props: Partial<React.ComponentProps<typeof GoogleLoginButton>> = {},
) =>
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
      <GoogleLoginButton {...props} />
    </ClerkRuntimeProvider>,
  );

describe('GoogleLoginButton', () => {
  beforeEach(() => {
    googleMocks.loginWithGoogle.mockReset().mockResolvedValue({ token: 'legacy-google-token' });
    googleMocks.refreshUser.mockReset().mockResolvedValue(undefined);
    googleMocks.navigate.mockReset();
  });

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

  it('does not exchange the Google credential while legal consent is disabled', () => {
    renderWithRuntime({ enabled: false }, { disabled: true });

    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));

    expect(googleMocks.loginWithGoogle).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Continue with Google' }).parentElement).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('executes the legacy Google exchange after legal consent is enabled', async () => {
    renderWithRuntime({ enabled: false }, { disabled: false });

    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));

    await waitFor(() => {
      expect(googleMocks.loginWithGoogle).toHaveBeenCalledWith({ id_token: 'google-id-token' });
    });
  });
});
