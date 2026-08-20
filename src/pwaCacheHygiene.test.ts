import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

import { describe, expect, it, vi } from 'vitest';

const hygieneSource = readFileSync(
  path.resolve(process.cwd(), 'public/sw-cache-hygiene.js'),
  'utf8',
);

describe('service worker cache hygiene', () => {
  it('forces only the one-time upgrade from a legacy active worker', async () => {
    let installHandler: ((event: { waitUntil: (promise: Promise<unknown>) => void }) => void) | undefined;
    let installPromise: Promise<unknown> | undefined;
    const skipWaiting = vi.fn(async () => undefined);
    const deleteCache = vi.fn(async () => true);
    const serviceWorker: any = {
      caches: {
        delete: deleteCache,
        has: vi.fn(async () => false),
        keys: vi.fn(async () => ['app-api', 'another-app-cache']),
      },
      registration: { active: { scriptURL: 'https://www.chatboc.ar/legacy-sw.js' } },
      skipWaiting,
      addEventListener: (name: string, handler: typeof installHandler) => {
        if (name === 'install') installHandler = handler;
      },
    };

    vm.runInNewContext(hygieneSource, { Promise, self: serviceWorker });
    installHandler?.({ waitUntil: (promise) => { installPromise = promise; } });
    await installPromise;

    expect(deleteCache).toHaveBeenCalledOnce();
    expect(deleteCache).toHaveBeenCalledWith('app-api');
    expect(deleteCache).not.toHaveBeenCalledWith('another-app-cache');
    expect(skipWaiting).toHaveBeenCalledOnce();
  });

  it('keeps future updates waiting after the privacy contract marker exists', async () => {
    let installHandler: ((event: { waitUntil: (promise: Promise<unknown>) => void }) => void) | undefined;
    let installPromise: Promise<unknown> | undefined;
    const skipWaiting = vi.fn(async () => undefined);
    const serviceWorker: any = {
      caches: {
        delete: vi.fn(),
        has: vi.fn(async () => true),
        keys: vi.fn(),
      },
      registration: { active: { scriptURL: 'https://www.chatboc.ar/sw.js' } },
      skipWaiting,
      addEventListener: (name: string, handler: typeof installHandler) => {
        if (name === 'install') installHandler = handler;
      },
    };

    vm.runInNewContext(hygieneSource, { Promise, self: serviceWorker });
    installHandler?.({ waitUntil: (promise) => { installPromise = promise; } });
    await installPromise;

    expect(skipWaiting).not.toHaveBeenCalled();
    expect(serviceWorker.caches.delete).not.toHaveBeenCalled();
  });

  it('removes only legacy URL-keyed API caches during activation', async () => {
    let activateHandler: ((event: { waitUntil: (promise: Promise<unknown>) => void }) => void) | undefined;
    let activationPromise: Promise<unknown> | undefined;
    const deleteCache = vi.fn(async () => true);
    const openCache = vi.fn(async () => ({}));
    const keys = vi.fn()
      .mockResolvedValueOnce([
        'app-api',
        'public-api',
        'public-demo-api',
        'workbox-precache-v2',
        'another-app-cache',
      ])
      .mockResolvedValueOnce(['workbox-precache-v2', 'another-app-cache']);
    const serviceWorker: any = {
      caches: {
        delete: deleteCache,
        open: openCache,
        keys,
      },
      addEventListener: (name: string, handler: typeof activateHandler) => {
        if (name === 'activate') activateHandler = handler;
      },
    };

    vm.runInNewContext(hygieneSource, { Promise, self: serviceWorker });

    expect(activateHandler).toBeTypeOf('function');
    activateHandler?.({ waitUntil: (promise) => { activationPromise = promise; } });
    await activationPromise;

    expect(deleteCache).toHaveBeenCalledTimes(3);
    expect(deleteCache).toHaveBeenCalledWith('app-api');
    expect(deleteCache).toHaveBeenCalledWith('public-api');
    expect(deleteCache).toHaveBeenCalledWith('public-demo-api');
    expect(deleteCache).not.toHaveBeenCalledWith('workbox-precache-v2');
    expect(deleteCache).not.toHaveBeenCalledWith('another-app-cache');
    expect(openCache).toHaveBeenCalledWith('chatboc-pwa-contract-api-network-only-v1');
  });

  it('does not mark the privacy contract if a legacy cache survives deletion', async () => {
    let activateHandler: ((event: { waitUntil: (promise: Promise<unknown>) => void }) => void) | undefined;
    let activationPromise: Promise<unknown> | undefined;
    const openCache = vi.fn(async () => ({}));
    const serviceWorker: any = {
      caches: {
        delete: vi.fn(async () => {
          throw new Error('delete failed');
        }),
        open: openCache,
        keys: vi.fn(async () => ['app-api']),
      },
      addEventListener: (name: string, handler: typeof activateHandler) => {
        if (name === 'activate') activateHandler = handler;
      },
    };

    vm.runInNewContext(hygieneSource, { Promise, self: serviceWorker });
    activateHandler?.({ waitUntil: (promise) => { activationPromise = promise; } });
    await activationPromise;

    expect(openCache).not.toHaveBeenCalled();
  });

  it('does not block activation when Cache Storage is unavailable', async () => {
    let activateHandler: ((event: { waitUntil: (promise: Promise<unknown>) => void }) => void) | undefined;
    let activationPromise: Promise<unknown> | undefined;
    const serviceWorker: any = {
      caches: {
        delete: vi.fn(),
        open: vi.fn(),
        keys: vi.fn(async () => {
          throw new Error('Cache Storage unavailable');
        }),
      },
      addEventListener: (name: string, handler: typeof activateHandler) => {
        if (name === 'activate') activateHandler = handler;
      },
    };

    vm.runInNewContext(hygieneSource, { Promise, self: serviceWorker });
    activateHandler?.({ waitUntil: (promise) => { activationPromise = promise; } });

    await expect(activationPromise).resolves.toBeUndefined();
    expect(serviceWorker.caches.delete).not.toHaveBeenCalled();
  });
});
