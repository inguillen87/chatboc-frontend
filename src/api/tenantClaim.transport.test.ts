import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePanelSessionStore, useWidgetSessionStore } from '@/stores';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { submitTenantTicket } from './tenant';

const runtime = vi.hoisted(() => ({ ready: vi.fn() }));
vi.mock('@/utils/api', async () => await vi.importActual('@/utils/api'));
vi.mock('@/utils/backendBootstrapGate', async original => ({
  ...await original<typeof import('@/utils/backendBootstrapGate')>(),
  ensureBackendRuntimeReady: runtime.ready,
}));

const receipt = {
  contract_version: 'claims.intake_receipt.v1', ok: true, persisted: true,
  deduplicated: false, request_id: 'fixture-request',
  claim: { id: 123, code: 'T-123', status: 'nuevo', category: null, created_at: '2026-10-14T00:00:00Z' },
  access: { mode: 'code_pin', pin: '111111' },
  tracking: { path: '/tracking/claim/T-123#pin=111111', experience_endpoint: '/api/public/tracking/experience?kind=claim&code=T-123', credential_transport: 'x-tracking-pin-header', requires_pin: true },
  actions: [{ id: 'track_claim', label: 'Ver seguimiento', href: '/tracking/claim/T-123#pin=111111' }],
};
const response = () => new Response(JSON.stringify(receipt), { headers: { 'Content-Type': 'application/json' } });
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};

beforeEach(() => {
  runtime.ready.mockReset().mockResolvedValue(undefined);
  safeLocalStorage.clear();
  usePanelSessionStore.setState({ authToken: null, user: null });
  useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
});
afterEach(() => {
  vi.unstubAllGlobals();
  safeLocalStorage.clear();
  usePanelSessionStore.setState({ authToken: null, user: null });
  useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
});

describe('claim request scope through real apiFetch', () => {
  it('keeps the active mutation on its explicit tenant and idempotency key', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response());
    vi.stubGlobal('fetch', fetcher);
    await expect(submitTenantTicket('junin', { descripcion: 'Fixture only' }, 'claim-intake-transport-1', {
      isCurrent: () => true,
    })).resolves.toEqual(receipt);
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0];
    expect(new URL(String(url), 'https://fixture.example.invalid').pathname).toBe('/api/pwa/app/tickets');
    expect(new Headers(init.headers).get('X-Tenant')).toBe('junin');
    expect(new Headers(init.headers).get('Idempotency-Key')).toBe('claim-intake-transport-1');
    expect(init.method).toBe('POST');
  });

  it.each(['retired', 'aborted'])('does not dispatch after startup while %s', async (reason) => {
    const ready = deferred<void>();
    runtime.ready.mockReturnValueOnce(ready.promise);
    const fetcher = vi.fn().mockResolvedValueOnce(response());
    vi.stubGlobal('fetch', fetcher);
    let current = true;
    const controller = new AbortController();
    const pending = submitTenantTicket('junin', { descripcion: 'Fixture only' }, 'claim-intake-transport-2', {
      isCurrent: () => current, signal: controller.signal,
    });
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    if (reason === 'retired') current = false;
    else controller.abort();
    ready.resolve();
    await rejected;
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('does not expose a receipt delivered after its initiating context retired', async () => {
    const remote = deferred<Response>();
    const fetcher = vi.fn().mockReturnValueOnce(remote.promise);
    vi.stubGlobal('fetch', fetcher);
    let current = true;
    const pending = submitTenantTicket('junin', { descripcion: 'Fixture only' }, 'claim-intake-transport-3', {
      isCurrent: () => current,
    });
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    current = false;
    remote.resolve(response());
    await rejected;
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
