import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UserOrdersPage from './UserOrdersPage';
import { TenantProvider } from '@/context/TenantContext';
import { vi } from 'vitest';

// Mock dependencies
vi.mock('@/hooks/useUser', () => ({
  useUser: () => ({ user: null, isLoading: false }),
}));

// Mock API Client to return empty list so component uses fallback
vi.mock('@/api/client', () => ({
  apiClient: {
    listOrders: vi.fn().mockResolvedValue([]), // Return empty to trigger fallback
  }
}));

describe('UserOrdersPage', () => {
  it('renders orders page and fallback data', async () => {
    render(
      <MemoryRouter initialEntries={['/t/demo/pedidos']}>
        <TenantProvider>
          <UserOrdersPage />
        </TenantProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
        expect(screen.getByText(/Mis Pedidos/i)).toBeInTheDocument();
    });

    // Check empty-state content when backend has no orders
    await waitFor(() => {
        expect(screen.getByText(/No tenés pedidos registrados aún\./i)).toBeInTheDocument();
    });
  });
});
