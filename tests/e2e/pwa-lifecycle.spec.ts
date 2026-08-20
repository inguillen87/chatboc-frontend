import { expect, test } from '@playwright/test';
import { readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const distPath = (...segments: string[]) => path.resolve(process.cwd(), 'dist', ...segments);
const legacyBootstrapPath = distPath('__pwa-legacy-bootstrap.html');
const legacyWorkerPath = distPath('__pwa-legacy-worker.js');

const writeLegacyPwaFixture = () => {
  writeFileSync(legacyBootstrapPath, '<!doctype html><title>Legacy PWA bootstrap</title>', 'utf8');
  writeFileSync(
    legacyWorkerPath,
    `self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname !== '/api/legacy-probe') return;
  event.respondWith(
    caches.open('app-api').then(async (cache) => {
      const response = new Response('legacy-sensitive-response');
      await cache.put(event.request, response.clone());
      return response;
    }),
  );
});
`,
    'utf8',
  );
};

const removeLegacyPwaFixture = () => {
  rmSync(legacyBootstrapPath, { force: true });
  rmSync(legacyWorkerPath, { force: true });
};

test('installs a compact shell, controls the client and reloads offline', async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-pwa', 'requires the production build preview');

  const indexHtml = readFileSync(distPath('index.html'), 'utf8');
  const portalHtml = readFileSync(distPath('portal', 'index.html'), 'utf8');
  const serviceWorkerSource = readFileSync(distPath('sw.js'), 'utf8');
  const viteManifest = JSON.parse(readFileSync(distPath('.vite', 'manifest.json'), 'utf8')) as Record<
    string,
    { file: string }
  >;
  const rawPrecacheUrls = Array.from(
    serviceWorkerSource.matchAll(/\{url:"([^"]+)"/g),
    (match) => match[1],
  );
  const precacheUrls = Array.from(new Set(rawPrecacheUrls));

  expect(serviceWorkerSource).toContain('SKIP_WAITING');
  expect(serviceWorkerSource).not.toContain('self.skipWaiting(),');
  expect(serviceWorkerSource).toContain('clientsClaim');
  expect(serviceWorkerSource).toContain('createHandlerBoundToURL("index.html")');
  expect(serviceWorkerSource).toContain('importScripts("sw-cache-hygiene.js")');
  expect(serviceWorkerSource).not.toContain('importScripts("sw-recovery.js")');
  expect(serviceWorkerSource).not.toContain('app-api');
  expect(serviceWorkerSource).not.toContain('public-api');
  expect(serviceWorkerSource).not.toContain('public-demo-api');
  expect(serviceWorkerSource).toContain('portal-navigation');
  expect(serviceWorkerSource).toContain('/portal/index.html');
  expect(serviceWorkerSource).toContain('/^\\/widget\\.js$/');
  expect(precacheUrls).toContain('index.html');
  expect(precacheUrls).toContain('portal/index.html');
  expect(precacheUrls).toContain('branding/chatboc-2026/chatboc-agent-launcher-static.svg');
  expect(precacheUrls).toContain(viteManifest['src/components/chat/ChatWidget.tsx'].file);
  expect(precacheUrls).toContain(viteManifest['src/components/chat/ProactiveBubble.tsx'].file);
  expect(precacheUrls).toContain(viteManifest['src/pages/encuestas/index.tsx'].file);
  expect(precacheUrls).toContain(viteManifest['src/pages/user-portal/UserDashboardPage.tsx'].file);
  expect(rawPrecacheUrls, 'precache manifest must not contain duplicate URLs').toHaveLength(
    precacheUrls.length,
  );
  expect(precacheUrls.length).toBeLessThan(80);
  const precacheBytes = precacheUrls.reduce(
    (total, url) => total + statSync(distPath(url.split(/[?#]/, 1)[0])).size,
    0,
  );
  expect(precacheBytes).toBeLessThan(4 * 1024 * 1024);

  const initialAssetUrls = Array.from(
    indexHtml.matchAll(/\b(?:src|href)=["']\/([^"'?#]+)(?:[?#][^"']*)?["']/g),
    (match) => match[1],
  ).filter((url) => url !== 'manifest.webmanifest');

  for (const assetUrl of initialAssetUrls) {
    expect(precacheUrls, `initial shell asset ${assetUrl} must be precached`).toContain(assetUrl);
  }

  const portalAssetUrls = Array.from(
    portalHtml.matchAll(/\b(?:src|href)=["']\/([^"'?#]+)(?:[?#][^"']*)?["']/g),
    (match) => match[1],
  );
  for (const assetUrl of portalAssetUrls) {
    expect(precacheUrls, `portal shell asset ${assetUrl} must be precached`).toContain(assetUrl);
  }

  const [manifestResponse, portalManifestResponse, serviceWorkerResponse, hygieneResponse, widgetResponse] = await Promise.all([
    context.request.get('/manifest.webmanifest'),
    context.request.get('/manifest.portal.webmanifest'),
    context.request.get('/sw.js'),
    context.request.get('/sw-cache-hygiene.js'),
    context.request.get('/widget.js'),
  ]);
  expect(manifestResponse.status()).toBe(200);
  expect(manifestResponse.headers()['content-type']).toContain('application/manifest+json');
  expect(await manifestResponse.json()).toMatchObject({
    display: 'standalone',
    scope: '/',
    start_url: '/?pwa=1',
  });
  expect(portalManifestResponse.status()).toBe(200);
  expect(portalManifestResponse.headers()['content-type']).toContain('application/manifest+json');
  expect(await portalManifestResponse.json()).toMatchObject({
    display: 'standalone',
    scope: '/portal/',
    start_url: '/portal/index.html#/portal/dashboard?pwa=1',
  });
  expect(serviceWorkerResponse.status()).toBe(200);
  expect(serviceWorkerResponse.headers()['content-type']).toMatch(/javascript/);
  expect(serviceWorkerResponse.headers()['cache-control']).toMatch(/no-cache|no-store|max-age=0/);
  expect(hygieneResponse.status()).toBe(200);
  expect(hygieneResponse.headers()['content-type']).toMatch(/javascript/);
  expect(widgetResponse.status()).toBe(200);
  expect(widgetResponse.headers()['content-type']).toMatch(/javascript/);

  const response = await page.goto('/?pwa-lifecycle-e2e=1', {
    waitUntil: 'domcontentloaded',
  });
  expect(response?.status()).toBe(200);

  const readyState = await page.evaluate(async () =>
    Promise.race([
      navigator.serviceWorker.ready.then((registration) => ({
        activeScript: registration.active?.scriptURL ?? null,
        scope: registration.scope,
        timeout: false,
      })),
      new Promise<{ timeout: true }>((resolve) => {
        window.setTimeout(() => resolve({ timeout: true }), 15_000);
      }),
    ]),
  );

  expect(readyState.timeout).toBe(false);
  expect('activeScript' in readyState ? readyState.activeScript : null).toMatch(/\/sw\.js$/);

  await expect
    .poll(
      () =>
        page.evaluate(
          () => navigator.serviceWorker.controller?.scriptURL ?? null,
        ),
      { timeout: 10_000 },
    )
    .toMatch(/\/sw\.js$/);

  const lifecycle = await page.evaluate(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const cacheNames = await caches.keys();
    const precacheName = cacheNames.find((name) => name.startsWith('workbox-precache'));
    const cachedRequests = precacheName
      ? await (await caches.open(precacheName)).keys()
      : [];

    return {
      active: registrations[0]?.active?.state ?? null,
      cacheEntryCount: cachedRequests.length,
      controller: navigator.serviceWorker.controller?.state ?? null,
      registrations: registrations.length,
    };
  });

  expect(lifecycle).toMatchObject({
    active: 'activated',
    controller: 'activated',
    registrations: 1,
  });
  expect(lifecycle.cacheEntryCount).toBe(precacheUrls.length);

  await context.setOffline(true);
  const offlineResponse = await page.reload({ waitUntil: 'domcontentloaded' });

  expect(offlineResponse?.status()).toBe(200);
  await expect(page).toHaveTitle(/Chatboc/i);
  await expect
    .poll(() => page.locator('#root').evaluate((root) => root.childElementCount))
    .toBeGreaterThan(0);
  await expect(page.getByText(/Converti conversaciones en operaciones reales/i).first()).toBeVisible();

  const offlineSurveysPage = await context.newPage();
  const offlineSurveysResponse = await offlineSurveysPage.goto('/encuestas?pwa-offline=1', {
    waitUntil: 'domcontentloaded',
  });

  expect(offlineSurveysResponse?.status()).toBe(200);
  await expect(offlineSurveysPage).toHaveTitle(/Encuestas ciudadanas/i);
  await expect(offlineSurveysPage).toHaveURL(/\/encuestas\?pwa-offline=1$/);
  await expect(
    offlineSurveysPage.getByRole('heading', { name: /Elegí una organización para ver sus encuestas/i }),
  ).toBeVisible();
  await expect
    .poll(() => offlineSurveysPage.locator('#root').evaluate((root) => root.childElementCount))
    .toBeGreaterThan(0);

  const offlinePortalPage = await context.newPage();
  const offlinePortalResponse = await offlinePortalPage.goto(
    '/portal/index.html#/portal/dashboard?pwa-offline=1',
    { waitUntil: 'domcontentloaded' },
  );

  expect(offlinePortalResponse?.status()).toBe(200);
  await expect(offlinePortalPage).toHaveTitle(/Chatboc Portal/i);
  await expect(offlinePortalPage).toHaveURL(/\/portal\/index\.html#\/portal\/dashboard\?pwa-offline=1$/);
  await expect
    .poll(() => offlinePortalPage.locator('#root').evaluate((root) => root.childElementCount))
    .toBeGreaterThan(0);

  for (const deniedPath of ['/iframe', '/iframe.html', '/widget.js']) {
    const deniedPage = await context.newPage();
    const navigation = await deniedPage
      .goto(deniedPath, { waitUntil: 'domcontentloaded', timeout: 8_000 })
      .then((deniedResponse) => ({
        resolved: true,
        status: deniedResponse?.status() ?? null,
      }))
      .catch(() => ({ resolved: false }));

    expect(navigation, `${deniedPath} must not receive the offline SPA shell`).toEqual({
      resolved: false,
    });
    await deniedPage.close();
  }
});

test('forces the one-time privacy upgrade from a legacy API-caching worker', async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-pwa', 'requires the production build preview');
  writeLegacyPwaFixture();

  try {
    const bootstrapResponse = await page.goto('/__pwa-legacy-bootstrap.html');
    expect(bootstrapResponse?.status()).toBe(200);

    const legacyState = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.register('/__pwa-legacy-worker.js', {
        scope: '/',
      });
      await navigator.serviceWorker.ready;

      if (!navigator.serviceWorker.controller) {
        await new Promise<void>((resolve) => {
          navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
        });
      }

      const response = await fetch('/api/legacy-probe');
      return {
        activeScript: registration.active?.scriptURL ?? null,
        cacheNames: await caches.keys(),
        controllerScript: navigator.serviceWorker.controller?.scriptURL ?? null,
        responseText: await response.text(),
      };
    });

    expect(legacyState.activeScript).toMatch(/\/__pwa-legacy-worker\.js$/);
    expect(legacyState.controllerScript).toMatch(/\/__pwa-legacy-worker\.js$/);
    expect(legacyState.cacheNames).toContain('app-api');
    expect(legacyState.responseText).toBe('legacy-sensitive-response');

    const appResponse = await page.goto('/?pwa-privacy-upgrade=1', {
      waitUntil: 'domcontentloaded',
    });
    expect(appResponse?.status()).toBe(200);

    await expect
      .poll(
        () => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? null),
        { timeout: 20_000 },
      )
      .toMatch(/\/sw\.js$/);

    await expect
      .poll(() => page.evaluate(() => caches.keys()), { timeout: 10_000 })
      .toContain('chatboc-pwa-contract-api-network-only-v1');

    const migratedCacheNames = await page.evaluate(() => caches.keys());
    expect(migratedCacheNames).not.toContain('app-api');
    expect(migratedCacheNames).not.toContain('public-api');
    expect(migratedCacheNames).not.toContain('public-demo-api');

    await context.setOffline(true);
    const offlineProbe = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/legacy-probe');
        return { body: await response.text(), rejected: false };
      } catch {
        return { body: null, rejected: true };
      }
    });
    expect(offlineProbe).toEqual({ body: null, rejected: true });
    expect(await page.evaluate(() => caches.keys())).not.toContain('app-api');
  } finally {
    await context.setOffline(false);
    removeLegacyPwaFixture();
  }
});
