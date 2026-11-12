import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const folder = process.env.ALERT_CONTRAST_EVIDENCE || '.vercel/alert-contrast-evidence';
const server = await createServer({
  configFile: false, plugins: [react()], cacheDir: '.vercel/alert-contrast-cache',
  optimizeDeps: { entries: ['tests/e2e/fixtures/alert-contrast.html'] },
  resolve: { alias: [
    { find: '@/services/analyticsService', replacement: path.resolve('tests/e2e/fixtures/alert-contrast.transport.ts') },
    { find: '@', replacement: path.resolve('src') },
  ] },
  server: { host: '127.0.0.1', port: 0 }, logLevel: 'error',
});
let browser;
const results = [];
try {
  await mkdir(folder, { recursive: true });
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true });
  for (const width of [320, 1440]) for (const theme of ['light', 'dark', 'light-hc', 'dark-hc']) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const unexpected = [], forbidden = [];
    await context.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== origin) return route.abort();
      if (request.method() !== 'GET' || url.pathname.startsWith('/api/')) {
        forbidden.push(`${request.method()} ${url.pathname}`); return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', error => unexpected.push(error.message));
    try {
      await page.goto(origin + '/tests/e2e/fixtures/alert-contrast.html');
      await page.evaluate(theme => {
        document.documentElement.classList.toggle('dark', theme.startsWith('dark'));
        document.documentElement.classList.toggle('a11y-high-contrast', theme.endsWith('-hc'));
      }, theme);
      await expect(page.getByRole('alert')).toHaveCount(4);
      await expect(page.getByText('Alerta de Identidad en WhatsApp')).toBeVisible();
      // The real Button transitions colors for 150ms after a theme/state change.
      await page.waitForTimeout(200);
      const readMetrics = () => page.evaluate(() => {
        const parse = value => {
          const match = value.match(/^rgba?\(([^)]+)\)$/);
          if (!match) throw new Error(`Unsupported computed color: ${value}`);
          const numbers = match[1].split(/[\s,\/]+/).map(Number);
          if (numbers.length < 3 || numbers.some(n => !Number.isFinite(n))) throw new Error('Invalid color');
          return [...numbers.slice(0, 3), numbers[3] ?? 1];
        };
        const composite = (fg, bg) => fg.slice(0, 3).map((value, i) => value * fg[3] + bg[i] * (1 - fg[3]));
        const luminance = color => color.map(value => { const s = value / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
        const ratio = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
        const measure = element => {
          const ancestors = []; let ancestor = element;
          while (ancestor) { ancestors.unshift(ancestor); ancestor = ancestor.parentElement; }
          let background = [255, 255, 255];
          for (const item of ancestors) {
            const style = getComputedStyle(item);
            if (style.opacity !== '1' || style.backgroundImage !== 'none') throw new Error('Unsupported compositing model');
            background = composite(parse(style.backgroundColor), background);
          }
          const style = getComputedStyle(element), color = composite(parse(style.color), background);
          return { text: element.textContent.trim(), color, background, contrast: ratio(color, background), size: style.fontSize };
        };
        return {
          texts: [...document.querySelectorAll('[data-contrast-text], [data-case="identity"] h5, [data-case="identity"] [role="alert"] > div, [role="alert"] button')].map(measure),
          icons: [...document.querySelectorAll('[role="alert"] > svg')].map(measure),
          body: { background: getComputedStyle(document.body).backgroundColor, color: getComputedStyle(document.body).color },
          highContrastClass: document.documentElement.classList.contains('a11y-high-contrast'),
          width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
        };
      });
      const metrics = await readMetrics();
      await page.screenshot({ path: `${folder}/${width}-${theme}.png`, fullPage: true });
      assert.equal(metrics.texts.length, 6, 'Every text/identity/retry scenario must be measured');
      assert.equal(metrics.icons.length, 4);
      assert.equal(metrics.highContrastClass, theme.endsWith('-hc'));
      assert.notEqual(metrics.body.background, 'rgba(0, 0, 0, 0)', 'Real theme CSS must be loaded');
      assert.ok(metrics.scrollWidth <= width + 1, 'Document must not scroll horizontally');
      for (const item of metrics.texts) assert.ok(item.contrast >= 4.5, `${item.text}: ${item.contrast.toFixed(4)}:1`);
      for (const item of metrics.icons) assert.ok(item.contrast >= 3, `Essential icon: ${item.contrast.toFixed(4)}:1`);
      const retry = page.getByRole('button', { name: 'Reintentar analíticas' });
      await retry.focus(); await expect(retry).toBeFocused();
      await page.waitForTimeout(200);
      metrics.focusedRetry = (await readMetrics()).texts.find(item => item.text === 'Reintentar analíticas');
      assert.ok(metrics.focusedRetry.contrast >= 4.5, 'Focused retry contrast');
      await retry.hover(); await page.waitForTimeout(200);
      metrics.hoveredRetry = (await readMetrics()).texts.find(item => item.text === 'Reintentar analíticas');
      assert.ok(metrics.hoveredRetry.contrast >= 4.5, 'Hovered retry contrast');
      assert.deepEqual(unexpected, []); assert.deepEqual(forbidden, []);
      results.push({ width, theme, passed: true, metrics });
    } catch (error) {
      results.push({ width, theme, passed: false, reason: error.message, unexpected, forbidden });
    } finally { await context.close(); }
  }
  const report = { realComponents: ['Alert', 'IdentityCoverageBanner', 'Button'], representativeConsumerStyles: true, realCss: true, syntheticAnalytics: true, productionData: false, results };
  await writeFile(`${folder}/results.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  assert.ok(results.every(result => result.passed), 'Alert contrast browser validation failed');
} finally { await browser?.close(); await server.close(); }
