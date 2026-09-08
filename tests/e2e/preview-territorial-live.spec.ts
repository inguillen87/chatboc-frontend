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
const SURVEY_ROOM = `encuesta:junin:${SURVEY_SLUG}`;
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

type StartupRequest = {
  kind: 'api' | 'socket';
  method: string;
  url: string;
  order: number;
  startedAtMs: number;
};

type BootstrapResponse = {
  url: string;
  method: string;
  status: number;
  order: number;
  body: unknown;
  retryAfter: string | null;
  finishedAtMs: number | null;
  finishedOrder: number | null;
  outcome: 'pending' | 'initializing' | 'ready' | 'invalid';
};

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
  bootstrapRequests: StartupRequest[];
  bootstrapResponses: BootstrapResponse[];
  bootstrapFailures: string[];
  bootstrapConsole: { url: string; text: string; validated: boolean | null }[];
  startupRequests: StartupRequest[];
  settleBootstrap: () => Promise<void>;
};

const remoteEvidenceByPage = new WeakMap<Page, RemoteEvidence>();

const isSameOriginReadinessUrl = (rawUrl: string) => {
  try {
    const url = new URL(rawUrl);
    return url.origin === TARGET_PREVIEW_ORIGIN && url.pathname === '/api/version' &&
      !url.search && !url.hash;
  } catch {
    return false;
  }
};

const validateBootstrapResponse = async (response: Response, record: BootstrapResponse) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const text = await Promise.race([
      (async () => {
        const failure = await response.finished();
        if (failure) throw failure;
        return response.text();
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Readiness response body did not finish.')), 30_000);
      }),
    ]);
    record.body = text;
    record.body = JSON.parse(text) as unknown;
    const timing = response.request().timing();
    if (timing.startTime <= 0 || timing.responseEnd < 0) {
      throw new Error('Missing readiness completion timing evidence.');
    }
    record.finishedAtMs = timing.startTime + timing.responseEnd;
    if (record.status === 503) {
      const retryAfter = Number(record.retryAfter);
      if (!isRecord(record.body) ||
        record.body.contract_version !== 'chatboc.bootstrap.v1' ||
        record.body.reason_code !== 'application_initializing' ||
        record.body.retryable !== true || !record.retryAfter?.trim() ||
        !Number.isFinite(retryAfter) || retryAfter <= 0 || retryAfter > 5) {
        throw new Error('Readiness 503 must match the bootstrap contract and Retry-After in (0, 5] seconds.');
      }
      record.outcome = 'initializing';
      return;
    }
    if (record.status !== 200 || !isRecord(record.body) ||
      typeof record.body.backend !== 'string' || !record.body.backend.trim() ||
      typeof record.body.frontend !== 'string') {
      throw new Error('Readiness must finish with HTTP 200 and the backend/frontend version JSON.');
    }
    record.outcome = 'ready';
  } finally {
    clearTimeout(timer);
  }
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

const parseSocketIoEventFrame = (frame: string): unknown[] | null => {
  const payloadStart = frame.indexOf('[');
  if (payloadStart < 0) return null;
  try {
    const payload = JSON.parse(frame.slice(payloadStart));
    return Array.isArray(payload) ? payload : null;
  } catch {
    return null;
  }
};

const isSurveyJoinAck = (frame: string) => {
  const event = parseSocketIoEventFrame(frame);
  const payload = isRecord(event?.[1]) ? event[1] : null;
  return (
    event?.[0] === 'join_ack' &&
    payload?.room === SURVEY_ROOM &&
    payload?.access_mode === 'public_survey_room'
  );
};

const isSurveyJoinError = (frame: string) => {
  const event = parseSocketIoEventFrame(frame);
  const payload = isRecord(event?.[1]) ? event[1] : null;
  return event?.[0] === 'join_error' && payload?.room === SURVEY_ROOM;
};

const isCommittedSurveyUpdate = (
  frame: string,
  responseId: unknown,
  expectedTotal: number,
) => {
  const socketEvent = parseSocketIoEventFrame(frame);
  const payload = isRecord(socketEvent?.[1]) ? socketEvent[1] : null;
  const event = isRecord(payload?.event) ? payload.event : null;
  return (
    socketEvent?.[0] === 'survey_update_v2' &&
    payload?.contract_version === 'surveys.live_results.v2' &&
    payload?.slug === SURVEY_SLUG &&
    payload?.tenant_slug === 'junin' &&
    payload?.total_respuestas === expectedTotal &&
    payload?.result_version === expectedTotal &&
    event?.event_name === 'survey.response.committed' &&
    event?.response_id === responseId
  );
};

