import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const transport = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/utils/api', async (original) => ({ ...(await original<typeof import('@/utils/api')>()), apiFetch: (...args: unknown[]) => transport.fetch(...args) }));
import { ApiError } from '@/utils/api';
import Restablecer, { readResetToken } from './Restablecer';

const TOKEN = 'selector-sintetico.verificador-sintetico';
const show = (hash = `#token=${TOKEN}`) =>
  render(<MemoryRouter initialEntries={[`/restablecer${hash}`]}><Restablecer /></MemoryRouter>);

beforeEach(() => transport.fetch.mockReset());
afterEach(cleanup);

describe('choose a new password page', () => {
  it('reads the token only from a well-formed fragment', () => {
    expect(readResetToken(`#token=${TOKEN}`)).toBe(TOKEN);
    expect(readResetToken('#token=sinpunto')).toBeNull();
    expect(readResetToken('')).toBeNull();
  });

  it('says the link is not valid when there is no token and offers no form', () => {
    show('');
    expect(screen.getByRole('alert')).toHaveTextContent('Este enlace no es válido');
    expect(screen.queryByLabelText('Contraseña nueva')).not.toBeInTheDocument();
  });

  it('explains what is wrong before sending anything', async () => {
    const user = userEvent.setup(); show();
    await user.type(screen.getByLabelText('Contraseña nueva'), 'corta1');
    await user.type(screen.getByLabelText('Repetila'), 'corta1');
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(screen.getByRole('alert')).toHaveTextContent('al menos 8 caracteres');
    await user.clear(screen.getByLabelText('Contraseña nueva')); await user.type(screen.getByLabelText('Contraseña nueva'), 'ClaveSintetica1');
    await user.clear(screen.getByLabelText('Repetila')); await user.type(screen.getByLabelText('Repetila'), 'ClaveSintetica2');
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(screen.getByRole('alert')).toHaveTextContent('no coinciden');
    expect(transport.fetch).not.toHaveBeenCalled();
  });

  it('sends the token once, without any session, and confirms', async () => {
    const user = userEvent.setup(); transport.fetch.mockResolvedValueOnce({ mensaje: 'ok' }); show();
    await user.type(screen.getByLabelText('Contraseña nueva'), 'ClaveSintetica1');
    await user.type(screen.getByLabelText('Repetila'), 'ClaveSintetica1');
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(await screen.findByText('Listo. Tu contraseña quedó guardada.')).toBeInTheDocument();
    const [path, options] = transport.fetch.mock.calls[0];
    expect(path).toBe('/auth/password/reset/confirm');
    expect(options).toMatchObject({ method: 'POST', skipAuth: true, omitCredentials: true, omitEntityToken: true,
      body: { token: TOKEN, new_password: 'ClaveSintetica1', confirm_password: 'ClaveSintetica1' } });
    expect(screen.getByRole('link', { name: 'Ir a iniciar sesión' })).toHaveAttribute('href', '/login');
  });

  it('tells the person to ask for a new link when it was used or expired', async () => {
    const user = userEvent.setup(); transport.fetch.mockRejectedValueOnce(Object.assign(Object.create(ApiError.prototype), { status: 400 })); show();
    await user.type(screen.getByLabelText('Contraseña nueva'), 'ClaveSintetica1');
    await user.type(screen.getByLabelText('Repetila'), 'ClaveSintetica1');
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('ya se usó o venció');
  });
});
