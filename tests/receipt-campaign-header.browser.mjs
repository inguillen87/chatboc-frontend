import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';

const folder = process.env.RECEIPT_CAMPAIGN_EVIDENCE;
if (!folder || !path.isAbsolute(folder)) throw new Error('Set an absolute evidence directory outside Git');
const pngPath = process.env.RECEIPT_CAMPAIGN_FIXTURE_PNG;
if (!pngPath || !path.isAbsolute(pngPath)) throw new Error('Set the existing public bundled PNG fixture path');
const png = await readFile(pngPath);
assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
const pinFiles = ['src/components/profile/ReceiptCampaignHeader.tsx', 'src/components/ui/input.tsx',
  'src/components/ui/button.tsx', 'src/components/ui/label.tsx', 'src/index.css',
  'tests/e2e/fixtures/receipt-campaign-header.tsx', 'tests/e2e/fixtures/receipt-campaign-header.html'];
const pins = Object.fromEntries(await Promise.all(pinFiles.map(async file =>
  [file, createHash('sha256').update(await readFile(file)).digest('hex')])));
const server = await createServer({ configFile: false, plugins: [react()],
  cacheDir: path.join(folder, 'vite-cache'),
  optimizeDeps: { entries: ['tests/e2e/fixtures/receipt-campaign-header.html'] },
  resolve: { alias: { '@': path.resolve('src') } },
  server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
let browser;
const results = [];
const imageUrl = 'https://assets.example.test/campaign.png';
const brokenUrl = 'https://assets.example.test/not-found.png';
const overflow = page => page.evaluate(() => ({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth }));

try {
  await mkdir(folder, { recursive: true });
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true });
  for (const { width, theme } of [{ width: 390, theme: 'dark' }, { width: 1440, theme: 'light' }]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme,
      reducedMotion: 'reduce', serviceWorkers: 'block' });
    const mutations = [], imageRequests = [], externalBlocked = [], pageErrors = [];
    let failNextSave = false;
    await context.route('**/*', async route => {
      const request = route.request(); const url = new URL(request.url());
      if (request.url() === imageUrl) { imageRequests.push('campaign'); return route.fulfill({ contentType: 'image/png', body: png }); }
      if (request.url() === brokenUrl) { imageRequests.push('not-found'); return route.fulfill({ status: 404, body: '' }); }
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      if (url.origin !== origin) { externalBlocked.push(url.origin); return route.abort(); }
      if (url.pathname === '/__fixture/receipt-profile' && request.method() === 'PUT') {
        mutations.push(request.postDataJSON());
        const fail = failNextSave; failNextSave = false;
        return route.fulfill({ status: fail ? 503 : 200, contentType: 'application/json',
          body: JSON.stringify({ ok: !fail, synthetic: true }) });
      }
      if (request.method() !== 'GET' || url.pathname.startsWith('/api/')) {
        externalBlocked.push(`${request.method()} ${url.pathname}`); return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(origin + '/tests/e2e/fixtures/receipt-campaign-header.html');
    await page.evaluate(theme => document.documentElement.classList.toggle('dark', theme === 'dark'), theme);
    const select = page.getByLabel('Imagen en los comprobantes');
    const input = page.getByLabel('URL pública de la imagen');
    const save = page.getByRole('button', { name: 'Guardar configuración' });
    await expect(select).toHaveValue('inherit');
    await page.keyboard.press('Tab'); await expect(select).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(select).toHaveValue('image'); await expect(input).toBeVisible();
    await page.keyboard.press('Tab'); await expect(input).toBeFocused();
    await page.keyboard.type(imageUrl);
    const preview = page.getByAltText('Vista previa de la cabecera del comprobante');
    await expect(preview).toBeVisible();
    await expect.poll(() => preview.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    const dimensions = await preview.evaluate(image => ({ width: image.naturalWidth, height: image.naturalHeight }));
    await page.keyboard.press('Tab'); await expect(save).toBeFocused();
    const focusStyle = await save.evaluate(button => ({ shadow: getComputedStyle(button).boxShadow,
      outline: getComputedStyle(button).outlineStyle }));
    assert.ok(focusStyle.shadow !== 'none' || focusStyle.outline !== 'none', 'Save keyboard focus must be visible');
    await page.keyboard.press('Enter'); await expect(page.getByRole('status').filter({ hasText: 'Configuración guardada.' })).toBeVisible();
    assert.deepEqual(mutations[0].organization_profile.whatsapp_receipt_header, { enabled: true, image_url: imageUrl });
    const size = await overflow(page); assert.ok(size.scrollWidth <= width + 1, 'No horizontal overflow with preview');
    await page.screenshot({ path: path.join(folder, `${width}-${theme}-campaign.png`), fullPage: true });
    const axe = await new AxeBuilder({ page }).include('#fixture').analyze();
    assert.deepEqual(axe.violations.map(item => ({ id: item.id, impact: item.impact })), [], 'No scoped axe violations');

    await select.focus(); await select.press('End'); await expect(select).toHaveValue('disabled');
    await expect(input).toHaveCount(0); await select.press('Tab'); await expect(save).toBeFocused();
    await save.press('Enter'); await expect.poll(() => mutations.length).toBe(2);
    assert.deepEqual(mutations[1].organization_profile.whatsapp_receipt_header, { enabled: false, image_url: '' });
    await select.focus(); await select.press('Home'); await expect(select).toHaveValue('inherit');
    await select.press('Tab'); await save.press('Enter'); await expect.poll(() => mutations.length).toBe(3);
    assert.equal(mutations[2].organization_profile.whatsapp_receipt_header, null);

    await select.focus(); await select.press('ArrowDown'); await input.fill('http://assets.example.test/private.svg');
    await save.press('Enter'); await expect(page.getByRole('alert')).toContainText('URL pública HTTPS válida');
    assert.equal(mutations.length, 3, 'Invalid URL must not submit');
    await expect(preview).toHaveCount(0);
    await input.fill(brokenUrl); await expect(page.getByRole('status').filter({ hasText: 'No pudimos cargar' })).toBeVisible();
    await page.screenshot({ path: path.join(folder, `${width}-${theme}-preview-unavailable.png`), fullPage: true });
    await input.fill(imageUrl); await expect(preview).toBeVisible();
    failNextSave = true;
    await save.press('Enter'); await expect(page.getByRole('alert')).toContainText('Guardado sin confirmar');
    await expect(input).toHaveValue(imageUrl);
    await page.waitForTimeout(150);
    assert.equal(mutations.length, 4, 'No automatic retry during observed unconfirmed interval');
    await save.press('Enter'); await expect.poll(() => mutations.length).toBe(5);
    await expect(page.getByRole('status').filter({ hasText: 'Configuración guardada.' })).toBeVisible();
    const finalSize = await overflow(page); assert.ok(finalSize.scrollWidth <= width + 1);
    assert.deepEqual(pageErrors, []); assert.deepEqual(externalBlocked, []);
    results.push({ width, theme, keyboard: true, preview: dimensions, focusStyle, mutationCount: mutations.length,
      imageRequests, axeViolations: axe.violations.length, overflow: size, finalOverflow: finalSize,
      realComponent: true, profilePage: false, syntheticIdentityAndTransport: true,
      externalFontCssReplacedWithEmptyFixture: true });
    await context.close();
  }
  const after = Object.fromEntries(await Promise.all(pinFiles.map(async file =>
    [file, createHash('sha256').update(await readFile(file)).digest('hex')])));
  assert.deepEqual(after, pins, 'Component, CSS and fixture source must remain unchanged throughout the run');
  await writeFile(path.join(folder, 'result.actual.json'), JSON.stringify({ observedAt: new Date().toISOString(),
    sourceSha256: pins, publicPngSha256: createHash('sha256').update(png).digest('hex'), results,
    productionOwnerSession: false, providerDeliveryVerified: false, fullBuildPerformed: false }, null, 2));
  console.log(JSON.stringify({ passedScenarios: results.length, folder, widths: results.map(item => item.width),
    axeViolations: results.map(item => item.axeViolations) }));
} catch (error) {
  await writeFile(path.join(folder, 'failure.actual.json'), JSON.stringify({ errorType: error.name,
    message: error.message, completedScenarios: results, sourceSha256: pins }, null, 2));
  throw error;
} finally { await browser?.close(); await server.close(); }
