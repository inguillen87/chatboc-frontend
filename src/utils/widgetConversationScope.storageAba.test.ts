import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { safeLocalStorage } from './safeLocalStorage';
import { usePanelSessionStore, useWidgetSessionStore } from '@/stores';
import { captureChatbocSessionRevision } from './chatbocSessionRevision';
vi.mock('@/utils/api', async () => await vi.importActual<typeof import('@/utils/api')>('@/utils/api'));
import { captureWidgetConversationScope, subscribeWidgetConversationScopes } from './widgetConversationScope';
import { captureWidgetRequestAuthority } from './api';

const credentialA = 'synthetic-widget-actor-a';
const credentialB = 'synthetic-widget-actor-b';
const replacement = '99999999-9999-4999-8999-999999999999';
const prefix = 'chatboc_widget_conversation.v1:';
const disposers: Array<() => void> = [];
const event = (key: string | null, oldValue: string | null, newValue: string | null) => {
  window.dispatchEvent(new StorageEvent('storage', {
    key, oldValue, newValue, storageArea: window.localStorage,
    url: 'https://same-origin.example.invalid/other-tab',
  }));
};
const tokenA = () => safeLocalStorage.setItem('chatAuthToken', credentialA);
const captured = () => captureWidgetConversationScope({ tenantSlug: 'qa-aba-a' });

