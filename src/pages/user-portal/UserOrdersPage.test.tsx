import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import UserOrdersPage from './UserOrdersPage';
import { TenantProvider } from '@/context/TenantContext';
import { vi } from 'vitest';

// Mock dependencies
vi.mock('@/hooks/useUser', () => ({
  useUser: () => ({ user: null, isLoading: false }),
}));

vi.mock('@/utils/safeLocalStorage', () => ({
  safeLocalStorage: {
    getItem: vi.fn((key) => {
      if (key === 'chatboc_demo_orders') {
        return JSON.stringify([
          {
            createdAt: new Date().toISOString(),
            payload: {
              cliente: { nombre: 'Test', email: 'test@test.com' },
              items: [
                { nombre_producto: 'Producto Demo', cantidad: 2, precio_unitario: 100, modalidad: 'venta' }
              ],
              totales: { dinero: 200, puntos: 0 },
              estado: 'pendiente_confirmacion'
            }
          }
        ]);
      }
      return null;
    }),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock('@/utils/demoLoyalty', () => ({
  getDemoLoyaltySummary: () => ({
    points: 11697,
    surveysCompleted: 7,
    suggestionsShared: 8,
    claimsFiled: 4,
    lastUpdated: Date.now(),
  }),
}));

describe('UserOrdersPage', () => {
  it('renders demo orders from local storage', () => {
    render(
      <BrowserRouter>
        <TenantProvider>
          <UserOrdersPage />
        </TenantProvider>
      </BrowserRouter>
    );

    // Case insensitive match
    expect(screen.getByText(/Mis pedidos y actividad/i)).toBeInTheDocument();
    // Use regex to match potentially different formatting or partial match
    expect(screen.getByText(/11,697 pts|11\.697 pts/)).toBeInTheDocument(); // Demo points
    // Case insensitive match
    expect(screen.getByText(/Producto Demo/i)).toBeInTheDocument();
    // Use regex to find text that contains 'x' followed by optional space and '2'
    expect(screen.getByText(/x\s*2/i)).toBeInTheDocument();
  });
});
