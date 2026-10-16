import { afterEach, describe, expect, it, vi } from 'vitest';

const { registerSW } = vi.hoisted(() => ({ registerSW: vi.fn() }));
vi.mock('virtual:pwa-register', () => ({ registerSW }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { dismiss: vi.fn() }) }));

describe('Preview service worker retirement', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('retires only Chatboc caches and its worker, preserves authentication, and reloads once', async () => {
    localStorage.setItem('authProvider', 'clerk');
    localStorage.setItem('user', JSON.stringify({ id: 41 }));
    sessionStorage.setItem('panel-session-marker', 'preserved');
    const unregister = vi.fn(async () => true);
    const unrelatedUnregister = vi.fn(async () => true);
    const deleteCache = vi.fn(async () => true);
    const reload = vi.fn();
    vi.stubGlobal('window', {
      location: { hostname: 'preview.chatboc.ar', origin: 'https://preview.chatboc.ar', reload },
      caches: {},
    });
    vi.stubGlobal('navigator', {
      serviceWorker: {
        controller: {},
        getRegistrations: vi.fn(async () => [
          {
            active: { scriptURL: 'https://preview.chatboc.ar/sw.js' },
            scope: 'https://preview.chatboc.ar/',
            unregister,
          },
          {
            active: { scriptURL: 'https://preview.chatboc.ar/other-sw.js' },
            scope: 'https://preview.chatboc.ar/other/',
            unregister: unrelatedUnregister,
          },
        ]),
      },
    });
    vi.stubGlobal('caches', {
      keys: vi.fn(async () => ['workbox-precache-old', 'chatboc-assets-old', 'app-api', 'other-cache']),
      delete: deleteCache,
    });
    const { setupPWA } = await import('./pwa');

    setupPWA();
    await vi.waitFor(() => expect(reload).toHaveBeenCalledOnce());
    setupPWA();

    expect(registerSW).not.toHaveBeenCalled();
    expect(unregister).toHaveBeenCalledOnce();
    expect(unrelatedUnregister).not.toHaveBeenCalled();
    expect(deleteCache.mock.calls.map(([name]) => name)).toEqual([
      'workbox-precache-old', 'chatboc-assets-old', 'app-api',
    ]);
    expect(localStorage.getItem('authProvider')).toBe('clerk');
    expect(localStorage.getItem('user')).toBe(JSON.stringify({ id: 41 }));
    expect(sessionStorage.getItem('panel-session-marker')).toBe('preserved');
    expect(sessionStorage.getItem('chatboc-ephemeral-pwa-cleaned')).toBe('1');
    expect(reload).toHaveBeenCalledOnce();
  });
});
