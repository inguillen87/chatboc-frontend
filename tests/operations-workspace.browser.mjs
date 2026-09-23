import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const folder = '.vercel/operations-live-evidence/browser';
const replacement = path.resolve('tests/e2e/fixtures/operations-workspace.api.tsx');
const server = await createServer({ configFile: false, plugins: [react()], cacheDir: '.vercel/operations-live-cache',
  resolve: { alias: [{ find: /^@\/context\/(TenantContext|SocketContext)$/, replacement }, { find: /^\.\/(analyticsApi|PremiumTerritoryMap)$/, replacement }, { find: '@', replacement: path.resolve('src') }] },
  optimizeDeps: { entries: ['tests/e2e/fixtures/operations-workspace.html'] },
  server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
let browser; const results = [];
try {
  await server.listen(); const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  await mkdir(folder, { recursive: true }); browser = await chromium.launch({ headless: true });
  for (const [width, height, dark] of [[1440,1000,false], [390,844,true], [320,740,false]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    const page = await context.newPage(), counts = {}, errors = [], methods = [];
    let failMap = false;
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== origin) return route.abort();
      if (!url.pathname.startsWith('/api/operations-fixture/')) return route.continue();
      const name = url.pathname.split('/').at(-1); counts[name] = (counts[name] || 0) + 1; methods.push(request.method());
      if (name === 'heatmap' && failMap) return route.fulfill({ status: 403, json: { error: 'Synthetic denial' } });
      const value = await page.evaluate(key => window.qaOperationsFixtures[key], name);
      return route.fulfill({ json: value });
    });
    try {
      await page.goto(`${origin}/tests/e2e/fixtures/operations-workspace.html`);
      if (dark) await page.evaluate(() => document.documentElement.classList.add('dark'));
      await expect(page.getByTestId('operations-workspace-status')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Actualizar', exact: true })).toBeEnabled();
      await page.locator('.operations-source-details > summary').click();
      const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
      assert.ok(size.scroll <= size.width + 1, `Overflow: ${JSON.stringify(size)}`);
      const axe = await new AxeBuilder({ page }).include('[data-testid="operations-workspace-status"]').withTags(['wcag2a','wcag2aa']).analyze();
      const serious = axe.violations.filter(item => ['critical','serious'].includes(item.impact));
      await writeFile(`${folder}/axe-${width}.json`, JSON.stringify(axe.violations, null, 2));
      assert.deepEqual(serious.map(item => ({id:item.id,nodes:item.nodes.map(node=>node.target)})), []);
      await page.getByRole('link', { name: 'Reclamos', exact: true }).focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'operations-tickets');
      await page.getByRole('link', { name: 'Resumen', exact: true }).click();
      await page.getByTestId('operations-workspace-status').screenshot({ path: `${folder}/sources-${width}.png` });
      const initial = counts.heatmap;
      await page.evaluate(() => { for(let n=0;n<50;n++) window.dispatchEvent(new CustomEvent('qa-operations-event',{detail:{name:'ticket.updated',payload:{tenant_slug:'qa-operations'}}})); });
      await expect.poll(() => counts.heatmap).toBe(initial + 1);
      await page.waitForTimeout(350); assert.equal(counts.heatmap, initial + 1);
      const beforeHide = counts.heatmap;
      await page.evaluate(() => { Object.defineProperty(document,'hidden',{configurable:true,value:true}); document.dispatchEvent(new Event('visibilitychange')); for(let n=0;n<10;n++) window.dispatchEvent(new CustomEvent('qa-operations-event',{detail:{name:'ticket.updated',payload:{tenant_slug:'qa-operations'}}})); });
      await page.waitForTimeout(400); assert.equal(counts.heatmap, beforeHide);
      await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
      await expect.poll(() => counts.heatmap).toBe(beforeHide + 1);
      await expect(page.getByRole('button', { name: 'Actualizar', exact: true })).toBeEnabled();
      failMap = true;
      await page.getByRole('button', { name: 'Actualizar', exact: true }).click();
      await expect(page.getByText('Mapa temporalmente no disponible', { exact: true })).toBeVisible();
      await expect(page.getByTestId('qa-map')).toContainText('0 puntos');
      await expect(page.getByTestId('operations-workspace-status')).toContainText('con error');
      await page.getByTestId('operations-workspace-status').screenshot({ path: `${folder}/error-${width}.png` });
      assert.ok(methods.every(method => method === 'GET')); assert.deepEqual(errors, []);
      results.push({ width, height, dark, passed: true, burstEvents: 50, burstReadBatches: 1, hiddenTabReads: 0, seriousAxeViolations: serious.length, requestMethods: [...new Set(methods)] });
    } catch (error) {
      await page.screenshot({ path: `${folder}/failure-${width}.png`, fullPage: true }).catch(() => {});
      results.push({ width, height, dark, passed: false, error: error.message, errors, counts });
    } finally { await context.close(); }
  }
  const evidence = { syntheticData: true, productionBackend: false, realAuth: false, externalMapSubstituted: true, results };
  await writeFile(`${folder}/results.json`, JSON.stringify(evidence, null, 2)); console.log(JSON.stringify(evidence));
  assert.ok(results.every(result => result.passed), 'Operations workspace browser checks failed');
} finally { await browser?.close(); await server.close(); }
