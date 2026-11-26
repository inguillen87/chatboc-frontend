import { describe, expect, it } from 'vitest';
import { sanitizeMessageHtml } from './sanitizeMessageHtml';

describe('sanitizeMessageHtml phone links', () => {
  it('does not read a request id as a phone number', () => {
    const html = sanitizeMessageHtml('No se realizó ninguna acción. (Req ID: 0a454962472a4bb88de3f498057ca4e4)');
    expect(html).not.toContain('wa.me');
  });

  it('does not link digits glued to letters or underscores', () => {
    expect(sanitizeMessageHtml('Código abc2901441234')).not.toContain('wa.me');
    expect(sanitizeMessageHtml('ref_2901441234_x')).not.toContain('wa.me');
  });

  it('still links a written phone number', () => {
    expect(sanitizeMessageHtml('Llamá al 2901 44-1234.')).toContain('href="https://wa.me/54290144');
    expect(sanitizeMessageHtml('WhatsApp: +54 9 2901 441234')).toContain('href="https://wa.me/5492901441234"');
  });
});

describe('sanitizeMessageHtml emphasis shared with WhatsApp', () => {
  it('turns *text* into bold instead of showing the asterisks', () => {
    expect(sanitizeMessageHtml('*Encuestas y votaciones*')).toBe('<strong>Encuestas y votaciones</strong>');
    expect(sanitizeMessageHtml('1. *Votación barrial*\nElegí una.')).toBe(
      '1. <strong>Votación barrial</strong><br>Elegí una.',
    );
    expect(sanitizeMessageHtml('Tu código es *AB-12*.')).toContain('<strong>AB-12</strong>.');
    expect(sanitizeMessageHtml('Esto es **importante**, leelo.')).toContain('<strong>importante</strong>,');
  });

  it('leaves arithmetic and bullet lists as written', () => {
    expect(sanitizeMessageHtml('2 * 3 * 4')).toBe('2 * 3 * 4');
    expect(sanitizeMessageHtml('* primero\n* segundo')).toBe('* primero<br>* segundo');
    expect(sanitizeMessageHtml('Precio 5*3 y 2*2')).toBe('Precio 5*3 y 2*2');
  });

  it('does not let emphasis smuggle markup', () => {
    expect(sanitizeMessageHtml('*<img src=x onerror=alert(1)>*')).not.toContain('<img');
  });
});
