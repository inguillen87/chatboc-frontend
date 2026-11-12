import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium, expect} from '@playwright/test';

// This local synthetic DOM reproduces the reader's sources control. It uses
// the shipped CSS sources and Tailwind's real preflight without a Vite build,
// provider requests, screenshots, or media.
const source = path => readFile(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
// An explicit local Git ref allows the same checks to reproduce a regression
// before its correction, without replacing any worktree file.
const cssRef = process.argv.find(argument => argument.startsWith('--css-ref='))?.slice('--css-ref='.length);
const globalCss = cssRef
  ? execFileSync('git', ['show', `${cssRef}:src/index.css`], {cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8'})
  : await source('../src/index.css');
const css = (await Promise.all([
  source('../node_modules/tailwindcss/lib/css/preflight.css'),
  globalCss,
  source('../src/components/chat/institutionalChatMessage.css'),
])).join('\n');
const luminance = color => {
  const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
    const channel = value / 255;
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  });
  return channels.reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
};
const contrast = (first, second) => {
  const a = luminance(first), b = luminance(second);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
};
const browser = await chromium.launch({headless: true});
const results = [], lowContrast = [];
try {
  for (const width of [320, 1440]) {
    for (const mode of ['', 'a11y-high-contrast', 'dark', 'dark a11y-high-contrast']) {
      const page = await browser.newPage({viewport: {width, height: 740}});
      try {
        // Font imports in index.css are intentionally blocked. No network
        // request is permitted by this CSS/keyboard regression fixture.
        await page.route('**/*', route => route.abort());
        await page.setContent(`<html class="${mode}"><body><main class="chat-root">
          <div class="institutional-chat-message">
            <button type="button" class="institutional-chat-message__text-size" aria-pressed="false">Texto más grande</button>
            <article><h3 tabindex="-1">Menú sintético</h3><p>Respuesta de prueba</p>
              <details class="institutional-chat-message__sources"><summary>Fuentes y revisión</summary>
                <section><h4>Fuente sintética</h4><a href="#reference">Referencia de prueba</a></section>
              </details>
            </article>
          </div>
        </main></body></html>`);
        await page.addStyleTag({content: css});
        await page.keyboard.press('Tab');
        await expect(page.getByRole('button', {name: 'Texto más grande'})).toBeFocused();
        await page.keyboard.press('Tab');
        const summary = page.locator('summary');
        await expect(summary).toBeFocused();
        const focus = await summary.evaluate(element => {
          const style = getComputedStyle(element);
          return {
            visible: element.matches(':focus-visible'),
            outlineColor: style.outlineColor,
            outlineStyle: style.outlineStyle,
            outlineWidth: parseFloat(style.outlineWidth),
            surfaceColor: getComputedStyle(element.closest('.institutional-chat-message')).backgroundColor,
            overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          };
        });
        const ratio = contrast(focus.outlineColor, focus.surfaceColor);
        const label = `${width}px ${mode || 'light'}`;
        assert.equal(focus.visible, true, `${label}: keyboard focus must remain visible`);
        assert.equal(focus.outlineStyle, 'solid', `${label}: focus outline must be drawn`);
        assert.ok(focus.outlineWidth >= 2, `${label}: focus outline must be at least 2px`);
        if (ratio < 3) lowContrast.push(`${label}: ${ratio.toFixed(2)}:1 is below 3:1`);
        assert.equal(focus.overflow, false, `${label}: reader must fit the viewport`);
        await page.keyboard.press('Enter');
        await expect(page.locator('details')).toHaveAttribute('open', '');
        await page.keyboard.press('Tab');
        await expect(page.getByRole('link', {name: 'Referencia de prueba'})).toBeFocused();
        results.push({width, mode: mode || 'light', ratio: Number(ratio.toFixed(3)), ...focus});
      } finally {
        await page.close();
      }
    }
  }
  console.log(JSON.stringify({synthetic: true, cssSource: true, cssRef: cssRef || 'worktree', results}, null, 2));
  assert.deepEqual(lowContrast, [], 'Every keyboard focus indicator must reach 3:1 against its surface');
} finally {
  await browser.close();
}
