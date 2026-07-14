import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/utils/api';
import ChatUserLoginPanel from './ChatUserLoginPanel';
import ChatUserRegisterPanel from './ChatUserRegisterPanel';

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  refreshUser: vi.fn(),
  broadcastAuthTokenToHost: vi.fn(),
}));

vi.mock('@/utils/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/api')>();
  return {
    ...actual,
    apiFetch: mocks.apiFetch,
    resolveTenantSlug: (explicit?: string | null) => explicit?.trim().toLowerCase() || 'junin',
  };
});

vi.mock('@/hooks/useUser', () => ({
  useUser: () => ({ refreshUser: mocks.refreshUser }),
}));

vi.mock('@/utils/postMessage', () => ({
  broadcastAuthTokenToHost: mocks.broadcastAuthTokenToHost,
}));

vi.mock('@/components/auth/GoogleLoginButton', () => ({
  default: () => <button type="button">Google anterior</button>,
}));

vi.mock('@/components/auth/ClerkAuthButtons', () => ({
  default: (props: Record<string, unknown>) => (
    <div
      data-testid={`clerk-${String(props.mode)}`}
      data-auth-intent={String(props.authIntent)}
      data-tenant-slug={String(props.tenantSlug)}
      data-return-to={String(props.returnTo)}
      data-disabled={String(Boolean(props.disabled))}
    />
  ),
}));

describe('paneles de acceso del portal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('configura Clerk como acceso de portal con tenant y destino explícitos', () => {
    render(
      <ChatUserLoginPanel
        onSuccess={vi.fn()}
        onShowRegister={vi.fn()}
        entityToken="entity-real"
        tenantSlug="Junin"
        returnTo="/t/junin/portal/dashboard"
      />,
    );

    expect(screen.getByTestId('clerk-login')).toHaveAttribute('data-auth-intent', 'tenant_portal');
    expect(screen.getByTestId('clerk-login')).toHaveAttribute('data-tenant-slug', 'junin');
    expect(screen.getByTestId('clerk-login')).toHaveAttribute(
      'data-return-to',
      '/t/junin/portal/dashboard',
    );
  });

  it('muestra un error 5xx de registro y nunca fabrica una sesión demo', async () => {
    const onSuccess = vi.fn();
    mocks.apiFetch.mockRejectedValueOnce(
      new ApiError('Servicio no disponible', 503, { error: 'Registro temporalmente no disponible' }),
    );

    render(
      <ChatUserRegisterPanel
        onSuccess={onSuccess}
        onShowLogin={vi.fn()}
        entityToken="entity-real"
        tenantSlug="junin"
        returnTo="/t/junin/portal/dashboard"
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Nombre y apellido'), {
      target: { value: 'Marcelo Prueba' },
    });
    fireEvent.change(screen.getByPlaceholderText('Correo electrónico'), {
      target: { value: 'marcelo@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Contraseña'), {
      target: { value: 'clave-segura' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Registrarme y continuar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Registro temporalmente no disponible');
    expect(onSuccess).not.toHaveBeenCalled();
    expect(mocks.refreshUser).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('authToken')).toBeNull();
    expect(window.localStorage.getItem('chatAuthToken')).toBeNull();

    const registrationOptions = mocks.apiFetch.mock.calls[0]?.[1] as {
      body?: Record<string, unknown>;
      entityToken?: string;
    };
    expect(registrationOptions.entityToken).toBe('entity-real');
    expect(registrationOptions.body?.empresa_token).toBe('entity-real');
    expect(JSON.stringify(registrationOptions)).not.toContain('demo-token');
    expect(JSON.stringify(registrationOptions)).not.toContain('demo-entity-token');
  });

  it('no inicia sesión si el backend responde sin token', async () => {
    const onSuccess = vi.fn();
    mocks.apiFetch.mockResolvedValueOnce({
      user: { id: 17, name: 'Vecina', email: 'vecina@example.com', rol: 'user' },
    });

    render(
      <ChatUserLoginPanel
        onSuccess={onSuccess}
        onShowRegister={vi.fn()}
        entityToken="entity-real"
        tenantSlug="junin"
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Correo electrónico'), {
      target: { value: 'vecina@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Contraseña'), {
      target: { value: 'clave-segura' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('El servidor no devolvió una sesión válida');
    });
    expect(onSuccess).not.toHaveBeenCalled();
    expect(mocks.refreshUser).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('authToken')).toBeNull();
    expect(mocks.broadcastAuthTokenToHost).not.toHaveBeenCalled();
  });

  it('bloquea el alta social hasta aceptar terminos y privacidad', () => {
    render(
      <ChatUserRegisterPanel
        onSuccess={vi.fn()}
        onShowLogin={vi.fn()}
        entityToken="entity-real"
        tenantSlug="junin"
      />,
    );

    expect(screen.getByTestId('clerk-register')).toHaveAttribute('data-disabled', 'true');
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByTestId('clerk-register')).toHaveAttribute('data-disabled', 'false');
  });
});
