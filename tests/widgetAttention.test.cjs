import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getAttentionMessage, DEFAULT_MESSAGE } from 'server/widgetAttention.js';

vi.mock('server/widgetAttention.js', async () => {
  const original = await vi.importActual('server/widgetAttention.js');
  return {
    ...original,
    getAttentionMessage: vi.fn(),
  };
});

describe('getAttentionMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return default message when no env provided', () => {
    delete process.env.ATTENTION_BUBBLE_CHOICES;
    getAttentionMessage.mockReturnValue(DEFAULT_MESSAGE);
    expect(getAttentionMessage()).toBe(DEFAULT_MESSAGE);
  });

  it('should rotate between provided messages', () => {
    process.env.ATTENTION_BUBBLE_CHOICES = 'Hola|Probando';
    const messages = ['Hola', 'Probando'];
    getAttentionMessage.mockImplementation(() => messages[Math.floor(Math.random() * messages.length)]);
    const seen = new Set();
    for (let i = 0; i < 20; i++) {
      seen.add(getAttentionMessage());
    }
    expect(seen.has('Hola') && seen.has('Probando')).toBe(true);
  });
});
