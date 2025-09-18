import { beforeEach, describe, expect, it } from 'vitest';
import { sanitizeEntityToken, storeEntityToken, getStoredEntityToken } from '@/utils/entityToken';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

describe('entityToken utilities', () => {
  beforeEach(() => {
    safeLocalStorage.clear();
  });

  it('removes placeholder tokens and whitespace when sanitizing', () => {
    expect(sanitizeEntityToken('demo-anon')).toBeNull();
    expect(sanitizeEntityToken(' demo-anon ')).toBeNull();
    expect(sanitizeEntityToken('demo-anon-123')).toBeNull();
    expect(sanitizeEntityToken('')).toBeNull();
    expect(sanitizeEntityToken('  ')).toBeNull();
  });

  it('returns trimmed token when valid', () => {
    expect(sanitizeEntityToken('  valid-token  ')).toBe('valid-token');
  });

  it('persists sanitized tokens and removes placeholders', () => {
    expect(storeEntityToken('  abc  ')).toBe('abc');
    expect(getStoredEntityToken()).toBe('abc');

    expect(storeEntityToken('demo-anon')).toBeNull();
    expect(getStoredEntityToken()).toBeNull();
  });

  it('cleans up existing placeholder tokens from storage', () => {
    safeLocalStorage.setItem('entityToken', 'demo-anon-old');
    expect(getStoredEntityToken()).toBeNull();
    expect(safeLocalStorage.getItem('entityToken')).toBeNull();
  });
});
