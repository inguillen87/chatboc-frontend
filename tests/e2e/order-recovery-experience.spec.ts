import { expect, test, type Page } from '@playwright/test';
import { expectNoHorizontalOverflow } from './e2e-helpers';

async function orderFixture(page: Page) {
  const state = { reads: 0, status: 200, payment: 'paid', hold: false, release: () => {} };
  await page.route('**/*', async (route) => {
    const request = route.request(), url = new URL(request.url());
    if (['fetch', 'xhr'].includes(request.resourceType())) {
      let body: unknown = {}, status = 200;
      if (url.pathname.endsWith('/auth/clerk/config')) body = { enabled: false, publishable_key: '', social_providers: [] };
      if (url.pathname.endsWith('/public/tenant')) body = { contract_version: 'public.tenant_profile.v1', tenant: { slug: 'alpha', nombre: 'Empresa de prueba', tipo: 'pyme', tema: {} } };
      if (url.pathname.endsWith('/pedidos/42')) {
        state.reads += 1;
        if (state.hold) await new Promise<void>((resolve) => { state.release = resolve; });
        status = state.status;
        body = status === 200 ? { id: 42, estado: state.payment, total_monetario: 25000,
          items: [{ nombre: 'Producto de prueba', cantidad: 2, subtotal_monetario: 25000 }],
          commercial_state: { stage: 'fulfillment', channel: 'web' } } : { error: 'forbidden' };
      }
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }); return;
    }
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) { await route.abort(); return; }
    await route.continue();
  });
  return state;
}
const openOrder = (page: Page) => page.goto('/t/alpha/pedido/confirmado?pedido_id=42&status=approved', { waitUntil: 'domcontentloaded' });
for (const mode of ['desktop', 'mobile-dark-reduced'] as const) {
  test(`keeps the verified order visible during refresh: ${mode}`, async ({ page }, testInfo) => {
    await page.setViewportSize(mode === 'desktop' ? { width: 1440, height: 1000 } : { width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: mode === 'desktop' ? 'no-preference' : 'reduce' });
    const state = await orderFixture(page); await openOrder(page);
    await expect(page.getByRole('heading', { name: 'Pago acreditado', exact: true })).toBeVisible();
    if (mode !== 'desktop') await page.evaluate(() => document.documentElement.classList.add('dark'));
    state.hold = true;
    await page.getByRole('button', { name: 'Volver a consultar' }).click();
    await expect(page.getByRole('button', { name: 'Verificando…' })).toBeDisabled();
    await expect(page.getByText('Producto de prueba', { exact: true })).toBeVisible();
    await expect(page.getByTestId('order-summary-loading')).toHaveCount(0);
    if (mode !== 'desktop') {
      await expect(page.getByRole('button', { name: 'Verificando…' }).locator('svg')).toHaveCSS('animation-name', 'none');
    }
    await expectNoHorizontalOverflow(page);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: testInfo.outputPath(`order-${mode}.png`), fullPage: false });
    state.hold = false; state.release();
    await expect(page.getByRole('button', { name: 'Volver a consultar' })).toBeEnabled();
    expect(state.reads).toBe(2);
  });
}
test('removes a previously confirmed order after access is denied', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const state = await orderFixture(page); await openOrder(page);
  await expect(page.getByText('Producto de prueba', { exact: true })).toBeVisible();
  state.status = 403;
  await page.getByRole('button', { name: 'Volver a consultar' }).click();
  await expect(page.getByRole('heading', { name: 'La verificación no se completó' })).toBeVisible();
  await expect(page.getByText('Producto de prueba', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Pago acreditado', { exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test('honors in-app reduced motion and keyboard refresh', async ({ page }) => {
  const state = await orderFixture(page); await openOrder(page);
  await expect(page.getByRole('heading', { name: 'Pago acreditado', exact: true })).toBeVisible();
  await page.evaluate(() => document.documentElement.classList.add('a11y-reduced-motion'));
  state.hold = true;
  const button = page.getByRole('button', { name: 'Volver a consultar' });
  await button.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Verificando…' }).locator('svg')).toHaveCSS('animation-name', 'none');
  await expect(page.getByText('Producto de prueba', { exact: true })).toBeVisible();
  state.hold = false; state.release();
  await expect(page.getByRole('button', { name: 'Volver a consultar' })).toBeEnabled();
});
