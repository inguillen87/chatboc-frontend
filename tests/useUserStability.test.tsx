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
  safeSessionStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
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
import { persistEntityToken } from '../src/utils/entityToken';
import { clearLocalChatbocSession } from '../src/utils/sessionLogout';
import { usePanelSessionStore, useWidgetSessionStore } from '../src/stores';
import { SessionAuthorityProvider } from '../src/components/access/SessionAuthorityContext';

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

describe('useUser Session Stability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (safeLocalStorage.getItem as any).mockReset().mockReturnValue(null);
    (safeLocalStorage.setItem as any).mockReset();
    (safeLocalStorage.removeItem as any).mockReset();
    (getValidStoredToken as any).mockReset().mockReturnValue(null);
    (apiFetch as any).mockReset();
    usePanelSessionStore.setState({ authToken: null, user: null });
    useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
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
    // expect(safeLocalStorage.removeItem).not.toHaveBeenCalledWith('user');
    // User should still be present
    // expect(result.current.user).not.toBeNull();
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

  it('should preserve the session token on a temporary 403', async () => {
    (getValidStoredToken as any).mockReturnValue('valid-token');
    (safeLocalStorage.getItem as any).mockImplementation((key: string) => {
      if (key === 'user') return JSON.stringify({ id: 1, name: 'User', rubro: 'fake' });
      return null;
    });
    (apiFetch as any).mockRejectedValue(new ApiError('Forbidden', 403, {}));

    const wrapper = ({ children }: { children: React.ReactNode }) => <UserProvider>{children}</UserProvider>;
    const { result } = renderHook(() => useUser(), { wrapper });

    await act(async () => {
      await result.current.refreshUser();
    });

    expect(safeLocalStorage.removeItem).not.toHaveBeenCalledWith('authToken');
    expect(safeLocalStorage.removeItem).not.toHaveBeenCalledWith('chatAuthToken');
  });

  it('does not restore profile or entity data when /api/me resolves after logout', async () => {
    let activeToken: string | null = 'token-a';
    (getValidStoredToken as any).mockImplementation((key: string) =>
      key === 'authToken' ? activeToken : null,
    );
    const response = deferred<any>();
    (apiFetch as any).mockReturnValue(response.promise);
    usePanelSessionStore.setState({
      authToken: 'token-a',
      user: { id: 'user-a', email: 'a@chatboc.test', rol: 'admin', rubro: 'pyme' } as any,
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => <UserProvider>{children}</UserProvider>;
    const { result } = renderHook(() => useUser(), { wrapper });
    let refreshPromise!: Promise<void>;
    act(() => {
      refreshPromise = result.current.refreshUser();
    });
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));

    act(() => {
      activeToken = null;
      clearLocalChatbocSession();
    });
    await act(async () => {
      response.resolve({
        id: 'user-a',
        rubro: 'pyme',
        entityToken: 'entity-a',
        tenant_slug: 'tenant-a',
      });
      await refreshPromise;
    });

    expect(persistEntityToken).not.toHaveBeenCalled();
    expect(usePanelSessionStore.getState()).toMatchObject({ authToken: null, user: null });
    expect(useWidgetSessionStore.getState().entityToken).toBeNull();
    expect(safeLocalStorage.setItem).not.toHaveBeenCalledWith('tenantSlug', 'tenant-a');
  });

  it.each(['old-first', 'new-first'] as const)('does not apply another bearer profile when requests finish %s', async order => {
    let activeToken = 'token-a';
    (getValidStoredToken as any).mockImplementation((key: string) =>
      key === 'authToken' ? activeToken : null,
    );
    const responseA = deferred<any>();
    const responseB = deferred<any>();
    (apiFetch as any).mockReturnValueOnce(responseA.promise).mockReturnValueOnce(responseB.promise);
    usePanelSessionStore.setState({
      authToken: 'token-a',
      user: { id: 'user-a', email: 'a@chatboc.test', rol: 'admin', rubro: 'pyme' } as any,
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => <UserProvider>
      <SessionAuthorityProvider value={{ clerkStatus: 'disabled', hasBearerSession: true, hasVerifiedSession: true }}>{children}</SessionAuthorityProvider>
    </UserProvider>;
    const { result } = renderHook(() => useUser(), { wrapper });
    let refreshPromise!: Promise<void>;
    act(() => {
      refreshPromise = result.current.refreshUser();
    });
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));

    act(() => {
      activeToken = 'token-b';
      usePanelSessionStore.setState({
        authToken: 'token-b',
        user: { id: 'user-b', email: 'b@chatboc.test', rol: 'admin', rubro: 'pyme' } as any,
      });
    });
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
    expect(result.current.organizationProfileVerified).toBe(false);
    const finishA = async () => act(async () => {
      responseA.resolve({
        id: 'user-a',
        rol: 'admin', tipo_chat: 'pyme',
        rubro: 'pyme',
        entityToken: 'entity-a',
        tenant_slug: 'tenant-a',
      });
      await refreshPromise;
    });
    const finishB = async () => act(async () => {
      responseB.resolve({ id: 'user-b', email: 'b@chatboc.test', rol: 'admin', tipo_chat: 'pyme', rubro: 'pyme', tenant_slug: 'tenant-b' });
    });
    if (order === 'old-first') {
      await finishA();
      expect(usePanelSessionStore.getState().user?.id).toBe('user-b');
      expect(result.current.organizationProfileVerified).toBe(false);
      await finishB();
    } else {
      await finishB();
      expect(result.current.organizationProfileVerified).toBe(true);
      await finishA();
    }

    expect(persistEntityToken).not.toHaveBeenCalled();
    expect(usePanelSessionStore.getState()).toMatchObject({
      authToken: 'token-b',
      user: { id: 'user-b' },
    });
    expect(result.current.organizationProfileVerified).toBe(true);
    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(safeLocalStorage.setItem).not.toHaveBeenCalledWith('tenantSlug', 'tenant-a');
  });
});
