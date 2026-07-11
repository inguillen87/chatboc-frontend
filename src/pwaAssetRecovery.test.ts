import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

import { describe, expect, it, vi } from 'vitest';

const recoverySource = readFileSync(path.resolve(process.cwd(), 'public/asset-recovery.js'), 'utf8');

const buildRuntime = () => {
  const listeners = new Map<string, (event: any) => void>();
  const storage = new Map<string, string>();
  const unregister = vi.fn(async () => true);
  const deleteCache = vi.fn(async () => true);
  const replace = vi.fn();

  const runtimeWindow: any = {
    caches: {
      delete: deleteCache,
      keys: vi.fn(async () => ['workbox-precache-old', 'chatboc-assets-old']),
    },
    document: {
      getElementById: vi.fn(() => ({ childElementCount: 0 })),
    },
    location: {
      href: 'https://www.chatboc.ar/login?from=smoke',
      replace,
    },
    navigator: {
      serviceWorker: {
        getRegistrations: vi.fn(async () => [{ unregister }]),
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
    unregister,
  };
};

describe('asset recovery bootstrap', () => {
  it('clears stale PWA state and reloads with a cache-busting URL', async () => {
    const runtime = buildRuntime();

    const recovered = await runtime.runtimeWindow.__CHATBOC_ASSET_RECOVERY__.recover('chunk-load');

    expect(recovered).toBe(true);
    expect(runtime.unregister).toHaveBeenCalledOnce();
    expect(runtime.deleteCache).toHaveBeenCalledTimes(2);
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

  it('registers resource and dynamic-import failure listeners', () => {
    const runtime = buildRuntime();

    expect(runtime.listeners.has('error')).toBe(true);
    expect(runtime.listeners.has('unhandledrejection')).toBe(true);
  });
});
