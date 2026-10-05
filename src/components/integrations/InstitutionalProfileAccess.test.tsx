import React, { Suspense } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InstitutionalProfileAccess from './InstitutionalProfileAccess';
import { tenantService } from '@/services/tenantService';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';
import type { TenantConfigBundle } from '@/types/TenantConfig';
import routes from '@/routesConfig';
import IntegracionesPage from '@/pages/pyme/integraciones/IntegracionesPage';

const session = vi.hoisted(() => ({ loading: false, hasVerifiedSession: true, organizationProfileVerified: true,
  user: { id: 42, tenantSlug: 'junin', role: 'superadmin' } as { id: number; tenantSlug: string; role: string } | null }));
const tenant = vi.hoisted(() => ({ currentSlug: 'tierra-del-fuego' as string | null,
  tenant: { slug: 'tierra-del-fuego' }, isLoadingTenant: false, tenantError: null as string | null }));
const api = vi.hoisted(() => ({ adminGetIntegrations: vi.fn(), adminGetNotificationSettings: vi.fn(),
  adminGetCatalog: vi.fn(), adminGetMercadoPagoCredentials: vi.fn(), get: vi.fn(),
  put: vi.fn(), post: vi.fn(), adminConnectIntegration: vi.fn() }));
vi.unmock('react-router-dom');
vi.mock('@/hooks/useUser', () => ({ useUser: () => session }));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => tenant }));
vi.mock('@/services/tenantService', () => ({ tenantService: { getTenantConfig: vi.fn(), updateTenantConfig: vi.fn() } }));
vi.mock('@/api/client', () => ({ apiClient: api }));
vi.mock('@/components/admin/ChatCustomizer', () => ({ default: () => {
  const [draft, setDraft] = React.useState('');
  return <label>Borrador del chat<input value={draft} onChange={event => setDraft(event.target.value)} /></label>;
} }));
vi.mock('@/components/admin/OrderDispatchSettings', () => ({ default: () => null }));
vi.mock('@/components/integrations/WhatsappTechProviderOnboarding', () => ({ default: () => null }));
vi.mock('@/components/integrations/ChannelPreview', () => ({ default: () => null }));
vi.mock('@/components/admin/catalog/CatalogUploadWizard', () => ({ default: () => null }));
vi.mock('@/components/admin/catalog/CatalogSpreadsheetEditor', () => ({ default: () => null }));
vi.mock('@/pages/pyme/integraciones/IntegrationPreviewDialog', () => ({ default: () => null }));

