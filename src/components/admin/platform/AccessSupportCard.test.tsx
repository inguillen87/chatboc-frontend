import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const transport = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/utils/api', () => ({ apiFetch: (...args: unknown[]) => transport.fetch(...args) }));
import { AccessSupportCard, buildAccessResetUrl } from './AccessSupportCard';

const users = [
  { id: 11, name: 'Responsable sintética', email: 'responsable@sintetica.invalid', role: 'admin', is_owner: true, sign_in_disabled: false, link_block_reason: null },
  { id: 12, name: 'Cuenta externa', email: 'externa@sintetica.invalid', role: 'admin', is_owner: false, sign_in_disabled: false, link_block_reason: 'external_sign_in' },
];
beforeEach(() => transport.fetch.mockReset());
afterEach(cleanup);

describe('access support for a locked-out person', () => {
  it('keeps the token in the fragment of the link', () => {
    expect(buildAccessResetUrl('https://panel.example.invalid/', 'a.b')).toBe('https://panel.example.invalid/restablecer#token=a.b');
  });

  it('lists the accounts and issues a one-time link only where it is allowed', async () => {
    const user = userEvent.setup();
    transport.fetch.mockResolvedValueOnce({ users });
    render(<AccessSupportCard tenantSlug="org-sintetica" />);
    const items = await screen.findAllByRole('listitem');
    expect(transport.fetch.mock.calls[0][0]).toBe('/api/admin/tenants/org-sintetica/access-support/users');
    expect(within(items[1]).queryByRole('button')).not.toBeInTheDocument();
    expect(within(items[1]).getByText('Ingresa con un proveedor externo, no con contraseña.')).toBeInTheDocument();

    transport.fetch.mockResolvedValueOnce({ token: 'sel.ver', expires_in_minutes: 60 });
    await user.click(within(items[0]).getByRole('button', { name: 'Generar enlace de acceso' }));
    const field = await screen.findByLabelText('Enlace para Responsable sintética');
    expect(field).toHaveValue(`${window.location.origin}/restablecer#token=sel.ver`);
    expect(transport.fetch.mock.calls[1]).toEqual(['/api/admin/tenants/org-sintetica/access-support/users/11/reset-link', { method: 'POST', cache: 'no-store' }]);
    expect(screen.getByText(/Sirve una sola vez y vence en 60 minutos/)).toBeInTheDocument();
  });

  it('says so when the accounts cannot be read and lets support retry', async () => {
    const user = userEvent.setup();
    transport.fetch.mockRejectedValueOnce(new Error('offline'));
    render(<AccessSupportCard tenantSlug="org-sintetica" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron consultar las cuentas');
    transport.fetch.mockResolvedValueOnce({ users: [] });
    await user.click(screen.getByRole('button', { name: 'Volver a consultar' }));
    expect(await screen.findByText('Esta organización todavía no tiene cuentas con acceso al panel.')).toBeInTheDocument();
  });
});
