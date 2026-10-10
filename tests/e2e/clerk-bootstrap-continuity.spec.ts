import { expect, test, type Page } from '@playwright/test';

type ClerkConfigGate = {
  release: (config?: Record<string, unknown>) => void;
};

const disabledClerkConfig = {
  contract_version: 'auth.clerk.v1',
  enabled: false,
  environment: 'development',
  production_ready: false,
  ready_for_session_sync: false,
  social_providers: [],
};

const lateEnabledClerkConfig = {
  contract_version: 'auth.clerk.v1',
  enabled: true,
  environment: 'development',
  production_ready: true,
  ready_for_session_sync: true,
  publishable_key: 'pk_test_late_e2e',
  social_providers: [],
};

const installDemoApiMocks = async (page: Page) => {
  let catalogRequests = 0;
  let sandboxGetRequests = 0;
  let clerkConfigRequests = 0;
  let releaseConfig!: (config: Record<string, unknown>) => void;
  const configGate = new Promise<Record<string, unknown>>((resolve) => {
    releaseConfig = resolve;
  });

  // Keep unrelated provider bootstraps deterministic without intercepting Vite modules.
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/api/')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      return;
    }
    await route.fallback();
  });

  await page.route('**/api/v2/demo/catalog*', async (route) => {
    catalogRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'cache-control': 'public, max-age=300' },
      body: JSON.stringify({
        contract_version: 'demo.catalog.v2',
        sectors: ['gobierno', 'empresas', 'educacion'],
        sector_groups: [
          { key: 'gobierno', label: 'Gobiernos', tenant_slug: 'municipio-demo' },
          { key: 'empresas', label: 'Empresas', tenant_slug: 'bodega-demo' },
          { key: 'educacion', label: 'Colegios', tenant_slug: 'colegio-demo' },
        ],
        rubros: [],
      }),
    });
  });

  await page.route('**/api/v2/demo/whatsapp-sandbox*', async (route) => {
    if (route.request().method() === 'GET') sandboxGetRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        contract_version: 'demo.whatsapp_sandbox_launcher.v1',
        requires_auth: false,
        session: {
          demo_session_id: 'demo-clerk-bootstrap-e2e',
          chat_session_id: 'sid_clerk_bootstrap_e2e',
          max_messages: 10,
        },
        whatsapp_sandbox: {
          contract_version: 'demo.whatsapp_sandbox.v1',
          rubro_options: [
            { id: 'bodega', label: 'Bodega', sector: 'empresas', rubro: 'bodega' },
          ],
          sandbox: {
            display_number: '+54 9 261 000-0000',
            wa_deeplink: 'https://wa.me/5492610000000',
            requires_join_phrase: false,
          },
          trial_policy: { max_messages: 10, free_inputs: ['text'] },
          scenario_scripts: [],
          catalog: {},
          surveys_votings: { enabled: false },
        },
      }),
    });
  });

  await page.route('**/auth/clerk/config*', async (route) => {
    clerkConfigRequests += 1;
    const config = await configGate;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(config),
    });
  });

  return {
    gate: {
      release: (config = disabledClerkConfig) => releaseConfig(config),
    } satisfies ClerkConfigGate,
    requestCounts: () => ({ catalogRequests, clerkConfigRequests, sandboxGetRequests }),
  };
};

test.describe('Clerk bootstrap continuity', () => {
  test.describe.configure({ mode: 'serial' });

  test('keeps product routes non-interactive until the runtime is decided', async ({ page }) => {
    const { gate, requestCounts } = await installDemoApiMocks(page);

    await page.goto('/demo');

    await expect(page.getByRole('heading', { name: 'Preparando Chatboc' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Eleg[ií] una operaci[oó]n real para probar/i })).toHaveCount(0);

    gate.release();

    await expect(page.getByRole('heading', { name: /Eleg[ií] una operaci[oó]n real para probar/i })).toBeVisible();
    const colegios = page.getByRole('button', { name: /Colegios/i });
    await colegios.click();
    await expect(colegios).toHaveClass(/text-primary-foreground/);
    expect(requestCounts()).toEqual({
      catalogRequests: 1,
      clerkConfigRequests: 1,
      sandboxGetRequests: 2,
    });
  });

  test('ignores an enabled response arriving after the safe timeout without remounting state', async ({ page }) => {
    test.setTimeout(30_000);
    const { gate, requestCounts } = await installDemoApiMocks(page);

    await page.goto('/demo');
    await expect(page.getByRole('heading', { name: 'Preparando Chatboc' })).toBeVisible();

    const demoHeading = page.getByRole('heading', { name: /Eleg[ií] una operaci[oó]n real para probar/i });
    await expect(demoHeading).toBeVisible({ timeout: 7_000 });
    const colegios = page.getByRole('button', { name: /Colegios/i });
    await colegios.click();
    await expect(colegios).toHaveClass(/text-primary-foreground/);
    await colegios.evaluate((element) => {
      (window as Window & { __clerkContinuityNode?: Element }).__clerkContinuityNode = element;
    });

    const lateConfigResponse = page.waitForResponse(
      (response) => new URL(response.url()).pathname.endsWith('/auth/clerk/config'),
    );
    gate.release(lateEnabledClerkConfig);
    await lateConfigResponse;
    await page.waitForTimeout(250);

    const continuity = await colegios.evaluate((element) => {
      const original = (window as Window & { __clerkContinuityNode?: Element }).__clerkContinuityNode;
      return {
        originalConnected: original?.isConnected ?? false,
        sameNode: original === element,
      };
    });
    expect(continuity).toEqual({ originalConnected: true, sameNode: true });
    await expect(colegios).toHaveClass(/text-primary-foreground/);
    expect(requestCounts()).toEqual({
      catalogRequests: 1,
      clerkConfigRequests: 1,
      sandboxGetRequests: 2,
    });
  });
});
