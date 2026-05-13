import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UserOrdersPage from './UserOrdersPage';
import { TenantProvider } from '@/context/TenantContext';
import { vi } from 'vitest';

// Test dependencies
vi.mock('@/hooks/useUser', () => ({
  useUser: () => ({ user: null, isLoading: false }),
}));

// API client returns an empty real response so the page renders the empty state.
vi.mock('@/api/client', () => ({
  apiClient: {
    listOrders: vi.fn().mockResolvedValue([]),
  }
}));

describe('UserOrdersPage', () => {
  it('renders orders page and empty state', async () => {
    render(
      <MemoryRouter initialEntries={['/t/demo/pedidos']}>
        <TenantProvider>
          <UserOrdersPage />
        </TenantProvider>
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
});
