import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import { expectNoHorizontalOverflow } from './e2e-helpers';

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const prepareIsolatedPage = async (page: Page) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.routeWebSocket('**/socket.io/**', (socket) => socket.close());
  await page.route('**/auth/clerk/config', (route) =>
    json(route, { enabled: false, publishable_key: '', social_providers: [] }),
  );
};

test('unscoped survey entry stays local, accessible and tenant-safe', async ({ page }) => {
  await prepareIsolatedPage(page);
  const publicListRequests: string[] = [];
  await page.route('**/api/public/encuestas/v1**', (route) => {
    publicListRequests.push(route.request().url());
    return json(route, { reason_code: 'unexpected_unscoped_request' }, 400);
  });

  await page.goto('/encuestas', { waitUntil: 'domcontentloaded' });

  const scopeState = page.getByTestId('public-survey-scope-required');
  await expect(scopeState.getByRole('heading', { name: 'Elegí una organización para ver sus encuestas' })).toBeVisible();
  await expect(scopeState.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/');
  await page.waitForTimeout(250);

  expect(publicListRequests).toEqual([]);
  await expectNoHorizontalOverflow(page);

  const accessibility = await new AxeBuilder({ page }).include('[data-testid="public-survey-scope-required"]').analyze();
  const seriousViolations = accessibility.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
  expect(seriousViolations).toEqual([]);
});

test('a backend-resolved ambient tenant enters the canonical tenant survey route', async ({ page }) => {
  await prepareIsolatedPage(page);
  await page.addInitScript(() => window.localStorage.setItem('tenantSlug', 'rio-grande'));

  const publicListRequests: string[] = [];
  await page.route('**/api/public/encuestas/v1**', (route) => {
    publicListRequests.push(route.request().url());
    return json(route, []);
  });
  await page.route('**/api/pwa/public/tenant-info?*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    return json(route, {
      contract_version: 'public.tenant_profile.v1',
      tenant: { slug: 'rio-grande', nombre: 'Espacio Río Grande', tipo: 'municipio' },
    });
  });
  await page.route('**/api/public/tenants/rio-grande/public-navigation', (route) =>
    json(route, {
      contract_version: 'tenant.public_navigation.v1',
      tenant_slug: 'rio-grande',
      items: [],
    }),
  );

  await page.goto('/encuestas', { waitUntil: 'domcontentloaded' });

  await expect(page).toHaveURL(/\/t\/rio-grande\/encuestas$/);
  await expect(page.getByText('Participacion no publicada')).toBeVisible();
  expect(publicListRequests).toEqual([]);
});

test('a cold canonical deep link scopes navigation from the route without a default-tenant request', async ({ page }) => {
  await prepareIsolatedPage(page);

  const navigationRequests: string[] = [];
  const publicListRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith('/public-navigation')) navigationRequests.push(url.pathname);
  });
  await page.route('**/api/public/tenants/rio-grande/public-navigation', (route) =>
    json(route, {
      contract_version: 'tenant.public_navigation.v1',
      tenant_slug: 'rio-grande',
      items: [],
    }),
  );
  await page.route('**/api/public/encuestas/v1**', (route) => {
    publicListRequests.push(route.request().url());
    return json(route, []);
  });
  await page.route('**/api/pwa/public/tenant-info?*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    return json(route, {
      contract_version: 'public.tenant_profile.v1',
      tenant: { slug: 'rio-grande', nombre: 'Espacio Río Grande', tipo: 'municipio' },
    });
  });

  await page.goto('/t/rio-grande/encuestas', { waitUntil: 'domcontentloaded' });

  await expect(page.getByText('Participacion no publicada')).toBeVisible();
  expect([...new Set(navigationRequests)]).toEqual(['/api/public/tenants/rio-grande/public-navigation']);
  expect(navigationRequests).not.toContain('/api/public/tenants/default/public-navigation');
  expect(publicListRequests).toEqual([]);
});
