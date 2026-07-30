import { describe, expect, it } from 'vitest';

import {
  prepareSurveyConsentPublicText,
  validateSurveyConsentPublicText,
} from './surveyGovernance';

describe('survey public consent canonicalization', () => {
  it('normalizes CRLF, Unicode NFC and document edges before hashing with Web Crypto', async () => {
    const prepared = await prepareSurveyConsentPublicText(
      '  Autorizo Cafe\u0301.\r\nSegunda línea. \n',
    );

    expect(prepared.publicText).toBe('Autorizo Café.\nSegunda línea.');
    expect(prepared.codePointLength).toBe(Array.from(prepared.publicText).length);
    expect(prepared.textSha256).toBe(
      'ab46d5d02c02797a2808f8dfe7adf0f68f4a873c588353afc330aa661c315419',
    );
  });

  it('rejects C0 controls including tabs', () => {
    expect(() => validateSurveyConsentPublicText('Texto\tcon tab')).toThrow(
      /caracteres de control no permitidos/i,
    );
  });

  it('rejects more than 4000 Unicode code points', () => {
    expect(() => validateSurveyConsentPublicText('😀'.repeat(4001))).toThrow(
      /entre 1 y 4000 caracteres/i,
    );
  });

  it('rejects lone UTF-16 surrogates without rejecting valid astral Unicode', () => {
    expect(() => validateSurveyConsentPublicText('texto\ud800')).toThrow(
      /Unicode sustituta inválida/i,
    );
    expect(validateSurveyConsentPublicText('Texto válido 😀')).toBe('Texto válido 😀');
  });
});
