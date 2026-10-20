import { describe, expect, it } from 'vitest';
import { cleanLandingCopy } from '@/utils/landingCopy';

describe('read-only article agreement before tenant word replacement', () => {
  it('agrees el tenant with the feminine replacement organization', () => {
    expect(cleanLandingCopy('cobro cuando el tenant lo habilita'))
      .toBe('cobro cuando la organización lo habilita');
  });
  it('expands del tenant to de la organization', () => {
    expect(cleanLandingCopy('datos del tenant'))
      .toBe('datos de la organización');
  });
  it('expands al tenant to a la organization', () => {
    expect(cleanLandingCopy('mensajes al tenant'))
      .toBe('mensajes a la organización');
  });
  it('leaves unrelated words and already agreed customer copy unchanged', () => {
    expect(cleanLandingCopy('cada organizacion define su atencion'))
      .toBe('cada organizacion define su atencion');
    expect(cleanLandingCopy('servicio multitenant'))
      .toBe('servicio multitenant');
  });
  it('retains the existing isolated word and checkout transformations', () => {
    expect(cleanLandingCopy('tenant con checkout'))
      .toBe('organizacion con cobro');
  });

  it.each([
    ['El tenant decide', 'La organización decide'],
    ['Del tenant al cliente', 'De la organización al cliente'],
    ['Al tenant', 'A la organización'],
    ['EL TENANT', 'LA ORGANIZACIÓN'],
    ['DEL TENANT', 'DE LA ORGANIZACIÓN'],
    ['AL TENANT', 'A LA ORGANIZACIÓN'],
  ])('preserves phrase capitalization for %s', (input, expected) => {
    expect(cleanLandingCopy(input)).toBe(expected);
  });
});
