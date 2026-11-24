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
