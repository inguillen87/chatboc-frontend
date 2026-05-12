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

import { ApiError } from '@/utils/api';
import {
  addMarketItem,
  fetchMarketCart,
  fetchRewardsProfile,
  redeemReward,
  startMarketCheckout,
} from '@/api/market';

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

  it('preserves backend checkout readiness flags without assuming MercadoPago readiness', async () => {
    apiFetchMock.mockResolvedValueOnce({
      items: [],
      totalAmount: 0,
      totalPoints: 0,
      mercadopago_ready: false,
      checkout_options: {
        payment_required: true,
        requires_contact_or_auth: true,
        gateway_hint: 'mercadopago',
      },
      checkout_preview: {
        payment_ready: false,
        contact_ready: true,
        next_step_label: 'Confirmar pedido',
      },
    });

    const cart = await fetchMarketCart('tenant');

    expect(cart.mercadopago_ready).toBe(false);
    expect(cart.checkout_options).toMatchObject({
      payment_required: true,
      requires_contact_or_auth: true,
      gateway_hint: 'mercadopago',
    });
    expect(cart.checkout_preview).toMatchObject({
      payment_ready: false,
      contact_ready: true,
      next_step_label: 'Confirmar pedido',
    });
  });

  it('starts checkout with the payments v2 session contract first', async () => {
    apiFetchMock.mockResolvedValueOnce({
      contract_version: 'payments.checkout_session.v1',
      preference_id: 'pref_123',
      init_point: 'https://checkout.example/pref_123',
      request_id: 'req_pay_1',
    });

    const checkout = await startMarketCheckout('tenant', {
      items: [{ id: '1', quantity: 1 }],
    });

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/v2/payments/checkout-session',
      expect.objectContaining({
        method: 'POST',
        tenantSlug: 'tenant',
      }),
    );
    expect(checkout.preference_id).toBe('pref_123');
    expect(checkout.init_point).toBe('https://checkout.example/pref_123');
    expect(checkout.checkoutUrl).toBe('https://checkout.example/pref_123');
  });

  it('falls back from checkout-session to preference only when the v2 endpoint is unavailable', async () => {
    apiFetchMock
      .mockRejectedValueOnce(new ApiError('not found', 404))
      .mockResolvedValueOnce({
        contract_version: 'payments.checkout_session.v1',
        preference_id: 'pref_fallback',
        init_point: 'https://checkout.example/pref_fallback',
      });

    const checkout = await startMarketCheckout('tenant', {
      items: [{ id: '1', quantity: 1 }],
    });

    expect(apiFetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v2/payments/checkout-session',
      expect.any(Object),
    );
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v2/payments/preference',
      expect.any(Object),
    );
    expect(checkout.preference_id).toBe('pref_fallback');
  });

  it('normalizes rewards profile wallet and redemption options', async () => {
    apiFetchMock.mockResolvedValueOnce({
      contract_version: 'rewards.profile.v1',
      wallet: {
        balance: 1200,
        pending_cart_points: 90,
      },
      available_redemptions: [
        {
          reward_id: 'reward_1',
          label: 'Beneficio backend',
          cost_points: 500,
        },
      ],
    });

    const profile = await fetchRewardsProfile('tenant');

    expect(profile?.wallet?.balance).toBe(1200);
    expect(profile?.wallet?.pending_cart_points).toBe(90);
    expect(profile?.available_redemptions?.[0]).toMatchObject({
      reward_id: 'reward_1',
      label: 'Beneficio backend',
      cost_points: 500,
    });
  });

  it('sends an idempotency key when redeeming rewards', async () => {
    apiFetchMock.mockResolvedValueOnce({
      contract_version: 'rewards.redeem.v1',
      redemption_id: 'red_1',
      reward_id: 'reward_1',
      balance: 700,
      duplicate: false,
    });

    const result = await redeemReward('tenant', { reward_id: 'reward_1' }, 'idem-1');

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/v2/rewards/redeem',
      expect.objectContaining({
        method: 'POST',
        tenantSlug: 'tenant',
        headers: { 'Idempotency-Key': 'idem-1' },
      }),
    );
    expect(result.balance).toBe(700);
  });

  it('normalizes product image aliases from catalog payloads', async () => {
    apiFetchMock.mockResolvedValueOnce({
      products: [
        {
          id: 10,
          nombre: 'Malbec Reserva',
          precio: '12000',
          imagen_url: 'https://cdn.example/malbec.jpg',
          gallery_urls: ['https://cdn.example/malbec-2.jpg'],
          image_status: 'ready',
          image_alt: 'Botella Malbec Reserva',
        },
      ],
    });

    const catalog = await import('@/api/market').then((mod) => mod.fetchMarketCatalog('bodega'));

    expect(catalog.products[0]).toMatchObject({
      id: '10',
      name: 'Malbec Reserva',
      imageUrl: 'https://cdn.example/malbec.jpg',
      galleryUrls: ['https://cdn.example/malbec-2.jpg'],
      imageStatus: 'ready',
      imageAlt: 'Botella Malbec Reserva',
    });
  });
});
