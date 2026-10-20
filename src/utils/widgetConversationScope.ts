import { v4 as uuidv4 } from 'uuid';
import { useCallback, useEffect, useRef, useState } from 'react';
import { captureWidgetRequestAuthority, widgetRequestAuthorityKey, type WidgetRequestAuthority } from './api';
import { getOrCreateAnonId } from './anonIdGenerator';
import { captureChatbocSessionRevision, isChatbocSessionRevisionCurrent, subscribeChatbocSessionRevision } from './chatbocSessionRevision';
import { usePanelSessionStore } from '@/stores/panelSessionStore';
import { useWidgetSessionStore } from '@/stores/widgetSessionStore';

const PREFIX = 'chatboc_widget_conversation.v1:';
const memory = new Map<string, string>();
const volatileKeys = new Set<string>();
const fallbackKeys = new Map<string, string>();
const listeners = new Set<() => void>();
const cookieDocument = uuidv4();
let volatileAnonId: string | null = null;
const storageGenerations = new Map<string, number>();
let authorityEventGeneration = 0;
let observingStorage = false;
const storageGeneration = (key: string) => storageGenerations.get(key) ?? 0;
const advanceStorageGeneration = (key: string) => storageGenerations.set(key, storageGeneration(key) + 1);
const validId = (id: unknown): id is string => typeof id === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
function currentAnonId(): string {
  try {
    const value = window.localStorage.getItem('chatboc_anon_id') || window.localStorage.getItem('anon_id');
    if (value && /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(value)) { volatileAnonId = null; return value; }
  } catch { /* retain this document's captured identity */ }
  if (volatileAnonId) return volatileAnonId;
  const generated = getOrCreateAnonId();
  try {
    if (window.localStorage.getItem('chatboc_anon_id') === generated) return generated;
  } catch { /* blocked persistence */ }
  volatileAnonId = generated;
  return generated;
}

export interface WidgetConversationOptions {
  tenantSlug: string;
  entityToken?: string | null;
  skipAuth?: boolean;
  omitCredentials?: boolean;
  isCurrent?: () => boolean;
}

export interface WidgetConversationHandle {
  readonly scopeKey: string;
  readonly sessionId: string;
  readonly tenantSlug: string;
  readonly anonId: string;
  /** RAM only. Never serialize a handle or its authority. */
  readonly authority: WidgetRequestAuthority;
  isCurrent: () => boolean;
  /** Compare-and-retire only this ID, never another tenant or a replacement. */
  retire: () => boolean;
  /** Caller must first verify the response tenant and its own current attempt. */
  adoptConfirmed: (sessionId: string) => boolean;
}

const notify = () => listeners.forEach(listener => { try { listener(); } catch { /* observer only */ } });
const panelActorKey = (value: unknown) => {
  if (!value || typeof value !== 'object') return '';
  const user = value as Record<string, unknown>;
  return JSON.stringify([user.id ?? null, typeof user.rol === 'string' ? user.rol.toLowerCase() : null]);
};
const storedPanelActorKey = (value: string | null) => {
  try { return panelActorKey(JSON.parse(value || 'null')); } catch { return ''; }
};
const onStorage = (event: StorageEvent) => {
  if (event.oldValue === event.newValue && event.key !== null) return;
  if (event.key === null) { authorityEventGeneration += 1; notify(); return; }
  if (event.key.startsWith(PREFIX)) { advanceStorageGeneration(event.key); notify(); return; }
  if (event.key === 'user' && storedPanelActorKey(event.oldValue) === storedPanelActorKey(event.newValue)) return;
  if (['authToken', 'chatAuthToken', 'user', 'anon_id', 'chatboc_anon_id'].includes(event.key)) {
    authorityEventGeneration += 1; notify();
  }
};
const observeStorage = () => {
  if (!observingStorage && typeof window !== 'undefined') {
    observingStorage = true; window.addEventListener('storage', onStorage);
    usePanelSessionStore.subscribe((current, previous) => {
      if (current.authToken === previous.authToken && panelActorKey(current.user) === panelActorKey(previous.user)) return;
      authorityEventGeneration += 1; notify();
    });
    useWidgetSessionStore.subscribe((current, previous) => {
      if (current.chatAuthToken === previous.chatAuthToken && current.entityToken === previous.entityToken) return;
      authorityEventGeneration += 1; notify();
    });
  }
};

