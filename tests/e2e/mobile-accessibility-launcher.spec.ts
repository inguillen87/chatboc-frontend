import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page, type Route } from '@playwright/test';

const MOBILE_VIEWPORTS = [
  { name: '390px', width: 390, height: 844 },
  { name: '412px', width: 412, height: 915 },
] as const;

const ADMIN_USER = {
  id: 'mobile-navigation-admin',
  name: 'Administrador municipal',
  nombre: 'Administrador municipal',
  email: 'admin@example.com',
  rol: 'tenant_admin',
  role: 'tenant_admin',
  tipo_chat: 'municipio',
  rubro: 'municipio',
  tenantSlug: 'municipio-demo',
  tenant_slug: 'municipio-demo',
};

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const mockLandingApis = async (page: Page) => {
  await page.routeWebSocket('**/socket.io/**', (socket) => socket.close());
  await page.route('**/*', async (route) => {
    const request = route.request();
    if (!['fetch', 'xhr'].includes(request.resourceType())) {
      await route.continue();
      return;
    }

    const path = new URL(request.url()).pathname.toLowerCase();
    if (path.endsWith('/auth/clerk/config')) {
      await json(route, { enabled: false, publishable_key: '', social_providers: [] });
      return;
    }
    if (path === '/api/me' || path === '/me') {
      await json(route, ADMIN_USER);
      return;
    }
    if (path.includes('/pwa/public/tenant-info')) {
      await json(route, { slug: 'chatboc-platform', nombre: 'Chatboc', tipo: 'pyme' });
      return;
    }
    if (path === '/api/public/widget-config') {
      await json(route, {
        contract_version: 'public.widget_config.v1',
        tenant: { slug: 'chatboc-platform', nombre: 'Chatboc' },
        quick_menu: [],
        support_channels: {},
      });
      return;
    }

    await json(route, {});
  });
};

const installAdminSession = (page: Page) =>
  page.addInitScript((user) => {
    window.localStorage.setItem('authToken', 'mobile-navigation-e2e-token');
    window.localStorage.setItem('user', JSON.stringify(user));
    window.localStorage.setItem('tenantSlug', 'municipio-demo');
  }, ADMIN_USER);

const dispatchInstallPrompt = (page: Page) =>
  page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.defineProperties(event, {
      prompt: { value: async () => undefined },
      userChoice: {
        value: Promise.resolve({ outcome: 'dismissed', platform: 'playwright' }),
      },
    });
    window.dispatchEvent(event);
  });

const rect = async (locator: Locator) => {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
};

const boxesOverlap = (
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number },
) =>
  first.x < second.x + second.width &&
  first.x + first.width > second.x &&
  first.y < second.y + second.height &&
  first.y + first.height > second.y;

