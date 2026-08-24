import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

type SurveyLandmarkScenario = {
  name: string;
  path: string;
  tenantSlug?: 'junin';
  h1: string;
  region: string;
  readyHeading: string;
};

const VIEWPORTS = [
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

const SCENARIOS: SurveyLandmarkScenario[] = [
  {
    name: 'unscoped',
    path: '/encuestas',
    h1: 'Elegí una organización para ver sus encuestas',
    region: 'Elegí una organización para ver sus encuestas',
    readyHeading: 'Elegí una organización para ver sus encuestas',
  },
  {
    name: 'default sentinel',
    path: '/encuestas?tenant_slug=default',
    h1: 'Elegí una organización para ver sus encuestas',
    region: 'Elegí una organización para ver sus encuestas',
    readyHeading: 'Elegí una organización para ver sus encuestas',
  },
  {
    name: 'Junin canonical',
    path: '/t/junin/encuestas',
    tenantSlug: 'junin',
    h1: 'Municipalidad de Junín',
    region: 'Encuestas',
    readyHeading: 'Participacion no publicada',
  },
];

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const preparePage = async (page: Page, tenantSlug?: 'junin') => {
  const publicSurveyRequests: string[] = [];

  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.routeWebSocket('**/socket.io/**', (socket) => socket.close());
  await page.route('**/*', async (route) => {
    const request = route.request();
    if (!['fetch', 'xhr'].includes(request.resourceType())) {
      await route.continue();
      return;
    }

    const url = new URL(request.url());
    const path = url.pathname.toLowerCase();

    if (path.endsWith('/auth/clerk/config')) {
      await json(route, { enabled: false, publishable_key: '', social_providers: [] });
      return;
    }

    if (path.includes('/api/pwa/public/tenant-info')) {
      if (tenantSlug === 'junin') {
        await json(route, {
          contract_version: 'public.tenant_profile.v1',
          tenant: {
            slug: 'junin',
            nombre: 'Municipalidad de Junín',
            tipo: 'municipio',
            descripcion: 'Portal municipal',
          },
        });
      } else {
        await json(route, { reason_code: 'tenant_required' }, 404);
      }
      return;
    }

    if (path.endsWith('/api/public/tenants/junin/public-navigation')) {
      await json(route, {
        contract_version: 'tenant.public_navigation.v1',
        tenant_slug: 'junin',
        items: [],
      });
      return;
    }

    if (path.includes('/api/public/encuestas/v1')) {
      publicSurveyRequests.push(request.url());
      await json(route, []);
      return;
    }

    if (path.endsWith('/api/public/widget-config')) {
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

  return publicSurveyRequests;
};

const expectNoSeriousOrCriticalViolations = async (page: Page) => {
  const results = await new AxeBuilder({ page })
    .include('#main-content')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .exclude('iframe[src*="challenges.cloudflare.com"]')
    .analyze();
  const violations = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );

  expect(
    violations.map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.length})`),
  ).toEqual([]);
};

const expectAxeLandmarkContract = async (page: Page) => {
  const results = await new AxeBuilder({ page })
    .withRules([
      'landmark-no-duplicate-main',
      'landmark-one-main',
      'page-has-heading-one',
    ])
    .analyze();

  expect(
    results.violations.map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.length})`),
  ).toEqual([]);
};

test.describe('public survey landmark and heading contract', () => {
  for (const viewport of VIEWPORTS) {
    for (const scenario of SCENARIOS) {
      test(`${scenario.name} is semantic at ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        const publicSurveyRequests = await preparePage(page, scenario.tenantSlug);

        await page.goto(scenario.path, { waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('heading', { name: scenario.readyHeading })).toBeVisible({ timeout: 10_000 });

        await expect(page.locator('main')).toHaveCount(1);
        await expect(page.locator('main main')).toHaveCount(0);
        await expect(page.locator('h1')).toHaveCount(1);
        await expect(page.getByRole('heading', { level: 1, name: scenario.h1 })).toBeVisible();
        await expect(page.getByRole('region', { name: scenario.region })).toBeVisible();
        expect(publicSurveyRequests).toEqual([]);

        await expectNoSeriousOrCriticalViolations(page);
        await expectAxeLandmarkContract(page);
      });
    }
  }
});
