import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ClerkRuntimeProvider,
  DEFAULT_CLERK_RUNTIME,
} from '@/components/auth/ClerkRuntimeContext';
import ClerkSsoCallbackPage from './ClerkSsoCallbackPage';

const callbackSpy = vi.fn(() => <div data-testid="clerk-callback" />);

vi.mock('@clerk/clerk-react', () => ({
  AuthenticateWithRedirectCallback: () => callbackSpy(),
}));

describe('ClerkSsoCallbackPage', () => {
  beforeEach(() => callbackSpy.mockClear());

  it('waits for the backend runtime before mounting the Clerk callback', () => {
    render(
      <ClerkRuntimeProvider
        value={{
          ...DEFAULT_CLERK_RUNTIME,
          enabled: false,
          loading: true,
          publishableKey: 'pk_live_public',
        }}
      >
        <ClerkSsoCallbackPage />
      </ClerkRuntimeProvider>,
    );

    expect(screen.getByText(/Conectando tu cuenta social/i)).toBeInTheDocument();
    expect(screen.queryByTestId('clerk-callback')).not.toBeInTheDocument();
  });

  it('mounts the redirect callback only after Clerk is enabled', () => {
    render(
      <ClerkRuntimeProvider
        value={{
          ...DEFAULT_CLERK_RUNTIME,
          enabled: true,
          loading: false,
          publishableKey: 'pk_live_public',
        }}
      >
        <ClerkSsoCallbackPage />
      </ClerkRuntimeProvider>,
    );

    expect(screen.getByTestId('clerk-callback')).toBeInTheDocument();
    expect(callbackSpy).toHaveBeenCalledOnce();
  });

  it('fails closed with an actionable message when runtime validation fails', () => {
    render(
      <ClerkRuntimeProvider
        value={{
          ...DEFAULT_CLERK_RUNTIME,
          enabled: false,
          loading: false,
          publishableKey: 'pk_live_public',
        }}
      >
        <ClerkSsoCallbackPage />
      </ClerkRuntimeProvider>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/No pudimos validar/i);
    expect(screen.queryByTestId('clerk-callback')).not.toBeInTheDocument();
  });
});
