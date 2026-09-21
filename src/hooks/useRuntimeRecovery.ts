import { isRuntimeRecoveryEnabled } from '@/utils/runtimeRecoveryPolicy';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackendBootstrapError, ensureBackendRuntimeReady } from '@/utils/backendBootstrapGate';
import { READINESS_LEASE_MS } from '@/utils/backendReadinessLease';

export type RecoveryPhase = 'quiet' | 'offline' | 'checking' | 'waiting' | 'verified' | 'unavailable' | 'mismatch';
const online = () => typeof navigator === 'undefined' || navigator.onLine;

/** A read-only service check, without owning the page, session, or its data. */
export function useRuntimeRecovery() {
  const [phase, setPhase] = useState<RecoveryPhase>(() => online() ? 'quiet' : 'offline');
  const active = useRef(false);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const needsReconnect = useRef(!online());
  const lastStarted = useRef(Date.now());
  const slow = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearSlow = () => { if (slow.current !== null) clearTimeout(slow.current); slow.current = null; };
  const check = useCallback((refresh = false, manual = false) => {
    if (!active.current || inFlight.current || (!online() && !manual) || document.visibilityState === 'hidden') return;
    if (!isRuntimeRecoveryEnabled()) { setPhase('quiet'); needsReconnect.current = false; return; }
    const current = ++generation.current;
    inFlight.current = true; lastStarted.current = Date.now(); needsReconnect.current = !online();
    setPhase('checking'); clearSlow();
    slow.current = setTimeout(() => { if (active.current && current === generation.current) setPhase('waiting'); }, 1600);
    void ensureBackendRuntimeReady({ enabled: true, refresh }).then(() => {
      if (active.current && current === generation.current) setPhase('verified');
    }).catch((error: unknown) => {
      if (!active.current || current !== generation.current) return;
      const body = error instanceof BackendBootstrapError ? error.body : null;
      const mismatch = !!body && typeof body === 'object' && 'reason_code' in body && body.reason_code === 'backend_revision_mismatch';
      setPhase(mismatch ? 'mismatch' : 'unavailable');
    }).finally(() => {
      if (current !== generation.current) return;
      clearSlow(); inFlight.current = false;
    });
  }, []);
  useEffect(() => {
    active.current = true;
    const disconnected = () => {
      ++generation.current; inFlight.current = false; needsReconnect.current = true;
      clearSlow(); setPhase('offline');
    };
    const connected = () => { if (needsReconnect.current) check(true); };
    const resumed = () => {
      if (!online() || document.visibilityState === 'hidden') return;
      const elapsed = Date.now() - lastStarted.current;
      if (needsReconnect.current) check(true);
      else if (elapsed < 0 || elapsed >= READINESS_LEASE_MS) check();
    };
    const restored = (event: PageTransitionEvent) => { if (event.persisted) check(true); };
    window.addEventListener('pageshow', restored);
    window.addEventListener('offline', disconnected);
    window.addEventListener('online', connected);
    window.addEventListener('focus', resumed);
    document.addEventListener('visibilitychange', resumed);
    return () => {
      active.current = false; ++generation.current; inFlight.current = false; clearSlow();
      window.removeEventListener('pageshow', restored);
      window.removeEventListener('offline', disconnected);
      window.removeEventListener('online', connected);
      window.removeEventListener('focus', resumed);
      document.removeEventListener('visibilitychange', resumed);
    };
  }, [check]);
  return { phase, retry: () => check(true, true), dismiss: () => setPhase(current => current === 'verified' ? 'quiet' : current) };
}
