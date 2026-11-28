import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));
const market = vi.hoisted(() => ({ fetchMarketCart: vi.fn() }));
vi.mock('@/api/market', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/api/market');
  return {
    ...actual,
    fetchMarketCart: market.fetchMarketCart,
    fetchMarketCatalog: vi.fn().mockResolvedValue({ products: [], tenantName: 'Tienda' }),
    fetchRewardsProfile: vi.fn().mockRejectedValue(new Error('none')),
  };
});
vi.mock('@/hooks/useUser', () => ({ useUser: () => ({ user: null }) }));

import MarketCartPage from './MarketCartPage';
import { notifyMarketCartChanged } from '@/utils/marketStorage';
import { captureChatbocSessionRevision } from '@/utils/chatbocSessionRevision';

const cart = (count: number) => ({
  items: Array.from({ length: count }, (_, i) => ({ id: String(i + 1), name: `Producto ${i + 1}`, quantity: 1, price: 100 })),
});

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: 0, staleTime: 30_000 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/t/tienda/cart']}>
        <Routes><Route path="/t/:tenant/cart" element={<MarketCartPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => market.fetchMarketCart.mockReset());

describe('MarketCartPage stays in step with the buyer cart', () => {
  it('re-reads the cart when another surface changes it', async () => {
    market.fetchMarketCart.mockResolvedValueOnce(cart(0)).mockResolvedValue(cart(1));
    mount();
    expect(await screen.findByRole('heading', { name: 'Tu carrito' })).toBeTruthy();
    act(() => notifyMarketCartChanged('tienda', captureChatbocSessionRevision()));
    expect(await screen.findByRole('heading', { name: 'Tu carrito tiene 1 producto' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Finalizar pedido/ }).length).toBeGreaterThan(0);
  });

  it('settles a first read that raced the buyer identity', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      market.fetchMarketCart.mockResolvedValueOnce(cart(0)).mockResolvedValue(cart(2));
      mount();
      await screen.findByRole('heading', { name: 'Tu carrito' });
      await act(async () => { vi.advanceTimersByTime(1600); });
      await waitFor(() => expect(screen.getByRole('heading', { name: 'Tu carrito tiene 2 productos' })).toBeTruthy());
    } finally {
      vi.useRealTimers();
    }
  });
});
