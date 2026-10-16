import type { TenantHostBinding } from '@/types/tenantHost';
import { normalizeTenantHostname, readTenantHostBinding, TenantHostUnavailableError } from '@/utils/tenantHostBinding';

/** Same-origin only, without panel cookies, tenant preferences, widget tokens or redirects. */
export async function getTenantHostBinding(hostname: string, signal?: AbortSignal): Promise<TenantHostBinding> {
  const host = normalizeTenantHostname(hostname);
  if (!host) throw new TenantHostUnavailableError();
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 8000);
  try {
    const response = await fetch(`/api/public/host-resolution?host=${encodeURIComponent(host)}`, {
      method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error',
      headers: { Accept: 'application/json' }, signal: controller.signal,
    });
    if (!response.ok || response.redirected || !response.headers.get('Content-Type')?.includes('application/json')) throw new TenantHostUnavailableError();
    const raw = await response.text();
    if (raw.length > 16384) throw new TenantHostUnavailableError();
    return readTenantHostBinding(JSON.parse(raw), host);
  } catch { throw new TenantHostUnavailableError(); }
  finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
}
