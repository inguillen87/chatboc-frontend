import { describe, it, expect } from 'vitest';
import { normalizeBotPayload } from '../src/lib/normalizeBotPayload';

describe('normalizeBotPayload', () => {
  it('normalizes simple text message', () => {
    const payload = { message_body: 'Hello world' };
    const result = normalizeBotPayload(payload);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      role: 'bot',
      type: 'text',
      text: 'Hello world'
    });
  });

  it('normalizes options list', () => {
    const payload = {
      message_body: 'Choose option',
      options_list: [
        { id: '1', title: 'Option 1' },
        { id: '2', title: 'Option 2', desc: 'Description' }
      ]
    };
    const result = normalizeBotPayload(payload);
    expect(result).toHaveLength(2); // Text + List
    expect(result[0].type).toBe('text');
    expect(result[1].type).toBe('list');
    expect(result[1].items).toHaveLength(2);
    expect(result[1].items![0].title).toBe('Option 1');
    expect(result[1].items![1].desc).toBe('Description');
  });

  it('handles empty payload gracefully', () => {
    const result = normalizeBotPayload(null);
    expect(result).toHaveLength(0);
  });

  it('handles payload with no content', () => {
    const payload = {}; // empty object
    const result = normalizeBotPayload(payload);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('OK.');
  });
});
