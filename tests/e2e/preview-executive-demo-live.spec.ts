import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { expectNoHorizontalOverflow } from './e2e-helpers';

const previewQaEnabled = process.env.CHATBOC_REMOTE_PREVIEW_QA === '1';
const previewOrigin = process.env.PLAYWRIGHT_BASE_URL || 'https://chatboc-r2-preview.vercel.app';
const expectedHost = process.env.CHATBOC_PREVIEW_FRONTEND_HOST || 'chatboc-r2-preview.vercel.app';
const remoteTimeout = 120_000;
// Keep margin for a cold JS bundle while requiring the professional public
// shell before any executive module is exercised.
const publicBootstrapTimeout = 10_000;

test.describe('remote Preview executive government demo', () => {
  test.skip(!previewQaEnabled, 'Runs only against the explicit Vercel Preview QA target.');

  test('reconciles provenance, cases, territorial sample and survey results against the live backend', async ({ page }) => {
    test.setTimeout(300_000);
    const target = new URL(previewOrigin);
    expect(target.protocol).toBe('https:');
    expect(target.hostname).toBe(expectedHost);
    expect(target.hostname.endsWith('.vercel.app')).toBe(true);

    const browserErrors: string[] = [];
    const apiFailures: string[] = [];
    const clerkWarnings: string[] = [];
    const clerkConfigFailures: string[] = [];
    const mapLibreWarnings: string[] = [];
    page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
      if (message.type() === 'warning' && message.text().includes('[Clerk]')) {
        clerkWarnings.push(message.text());
      }
      if (message.type() === 'warning' && message.text().includes('[MapLibreMap]')) {
        mapLibreWarnings.push(message.text());
      }
    });
    page.on('requestfailed', (request) => {
      const url = new URL(request.url());
      if (url.host === target.host && url.pathname.startsWith('/api/')) {
        apiFailures.push(`network ${url.pathname}: ${request.failure()?.errorText || 'request failed'}`);
      }
      if (url.pathname.endsWith('/auth/clerk/config')) {
        clerkConfigFailures.push(`network ${url.pathname}: ${request.failure()?.errorText || 'request failed'}`);
      }
    });
    page.on('response', (response) => {
      const url = new URL(response.url());
      if (url.host === target.host && url.pathname.startsWith('/api/') && response.status() >= 400) {
        apiFailures.push(`${response.status()} ${url.pathname}`);
      }
      if (url.pathname.endsWith('/auth/clerk/config') && response.status() >= 400) {
        clerkConfigFailures.push(`${response.status()} ${url.pathname}`);
      }
    });

    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.setViewportSize({ width: 1440, height: 900 });

    const adminPreviewResponse = page.waitForResponse(
      (response) => {
        const url = new URL(response.url());
        return (
          url.pathname === '/api/v2/demo/admin-preview' &&
          url.searchParams.get('presentation_mode') === 'executive' &&
          response.status() === 200
        );
      },
      { timeout: remoteTimeout },
    );
    const url = new URL('/demo', target);
    url.searchParams.set('sector', 'gobierno');
    url.searchParams.set('rubro', 'municipio');
    url.searchParams.set('tenant_slug', 'junin');
    url.searchParams.set('remote_preview_qa', '1');
    const navigation = await page.goto(url.toString(), {
      waitUntil: 'domcontentloaded',
      timeout: remoteTimeout,
    });
    expect(navigation?.status()).toBe(200);
    const shell = page.getByTestId('demo-route-shell');
    await expect(page.getByRole('heading', { name: 'Centro de gestión ciudadana' })).toBeVisible({
      timeout: publicBootstrapTimeout,
    });
    await expect(shell).toContainText('Atención, reclamos, participación y territorio en una sola vista.');
    await expect(shell).toContainText(/Ámbito: Junin/i);
    await expect(shell).toContainText('Demo no oficial · datos simulados');
    await expect(page.getByRole('heading', { name: 'Elegí una operación real para probar' })).toHaveCount(0);

    const sectionNavigation = {
      summary: page.getByRole('button', { name: 'Resumen', exact: true }),
      attention: page.getByRole('button', { name: 'Atención', exact: true }),
      claims: page.getByRole('button', { name: 'Reclamos', exact: true }),
      participation: page.getByRole('button', { name: 'Participación', exact: true }),
      territory: page.getByRole('button', { name: 'Territorio', exact: true }),
    };
    for (const navigationButton of Object.values(sectionNavigation)) {
      await expect(navigationButton).toBeVisible();
    }
    await expect(sectionNavigation.summary).toHaveAttribute('aria-current', 'page');
    await sectionNavigation.summary.click();

    const response = await adminPreviewResponse;
    const payload = await response.json();
    expect(payload.contract_version).toBe('demo.admin_preview.v1');
    expect(payload.presentation_mode).toBe('executive');
    expect(payload.data_provenance).toMatchObject({
      mode: 'synthetic_demo_scenario',
      synthetic: true,
      contains_synthetic: true,
      municipal_truth: false,
      requested_tenant_slug: 'junin',
      scenario_scope: 'Junín, Mendoza',
    });
    const firstSurvey = payload.survey_voting.items[0];
    expect(payload.survey_voting.total_available).toBe(9);
    expect(
      payload.survey_voting.items.slice(0, 3).map((survey: { slug?: string }) => survey.slug),
    ).toEqual([
      'demo-gobierno-junin-participa-prioridades-barriales',
      'demo-gobierno-junin-90-dias-obras-servicios',
      'demo-gobierno-junin-digital-tramites-atencion',
    ]);
    const firstSurveyResults = firstSurvey.results;
    expect(payload.metrics.find((metric: { id?: string }) => metric.id === 'survey_valid_votes')?.value).toBe(
      firstSurveyResults.total_respuestas,
    );
    expect(firstSurveyResults.seeded_responses).toBe(100);
    expect(firstSurveyResults.interactive_demo_responses).toBeGreaterThanOrEqual(0);
    expect(firstSurveyResults.verified_citizen_responses).toBe(0);
    expect(firstSurveyResults.total_respuestas).toBe(
      firstSurveyResults.seeded_responses + firstSurveyResults.interactive_demo_responses,
    );
    const firstSurveyOptions = firstSurveyResults.options as Array<{
      label: string;
      count: number;
      porcentaje: number;
    }>;
    const topSurveyOption = [...firstSurveyOptions].sort((left, right) => right.count - left.count)[0];

    const panel = page.getByRole('region', { name: 'Panel demo para gestión ciudadana' });
    await expect(panel).toBeVisible({ timeout: remoteTimeout });
    await expect(shell).toContainText('Ámbito: Junín, Mendoza');
    await expect(panel.getByRole('note', { name: /advertencia sobre los datos/i })).toContainText(
      'Escenario demostrativo · datos simulados',
    );
    await expect(panel.getByRole('note', { name: 'Fuentes separadas del panel demostrativo' })).toHaveCount(0);
    await expect(sectionNavigation.summary).toHaveAttribute('aria-current', 'page');
    await expect(panel.getByRole('heading', { name: 'Situación operativa y participación' })).toBeVisible();
    await expect(panel.getByText('Fuente · demo.admin_preview.v1')).toBeVisible();
    await expect(panel.getByRole('heading', { name: 'Indicadores ejecutivos' })).toBeVisible();
    await expect(panel.getByText('184 casos')).toBeVisible();
    const compositionText =
      `${firstSurveyResults.seeded_responses} base sintética + ${firstSurveyResults.interactive_demo_responses} participaciones demo = ${firstSurveyResults.total_respuestas} total`;
    await expect(panel.getByText(compositionText, { exact: false }).first()).toBeVisible();
    await expect(panel.getByText('0 respuestas ciudadanas verificadas', { exact: false }).first()).toBeVisible();

    await sectionNavigation.attention.click();
    await expect(sectionNavigation.attention).toHaveAttribute('aria-current', 'page');
    await expect(page.getByText('Municipalidad de Junín', { exact: true })).toBeVisible();
    await expect(page.getByText('Web + WhatsApp', { exact: true })).toBeVisible();
    await expect(page.getByText('Puedo orientarte, crear casos y dejar todo listo para seguimiento.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Crear reclamo', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Encuestas y votaciones', exact: true })).toBeVisible();

    await sectionNavigation.claims.click();
    await expect(sectionNavigation.claims).toHaveAttribute('aria-current', 'page');
    await expect(panel.getByRole('heading', { name: 'Reclamos y casos operativos' })).toBeVisible();
    await expect(panel.getByText('Casos simulados')).toBeVisible();
    await expect(panel.getByText(/5 de 184 casos informados por el contrato/)).toBeVisible();
    await expect(panel.getByRole('heading', { name: 'Cola operativa visible' })).toBeVisible();
    await expect(panel.getByText('JN-DEMO-1042')).toBeVisible();

    await sectionNavigation.participation.click();
    await expect(sectionNavigation.participation).toHaveAttribute('aria-current', 'page');
    await expect(panel.getByRole('heading', { name: 'Encuestas y votaciones' })).toBeVisible();
    await expect(panel.getByText('5 visibles de 9 encuestas demo')).toBeVisible();
    await expect(panel.getByText('Base sintética determinística:', { exact: false })).toBeVisible();
    for (const surveyTitle of [
      'Junín Participa — prioridades barriales (DEMO NO OFICIAL)',
      'Junín en 90 días — obras y servicios (DEMO NO OFICIAL)',
      'Junín Digital — trámites y atención ciudadana (DEMO NO OFICIAL)',
    ]) {
      await expect(panel.getByRole('button').filter({ hasText: surveyTitle })).toBeVisible();
    }
    const firstSurveyTrigger = panel.getByRole('button').filter({ hasText: firstSurvey.title });
    await expect(firstSurveyTrigger).toBeVisible();
    if ((await firstSurveyTrigger.getAttribute('aria-expanded')) !== 'true') {
      await firstSurveyTrigger.click();
    }
    await expect(firstSurveyTrigger).toHaveAttribute('aria-expanded', 'true');
    const surveyComposition = panel.getByRole('note', {
      name: `Composición de respuestas de ${firstSurvey.title}`,
    });
    await expect(surveyComposition).toContainText(compositionText);
    await expect(surveyComposition).toContainText('0 respuestas ciudadanas verificadas');
    await expect(
      panel.locator('[data-demo-survey-voting] article').first().getByRole('progressbar', {
        name: new RegExp(`^${topSurveyOption.label}:`),
      }),
    ).toHaveAttribute('aria-valuenow', String(Math.round(topSurveyOption.porcentaje)));
    await expect(panel.getByRole('link', { name: 'Abrir encuesta demo' })).toHaveCount(1);

    const expectAccessibleShell = async (stateLabel: string) => {
      const accessibility = await new AxeBuilder({ page })
        .include('[data-testid="demo-route-shell"]')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const seriousViolations = accessibility.violations
        .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
        .flatMap((violation) => violation.nodes.map((node) => `${violation.id}: ${node.target.join(' ')}`));
      expect(seriousViolations, `${stateLabel}: ${seriousViolations.join('\n')}`).toEqual([]);
    };
    await expectAccessibleShell('Participación desktop');

    await sectionNavigation.territory.click();
    await expect(sectionNavigation.territory).toHaveAttribute('aria-current', 'page');
    await expect(panel.getByRole('heading', { name: 'Mapa demostrativo de demanda ciudadana' })).toBeVisible();
    const executiveMap = page.getByTestId('demo-executive-map');
    await expect(executiveMap).toHaveAttribute('data-demo-map-mode', 'synthetic_demo_scenario');
    await expect(executiveMap.locator('canvas.maplibregl-canvas')).toBeVisible({ timeout: remoteTimeout });
    await expect(executiveMap.getByText('No se pudo cargar el mapa', { exact: false })).toHaveCount(0);
    await expect(page.getByTestId('map-evidence-badge')).toContainText('Puntos simulados');
    await expect(page.getByTestId('map-evidence-badge')).toContainText('Simulación controlada');
    await expect(page.getByTestId('demo-map-volume-legend')).toContainText('6 menor volumen');
    await expect(page.getByTestId('demo-map-volume-legend')).toContainText('18 mayor volumen');
    await expect(panel.getByText(/Cinco zonas de muestra representan 52 de 184 reclamos/i)).toBeVisible();
    await expect(panel.getByText('Revisión de señalización')).toBeVisible();
    await expectAccessibleShell('Territorio desktop');

    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(page);
    await expect(page.getByRole('heading', { name: 'Centro de gestión ciudadana' })).toBeVisible();
    await expect(sectionNavigation.territory).toHaveAttribute('aria-current', 'page');
    await expect(panel.getByRole('heading', { name: 'Mapa demostrativo de demanda ciudadana' })).toBeVisible();
    await expect(executiveMap.locator('canvas.maplibregl-canvas')).toBeVisible();
    await expectAccessibleShell('Territorio mobile');
    expect(apiFailures, apiFailures.join('\n')).toEqual([]);
    expect(browserErrors, browserErrors.join('\n')).toEqual([]);
    expect(clerkWarnings, clerkWarnings.join('\n')).toEqual([]);
    expect(clerkConfigFailures, clerkConfigFailures.join('\n')).toEqual([]);
    expect(mapLibreWarnings, mapLibreWarnings.join('\n')).toEqual([]);
  });
});
