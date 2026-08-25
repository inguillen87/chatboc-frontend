import {
  expect,
  test,
  type APIRequestContext,
  type Page,
  type Request,
  type Response,
  type TestInfo,
} from '@playwright/test';

import { expectNoHorizontalOverflow } from './e2e-helpers';

const previewQaEnabled = process.env.CHATBOC_REMOTE_PREVIEW_QA === '1';
const previewWriteQaEnabled = process.env.CHATBOC_REMOTE_PREVIEW_WRITE_QA === '1';
const REMOTE_WAIT_MS = 90_000;
const SURVEY_SLUG = 'demo-gobierno-junin-prioridades-barriales';
const SURVEY_PATH = `/e/${SURVEY_SLUG}?tenant_slug=junin&remote_preview_qa=1`;
const SURVEY_DETAIL_PATH = `/api/v2/public/surveys/${SURVEY_SLUG}`;
const SURVEY_LIVE_PATH = `${SURVEY_DETAIL_PATH}/live-results`;
const EXPECTED_PREVIEW_FRONTEND_HOST =
  process.env.CHATBOC_PREVIEW_FRONTEND_HOST?.trim().toLowerCase() ||
  'chatboc-r2-preview.vercel.app';
const EXPECTED_PREVIEW_SOCKET_HOST =
  process.env.CHATBOC_PREVIEW_SOCKET_HOST?.trim().toLowerCase() ||
  'api-preview.chatboc.ar';
const TARGET_PREVIEW_ORIGIN = (() => {
  const configured = process.env.PLAYWRIGHT_BASE_URL?.trim();
  try {
    return new URL(configured || `https://${EXPECTED_PREVIEW_FRONTEND_HOST}`).origin;
  } catch {
    return `https://${EXPECTED_PREVIEW_FRONTEND_HOST}`;
  }
})();

const RESPONSIVE_VIEWPORTS = [
  { label: 'mobile-390', width: 390, height: 844, minMapWidth: 300 },
  { label: 'tablet-768', width: 768, height: 1024, minMapWidth: 600 },
  { label: 'desktop-1440', width: 1440, height: 900, minMapWidth: 850 },
] as const;

const MAP_RESOURCE_PATTERN =
  /api\.maptiler|maptiler|cartocdn|stadiamaps|maplibre|openstreetmap|\.tile\.openstreetmap/i;
const CRITICAL_REQUEST_TYPES = new Set(['document', 'script', 'stylesheet', 'fetch', 'xhr']);

type JsonRecord = Record<string, unknown>;

type RemoteEvidence = {
  apiFailures: string[];
  assetFailures: string[];
  browserErrors: string[];
  criticalRequestFailures: string[];
  mapFailures: string[];
  mapSuccesses: string[];
  socketErrors: string[];
  socketFramesReceived: string[];
  socketFramesSent: string[];
  socketUrls: string[];
};

type SurveyOpenResult = {
  detailResponse: Response;
  liveResponse: Response;
};

type MapGeometry = {
  canvas: { height: number; width: number } | null;
  container: { height: number; width: number } | null;
  region: { height: number; width: number } | null;
};

const isRecord = (value: unknown): value is JsonRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const assertSafePreviewTarget = () => {
  const target = new URL(TARGET_PREVIEW_ORIGIN);
  expect(target.protocol).toBe('https:');
  expect(
    target.hostname.endsWith('.vercel.app'),
    `Remote Preview QA cannot target ${target.hostname}.`,
  ).toBe(true);
  expect(['chatboc.ar', 'www.chatboc.ar']).not.toContain(target.hostname.toLowerCase());
};

const responsePathname = (response: Response) => {
  try {
    return new URL(response.url()).pathname;
  } catch {
    return '';
  }
};

const isSuccessfulSurveyDetail = (response: Response) =>
  response.request().method() === 'GET' &&
  response.status() === 200 &&
  responsePathname(response) === SURVEY_DETAIL_PATH;

const isSuccessfulSurveyLiveResults = (response: Response) =>
  response.request().method() === 'GET' &&
  response.status() === 200 &&
  responsePathname(response) === SURVEY_LIVE_PATH;

