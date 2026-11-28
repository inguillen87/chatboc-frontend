import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

const read = vi.hoisted(() => vi.fn());
vi.mock('@/api/market', async () => ({
  ...(await vi.importActual<Record<string, unknown>>('@/api/market')),
  fetchMarketCart: read,
}));

import { MarketCartProvider, useMarketCart } from './MarketCartContext';

function Probe() {
  const { items, error, isLoading } = useMarketCart();
  return <p data-testid="state">{isLoading ? 'loading' : error ? `error:${error}` : `items:${items.length}`}</p>;
}

describe('cart read cut short while the page settles', () => {
  it('retries once instead of showing a transport error', async () => {
    read.mockRejectedValueOnce(new DOMException('Request context retired', 'AbortError'))
      .mockResolvedValue({ items: [{ id: '1', name: 'Aceite', quantity: 1, price: 2900 }], totalAmount: 2900, totalPoints: 0 });
    render(<MemoryRouter initialEntries={['/t/tienda/checkout']}><MarketCartProvider tenantSlug="tienda"><Probe /></MarketCartProvider></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('items:1'), { timeout: 3000 });
    expect(read).toHaveBeenCalledTimes(2);
  });
});
