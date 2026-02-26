
import { describe, it, expect, vi } from 'vitest';
import { isJwtExpired, getValidStoredToken } from './authTokens';
import { safeLocalStorage } from './safeLocalStorage';

// Mock safeLocalStorage
vi.mock('./safeLocalStorage', () => ({
  safeLocalStorage: {
    getItem: vi.fn(),
    removeItem: vi.fn(),
    setItem: vi.fn(),
  },
}));

describe('authTokens Utils', () => {
  const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
    btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })) + // exp in 1 hour
    '.signature';

  const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
    btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 3600 })) + // exp 1 hour ago
    '.signature';

  it('isJwtExpired returns false for valid token', () => {
    expect(isJwtExpired(validToken)).toBe(false);
  });

  it('isJwtExpired returns true for expired token', () => {
    expect(isJwtExpired(expiredToken)).toBe(true);
  });

  it('getValidStoredToken returns token if valid', () => {
    vi.mocked(safeLocalStorage.getItem).mockReturnValue(validToken);
    expect(getValidStoredToken('testKey')).toBe(validToken);
    expect(safeLocalStorage.removeItem).not.toHaveBeenCalled();
  });

  it('getValidStoredToken removes token and returns null if expired', () => {
    vi.mocked(safeLocalStorage.getItem).mockReturnValue(expiredToken);
    expect(getValidStoredToken('testKey')).toBeNull();
    expect(safeLocalStorage.removeItem).toHaveBeenCalledWith('testKey');
  });

  it('getValidStoredToken returns null if no token found', () => {
    vi.mocked(safeLocalStorage.getItem).mockReturnValue(null);
    expect(getValidStoredToken('testKey')).toBeNull();
  });
});
