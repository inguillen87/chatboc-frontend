import { afterEach, describe, expect, it, vi } from 'vitest';

const importFreshEnv = async () => {
  vi.resetModules();
  return import('./env');
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  delete (window as any).__ENV;
  delete (window as any).ENV;
});

describe('env', () => {
  it('does not provide a hardcoded Google OAuth fallback', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');

    const env = await importFreshEnv();

    expect(env.GOOGLE_CLIENT_ID).toBe('');
  });

  it('reads Google OAuth from runtime env when present', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
    (window as any).__ENV = {
      VITE_GOOGLE_CLIENT_ID: 'runtime-google-client',
    };

    const env = await importFreshEnv();

    expect(env.GOOGLE_CLIENT_ID).toBe('runtime-google-client');
  });

  it('prefers build env over runtime env for Google OAuth', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'build-google-client');
    (window as any).__ENV = {
      VITE_GOOGLE_CLIENT_ID: 'runtime-google-client',
    };

    const env = await importFreshEnv();

    expect(env.GOOGLE_CLIENT_ID).toBe('build-google-client');
  });
});
