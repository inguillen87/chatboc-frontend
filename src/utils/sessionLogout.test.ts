import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usePanelSessionStore, useTenantStore, useWidgetSessionStore } from '@/stores';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import {
  hasPersistedClerkSession,
  logoutChatbocSession,
  registerClerkSignOut,
  resetChatbocSessionForIdentityTransition,
} from '@/utils/sessionLogout';

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/utils/api', () => ({
  apiFetch: mocks.apiFetch,
}));

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
};

const jwtWithClaims = (claims: Record<string, unknown>) => {
  const payload = btoa(JSON.stringify(claims))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `header.${payload}.signature`;
};

describe('logoutChatbocSession', () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset();
    safeLocalStorage.clear();
    usePanelSessionStore.setState({ authToken: null, user: null });
    useTenantStore.setState({ slug: null, name: null, themeConfig: null, features: null });
    useWidgetSessionStore.setState({
      status: 'idle',
      errorMessage: null,
      anonId: null,
      sessionId: null,
      chatAuthToken: null,
      entityToken: null,
      contactKey: null,
      conversationId: null,
    });
  });

  it('clears all local auth state synchronously while backend cookie logout is pending', async () => {
    const backendLogout = deferred<Record<string, unknown>>();
    mocks.apiFetch.mockReturnValue(backendLogout.promise);
    safeLocalStorage.setItem('authToken', 'panel-a');
    safeLocalStorage.setItem('chatAuthToken', 'chat-a');
    safeLocalStorage.setItem('authProvider', 'clerk');
    safeLocalStorage.setItem('clerkUserId', 'user_clerk_a');
    safeLocalStorage.setItem('entityToken', 'entity-a');
    safeLocalStorage.setItem('owner_token', 'owner-a');
    safeLocalStorage.setItem('tenantSlug', 'tenant-a');
    safeLocalStorage.setItem('user', JSON.stringify({ id: 'user-a' }));
    usePanelSessionStore.setState({ authToken: 'panel-a', user: { id: 'user-a' } as any });
    useWidgetSessionStore.setState({ chatAuthToken: 'chat-a', entityToken: 'entity-a' });
    useTenantStore.setState({ slug: 'tenant-a' });

    const logoutPromise = logoutChatbocSession();

    expect(mocks.apiFetch).toHaveBeenCalledWith('/api/v2/auth/logout', expect.objectContaining({
      method: 'POST',
      preserveAuthOn401: true,
      suppressPanel401Redirect: true,
    }));
    expect(usePanelSessionStore.getState()).toMatchObject({ authToken: null, user: null });
    expect(useTenantStore.getState()).toMatchObject({ slug: null, name: null });
    expect(useWidgetSessionStore.getState()).toMatchObject({
      chatAuthToken: null,
      entityToken: null,
      contactKey: null,
      conversationId: null,
    });
    expect(safeLocalStorage.getItem('authToken')).toBeNull();
    expect(safeLocalStorage.getItem('chatAuthToken')).toBeNull();
    expect(safeLocalStorage.getItem('authProvider')).toBeNull();
    expect(safeLocalStorage.getItem('clerkUserId')).toBeNull();
    expect(safeLocalStorage.getItem('entityToken')).toBeNull();
    expect(safeLocalStorage.getItem('owner_token')).toBeNull();
    expect(safeLocalStorage.getItem('user')).toBeNull();
    expect(safeLocalStorage.getItem('tenantSlug')).toBeNull();

    backendLogout.resolve({ ok: true });
    await logoutPromise;
  });

  it('signs out Clerk whenever a registered Clerk session handler exists, even without a runtime flag', async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    const unregister = registerClerkSignOut(signOut);
    mocks.apiFetch.mockResolvedValue({ ok: true });

    await logoutChatbocSession();
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(mocks.apiFetch).toHaveBeenCalledTimes(1);
    unregister();
  });

  it('recognizes pre-migration Clerk sessions from JWT claims and signs them out through window.Clerk', async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    const clerkWindow = window as Window & { Clerk?: { signOut: typeof signOut } };
    clerkWindow.Clerk = { signOut };
    safeLocalStorage.setItem('authToken', jwtWithClaims({
      auth_provider: 'clerk',
      session_kind: 'clerk',
    }));
    mocks.apiFetch.mockResolvedValue({ ok: true });

    expect(hasPersistedClerkSession()).toBe(true);
    await logoutChatbocSession();

    expect(signOut).toHaveBeenCalledTimes(1);
    delete clerkWindow.Clerk;
  });

  it('resets an identity transition without signing the user out of Clerk', async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    const unregister = registerClerkSignOut(signOut);
    const backendLogout = deferred<Record<string, unknown>>();
    mocks.apiFetch.mockReturnValue(backendLogout.promise);
    safeLocalStorage.setItem('authToken', 'user-a');

    const transition = resetChatbocSessionForIdentityTransition();

    expect(safeLocalStorage.getItem('authToken')).toBeNull();
    expect(signOut).not.toHaveBeenCalled();
    backendLogout.resolve({ ok: true });
    await transition.completion;
    unregister();
  });
});