const service = vi.mocked(tenantService);
const bundle = (slug = 'tierra-del-fuego', name = 'Organización elegida'): TenantConfigBundle => ({
  tenant: { id: 46, slug, nombre: name, tipo: 'municipio', plan: 'full' },
  configs: { widget: {}, menu: {}, links: {}, contacts: {} },
  organization_profile: { contract_version: 'organization.profile_settings.v1', tenant: { id: 46, slug },
    revision: 'a'.repeat(64), can_edit: true, editability: { mode: 'editable', message: 'Permiso confirmado para esta organización.' },
    values: { logo_url: '' } },
});
const deferred = () => {
  let resolve!: (value: TenantConfigBundle) => void;
  let reject!: (value: unknown) => void;
  const promise = new Promise<TenantConfigBundle>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
let navigate: ReturnType<typeof useNavigate>;
const RouteControls = () => { navigate = useNavigate(); return null; };
const fixture = (entry = '/t/tierra-del-fuego/integracion') => <MemoryRouter initialEntries={[entry]}>
  <RouteControls />
  <Routes>
    <Route path="/t/:tenant/integracion" element={<InstitutionalProfileAccess />} />
    <Route path="/integracion" element={<InstitutionalProfileAccess />} />
  </Routes>
</MemoryRouter>;
const noWrites = () => {
  expect(service.updateTenantConfig).not.toHaveBeenCalled();
  expect(api.put).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
  expect(api.adminConnectIntegration).not.toHaveBeenCalled();
};

beforeEach(() => {
  vi.clearAllMocks();
  advanceChatbocSessionRevision();
  session.loading = false; session.hasVerifiedSession = true; session.organizationProfileVerified = true;
  session.user = { id: 42, tenantSlug: 'junin', role: 'superadmin' };
  tenant.currentSlug = 'tierra-del-fuego'; tenant.tenant = { slug: 'tierra-del-fuego' };
  tenant.isLoadingTenant = false; tenant.tenantError = null;
  service.getTenantConfig.mockResolvedValue(bundle());
  api.adminGetIntegrations.mockResolvedValue([]);
  api.adminGetNotificationSettings.mockResolvedValue({});
  api.adminGetCatalog.mockResolvedValue({});
  api.adminGetMercadoPagoCredentials.mockResolvedValue({});
  api.get.mockResolvedValue({});
});
afterEach(() => { vi.restoreAllMocks(); });

describe('read-only institutional profile access', () => {
  it('uses the selected organization instead of the actor home, with explicit safe new-tab navigation', async () => {
    render(fixture());
    const link = await screen.findByRole('link', { name: 'Perfil institucional' });
    expect(link).toHaveAttribute('href', '/perfil?section=general&tenant_slug=tierra-del-fuego');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAccessibleDescription(/nueva pestaña.*borradores/i);
    expect(link).toHaveClass('min-h-11');
    expect(screen.getByText('Organización elegida')).toBeInTheDocument();
    expect(service.getTenantConfig).toHaveBeenCalledWith('tierra-del-fuego', { isCurrent: expect.any(Function) });
    fireEvent.click(link);
    noWrites();
  });

  it('allows authorized consultation without granting editing rights', async () => {
    const data = bundle();
    data.organization_profile!.can_edit = false;
    data.organization_profile!.editability = { mode: 'read_only', message: 'Sólo consulta autorizada.' };
    service.getTenantConfig.mockResolvedValue(data);
    render(fixture());
    expect(await screen.findByRole('link', { name: 'Perfil institucional' })).toBeInTheDocument();
    expect(screen.getByText('Sólo consulta autorizada.')).toBeInTheDocument();
    noWrites();
  });

  it.each([
    '/t/tierra-del-fuego/integracion?tenant_slug=junin',
    '/integracion?tenant_slug=tierra-del-fuego&tenant=junin',
    '/integracion?tenant_slug=tierra-del-fuego&tenant_slug=junin',
    '/integracion?tenant=tierra-del-fuego&tenant=junin',
    '/integracion?tenant_slug=&tenant=tierra-del-fuego',
    '/t/tierra%2Fdel-fuego/integracion',
    '/integracion?tenant_slug=tierra.del.fuego',
  ])('rejects ambiguous or transformed identity before the new private request: %s', entry => {
    render(fixture(entry));
    expect(screen.queryByRole('link', { name: 'Perfil institucional' })).not.toBeInTheDocument();
    expect(service.getTenantConfig).not.toHaveBeenCalled();
    noWrites();
  });

  it('accepts repeated aliases only when their exact identity agrees', async () => {
    render(fixture('/t/tierra-del-fuego/integracion?tenant=tierra-del-fuego&tenant_slug=tierra-del-fuego&tenant=tierra-del-fuego'));
    expect(await screen.findByRole('link', { name: 'Perfil institucional' })).toHaveAttribute('href', '/perfil?section=general&tenant_slug=tierra-del-fuego');
  });

  it.each(['organismo_norte', 'organismo__norte_'])('keeps the complete valid underscore identity in the read and destination: %s', slug => {
    tenant.currentSlug = slug; tenant.tenant = { slug };
    service.getTenantConfig.mockResolvedValue(bundle(slug));
    render(fixture(`/t/${slug}/integracion?tenant_slug=${slug}`));
    return waitFor(() => {
      expect(screen.getByRole('link', { name: 'Perfil institucional' })).toHaveAttribute('href', `/perfil?section=general&tenant_slug=${slug}`);
      expect(service.getTenantConfig).toHaveBeenCalledWith(slug, { isCurrent: expect.any(Function) });
    });
  });

  it('does not treat an underscore organization as a similarly named hyphen organization', () => {
    tenant.currentSlug = 'organismo_norte'; tenant.tenant = { slug: 'organismo_norte' };
    render(fixture('/t/organismo_norte/integracion?tenant_slug=organismo-norte'));
    expect(service.getTenantConfig).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: 'Perfil institucional' })).not.toBeInTheDocument();
  });

  it.each(['session', 'organization-profile', 'loading-user', 'loading-tenant', 'tenant-error', 'foreign-public-tenant', 'foreign-current-tenant', 'missing-target'])
    ('does not request the new profile until authority is coherent: %s', reason => {
      if (reason === 'session') session.hasVerifiedSession = false;
      if (reason === 'organization-profile') session.organizationProfileVerified = false;
      if (reason === 'loading-user') session.loading = true;
      if (reason === 'loading-tenant') tenant.isLoadingTenant = true;
      if (reason === 'tenant-error') tenant.tenantError = 'No disponible';
      if (reason === 'foreign-public-tenant') tenant.tenant = { slug: 'junin' };
      if (reason === 'foreign-current-tenant') tenant.currentSlug = 'junin';
      if (reason === 'missing-target') tenant.currentSlug = null;
      render(fixture(reason === 'missing-target' ? '/integracion' : undefined));
      expect(service.getTenantConfig).not.toHaveBeenCalled();
      expect(screen.queryByRole('link', { name: 'Perfil institucional' })).not.toBeInTheDocument();
    });

  it.each(['slug', 'outer-slug', 'id', 'invalid-id', 'unsafe-id', 'contract', 'revision', 'editability', 'missing-descriptor'])
    ('rejects mismatched or incomplete private authority: %s', field => {
      const data = bundle();
      if (field === 'slug') data.organization_profile!.tenant.slug = 'junin';
      if (field === 'outer-slug') data.tenant.slug = 'junin';
      if (field === 'id') data.tenant.id = 47;
      if (field === 'invalid-id') data.tenant.id = data.organization_profile!.tenant.id = 0;
      if (field === 'unsafe-id') data.tenant.id = data.organization_profile!.tenant.id = Number.MAX_SAFE_INTEGER + 1;
      if (field === 'contract') data.organization_profile!.contract_version = 'unknown';
      if (field === 'revision') data.organization_profile!.revision = 'not-a-revision';
      if (field === 'editability') data.organization_profile!.editability.mode = 'read_only';
      if (field === 'missing-descriptor') data.organization_profile = null;
      service.getTenantConfig.mockResolvedValue(data);
      render(fixture());
      return waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('No pudimos verificar');
        expect(screen.queryByRole('link', { name: 'Perfil institucional' })).not.toBeInTheDocument();
      });
    });

  it('keeps a server denial unavailable and only retries the read after an explicit action', async () => {
    session.user = { id: 7, tenantSlug: 'junin', role: 'tenant_admin' };
    service.getTenantConfig.mockRejectedValueOnce(new Error('403'));
    render(fixture());
    await screen.findByRole('button', { name: 'Reintentar' });
    expect(screen.queryByRole('link', { name: 'Perfil institucional' })).not.toBeInTheDocument();
    expect(service.getTenantConfig).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('link', { name: 'Perfil institucional' })).toBeInTheDocument();
    expect(service.getTenantConfig).toHaveBeenCalledTimes(2);
    noWrites();
  });

  it.each(['actor', 'generation', 'withdraw', 'unmount'])('retires a deferred read immediately after %s', async reason => {
    const pending = deferred();
    service.getTenantConfig.mockReturnValueOnce(pending.promise);
    const view = render(fixture());
    const firstGuard = service.getTenantConfig.mock.calls[0][1]!.isCurrent!;
    expect(firstGuard()).toBe(true);
    if (reason === 'actor') session.user = { id: 99, tenantSlug: 'junin', role: 'superadmin' };
    if (reason === 'withdraw') session.hasVerifiedSession = false;
    if (reason === 'generation') await act(async () => { advanceChatbocSessionRevision(); });
    if (reason === 'unmount') view.unmount();
    else view.rerender(fixture());
    expect(firstGuard()).toBe(false);
    await act(async () => { pending.resolve(bundle(undefined, 'Nombre de una lectura retirada')); });
    expect(screen.queryByText('Nombre de una lectura retirada')).not.toBeInTheDocument();
    noWrites();
  });

  it('does not revive authority from A after an A→B→A route change', async () => {
    const pendingA = deferred();
    const pendingB = deferred();
    const freshA = deferred();
    service.getTenantConfig.mockReturnValueOnce(pendingA.promise).mockReturnValueOnce(pendingB.promise).mockReturnValueOnce(freshA.promise);
    render(fixture());
    const guardA = service.getTenantConfig.mock.calls[0][1]!.isCurrent!;
    tenant.currentSlug = 'junin'; tenant.tenant = { slug: 'junin' };
    await act(async () => { navigate('/t/junin/integracion'); });
    tenant.currentSlug = 'tierra-del-fuego'; tenant.tenant = { slug: 'tierra-del-fuego' };
    await act(async () => { navigate('/t/tierra-del-fuego/integracion'); });
    expect(guardA()).toBe(false);
    await act(async () => { pendingA.resolve(bundle(undefined, 'Respuesta A vieja')); pendingB.reject(new Error('B viejo')); });
    expect(screen.queryByRole('link', { name: 'Perfil institucional' })).not.toBeInTheDocument();
    await act(async () => { freshA.resolve(bundle(undefined, 'Respuesta A vigente')); });
    expect(await screen.findByText('Respuesta A vigente')).toBeInTheDocument();
  });

  it('withdraws an already rendered link on actor/session change until fresh private authority arrives', async () => {
    const next = deferred();
    const view = render(fixture());
    await screen.findByRole('link', { name: 'Perfil institucional' });
    service.getTenantConfig.mockReturnValueOnce(next.promise);
    session.user = { id: 99, tenantSlug: 'junin', role: 'superadmin' };
    view.rerender(fixture());
    expect(screen.queryByRole('link', { name: 'Perfil institucional' })).not.toBeInTheDocument();
    await act(async () => { next.resolve(bundle()); });
    expect(await screen.findByRole('link', { name: 'Perfil institucional' })).toBeInTheDocument();
  });
});

