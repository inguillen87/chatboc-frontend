import { describe, it, expect } from 'vitest';
import sanitizeMessageHtml from '../src/utils/sanitizeMessageHtml';

describe('sanitizeMessageHtml', () => {
  it('converts newlines to <br> tags', () => {
    const input = 'Linea 1\nLinea 2';
    const output = sanitizeMessageHtml(input);
    expect(output).toContain('<br');
  });
});
