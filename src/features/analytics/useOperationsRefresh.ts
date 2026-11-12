import { useCallback, useEffect, useRef, useState } from 'react';
import { createOperationsRefreshCoordinator, operationsEventMatchesTenant, type OperationsRefreshMode } from './operationsReadState';
interface OperationsSocket {
  on: (event: string, listener: (payload?: unknown) => void) => unknown;
  off: (event: string, listener: (payload?: unknown) => void) => unknown;
}
export function useOperationsRefresh(options: {
  scopeKey: string; tenantSlug: string; pollSeconds: number | null | undefined;
  socket: OperationsSocket | null | undefined; connected: boolean; eventNames: string[];
  run: (mode: OperationsRefreshMode) => Promise<unknown>;
}) {
  const runRef = useRef(options.run); runRef.current = options.run;
  const coordinator = useRef<ReturnType<typeof createOperationsRefreshCoordinator> | null>(null);
  const [paused, setPaused] = useState(() => typeof document !== 'undefined' && document.hidden);
  const [busy, setBusy] = useState(false);
  const eventsKey = JSON.stringify(options.eventNames);
  useEffect(() => {
    let active = true;
    const current = createOperationsRefreshCoordinator({
      visible: () => !document.hidden,
      run: (mode) => runRef.current(mode),
      onBusy: (value) => { if (active) setBusy(value); },
    });
    coordinator.current = current; setBusy(false); setPaused(document.hidden);
    const visibility = () => {
      setPaused(document.hidden); current.visibilityChanged();
      if (!document.hidden) current.request('all', 'resume');
    };
    const event = (payload?: unknown) => {
      if (operationsEventMatchesTenant(payload, options.tenantSlug)) current.request('core', 'event');
    };
    const events: string[] = JSON.parse(eventsKey);
    if (options.socket && options.connected) events.forEach((name) => options.socket!.on(name, event));
    const timer = options.pollSeconds && options.pollSeconds > 0
      ? window.setInterval(() => current.request('all', 'timer'), options.pollSeconds * 1000) : null;
    document.addEventListener('visibilitychange', visibility);
    return () => {
      active = false; current.dispose();
      if (coordinator.current === current) coordinator.current = null;
      if (timer !== null) window.clearInterval(timer);
      document.removeEventListener('visibilitychange', visibility);
      if (options.socket && options.connected) events.forEach((name) => options.socket!.off(name, event));
    };
  }, [options.scopeKey, options.tenantSlug, options.pollSeconds, options.socket, options.connected, eventsKey]);
  const refreshNow = useCallback(() => coordinator.current?.request('all', 'manual'), []);
  return { paused, busy, refreshNow };
}