const isSurveyResponseRequest = (request: Request) => {
  try {
    return (
      request.method() === 'POST' &&
      new URL(request.url()).pathname === `${SURVEY_DETAIL_PATH}/respond`
    );
  } catch {
    return false;
  }
};

const socketFrameText = (payload: string | Buffer) =>
  typeof payload === 'string' ? payload : payload.toString('utf8');

const attachRemoteEvidence = (page: Page): RemoteEvidence => {
  const evidence: RemoteEvidence = {
    apiFailures: [],
    assetFailures: [],
    browserErrors: [],
    criticalRequestFailures: [],
    mapFailures: [],
    mapSuccesses: [],
    socketErrors: [],
    socketFramesReceived: [],
    socketFramesSent: [],
    socketUrls: [],
  };

  const targetHost = new URL(TARGET_PREVIEW_ORIGIN).host.toLowerCase();

  page.on('pageerror', (error) => evidence.browserErrors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      evidence.browserErrors.push(`console: ${message.text()}`);
    }
  });
  page.on('response', (response) => {
    const url = response.url();
    let parsed: URL | null = null;
    try {
      parsed = new URL(url);
    } catch {
      parsed = null;
    }

    if (/\/assets\//i.test(url) && !response.ok()) {
      evidence.assetFailures.push(`${response.status()} ${url}`);
    }
    if (MAP_RESOURCE_PATTERN.test(url)) {
      if (response.ok()) {
        evidence.mapSuccesses.push(`${response.status()} ${url}`);
      } else {
        evidence.mapFailures.push(`${response.status()} ${url}`);
      }
    }
    if (
      parsed?.host.toLowerCase() === targetHost &&
      parsed.pathname.startsWith('/api/') &&
      response.status() >= 400
    ) {
      evidence.apiFailures.push(`${response.status()} ${url}`);
    }
  });
  page.on('requestfailed', (request) => {
    const failure = `${request.failure()?.errorText || 'failed'} ${request.url()}`;
    const isIntentionalMapAbort =
      MAP_RESOURCE_PATTERN.test(request.url()) && /abort|cancel/i.test(failure);
    if (isIntentionalMapAbort) return;
    if (/\/assets\//i.test(request.url())) evidence.assetFailures.push(failure);
    if (MAP_RESOURCE_PATTERN.test(request.url())) evidence.mapFailures.push(failure);
    if (CRITICAL_REQUEST_TYPES.has(request.resourceType())) {
      evidence.criticalRequestFailures.push(`${request.resourceType()} ${failure}`);
    }
  });
  page.on('websocket', (socket) => {
    evidence.socketUrls.push(socket.url());
    socket.on('framesent', (event) => {
      evidence.socketFramesSent.push(socketFrameText(event.payload));
    });
    socket.on('framereceived', (event) => {
      evidence.socketFramesReceived.push(socketFrameText(event.payload));
    });
    socket.on('socketerror', (error) => evidence.socketErrors.push(String(error)));
  });

  return evidence;
};

const openSurveyAndWaitForContracts = async (page: Page): Promise<SurveyOpenResult> => {
  assertSafePreviewTarget();
  const detailResponsePromise = page.waitForResponse(isSuccessfulSurveyDetail, {
    timeout: REMOTE_WAIT_MS,
  });
  const liveResponsePromise = page.waitForResponse(isSuccessfulSurveyLiveResults, {
    timeout: REMOTE_WAIT_MS,
  });

  const navigationResponse = await page.goto(new URL(SURVEY_PATH, TARGET_PREVIEW_ORIGIN).toString(), {
    timeout: REMOTE_WAIT_MS,
    waitUntil: 'domcontentloaded',
  });
  expect(navigationResponse?.status()).toBe(200);

  const [detailResponse, liveResponse] = await Promise.all([
    detailResponsePromise,
    liveResponsePromise,
  ]);
  expect(detailResponse.status()).toBe(200);
  expect(liveResponse.status()).toBe(200);

  return { detailResponse, liveResponse };
};

