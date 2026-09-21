import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const server = await createServer({ cacheDir: '.vercel/survey-card-cache', server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
let browser;
const results = [];
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  await mkdir('test-evidence/survey-card', { recursive: true });
  browser = await chromium.launch(process.platform === 'win32' ? { channel: 'chrome', headless: true } : { headless: true });
  for (const [width, mode] of [[1440, 'live'], [820, 'draft'], [390, 'live'], [320, 'draft']]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [], apiRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.method()); });
    await page.goto(origin + '/tests/e2e/fixtures/survey-card-actions.html');
    if (width === 390) await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.evaluate(mode => window.surveyCardAcceptance.configure({ mode }), mode);
    const action = mode === 'live' ? 'Cerrar participación' : 'Borrar borrador';
    const confirmation = mode === 'live' ? 'Cerrar definitivamente' : 'Eliminar';
    await page.getByRole('button', { name: action, exact: true }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.evaluate(() => window.surveyCardAcceptance.configure({ tenant: 'tenant-b', revision: 1 }));
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    assert.deepEqual(await page.evaluate(() => window.surveyCardAcceptance.counts()), { close: 0, delete: 0 });
    await page.evaluate(() => window.surveyCardAcceptance.configure({ tenant: 'tenant-a', revision: 0 }));
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await page.getByRole('button', { name: action, exact: true }).click();
    await page.evaluate(() => window.surveyCardAcceptance.configure({ allowed: false }));
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await page.evaluate(() => window.surveyCardAcceptance.configure({ allowed: true }));
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    const trigger = page.getByRole('button', { name: action, exact: true });
    await expect(trigger).toBeEnabled();
    const bounds = await trigger.boundingBox();
    assert.ok(bounds && bounds.height >= 44, 'Card actions must provide a touch target');
    await trigger.focus(); await page.keyboard.press('Enter');
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    const appearance = await dialog.evaluate(element => {
      const style = getComputedStyle(element);
      return { opacity: style.opacity, animation: style.animationName, background: style.backgroundColor,
        overflowY: style.overflowY, buttonHeights: [...element.querySelectorAll('button')].map(b => b.getBoundingClientRect().height) };
    });
    assert.equal(appearance.opacity, '1', 'Reduced-motion confirmation must be fully opaque');
    assert.equal(appearance.animation, 'none', 'Portal must also respect reduced motion');
    assert.match(appearance.background, /^rgb\([^/]+\)$/, 'Dialog surface must be opaque');
    assert.ok(appearance.buttonHeights.every(height => height >= 44), 'Confirmation actions must be touch accessible');
    const modal = await dialog.boundingBox();
    assert.ok(modal && modal.x >= 15 && modal.x + modal.width <= width - 15, 'Modal must fit with safe horizontal space');
    assert.ok(modal.y >= 15 && modal.y + modal.height <= 885, 'Modal must fit vertically');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `test-evidence/survey-card/confirmation-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: confirmation, exact: true }).evaluate(button => { button.click(); button.click(); });
    const status = mode === 'live' ? 'Cerrando…' : 'Borrando…';
    await expect(dialog.getByRole('button', { name: status, exact: true })).toBeDisabled();
    await expect.poll(() => page.evaluate(() => window.surveyCardAcceptance.counts())).toEqual(
      mode === 'live' ? { close: 1, delete: 0 } : { close: 0, delete: 1 });
    await page.evaluate(() => window.surveyCardAcceptance.complete());
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    assert.deepEqual(errors, []); assert.deepEqual(apiRequests, []);
    await page.screenshot({ path: `test-evidence/survey-card/card-${width}.png`, fullPage: true });
    results.push({ width, mode, syntheticCallbackInvocations: 1, outdatedDialogsRemoved: true, touchTarget: true,
      opaqueConfirmation: true, reducedMotionRespected: true, modalFitsViewport: true, apiRequests: 0 });
    await context.close();
  }
  const report = { realSurveyCardAndHook: true, syntheticDataAndHandlers: true, serverAcceptance: false, results };
  await writeFile('test-evidence/survey-card/results.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await browser?.close(); await server.close(); }
