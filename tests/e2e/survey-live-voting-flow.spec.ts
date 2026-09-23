import { expect, test, type Page, type Route } from '@playwright/test';
import { E2E_VIEWPORTS, expectNoHorizontalOverflow } from './e2e-helpers';

const SURVEY_SLUG = 'prioridades-2026';

const surveyPayload = {
  contract_version: 'encuestas.public.v1',
  instrument_revision: 7,
  request_id: 'req-survey-e2e',
  slug: SURVEY_SLUG,
  slug_publico: SURVEY_SLUG,
  canonical_slug: SURVEY_SLUG,
  titulo: 'Votacion de prioridades barriales',
  descripcion: 'Elegimos la siguiente mejora del barrio.',
  tipo: 'votacion',
  inicio_at: '2026-01-01T00:00:00Z',
  fin_at: '2026-12-31T23:59:59Z',
  politica_unicidad: 'libre',
  anonimo_permitido: true,
  es_votacion_envivo: true,
  mostrar_resultados_envivo: true,
  permitir_comentarios: false,
  preguntas: [
    {
      id: 101,
      orden: 1,
      tipo: 'opcion_unica',
      texto: 'Que obra deberia priorizar el municipio?',
      obligatoria: true,
      opciones: [
        { id: 'luz', orden: 1, texto: 'Mejorar alumbrado' },
        { id: 'plaza', orden: 2, texto: 'Renovar la plaza' },
      ],
    },
  ],
};

const liveResultsPayload = {
  contract_version: 'surveys.live_results.v2',
  result_version: 7,
  snapshot_version: '20260717-1',
  slug_publico: SURVEY_SLUG,
  total_respuestas: 12,
  updated_at: '2026-07-17T14:30:00Z',
  kpis: { responses_last_hour: 5, participation_per_minute: 0.8 },
  preguntas: [
    {
      id: 101,
      texto: 'Que obra deberia priorizar el municipio?',
      tipo: 'opcion_unica',
      total_votos: 12,
      opciones: [
        { id: 'luz', texto: 'Mejorar alumbrado', votos: 8, porcentaje: 66.7 },
        { id: 'plaza', texto: 'Renovar la plaza', votos: 4, porcentaje: 33.3 },
      ],
    },
  ],
  timeline_minute: [
    { minute: '14:29', respuestas: 3 },
    { minute: '14:30', respuestas: 5 },
  ],
  heatmap: {
    points: [],
    cells: [{ lat: -33.086, lng: -68.471, value: 12, barrio: 'Centro' }],
    metadata: { privacy_mode: 'public_aggregated', raw_points_redacted: true },
  },
  realtime: {
    contract_version: 'surveys.realtime.v2',
    enabled: true,
    room: `encuesta:${SURVEY_SLUG}`,
    polling: { interval_ms: 60_000 },
  },
};

type SurveyCapture = {
  detailRequests: string[];
  liveRequests: string[];
  responses: Array<Record<string, unknown>>;
  idempotencyKeys: string[];
};

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const mockSurveyApis = async (page: Page, capture: SurveyCapture) => {
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

    if (path.endsWith('/socket.io/')) {
      await json(route, { error: 'socket disabled in deterministic E2E' }, 503);
      return;
    }

    if (path === `/api/v2/public/surveys/${SURVEY_SLUG}` && request.method() === 'GET') {
      capture.detailRequests.push(request.url());
      await json(route, surveyPayload);
      return;
    }

    if (path === `/api/v2/public/surveys/${SURVEY_SLUG}/live-results` && request.method() === 'GET') {
      capture.liveRequests.push(request.url());
      await json(route, liveResultsPayload);
      return;
    }

    if (path === `/api/v2/public/surveys/${SURVEY_SLUG}/respond` && request.method() === 'POST') {
      const submitted = request.postDataJSON() as Record<string, unknown>;
      const submissionId = String(submitted.submission_id ?? '');
      capture.responses.push(submitted);
      capture.idempotencyKeys.push(request.headers()['idempotency-key'] ?? '');
      await json(route, {
        contract_version: 'surveys.public_response.v2',
        ok: true,
        persisted: true,
        replayed: false,
        respuesta_id: 9001,
        response_id: 9001,
        instrument_revision: 7,
        idempotency: {
          contract_version: 'surveys.response_receipt.v1',
          canonical_version: 'survey-response.v1',
          receipt_id: 9901,
          submission_id: submissionId,
          response_id: 9001,
          instrument_revision: 7,
          state: 'committed',
          disposition: 'accepted',
          persisted: true,
          replayed: false,
        },
        live_results_url: `/api/v2/public/surveys/${SURVEY_SLUG}/live-results?tenant_slug=junin`,
        realtime: { contract_version: 'surveys.realtime.v2', room: `encuesta:${SURVEY_SLUG}` },
      });
      return;
    }

    await json(route, {});
  });
};

for (const viewport of E2E_VIEWPORTS) {
  test(`public live voting records one option on ${viewport.label}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });

    const capture: SurveyCapture = { detailRequests: [], liveRequests: [], responses: [], idempotencyKeys: [] };
    await mockSurveyApis(page, capture);
    await page.goto(`/e/${SURVEY_SLUG}?tenant=junin`, { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: 'Votacion de prioridades barriales' })).toBeVisible();
    await expect.poll(() => capture.detailRequests.length).toBe(1);
    await expect.poll(() => capture.liveRequests.length).toBeGreaterThan(0);
    expect(new URL(capture.detailRequests[0]).searchParams.get('tenant_slug')).toBe('junin');
    expect(new URL(capture.liveRequests[0]).searchParams.get('tenant_slug')).toBe('junin');

    const selectedOption = page.getByRole('radio', { name: 'Mejorar alumbrado' });
    await selectedOption.check();
    await expect(selectedOption).toBeChecked();
    await expect(page.getByText(/8 votos/)).toHaveCount(0);

    const resultsView = page.getByRole('button', { name: 'Resultados y territorio' });
    await resultsView.click();
    await expect(resultsView).toHaveAttribute('aria-current', 'page');
    await expect(page.getByText(/8 votos · 66\.7%/).first()).toBeVisible();

    const participateView = page.getByRole('button', { name: 'Participar' });
    await participateView.click();
    await expect(participateView).toHaveAttribute('aria-current', 'page');
    await expect(selectedOption).toBeChecked();
    await expectNoHorizontalOverflow(page);
    await page.getByRole('button', { name: 'Enviar voto' }).click();

    await expect.poll(() => capture.responses.length).toBe(1);
    expect(capture.responses[0]).toMatchObject({
      submission_id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      instrument_revision: 7,
      respuestas: [{ pregunta_id: 101, opcion_ids: ['luz'] }],
      metadata: { answeredQuestions: 1, totalQuestions: 1 },
    });
    expect(capture.responses[0]).not.toHaveProperty('user_id');
    expect(capture.responses[0]).not.toHaveProperty('userId');
    expect(capture.idempotencyKeys[0]).toBe(capture.responses[0].submission_id);

    await expect(page.getByRole('heading', { name: /Gracias por participar/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Resultados en vivo' })).toBeVisible();
    await expect(page.getByText('Mejorar alumbrado').last()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expect(page.getByText('67% (8)', { exact: true })).toBeVisible();
  });
}