const assertCoherentSurveyContract = async (page: Page) => {
  await expect(
    page.getByRole('heading', { name: 'Distribución territorial de respuestas' }),
  ).toBeVisible({ timeout: REMOTE_WAIT_MS });
  await expect(page.getByText('Junín, Mendoza', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('Radar de decisión', { exact: false })).toHaveCount(0);

  await expect(page.getByText('Luminarias').first()).toBeVisible();
  await expect(page.getByText('26 votos · 26%', { exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Luminarias 26% \(26\)/ })).toBeVisible();
  await expect(page.getByText('Última sincronización', { exact: true })).toBeVisible();
  await expect(page.getByTestId('survey-last-updated')).not.toContainText('9/23/2026');

  await expect(
    page.getByText('Datos sintéticos de demostración', { exact: false }).first(),
  ).toBeVisible();
  await expect(page.getByText('5 ubicaciones', { exact: false }).first()).toBeVisible();
  await expect(
    page.getByText('100 respuestas representadas', { exact: false }).first(),
  ).toBeVisible();
};

const readMapGeometry = async (page: Page): Promise<MapGeometry> => {
  const region = page.getByTestId('survey-live-heatmap-map-region');
  const container = region.locator('.maplibregl-map').first();
  const canvas = region.locator('.maplibregl-canvas').first();
  const [regionBox, containerBox, canvasBox] = await Promise.all([
    region.boundingBox(),
    container.boundingBox(),
    canvas.boundingBox(),
  ]);
  const size = (box: typeof regionBox) =>
    box ? { height: box.height, width: box.width } : null;

  return {
    region: size(regionBox),
    container: size(containerBox),
    canvas: size(canvasBox),
  };
};

const hasProportionalMapGeometry = (geometry: MapGeometry) => {
  const { canvas, container, region } = geometry;
  if (!canvas || !container || !region) return false;
  if (region.height <= 0 || region.width <= 0) return false;
  if (container.height <= 0 || container.width <= 0) return false;
  if (canvas.height <= 0 || canvas.width <= 0) return false;
  return (
    container.height / region.height >= 0.9 &&
    container.width / region.width >= 0.9 &&
    canvas.height / container.height >= 0.9 &&
    canvas.width / container.width >= 0.9
  );
};

const settleRenderedFrames = async (page: Page) => {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
};

const assertMapReady = async (
  page: Page,
  evidence: RemoteEvidence,
  testInfo: TestInfo,
) => {
  const mapRegion = page.getByTestId('survey-live-heatmap-map-region');
  await mapRegion.scrollIntoViewIfNeeded();
  await expect(page.getByText('Cargando mapa...', { exact: true })).toHaveCount(0, {
    timeout: REMOTE_WAIT_MS,
  });

  const mapContainer = mapRegion.locator('.maplibregl-map').first();
  const mapCanvas = mapRegion.locator('.maplibregl-canvas').first();
  await expect(mapContainer).toBeVisible({ timeout: REMOTE_WAIT_MS });
  await expect(mapCanvas).toBeVisible({ timeout: REMOTE_WAIT_MS });
  await expect
    .poll(async () => hasProportionalMapGeometry(await readMapGeometry(page)), {
      message: 'MapLibre container and canvas must fill the territorial map region.',
      timeout: REMOTE_WAIT_MS,
    })
    .toBe(true);

  const attribution = mapRegion.locator('.maplibregl-ctrl-attrib').first();
  await expect(attribution).toBeVisible({ timeout: REMOTE_WAIT_MS });
  await expect(attribution).toContainText(/MapTiler|OpenStreetMap/i);
  await expect
    .poll(() => evidence.mapSuccesses.length, {
      message: 'The map must load at least one real style, tile, sprite, or font resource.',
      timeout: REMOTE_WAIT_MS,
    })
    .toBeGreaterThan(0);

  const densityButton = page.getByRole('button', { name: 'Densidad' });
  const pointsButton = page.getByRole('button', { name: 'Puntos' });
  await expect(densityButton).toHaveAttribute('aria-pressed', 'true');
  await mapRegion.screenshot({
    animations: 'disabled',
    path: testInfo.outputPath('territorial-map-density.png'),
  });

  await pointsButton.click();
  await expect(pointsButton).toHaveAttribute('aria-pressed', 'true');
  await expect(densityButton).toHaveAttribute('aria-pressed', 'false');
  await settleRenderedFrames(page);
  await mapRegion.screenshot({
    animations: 'disabled',
    path: testInfo.outputPath('territorial-map-points.png'),
  });

  await densityButton.click();
  await expect(densityButton).toHaveAttribute('aria-pressed', 'true');
};

const isDirectPreviewSocket = (rawUrl: string) => {
  try {
    const url = new URL(rawUrl);
    return (
      url.protocol === 'wss:' &&
      url.hostname.toLowerCase() === EXPECTED_PREVIEW_SOCKET_HOST &&
      url.pathname === '/api/socket.io/'
    );
  } catch {
    return false;
  }
};

const isFrontendSameOriginSocket = (rawUrl: string) => {
  try {
    return new URL(rawUrl).host.toLowerCase() === new URL(TARGET_PREVIEW_ORIGIN).host.toLowerCase();
  } catch {
    return false;
  }
};

const assertDirectRealtime = async (evidence: RemoteEvidence) => {
  await expect
    .poll(() => evidence.socketUrls.some(isDirectPreviewSocket), {
      message: 'Preview must connect directly to api-preview.chatboc.ar for Socket.IO.',
      timeout: REMOTE_WAIT_MS,
    })
    .toBe(true);
  expect(
    evidence.socketUrls.filter(isFrontendSameOriginSocket),
    'Cross-project same-origin WebSocket rewrites are not a valid realtime transport.',
  ).toEqual([]);
  await expect
    .poll(() => evidence.socketFramesReceived.length, {
      message: 'At least one Engine.IO/Socket.IO frame must be received.',
      timeout: REMOTE_WAIT_MS,
    })
    .toBeGreaterThan(0);
  await expect
    .poll(
      () =>
        evidence.socketFramesSent.some(
          (frame) => /join/i.test(frame) && /encuesta|survey/i.test(frame),
        ),
      {
        message: 'The public survey must join its realtime survey room.',
        timeout: REMOTE_WAIT_MS,
      },
    )
    .toBe(true);
  expect(evidence.socketErrors, evidence.socketErrors.join('\n')).toEqual([]);
};

const assertResponsiveMap = async (page: Page, testInfo: TestInfo) => {
  const mapRegion = page.getByTestId('survey-live-heatmap-map-region');
  for (const viewport of RESPONSIVE_VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await mapRegion.scrollIntoViewIfNeeded();
    await settleRenderedFrames(page);
    await expectNoHorizontalOverflow(page);
    await expect
      .poll(async () => hasProportionalMapGeometry(await readMapGeometry(page)), {
        message: `Map geometry must remain proportional at ${viewport.label}.`,
        timeout: REMOTE_WAIT_MS,
      })
      .toBe(true);

    const geometry = await readMapGeometry(page);
    expect(
      geometry.region?.width ?? 0,
      `Territorial map must provide at least ${viewport.minMapWidth}px of decision canvas at ${viewport.label}.`,
    ).toBeGreaterThanOrEqual(viewport.minMapWidth);

    for (const controlName of ['Densidad', 'Puntos', 'Ajustar área']) {
      const control = page.getByRole('button', { name: controlName });
      await expect(control).toBeVisible();
      const box = await control.boundingBox();
      expect(box, `${controlName} must have measurable geometry at ${viewport.label}.`).not.toBeNull();
      expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport.width + 1);
    }

    await mapRegion.screenshot({
      animations: 'disabled',
      path: testInfo.outputPath(`territorial-map-${viewport.label}.png`),
    });
  }
};

