import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { expectNoHorizontalOverflow } from './e2e-helpers';

const previewQaEnabled = process.env.CHATBOC_REMOTE_PREVIEW_QA === '1';
const previewOrigin = process.env.PLAYWRIGHT_BASE_URL || 'https://chatboc-r2-preview.vercel.app';
const expectedHost = process.env.CHATBOC_PREVIEW_FRONTEND_HOST || 'chatboc-r2-preview.vercel.app';
const remoteTimeout = 120_000;
// The explicit remote Preview presentation bypasses the optional Clerk
// bootstrap fail-closed. Keep margin for a cold JS bundle and demo data while
// still requiring an immediate branded loading surface.
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
    page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
    });
    page.on('response', (response) => {
      const url = new URL(response.url());
      if (url.host === target.host && url.pathname.startsWith('/api/') && response.status() >= 400) {
        apiFailures.push(`${response.status()} ${url.pathname}`);
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
    await expect(page.locator('main')).toContainText(
      /Preparando (Chatboc|tu espacio de trabajo)|Probá una conversación real/,
      { timeout: 2_000 },
    );
    await expect(
      page.getByRole('heading', { name: 'Probá una conversación real y mirá qué queda listo para operar.' }),
    ).toBeVisible({ timeout: publicBootstrapTimeout });
    await expect(page.getByRole('heading', { name: 'Elegí una operación real para probar' })).toHaveCount(0);

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
    await expect(panel.getByRole('note', { name: /advertencia sobre los datos/i })).toContainText(
      'Escenario demostrativo · datos simulados',
    );
    await expect(panel.getByRole('note', { name: 'Fuentes separadas del panel demostrativo' })).toHaveCount(0);
    await expect(panel.getByText('184 casos')).toBeVisible();
    const compositionText =
      `${firstSurveyResults.seeded_responses} base sintética + ${firstSurveyResults.interactive_demo_responses} participaciones demo = ${firstSurveyResults.total_respuestas} total`;
    await expect(panel.getByText(compositionText, { exact: false }).first()).toBeVisible();
    await expect(panel.getByText('0 respuestas ciudadanas verificadas', { exact: false }).first()).toBeVisible();

    await panel.getByRole('button', { name: 'Reclamos', exact: true }).click();
    await expect(panel.getByText('Casos simulados')).toBeVisible();
    await expect(panel.getByText('5 de 184 casos informados por el contrato.')).toBeVisible();
    await expect(panel.getByText('JN-DEMO-1042')).toBeVisible();

    await panel.getByRole('button', { name: 'Mapa demostrativo', exact: true }).click();
    await expect(panel.getByRole('heading', { level: 3, name: 'Mapa demostrativo de demanda ciudadana' })).toBeVisible();
    await expect(panel.getByRole('region', { name: /5 zonas muestran 52 de 184 casos/i })).toBeVisible();
    await expect(panel.getByText(/Cinco zonas de muestra representan 52 de 184 reclamos/i)).toBeVisible();
    await expect(panel.getByText('Revisión de señalización')).toBeVisible();

    await panel.getByRole('button', { name: 'Encuestas', exact: true }).click();
    await expect(panel.getByText('6 encuestas demo')).toBeVisible();
    const firstSurveyTrigger = panel.getByRole('button', { name: new RegExp(`^${firstSurvey.title}:`) });
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

    const accessibility = await new AxeBuilder({ page })
      .include('[data-demo-admin-preview]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(
      accessibility.violations
        .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
        .flatMap((violation) => violation.nodes.map((node) => `${violation.id}: ${node.target.join(' ')}`)),
    ).toEqual([]);

    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(page);
    await expect(panel.getByRole('heading', { level: 3, name: 'Encuestas y votaciones' })).toBeVisible();
    expect(apiFailures, apiFailures.join('\n')).toEqual([]);
    expect(browserErrors, browserErrors.join('\n')).toEqual([]);
  });
});
