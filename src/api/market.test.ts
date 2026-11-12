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
  fetchMarketCatalog,
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

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/tenant/carrito',
      expect.objectContaining({
        method: 'POST',
        tenantSlug: 'tenant',
        body: expect.objectContaining({
          catalogo_item_id: '1',
          catalog_item_id: '1',
          productId: '1',
          quantity: 1,
          cantidad: 1,
        }),
      }),
    );
    expect(cart.continuity?.summary).toBe('retomar en portal');
    expect(cart.continuity?.portal_links?.home).toBe('/tenant/portal');
  });

  it('preserves backend cart ids and cantidad for marketplace checkout continuity', async () => {
    apiFetchMock.mockResolvedValueOnce({
      items: [
        {
          catalogo_item_id: 42,
          cart_item_id: 'line-42',
          nombre: 'Malbec Reserva',
          cantidad: 3,
          price: 12000,
        },
      ],
      total_estimado: 36000,
      total_puntos_estimado: 12,
      promotions: {
        total_ahorrado: 6000,
        total_con_descuento: 30000,
        promociones_aplicadas: ['3x2 vinos'],
        items_detalle: [{ catalogo_item_id: 42 }],
      },
    });

    const cart = await fetchMarketCart('bodega');

    expect(cart.totalAmount).toBe(36000);
    expect(cart.totalPoints).toBe(12);
    expect(cart.items[0]).toMatchObject({
      id: '42',
      catalogo_item_id: 42,
      catalog_item_id: 42,
      product_id: 42,
      line_id: 'line-42',
      quantity: 3,
    });
    expect(cart.promotions).toMatchObject({
      total_ahorrado: 6000,
      total_con_descuento: 30000,
      promociones_aplicadas: ['3x2 vinos'],
    });
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
        checkout_experience: {
          contract_version: 'commerce.conversational_checkout_experience.v1',
          ready: false,
          reason_code: 'payment_gateway_not_configured',
          gateway: {
            name: 'mercadopago',
            configured: false,
            provider_label: 'Mercado Pago',
          },
          policy: {
            card_data_in_chat: false,
            webhook_required_for_paid_state: true,
          },
          copy: {
            customer_pending_gateway: 'Mercado Pago pendiente de configurar.',
          },
          integration_access: {
            enabled: true,
            required_plan: 'full',
            current_plan: 'pro',
          },
          blocking_reasons: [
            {
              id: 'payment_gateway_not_configured',
              label: 'Proveedor de pago pendiente',
              detail: 'Configura Mercado Pago.',
            },
          ],
          operator_next_actions: [
            {
              id: 'connect_gateway',
              label: 'Conectar Mercado Pago',
              status: 'required',
            },
          ],
          steps: [{ key: 'open_checkout', title: 'Abrir checkout', status: 'pending' }],
        },
      },
      checkout_preview: {
        payment_ready: false,
        contact_ready: true,
        next_step_label: 'Confirmar pedido',
        checkout_experience: {
          contract_version: 'commerce.conversational_checkout_experience.v1',
          ready: false,
          reason_code: 'payment_gateway_not_configured',
        },
      },
    });

    const cart = await fetchMarketCart('tenant');

    expect(cart.mercadopago_ready).toBe(false);
    expect(cart.checkout_options).toMatchObject({
      payment_required: true,
      requires_contact_or_auth: true,
      gateway_hint: 'mercadopago',
    });
    expect(cart.checkout_options?.checkout_experience).toMatchObject({
      contract_version: 'commerce.conversational_checkout_experience.v1',
      ready: false,
      reason_code: 'payment_gateway_not_configured',
      gateway: {
        name: 'mercadopago',
        configured: false,
        provider_label: 'Mercado Pago',
      },
      policy: {
        card_data_in_chat: false,
        webhook_required_for_paid_state: true,
      },
      integration_access: {
        enabled: true,
        required_plan: 'full',
        current_plan: 'pro',
      },
      blocking_reasons: [
        {
          id: 'payment_gateway_not_configured',
          label: 'Proveedor de pago pendiente',
          detail: 'Configura Mercado Pago.',
        },
      ],
      operator_next_actions: [
        {
          id: 'connect_gateway',
          label: 'Conectar Mercado Pago',
          status: 'required',
        },
      ],
    });
    expect(cart.checkout_options?.checkout_experience?.steps?.[0]).toMatchObject({
      key: 'open_checkout',
      title: 'Abrir checkout',
    });
    expect(cart.checkout_preview).toMatchObject({
      payment_ready: false,
      contact_ready: true,
      next_step_label: 'Confirmar pedido',
    });
    expect(cart.checkout_preview?.checkout_experience?.reason_code).toBe('payment_gateway_not_configured');
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

  it('sends catalog item aliases and cantidad to checkout providers', async () => {
    apiFetchMock.mockResolvedValueOnce({
      contract_version: 'payments.checkout_session.v1',
      preference_id: 'pref_alias',
      init_point: 'https://checkout.example/pref_alias',
    });

    await startMarketCheckout('tenant', {
      items: [
        {
          id: '42',
          product_id: 42,
          catalogo_item_id: 42,
          catalog_item_id: 42,
          quantity: 2,
          cantidad: 2,
        },
      ],
    });

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/v2/payments/checkout-session',
      expect.objectContaining({
        body: expect.objectContaining({
          items: [
            expect.objectContaining({
              id: '42',
              product_id: 42,
              catalogo_item_id: 42,
              catalog_item_id: 42,
              quantity: 2,
              cantidad: 2,
            }),
          ],
        }),
      }),
    );
  });

  it('normalizes plan lock contracts from checkout-session responses', async () => {
    apiFetchMock.mockResolvedValueOnce({
      ok: false,
      error: 'plan_required',
      reason_code: 'plan_full_required',
      action_hint: 'upgrade_full_plan',
      message: 'Plan Full requerido para cobrar desde WhatsApp, widget o checkout publico.',
      frontend_contract: {
        render_as: 'payment_integration_locked',
        show_upgrade_cta: true,
      },
      integration_access: {
        enabled: false,
        current_plan: 'pro',
        required_plan: 'full',
      },
    });

    const checkout = await startMarketCheckout('tenant', { items: [{ id: '1', quantity: 1 }] });

    expect(checkout.ok).toBe(false);
    expect(checkout.error).toBe('plan_required');
    expect(checkout.frontend_contract?.render_as).toBe('payment_integration_locked');
    expect(checkout.integration_access?.enabled).toBe(false);
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

  it('falls back to public marketplace checkout when internal checkout endpoints require auth', async () => {
    apiFetchMock
      .mockRejectedValueOnce(new ApiError('unauthorized', 401))
      .mockRejectedValueOnce(new ApiError('forbidden', 403))
      .mockResolvedValueOnce({
        ok: true,
        checkout_url: 'https://checkout.example/public',
        order_id: 'ord_public_1',
      });

    const checkout = await startMarketCheckout('bodega', {
      items: [{ id: '1', quantity: 2 }],
    });

    expect(apiFetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v2/payments/checkout-session',
      expect.objectContaining({
        suppressPanel401Redirect: true,
        omitChatSessionId: true,
      }),
    );
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v2/payments/preference',
      expect.objectContaining({
        suppressPanel401Redirect: true,
        omitChatSessionId: true,
      }),
    );
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/market/bodega/checkout/start',
      expect.objectContaining({
        suppressPanel401Redirect: true,
        omitChatSessionId: true,
      }),
    );
    expect(checkout.ok).toBe(true);
    expect(checkout.checkoutUrl).toBe('https://checkout.example/public');
    expect(checkout.init_point).toBe('https://checkout.example/public');
    expect(checkout.order_id).toBe('ord_public_1');
  });

  it('uses the guest-safe checkout endpoint published by the catalog contract', async () => {
    apiFetchMock
      .mockResolvedValueOnce({
        contract_version: 'public.market_catalog.v1',
        products: [],
        public_api: {
          contract_version: 'marketplace.public_api.v1',
          anonymous: true,
          guest_safe: true,
          checkout: {
            guest_safe: true,
            start: {
              method: 'POST',
              endpoint: '/api/checkout/crear-preferencia',
            },
          },
        },
      })
      .mockResolvedValueOnce({
        pedido_id: 81,
        market_order_id: 91,
        estado: 'confirmado',
        total_monetario: 0,
      });

    await fetchMarketCatalog('contract-checkout');
    const checkout = await startMarketCheckout('contract-checkout', {
      items: [{ id: '42', quantity: 2 }],
      contact: { name: 'Cliente QA', phone: '+5492610000000' },
    });

    expect(apiFetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/checkout/crear-preferencia',
      expect.objectContaining({
        method: 'POST',
        tenantSlug: 'contract-checkout',
        suppressPanel401Redirect: true,
        omitChatSessionId: true,
        body: expect.objectContaining({
          items: [{ id: '42', quantity: 2 }],
        }),
      }),
    );
    expect(checkout.order_id).toBe(81);
    expect(checkout.market_order_id).toBe(91);
    expect(checkout.status).toBe('confirmado');
  });

  it('ignores a checkout URL outside the same-origin API contract', async () => {
    apiFetchMock
      .mockResolvedValueOnce({
        contract_version: 'public.market_catalog.v1',
        products: [],
        public_api: {
          contract_version: 'marketplace.public_api.v1',
          anonymous: true,
          guest_safe: true,
          checkout: {
            guest_safe: true,
            start: {
              method: 'POST',
              endpoint: 'https://untrusted.example/checkout',
            },
          },
        },
      })
      .mockResolvedValueOnce({
        contract_version: 'payments.checkout_session.v1',
        preference_id: 'pref_same_origin',
        init_point: 'https://checkout.example/pref_same_origin',
      });

    await fetchMarketCatalog('unsafe-contract');
    await startMarketCheckout('unsafe-contract', {
      items: [{ id: '1', quantity: 1 }],
    });

    expect(apiFetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v2/payments/checkout-session',
      expect.any(Object),
    );
    expect(apiFetchMock).not.toHaveBeenCalledWith(
      'https://untrusted.example/checkout',
      expect.any(Object),
    );
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
          catalogo_item_id: 'cat_10',
          tenant_slug: 'bodega',
          nombre: 'Malbec Reserva',
          precio: '12000',
          imagen_url: 'https://cdn.example/malbec.jpg',
          gallery_urls: ['https://cdn.example/malbec-2.jpg'],
          image_status: 'ready',
          image_alt: 'Botella Malbec Reserva',
        },
      ],
    });

    const catalog = await fetchMarketCatalog('bodega');

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/public/tenants/bodega/catalog?contract=marketplace',
      expect.objectContaining({
        tenantSlug: 'bodega',
        suppressPanel401Redirect: true,
      }),
    );
    expect(catalog.products[0]).toMatchObject({
      id: 'cat_10',
      catalogo_item_id: 'cat_10',
      tenant_slug: 'bodega',
      name: 'Malbec Reserva',
      imageUrl: 'https://cdn.example/malbec.jpg',
      galleryUrls: ['https://cdn.example/malbec-2.jpg'],
      imageStatus: 'ready',
      imageAlt: 'Botella Malbec Reserva',
    });
  });

  it('preserves public marketplace promotions and derives product promo badges by scope', async () => {
    apiFetchMock.mockResolvedValueOnce({
      contract_version: 'public.market_catalog.v1',
      products: [
        {
          id: 10,
          catalogo_item_id: 10,
          nombre: 'Malbec Reserva',
          categoria: 'vinos',
          precio: 12000,
        },
        {
          id: 11,
          catalogo_item_id: 11,
          nombre: 'Aceite de Oliva',
          categoria: 'almacen',
          precio: 9000,
        },
      ],
      promotions: {
        contract_version: 'public.catalog_promotions.v1',
        enabled: true,
        total: 1,
        active: 1,
        items: [
          {
            id: 'promo-1',
            title: '15% vinos seleccionados',
            descripcion_publica: 'Promo de temporada',
            tipo_promocion: 'PORCENTAJE_CATEGORIA',
            valor_descuento: 15,
            alcances: [{ tipo_alcance: 'CATEGORIA', nombre_categoria: 'vinos' }],
          },
        ],
      },
      assisted_intake: {
        contract_version: 'marketplace.assisted_intake_entry.v1',
        display_name: 'Vega Marketplace IA',
        mode: 'catalog_plus_assisted',
        text_examples: [
          {
            id: 'hardware_order',
            label: 'Ferreteria',
            document_type: 'quote_request',
            text: '2 chapas',
          },
        ],
        empty_state: {
          title: 'Catalogo sin productos visibles, solicitud asistida activa',
        },
      },
      frontend_contract: {
        render_as: 'marketplace_catalog',
        show_assisted_intake: true,
      },
    });

    const catalog = await fetchMarketCatalog('bodega');

    expect(catalog.promotions).toMatchObject({
      contract_version: 'public.catalog_promotions.v1',
      enabled: true,
      total: 1,
    });
    expect(catalog.products[0].promoInfo).toBe('15% vinos seleccionados');
    expect(catalog.products[1].promoInfo).toBeNull();
    expect(catalog.assisted_intake).toMatchObject({
      contract_version: 'marketplace.assisted_intake_entry.v1',
      display_name: 'Vega Marketplace IA',
      mode: 'catalog_plus_assisted',
    });
    expect(catalog.assisted_intake?.text_examples?.[0]?.document_type).toBe('quote_request');
    expect(catalog.frontend_contract).toMatchObject({ show_assisted_intake: true });
  });

  it('normalizes the canonical anonymous marketplace public API contract', async () => {
    apiFetchMock.mockResolvedValueOnce({
      contract_version: 'public.market_catalog.v1',
      products: [],
      assisted_intake: {
        contract_version: 'marketplace.assisted_intake_entry.v1',
        mode: 'assisted_first',
        frontend_contract: {
          submit_endpoint: '/legacy/should-not-win',
        },
      },
      public_api: {
        contract_version: 'marketplace.public_api.v1',
        anonymous: true,
        guest_safe: true,
        identity_headers: ['X-Anon-Id', 'X-Chat-Session-Id', 'X-Tenant'],
        catalog: {
          method: 'GET',
          endpoint: '/api/market/junin/catalog?contract=marketplace',
          alias_endpoint: '/api/public/tenants/junin/catalog?contract=marketplace',
        },
        cart: {
          summary: { method: 'GET', endpoint: '/api/pwa/public/cart/summary?tenant=junin', guest_safe: true },
          add: { method: 'POST', endpoint: '/api/pwa/public/cart/add?tenant=junin', guest_safe: true },
          items: { method: 'GET', endpoint: '/api/pwa/public/cart/items?tenant=junin', guest_safe: true },
        },
        checkout: {
          start: { method: 'POST', endpoint: '/api/checkout/crear-preferencia' },
          preview: { method: 'GET', endpoint: '/api/pwa/public/cart/summary?tenant=junin', guest_safe: true },
          fallback_behavior: 'return_structured_plan_or_payment_error_never_tokenized_endpoint',
        },
        assisted_upload: {
          method: 'POST',
          endpoint: '/api/pedidos/from-file?origen=marketplace',
        },
        security: {
          contract_version: 'marketplace.public_security.v1',
          protected_surfaces: ['marketplace_assisted_upload'],
          turnstile: {
            contract_version: 'cloudflare.turnstile.public_intake.v1',
            provider: 'cloudflare_turnstile',
            surface: 'marketplace_assisted_upload',
            status: 'required',
            configured: true,
            enforced: true,
            required: true,
            token_header: 'X-Turnstile-Token',
            token_fields: ['turnstile_token', 'cf-turnstile-response'],
            retryable: false,
            reset_required: false,
          },
        },
        flow_runtime: {
          method: 'GET',
          endpoint: '/api/public/flows/runtime?tenant=junin&channel=whatsapp',
          actions_endpoint: '/api/public/flows/actions?tenant=junin',
          contract_version: 'public.whatsapp.flow_runtime.v1',
          guest_safe: true,
          execution_policy: {
            contract_version: 'public.flow_runtime.execution_policy.v1',
            id_strategy: 'client_supplied_or_server_deterministic_from_idempotency_key',
            callback_endpoint_template: '/api/public/flows/{execution_id}/callback',
            resume_policy: 'resume_conversation_on_callback_or_timeout',
          },
        },
        tracking: {
          order_path_template: '/tracking/order/{code}?tenant_slug=junin',
        },
        analytics: {
          contract_version: 'marketplace.public_analytics_loop.v1',
          event_endpoint: '/api/analytics/event',
          runtime_callback_endpoint_template: '/api/public/flows/{execution_id}/callback',
          public_client_can_write_events_directly: false,
          write_mode: 'frontend_signal_plus_server_reconciliation',
          client_signal_channel: 'dataLayer',
          recommended_events: ['catalog_viewed', 'checkout_session_created', 'order_tracking_opened'],
          funnel: [{ stage: 'catalog', event: 'catalog_viewed' }],
          privacy: { card_data_in_chat_allowed: false },
        },
      },
    });

    const catalog = await fetchMarketCatalog('junin');

    expect(catalog.public_api).toMatchObject({
      contract_version: 'marketplace.public_api.v1',
      anonymous: true,
      guest_safe: true,
      identity_headers: ['X-Anon-Id', 'X-Chat-Session-Id', 'X-Tenant'],
      catalog: {
        endpoint: '/api/market/junin/catalog?contract=marketplace',
        alias_endpoint: '/api/public/tenants/junin/catalog?contract=marketplace',
      },
      cart: {
        summary: { endpoint: '/api/pwa/public/cart/summary?tenant=junin', guest_safe: true },
        add: { endpoint: '/api/pwa/public/cart/add?tenant=junin', guest_safe: true },
        items: { endpoint: '/api/pwa/public/cart/items?tenant=junin', guest_safe: true },
      },
      checkout: {
        start: { endpoint: '/api/checkout/crear-preferencia' },
        preview: { endpoint: '/api/pwa/public/cart/summary?tenant=junin', guest_safe: true },
        fallback_behavior: 'return_structured_plan_or_payment_error_never_tokenized_endpoint',
      },
      assisted_upload: {
        endpoint: '/api/pedidos/from-file?origen=marketplace',
      },
      security: {
        contract_version: 'marketplace.public_security.v1',
        protected_surfaces: ['marketplace_assisted_upload'],
        turnstile: {
          contract_version: 'cloudflare.turnstile.public_intake.v1',
          provider: 'cloudflare_turnstile',
          surface: 'marketplace_assisted_upload',
          status: 'required',
          configured: true,
          enforced: true,
          required: true,
          token_header: 'X-Turnstile-Token',
          token_fields: ['turnstile_token', 'cf-turnstile-response'],
          reset_required: false,
        },
      },
      flow_runtime: {
        endpoint: '/api/public/flows/runtime?tenant=junin&channel=whatsapp',
        actions_endpoint: '/api/public/flows/actions?tenant=junin',
        contract_version: 'public.whatsapp.flow_runtime.v1',
        guest_safe: true,
        execution_policy: {
          contract_version: 'public.flow_runtime.execution_policy.v1',
          id_strategy: 'client_supplied_or_server_deterministic_from_idempotency_key',
          callback_endpoint_template: '/api/public/flows/{execution_id}/callback',
          resume_policy: 'resume_conversation_on_callback_or_timeout',
        },
      },
      tracking: {
        order_path_template: '/tracking/order/{code}?tenant_slug=junin',
      },
      analytics: {
        contract_version: 'marketplace.public_analytics_loop.v1',
        event_endpoint: '/api/analytics/event',
        public_client_can_write_events_directly: false,
        client_signal_channel: 'dataLayer',
        recommended_events: ['catalog_viewed', 'checkout_session_created', 'order_tracking_opened'],
      },
    });
    expect(catalog.assisted_intake?.submit).toMatchObject({
      method: 'POST',
      endpoint: '/api/pedidos/from-file?origen=marketplace',
    });
  });

  it('uses canonical guest-safe marketplace cart endpoints after reading the public API contract', async () => {
    apiFetchMock
      .mockResolvedValueOnce({
        contract_version: 'public.market_catalog.v1',
        products: [],
        public_api: {
          contract_version: 'marketplace.public_api.v1',
          anonymous: true,
          guest_safe: true,
          cart: {
            summary: { method: 'GET', endpoint: '/api/pwa/public/cart/summary?tenant=canonic', guest_safe: true },
            add: { method: 'POST', endpoint: '/api/pwa/public/cart/add?tenant=canonic', guest_safe: true },
          },
        },
      })
      .mockResolvedValueOnce({ items: [], totalAmount: 0 })
      .mockResolvedValueOnce({ items: [{ id: '22', name: 'Chapa', quantity: 2 }], totalAmount: 2400 });

    await fetchMarketCatalog('canonic');
    await fetchMarketCart('canonic');
    await addMarketItem('canonic', { productId: '22', quantity: 2 });

    expect(apiFetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/pwa/public/cart/summary?tenant=canonic',
      expect.objectContaining({
        tenantSlug: 'canonic',
        skipAuth: true,
        omitCredentials: true,
        sendAnonId: true,
      }),
    );
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/pwa/public/cart/add?tenant=canonic',
      expect.objectContaining({
        method: 'POST',
        tenantSlug: 'canonic',
        skipAuth: true,
        omitCredentials: true,
        sendAnonId: true,
        body: expect.objectContaining({
          catalogo_item_id: '22',
          cantidad: 2,
        }),
      }),
    );
  });
});