export const subscribeWidgetConversationScopes = (listener: () => void) => {
  observeStorage();
  listeners.add(listener);
  const stopRevision = subscribeChatbocSessionRevision(listener);
  return () => {
    listeners.delete(listener); stopRevision();
  };
};

function read(key: string, persistent: boolean): string | null {
  if (persistent && !volatileKeys.has(key)) {
    try { return window.localStorage.getItem(key); } catch { volatileKeys.add(key); }
  }
  return memory.get(key) ?? null;
}

function write(key: string, value: string | null, persistent: boolean) {
  advanceStorageGeneration(key);
  if (value === null) memory.delete(key); else memory.set(key, value);
  if (persistent) {
    try {
      if (value === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, value);
    } catch { volatileKeys.add(key); /* never use the legacy key */ }
  }
}

/** Shared hook for the normal widget and its commerce/attachment consumers.
 * Signed demo bootstraps opt out and retain their explicitly provided ID. */
export function useWidgetConversationScope(options: WidgetConversationOptions | null) {
  const key = options ? JSON.stringify([options.tenantSlug, options.entityToken ?? null,
    options.skipAuth === true, options.omitCredentials ?? null,
    widgetRequestAuthorityKey(captureWidgetRequestAuthority(options)), currentAnonId(),
    captureChatbocSessionRevision()]) : '';
  const activeKey = useRef(key);
  const contextGeneration = useRef(0);
  if (activeKey.current !== key) { activeKey.current = key; contextGeneration.current += 1; }
  const mounted = useRef(true);
  const [handle, setHandle] = useState<WidgetConversationHandle | null>(null);
  const handleRef = useRef(handle); handleRef.current = handle;
  const [epoch, setEpoch] = useState(0);
  const capture = useCallback(async () => {
    if (!options || !key) return null;
    const generation = contextGeneration.current;
    const value = await captureWidgetConversationScope({ ...options,
      isCurrent: () => mounted.current && activeKey.current === key && contextGeneration.current === generation });
    if (!value.isCurrent()) throw new DOMException('Conversation scope retired', 'AbortError');
    const previous = handleRef.current;
    if (previous?.isCurrent() && previous.scopeKey === value.scopeKey && previous.sessionId === value.sessionId) return previous;
    handleRef.current = value; setHandle(value); return value;
  // The key contains the complete primitive option context. No credential is
  // persisted in that key; it remains an in-memory effect equality token.
  }, [key]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; handleRef.current = null; };
  }, []);
  useEffect(() => subscribeWidgetConversationScopes(() => {
    if (handleRef.current?.isCurrent()) return;
    handleRef.current = null; setHandle(null); setEpoch(value => value + 1);
  }), []);
  useEffect(() => {
    let active = true;
    handleRef.current = null; setHandle(null);
    if (key) void capture().catch(() => { if (active) setHandle(null); });
    return () => { active = false; };
  }, [capture, key, epoch]);
  const reset = useCallback(() => {
    const previous = handleRef.current;
    if (!previous?.retire()) return false;
    handleRef.current = null; setHandle(null); setEpoch(value => value + 1); return true;
  }, []);
  return { handle: handle?.isCurrent() && activeKey.current === key ? handle : null, capture, reset, contextKey: key };
}

function record(key: string, persistent: boolean): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(read(key, persistent) || 'null');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown> : null;
  } catch { return null; }
}

