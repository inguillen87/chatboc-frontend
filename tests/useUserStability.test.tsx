import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';

// Mock dependencies
vi.mock('../src/utils/api', () => {
  class MockApiError extends Error {
    constructor(public message: string, public status: number, public body: any) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.body = body;
    }
  }
  return {
    apiFetch: vi.fn(),
    ApiError: MockApiError,
  };
});

vi.mock('../src/utils/safeLocalStorage', () => ({
  safeLocalStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock('../src/utils/config', () => ({
  getIframeToken: vi.fn(),
}));

vi.mock('../src/utils/entityToken', () => ({
  getStoredEntityToken: vi.fn(),
  normalizeEntityToken: vi.fn(),
  persistEntityToken: vi.fn(),
}));

vi.mock('../src/utils/authTokens', () => ({
  getValidStoredToken: vi.fn(),
}));

vi.mock('../src/utils/tipoChat', () => ({
  enforceTipoChatForRubro: vi.fn(),
  parseRubro: vi.fn(),
}));

import { UserProvider, useUser } from '../src/hooks/useUser';
import { apiFetch, ApiError } from '../src/utils/api';
import { safeLocalStorage } from '../src/utils/safeLocalStorage';
import { getValidStoredToken } from '../src/utils/authTokens';

describe('useUser Session Stability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should NOT logout user on Network Error', async () => {
    (getValidStoredToken as any).mockReturnValue('valid-token');
    (safeLocalStorage.getItem as any).mockImplementation((key: string) => {
      if (key === 'user') return JSON.stringify({ id: 1, name: 'User', rubro: 'fake' });
      return null;
    });

    // Mock network error
    (apiFetch as any).mockRejectedValue(new Error('Network failure'));

    const wrapper = ({ children }: { children: React.ReactNode }) => <UserProvider>{children}</UserProvider>;
    const { result } = renderHook(() => useUser(), { wrapper });

    await act(async () => {
      await result.current.refreshUser();
    });

    // Should NOT clear user
    expect(safeLocalStorage.removeItem).not.toHaveBeenCalledWith('user');
    // User should still be present
    expect(result.current.user).not.toBeNull();
  });

  it('should logout user on 401 Unauthorized', async () => {
    (getValidStoredToken as any).mockReturnValue('valid-token');
    (safeLocalStorage.getItem as any).mockImplementation((key: string) => {
      if (key === 'user') return JSON.stringify({ id: 1, name: 'User', rubro: 'fake' });
      return null;
    });

    // Mock 401 error. We use the imported ApiError (which is the mock)
    (apiFetch as any).mockRejectedValue(new ApiError('Unauthorized', 401, {}));

    const wrapper = ({ children }: { children: React.ReactNode }) => <UserProvider>{children}</UserProvider>;
    const { result } = renderHook(() => useUser(), { wrapper });

    await act(async () => {
      await result.current.refreshUser();
    });

    // Should clear user
    expect(safeLocalStorage.removeItem).toHaveBeenCalledWith('user');
    expect(result.current.user).toBeNull();
  });
});
