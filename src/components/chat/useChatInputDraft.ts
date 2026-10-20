import { useCallback, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { safeLocalStorage, safeSessionStorage } from '@/utils/safeLocalStorage';
import { captureChatbocSessionRevision, isChatbocSessionRevisionCurrent, subscribeChatbocSessionRevision } from '@/utils/chatbocSessionRevision';

const AUTHORITY_KEY = 'chatboc_chat_draft_authority_v1';
const DRAFT_PREFIX = 'chat_widget_input_draft_v2:';
let authority: { revision: number; nonce: string | null } | undefined;
const memoryDrafts = new Map<string, string>();

const newNonce = () => {
  try { return globalThis.crypto?.randomUUID?.() ?? null; } catch { return null; }
};

const authorityFor = (revision: number) => {
  if (authority?.revision === revision) return authority;
  if (authority) memoryDrafts.clear();
  let nonce: string | null = null;
  try {
    const saved = authority ? null : safeSessionStorage.getItem(AUTHORITY_KEY);
    nonce = saved && /^[a-f\d-]{36}$/i.test(saved) ? saved : newNonce();
    if (nonce) safeSessionStorage.setItem(AUTHORITY_KEY, nonce);
  } catch { nonce = null; }
  authority = { revision, nonce };
  return authority;
};

type Binding = { tenantSlug?: string | null; demoSessionId?: string | null; chatSessionId?: string | null; onTypingChange?: (typing: boolean) => void };
type Owner = { binding: string; revision: number; confirmed: boolean; persistent: boolean };
type Run = { owner: Owner; retired: boolean; key: string | null; value: string; edited: boolean; recovered: boolean; timer?: ReturnType<typeof setTimeout> };
type View = { owner: Owner; value: string; recovered: boolean };
const clean = (value?: string | null) => value?.trim() || null;

export const useChatInputDraft = ({ tenantSlug, demoSessionId, chatSessionId, onTypingChange }: Binding) => {
  const revision = useSyncExternalStore(subscribeChatbocSessionRevision, captureChatbocSessionRevision, () => -1);
  const [currentAuthority, setCurrentAuthority] = useState(() => authorityFor(revision));
  useLayoutEffect(() => { setCurrentAuthority(authorityFor(revision)); }, [revision]);
  const tenant = clean(tenantSlug)?.toLowerCase() ?? null;
  const chat = clean(chatSessionId);
  const nonce = currentAuthority.revision === revision ? currentAuthority.nonce : null;
  // Raw session credentials exist only in memory; persisted keys contain a SHA-256 digest.
  const binding = JSON.stringify([nonce, tenant, chat, clean(demoSessionId)]);
  const owner = useMemo<Owner>(() => ({ binding, revision, confirmed: Boolean(tenant && chat), persistent: Boolean(nonce && tenant && chat) }), [binding, revision, nonce, tenant, chat]);
  const active = useRef<Run | null>(null);
  const typing = useRef(onTypingChange);
  useLayoutEffect(() => { typing.current = onTypingChange; }, [onTypingChange]);
  const [view, setView] = useState<View>(() => ({ owner, value: '', recovered: false }));
  const isCurrent = (run: Run) => active.current === run && !run.retired && isChatbocSessionRevisionCurrent(run.owner.revision);
  const persist = (run: Run) => {
    if (!run.key || !isCurrent(run)) return;
    try {
      if (run.value) safeLocalStorage.setItem(run.key, run.value);
      else safeLocalStorage.removeItem(run.key);
    } catch { /* Keep the current draft in memory when browser storage is unavailable. */ }
  };

  useLayoutEffect(() => {
    const cached = owner.confirmed && memoryDrafts.has(owner.binding);
    const value = cached ? memoryDrafts.get(owner.binding)! : '';
    const run: Run = { owner, retired: false, key: null, value, edited: cached, recovered: Boolean(value) };
    active.current = run;
    setView({ owner, value, recovered: Boolean(value) });
    typing.current?.(value.trim().length > 0);
    const hideRecoveryNotice = () => {
      run.timer = setTimeout(() => {
        if (!isCurrent(run)) return;
        run.recovered = false;
        setView({ owner, value: run.value, recovered: false });
      }, 3200);
    };
    if (run.recovered) hideRecoveryNotice();
    if (owner.persistent && globalThis.crypto?.subtle && typeof TextEncoder !== 'undefined') {
      void globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(owner.binding)).then(digest => {
        if (!isCurrent(run)) return;
        run.key = DRAFT_PREFIX + Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
        if (run.edited) { persist(run); return; }
        let saved: string | null = null;
        try { saved = safeLocalStorage.getItem(run.key); } catch { return; }
        if (!saved || !isCurrent(run)) return;
        run.value = saved; run.recovered = true;
        memoryDrafts.set(owner.binding, saved);
        setView({ owner, value: saved, recovered: true });
        typing.current?.(saved.trim().length > 0);
        hideRecoveryNotice();
      }).catch(() => { /* Without a safe digest, this owner remains volatile. */ });
    }
    return () => {
      run.retired = true;
      if (run.timer) clearTimeout(run.timer);
      if (active.current === run) active.current = null;
    };
  }, [owner]);

  const setInput = useCallback((value: string | ((previous: string) => string)) => {
    const run = active.current;
    if (!run || run.owner !== owner || !isCurrent(run)) return;
    run.value = typeof value === 'function' ? value(run.value) : value;
    run.edited = true;
    if (owner.confirmed) memoryDrafts.set(owner.binding, run.value);
    persist(run);
    setView({ owner, value: run.value, recovered: run.recovered });
  }, [owner]);
  const clearDraft = useCallback(() => {
    const run = active.current;
    if (!run || run.owner !== owner || !isCurrent(run)) return;
    if (run.timer) clearTimeout(run.timer);
    run.recovered = false;
    setInput('');
  }, [owner, setInput]);
  return { input: view.owner === owner ? view.value : '', setInput, draftRecovered: view.owner === owner && view.recovered, clearDraft };
};
