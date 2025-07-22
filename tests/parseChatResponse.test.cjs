import { describe, it, expect } from 'vitest';
import { parseChatResponse } from '../src/utils/parseChatResponse.ts';

describe('parseChatResponse', () => {
  it('handles respuesta field', () => {
    const res = parseChatResponse({ respuesta: 'hola' });
    expect(res.text).toBe('hola');
  });

  it('handles respuesta_usuario field', () => {
    const res = parseChatResponse({ respuesta_usuario: 'hola' });
    expect(res.text).toBe('hola');
  });

  it('handles object form', () => {
    const res = parseChatResponse({ respuesta_usuario: { respuesta: 'ok', botones: [{ texto: 'b1', action: 'a' }] } });
    expect(res.text).toBe('ok');
    expect(res.botones[0].texto).toBe('b1');
  });
});