const collectStringsDeep = (value: unknown, output: string[] = []): string[] => {
  if (typeof value === 'string') {
    if (value.trim()) output.push(value.trim());
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStringsDeep(item, output));
    return output;
  }
  if (isRecord(value)) {
    Object.values(value).forEach((item) => collectStringsDeep(item, output));
  }
  return output;
};

const decodeRepeatedly = (value: string) => {
  let decoded = value;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }
  return decoded;
};

const collectHttpUrls = (strings: string[]) => {
  const urls = new Set<string>();
  for (const raw of strings) {
    for (const candidate of [raw, decodeRepeatedly(raw)]) {
      for (const match of candidate.matchAll(/https?:\/\/[^\s"'<>]+/gi)) {
        const cleaned = match[0].replace(/[),.;\]]+$/g, '');
        try {
          urls.add(new URL(cleaned).toString());
        } catch {
          // Ignore free text that merely resembles a URL.
        }
      }
    }
  }
  return [...urls];
};

const findFirstStringByKey = (value: unknown, key: string): string | null => {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstStringByKey(item, key);
      if (found) return found;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  const direct = value[key];
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  for (const item of Object.values(value)) {
    const found = findFirstStringByKey(item, key);
    if (found) return found;
  }
  return null;
};

const findFirstNumberByKeys = (value: unknown, keys: Set<string>): number | null => {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstNumberByKeys(item, keys);
      if (found !== null) return found;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  for (const [key, candidate] of Object.entries(value)) {
    if (keys.has(key)) {
      const numeric = typeof candidate === 'number' ? candidate : Number(candidate);
      if (Number.isFinite(numeric)) return numeric;
    }
  }
  for (const item of Object.values(value)) {
    const found = findFirstNumberByKeys(item, keys);
    if (found !== null) return found;
  }
  return null;
};

