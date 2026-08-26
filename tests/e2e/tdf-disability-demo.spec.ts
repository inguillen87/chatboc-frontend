import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

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

const interactiveRequestTypes = new Set(['fetch', 'xhr', 'eventsource', 'ping']);
const safeReadMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
const applicationEndpointPattern = /^\/(?:api|socket\.io|graphql|ws)(?:\/|$)/i;
const mapAssetHostPattern = /(?:^|\.)(?:cartocdn\.com|maplibre\.org|maptiler\.com|openstreetmap\.org|stadiamaps\.com)$/i;

type NetworkAudit = {
  backendRequests: string[];
  mutationRequests: string[];
  realtimeConnections: string[];
};

const captureNetworkAudit = (page: Page): NetworkAudit => {
  const audit: NetworkAudit = {
    backendRequests: [],
    mutationRequests: [],
    realtimeConnections: [],
  };
  let documentOrigin: string | null = null;

  page.on('request', (request) => {
    const url = new URL(request.url());
    const method = request.method().toUpperCase();
    const resourceType = request.resourceType();

    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      documentOrigin = url.origin;
    }

    if (!safeReadMethods.has(method)) {
      audit.mutationRequests.push(`${method} ${url.href}`);
    }

    const allowedMapAsset = mapAssetHostPattern.test(url.hostname);
    const localGeneratedAsset = url.protocol === 'blob:' || url.protocol === 'data:';
    const sameOrigin = documentOrigin !== null && url.origin === documentOrigin;
    const looksLikeApplicationEndpoint = applicationEndpointPattern.test(url.pathname);
    const isInteractiveRequest = interactiveRequestTypes.has(resourceType);

    if (
      !allowedMapAsset &&
      !localGeneratedAsset &&
      ((sameOrigin && (looksLikeApplicationEndpoint || isInteractiveRequest)) ||
        (!sameOrigin && isInteractiveRequest))
    ) {
      audit.backendRequests.push(`${resourceType} ${method} ${url.href}`);
    }
  });

  page.on('websocket', (socket) => {
    const url = new URL(socket.url());
    // Vite's root HMR socket is development infrastructure. Application
    // realtime connections use an explicit API/socket path and are forbidden.
    if (applicationEndpointPattern.test(url.pathname)) {
      audit.realtimeConnections.push(url.href);
    }
  });

  return audit;
};

const expectNoBackendTraffic = (audit: NetworkAudit) => {
  expect(
    audit.backendRequests,
    'the conceptual Faro demo must not call an application backend',
  ).toEqual([]);
  expect(
    audit.mutationRequests,
    'the conceptual Faro demo must never mutate remote state',
  ).toEqual([]);
  expect(
    audit.realtimeConnections,
    'the conceptual Faro demo must not open application realtime connections',
  ).toEqual([]);
};

const expectNoHorizontalOverflow = async (page: Page) => {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
};

const expectTouchTarget = async (target: Locator, label: string) => {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  expect(box, `${label} must be measurable`).not.toBeNull();
  expect(box!.height, `${label} must be at least 44px high`).toBeGreaterThanOrEqual(44);
  expect(box!.width, `${label} must be at least 44px wide`).toBeGreaterThanOrEqual(44);
  await target.click({ trial: true });
};

