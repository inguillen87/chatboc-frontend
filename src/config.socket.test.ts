import { afterEach, describe, expect, it, vi } from 'vitest';

const importFreshConfig = async () => {
  vi.resetModules();
  return import('./config');
};

afterEach(() => {
  vi.restoreAllMocks();
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
});
