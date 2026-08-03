import { beforeEach, describe, expect, it } from 'vitest';

import { persistAnonId } from '@/utils/anonIdGenerator';

describe('persistAnonId', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.cookie = 'chatboc_anon_id=; path=/; max-age=0';
  });

  it('persists a bounded header-safe identity in storage and the compatibility cookie', () => {
    const anonId = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

    expect(persistAnonId(anonId)).toBe(anonId);
    expect(window.localStorage.getItem('chatboc_anon_id')).toBe(anonId);
    expect(document.cookie).toContain(`chatboc_anon_id=${anonId}`);
  });

  it.each([
    '',
    'short',
    'anon with spaces',
    'anon\r\nX-Injected: true',
    'a'.repeat(129),
  ])('rejects an unsafe anonymous identity: %j', (value) => {
    expect(persistAnonId(value)).toBeNull();
    expect(window.localStorage.getItem('chatboc_anon_id')).toBeNull();
  });
});