describe('professional IntegracionesPage using its real route configuration', () => {
  it('keeps the existing editor draft when opening the scoped profile in a new tab', async () => {
    expect(IntegracionesPage).toBeTypeOf('function');
    const route = routes.find(item => item.path === '/t/:tenant/integracion')!;
    expect(route.roles).toEqual(['tenant_admin', 'superadmin']);
    expect(route.requiredAllCapabilities).toEqual(['settings.tenant.write']);
    render(<MemoryRouter initialEntries={['/t/tierra-del-fuego/integracion']}>
      <Suspense fallback={<p>Cargando ruta</p>}><Routes><Route path={route.path} element={route.element} /></Routes></Suspense>
    </MemoryRouter>);
    const link = await screen.findByRole('link', { name: 'Perfil institucional' });
    expect(screen.getByRole('heading', { name: 'Integraciones y canales' })).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Apariencia del Chat' }), { button: 0 });
    fireEvent.click(screen.getByRole('tab', { name: 'Apariencia del Chat' }));
    const draft = await screen.findByRole('textbox', { name: 'Borrador del chat' });
    fireEvent.change(draft, { target: { value: 'Mi borrador sin guardar' } });
    fireEvent.click(link);
    expect(screen.getByRole('textbox', { name: 'Borrador del chat' })).toHaveValue('Mi borrador sin guardar');
    noWrites();
  });
});