const attachRemoteEvidence = (page: Page): RemoteEvidence => {
  const pendingBootstrapResponses = new Set<Promise<void>>();
  const matchedBootstrapConsoleResponses = new Set<BootstrapResponse>();
  const requests = new Map<Request, StartupRequest>();
  const bootstrapResponses = new Map<Request, BootstrapResponse>();
  let eventOrder = 0;
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
    bootstrapRequests: [],
    bootstrapResponses: [],
    bootstrapFailures: [],
    bootstrapConsole: [],
    startupRequests: [],
    settleBootstrap: async () => {
      // Response listeners are asynchronous: assertions must not race body validation.
      while (pendingBootstrapResponses.size) {
        await Promise.all([...pendingBootstrapResponses]);
      }
      for (const message of evidence.bootstrapConsole) {
        if (message.validated !== null) continue;
        const response = evidence.bootstrapResponses.find((candidate) =>
          candidate.url === message.url && candidate.outcome === 'initializing' &&
          !matchedBootstrapConsoleResponses.has(candidate),
        );
        message.validated = Boolean(response);
        if (response) matchedBootstrapConsoleResponses.add(response);
        else evidence.browserErrors.push(`console: ${message.text} ${message.url} (no validated bootstrap 503)`);
      }
    },
  };
  remoteEvidenceByPage.set(page, evidence);

  const targetHost = new URL(TARGET_PREVIEW_ORIGIN).host.toLowerCase();

  page.on('pageerror', (error) => evidence.browserErrors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      const url = message.location().url;
      if (isSameOriginReadinessUrl(url) &&
        /^Failed to load resource: the server responded with a status of 503(?: \([^\n]*\))?$/.test(message.text())) {
        evidence.bootstrapConsole.push({ url, text: message.text(), validated: null });
        return;
      }
      evidence.browserErrors.push(`console: ${message.text()}`);
    }
  });
  page.on('request', (request) => {
    const record: StartupRequest = {
      kind: 'api', method: request.method(), url: request.url(),
      order: ++eventOrder, startedAtMs: request.timing().startTime,
    };
    requests.set(request, record);
    if (record.method === 'GET' && isSameOriginReadinessUrl(record.url)) {
      evidence.bootstrapRequests.push(record);
      return;
    }
    const url = new URL(record.url);
    if (/^\/(?:api|ask|socket\.io)(?:\/|$)/.test(url.pathname) &&
      !MAP_RESOURCE_PATTERN.test(record.url)) {
      evidence.startupRequests.push(record);
    }
  });
  page.on('response', (response) => {
    const order = ++eventOrder;
    const request = response.request();
    const startupRequest = requests.get(request);
    // Playwright supplies network startTime on the response, not the request event.
    if (startupRequest) startupRequest.startedAtMs = request.timing().startTime;
    const url = response.url();
    let parsed: URL | null = null;
    try {
      parsed = new URL(url);
    } catch {
      parsed = null;
    }

    if (response.request().method() === 'GET' && isSameOriginReadinessUrl(url)) {
      const record: BootstrapResponse = {
        url, method: 'GET', status: response.status(), order, body: null,
        retryAfter: response.headers()['retry-after'] ?? null,
        finishedAtMs: null, finishedOrder: null, outcome: 'pending',
      };
      evidence.bootstrapResponses.push(record);
      bootstrapResponses.set(request, record);
      const validation = validateBootstrapResponse(response, record).catch((error: unknown) => {
        record.outcome = 'invalid';
        const failure = `${record.status} ${url}: ${String(error)}`;
        evidence.bootstrapFailures.push(failure);
        evidence.apiFailures.push(failure);
      }).finally(() => pendingBootstrapResponses.delete(validation));
      pendingBootstrapResponses.add(validation);
      return;
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
  page.on('requestfinished', (request) => {
    const order = ++eventOrder;
    const bootstrapResponse = bootstrapResponses.get(request);
    if (bootstrapResponse) bootstrapResponse.finishedOrder = order;
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
    evidence.startupRequests.push({
      kind: 'socket', method: 'CONNECT', url: socket.url(),
      order: ++eventOrder, startedAtMs: Date.now(),
    });
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

const assertCleanRuntime = async (evidence: RemoteEvidence) => {
  await evidence.settleBootstrap();
  expect(evidence.bootstrapFailures, evidence.bootstrapFailures.join('\n')).toEqual([]);
  if (evidence.bootstrapRequests.length) {
    expect(evidence.bootstrapResponses).toHaveLength(evidence.bootstrapRequests.length);
    const ready = evidence.bootstrapResponses.find((response) => response.outcome === 'ready');
    expect(ready, 'An observed readiness probe must eventually return validated version JSON.').toBeDefined();
    if (!ready || ready.finishedAtMs === null || ready.finishedOrder === null) {
      throw new Error('No completed readiness response.');
    }
    const { finishedAtMs, finishedOrder } = ready;
    const prematureRequests = evidence.startupRequests.filter((request) =>
      request.kind === 'socket'
        ? request.order < finishedOrder
        : request.startedAtMs <= 0 || request.startedAtMs < finishedAtMs || request.order < ready.order,
    );
    expect(prematureRequests, 'No business API request or socket may start before the validated readiness body finishes.').toEqual([]);
  }
  expect(evidence.assetFailures, evidence.assetFailures.join('\n')).toEqual([]);
  expect(evidence.mapFailures, evidence.mapFailures.join('\n')).toEqual([]);
  expect(evidence.apiFailures, evidence.apiFailures.join('\n')).toEqual([]);
  expect(evidence.criticalRequestFailures, evidence.criticalRequestFailures.join('\n')).toEqual([]);
  expect(evidence.browserErrors, evidence.browserErrors.join('\n')).toEqual([]);
  expect(evidence.socketErrors, evidence.socketErrors.join('\n')).toEqual([]);
};

test.afterEach(async ({ page }, testInfo) => {
  const evidence = remoteEvidenceByPage.get(page);
  if (!evidence) return;
  await evidence.settleBootstrap();
  const { settleBootstrap: _settleBootstrap, ...snapshot } = evidence;
  await testInfo.attach('remote-runtime-and-cold-start-evidence', {
    body: JSON.stringify(snapshot, null, 2),
    contentType: 'application/json',
  });
});

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
  const resultsTab = page.getByRole('button', { name: 'Resultados y territorio' });
  await expect(resultsTab).toBeVisible({ timeout: REMOTE_WAIT_MS });
  await resultsTab.click();

  await expect(
    page.getByRole('heading', { name: 'Distribución territorial de respuestas' }),
  ).toBeVisible({ timeout: REMOTE_WAIT_MS });
  await expect(page.getByText('Junín, Mendoza', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('Radar de decisión', { exact: false })).toHaveCount(0);

  await expect(page.getByText('Luminarias').first()).toBeVisible();
  await expect(page.getByText(/\d+ votos · \d+(?:[.,]\d+)?%/).first()).toBeVisible();
  await expect(page.getByRole('progressbar', { name: /Luminarias/ })).toBeVisible();
  await expect(page.getByTestId('survey-last-updated')).toBeVisible();
  await expect(page.getByTestId('survey-last-updated')).not.toContainText('9/23/2026');

  await expect(
    page.getByText('Datos sintéticos de demostración', { exact: false }).first(),
  ).toBeVisible();
  await expect(page.getByText('5 ubicaciones', { exact: false }).first()).toBeVisible();
  await expect(
    page.getByText(/\d+ respuestas representadas/i).first(),
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

const alignMapBelowFixedNavbar = async (page: Page) => {
  const mapRegion = page.getByTestId('survey-live-heatmap-map-region');
  await mapRegion.evaluate(async (element) => {
    const root = document.documentElement;
    const previousScrollBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    element.scrollIntoView({ behavior: 'auto', block: 'start', inline: 'nearest' });
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    root.style.scrollBehavior = previousScrollBehavior;
  });
  await settleRenderedFrames(page);

  const mapBox = await mapRegion.boundingBox();
  const navbar = page.locator('.chatboc-brand-navbar').first();
  const navbarBox = (await navbar.count()) > 0 ? await navbar.boundingBox() : null;
  expect(mapBox, 'The territorial map must have measurable viewport geometry.').not.toBeNull();
  if (navbarBox) {
    expect(
      mapBox?.y ?? 0,
      'The fixed navbar must not cover the territorial evidence or native map controls.',
    ).toBeGreaterThanOrEqual(navbarBox.y + navbarBox.height);
  } else {
    expect(mapBox?.y ?? -1, 'The public survey map must remain inside the viewport flow.').toBeGreaterThanOrEqual(0);
  }
};

const assertMapReady = async (
  page: Page,
  evidence: RemoteEvidence,
  testInfo: TestInfo,
) => {
  const mapRegion = page.getByTestId('survey-live-heatmap-map-region');
  await alignMapBelowFixedNavbar(page);
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
  await expect(mapRegion).toContainText('Escenario demostrativo');
  await expect(mapRegion).toContainText('No representa datos municipales reales.');
  await expect(mapRegion).not.toContainText('demo_seeded_responses');
  await expect
    .poll(() => evidence.mapSuccesses.length, {
      message: 'The map must load at least one real style, tile, sprite, or font resource.',
      timeout: REMOTE_WAIT_MS,
    })
    .toBeGreaterThan(0);

  const mapOptions = page.getByTestId('survey-live-heatmap-map-options');
  await expect(mapOptions).toBeVisible();
  if ((await mapOptions.getAttribute('open')) === null) {
    await mapOptions.locator('summary').click();
  }
  await expect(mapOptions).toHaveAttribute('open', '');

  const densityButton = page.getByRole('button', { name: 'Densidad' });
  const pointsButton = page.getByRole('button', { name: 'Puntos', exact: true });
  await densityButton.click();
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
  await expect
    .poll(() => evidence.socketFramesReceived.some(isSurveyJoinAck), {
      message: `Backend must acknowledge membership in the exact tenant-scoped room ${SURVEY_ROOM}.`,
      timeout: REMOTE_WAIT_MS,
    })
    .toBe(true);
  expect(
    evidence.socketFramesReceived.filter(isSurveyJoinError),
    `Backend rejected the canonical survey room ${SURVEY_ROOM}.`,
  ).toEqual([]);
  expect(evidence.socketErrors, evidence.socketErrors.join('\n')).toEqual([]);
};

const assertResponsiveMap = async (page: Page, testInfo: TestInfo) => {
  const mapRegion = page.getByTestId('survey-live-heatmap-map-region');
  for (const viewport of RESPONSIVE_VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await alignMapBelowFixedNavbar(page);
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
      const control = page.getByRole('button', { name: controlName, exact: true });
      await expect(control).toBeVisible();
      const box = await control.boundingBox();
      expect(box, `${controlName} must have measurable geometry at ${viewport.label}.`).not.toBeNull();
      expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport.width + 1);
    }

    const quantitativeLegend = page.getByTestId('survey-live-heatmap-quantitative-legend');
    const compactLegendSummary = page.getByTestId('survey-live-heatmap-legend-summary');
    await expect(quantitativeLegend).toBeVisible();
    if (viewport.width < 640) {
      await expect(compactLegendSummary).toBeVisible();
      const legendBox = await quantitativeLegend.boundingBox();
      expect(legendBox, 'The compact mobile legend must have measurable geometry.').not.toBeNull();
      expect(
        legendBox?.height ?? Number.POSITIVE_INFINITY,
        'The collapsed mobile legend must preserve the decision canvas.',
      ).toBeLessThanOrEqual(64);

      const evidenceBadgeBox = await mapRegion.getByTestId('map-evidence-badge').boundingBox();
      const nativeControlsBox = await mapRegion.locator('.maplibregl-ctrl-top-right').first().boundingBox();
      expect(evidenceBadgeBox, 'The map evidence badge must have measurable geometry.').not.toBeNull();
      expect(nativeControlsBox, 'The native MapLibre controls must have measurable geometry.').not.toBeNull();
      expect(
        (evidenceBadgeBox?.x ?? 0) + (evidenceBadgeBox?.width ?? 0),
        'The evidence badge must reserve the mobile control column.',
      ).toBeLessThanOrEqual(nativeControlsBox?.x ?? 0);
    } else {
      await expect(compactLegendSummary).toBeHidden();
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

    await assertCleanRuntime(evidence);
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

test.describe('remote Preview durable demo participation gate', () => {
  test.describe.configure({ retries: 0 });
  test.skip(
    !previewQaEnabled || !previewWriteQaEnabled,
    'Requires both CHATBOC_REMOTE_PREVIEW_QA=1 and the explicit one-shot write gate.',
  );

  test('persists exactly one isolated QA interaction and exposes its durable receipt', async ({ page }) => {
    test.setTimeout(240_000);
    const evidence = attachRemoteEvidence(page);
    const submittedRequests: Request[] = [];
    page.on('request', (request) => {
      if (isSurveyResponseRequest(request)) submittedRequests.push(request);
    });

    const { liveResponse } = await openSurveyAndWaitForContracts(page);
    const initialLivePayload: unknown = await liveResponse.json();
    const initialTotal = findFirstNumberByKeys(
      initialLivePayload,
      new Set(['total_respuestas', 'total_responses']),
    );
    const seededResponses = findFirstNumberByKeys(
      initialLivePayload,
      new Set(['seeded_responses']),
    );
    expect(initialTotal, 'The live contract must expose its current response total.').not.toBeNull();
    expect(seededResponses, 'The demo contract must disclose its synthetic baseline.').not.toBeNull();
    if (initialTotal === null || seededResponses === null) {
      throw new Error('Preview demo live results omitted the dynamic total or seeded baseline.');
    }
    await assertDirectRealtime(evidence);
    expect(Number.isSafeInteger(initialTotal)).toBe(true);
    expect(Number.isSafeInteger(seededResponses)).toBe(true);
    expect(initialTotal).toBeGreaterThanOrEqual(seededResponses);

    const turnstile = page.getByTestId('survey-turnstile-challenge');
    await expect(turnstile).toBeVisible({ timeout: REMOTE_WAIT_MS });
    await expect(turnstile).toContainText('Validado', { timeout: REMOTE_WAIT_MS });
    await expect(page.locator('script#chatboc-cloudflare-turnstile')).toHaveAttribute(
      'src',
      /challenges\.cloudflare\.com\/turnstile\/v0\/api\.js/,
    );
    await expect
      .poll(() => page.evaluate(() => Boolean(window.turnstile)), {
        message: 'Cloudflare Turnstile must initialize before the QA vote is enabled.',
        timeout: REMOTE_WAIT_MS,
      })
      .toBe(true);

    const selectedOption = page.getByRole('radio', { name: /Luminarias/ });
    await selectedOption.check();
    await expect(selectedOption).toBeChecked();

    const submitButton = page.getByRole('button', { name: 'Simular participación' });
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
    const responsePayload = (await response.json()) as JsonRecord;
    expect(responsePayload.contract_version).toBe('surveys.public_response.v2');
    expect(responsePayload.participation_contract_version).toBe('demo.survey_participation.v1');
    expect(responsePayload.ok).toBe(true);
    expect(responsePayload.accepted).toBe(true);
    expect(responsePayload.demo_mode).toBe(true);
    expect(responsePayload.persisted).toBe(true);
    expect(responsePayload.durable).toBe(true);
    expect(responsePayload.municipal_truth).toBe(false);
    expect(responsePayload.response_origin).toBe('interactive_demo');
    expect(responsePayload.slug).toBe(SURVEY_SLUG);
    expect(responsePayload.realtime).toMatchObject({
      room: SURVEY_ROOM,
      primary_room: SURVEY_ROOM,
      rooms: [SURVEY_ROOM],
      delivery: 'publish_accepted',
    });
    expect(responsePayload.seeded_responses_before).toBe(seededResponses);
    expect(responsePayload.seeded_responses_after).toBe(seededResponses);
    expect(responsePayload.total_responses_after).toBe(initialTotal + 1);
    expect(responsePayload.persistence).toMatchObject({
      contract_version: 'demo.survey_persistence.v1',
      state: 'durable_preview',
      durable: true,
      database_write: true,
      scope: 'interactive_demo_only',
      municipal_truth: false,
    });
    const submittedPayload = responseRequest.postDataJSON() as JsonRecord;
    const idempotencyKey = responseRequest.headers()['idempotency-key'] || '';
    expect(idempotencyKey).toMatch(/^[0-9a-f-]{36}$/i);
    expect(idempotencyKey).toBe(submittedPayload.submission_id);
    expect(Number.isSafeInteger(responsePayload.instrument_revision)).toBe(true);
    if (submittedPayload.instrument_revision !== undefined) {
      expect(responsePayload.instrument_revision).toBe(submittedPayload.instrument_revision);
    }
    expect(responsePayload.idempotency).toMatchObject({
      contract_version: 'surveys.response_receipt.v1',
      canonical_version: 'survey-response.v1',
      submission_id: submittedPayload.submission_id,
      instrument_revision: responsePayload.instrument_revision,
      state: 'committed',
      disposition: 'accepted',
      persisted: true,
      replayed: false,
    });
    await expect
      .poll(
        () =>
          evidence.socketFramesReceived.some((frame) =>
            isCommittedSurveyUpdate(frame, responsePayload.response_id, initialTotal + 1),
          ),
        {
          message: 'The committed QA participation must reach the exact joined room as survey_update_v2.',
          timeout: REMOTE_WAIT_MS,
        },
      )
      .toBe(true);

    await expect(page.getByRole('heading', { name: 'Participación demo guardada en Preview' })).toBeVisible({
      timeout: REMOTE_WAIT_MS,
    });
    await expect(page.getByText(/entorno QA de Preview/i)).toBeVisible({
      timeout: REMOTE_WAIT_MS,
    });
    await expect(page.getByText(/separada de cualquier dato ciudadano o resultado oficial/i)).toBeVisible({
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
          message: 'The durable Preview interaction must increment the dynamic demo total once.',
          timeout: REMOTE_WAIT_MS,
        },
      )
      .toBe(initialTotal + 1);
    await assertCleanRuntime(evidence);
  });
});