const expectNoHighImpactAccessibilityViolations = async (page: Page) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .exclude('iframe[src*="challenges.cloudflare.com"]')
    .analyze();
  const summaries = results.violations
    .filter((violation) => violation.impact === 'critical' || violation.impact === 'serious')
    .map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.length})`);

  expect(summaries, summaries.join('\n')).toEqual([]);
};

const expectMenuTargetsHitTestable = async (mobileMenu: Locator) => {
  const targets = mobileMenu.locator('a[href], button:not([disabled])');
  const count = await targets.count();
  expect(count).toBeGreaterThanOrEqual(16);

  for (let index = 0; index < count; index += 1) {
    const target = targets.nth(index);
    await target.scrollIntoViewIfNeeded();
    const hitTest = await target.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const x = Math.min(window.innerWidth - 1, Math.max(0, box.left + box.width / 2));
      const y = Math.min(window.innerHeight - 1, Math.max(0, box.top + box.height / 2));
      const hit = document.elementFromPoint(x, y);
      return {
        hit: hit === element || element.contains(hit),
        label: element.getAttribute('aria-label') || element.textContent?.trim() || element.tagName,
      };
    });

    expect(hitTest.hit, `${hitTest.label} must own its visual hit target`).toBe(true);
  }
};

test.describe('mobile accessibility launcher coordination', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await mockLandingApis(page);
  });

  for (const viewport of MOBILE_VIEWPORTS) {
    test(`${viewport.name} keeps a long admin menu, launcher and PWA prompt independently usable`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await installAdminSession(page);
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: /Converti conversaciones en operaciones reales/i })).toBeVisible();

      const installPrompt = page.getByRole('complementary', { name: 'Instalar Chatboc' });
      await expect(async () => {
        await dispatchInstallPrompt(page);
        await expect(installPrompt).toBeVisible({ timeout: 500 });
      }).toPass({ timeout: 5_000 });

      const menuButton = page.getByRole('button', { name: 'Abrir menú' });
      await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
      await menuButton.click();

      const closeButton = page.getByRole('button', { name: 'Cerrar menú' });
      const mobileMenu = page.getByRole('navigation', { name: 'Navegación principal móvil' });
      const firstItem = mobileMenu.getByRole('button', { name: 'Problemas' });
      const launcher = page.getByRole('button', { name: 'Abrir ajustes de accesibilidad' });
      await expect(closeButton).toHaveAttribute('aria-expanded', 'true');
      await expect(firstItem).toBeVisible();
      await expect(launcher).toBeVisible();

      await expect(installPrompt).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Instalar' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Cerrar aviso de instalación' })).toHaveCount(0);

      const [menuBox, firstItemBox, launcherBox, closeButtonBox] = await Promise.all([
        rect(mobileMenu),
        rect(firstItem),
        rect(launcher),
        rect(closeButton),
      ]);

      expect(boxesOverlap(launcherBox, menuBox)).toBe(false);
      expect(boxesOverlap(launcherBox, firstItemBox)).toBe(false);
      expect(boxesOverlap(launcherBox, closeButtonBox)).toBe(false);
      expect(launcherBox.x).toBeGreaterThanOrEqual(0);
      expect(launcherBox.x + launcherBox.width).toBeLessThanOrEqual(viewport.width);

      await closeButton.focus();
      await page.keyboard.press('Tab');
      await expect(firstItem).toBeFocused();
      await expectMenuTargetsHitTestable(mobileMenu);
      await mobileMenu.evaluate((element) => {
        element.scrollTop = 0;
      });

      const layout = await page.evaluate(() => ({
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        launcherTransition: getComputedStyle(
          document.querySelector<HTMLButtonElement>('.chatboc-a11y-dock__button')!,
        ).transitionDuration,
      }));
      expect(layout.documentWidth).toBe(layout.viewportWidth);
      expect(parseFloat(layout.launcherTransition)).toBeLessThanOrEqual(0.001);

      await expectNoHighImpactAccessibilityViolations(page);
      await testInfo.attach(`mobile-menu-${viewport.name}`, {
        body: await page.screenshot({ fullPage: false }),
        contentType: 'image/png',
      });

      await page.keyboard.press('Escape');
      await expect(mobileMenu).toBeHidden();
      await expect(menuButton).toBeFocused();
      await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
      await expect(installPrompt).toBeVisible();

      const [restoredPromptBox, restoredLauncherBox] = await Promise.all([
        rect(installPrompt),
        rect(launcher),
      ]);
      expect(boxesOverlap(restoredPromptBox, restoredLauncherBox)).toBe(false);
      await expectNoHighImpactAccessibilityViolations(page);
    });
  }

  test('clears the mobile overlay across desktop resize boundaries without restoring ghost state', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installAdminSession(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Converti conversaciones en operaciones reales/i })).toBeVisible();

    const installPrompt = page.getByRole('complementary', { name: 'Instalar Chatboc' });
    await expect(async () => {
      await dispatchInstallPrompt(page);
      await expect(installPrompt).toBeVisible({ timeout: 500 });
    }).toPass({ timeout: 5_000 });

    const menuButton = page.getByRole('button', { name: 'Abrir menú' });
    const brandHomeButton = page.getByRole('button', { name: 'Ir al inicio de Chatboc' });
    await menuButton.click();
    await expect(page.locator('body')).toHaveClass(/chatboc-mobile-menu-open/);
    await expect(installPrompt).toHaveCount(0);

    await page.setViewportSize({ width: 844, height: 390 });
    await expect(menuButton).toBeHidden();
    await expect(page.locator('body')).not.toHaveClass(/chatboc-mobile-menu-open/);
    await expect(installPrompt).toBeVisible();
    await expect(brandHomeButton).toBeFocused();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(menuButton).toBeVisible();
    await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('navigation', { name: 'Navegación principal móvil' })).toHaveCount(0);
    await expect(page.locator('body')).not.toHaveClass(/chatboc-mobile-menu-open/);
    await expect(installPrompt).toBeVisible();

    await menuButton.click();
    await expect(page.locator('body')).toHaveClass(/chatboc-mobile-menu-open/);
    await expect(installPrompt).toHaveCount(0);
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator('body')).not.toHaveClass(/chatboc-mobile-menu-open/);
    await expect(installPrompt).toBeVisible();
    await expect(brandHomeButton).toBeFocused();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(menuButton).toBeVisible();
    await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('body')).not.toHaveClass(/chatboc-mobile-menu-open/);
    await expect(installPrompt).toBeVisible();
  });

  test('desktop keeps the launcher and PWA prompt clear of the navigation', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Converti conversaciones en operaciones reales/i })).toBeVisible();

    const menuButton = page.getByRole('button', { name: 'Abrir menú' });
    const launcher = page.getByRole('button', { name: 'Abrir ajustes de accesibilidad' });
    const desktopNavigation = page.getByRole('navigation').first();
    await expect(menuButton).toBeHidden();
    await expect(launcher).toBeVisible();
    await expect(desktopNavigation).toBeVisible();

    await dispatchInstallPrompt(page);
    const installPrompt = page.getByRole('complementary', { name: 'Instalar Chatboc' });
    await expect(installPrompt).toBeVisible();

    const [launcherBox, navigationBox, installPromptBox] = await Promise.all([
      rect(launcher),
      rect(desktopNavigation),
      rect(installPrompt),
    ]);
    expect(boxesOverlap(launcherBox, navigationBox)).toBe(false);
    expect(boxesOverlap(launcherBox, installPromptBox)).toBe(false);

    const layout = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
    }));
    expect(layout.documentWidth).toBe(layout.viewportWidth);
    await expectNoHighImpactAccessibilityViolations(page);
    await testInfo.attach('desktop-navigation', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png',
    });
  });

});