async function opaque(material: string): Promise<{ key: string; persistent: boolean }> {
  try {
    const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(material));
    return { key: Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, '0')).join(''), persistent: true };
  } catch {
    // Raw material (including a credential) remains in RAM only. No weak hash,
    // cleartext key, global session adoption or per-call random ID fallback.
    let key = fallbackKeys.get(material);
    if (!key) { key = uuidv4(); fallbackKeys.set(material, key); }
    return { key, persistent: false };
  }
}

export async function captureWidgetConversationScope(options: WidgetConversationOptions): Promise<WidgetConversationHandle> {
  observeStorage();
  const tenantSlug = options.tenantSlug.trim().toLowerCase();
  if (!tenantSlug || tenantSlug.length > 80) throw new DOMException('Conversation scope unavailable', 'AbortError');
  const revision = captureChatbocSessionRevision();
  const authorityEvents = authorityEventGeneration;
  const authority = captureWidgetRequestAuthority(options);
  const authorityKey = widgetRequestAuthorityKey(authority);
  const anonId = currentAnonId();
  const currentAuthority = () => options.isCurrent?.() !== false && isChatbocSessionRevisionCurrent(revision) &&
    authorityEventGeneration === authorityEvents &&
    widgetRequestAuthorityKey(captureWidgetRequestAuthority(options)) === authorityKey && currentAnonId() === anonId;
  const assertCurrent = () => { if (!currentAuthority()) throw new DOMException('Conversation scope retired', 'AbortError'); };
  assertCurrent();
  // Cookie identity cannot be inspected by JS. Explicit include mode is kept
  // within this document rather than claiming ownership across a reload.
  const [transport, actor] = await Promise.all([
    opaque(JSON.stringify(['transport', authority.tokenSource ?? 'anonymous', authority.omitCredentials])),
    opaque(JSON.stringify(['actor', authorityKey, anonId, authority.omitCredentials ? null : cookieDocument])),
  ]);
  assertCurrent();
  const persistent = transport.persistent && actor.persistent && typeof window !== 'undefined';
  const actorRecordKey = PREFIX + 'authority:' + transport.key;
  let activeActor = record(actorRecordKey, persistent);
  if (activeActor?.actor !== actor.key || !validId(activeActor.epoch)) {
    activeActor = { actor: actor.key, epoch: uuidv4() };
    write(actorRecordKey, JSON.stringify(activeActor), persistent);
  }
  const epoch = activeActor.epoch as string;
  const actorGeneration = storageGeneration(actorRecordKey);
  const scoped = await opaque(JSON.stringify(['tenant', tenantSlug, options.entityToken || null, actor.key, epoch]));
  assertCurrent();
  const actorStillCurrent = () => {
    const value = record(actorRecordKey, persistent);
    return value?.actor === actor.key && value.epoch === epoch && storageGeneration(actorRecordKey) === actorGeneration;
  };
  if (!actorStillCurrent()) throw new DOMException('Conversation authority retired', 'AbortError');
  const scopeKey = PREFIX + 'session:' + scoped.key;
  const persistentScope = persistent && scoped.persistent;
  let sessionId = read(scopeKey, persistentScope);
  if (!validId(sessionId)) { sessionId = uuidv4(); write(scopeKey, sessionId, persistentScope); }
  const capturedId = sessionId;
  const capturedGeneration = storageGeneration(scopeKey);
  const isCurrent = () => currentAuthority() && actorStillCurrent() && storageGeneration(scopeKey) === capturedGeneration && read(scopeKey, persistentScope) === capturedId;
  return {
    scopeKey, sessionId: capturedId, tenantSlug, anonId, authority,
    isCurrent,
    retire: () => {
      if (!isCurrent()) return false;
      write(scopeKey, null, persistentScope); notify(); return true;
    },
    adoptConfirmed: nextId => {
      if (!validId(nextId) || !isCurrent()) return false;
      if (nextId === capturedId) return true;
      write(scopeKey, nextId, persistentScope); notify(); return true;
    },
  };
}
