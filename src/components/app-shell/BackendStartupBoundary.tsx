import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { BackendBootstrapError, ensureBackendRuntimeReady, isBackendBootstrapGateEnabled } from '@/utils/backendBootstrapGate';
import { StartupRecovery } from './StartupRecovery';
import type { StartupPhase } from '@/config/startupExperience';

/** Only pre-mount startup is gated. Never remove an active page or its drafts. */
export function BackendStartupBoundary({ children }: { children: ReactNode }) {
  const enabled = useMemo(() => isBackendBootstrapGateEnabled(), []);
  const { isOnline } = useNetworkStatus();
  const [completed, setCompleted] = useState(!enabled);
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<StartupPhase>('checking');
  const locked = useRef(false);
  useEffect(() => {
    if (!enabled || completed || !isOnline) return;
    let cancelled = false;
    locked.current = true;
    setPhase('checking');
    const slow = setTimeout(() => { if (!cancelled) setPhase('waiting'); }, 1600);
    void ensureBackendRuntimeReady({ enabled: true }).then(() => {
      if (!cancelled) setCompleted(true);
    }).catch((error: unknown) => {
      if (cancelled) return;
      const body = error instanceof BackendBootstrapError ? error.body : null;
      const mismatch = !!body && typeof body === 'object' && 'reason_code' in body && body.reason_code === 'backend_revision_mismatch';
      setPhase(mismatch ? 'mismatch' : 'unavailable');
    }).finally(() => {
      clearTimeout(slow);
      if (!cancelled) locked.current = false;
    });
    return () => { cancelled = true; clearTimeout(slow); locked.current = false; };
  }, [attempt, completed, enabled, isOnline]);
  if (completed) return <>{children}</>;
  return <StartupRecovery phase={isOnline ? phase : 'offline'} onRetry={() => {
    if (locked.current || !isOnline) return;
    locked.current = true;
    setPhase('checking');
    setAttempt(value => value + 1);
  }}/>;
}
