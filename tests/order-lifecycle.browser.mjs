// Real pages, lifecycle and session logic, synthetic transport. No production backend or authentication.
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const folder = '.vercel/order-lifecycle-evidence';
const replacement = path.resolve('tests/e2e/fixtures/order-lifecycle.api.ts');
const server = await createServer({ configFile: false, plugins: [react()], cacheDir: '.vercel/order-lifecycle-cache',
  resolve: { alias: [{ find: /^@\/(api\/(client|market)|context\/TenantContext|utils\/api)$/, replacement }, { find: '@', replacement: path.resolve('src') }] },
  server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
let browser; const results = [];
try {
  await server.listen(); const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  await mkdir(folder, { recursive: true }); browser = await chromium.launch({ headless: true });
  for (const [width, height, dark] of [[1440,1000,false], [390,844,true], [320,740,false]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    const errors = [], writes = [];
    let status = 'confirmed';
    await context.route('**/*', async (route) => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== origin) return route.abort();
      if (!url.pathname.startsWith('/api/')) return route.continue();
      if (url.pathname === '/api/fixture/public/PED-QA-9001') return route.fulfill({ json: {
        nro_pedido: 'PED-QA-9001', tracking_id: 'PED-QA-9001', estado: 'entregado', pyme_nombre: 'Comercio de prueba', tenant_slug: 'qa-order', monto_total: 12000,
        detalles: [{ nombre_producto: 'Artículo de prueba', cantidad: 2, precio_unitario_original: 6000, subtotal_con_descuento: 12000, moneda: 'ARS' }],
        privacy: { pii_redacted: true }, nombre_cliente: 'Nombre privado NO mostrar', direccion: 'Dirección privada NO mostrar', telefono_cliente: '+54123456789',
        latitud: -32.9, longitud: -68.8, delivery_summary: 'Dirección registrada',
        branding: { primaryColor: '#245b85', secondaryColor: '#dcebf5' },
      } });
      if (url.pathname === '/api/fixture/qa-order/fulfillment') return route.fulfill({ json: { tenant: {} } });
      if (decodeURIComponent(url.pathname) === '/api/fixture/qa-order/orders/market:42') {
        if (request.method() === 'PATCH') { writes.push({ path: url.pathname, body: request.postDataJSON() }); status = request.postDataJSON().status; }
        return route.fulfill({ json: { id: 'market:42', tenant_slug: 'qa-order', status, total: 12000, created_at: '2026-09-23T12:00:00Z', items: [{ name: 'Artículo de prueba', price: 6000, quantity: 2 }], customer_profile: { name: 'Cliente de prueba', email: 'qa@example.test' } } });
      }
      return route.fulfill({ status: 404, json: { error: 'Unexpected synthetic endpoint' } });
    });
    const page = await context.newPage(); page.on('pageerror', (error) => errors.push(error.message));
    const checkOverflow = async () => {
      const value = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth }));
      assert.ok(value.width <= value.viewport + 1, `Horizontal overflow: ${JSON.stringify(value)}`);
    };
    try {
      await page.goto(`${origin}/tests/e2e/fixtures/order-lifecycle.html`);
      if (dark) await page.evaluate(() => document.documentElement.classList.add('dark'));
      await expect(page.getByRole('heading', { name: 'Pedido #PED-QA-9001' })).toBeVisible();
      await expect(page.getByText('Pago no informado')).toBeVisible();
      await expect(page.getByText('Nombre privado NO mostrar')).toHaveCount(0);
      await expect(page.locator('a[href*="wa.me"]')).toHaveCount(0);
      await checkOverflow();
      assert.equal(await page.locator('.order-lifecycle-signal').first().evaluate((element) => getComputedStyle(element).animationName), 'none');
      const publicAxe = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa']).analyze();
      const serious = publicAxe.violations.filter((issue) => ['critical','serious'].includes(issue.impact));
      assert.deepEqual(serious.map((issue) => ({ id: issue.id, nodes: issue.nodes.map((node) => node.target) })), []);
      await page.screenshot({ path: `${folder}/public-${width}.png`, fullPage: true });
      await page.goto(`${origin}/tests/e2e/fixtures/order-lifecycle.html?view=admin`);
      if (dark) await page.evaluate(() => document.documentElement.classList.add('dark'));
      await expect(page.getByRole('heading', { name: 'Pedido #market:42' })).toBeVisible();
      await checkOverflow();
      await page.getByRole('button', { name: 'Marcar Enviado' }).click();
      const dialog = page.getByRole('alertdialog', { name: 'Revisar cambio de estado' });
      await expect(dialog).toContainText('market:42');
      await expect(dialog).toContainText('qa-order');
      const modalAxe = await new AxeBuilder({ page }).include('[role="alertdialog"]').withTags(['wcag2a','wcag2aa']).analyze();
      const modalSerious = modalAxe.violations.filter((issue) => ['critical','serious'].includes(issue.impact));
      assert.deepEqual(modalSerious.map((issue) => issue.id), []);
      await page.screenshot({ path: `${folder}/admin-${width}-review.png`, fullPage: true });
      await page.getByRole('button', { name: 'Volver sin cambiar' }).click(); assert.equal(writes.length, 0);
      await page.getByRole('button', { name: 'Marcar Enviado' }).click();
      await page.getByRole('button', { name: 'Confirmar cambio de estado' }).click();
      await expect(dialog).not.toBeVisible();
      await expect(page.getByRole('button', { name: 'Marcar Entregado' })).toBeVisible();
      assert.equal(writes.length, 1); assert.equal(writes[0].body.status, 'shipped');
      await expect(page.getByText('Pago no informado')).toBeVisible();
      assert.deepEqual(errors, []);
      results.push({ width, height, dark, passed: true, writes: writes.length, seriousPublicViolations: serious.length, seriousModalViolations: modalSerious.length });
    } catch (error) {
      await page.screenshot({ path: `${folder}/failure-${width}.png`, fullPage: true }).catch(() => {});
      results.push({ width, height, dark, passed: false, reason: error.message, errors });
    } finally { await context.close(); }
  }
  const evidence = { syntheticData: true, productionBackend: false, realAuth: false, sharedApiTransport: false, results };
  await writeFile(`${folder}/results.json`, JSON.stringify(evidence, null, 2)); console.log(JSON.stringify(evidence));
  assert.ok(results.every((result) => result.passed), 'Order browser checks failed');
} finally { await browser?.close(); await server.close(); }