const stringHeaders = (value: unknown): Record<string, string> => {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, string] =>
        typeof entry[1] === 'string' && Boolean(entry[1].trim()),
      )
      .map(([key, headerValue]) => [key, headerValue.trim()]),
  );
};

const appendScalarQuery = (url: URL, value: unknown) => {
  if (!isRecord(value)) return;
  for (const [key, queryValue] of Object.entries(value)) {
    if (typeof queryValue === 'string' || typeof queryValue === 'number' || typeof queryValue === 'boolean') {
      url.searchParams.set(key, String(queryValue));
    }
  }
};

const loadDemoChatBootstrap = async (request: APIRequestContext) => {
  assertSafePreviewTarget();
  const response = await request.post(new URL('/api/v2/demo/session', TARGET_PREVIEW_ORIGIN).toString(), {
    data: {
      sector: 'gobierno',
      tenant_slug: 'junin',
      surface: 'web',
      source: 'remote_preview_qa',
    },
    timeout: REMOTE_WAIT_MS,
  });
  expect(response.status()).toBe(200);
  const payload: unknown = await response.json();
  expect(isRecord(payload) && payload.ok === true).toBe(true);
  const root = isRecord(payload) ? payload : {};
  const workspace = isRecord(root.workspace) ? root.workspace : {};
  const chatSeed = isRecord(workspace.chat_seed) ? workspace.chat_seed : {};
  const bootstrapCandidates = [
    workspace.chat_bootstrap,
    root.chat_bootstrap,
    chatSeed.chat_bootstrap,
  ];
  const bootstrap = bootstrapCandidates.find(isRecord) ?? null;
  expect(bootstrap, 'The backend demo session must provide a usable chat bootstrap.').not.toBeNull();
  if (!bootstrap) throw new Error('Missing demo chat bootstrap.');
  return bootstrap;
};

