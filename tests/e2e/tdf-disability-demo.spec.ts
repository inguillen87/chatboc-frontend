import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Vite dev does not execute Vercel rewrites. Target the physical HTML entry
// locally; remote smoke separately verifies the extensionless public URL.
const DEMO_PATH = '/demo/institucional/tdf-discapacidad/index.html';

const viewports = [
  { label: 'desktop', width: 1920, height: 1080 },
  { label: 'tablet', width: 1024, height: 768 },
  { label: 'iphone', width: 390, height: 844 },
  { label: 'android-compact', width: 360, height: 800 },
  { label: 'android-large', width: 412, height: 915 },
] as const;

test.describe('TDF disability institutional demo', () => {
  for (const viewport of viewports) {
    test(`${viewport.label} keeps the public experience responsive and isolated`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      const appRequests: string[] = [];
      page.on('request', (request) => {
        const url = new URL(request.url());
        if (/^\/(?:api|socket\.io)(?:\/|$)/.test(url.pathname)) {
          appRequests.push(url.pathname);
        }
      });

      await page.goto(DEMO_PATH, { waitUntil: 'domcontentloaded' });

      const demo = page.getByTestId('tdf-disability-demo');
      await expect(demo).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 })).toContainText(
        'Una puerta de entrada accesible',
      );
      await expect(page.getByText('Demostración conceptual · datos representativos').first()).toBeVisible();
      await expect(page.getByRole('tab')).toHaveCount(3);
      await expect(page.getByText('Catálogo de servicios accesible', { exact: true })).toBeAttached();
      await expect(page.getByText('Directorio accesible')).toBeVisible();
      await expect(page.locator('main#main-content')).toHaveCount(1);
      await expect(page.locator('body')).not.toContainText('Chatboc.ar');

      if (viewport.width < 1280) {
        await expect(page.getByRole('navigation', { name: 'Secciones de la demostración en móvil' })).toBeVisible();
      }

      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
      expect(appRequests, 'the conceptual demo must not call app APIs or realtime').toEqual([]);
    });
  }

  test('scenarios, map view and keyboard flow remain usable', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(DEMO_PATH, { waitUntil: 'domcontentloaded' });

    const firstTab = page.getByRole('tab', { name: 'Orientación CUD' });
    const secondTab = page.getByRole('tab', { name: 'Consulta RUPE' });
    await firstTab.focus();
    await page.keyboard.press('ArrowRight');
    await expect(secondTab).toBeFocused();
    await expect(secondTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('DEMO-DISC-0187')).toBeVisible();
    await expect(page.getByText('Captura compartida')).toBeVisible();

    await page.getByRole('button', { name: 'Hablar con una persona' }).click();
    await expect(page.getByText(/atención humana registrada/i)).toBeVisible();
    await page.getByRole('button', { name: 'Preparar transferencia' }).click();
    await expect(page.getByText(/Transferencia preparada: Persona DEMO/i)).toBeVisible();
    await page.getByRole('button', { name: 'Historial' }).click();
    await expect(page.getByText('Inspector de muestra: Historial.')).toBeVisible();
    await expect(page.getByTestId('crm-inspector-panel')).toContainText('Historial del caso');

    const geographicMap = page.getByRole('button', { name: 'Mapa geográfico' });
    await geographicMap.click();
    await expect(geographicMap).toHaveAttribute('aria-pressed', 'true');
    await expect(
      page.getByRole('region', {
        name: 'Mapa MapLibre de demanda conceptual y simulada en Tierra del Fuego',
      }),
    ).toBeVisible();

    await page.getByText('ARS 3.500.000–5.000.000 mensuales').scrollIntoViewIfNeeded();
    await expect(page.getByText('ARS 3.500.000–5.000.000 mensuales')).toBeVisible();
    await expect(page.getByRole('link', { name: /descargar propuesta PDF/i })).toHaveAttribute(
      'href',
      '/propuestas/propuesta-ejecutiva-agente-ia-discapacidad-tdf.pdf',
    );
  });

  test('mobile controls meet the promised touch target and accessibility preferences work', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(DEMO_PATH, { waitUntil: 'domcontentloaded' });

    for (const name of ['Para mí', 'Hablar con una persona', 'Tomar caso', 'Preparar transferencia', 'Cerrar + CSAT']) {
      const target = page.getByRole('button', { name });
      await target.scrollIntoViewIfNeeded();
      const box = await target.boundingBox();
      expect(box, `${name} must be measurable`).not.toBeNull();
      expect(box!.height, `${name} must be at least 44px high`).toBeGreaterThanOrEqual(44);
    }

    await page.getByRole('button', { name: 'Cerrar + CSAT' }).click();
    await expect(page.getByTestId('csat-close-step')).toBeVisible();
    const rating = page.getByRole('button', { name: '5 de 5' });
    const ratingBox = await rating.boundingBox();
    expect(ratingBox!.height).toBeGreaterThanOrEqual(44);
    expect(ratingBox!.width).toBeGreaterThanOrEqual(44);
    await rating.click();
    await expect(page.getByText(/Valoración de muestra registrada: 5 de 5/i)).toBeVisible();
    const openCsatDimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(openCsatDimensions.scrollWidth).toBeLessThanOrEqual(openCsatDimensions.clientWidth + 1);

    const accessibilityButton = page.getByRole('button', { name: 'Abrir preferencias de accesibilidad' });
    const accessibilityBox = await accessibilityButton.boundingBox();
    expect(accessibilityBox!.height).toBeGreaterThanOrEqual(44);
    expect(accessibilityBox!.width).toBeGreaterThanOrEqual(44);
    await accessibilityButton.click();
    const largeText = page.getByRole('button', { name: 'Texto grande' });
    await largeText.click();
    await expect(largeText).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('html')).toHaveClass(/tdf-demo-large-text/);

    const reduceMotion = page.getByRole('button', { name: 'Reducir movimiento' });
    await reduceMotion.click();
    await expect(reduceMotion).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('tdf-disability-demo')).toHaveAttribute('data-reduced-motion', 'true');
    const nextSectionHeading = page.locator('#atencion h2');
    await nextSectionHeading.scrollIntoViewIfNeeded();
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    const revealOpacity = await nextSectionHeading.evaluate((heading) =>
      getComputedStyle(heading.parentElement?.parentElement ?? heading).opacity,
    );
    expect(revealOpacity).toBe('1');
  });

  test('has no moderate, serious or critical axe violations after revealing the full page', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(DEMO_PATH, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('tdf-disability-demo')).toBeVisible();
    await page.evaluate(async () => {
      const step = Math.max(320, Math.round(window.innerHeight * 0.7));
      for (let position = 0; position < document.documentElement.scrollHeight; position += step) {
        window.scrollTo(0, position);
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    await expect(page.locator('footer')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include('[data-testid="tdf-disability-demo"]')
      .analyze();
    const blocking = results.violations.filter(
      (violation) =>
        violation.impact === 'moderate' ||
        violation.impact === 'serious' ||
        violation.impact === 'critical',
    );

    expect(
      blocking.map((violation) => ({
        id: violation.id,
        nodes: violation.nodes.map((node) => ({
          target: node.target,
          summary: node.failureSummary,
        })),
      })),
    ).toEqual([]);
  });
});
