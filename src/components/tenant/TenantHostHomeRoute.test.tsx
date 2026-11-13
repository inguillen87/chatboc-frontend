import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantHostHomeRoute } from './TenantHostHomeRoute';
import { tenantHostFixture, tenantHostPayload } from '@/test/fixtures/tenantHost';
import { publishTenantHostRuntime, readActiveTenantHostRuntime, readTenantHostBinding } from '@/utils/tenantHostBinding';
const state = vi.hoisted(() => ({ binding: null as unknown, lookup: vi.fn() }));
vi.mock('@/api/tenantHost', () => ({ getTenantHostBinding: state.lookup }));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => ({ hostBinding: state.binding }) }));
vi.mock('@/pages/tenant/TenantHomePage', () => ({ default: () => <h1>Existing organization home</h1> }));
beforeEach(() => { state.binding = null; state.lookup.mockReset(); publishTenantHostRuntime(null); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); publishTenantHostRuntime(null); });
const renderHome = (entry = '/') => render(<MemoryRouter initialEntries={[entry]}>
  <TenantHostHomeRoute><h1>Shared Chatboc</h1></TenantHostHomeRoute>
</MemoryRouter>);
describe('same application root on an active bound domain', () => {
  it('preserves the shared Chatboc root', () => {
    renderHome();
    expect(screen.getByRole('heading', { name: 'Shared Chatboc' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Existing organization home' })).not.toBeInTheDocument();
  });
  it('uses the existing tenant home rather than creating another landing', async () => {
    state.binding = tenantHostFixture(); renderHome();
    expect(await screen.findByRole('heading', { name: 'Existing organization home' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Shared Chatboc' })).not.toBeInTheDocument();
  });
});

function canonicalSource(path = '/') {
  const binding = readTenantHostBinding({ ...tenantHostPayload('synthetic-alias.vercel.app'),
    canonical_origin: 'https://civic.example.test', canonical_redirect_required: true }, 'synthetic-alias.vercel.app');
  state.binding = binding; publishTenantHostRuntime(binding);
  const location = { href: `${binding.origin}${path}`, replace: vi.fn() };
  const original = window;
  vi.stubGlobal('window', new Proxy(original, { get(target, key) { return key === 'location' ? location : Reflect.get(target, key); } }));
  return { binding, location };
}

describe('canonical root navigation', () => {
  it('verifies the destination through the anonymous resolver and retains source runtime until navigation', async () => {
    const { binding, location } = canonicalSource();
    state.lookup.mockResolvedValue(tenantHostFixture('civic.example.test'));
    renderHome();
    await waitFor(() => expect(location.replace).toHaveBeenCalledWith('https://civic.example.test/'));
    expect(state.lookup).toHaveBeenCalledWith('civic.example.test', expect.any(AbortSignal));
    expect(location.replace).toHaveBeenCalledTimes(1);
    expect(readActiveTenantHostRuntime(binding.host)).toBe(binding);
  });
  it.each(['/login', '/sso-callback', '/auth/sso-callback', '/perfil', '/t/government-east',
    '/?code=synthetic-secret', '/#token=synthetic-secret'])('does not initiate canonical discovery on %s', path => {
    const { location } = canonicalSource(path);
    renderHome(path);
    expect(state.lookup).not.toHaveBeenCalled(); expect(location.replace).not.toHaveBeenCalled();
  });
  it.each(['runtime', 'location', 'expiry', 'unmount'])('retires a pending destination read when %s changes', async change => {
    const { binding, location } = canonicalSource();
    let resolve!: (value: ReturnType<typeof tenantHostFixture>) => void;
    state.lookup.mockReturnValue(new Promise(done => { resolve = done; }));
    const view = renderHome();
    expect(state.lookup).toHaveBeenCalledTimes(1);
    if (change === 'runtime') publishTenantHostRuntime(tenantHostFixture(binding.host));
    if (change === 'location') location.href += '?code=synthetic-secret';
    if (change === 'expiry') vi.spyOn(Date, 'now').mockReturnValue(binding.binding.valid_until * 1000);
    if (change === 'unmount') view.unmount();
    await act(async () => { resolve(tenantHostFixture('civic.example.test')); });
    expect(location.replace).not.toHaveBeenCalled();
    if (change === 'unmount') expect(state.lookup.mock.calls[0][1].aborted).toBe(true);
  });
  it('keeps the source public page when canonical verification fails', async () => {
    const { binding, location } = canonicalSource();
    state.lookup.mockRejectedValue(new Error('unavailable'));
    renderHome();
    await screen.findByRole('heading', { name: 'Existing organization home' });
    await act(async () => { await Promise.resolve(); });
    expect(location.replace).not.toHaveBeenCalled();
    expect(readActiveTenantHostRuntime(binding.host)).toBe(binding);
  });
});
