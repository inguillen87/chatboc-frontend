import { expect, test, type Page, type Route } from '@playwright/test';
import { E2E_VIEWPORTS, expectInsideViewport, expectNoHorizontalOverflow } from './e2e-helpers';

const PRODUCT_ID = 'prod-101';
const PRODUCT_NAME = 'Taladro percutor 750W';

const catalogPayload = {
  contract_version: 'public.market_catalog.v1',
  request_id: 'req-market-e2e',
  tenant: { slug: 'junin', nombre: 'Ferreteria Junin' },
  products: [
    {
      catalogo_item_id: PRODUCT_ID,
      product_id: PRODUCT_ID,
      nombre: PRODUCT_NAME,
      descripcion: 'Herramienta con velocidad variable y garantia comercial.',
      precio: 85_000,
      moneda: 'ARS',
      categoria: 'Herramientas',
      stock: 8,
      stock_status: 'in_stock',
      available_to_sell: true,
      amount_validated: true,
      disponible: true,
      checkout_type: 'chatboc',
      public_url: `/t/junin/market/${PRODUCT_ID}`,
    },
  ],
  promotions: { contract_version: 'public.catalog_promotions.v1', enabled: true, total: 0, items: [] },
  facets: {
    categories: [{ value: 'Herramientas', label: 'Herramientas', count: 1 }],
    promotion_count: 0,
  },
  sort_options: [{ id: 'promo_first', label: 'Promociones primero' }],
  total: 1,
  total_unfiltered: 1,
  hero_subtitle: 'Stock y precio validados por el comercio.',
  frontend_contract: { show_assisted_intake: false },
  public_cart_url: '/t/junin/cart',
  public_api: {
    contract_version: 'marketplace.public_api.v1',
    anonymous: true,
    guest_safe: true,
    identity_headers: ['X-Anon-Id', 'X-Chat-Session-Id', 'X-Tenant'],
    catalog: {
      method: 'GET',
      endpoint: '/api/public/tenants/junin/catalog?contract=marketplace',
    },
    cart: {
      summary: { method: 'GET', endpoint: '/api/pwa/public/cart/summary?tenant=junin', guest_safe: true },
      add: { method: 'POST', endpoint: '/api/pwa/public/cart/add?tenant=junin', guest_safe: true },
    },
    checkout: {
      preview: { method: 'POST', endpoint: '/api/v2/payments/checkout-preview', guest_safe: true },
      start: { method: 'POST', endpoint: '/api/checkout/crear-preferencia', guest_safe: true },
      fallback_behavior: 'return_structured_plan_or_payment_error_never_tokenized_endpoint',
    },
    tracking: { order_path_template: '/tracking/order/{code}?tenant_slug=junin' },
    analytics: {
      contract_version: 'marketplace.public_analytics_loop.v1',
      write_mode: 'frontend_signal_plus_server_reconciliation',
      client_signal_channel: 'dataLayer',
      public_client_can_write_events_directly: false,
      recommended_events: ['catalog_viewed', 'cart_started', 'checkout_session_created', 'order_created'],
    },
  },
};

