import { useCallback, useEffect, useState } from 'react';
import { getTenantHostBinding } from '@/api/tenantHost';
import { normalizeTenantHostname, publishTenantHostRuntime, requiresTenantHostBinding } from '@/utils/tenantHostBinding';
import type { TenantHostBinding } from '@/types/tenantHost';

export function useTenantHostBinding() {
  const hostname = typeof window === 'undefined' ? '' : window.location.hostname;
  const required = requiresTenantHostBinding(hostname);
  const host = normalizeTenantHostname(hostname);
  const [state, setState] = useState<{ host: string | null; binding: TenantHostBinding | null; status: 'loading' | 'active' | 'unavailable' }>({ host, binding: null, status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const refresh = useCallback(() => {
    publishTenantHostRuntime(null);
    setState({ host, binding: null, status: 'loading' });
    setAttempt(value => value + 1);
  }, [host]);
  useEffect(() => {
    if (!required) { publishTenantHostRuntime(null); return; }
    const controller = new AbortController();
    let current = true;
    let expiry: ReturnType<typeof setTimeout> | undefined;
    publishTenantHostRuntime(null);
    setState({ host, binding: null, status: 'loading' });
    if (!host) { setState({ host, binding: null, status: 'unavailable' }); return; }
    getTenantHostBinding(host, controller.signal).then(binding => {
      if (!current) return;
      publishTenantHostRuntime(binding);
      setState({ host, binding, status: 'active' });
      const delay = Math.min(2147483647, Math.max(0, binding.binding.valid_until * 1000 - Date.now()));
      expiry = setTimeout(() => { publishTenantHostRuntime(null); setState({ host, binding: null, status: 'unavailable' }); }, delay);
    }).catch(() => { if (current) setState({ host, binding: null, status: 'unavailable' }); });
    return () => { current = false; controller.abort(); clearTimeout(expiry); publishTenantHostRuntime(null); };
  }, [host, required, attempt]);
  const matchingState = state.host === host ? state : { host, binding: null, status: 'loading' as const };
  return { required, host, binding: required ? matchingState.binding : null, status: required ? matchingState.status : 'platform' as const, refresh };
}
