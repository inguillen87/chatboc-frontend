import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import UserClaimsPage from './UserClaimsPage';
import { TenantProvider } from '@/context/TenantContext';
import { vi } from 'vitest';

// Mock dependencies
vi.mock('@/hooks/useUser', () => ({
  useUser: () => ({ user: null, isLoading: false }),
}));

// Mock API Client to return empty list so component uses fallback
vi.mock('@/api/client', () => ({
  apiClient: {
    listTickets: vi.fn().mockResolvedValue([]), // Return empty
  }
}));

describe('UserClaimsPage', () => {
  it('renders claims page and empty state', async () => {
    render(
      <BrowserRouter>
        <TenantProvider>
          <UserClaimsPage />
        </TenantProvider>
      </BrowserRouter>
    );

    await waitFor(() => {
        expect(screen.getByText(/Mis Reclamos y Solicitudes/i)).toBeInTheDocument();
        expect(screen.getByText(/No tenés reclamos registrados aún/i)).toBeInTheDocument();
    });
  });
});