type MarketplaceCapture = {
  addRequests: Array<Record<string, unknown>>;
  previewRequests: Array<Record<string, unknown>>;
  checkoutRequests: Array<Record<string, unknown>>;
};

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const mockMarketplaceApis = async (page: Page, capture: MarketplaceCapture) => {
  let hasItem = false;

  const cartPayload = () => ({
    contract_version: 'marketplace.cart.v1',
    request_id: 'req-cart-e2e',
    items: hasItem
      ? [
          {
            id: PRODUCT_ID,
            catalogo_item_id: PRODUCT_ID,
            product_id: PRODUCT_ID,
            name: PRODUCT_NAME,
            quantity: 1,
            price: 85_000,
            currency: 'ARS',
            modality: 'venta',
            amount_validated: true,
            stock_status: 'in_stock',
            available_to_sell: true,
          },
        ]
      : [],
    total_amount: hasItem ? 85_000 : 0,
    total_points: 0,
    amount_validated: true,
    stock_status: 'in_stock',
    available_to_sell: true,
    checkout_options: {
      contract_version: 'marketplace.checkout_options.v1',
      ready: true,
      payment_required: false,
      payment_ready: true,
      requires_contact_or_auth: true,
    },
    checkout_preview: {
      state: 'ready',
      total_monetary: hasItem ? 85_000 : 0,
      amount_validated: true,
      stock_status: 'in_stock',
      available_to_sell: true,
      payment_required: false,
      payment_ready: true,
      contact_ready: false,
    },
  });

  await page.route('**/*', async (route) => {
    const request = route.request();
    if (!['fetch', 'xhr'].includes(request.resourceType())) {
      await route.continue();
      return;
    }

    const url = new URL(request.url());
    const path = url.pathname.toLowerCase();

    if (path.endsWith('/auth/clerk/config')) {
      await json(route, { enabled: false, publishable_key: '', social_providers: [] });
      return;
    }

    if (path.endsWith('/public/tenant')) {
      await json(route, {
        contract_version: 'public.tenant_profile.v1',
        tenant: { slug: 'junin', nombre: 'Ferreteria Junin', tipo: 'pyme', tema: {} },
      });
      return;
    }

    if (path === '/api/public/tenants/junin/catalog' && request.method() === 'GET') {
      await json(route, catalogPayload);
      return;
    }

    const isCartSummary = path === '/api/pwa/public/cart/summary' || path === '/api/junin/carrito';
    if (isCartSummary && request.method() === 'GET') {
      await json(route, cartPayload());
      return;
    }

    const isCartAdd = path === '/api/pwa/public/cart/add' || path === '/api/junin/carrito';
    if (isCartAdd && request.method() === 'POST') {
      capture.addRequests.push(request.postDataJSON() as Record<string, unknown>);
      hasItem = true;
      await json(route, cartPayload());
      return;
    }

    if (path === '/api/v2/rewards/profile') {
      await json(route, {
        contract_version: 'rewards.profile.v1',
        wallet: { balance: 0, pending_cart_points: 0 },
        available_redemptions: [],
      });
      return;
    }

    if (path === '/api/v2/payments/checkout-preview' && request.method() === 'POST') {
      capture.previewRequests.push(request.postDataJSON() as Record<string, unknown>);
      await json(route, {
        contract_version: 'payments.checkout_preview.v1',
        state: 'ready',
        total_monetary: 85_000,
        amount_validated: true,
        stock_status: 'in_stock',
        available_to_sell: true,
        payment_required: false,
        payment_ready: true,
        contact_ready: true,
      });
      return;
    }

    if (path === '/api/checkout/crear-preferencia' && request.method() === 'POST') {
      capture.checkoutRequests.push(request.postDataJSON() as Record<string, unknown>);
      await json(route, {
        contract_version: 'payments.checkout_session.v1',
        ok: true,
        status: 'confirmed',
        message: 'Pedido confirmado y listo para seguimiento.',
        market_order_id: 'ORD-E2E-9001',
        amount_validated: true,
        stock_status: 'in_stock',
        available_to_sell: true,
        commercial_state: { stage: 'confirmed', channel: 'web_marketplace' },
        tracking: { code: 'ORD-E2E-9001', path: '/tracking/order/ORD-E2E-9001?tenant_slug=junin' },
      });
      return;
    }

    await json(route, {});
  });
};

for (const viewport of E2E_VIEWPORTS) {
  test(`marketplace creates a traceable order on ${viewport.label}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });

    const capture: MarketplaceCapture = { addRequests: [], previewRequests: [], checkoutRequests: [] };
    await mockMarketplaceApis(page, capture);
    await page.goto('/t/junin/market', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: 'Marketplace', exact: true })).toBeVisible();
    const product = page.getByTestId(`market-product-${PRODUCT_ID}`);
    await expect(product).toContainText(PRODUCT_NAME);
    await product.getByRole('button', { name: 'Agregar', exact: true }).click();

    await expect.poll(() => capture.addRequests.length).toBe(1);
    expect(capture.addRequests[0]).toMatchObject({
      catalogo_item_id: PRODUCT_ID,
      catalog_item_id: PRODUCT_ID,
      productId: PRODUCT_ID,
      quantity: 1,
      cantidad: 1,
    });

    const cartLink = page.getByRole('link', { name: 'Carrito (1)' });
    await expect(cartLink).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await cartLink.click();

    await expect(page).toHaveURL(/\/t\/junin\/cart$/);
    await expect(page.getByText(PRODUCT_NAME).first()).toBeVisible();
    await expect(page.getByText('Cantidad: 1').first()).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', { name: 'Finalizar pedido', exact: true }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Datos para confirmar el pedido' });
    await expectInsideViewport(dialog, page);
    await dialog.getByLabel('Nombre').fill('Ana Compradora');
    await dialog.getByLabel(/fono \*/).fill('+54 9 261 555 0101');
    await dialog.getByRole('button', { name: 'Continuar' }).click();

    await expect.poll(() => capture.previewRequests.length).toBe(1);
    await expect.poll(() => capture.checkoutRequests.length).toBe(1);
    for (const payload of [capture.previewRequests[0], capture.checkoutRequests[0]]) {
      expect(payload).toMatchObject({
        name: 'Ana Compradora',
        phone: '+54 9 261 555 0101',
        customer: { name: 'Ana Compradora', phone: '+54 9 261 555 0101' },
        items: [{ id: PRODUCT_ID, quantity: 1 }],
      });
    }

    const confirmation = page.getByRole('alert').filter({ hasText: 'Pedido registrado' });
    await expect(confirmation).toContainText('Pedido confirmado y listo para seguimiento.');
    await expect(confirmation).toContainText('Orden operacional #ORD-E2E-9001.');
    await expect(confirmation).toContainText('Estado: confirmed.');
    await expectNoHorizontalOverflow(page);
  });
}
