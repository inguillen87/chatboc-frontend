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

  it('preserves profile section and setup parameters during asset recovery', async () => {
    const runtime = buildRuntime();
    runtime.runtimeWindow.location.href =
      'https://www.chatboc.ar/perfil?tab=perfil&section=channels&setup=channels';

    await runtime.runtimeWindow.__CHATBOC_ASSET_RECOVERY__.recover('vite-preload');

    const replacement = new URL(runtime.replace.mock.calls[0][0]);
    expect(replacement.pathname).toBe('/perfil');
    expect(replacement.searchParams.get('tab')).toBe('perfil');
    expect(replacement.searchParams.get('section')).toBe('channels');
    expect(replacement.searchParams.get('setup')).toBe('channels');
    expect(replacement.searchParams.get('__chatboc_reason')).toBe('vite-preload');
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
    const preventDefault = vi.fn();

    runtime.listeners.get('vite:preloadError')?.({ preventDefault });

    await vi.waitFor(() => expect(runtime.replace).toHaveBeenCalledOnce());
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(runtime.replace.mock.calls[0][0]).toContain('__chatboc_reason=vite-preload');
    expect(runtime.unregister).toHaveBeenCalledOnce();
    expect(runtime.deleteCache).toHaveBeenCalledTimes(2);
  });
  it.each([
    { name: 'absolute own hashed JS', url: 'https://www.chatboc.ar/assets/main-X05q9u2V.js', attribute: 'src', expected: true },
    { name: 'relative own JS', url: '/assets/relative-chunk.js', attribute: 'src', expected: true },
    { name: 'protocol-relative own JS', url: '//www.chatboc.ar/assets/relative-chunk.js', attribute: 'src', expected: true },
    { name: 'absolute own hashed CSS', url: 'https://www.chatboc.ar/assets/index-DPAuqrGo.css', attribute: 'href', expected: true },
    { name: 'own iframe-prefix old asset absent from current manifest', url: '/iframe/assets/retired-cutover-hash.js', attribute: 'src', expected: true },
    { name: 'own CSS query and fragment', url: '/assets/styles.css?v=482#loaded', attribute: 'href', expected: true },
    { name: 'unrelated HTTPS JS', url: 'https://thirdparty.example.invalid/assets/vendor.js', attribute: 'src', expected: false },
    { name: 'extension JS', url: 'chrome-extension://synthetic-extension/assets/vendor.js', attribute: 'src', expected: false },
    { name: 'protocol-relative foreign JS', url: '//thirdparty.example.invalid/assets/vendor.js', attribute: 'src', expected: false },
    { name: 'malformed URL', url: 'http://[broken/assets/vendor.js', attribute: 'src', expected: false },
    { name: 'own nonasset with foreign asset hidden in query', url: 'https://www.chatboc.ar/public/config?failed=https://thirdparty.example.invalid/assets/vendor.js', attribute: 'src', expected: false },
    { name: 'foreign URL with own-looking asset in query', url: 'https://thirdparty.example.invalid/public/config?failed=https://www.chatboc.ar/assets/main-X05q9u2V.js', attribute: 'src', expected: false },
    { name: 'own basepath asset preserves the existing family', url: 'https://www.chatboc.ar/basepath/assets/old-cutover.js', attribute: 'src', expected: true },
    { name: 'normal own iframe URL', url: 'https://www.chatboc.ar/iframe?tenant=synthetic', attribute: 'src', expected: false },
    { name: 'unrelated static script nonmatch', url: 'https://thirdparty.example.invalid/static/vendor.js', attribute: 'src', expected: false },
  ])('admits only own HTTP assets for a DOM resource error: $name', async ({ url, attribute, expected }) => {
    const runtime = buildRuntime();
    runtime.listeners.get('error')?.({ target: { [attribute]: url } });
    await new Promise<void>(done => setImmediate(done));
    if (expected) {
      expect(runtime.unregister).toHaveBeenCalledOnce();
      expect(runtime.deleteCache).toHaveBeenCalledTimes(2);
      expect(runtime.replace).toHaveBeenCalledOnce();
      expect(runtime.replace.mock.calls[0][0]).toContain('__chatboc_reason=asset-load');
    } else {
      expect(runtime.unregister).not.toHaveBeenCalled();
      expect(runtime.deleteCache).not.toHaveBeenCalled();
      expect(runtime.replace).not.toHaveBeenCalled();
    }
    expect(runtime.unrelatedUnregister).not.toHaveBeenCalled();
    expect(runtime.deleteCache).not.toHaveBeenCalledWith('public-api');
    expect(runtime.deleteCache).not.toHaveBeenCalledWith('another-app-cache');
  });

  it('preserves recovery of an own hashed resource in an iframe document without changing iframe selection', async () => {
    const runtime = buildRuntime();
    runtime.runtimeWindow.location.href = 'https://www.chatboc.ar/iframe?tenant=synthetic';
    runtime.runtimeWindow.__CHATBOC_IFRAME__ = true;
    runtime.listeners.get('error')?.({ target: { src: 'https://www.chatboc.ar/assets/main-X05q9u2V.js' } });
    await vi.waitFor(() => expect(runtime.replace).toHaveBeenCalledOnce());
    const next = new URL(runtime.replace.mock.calls[0][0]);
    expect(next.pathname).toBe('/iframe');
    expect(next.searchParams.get('tenant')).toBe('synthetic');
    expect(runtime.unregister).toHaveBeenCalledOnce();
  });

  it.each([
    { name: 'one own absolute import URL', message: 'Failed to fetch dynamically imported module: https://www.chatboc.ar/assets/old-cutover.js', expected: true },
    { name: 'one foreign absolute import URL', message: 'Failed to fetch dynamically imported module: https://thirdparty.example.invalid/assets/vendor.js', expected: false },
    { name: 'one extension import URL', message: 'Failed to fetch dynamically imported module: chrome-extension://synthetic-extension/assets/vendor.js', expected: false },
    { name: 'Firefox generic failure without URL', message: 'error loading dynamically imported module', expected: true },
    { name: 'ambiguous separate own and foreign URLs', message: 'ChunkLoadError https://thirdparty.example.invalid/assets/vendor.js https://www.chatboc.ar/assets/old-cutover.js', expected: true },
    { name: 'malformed explicit URL preserves unknown fallback', message: 'Failed to fetch dynamically imported module: http://[broken/assets/vendor.js', expected: true },
    { name: 'foreign URL with own-looking URL nested in query', message: 'Failed to fetch dynamically imported module: https://thirdparty.example.invalid/assets/vendor.js?from=https://www.chatboc.ar/assets/old-cutover.js', expected: false },
    { name: 'own URL with foreign URL nested in query', message: 'Failed to fetch dynamically imported module: https://www.chatboc.ar/assets/old-cutover.js?from=https://thirdparty.example.invalid/assets/vendor.js', expected: true },
    { name: 'unrelated non-import rejection', message: 'Remote service unavailable https://thirdparty.example.invalid/assets/vendor.js', expected: false },
  ])('classifies explicit import rejection without inventing an unknown origin: $name', async ({ message, expected }) => {
    const runtime = buildRuntime();
    runtime.listeners.get('unhandledrejection')?.({ reason: { message, name: 'TypeError' } });
    await new Promise<void>(done => setImmediate(done));
    if (expected) {
      expect(runtime.unregister).toHaveBeenCalledOnce();
      expect(runtime.deleteCache).toHaveBeenCalledTimes(2);
      expect(runtime.replace).toHaveBeenCalledOnce();
      expect(runtime.replace.mock.calls[0][0]).toContain('__chatboc_reason=chunk-load');
    } else {
      expect(runtime.unregister).not.toHaveBeenCalled();
      expect(runtime.deleteCache).not.toHaveBeenCalled();
      expect(runtime.replace).not.toHaveBeenCalled();
    }
    expect(runtime.unrelatedUnregister).not.toHaveBeenCalled();
  });

});
