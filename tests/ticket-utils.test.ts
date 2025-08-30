/* @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { getCitizenDni } from '../src/utils/ticket';

describe('getCitizenDni', () => {
  it('returns nested dni when available', () => {
    const ticket: any = { informacion_personal_vecino: { dni: '123' } };
    expect(getCitizenDni(ticket)).toBe('123');
  });

  it('falls back to other document fields', () => {
    const ticket: any = { documento: '456' };
    expect(getCitizenDni(ticket)).toBe('456');
  });
});
