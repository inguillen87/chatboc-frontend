import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const socketHarness = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const socket = {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.set(event, handler);
      return socket;
    }),
    emit: vi.fn(),
    close: vi.fn(),
    disconnect: vi.fn(),
  };

  return {
    handlers,
    socket,
    io: vi.fn(() => socket),
  };
});

const userHarness = vi.hoisted(() => ({
  user: { tenantSlug: 'junin', rol: 'admin' },
}));

vi.mock('socket.io-client', () => ({
  io: socketHarness.io,
}));

vi.mock('@/config', () => ({
  getSocketUrl: () => 'wss://api.chatboc.test',
  SOCKET_PATH: '/api/socket.io',
}));

vi.mock('@/hooks/useUser', () => ({
  useUser: () => userHarness,
}));

vi.mock('@/utils/api', () => ({
  resolveTenantSlug: (value?: string) => value || 'junin',
}));

vi.mock('@/utils/socketPolicy', () => ({
  isGlobalSocketExplicitlyEnabled: () => true,
}));

import { SocketProvider } from './SocketContext';

describe('SocketProvider Clerk cookie transport', () => {
  beforeEach(() => {
    window.localStorage.clear();
    socketHarness.handlers.clear();
    socketHarness.io.mockClear();
    socketHarness.socket.emit.mockClear();
    socketHarness.socket.close.mockClear();
    socketHarness.socket.disconnect.mockClear();
  });

  it('connects and subscribes without exposing a bearer token when Clerk uses HttpOnly cookies', async () => {
    window.localStorage.setItem('authProvider', 'clerk');
    window.localStorage.setItem('clerkUserId', 'user_cookie_session');
    window.localStorage.setItem('clerkSessionTransport', 'cookie');

    render(
      <MemoryRouter initialEntries={['/perfil?tab=tickets']}>
        <SocketProvider>
          <div>CRM</div>
        </SocketProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(socketHarness.io).toHaveBeenCalledOnce());
    const options = socketHarness.io.mock.calls[0]?.[1];
    expect(options).toMatchObject({
      auth: { tenant_slug: 'junin' },
      withCredentials: true,
      path: '/api/socket.io',
      transports: ['websocket'],
    });
    expect(socketHarness.io.mock.calls[0]?.[0]).toBe(window.location.origin.replace(/^http/i, 'ws'));
    expect(options?.auth).not.toHaveProperty('token');

    act(() => {
      socketHarness.handlers.get('connect')?.();
    });

    expect(socketHarness.socket.emit).toHaveBeenCalledWith('subscribe_ticket_updates', {
      tenant_slug: 'junin',
    });
  });

  it('keeps a residual widget bearer out of the Clerk panel connection', async () => {
    window.localStorage.setItem('authProvider', 'clerk');
    window.localStorage.setItem('clerkUserId', 'user_cookie_session');
    window.localStorage.setItem('clerkSessionTransport', 'cookie');
    window.localStorage.setItem('chatAuthToken', 'residual-widget-credential');
    render(<MemoryRouter initialEntries={['/perfil']}><SocketProvider><div>CRM</div></SocketProvider></MemoryRouter>);
    await waitFor(() => expect(socketHarness.io).toHaveBeenCalledOnce());
    expect(socketHarness.io.mock.calls[0]?.[1]?.auth).toEqual({tenant_slug:'junin'});
    act(() => socketHarness.handlers.get('connect')?.());
    expect(socketHarness.socket.emit).toHaveBeenCalledWith('subscribe_ticket_updates', {tenant_slug:'junin'});
  });

  it('does not establish a panel connection with only a widget bearer', async () => {
    window.localStorage.setItem('chatAuthToken', 'widget-credential');
    render(<MemoryRouter initialEntries={['/perfil']}><SocketProvider><div>CRM</div></SocketProvider></MemoryRouter>);
    await act(async () => { await Promise.resolve(); });
    expect(socketHarness.io).not.toHaveBeenCalled();
  });

  it.each(['/t/tierra-del-fuego','/t/junin/knowledge','/iframe'])('keeps public page %s out of the panel socket', async (path) => {
    window.localStorage.setItem('authProvider', 'clerk');
    window.localStorage.setItem('clerkUserId', 'user_cookie_session');
    window.localStorage.setItem('clerkSessionTransport', 'cookie');
    render(<MemoryRouter initialEntries={[path]}><SocketProvider><div>Público</div></SocketProvider></MemoryRouter>);
    await act(async () => { await Promise.resolve(); });
    expect(socketHarness.io).not.toHaveBeenCalled();
  });

  it.each(['/t/junin/perfil','/t/junin/dashboard','/t/junin/tickets'])('preserves the authenticated panel alias %s', async (path) => {
    window.localStorage.setItem('authProvider', 'clerk');
    window.localStorage.setItem('clerkUserId', 'user_cookie_session');
    window.localStorage.setItem('clerkSessionTransport', 'cookie');
    render(<MemoryRouter initialEntries={[path]}><SocketProvider><div>CRM</div></SocketProvider></MemoryRouter>);
    await waitFor(() => expect(socketHarness.io).toHaveBeenCalledOnce());
    expect(socketHarness.io.mock.calls[0]?.[1]?.auth).toEqual({tenant_slug:'junin'});
  });

  it('keeps the access-denied route passive even with a stale Clerk marker', async () => {
    window.localStorage.setItem('authProvider', 'clerk');
    window.localStorage.setItem('clerkUserId', 'stale_cookie_session');

    render(
      <MemoryRouter initialEntries={['/403']}>
        <SocketProvider>
          <div>Acceso denegado</div>
        </SocketProvider>
      </MemoryRouter>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(socketHarness.io).not.toHaveBeenCalled();
    expect(socketHarness.socket.emit).not.toHaveBeenCalled();
  });
});