describe('conversation ownership survives deferred authority and storage event observation', () => {
  beforeEach(() => {
    safeLocalStorage.clear(); window.sessionStorage.clear();
    usePanelSessionStore.setState({ authToken: null, user: null });
    useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
    safeLocalStorage.setItem('chatboc_anon_id', 'synthetic-aba-anonymous');
    vi.stubGlobal('crypto', webcrypto);
    tokenA();
  });
  afterEach(() => {
    disposers.splice(0).forEach(dispose => dispose());
    vi.restoreAllMocks(); vi.unstubAllGlobals();
    safeLocalStorage.clear(); window.sessionStorage.clear();
    usePanelSessionStore.setState({ authToken: null, user: null });
    useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
  });

  it('durably retires A when queued credential events report A to B to A after storage already returned to A', async () => {
    const handle = await captured();
    const revision = captureChatbocSessionRevision();
    safeLocalStorage.setItem('chatAuthToken', credentialB); tokenA();
    expect(handle.isCurrent()).toBe(true); // No observer has seen the transition yet.
    event('chatAuthToken', credentialA, credentialB);
    event('chatAuthToken', credentialB, credentialA);
    expect(captureChatbocSessionRevision()).toBe(revision);
    expect(handle.isCurrent()).toBe(false);
    const next = await captured();
    expect(next.isCurrent()).toBe(true);
    expect(handle.isCurrent()).toBe(false);
    expect(handle.retire()).toBe(false);
    expect(handle.adoptConfirmed(replacement)).toBe(false);
    expect(window.localStorage.getItem(handle.scopeKey)).toBe(next.sessionId);
  });

  it('does not revive an old owner after an authority record is replaced and restored before its events arrive', async () => {
    const handle = await captured();
    const authorityKey = Object.keys(window.localStorage).find(key => key.startsWith(prefix + 'authority:'))!;
    const original = window.localStorage.getItem(authorityKey)!;
    const other = JSON.stringify({ ...JSON.parse(original), epoch: replacement });
    window.localStorage.setItem(authorityKey, other); window.localStorage.setItem(authorityKey, original);
    event(authorityKey, original, other); event(authorityKey, other, original);
    expect(handle.isCurrent()).toBe(false);
    expect(handle.retire()).toBe(false);
    expect(handle.adoptConfirmed(replacement)).toBe(false);
    expect(window.localStorage.getItem(handle.scopeKey)).toBe(handle.sessionId);
  });

  it('retires only the replaced conversation after session-ID ABA and leaves another tenant current', async () => {
    const handle = await captured();
    const other = await captureWidgetConversationScope({ tenantSlug: 'qa-aba-other' });
    window.localStorage.setItem(handle.scopeKey, replacement);
    window.localStorage.setItem(handle.scopeKey, handle.sessionId);
    event(handle.scopeKey, handle.sessionId, replacement);
    event(handle.scopeKey, replacement, handle.sessionId);
    expect(handle.isCurrent()).toBe(false);
    expect(other.isCurrent()).toBe(true);
    expect(handle.retire()).toBe(false);
    expect(window.localStorage.getItem(other.scopeKey)).toBe(other.sessionId);
  });

  it('keeps a current scope through unrelated changes and an equal-value no-op notification', async () => {
    const handle = await captured();
    event('unrelated-preference', 'a', 'b');
    event('chatAuthToken', credentialA, credentialA);
    event(prefix + 'session:unrelated', null, replacement);
    expect(handle.isCurrent()).toBe(true);
  });

  it('rejects a capture whose first hash resolves after delayed credential ABA without creating a session', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const digest = webcrypto.subtle.digest.bind(webcrypto.subtle);
    let count = 0;
    vi.spyOn(webcrypto.subtle, 'digest').mockImplementation((algorithm, data) => {
      const result = digest(algorithm, data);
      return ++count === 1 ? result.then(async value => { await gate; return value; }) : result;
    });
    const pending = captured();
    safeLocalStorage.setItem('chatAuthToken', credentialB); tokenA();
    event('chatAuthToken', credentialA, credentialB); event('chatAuthToken', credentialB, credentialA);
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    release(); await rejected;
    expect(Object.keys(window.localStorage).filter(key => key.startsWith(prefix))).toEqual([]);
  });

  it('retires a scope after clear-storage notification even when identical bytes were restored first', async () => {
    const handle = await captured();
    const before = Object.entries(window.localStorage);
    window.localStorage.clear();
    for (const [key, value] of before) window.localStorage.setItem(key, value);
    event(null, null, null);
    expect(handle.isCurrent()).toBe(false);
    expect(handle.retire()).toBe(false);
  });

  it('keeps same-document store credential ABA retired without relying on a UserProvider revision change', async () => {
    safeLocalStorage.removeItem('chatAuthToken');
    useWidgetSessionStore.setState({ chatAuthToken: credentialA });
    disposers.push(subscribeWidgetConversationScopes(() => {}));
    const handle = await captured();
    const revision = captureChatbocSessionRevision();
    useWidgetSessionStore.setState({ chatAuthToken: credentialB });
    useWidgetSessionStore.setState({ chatAuthToken: credentialA });
    expect(captureChatbocSessionRevision()).toBe(revision);
    expect(handle.isCurrent()).toBe(false);
    expect(handle.retire()).toBe(false);
    expect(handle.adoptConfirmed(replacement)).toBe(false);
  });

  it.each(['chat', 'citizen-panel'] as const)(
    'retires an imperative %s capture through store ABA without a mounted scope subscriber', async transport => {
      safeLocalStorage.removeItem('chatAuthToken');
      if (transport === 'chat') useWidgetSessionStore.setState({ chatAuthToken: credentialA });
      else {
        safeLocalStorage.setItem('user', JSON.stringify({ rol: 'ciudadano' }));
        usePanelSessionStore.setState({ authToken: credentialA });
      }
      const handle = await captured();
      const revision = captureChatbocSessionRevision();
      if (transport === 'chat') {
        useWidgetSessionStore.setState({ chatAuthToken: credentialB });
        useWidgetSessionStore.setState({ chatAuthToken: credentialA });
      } else {
        usePanelSessionStore.setState({ authToken: credentialB });
        usePanelSessionStore.setState({ authToken: credentialA });
      }
      expect(captureChatbocSessionRevision()).toBe(revision);
      expect(handle.isCurrent()).toBe(false);
      expect(handle.retire()).toBe(false);
      expect(handle.adoptConfirmed(replacement)).toBe(false);
    },
  );

  it('keeps a current owner through same-actor profile metadata refresh with a new object and stored JSON', async () => {
    safeLocalStorage.removeItem('chatAuthToken');
    usePanelSessionStore.setState({ authToken: credentialA });
    const first = { id: 700, rol: 'ciudadano', avatar: 'synthetic-original-avatar' };
    const refreshed = { id: 700, rol: 'ciudadano', avatar: 'synthetic-new-avatar' };
    usePanelSessionStore.setState({ user: first });
    safeLocalStorage.setItem('user', JSON.stringify(first));
    const handle = await captured();
    const revision = captureChatbocSessionRevision();
    usePanelSessionStore.setState({ user: refreshed });
    safeLocalStorage.setItem('user', JSON.stringify(refreshed));
    event('user', JSON.stringify(first), JSON.stringify(refreshed));
    expect(captureChatbocSessionRevision()).toBe(revision);
    expect(handle.authority.tokenSource).toBe('authToken');
    expect(handle.isCurrent()).toBe(true);
  });

  it('retires whitespace-role credential eligibility ABA using the exact HTTP role semantics', async () => {
    safeLocalStorage.removeItem('chatAuthToken');
    usePanelSessionStore.setState({ authToken: credentialA });
    const roleA = JSON.stringify({ id: 700, rol: 'ciudadano' });
    const roleB = JSON.stringify({ id: 700, rol: ' ciudadano ' });
    safeLocalStorage.setItem('user', roleA);
    const handle = await captured();
    const revision = captureChatbocSessionRevision();
    safeLocalStorage.setItem('user', roleB);
    expect(captureWidgetRequestAuthority().tokenSource).toBeNull();
    safeLocalStorage.setItem('user', roleA);
    expect(captureWidgetRequestAuthority().tokenSource).toBe('authToken');
    event('user', roleA, roleB); event('user', roleB, roleA);
    expect(captureChatbocSessionRevision()).toBe(revision);
    expect(handle.isCurrent()).toBe(false);
    expect(handle.retire()).toBe(false);
    expect(handle.adoptConfirmed(replacement)).toBe(false);
  });
});
