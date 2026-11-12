import { StrictMode, useLayoutEffect } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantProvider, useTenant } from './TenantContext';
import { TenantShell } from '@/components/tenant/TenantShell';
import { usePanelSessionStore, useWidgetSessionStore } from '@/stores';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { resetBackendBootstrapGateForTests } from '@/utils/backendBootstrapGate';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';

vi.mock('@/utils/api', async original => original<typeof import('@/utils/api')>());
const ancillary = vi.hoisted(() => ({ profile: vi.fn(), navigation: vi.fn() }));
vi.mock('@/api/tenant', async original => ({
  ...await original<typeof import('@/api/tenant')>(),
  getTenantPublicInfoFlexible: ancillary.profile,
  getTenantPublicNavigation: ancillary.navigation,
}));
vi.mock('@/utils/anonId', () => ({ ensureRemoteAnonId: vi.fn(async () => 'synthetic-anon') }));
vi.mock('@/config', async original => ({
  ...await original<typeof import('@/config')>(),
  API_BASE_CANDIDATES: ['/api'], BASE_API_URL: '/api', SAME_ORIGIN_PROXY_BASE: '/api',
}));

const ALERT = 'No pudimos sincronizar tus espacios seguidos';
const NAME = 'Espacio público sintético';
const originalFetch = global.fetch;
const clients: QueryClient[] = [];
type Pending = { resolve: (value: Response) => void; reject: (reason: unknown) => void; init?: RequestInit };
let pending: Pending[];
let capturedContext: ReturnType<typeof useTenant> | null;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
};
const list = (slug: string) => ({ items: [{ slug, nombre: 'Espacio seguido sintético', tipo: 'municipio' }] });
function identity(id: string | null, token: string | null = id ? 'synthetic-token-' + id : null) {
  usePanelSessionStore.getState().setAuthToken(token);
  usePanelSessionStore.getState().setUser(id ? { id, email: 'actor@example.invalid', rol: 'superadmin' } : null);
}
function Probe() {
  const context = useTenant();
  useLayoutEffect(() => { capturedContext = context; }, [context]);
  const location = useLocation();
  return <>
    <output data-testid="state" data-loading={String(context.isLoadingFollowedTenants)}
      data-error={context.followedTenantsError ?? ''}>{context.followedTenants.map(item => item.slug).join(',')}</output>
    <output data-testid="path">{location.pathname}</output>
    <button onClick={context.refreshFollowedTenants}>Actualizar lista de prueba</button>
    <TenantShell><p>Contenido público disponible</p></TenantShell>
  </>;
}
function mount(strict = false, entry = '/t/tierra-del-fuego') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  const tree = <QueryClientProvider client={client}>
    <MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <TenantProvider><Probe /></TenantProvider>
    </MemoryRouter>
  </QueryClientProvider>;
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}
async function started(count: number) {
  await waitFor(() => expect(pending).toHaveLength(count));
  await waitFor(() => expect(screen.getByTestId('state')).toHaveAttribute('data-loading', 'true'));
}
async function respond(index: number, body: unknown, status = 200) {
  await act(async () => { pending[index].resolve(json(body, status)); });
}
async function loaded(slug: string) {
  await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent(slug));
  expect(screen.getByTestId('state')).toHaveAttribute('data-loading', 'false');
}
function noTechnicalAlert() {
  expect(screen.queryByText('Request context retired')).not.toBeInTheDocument();
  expect(screen.queryByText('Request retired')).not.toBeInTheDocument();
  expect(screen.queryByText(ALERT)).not.toBeInTheDocument();
  expect(screen.getByTestId('state')).toHaveAttribute('data-error', '');
}
function waitingWithoutOldItems() {
  expect(screen.getByTestId('state')).toHaveAttribute('data-loading', 'true');
  expect(screen.getByTestId('state')).toHaveTextContent(/^$/);
  noTechnicalAlert();
}