test.describe('Faro TDF disability institutional demo', () => {
  for (const viewport of viewports) {
    test(`${viewport.label} keeps the public experience responsive, truthful and isolated`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const networkAudit = captureNetworkAudit(page);

      await page.goto(DEMO_PATH, { waitUntil: 'domcontentloaded' });

      const demo = page.getByTestId('tdf-disability-demo');
      const workspace = page.getByTestId('interactive-scenario-workspace');
      await expect(demo).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 })).toContainText(
        'Faro: una puerta de entrada accesible',
      );
      await expect(page.getByText('Demostración conceptual · datos representativos').first()).toBeVisible();
      await expect(workspace.getByRole('tab')).toHaveCount(5);
      await expect(workspace.getByText('Secuencia local · sin conexión a CRM')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Abrir chat de Faro' })).toBeVisible();
      await expect(page.getByText('Catálogo de servicios accesible', { exact: true })).toBeAttached();
      await expect(page.getByText('Directorio accesible')).toBeVisible();
      await expect(page.locator('main#main-content')).toHaveCount(1);
      await expect(page.locator('body')).not.toContainText('Chatboc.ar');

      if (viewport.width < 1280) {
        await expect(page.getByRole('navigation', { name: 'Secciones de la demostración en móvil' })).toBeVisible();
        const mobileView = workspace.getByRole('group', { name: 'Vista móvil sincronizada' });
        await expect(mobileView.getByRole('button', { name: 'Conversación', exact: true })).toBeVisible();
        await expect(mobileView.getByRole('button', { name: /CRM · \d+%/ })).toBeVisible();
      }

      await workspace.getByRole('button', { name: 'Ver secuencia completa' }).click();
      await expect(
        workspace.getByRole('progressbar', { name: 'Progreso de sincronización WhatsApp a CRM' }),
      ).toHaveAttribute('aria-valuenow', '100');
      await expectNoHorizontalOverflow(page);
      expectNoBackendTraffic(networkAudit);
    });
  }

  test('five service axes, keyboard navigation and simulated CRM actions stay synchronized', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const networkAudit = captureNetworkAudit(page);
    await page.goto(DEMO_PATH, { waitUntil: 'domcontentloaded' });

    const workspace = page.getByTestId('interactive-scenario-workspace');
    const tabs = workspace.getByRole('tab');
    const progress = workspace.getByRole('progressbar', {
      name: 'Progreso de sincronización WhatsApp a CRM',
    });
    await expect(tabs).toHaveCount(5);

    const firstTab = workspace.getByRole('tab', { name: 'Orientación CUD' });
    const secondTab = workspace.getByRole('tab', { name: 'Consulta RUPE' });
    const thirdTab = workspace.getByRole('tab', { name: 'Salud y apoyos' });
    await firstTab.focus();
    await page.keyboard.press('ArrowRight');
    await expect(secondTab).toBeFocused();
    await expect(secondTab).toHaveAttribute('aria-selected', 'true');
    await expect(progress).toHaveAttribute('aria-valuenow', '0');
    await workspace.getByRole('button', { name: 'Ver secuencia completa' }).click();
    await expect(progress).toHaveAttribute('aria-valuenow', '100');
    await expect(workspace.getByText('DEMO-DISC-0187')).toBeVisible();
    await expect(workspace.getByText('Captura compartida').first()).toBeVisible();

    await secondTab.focus();
    await page.keyboard.press('ArrowRight');
    await expect(thirdTab).toBeFocused();
    await expect(thirdTab).toHaveAttribute('aria-selected', 'true');
    await workspace.getByRole('button', { name: 'Ver secuencia completa' }).click();
    await expect(workspace.getByText('DEMO-DISC-0214')).toBeVisible();

    const takeCase = workspace.getByRole('button', { name: 'Simular toma' });
    const transferCase = workspace.getByRole('button', { name: 'Simular transferencia' });
    await expect(takeCase).toBeEnabled();
    await expect(transferCase).toBeEnabled();
    await takeCase.click();
    await expect(workspace.getByText(/caso tomado por el operador de Mesa Única/i)).toBeVisible();
    await transferCase.click();
    await expect(workspace.getByText(/Transferencia preparada: Persona DEMO/i)).toBeVisible();
    await expect(workspace.getByText(/contacto protegido/i)).toBeVisible();

    await workspace.getByRole('button', { name: 'Historial' }).click();
    await expect(workspace.getByTestId('crm-inspector-panel')).toContainText('Historial del caso');
    await workspace.getByRole('button', { name: 'Cerrar + CSAT' }).click();
    await expect(workspace.getByTestId('csat-close-step')).toBeVisible();
    await workspace.getByRole('button', { name: '5 de 5' }).click();
    await expect(workspace.getByText(/Valoración de muestra registrada: 5 de 5/i)).toBeVisible();
    await expect(workspace.getByText(/Cierre simulado auditado · CSAT 5\/5/i)).toBeVisible();

    await thirdTab.focus();
    await page.keyboard.press('End');
    const finalTab = workspace.getByRole('tab', { name: 'Trabajo y cursos' });
    await expect(finalTab).toBeFocused();
    await expect(finalTab).toHaveAttribute('aria-selected', 'true');
    await workspace.getByRole('button', { name: 'Ver secuencia completa' }).click();
    await expect(workspace.getByText('DEMO-DISC-0273')).toBeVisible();
    await expect(workspace.getByText('CV de muestra').first()).toBeVisible();

    expectNoBackendTraffic(networkAudit);
  });

  test('mobile Conversation and CRM views remain touch-usable with the accessibility controls', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const networkAudit = captureNetworkAudit(page);
    await page.goto(DEMO_PATH, { waitUntil: 'domcontentloaded' });

    const workspace = page.getByTestId('interactive-scenario-workspace');
    await workspace.getByRole('button', { name: 'Ver secuencia completa' }).click();
    const mobileView = workspace.getByRole('group', { name: 'Vista móvil sincronizada' });
    const conversationButton = mobileView.getByRole('button', { name: 'Conversación', exact: true });
    const crmButton = mobileView.getByRole('button', { name: 'CRM · 100%', exact: true });
    const conversation = workspace.getByRole('region', { name: 'Conversación de WhatsApp representativa' });
    const crm = workspace.getByRole('region', { name: 'Caso CRM sincronizado representativo' });

    await expectTouchTarget(conversationButton, 'Conversación');
    await expectTouchTarget(crmButton, 'CRM');
    await expect(conversation).toBeVisible();
    await expect(crm).toBeHidden();
    await crmButton.click();
    await expect(crmButton).toHaveAttribute('aria-pressed', 'true');
    await expect(crm).toBeVisible();
    await expect(conversation).toBeHidden();

    const takeCase = crm.getByRole('button', { name: 'Simular toma' });
    const transferCase = crm.getByRole('button', { name: 'Simular transferencia' });
    const closeCase = crm.getByRole('button', { name: 'Cerrar + CSAT' });
    await expectTouchTarget(takeCase, 'Simular toma');
    await expectTouchTarget(transferCase, 'Simular transferencia');
    await expectTouchTarget(closeCase, 'Cerrar + CSAT');
    await takeCase.click();
    await transferCase.click();
    await closeCase.click();
    await expect(conversation).toBeVisible();
    await expect(workspace.getByTestId('csat-close-step')).toBeVisible();
    const rating = workspace.getByRole('button', { name: '5 de 5' });
    await expectTouchTarget(rating, '5 de 5');
    await rating.click();

    const accessibilityButton = page.getByRole('button', { name: 'Abrir preferencias de accesibilidad' });
    await expectTouchTarget(accessibilityButton, 'Abrir preferencias de accesibilidad');
    await accessibilityButton.click();
    const accessibilityPanel = page.getByRole('region', { name: 'Preferencias de accesibilidad' });
    const largeText = accessibilityPanel.getByRole('button', { name: 'Texto grande' });
    const readingMode = accessibilityPanel.getByRole('button', { name: 'Lectura clara / dislexia' });
    const spacingMode = accessibilityPanel.getByRole('button', { name: 'Espaciado amplio' });
    const reduceMotion = accessibilityPanel.getByRole('button', { name: 'Reducir movimiento' });
    for (const [label, control] of [
      ['Texto grande', largeText],
      ['Lectura clara / dislexia', readingMode],
      ['Espaciado amplio', spacingMode],
      ['Reducir movimiento', reduceMotion],
    ] as const) {
      await expectTouchTarget(control, label);
      await control.click();
      await expect(control).toHaveAttribute('aria-pressed', 'true');
    }
    await expect(page.locator('html')).toHaveClass(/tdf-demo-large-text/);
    await expect(page.locator('html')).toHaveClass(/tdf-demo-reading-friendly/);
    await expect(page.locator('html')).toHaveClass(/tdf-demo-wide-spacing/);
    await expect(page.getByTestId('tdf-disability-demo')).toHaveAttribute('data-reduced-motion', 'true');
    await expectNoHorizontalOverflow(page);

    expectNoBackendTraffic(networkAudit);
  });

  test('Faro widget opens a local scenario without sending data to a backend', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const networkAudit = captureNetworkAudit(page);
    await page.goto(DEMO_PATH, { waitUntil: 'domcontentloaded' });

    const launcher = page.getByRole('button', { name: 'Abrir chat de Faro' });
    await expectTouchTarget(launcher, 'Abrir chat de Faro');
    await launcher.click();
    await expect(page.locator('.tdf-faro-widget > button')).toHaveAttribute('aria-expanded', 'true');
    const dialog = page.getByRole('dialog', { name: 'Faro TDF' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Muestra conceptual · no envía datos')).toBeVisible();

    const quickAction = dialog.getByRole('button', { name: 'Trabajo y cursos' });
    await expectTouchTarget(quickAction, 'Trabajo y cursos');
    await quickAction.click();
    await expect(dialog.getByText(/Quiero buscar trabajo y preparar mi CV/i)).toBeVisible();
    await expect(dialog.getByText(/Puedo orientar sobre inclusión laboral, cursos/i)).toBeVisible();
    await dialog.getByRole('button', { name: 'Ver cómo llega al CRM' }).click();
    await expect(dialog).toBeHidden();

    const workspace = page.getByTestId('interactive-scenario-workspace');
    const selectedTab = workspace.getByRole('tab', { name: 'Trabajo y cursos' });
    await expect(selectedTab).toHaveAttribute('aria-selected', 'true');
    await workspace.getByRole('button', { name: 'Ver secuencia completa' }).click();
    await workspace.getByRole('group', { name: 'Vista móvil sincronizada' }).getByRole('button', {
      name: 'CRM · 100%',
      exact: true,
    }).click();
    await expect(workspace.getByText('DEMO-DISC-0273')).toBeVisible();
    await expect(workspace.getByText('Secuencia local · sin conexión a CRM')).toBeVisible();

    expectNoBackendTraffic(networkAudit);
  });

  test('territorial filters update only the representative local dataset and preserve the map warning', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const networkAudit = captureNetworkAudit(page);
    await page.goto(DEMO_PATH, { waitUntil: 'domcontentloaded' });

    const territory = page.locator('#indicadores');
    await territory.scrollIntoViewIfNeeded();
    const cityFilters = territory.getByRole('group', { name: 'Filtrar mapa por ciudad' });
    const reasonFilters = territory.getByRole('group', { name: 'Filtrar mapa por motivo' });
    await cityFilters.getByRole('button', { name: 'Río Grande' }).click();
    await expect(territory.getByText('8 ubicaciones simuladas').first()).toBeVisible();
    await expect(territory.getByText(/Margen Sur/).first()).toBeVisible();

    await reasonFilters.getByRole('button', { name: 'Salud y prestaciones' }).click();
    await expect(territory.getByText('2 ubicaciones simuladas').first()).toBeVisible();
    await expect(territory.getByText('Río Grande · Salud y prestaciones')).toBeVisible();
    await expect(territory.getByText(/Margen Sur/).first()).toBeVisible();
    await expect(territory.getByText(/CGT/).first()).toBeVisible();

    const geographicMap = territory.getByRole('button', { name: 'Mapa geográfico' });
    await geographicMap.click();
    await expect(geographicMap).toHaveAttribute('aria-pressed', 'true');
    await expect(
      territory.getByRole('region', {
        name: 'Mapa MapLibre de demanda conceptual y simulada en Tierra del Fuego',
      }),
    ).toBeVisible();
    await expect(territory.getByText(/no deben utilizarse para decisiones de política pública/i)).toBeVisible();

    expectNoBackendTraffic(networkAudit);
  });

  test('has no moderate, serious or critical axe violations after revealing the full conceptual page', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(DEMO_PATH, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('tdf-disability-demo')).toBeVisible();
    await page.getByTestId('interactive-scenario-workspace').getByRole('button', {
      name: 'Ver secuencia completa',
    }).click();
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
