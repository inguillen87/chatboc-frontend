import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.fn();

vi.mock('@/utils/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status = 500) {
      super(message);
      this.status = status;
    }
  },
  NetworkError: class NetworkError extends Error {},
}));

import { addMarketItem, fetchMarketCart } from '@/api/market';

describe('market api continuity normalization', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('normalizes continuity.portal_links and conversation_id from cart payload', async () => {
    apiFetchMock.mockResolvedValueOnce({
      items: [],
      totalAmount: 0,
      totalPoints: 0,
      continuity: {
        conversation_id: 'wa_conv_123',
        portal_links: {
          home: '/junin/portal',
          orders: '/junin/portal/pedidos',
          profile: '/junin/portal/perfil',
        },
      },
    });

    const cart = await fetchMarketCart('junin');

    expect(cart.continuity?.conversation_id).toBe('wa_conv_123');
    expect(cart.continuity?.portal_links?.orders).toBe('/junin/portal/pedidos');
  });

  it('normalizes continuity fields on add item responses too', async () => {
    apiFetchMock.mockResolvedValueOnce({
      items: [{ id: '1', name: 'A', quantity: 1 }],
      totalAmount: 100,
      totalPoints: 0,
      continuity: {
        summary: 'retomar en portal',
        portal_links: {
          home: '/tenant/portal',
        },
      },
    });

    const cart = await addMarketItem('tenant', { productId: '1', quantity: 1 });

    expect(cart.continuity?.summary).toBe('retomar en portal');
    expect(cart.continuity?.portal_links?.home).toBe('/tenant/portal');
  });
});