const requestSurveyMenuPages = async (
  request: APIRequestContext,
  bootstrap: JsonRecord,
) => {
  const endpoint =
    (typeof bootstrap.same_origin_endpoint === 'string' && bootstrap.same_origin_endpoint.trim()) ||
    (typeof bootstrap.endpoint === 'string' && bootstrap.endpoint.trim()) ||
    '';
  expect(endpoint).not.toBe('');
  const endpointUrl = new URL(endpoint, TARGET_PREVIEW_ORIGIN);
  expect(
    endpointUrl.host.toLowerCase(),
    'The conversational Preview smoke must never call Production directly.',
  ).toBe(new URL(TARGET_PREVIEW_ORIGIN).host.toLowerCase());
  appendScalarQuery(endpointUrl, bootstrap.query);

  const headers = stringHeaders(bootstrap.headers);
  const basePayload = isRecord(bootstrap.payload) ? bootstrap.payload : {};
  const pages: unknown[] = [];
  const seenActions = new Set<string>();
  let actionId: string | null = 'mostrar_menu_encuestas';

  while (actionId && pages.length < 10 && !seenActions.has(actionId)) {
    seenActions.add(actionId);
    const response = await request.post(endpointUrl.toString(), {
      data: {
        ...basePayload,
        pregunta: 'Ver encuestas y votaciones',
        action_id: actionId,
        intent: actionId,
      },
      headers,
      timeout: REMOTE_WAIT_MS,
    });
    expect(response.status()).toBe(200);
    const payload: unknown = await response.json();
    pages.push(payload);
    actionId = findFirstStringByKey(payload, 'next_action_id');
  }

  return pages;
};

test.describe('remote Preview territorial evidence', () => {
  test.skip(!previewQaEnabled, 'Runs only against the explicit Vercel Preview QA target.');

  test('validates the executive map, direct realtime, responsive layout and clean runtime', async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const evidence = attachRemoteEvidence(page);

    await openSurveyAndWaitForContracts(page);
    await assertCoherentSurveyContract(page);
    await assertMapReady(page, evidence, testInfo);
    await assertDirectRealtime(evidence);
    await assertResponsiveMap(page, testInfo);

    expect(evidence.assetFailures, evidence.assetFailures.join('\n')).toEqual([]);
    expect(evidence.mapFailures, evidence.mapFailures.join('\n')).toEqual([]);
    expect(evidence.apiFailures, evidence.apiFailures.join('\n')).toEqual([]);
    expect(
      evidence.criticalRequestFailures,
      evidence.criticalRequestFailures.join('\n'),
    ).toEqual([]);
    expect(evidence.browserErrors, evidence.browserErrors.join('\n')).toEqual([]);
  });

  test('keeps every conversational survey, QR and WhatsApp URL on Preview', async ({ request }) => {
    test.setTimeout(240_000);
    const bootstrap = await loadDemoChatBootstrap(request);
    const menuPages = await requestSurveyMenuPages(request, bootstrap);
    expect(menuPages.length).toBeGreaterThan(0);
    expect(findFirstStringByKey(menuPages, 'fuente')).toMatch(/encuestas_menu/i);

    const rawStrings = collectStringsDeep(menuPages);
    const decodedStrings = rawStrings.map(decodeRepeatedly);
    const urls = collectHttpUrls([...rawStrings, ...decodedStrings]);
    const surveyUrls = urls.filter((rawUrl) => {
      try {
        const pathname = new URL(rawUrl).pathname;
        return (
          pathname.startsWith('/e/') ||
          pathname.startsWith('/encuestas/') ||
          pathname.startsWith('/api/public/encuestas/')
        );
      } catch {
        return false;
      }
    });

    expect(surveyUrls.length, 'The menu must expose at least one operable survey URL.').toBeGreaterThan(0);
    for (const rawUrl of surveyUrls) {
      const url = new URL(rawUrl);
      expect(url.hostname.toLowerCase(), rawUrl).toBe(EXPECTED_PREVIEW_FRONTEND_HOST);
    }
    expect(
      surveyUrls.filter((rawUrl) => {
        const hostname = new URL(rawUrl).hostname.toLowerCase();
        return hostname === 'chatboc.ar' || hostname === 'www.chatboc.ar';
      }),
      'No conversational survey URL may leak to Production.',
    ).toEqual([]);
    const participationUrls = surveyUrls.filter((rawUrl) =>
      new URL(rawUrl).pathname.startsWith('/e/'),
    );
    const qrUrls = surveyUrls.filter((rawUrl) => new URL(rawUrl).pathname.endsWith('/qr'));
    expect(new Set(participationUrls).size).toBeGreaterThanOrEqual(6);
    expect(new Set(qrUrls).size).toBeGreaterThanOrEqual(6);
    expect(
      decodedStrings.some(
        (value) => value.includes('wa.me/') && value.includes(EXPECTED_PREVIEW_FRONTEND_HOST),
      ),
      'The WhatsApp share payload must embed the Preview participation URL.',
    ).toBe(true);
  });
});

