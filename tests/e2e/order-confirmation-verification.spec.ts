import { expect, test } from '@playwright/test';
import { E2E_VIEWPORTS, expectNoHorizontalOverflow } from './e2e-helpers';

for (const viewport of E2E_VIEWPORTS) {
  test(`checkout confirms only persisted payment on ${viewport.label}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    let paymentState = 'pendiente_pago';
    let orderReads = 0;
    await page.route('**/*', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (['fetch', 'xhr'].includes(request.resourceType())) {
        let body: unknown = {};
        if (url.pathname.endsWith('/auth/clerk/config')) body = { enabled: false, publishable_key: '', social_providers: [] };
        if (url.pathname.endsWith('/public/tenant')) body = { contract_version: 'public.tenant_profile.v1', tenant: { slug: 'alpha', nombre: 'Empresa de prueba', tipo: 'pyme', tema: {} } };
        if (url.pathname.endsWith('/pedidos/42')) {
          orderReads += 1;
          body = { id: 42, estado: paymentState, total_monetario: 25000, items: [{ nombre: 'Producto de prueba', cantidad: 2, precio_unitario: 12500 }], commercial_state: { channel: 'web' } };
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
        return;
      }
      if (!['127.0.0.1', 'localhost'].includes(url.hostname)) { await route.abort(); return; }
      await route.continue();
    });
    await page.goto('/t/alpha/pedido/confirmado?pedido_id=42&status=approved', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Resultado del pedido', exact: true })).toBeVisible();
    await expect(page.getByText('Pago pendiente de acreditación').first()).toBeVisible();
    await expect(page.getByText('Pago acreditado', { exact: true })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`checkout-pending-${viewport.label}.png`), fullPage: true });
    paymentState = 'paid';
    const refresh = page.getByRole('button', { name: 'Volver a consultar' });
    await expect(refresh).toBeEnabled();
    await refresh.click();
    await expect(page.getByText('Pago acreditado', { exact: true }).first()).toBeVisible();
    expect(orderReads).toBeGreaterThanOrEqual(2);
    await expectNoHorizontalOverflow(page);
  });
}
