import { test, expect } from '@playwright/test';
import { expectNoHorizontalOverflow } from './e2e-helpers';

test.use({ screenshot: 'only-on-failure' });

test('el encabezado conserva nombre y herramientas en ventanas estrechas', async ({ page }, testInfo) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  // Layout-only test: never send a message or read a tenant's real records.
  await page.route(/^https?:\/\/[^/]+\/(?:api\/|ask(?:\/|\?|$))/, async route => {
    const path = new URL(route.request().url()).pathname;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(path.endsWith('/auth/clerk/config') ? { enabled: false } : {}),
    });
  });
  const title = 'Asistente de atención ciudadana';
  for (const width of [420, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`/iframe?${new URLSearchParams({ defaultOpen: '1', welcomeTitle: title, openWidth: String(width), openHeight: '780' })}`);
    const options = page.getByRole('button', { name: 'Opciones del chat', exact: true });
    await expect(options).toBeVisible();
    const titleLabel = page.getByTitle(title, { exact: true });
    await expect(titleLabel, `Runtime errors: ${runtimeErrors.join('; ')}`).toBeVisible();
    await expect.poll(async () => (await titleLabel.boundingBox())?.width ?? 0).toBeGreaterThan(90);
    expect(await titleLabel.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await options.click();
    await expect(page.getByRole('menuitem', { name: /sonido/i })).toBeVisible();
    const menu = page.getByRole('menu');
    const menuBox = await menu.boundingBox();
    expect(menuBox?.x).toBeGreaterThanOrEqual(0);
    expect((menuBox?.x ?? 0) + (menuBox?.width ?? 0)).toBeLessThanOrEqual(width + 1);
    await page.screenshot({ path: testInfo.outputPath(`widget-menu-${width}.png`) });
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(options).toBeFocused();
    await expect(page.getByRole('button', { name: 'Cerrar chat' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
  expect(runtimeErrors).toEqual([]);
});
