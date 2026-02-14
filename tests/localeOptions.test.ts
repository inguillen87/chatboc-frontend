import { afterEach, describe, expect, it, vi } from 'vitest';

describe('locale options', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('includes spanish, portuguese and english market locales by default', async () => {
    const { LOCALE_OPTIONS } = await import('@/utils/localeOptions');
    const locales = LOCALE_OPTIONS.map((opt) => opt.locale);
    expect(locales).toContain('es-AR');
    expect(locales).toContain('pt-BR');
    expect(locales).toContain('en-US');
  });

  it('supports env-driven market locales for franchise deployments', async () => {
    vi.stubEnv('VITE_LOCALE_MARKETS', 'Brasil|pt-BR|America/Sao_Paulo;USA|en-US|America/New_York');
    const { LOCALE_OPTIONS } = await import('@/utils/localeOptions');

    expect(LOCALE_OPTIONS).toEqual([
      { label: 'Brasil', locale: 'pt-BR', timezone: 'America/Sao_Paulo' },
      { label: 'USA', locale: 'en-US', timezone: 'America/New_York' },
    ]);
  });
});