test.describe('remote Preview single-write QA vote', () => {
  test.describe.configure({ retries: 0 });
  test.skip(
    !previewQaEnabled || !previewWriteQaEnabled,
    'Requires both CHATBOC_REMOTE_PREVIEW_QA=1 and the explicit one-shot write gate.',
  );

  test('casts exactly one idempotent QA vote and reaches 101 responses', async ({ page }) => {
    test.setTimeout(240_000);
    const submittedRequests: Request[] = [];
    page.on('request', (request) => {
      if (isSurveyResponseRequest(request)) submittedRequests.push(request);
    });

    const { liveResponse } = await openSurveyAndWaitForContracts(page);
    const initialLivePayload: unknown = await liveResponse.json();
    expect(
      findFirstNumberByKeys(initialLivePayload, new Set(['total_respuestas', 'total_responses'])),
      'The one-shot QA vote must start from the deterministic 100-response fixture.',
    ).toBe(100);

    const turnstile = page.getByTestId('survey-turnstile-challenge');
    await expect(turnstile).toBeVisible({ timeout: REMOTE_WAIT_MS });
    await expect(turnstile).toContainText('Validado', { timeout: REMOTE_WAIT_MS });
    await expect(page.locator('iframe[src*="challenges.cloudflare.com"]').first()).toBeVisible({
      timeout: REMOTE_WAIT_MS,
    });

    const selectedOption = page.getByRole('radio', { name: /Luminarias 26% \(26\)/ });
    await selectedOption.check();
    await expect(selectedOption).toBeChecked();

    const submitButton = page.getByRole('button', { name: 'Enviar voto' });
    await expect(submitButton).toBeEnabled({ timeout: REMOTE_WAIT_MS });
    const responseRequestPromise = page.waitForRequest(isSurveyResponseRequest, {
      timeout: REMOTE_WAIT_MS,
    });
    const responsePromise = page.waitForResponse(
      (response) => isSurveyResponseRequest(response.request()),
      { timeout: REMOTE_WAIT_MS },
    );

    await submitButton.click();
    const [responseRequest, response] = await Promise.all([
      responseRequestPromise,
      responsePromise,
    ]);
    expect(response.ok()).toBe(true);
    const submittedPayload = responseRequest.postDataJSON() as JsonRecord;
    const idempotencyKey = responseRequest.headers()['idempotency-key'] || '';
    expect(idempotencyKey).toMatch(/^[0-9a-f-]{36}$/i);
    expect(idempotencyKey).toBe(submittedPayload.submission_id);

    await expect(page.getByRole('heading', { name: /Gracias por participar/i })).toBeVisible({
      timeout: REMOTE_WAIT_MS,
    });
    await page.waitForTimeout(1_000);
    expect(submittedRequests).toHaveLength(1);

    const liveUrl = new URL(SURVEY_LIVE_PATH, TARGET_PREVIEW_ORIGIN);
    liveUrl.searchParams.set('tenant_slug', 'junin');
    liveUrl.searchParams.set('include_heatmap', '0');
    await expect
      .poll(
        async () => {
          const live = await page.request.get(liveUrl.toString(), { timeout: REMOTE_WAIT_MS });
          if (!live.ok()) return null;
          const payload: unknown = await live.json();
          return findFirstNumberByKeys(payload, new Set(['total_respuestas', 'total_responses']));
        },
        {
          intervals: [1_000, 2_000, 5_000],
          message: 'The persisted QA response must be visible as response 101.',
          timeout: REMOTE_WAIT_MS,
        },
      )
      .toBe(101);
  });
});
