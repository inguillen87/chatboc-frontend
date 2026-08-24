import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UserOrdersPage from './UserOrdersPage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ordersMocks = vi.hoisted(() => ({
  user: null as null | { id: string; name?: string; email?: string },
  publicOrders: [] as any[],
  listOrders: vi.fn(),
  authority: {
    clerkStatus: 'signed_out' as 'disabled' | 'loading' | 'signed_out' | 'syncing' | 'ready',
    hasBearerSession: false,
    hasVerifiedSession: false,
  },
}));

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
};

// Test dependencies
vi.mock('@/hooks/useUser', () => ({
  useUser: () => ({ user: ordersMocks.user, isLoading: false }),
}));

vi.mock('@/components/access/SessionAuthorityContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/access/SessionAuthorityContext')>()),
  useSessionAuthority: () => ordersMocks.authority,
}));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({ currentSlug: 'junin' }),
}));

vi.mock('@/hooks/usePortalContent', () => ({
  usePortalContent: () => ({
    content: { catalog: [] },
    commerceSession: null,
    publicOrders: ordersMocks.publicOrders,
    isLoading: false,
  }),
}));

// API client returns an empty real response so the page renders the empty state.
vi.mock('@/api/client', () => ({
  apiClient: {
    listOrders: ordersMocks.listOrders,
  }
}));

describe('UserOrdersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ordersMocks.user = null;
    ordersMocks.publicOrders = [];
    ordersMocks.listOrders.mockResolvedValue([]);
    ordersMocks.authority = {
      clerkStatus: 'signed_out',
      hasBearerSession: false,
      hasVerifiedSession: false,
    };
  });

  it('renders orders page and empty state', async () => {
    render(
      <MemoryRouter initialEntries={['/t/demo/pedidos']}>
        <UserOrdersPage />
      </MemoryRouter>
    );

    await waitFor(() => {
        expect(screen.getByText(/Mis pedidos/i)).toBeInTheDocument();
    });

    // Check empty-state content when the account has no orders.
    await waitFor(() => {
        expect(screen.getByText(/No tenés pedidos registrados aún\./i)).toBeInTheDocument();
    });
  });

  it.each(['loading', 'signed_out'] as const)(
    'does not call listOrders for a stale user while Clerk is %s',
    async (clerkStatus) => {
      ordersMocks.user = {
        id: 'stale-user',
        name: 'Persona Stale Privada',
        email: 'stale-orders@example.test',
      };
      ordersMocks.authority = {
        clerkStatus,
        hasBearerSession: clerkStatus === 'loading',
        hasVerifiedSession: false,
      };

      render(
        <MemoryRouter initialEntries={['/t/junin/portal/pedidos']}>
          <UserOrdersPage />
        </MemoryRouter>,
      );

      await waitFor(() => expect(screen.getByText(/No tenés pedidos registrados aún/i)).toBeInTheDocument());
      expect(ordersMocks.listOrders).not.toHaveBeenCalled();
      expect(screen.queryByText(/Persona Stale Privada|stale-orders@example\.test/)).not.toBeInTheDocument();
    },
  );

  it.each([
    {
      label: 'Clerk ready cookie-only',
      authority: { clerkStatus: 'ready' as const, hasBearerSession: false, hasVerifiedSession: true },
    },
    {
      label: 'verified legacy bearer',
      authority: { clerkStatus: 'disabled' as const, hasBearerSession: true, hasVerifiedSession: true },
    },
  ])('loads private orders for $label authority', async ({ authority }) => {
    ordersMocks.user = { id: 'verified-user' };
    ordersMocks.authority = authority;

    render(
      <MemoryRouter initialEntries={['/t/junin/portal/pedidos']}>
        <UserOrdersPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(ordersMocks.listOrders).toHaveBeenCalledWith('junin'));
  });

  it('hides user A orders synchronously during A to B authority rotation', async () => {
    const userBOrders = deferred<any[]>();
    ordersMocks.user = { id: 'user-a', email: 'a@example.test' };
    ordersMocks.authority = {
      clerkStatus: 'ready',
      hasBearerSession: false,
      hasVerifiedSession: true,
    };
    ordersMocks.listOrders
      .mockResolvedValueOnce([
        {
          id: 'order-a',
          status: 'confirmed',
          total: 25,
          created_at: '2026-08-20T12:00:00Z',
          items: [{ name: 'Pedido privado A', quantity: 1, price: 25 }],
        },
      ])
      .mockImplementationOnce(() => userBOrders.promise);

    const view = render(
      <MemoryRouter initialEntries={['/t/junin/portal/pedidos']}>
        <UserOrdersPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Pedido privado A/)).toBeInTheDocument();

    ordersMocks.authority = {
      clerkStatus: 'syncing',
      hasBearerSession: false,
      hasVerifiedSession: false,
    };
    view.rerender(
      <MemoryRouter initialEntries={['/t/junin/portal/pedidos']}>
        <UserOrdersPage />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/Pedido privado A/)).not.toBeInTheDocument();

    ordersMocks.user = { id: 'user-b', email: 'b@example.test' };
    ordersMocks.authority = {
      clerkStatus: 'ready',
      hasBearerSession: false,
      hasVerifiedSession: true,
    };
    view.rerender(
      <MemoryRouter initialEntries={['/t/junin/portal/pedidos']}>
        <UserOrdersPage />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/Pedido privado A/)).not.toBeInTheDocument();

    userBOrders.resolve([]);
    await waitFor(() => expect(ordersMocks.listOrders).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/Pedido privado A/)).not.toBeInTheDocument();
  });
});
