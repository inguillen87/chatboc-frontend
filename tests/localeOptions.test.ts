import { describe, expect, it } from 'vitest';
import { LOCALE_OPTIONS } from '@/utils/localeOptions';

describe('locale options', () => {
  it('includes spanish, portuguese and english market locales', () => {
    const locales = LOCALE_OPTIONS.map((opt) => opt.locale);
    expect(locales).toContain('es-AR');
    expect(locales).toContain('pt-BR');
    expect(locales).toContain('en-US');
  });
});