beforeEach(() => {
  vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
  safeLocalStorage.clear();
  identity(null);
  useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
  delete (window as any).CHATBOC_CONFIG;
  ancillary.profile.mockReset().mockResolvedValue({ slug: 'tierra-del-fuego', nombre: NAME, tipo: 'municipio' });
  ancillary.navigation.mockReset().mockResolvedValue({ items: [] });
  pending = [];
  capturedContext = null;
  global.fetch = vi.fn((url: unknown, init?: RequestInit) => {
    const path = new URL(String(url), 'https://synthetic.example.invalid').pathname;
    if (path !== '/api/app/me/tenants') throw new Error('unexpected_synthetic_request:' + path);
    return new Promise<Response>((resolve, reject) => { pending.push({ resolve, reject, init }); });
  }) as typeof fetch;
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
  global.fetch = originalFetch;
  resetBackendBootstrapGateForTests();
  vi.restoreAllMocks(); vi.unstubAllEnvs();
  safeLocalStorage.clear(); identity(null);
  useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
  delete (window as any).currentTenantSlug;
});

describe('followed spaces authority with real consumer/API and synthetic HTTP', () => {
  it.each(['panel token', 'cookie actor', 'revision'] as const)('silently retires %s hydration and refreshes while the public shell stays mounted', async change => {
    mount(); await started(1);
    const heading = await screen.findByRole('heading', { name: NAME });
    act(() => {
      if (change === 'panel token') identity('actor-a');
      else if (change === 'cookie actor') identity('actor-a', null);
      else advanceChatbocSessionRevision();
    });
    await started(2);
    await respond(0, list('stale-anonymous'));
    waitingWithoutOldItems();
    expect(screen.getByRole('heading', { name: NAME })).toBe(heading);
    expect(screen.getByTestId('path')).toHaveTextContent('/t/tierra-del-fuego');
    expect(ancillary.profile).toHaveBeenCalledTimes(1);
    expect(ancillary.navigation).toHaveBeenCalledTimes(1);
    await respond(1, list('current-authority')); await loaded('current-authority');
    noTechnicalAlert();
  });

  it('refreshes on a token rotation for the same actor', async () => {
    identity('actor-a'); mount(); await started(1);
    act(() => identity('actor-a', 'synthetic-rotated-token'));
    await started(2); await respond(0, list('stale-token')); waitingWithoutOldItems();
    expect(new Headers(pending[1].init?.headers).get('Authorization')).toBe('Bearer synthetic-rotated-token');
    await respond(1, list('rotated-authority')); await loaded('rotated-authority'); noTechnicalAlert();
  });

  it('keeps B loading when late A fails, then accepts B only', async () => {
    identity('actor-a'); mount(); await started(1);
    act(() => identity('actor-b')); await started(2);
    await respond(0, { error: { message: 'Synthetic old A failure' } }, 503);
    waitingWithoutOldItems();
    await respond(1, list('only-b')); await loaded('only-b'); noTechnicalAlert();
  });

  it('keeps accepted B data after late A success', async () => {
    identity('actor-a'); mount(); await started(1);
    act(() => identity('actor-b')); await started(2);
    await respond(1, list('only-b')); await loaded('only-b');
    await respond(0, list('stale-a'));
    expect(screen.getByTestId('state')).toHaveTextContent('only-b');
    expect(screen.getByTestId('state')).not.toHaveTextContent('stale-a'); noTechnicalAlert();
  });

  it('does not clear a genuine B error when retired A resolves', async () => {
    identity('actor-a'); mount(); await started(1);
    act(() => identity('actor-b')); await started(2);
    await respond(1, { message: 'Synthetic current B unavailable' }, 503);
    expect(await screen.findByText(ALERT)).toBeInTheDocument();
    const error = screen.getByTestId('state').getAttribute('data-error');
    await respond(0, list('stale-a'));
    expect(screen.getByText(ALERT)).toBeInTheDocument();
    expect(screen.getByTestId('state')).toHaveAttribute('data-error', error!);
    expect(screen.getByTestId('state')).toHaveAttribute('data-loading', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' })); await started(3);
    await respond(2, list('recovered-b')); await loaded('recovered-b'); noTechnicalAlert();
  });

  it('invalidates synchronous A-B-A store transitions even when final values equal the initial identity', async () => {
    identity('actor-a'); mount(); await started(1);
    act(() => { identity('actor-b'); identity('actor-a'); });
    await started(2);
    // The global transport sees A again; the consumer generation must still retire this old attempt.
    await respond(0, list('stale-a-before-aba')); waitingWithoutOldItems();
    await respond(1, list('fresh-a-after-aba')); await loaded('fresh-a-after-aba'); noTechnicalAlert();
  });

  it('clears loaded A spaces before B has replied', async () => {
    identity('actor-a'); mount(); await started(1);
    await respond(0, list('private-a-follow')); await loaded('private-a-follow');
    act(() => identity('actor-b'));
    expect(screen.getByTestId('state')).not.toHaveTextContent('private-a-follow');
    await started(2); waitingWithoutOldItems();
    await respond(1, list('private-b-follow')); await loaded('private-b-follow'); noTechnicalAlert();
  });

  it('clears a previous authority error while new authority is pending', async () => {
    identity('actor-a'); mount(); await started(1);
    await respond(0, { message: 'Synthetic A unavailable' }, 503);
    expect(await screen.findByText(ALERT)).toBeInTheDocument();
    act(() => identity('actor-b')); await started(2); waitingWithoutOldItems();
    await respond(1, list('current-b')); await loaded('current-b'); noTechnicalAlert();
  });

  it('offers generic recovery for a current AbortError without exposing technical text or replaying automatically', async () => {
    mount(); await started(1);
    await act(async () => { pending[0].reject(new DOMException('Synthetic request aborted', 'AbortError')); });
    await waitFor(() => expect(screen.getByTestId('state')).toHaveAttribute('data-loading', 'false'));
    expect(screen.getByText(ALERT)).toBeInTheDocument();
    expect(screen.getByTestId('state')).toHaveAttribute('data-error', 'No se pudieron actualizar los espacios seguidos en este momento.');
    expect(screen.queryByText('Synthetic request aborted')).not.toBeInTheDocument();
    expect(pending).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' })); await started(2);
    await respond(1, list('after-abort')); await loaded('after-abort'); noTechnicalAlert();
  });

  it('CONTROL: stable authority succeeds without technical messages', async () => {
    mount(); await started(1); await respond(0, list('stable-follow')); await loaded('stable-follow');
    noTechnicalAlert(); expect(pending).toHaveLength(1);
  });

  it('CONTROL: presentation tenant, unrelated chat token and user metadata do not refresh panel follows', async () => {
    identity('actor-a'); mount(); await started(1);
    act(() => {
      safeLocalStorage.setItem('tenantSlug', 'unrelated-public-presentation');
      useWidgetSessionStore.setState({ chatAuthToken: 'synthetic-unrelated-chat' });
      usePanelSessionStore.getState().setUser({ ...usePanelSessionStore.getState().user!, name: 'Synthetic display' });
    });
    await respond(0, list('panel-follow')); await loaded('panel-follow');
    noTechnicalAlert(); expect(pending).toHaveLength(1);
  });

  it('CONTROL: a genuine HTTP 503 remains visible until explicit retry succeeds', async () => {
    mount(); await started(1); await respond(0, { message: 'Synthetic service unavailable' }, 503);
    expect(await screen.findByText(ALERT)).toBeInTheDocument();
    expect(pending).toHaveLength(1); expect(screen.getByTestId('state')).toHaveAttribute('data-loading', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' })); await started(2);
    await respond(1, list('retry-follow')); await loaded('retry-follow'); noTechnicalAlert();
  });

  it('retires superseded explicit refresh results without changing authority', async () => {
    mount(); await started(1);
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar lista de prueba' })); await started(2);
    await respond(1, list('newest-refresh')); await loaded('newest-refresh');
    await respond(0, { message: 'Synthetic superseded failure' }, 503);
    noTechnicalAlert(); expect(screen.getByTestId('state')).toHaveTextContent('newest-refresh');
  });

  it('cleans subscriptions and ignores a pending response after unmount', async () => {
    const view = mount(); await started(1); view.unmount();
    act(() => { identity('actor-b'); advanceChatbocSessionRevision(); });
    await respond(0, list('unmounted-old-follow'));
    expect(pending).toHaveLength(1); expect(screen.queryByTestId('state')).not.toBeInTheDocument();
    expect(screen.queryByText(ALERT)).not.toBeInTheDocument();
  });

  it('survives StrictMode cleanup and a later authority transition without resurrecting old data', async () => {
    mount(true); await waitFor(() => expect(pending.length).toBeGreaterThan(0));
    const oldCount = pending.length;
    act(() => identity('actor-b')); await started(oldCount + 1);
    for (let index = 0; index < oldCount; index += 1) await respond(index, list('strict-old-' + index));
    waitingWithoutOldItems();
    await respond(oldCount, list('strict-current-b')); await loaded('strict-current-b'); noTechnicalAlert();
  });

  it('allows live refresh but never dispatches from the retained callback after unmount', async () => {
    const view = mount(); await started(1);
    await respond(0, list('initial-live-follow')); await loaded('initial-live-follow');
    let work!: Promise<void>; act(() => { work = capturedContext!.refreshFollowedTenants(); });
    await started(2); await respond(1, list('refreshed-live-follow')); await work; await loaded('refreshed-live-follow');
    const retained = capturedContext!.refreshFollowedTenants; view.unmount();
    const afterUnmount = vi.fn(async () => json({ items: [] })); global.fetch = afterUnmount as typeof fetch;
    await act(async () => { await retained(); });
    expect(afterUnmount).not.toHaveBeenCalled();
  });

  it('does not dispatch a follow-list GET after an already sent follow POST resolves on the unmounted provider', async () => {
    let reads = 0; let writes = 0;
    const post = deferred<Response>();
    global.fetch = vi.fn(async (url: unknown, init?: RequestInit) => {
      const path = new URL(String(url), 'https://synthetic.example.invalid').pathname;
      if (path === '/api/app/me/tenants' && (!init?.method || init.method === 'GET')) { reads += 1; return json({ items: [] }); }
      if (path === '/api/app/me/tenants/follow' && init?.method === 'POST') {
        writes += 1; expect(JSON.parse(String(init.body))).toEqual({ slug: 'tierra-del-fuego' }); return post.promise;
      }
      throw new Error('unexpected_synthetic_request:' + path);
    }) as typeof fetch;
    const view = mount(); await waitFor(() => expect(reads).toBe(1));
    await waitFor(() => expect(capturedContext?.isLoadingFollowedTenants).toBe(false));
    let work!: Promise<void>; act(() => { work = capturedContext!.followCurrentTenant(); });
    await waitFor(() => expect(writes).toBe(1)); expect(reads).toBe(1); view.unmount();
    await act(async () => { post.resolve(json({})); await work; });
    expect(writes).toBe(1); expect(reads).toBe(1);
  });

  it.each(['widget tenantSlug', 'panel clerkUserId', 'panel authProvider'] as const)('offers explicit recovery for current transport %s drift', async kind => {
    if (kind === 'widget tenantSlug') ancillary.profile.mockResolvedValue({ slug: 'widget-a', nombre: NAME, tipo: 'municipio' });
    mount(false, kind === 'widget tenantSlug' ? '/t/widget-a?widget_token=synthetic-entity-a' : '/t/tierra-del-fuego');
    await started(1);
    if (kind === 'widget tenantSlug') safeLocalStorage.setItem('tenantSlug', 'unrelated-public-presentation');
    else if (kind === 'panel clerkUserId') safeLocalStorage.setItem('clerkUserId', 'synthetic-clerk-b');
    else safeLocalStorage.setItem('authProvider', 'clerk');
    await respond(0, list('retired-transport-payload'));
    expect(screen.getByTestId('state')).toHaveTextContent(/^$/);
    expect(screen.getByText(ALERT)).toBeInTheDocument();
    expect(screen.getByTestId('state')).toHaveAttribute('data-error', 'No se pudieron actualizar los espacios seguidos en este momento.');
    expect(screen.queryByText('Request context retired')).not.toBeInTheDocument();
    expect(pending).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' })); await started(2);
    await respond(1, list('explicit-recovery')); await loaded('explicit-recovery'); noTechnicalAlert();
  });

  it('clears a previously loaded list when current explicit-refresh transport retires, then recovers explicitly', async () => {
    ancillary.profile.mockResolvedValue({ slug: 'widget-a', nombre: NAME, tipo: 'municipio' });
    mount(false, '/t/widget-a?widget_token=synthetic-entity-a'); await started(1);
    await respond(0, list('previously-loaded-follow')); await loaded('previously-loaded-follow');
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar lista de prueba' })); await started(2);
    safeLocalStorage.setItem('tenantSlug', 'unrelated-public-presentation');
    await respond(1, list('retired-transport-payload'));
    expect(screen.getByTestId('state')).toHaveTextContent(/^$/);
    expect(screen.getByTestId('state')).toHaveAttribute('data-error', 'No se pudieron actualizar los espacios seguidos en este momento.');
    expect(screen.getByText(ALERT)).toBeInTheDocument();
    expect(screen.queryByText('Request context retired')).not.toBeInTheDocument();
    expect(pending).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' })); await started(3);
    await respond(2, list('explicit-fresh-follow')); await loaded('explicit-fresh-follow'); noTechnicalAlert();
  });
});
