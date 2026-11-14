import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrivateWorkspaceBrand } from '@/components/brand/PrivateWorkspaceBrand';
import { tenantHostFixture } from '@/test/fixtures/tenantHost';
import { publishTenantHostRuntime, TenantHostNotPublishedError } from '@/utils/tenantHostBinding';
import { TenantProvider, useTenant } from './TenantContext';

// Keep the canonical shared setup; restore the real router for this Provider journey.
vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));
const mocks = vi.hoisted(() => ({ host: vi.fn(), profile: vi.fn(), follows: vi.fn(), anon: vi.fn() }));
vi.mock('@/api/tenantHost', () => ({ getTenantHostBinding: mocks.host }));
vi.mock('@/api/tenant', () => ({
  getTenantPublicInfoFlexible: mocks.profile, listFollowedTenants: mocks.follows,
  followTenant: vi.fn(), unfollowTenant: vi.fn(),
}));
vi.mock('@/utils/anonId', () => ({ ensureRemoteAnonId: mocks.anon }));

const previousTitle = 'Título previo de la plataforma';
const profile = () => ({
  slug: 'government-east', nombre: 'Organización de prueba',
  publishedIdentity: tenantHostFixture().identity,
});
function Probe({ privateWriter = false }: { privateWriter?: boolean }) {
  const value = useTenant();
  return <div data-testid="admitted-children">
    <output>{value.currentSlug}:{value.tenant?.nombre}</output>
    {privateWriter && value.currentSlug && value.tenant?.nombre ?
      <PrivateWorkspaceBrand identity={{ tenantSlug: value.currentSlug, name: value.tenant.nombre, logoUrl: null }} /> : null}
  </div>;
}
function setHostname(hostname: string, pathname = '/') {
  const original = window;
  vi.stubGlobal('window', new Proxy(original, { get(target, key) {
    return key === 'location' ? { hostname, origin: 'https://' + hostname, pathname, search: '', hash: '' } : Reflect.get(target, key);
  } }));
}
function renderProvider(entry = '/', privateWriter = false, strict = false) {
  const tree = <MemoryRouter initialEntries={[entry]}><TenantProvider><Probe privateWriter={privateWriter} /></TenantProvider></MemoryRouter>;
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  document.title = previousTitle;
  localStorage.clear(); localStorage.setItem('tenantSlug', 'old-workspace');
  mocks.host.mockReset().mockResolvedValue(tenantHostFixture());
  mocks.profile.mockReset().mockResolvedValue(profile());
  mocks.follows.mockReset().mockResolvedValue([]);
  mocks.anon.mockReset().mockResolvedValue('synthetic-anon');
  setHostname('atencion.example.test');
});
afterEach(() => {
  cleanup(); vi.unstubAllGlobals(); publishTenantHostRuntime(null);
  localStorage.clear(); delete (window as any).CHATBOC_CONFIG;
  document.title = '';
});

describe('neutral title during exact-host admission', () => {
  it('uses the same neutral heading while loading, unavailable and retrying, then yields to the real active writer', async () => {
    const first = deferred<ReturnType<typeof tenantHostFixture>>();
    const retry = deferred<ReturnType<typeof tenantHostFixture>>();
    mocks.host.mockReturnValueOnce(first.promise).mockReturnValueOnce(retry.promise);
    const view = renderProvider('/', true);
    expect(screen.getByRole('heading', { name: 'Cargando espacio' })).toBeInTheDocument();
    expect(document.title).toBe('Cargando espacio');
    expect(mocks.profile).not.toHaveBeenCalled();
    await act(async () => first.reject(new Error('synthetic unavailable')));
    expect(await screen.findByRole('heading', { name: 'Este dominio no está disponible' })).toBeInTheDocument();
    expect(document.title).toBe('Este dominio no está disponible');
    expect(screen.queryByTestId('admitted-children')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(screen.getByRole('heading', { name: 'Cargando espacio' })).toBeInTheDocument();
    expect(document.title).toBe('Cargando espacio');
    await act(async () => retry.resolve(tenantHostFixture()));
    await screen.findByTestId('private-workspace-brand');
    expect(document.title).toBe('Organización de prueba · Panel');
    expect(screen.queryByRole('heading', { name: 'Cargando espacio' })).not.toBeInTheDocument();
    expect(mocks.host).toHaveBeenCalledTimes(2);
    view.unmount();
    expect(document.title).toBe(previousTitle);
  });

  it('restores the previous title when an unavailable host boundary unmounts', async () => {
    mocks.host.mockRejectedValue(new Error('synthetic unavailable'));
    const view = renderProvider();
    await screen.findByRole('alert');
    expect(document.title).toBe('Este dominio no está disponible');
    view.unmount();
    expect(document.title).toBe(previousTitle);
  });

  it('does not overwrite a newer title written by another owner during cleanup', async () => {
    mocks.host.mockRejectedValue(new Error('synthetic unavailable'));
    const view = renderProvider();
    await screen.findByRole('alert');
    expect(document.title).toBe('Este dominio no está disponible');
    document.title = 'Título nuevo de otro propietario';
    view.unmount();
    expect(document.title).toBe('Título nuevo de otro propietario');
  });

  it('keeps a mismatched path neutral without naming a retained or foreign organization', async () => {
    renderProvider('/t/old-workspace');
    expect(await screen.findByRole('alert')).toHaveTextContent('no corresponde');
    expect(document.title).toBe('Este dominio no está disponible');
    expect(mocks.profile).not.toHaveBeenCalled();
    expect(screen.queryByTestId('admitted-children')).not.toBeInTheDocument();
  });

  it.each(['/', '/login'])('does not own the shared-platform title at %s', async (entry) => {
    setHostname('www.chatboc.ar', entry);
    mocks.profile.mockResolvedValue({ slug: 'old-workspace', nombre: 'Selección guardada' });
    const view = renderProvider(entry);
    await screen.findByTestId('admitted-children');
    expect(document.title).toBe(previousTitle);
    expect(mocks.host).not.toHaveBeenCalled();
    view.unmount();
    expect(document.title).toBe(previousTitle);
  });

  it('releases only the neutral title when an explicitly unbound deployment alias returns to platform presentation', async () => {
    setHostname('synthetic-unbound.vercel.app');
    const request = deferred<ReturnType<typeof tenantHostFixture>>();
    mocks.host.mockReturnValue(request.promise);
    mocks.profile.mockResolvedValue({ slug: 'old-workspace', nombre: 'Selección guardada' });
    const view = renderProvider();
    expect(document.title).toBe('Cargando espacio');
    await act(async () => request.reject(new TenantHostNotPublishedError()));
    await screen.findByTestId('admitted-children');
    expect(document.title).toBe(previousTitle);
    expect(screen.queryByRole('heading', { name: 'Este dominio no está disponible' })).not.toBeInTheDocument();
    view.unmount();
    expect(document.title).toBe(previousTitle);
  });

  it('cleans up its neutral title under StrictMode without retaining an intermediate heading', async () => {
    mocks.host.mockRejectedValue(new Error('synthetic unavailable'));
    const view = renderProvider('/', false, true);
    await waitFor(() => expect(document.title).toBe('Este dominio no está disponible'));
    expect(screen.getByRole('heading', { name: 'Este dominio no está disponible' })).toBeInTheDocument();
    view.unmount();
    expect(document.title).toBe(previousTitle);
  });
});
