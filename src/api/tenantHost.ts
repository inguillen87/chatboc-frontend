import type { TenantHostBinding } from '@/types/tenantHost';
import { normalizeTenantHostname, readTenantHostBinding, TenantHostNotPublishedError, TenantHostUnavailableError } from '@/utils/tenantHostBinding';

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
    if (response.redirected || !response.headers.get('Content-Type')?.includes('application/json')) throw new TenantHostUnavailableError();
    const raw = await response.text();
    if (raw.length > 16384) throw new TenantHostUnavailableError();
    const payload = JSON.parse(raw);
    if (controller.signal.aborted) throw new TenantHostUnavailableError();
    if (response.status === 404 && payload?.contract_version === 'public.tenant_host.v1' &&
      payload.reason_code === 'host_not_available' && payload.tenant === null &&
      Object.keys(payload).length === 3) throw new TenantHostNotPublishedError();
    if (!response.ok) throw new TenantHostUnavailableError();
    return readTenantHostBinding(payload, host);
  } catch (error) {
    if (error instanceof TenantHostNotPublishedError) throw error;
    throw new TenantHostUnavailableError();
  }
  finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
}
