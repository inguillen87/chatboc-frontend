import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TenantProvider, useTenant } from './TenantContext';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

const tenantApiMocks = vi.hoisted(() => ({
  followTenant: vi.fn(), getTenantPublicInfoFlexible: vi.fn(), listFollowedTenants: vi.fn(), unfollowTenant: vi.fn(),
}));
// El setup global reemplaza Link/useNavigate; esta prueba necesita navegación real.
vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));
vi.mock('@/api/tenant', () => tenantApiMocks);
vi.mock('@/utils/anonId', () => ({ ensureRemoteAnonId: vi.fn().mockResolvedValue('anon-test') }));

const appearance = (slug: string, primary: string, accent: string) => ({ tenantSlug: slug, version: 1, primary, accent });
const info = (slug: string, extra: Record<string, unknown> = {}) => ({ slug, nombre: `Espacio ${slug}`, tipo: 'gobierno', ...extra });
const deferred = <T,>() => { let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; };

const Probe = () => {
  const { currentSlug, isLoadingTenant, tenantError } = useTenant();
  return <>
    <output>{isLoadingTenant ? 'loading' : tenantError ? 'error' : 'ready'}:{currentSlug ?? 'none'}</output>
    <Link to="/t/qa-b">B</Link>
    <Link to="/t/qa-a">A</Link>
    <Link to="/precios">Fuera</Link>
  </>;
};
const mount = (path: string) => render(
  <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <TenantProvider><Probe /></TenantProvider>
  </MemoryRouter>);
const primary = () => document.documentElement.style.getPropertyValue('--primary');

describe('TenantProvider public workspace appearance', () => {
  beforeEach(() => {
    safeLocalStorage.clear();
    document.documentElement.removeAttribute('style');
    tenantApiMocks.getTenantPublicInfoFlexible.mockReset();
    tenantApiMocks.listFollowedTenants.mockReset().mockResolvedValue([]);
  });

  it('applies the palette only while the organization is authoritative for /t/<slug>', async () => {
    const slowB = deferred<ReturnType<typeof info>>();
    tenantApiMocks.getTenantPublicInfoFlexible.mockImplementation((slug: string) => slug === 'qa-a'
      ? Promise.resolve(info('qa-a', { workspace_appearance: appearance('qa-a', '#353535', '#FD8D00') }))
      : slowB.promise);
    const user = userEvent.setup();
    const view = mount('/t/qa-a');
    await waitFor(() => expect(screen.getByText('ready:qa-a')).toBeInTheDocument());
    await waitFor(() => expect(primary()).not.toBe(''));
    const paletteA = primary();
    expect(document.documentElement.style.getPropertyValue('--primary-foreground')).not.toBe('');
    expect(document.documentElement.style.getPropertyValue('--secondary')).not.toBe('');

    await user.click(screen.getByRole('link', { name: 'B' }));
    await waitFor(() => expect(primary()).toBe(''));

    await act(async () => { slowB.reject(new Error('Perfil B no disponible')); });
    await waitFor(() => expect(screen.getByText(/^error:/)).toBeInTheDocument());
    expect(primary()).toBe('');

    await user.click(screen.getByRole('link', { name: 'A' }));
    await waitFor(() => expect(primary()).toBe(paletteA));

    await user.click(screen.getByRole('link', { name: 'Fuera' }));
    await waitFor(() => expect(primary()).toBe(''));
    view.unmount();
    expect(primary()).toBe('');
  });

  it('keeps the default palette when the backend projects none or one for another organization', async () => {
    tenantApiMocks.getTenantPublicInfoFlexible.mockResolvedValueOnce(info('qa-a', { workspace_appearance: null }));
    const none = mount('/t/qa-a');
    await waitFor(() => expect(screen.getByText('ready:qa-a')).toBeInTheDocument());
    expect(primary()).toBe('');
    none.unmount();

    tenantApiMocks.getTenantPublicInfoFlexible.mockResolvedValueOnce(info('qa-a', { workspace_appearance: appearance('qa-b', '#353535', '#FD8D00') }));
    mount('/t/qa-a');
    await waitFor(() => expect(screen.getByText('ready:qa-a')).toBeInTheDocument());
    expect(primary()).toBe('');
  });
});
