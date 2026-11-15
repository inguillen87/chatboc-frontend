import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MarketCartProvider, useMarketCart } from '@/context/MarketCartContext';
import { addMarketItem, clearMarketCart, removeMarketItem } from '@/api/market';
import { advanceChatbocSessionRevision, captureChatbocSessionRevision } from '@/utils/chatbocSessionRevision';
import { usePanelSessionStore, useTenantStore } from '@/stores';
import { useCartCount } from './useCartCount';

// Real hook, cart provider, API normalization and HTTP transport. Only tenant context,
// runtime readiness and HTTP responses are synthetic; controls exercise the production mutations.
const context = vi.hoisted(() => ({ slug: 'qa-cart-a', ready: vi.fn() }));
vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));
vi.mock('@/utils/api', async () => await vi.importActual('@/utils/api'));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => ({ currentSlug: context.slug }) }));
vi.mock('@/utils/backendBootstrapGate', async () => ({
  ...await vi.importActual<typeof import('@/utils/backendBootstrapGate')>('@/utils/backendBootstrapGate'),
  ensureBackendRuntimeReady: (...args: unknown[]) => context.ready(...args),
}));
vi.mock('@/utils/frontendTelemetry', () => ({ trackFrontendEvent: vi.fn() }));

type Item = { id: string; name: string; quantity: number };
type Call = { tenant: string; method: string; item: string | null };
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
const reply = (items: Item[]) => new Response(JSON.stringify({ items }), { headers: { 'Content-Type': 'application/json' } });
let calls: Call[];
let carts: Record<string, Item[]>;
let initialRead: ReturnType<typeof deferred<Response>> | null;
const countReads = (tenant = context.slug) => calls.filter(call => call.tenant === tenant && call.method === 'GET').length;
const renders: Array<{ slug: string; enabled: boolean; count: number }> = [];
function Badge({ enabled = true }: { enabled?: boolean }) {
  const count = useCartCount(enabled);
  renders.push({ slug: context.slug, enabled, count });
  return <output data-testid="cart-count">{count}</output>;
}
function CatalogControl() {
  const { addItem, isLoading } = useMarketCart();
  return <button type="button" disabled={isLoading} onClick={() => void addItem('p1', 2)}>Add from catalog</button>;
}
function DirectControls({ tenant = context.slug }: { tenant?: string }) {
  return <>
    <button type="button" onClick={() => void addMarketItem(tenant, { productId: 'p1', quantity: 2 })}>Add direct</button>
    <button type="button" onClick={() => void removeMarketItem(tenant, 'p1')}>Remove</button>
    <button type="button" onClick={() => void clearMarketCart(tenant)}>Clear</button>
  </>;
}
const view = ({ enabled = true, provider = true, mutationTenant }: { enabled?: boolean; provider?: boolean; mutationTenant?: string } = {}) =>
  <MemoryRouter initialEntries={['/t/qa-cart-a/market']}>
    <Badge enabled={enabled} />
    {provider ? <MarketCartProvider tenantSlug={context.slug}><CatalogControl /></MarketCartProvider> : null}
    <DirectControls tenant={mutationTenant ?? context.slug} />
  </MemoryRouter>;

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); usePanelSessionStore.getState().clearSession();
  advanceChatbocSessionRevision(); context.slug = 'qa-cart-a'; useTenantStore.getState().setTenant(context.slug);
  context.ready.mockReset().mockResolvedValue(undefined);
  calls = []; carts = { 'qa-cart-a': [], 'qa-cart-b': [] }; initialRead = null; renders.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, 'http://localhost');
    const match = url.pathname.match(/\/(qa-cart-[ab])\/carrito(?:\/([^/]+))?$/);
    if (!match) throw new Error('Unexpected synthetic cart HTTP destination');
    const tenant = match[1], item = match[2] ?? null, method = init?.method ?? 'GET';
    calls.push({ tenant, method, item });
    if (method === 'GET') {
      const pending = initialRead; initialRead = null;
      return pending ? pending.promise : reply(carts[tenant]);
    }
    if (method === 'POST') {
      const body = JSON.parse(String(init?.body));
      carts[tenant] = [{ id: body.productId, name: 'Synthetic product', quantity: body.quantity }];
    } else if (method === 'DELETE') {
      carts[tenant] = item ? carts[tenant].filter(row => row.id !== item) : [];
    } else throw new Error('Unexpected synthetic cart HTTP method');
    return reply(carts[tenant]);
  }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('cart count across independent same-tab consumers', () => {
  it('updates a badge outside MarketCartProvider after real add, remove and clear mutations', async () => {
    const user = userEvent.setup(); render(view());
    const add = screen.getByRole('button', { name: 'Add from catalog' });
    await waitFor(() => expect(add).toBeEnabled());
    expect(screen.getByTestId('cart-count')).toHaveTextContent(/^0$/);
    await user.click(add);
    await waitFor(() => expect(screen.getByTestId('cart-count')).toHaveTextContent(/^2$/));
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(screen.getByTestId('cart-count')).toHaveTextContent(/^0$/));
    await user.click(add);
    await waitFor(() => expect(screen.getByTestId('cart-count')).toHaveTextContent(/^2$/));
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(screen.getByTestId('cart-count')).toHaveTextContent(/^0$/));
    expect(calls.filter(call => call.method !== 'GET').map(({ method, item }) => ({ method, item }))).toEqual([
      { method: 'POST', item: null }, { method: 'DELETE', item: 'p1' },
      { method: 'POST', item: null }, { method: 'DELETE', item: null },
    ]);
  });

  it('does not let an initial delayed GET replace the count confirmed after a mutation', async () => {
    const pending = deferred<Response>(); initialRead = pending;
    const user = userEvent.setup(); render(view({ provider: false }));
    await waitFor(() => expect(countReads()).toBe(1));
    await user.click(screen.getByRole('button', { name: 'Add direct' }));
    await waitFor(() => expect(screen.getByTestId('cart-count')).toHaveTextContent(/^2$/));
    await act(async () => { pending.resolve(reply([{ id: 'old', name: 'Old response', quantity: 9 }])); });
    expect(screen.getByTestId('cart-count')).toHaveTextContent(/^2$/);
  });

  it('ignores another tenant mutation and retires the previous count before reading the new tenant', async () => {
    carts['qa-cart-a'] = [{ id: 'p1', name: 'A', quantity: 4 }];
    const user = userEvent.setup(); const mounted = render(view({ provider: false, mutationTenant: 'qa-cart-b' }));
    await waitFor(() => expect(screen.getByTestId('cart-count')).toHaveTextContent(/^4$/));
    await user.click(screen.getByRole('button', { name: 'Add direct' }));
    expect(countReads('qa-cart-a')).toBe(1);
    expect(screen.getByTestId('cart-count')).toHaveTextContent(/^4$/);
    const pending = deferred<Response>(); initialRead = pending;
    context.slug = 'qa-cart-b'; useTenantStore.getState().setTenant(context.slug); renders.length = 0;
    mounted.rerender(view({ provider: false }));
    expect(renders[0]).toEqual({ slug: 'qa-cart-b', enabled: true, count: 0 });
    expect(screen.getByTestId('cart-count')).toHaveTextContent(/^0$/);
    await act(async () => { pending.resolve(reply(carts['qa-cart-b'])); });
    await waitFor(() => expect(screen.getByTestId('cart-count')).toHaveTextContent(/^2$/));
  });

  it('withdraws the count in the first disabled render and ignores mutations until enabled again', async () => {
    carts['qa-cart-a'] = [{ id: 'p1', name: 'A', quantity: 4 }];
    const user = userEvent.setup(); const mounted = render(view({ provider: false }));
    await waitFor(() => expect(screen.getByTestId('cart-count')).toHaveTextContent(/^4$/));
    renders.length = 0; mounted.rerender(view({ provider: false, enabled: false }));
    expect(renders[0]).toEqual({ slug: 'qa-cart-a', enabled: false, count: 0 });
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(countReads()).toBe(1); expect(screen.getByTestId('cart-count')).toHaveTextContent(/^0$/);
    mounted.rerender(view({ provider: false }));
    await waitFor(() => expect(countReads()).toBe(2));
    expect(screen.getByTestId('cart-count')).toHaveTextContent(/^0$/);
  });

  it('retires the count on session revision and reads the new session without reusing the cached display draft', async () => {
    localStorage.setItem('chatboc_market_cart_qa-cart-a', JSON.stringify({ items: [{ quantity: 99 }] }));
    carts['qa-cart-a'] = [{ id: 'p1', name: 'A', quantity: 4 }]; render(view({ provider: false }));
    await waitFor(() => expect(screen.getByTestId('cart-count')).toHaveTextContent(/^4$/));
    const pending = deferred<Response>(); initialRead = pending; renders.length = 0;
    act(() => { advanceChatbocSessionRevision(); });
    expect(renders[0]?.count).toBe(0);
    expect(screen.getByTestId('cart-count')).toHaveTextContent(/^0$/);
    await act(async () => { pending.resolve(reply([])); });
    await waitFor(() => expect(countReads()).toBe(2));
    expect(screen.getByTestId('cart-count')).toHaveTextContent(/^0$/);
  });

  it('coalesces invalidations and derives the count from a fresh response instead of event data', async () => {
    carts['qa-cart-a'] = [{ id: 'p1', name: 'A', quantity: 4 }]; render(view({ provider: false }));
    await waitFor(() => expect(screen.getByTestId('cart-count')).toHaveTextContent(/^4$/));
    carts['qa-cart-a'] = [{ id: 'p1', name: 'Current backend cart', quantity: 3 }];
    act(() => {
      for (let index = 0; index < 3; index += 1) window.dispatchEvent(new CustomEvent('chatboc:market-cart-changed', {
        detail: { tenantSlug: context.slug, sessionRevision: captureChatbocSessionRevision(), count: 99, items: [{ quantity: 99 }] },
      }));
    });
    await waitFor(() => expect(screen.getByTestId('cart-count')).toHaveTextContent(/^3$/));
    expect(countReads()).toBe(2);
    expect(renders.every(rendered => rendered.count !== 99)).toBe(true);
  });
});
