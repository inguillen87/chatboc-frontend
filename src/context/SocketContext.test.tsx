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
    });
    expect(options?.auth).not.toHaveProperty('token');

    act(() => {
      socketHarness.handlers.get('connect')?.();
    });

    expect(socketHarness.socket.emit).toHaveBeenCalledWith('subscribe_ticket_updates', {
      tenant_slug: 'junin',
    });
  });
});
