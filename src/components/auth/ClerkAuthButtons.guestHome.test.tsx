import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import ClerkAuthButtons from './ClerkAuthButtons';
import { ClerkRuntimeProvider } from './ClerkRuntimeContext';
import {
  buildClerkBackendUnavailableRuntime,
  buildGuestPublicHomeRuntime,
  buildPublicClerkBypassRuntime,
} from './clerkRuntimeResolver';

const mount = (runtime: ReturnType<typeof buildGuestPublicHomeRuntime>, props: Parameters<typeof ClerkAuthButtons>[0]) =>
  render(
    <MemoryRouter initialEntries={['/t/institution-a']}>
      <ClerkRuntimeProvider value={runtime}>
        <ClerkAuthButtons {...props} />
      </ClerkRuntimeProvider>
    </MemoryRouter>,
  );

describe('sign-in entry on the light public home', () => {
  it('points to the organization sign-in page instead of offering nothing', () => {
    mount(buildGuestPublicHomeRuntime('pk_live_public_key'), { mode: 'login', tenantSlug: 'institution-a' });

    expect(screen.getByRole('link', { name: 'Ingresar con Google u otra cuenta' })).toHaveAttribute('href', '/t/institution-a/login');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('points to the organization registration page when creating an account', () => {
    mount(buildGuestPublicHomeRuntime('pk_live_public_key'), { mode: 'register', tenantSlug: 'institution-a' });

    expect(screen.getByRole('link', { name: 'Crear la cuenta con Google u otra cuenta' })).toHaveAttribute('href', '/t/institution-a/register');
  });

  it('offers nothing without an organization, or where sign-in is unavailable for another reason', () => {
    const { container, unmount } = mount(buildGuestPublicHomeRuntime('pk_live_public_key'), { mode: 'login', tenantSlug: null });
    expect(container).toBeEmptyDOMElement();
    unmount();

    for (const runtime of [
      buildPublicClerkBypassRuntime('pk_live_public_key'),
      buildClerkBackendUnavailableRuntime({ allowEnvFallback: false, envEnabled: true, publishableKey: 'pk_live_public_key' }),
    ]) {
      const view = mount(runtime, { mode: 'login', tenantSlug: 'institution-a' });
      expect(view.container).toBeEmptyDOMElement();
      view.unmount();
    }
  });
});
