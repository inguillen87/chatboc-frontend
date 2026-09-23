import { afterEach, describe, expect, it, vi } from 'vitest';

const importFreshConfig = async () => {
  vi.resetModules();
  return import('./config');
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('Socket.IO origin resolution', () => {
  it('uses the explicit direct socket origin independently from same-origin HTTP APIs', async () => {
    vi.stubEnv('VITE_BACKEND_URL', 'https://chatboc-r2-preview.vercel.app');
    vi.stubEnv('VITE_SOCKET_URL', 'https://api-preview.chatboc.ar');

    const config = await importFreshConfig();

    expect(config.PUBLIC_BACKEND_URL).toBe('https://chatboc-r2-preview.vercel.app');
    expect(config.getSocketUrl()).toBe('wss://api-preview.chatboc.ar');
  });

  it('rejects paths and non-web protocols instead of treating them as socket origins', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubEnv('VITE_BACKEND_URL', 'https://chatboc-r2-preview.vercel.app');
    vi.stubEnv('VITE_SOCKET_URL', 'https://api-preview.chatboc.ar/private-path');

    const config = await importFreshConfig();

    expect(config.getSocketUrl()).toBe('wss://chatboc-r2-preview.vercel.app');
  });

  it('uses a quiet same-origin fallback for stale backend URLs on Vercel Preview', async () => {
    vi.stubGlobal('window', {
      location: {
        href: 'https://chatboc-r2-preview.vercel.app/perfil',
        origin: 'https://chatboc-r2-preview.vercel.app',
      },
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubEnv('VITE_BACKEND_URL', '[SENSITIVE]');
    vi.stubEnv('VITE_SOCKET_URL', '/invalid-relative-socket');

    const config = await importFreshConfig();

    expect(config.SAME_ORIGIN_PROXY_BASE).toBe('/api');
    expect(config.BASE_API_URL).toBe('/api');
    expect(config.getSocketUrl()).toBe('wss://chatboc-r2-preview.vercel.app');
    expect(warn).not.toHaveBeenCalledWith(
      expect.stringContaining('Unable to infer same-origin proxy'),
      expect.anything(),
    );
    expect(error).not.toHaveBeenCalled();
  });
});
