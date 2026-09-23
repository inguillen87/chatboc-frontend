// Real CRM components and service receipts, synthetic HTTP, no customer session or credentials.
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const folder = '.vercel/commercial-insights-evidence';
const server = await createServer({ configFile: false, plugins: [react()],
  cacheDir: '.vercel/commercial-insights-cache',
  resolve: { alias: [{ find: /^@\/utils\/api$/, replacement: path.resolve('tests/e2e/fixtures/commercial-insights.api.ts') }, { find: '@', replacement: path.resolve('src') }] },
  server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
let browser; const results = [];
const stageNames = ['nuevo', 'contactado', 'calificado', 'demo_agendada', 'propuesta_enviada', 'ganado', 'perdido', 'custom'];
const items = stageNames.map((stage, i) => ({ ticket_id: i + 12, ticket_type: 'municipio', nro: String(9001 + i),
  nombre: i === 0 ? 'José de prueba' : `Contacto sintético ${i}`, email: `qa-${i}@example.test`, stage,
  last_seen: new Date(Date.now() - (i + 2) * 86400000).toISOString() }));
try {
  await server.listen(); const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  await mkdir(folder, { recursive: true }); browser = await chromium.launch({ headless: true });
  for (const [width, height, dark] of [[1440,1000,false], [390,844,true], [320,740,false]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    const writes = [], timeline = [], errors = [];
    await context.route('**/*', async (route) => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== origin) return route.abort();
      if (!url.pathname.startsWith('/api/')) return route.continue();
      if (url.pathname === '/api/admin/tenants/qa-sprint/leads') return route.fulfill({ json: { tenant_slug: 'qa-sprint', total: items.length, items } });
      if (url.pathname === '/api/admin/tenants/qa-sprint/leads/municipio/12/timeline') {
        if (request.method() === 'POST') {
          const body = request.postDataJSON(); writes.push({ path: url.pathname, body });
          timeline.push({ event: 'tenant_note', note: body.note, at: new Date().toISOString(), by_user_id: 9 });
        }
        return route.fulfill({ json: { ok: true, ticket_id: 12, ticket_type: 'municipio', tenant_slug: 'qa-sprint', timeline } });
      }
      return route.fulfill({ status: 404, json: { error: 'Unexpected synthetic request' } });
    });
    const page = await context.newPage(); page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto(`${origin}/tests/e2e/fixtures/commercial-insights.html`);
      if (dark) await page.evaluate(() => document.documentElement.classList.add('dark'));
      await page.getByRole('button', { name: 'Abrir CRM de prueba' }).click();
      const dialog = page.getByRole('dialog', { name: 'CRM · Organización de prueba' });
      await expect(page.getByRole('button', { name: 'Filtrar Nuevo: 1 casos' })).toBeVisible();
      const overflow = await dialog.evaluate((element) => ({ client: element.clientWidth, scroll: element.scrollWidth, page: document.documentElement.scrollWidth, viewport: innerWidth }));
      assert.ok(overflow.scroll <= overflow.client + 1 && overflow.page <= overflow.viewport + 1, `Horizontal overflow: ${JSON.stringify(overflow)}`);
      const reduced = await page.locator('.commercial-bar-track > span').first().evaluate((element) => getComputedStyle(element).animationName);
      assert.equal(reduced, 'none');
      await page.screenshot({ path: `${folder}/crm-${width}-charts.png`, fullPage: true });
      const accessibility = await new AxeBuilder({ page }).include('.commercial-workspace').withTags(['wcag2a', 'wcag2aa']).analyze();
      const serious = accessibility.violations.filter((issue) => ['critical', 'serious'].includes(issue.impact));
      assert.deepEqual(serious.map((issue) => ({ id: issue.id, nodes: issue.nodes.map((node) => node.target) })), []);
      const stageBar = page.getByRole('button', { name: 'Filtrar Nuevo: 1 casos' });
      await stageBar.focus(); await page.keyboard.press('Enter');
      await expect(page.getByLabel('Filtrar por etapa')).toHaveValue('nuevo');
      await page.getByRole('button', { name: 'Limpiar filtros' }).click();
      await page.getByRole('button', { name: 'Tablero por etapas' }).click();
      await page.locator('.commercial-kanban').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${folder}/crm-${width}-board.png`, fullPage: true });
      await page.getByRole('button', { name: 'Seguimiento de José de prueba, caso 9001' }).click();
      const note = page.getByLabel('Nota de seguimiento');
      await note.fill('Seguimiento sintético conservado');
      await page.getByRole('button', { name: 'Volver al listado' }).click();
      await expect(page.getByRole('alertdialog', { name: 'Hay cambios sin guardar' })).toBeVisible();
      await page.getByRole('button', { name: 'Seguir editando' }).click();
      await expect(note).toHaveValue('Seguimiento sintético conservado');
      await page.getByRole('button', { name: 'Guardar nota', exact: true }).click();
      await expect(page.getByText('Nota guardada y confirmada por el servidor.')).toBeVisible();
      assert.equal(writes.length, 1); assert.ok(writes[0].path.endsWith('/municipio/12/timeline'));
      await expect(note).toHaveValue('');
      await page.getByRole('button', { name: 'Volver al listado' }).click();
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
      await expect(page.getByRole('button', { name: 'Abrir CRM de prueba' })).toBeFocused();
      assert.deepEqual(errors, []);
      results.push({ width, height, dark, passed: true, writes: writes.length, seriousAccessibilityViolations: serious.length });
    } catch (error) {
      await page.screenshot({ path: `${folder}/failure-${width}.png`, fullPage: true }).catch(() => {});
      results.push({ width, height, dark, passed: false, reason: error.message, errors });
    } finally { await context.close(); }
  }
  await writeFile(`${folder}/results.json`, JSON.stringify({ syntheticData: true, productionBackend: false, results }, null, 2));
  console.log(JSON.stringify({ syntheticData: true, productionBackend: false, results }));
  assert.ok(results.every((result) => result.passed), 'Commercial browser checks failed');
} finally { await browser?.close(); await server.close(); }
