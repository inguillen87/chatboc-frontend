import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

import { describe, expect, it, vi } from 'vitest';

const recoverySource = readFileSync(path.resolve(process.cwd(), 'public/asset-recovery.js'), 'utf8');

const buildRuntime = () => {
  const listeners = new Map<string, (event: any) => void>();
  const storage = new Map<string, string>();
  const unregister = vi.fn(async () => true);
  const unrelatedUnregister = vi.fn(async () => true);
  const deleteCache = vi.fn(async () => true);
  const replace = vi.fn();

  const runtimeWindow: any = {
    caches: {
      delete: deleteCache,
      keys: vi.fn(async () => [
        'workbox-precache-old',
        'chatboc-assets-old',
        'public-api',
        'another-app-cache',
      ]),
    },
    document: {
      getElementById: vi.fn(() => ({ childElementCount: 0 })),
    },
    location: {
      href: 'https://www.chatboc.ar/login?from=smoke',
      origin: 'https://www.chatboc.ar',
      replace,
    },
    navigator: {
      onLine: true,
      serviceWorker: {
        getRegistrations: vi.fn(async () => [
          {
            active: { scriptURL: 'https://www.chatboc.ar/sw.js' },
            scope: 'https://www.chatboc.ar/',
            unregister,
          },
          {
            active: { scriptURL: 'https://www.chatboc.ar/other-sw.js' },
            scope: 'https://www.chatboc.ar/other/',
            unregister: unrelatedUnregister,
          },
        ]),
      },
    },
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, value),
    },
    addEventListener: (name: string, handler: (event: any) => void) => listeners.set(name, handler),
    setTimeout: vi.fn(),
  };

  runtimeWindow.window = runtimeWindow;
  vm.runInNewContext(recoverySource, {
    Date,
    Promise,
    URL,
    window: runtimeWindow,
  });

  return {
    deleteCache,
    listeners,
    replace,
    runtimeWindow,
    unrelatedUnregister,
    unregister,
  };
};

describe('asset recovery bootstrap', () => {
  it('does not unregister workers, delete caches or reload for expected offline failures', async () => {
    const runtime = buildRuntime();
    runtime.runtimeWindow.navigator.onLine = false;

    const recovered = await runtime.runtimeWindow.__CHATBOC_ASSET_RECOVERY__.recover('asset-load');

    expect(recovered).toBe(false);
    expect(runtime.unregister).not.toHaveBeenCalled();
    expect(runtime.unrelatedUnregister).not.toHaveBeenCalled();
    expect(runtime.deleteCache).not.toHaveBeenCalled();
    expect(runtime.replace).not.toHaveBeenCalled();
  });

  it('clears stale PWA state and reloads with a cache-busting URL', async () => {
    const runtime = buildRuntime();

    const recovered = await runtime.runtimeWindow.__CHATBOC_ASSET_RECOVERY__.recover('chunk-load');

    expect(recovered).toBe(true);
    expect(runtime.unregister).toHaveBeenCalledOnce();
    expect(runtime.unrelatedUnregister).not.toHaveBeenCalled();
    expect(runtime.deleteCache).toHaveBeenCalledTimes(2);
    expect(runtime.deleteCache).toHaveBeenCalledWith('workbox-precache-old');
    expect(runtime.deleteCache).toHaveBeenCalledWith('chatboc-assets-old');
    expect(runtime.deleteCache).not.toHaveBeenCalledWith('public-api');
    expect(runtime.deleteCache).not.toHaveBeenCalledWith('another-app-cache');
    expect(runtime.replace).toHaveBeenCalledOnce();
    expect(runtime.replace.mock.calls[0][0]).toContain('__chatboc_refresh=');
    expect(runtime.replace.mock.calls[0][0]).toContain('__chatboc_reason=chunk-load');
  });

  it('guards against reload loops during the same recovery window', async () => {
    const runtime = buildRuntime();

    await runtime.runtimeWindow.__CHATBOC_ASSET_RECOVERY__.recover('asset-load');
    const secondAttempt = await runtime.runtimeWindow.__CHATBOC_ASSET_RECOVERY__.recover('asset-load');

    expect(secondAttempt).toBe(false);
    expect(runtime.replace).toHaveBeenCalledOnce();
  });

  it('executes recovery from a failed script resource', async () => {
    const runtime = buildRuntime();

    runtime.listeners.get('error')?.({
      target: { src: 'https://www.chatboc.ar/assets/missing-chunk.js' },
    });

    await vi.waitFor(() => expect(runtime.replace).toHaveBeenCalledOnce());
    expect(runtime.unregister).toHaveBeenCalledOnce();
    expect(runtime.unrelatedUnregister).not.toHaveBeenCalled();
    expect(runtime.deleteCache).toHaveBeenCalledTimes(2);
  });

  it('executes recovery for Vite dynamic-import cutovers', async () => {
    const runtime = buildRuntime();

    runtime.listeners.get('vite:preloadError')?.({});

    await vi.waitFor(() => expect(runtime.replace).toHaveBeenCalledOnce());
    expect(runtime.replace.mock.calls[0][0]).toContain('__chatboc_reason=vite-preload');
    expect(runtime.unregister).toHaveBeenCalledOnce();
    expect(runtime.deleteCache).toHaveBeenCalledTimes(2);
  });
});
