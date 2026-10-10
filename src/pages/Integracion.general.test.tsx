import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Integracion from '@/pages/Integracion';
import { tenantService } from '@/services/tenantService';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';
import type { TenantConfigBundle } from '@/types/TenantConfig';

const session = vi.hoisted(() => ({
  loading: false, hasVerifiedSession: true, organizationProfileVerified: true, refreshUser: vi.fn(),
  user: { id: 42, tenantSlug: 'actor-home', role: 'superadmin', rol: 'superadmin' },
}));
const messages = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));
const tenantContext = vi.hoisted(() => ({ currentSlug: 'selected-government' as string | null,
  tenant: { slug: 'selected-government' }, tenantError: null as string | null, isLoadingTenant: false, refreshTenant: vi.fn() }));
const editorLifecycle = vi.hoisted(() => ({ mount: vi.fn(), unmount: vi.fn() }));
vi.mock('@/hooks/useUser', () => ({ useUser: () => session }));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => tenantContext }));
vi.mock('@/components/admin/ChatCustomizer', () => ({ default: () => {
  React.useEffect(() => { editorLifecycle.mount(); return () => editorLifecycle.unmount(); }, []);
  return <div data-testid="chat-customizer">{tenantContext.currentSlug}</div>;
} }));
vi.mock('@/services/tenantService', () => ({ tenantService: {
  getTenantConfig: vi.fn(), updateTenantConfig: vi.fn(), getIntegrationEmbed: vi.fn(),
  getPublicWidgetConfig: vi.fn(), listWhatsappNumbers: vi.fn(),
} }));
vi.mock('@/components/brand/MetaAppReviewApproval', () => ({ default: () => null }));
vi.mock('@/components/tenant/MenuBuilder', () => ({ default: () => null }));
vi.mock('@/components/tenant/TenantDomainSettings', () => ({ TenantDomainSettings: ({ tenant }: { tenant: { id: number; slug: string } }) => <div data-testid="tenant-domain-scope">{tenant.id}:{tenant.slug}</div> }));
vi.mock('@/pages/pyme/integraciones/IntegracionesPage', () => ({ default: () => null }));
vi.mock('@/components/integrations/WhatsappTechProviderOnboarding', () => ({ default: () => null }));
vi.mock('sonner', () => ({ toast: messages }));

const service = vi.mocked(tenantService);
const config = (slug = 'selected-government', name = 'Organización seleccionada'): TenantConfigBundle => ({
  tenant: { id: 17, slug, nombre: name, tipo: 'municipio', plan: 'full',
    logo_url: 'https://assets.example.invalid/current.svg',
    organization_type_label_contract: 'organization.type_label.v1', organization_type_label: 'Gobierno' },
  configs: { widget: {}, contacts: {}, links: {}, menu: {} },
  whatsapp: { has_number: false },
  organization_profile: { contract_version: 'organization.profile_settings.v1', tenant: { id: 17, slug },
    revision: 'a'.repeat(64), can_edit: true, editability: { mode: 'editable' },
    values: { logo_url: 'https://assets.example.invalid/current.svg' } },
});
const savedConfig = (logo: string, name?: string): TenantConfigBundle => {
  const result = config(undefined, name);
  result.tenant.logo_url = logo;
  result.organization_profile = { ...result.organization_profile!, revision: 'b'.repeat(64), values: { logo_url: logo } };
  return result;
};

let changeRoute: ReturnType<typeof useNavigate>;
function RouteControls() {
  changeRoute = useNavigate();
  return null;
}
function ProfileDestination() {
  const location = useLocation();
  return <output data-testid="profile-destination">{location.pathname}{location.search}</output>;
}
const app = (entry = '/integracion?tenant_slug=selected-government') => (
  <MemoryRouter initialEntries={[entry]}>
    <RouteControls />
    <Routes>
      <Route path="/integracion" element={<Integracion />} />
      <Route path="/t/:tenant/integracion" element={<Integracion />} />
      <Route path="/perfil" element={<ProfileDestination />} />
    </Routes>
  </MemoryRouter>
);
const ready = () => screen.findByRole('textbox', { name: 'Nombre / Razón Social' });
const deferred = () => {
  let resolve!: (value: TenantConfigBundle) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<TenantConfigBundle>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

beforeEach(() => {
  vi.clearAllMocks();
  advanceChatbocSessionRevision();
  session.loading = false; session.hasVerifiedSession = true; session.organizationProfileVerified = true;
  session.user = { id: 42, tenantSlug: 'actor-home', role: 'superadmin', rol: 'superadmin' };
  tenantContext.currentSlug = 'selected-government'; tenantContext.isLoadingTenant = false;
  tenantContext.tenant = { slug: 'selected-government' }; tenantContext.tenantError = null;
  tenantContext.refreshTenant.mockResolvedValue(undefined);
  service.getTenantConfig.mockResolvedValue(config());
  service.getIntegrationEmbed.mockResolvedValue({ widget: { embed_snippet: '' } });
  service.getPublicWidgetConfig.mockResolvedValue({ widget: { builder_config: {} } });
  service.listWhatsappNumbers.mockResolvedValue({ numbers: [] });
  service.updateTenantConfig.mockResolvedValue(config());
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe('Integracion institutional data and explicit visual drafts', () => {
  it.each(['/integracion?tenant_slug=selected-government', '/t/selected-government/integracion'])
    ('opens the versioned profile of the verified selected organization at %s, without a PUT', async entry => {
      render(app(entry));
      const name = await ready();
      expect(screen.getByTestId('tenant-domain-scope')).toHaveTextContent('17:selected-government');
      expect(name).toHaveAttribute('readonly');
      fireEvent.keyDown(name, { key: 'N' });
      expect(name).toHaveValue('Organización seleccionada');
      fireEvent.click(screen.getByRole('button', { name: 'Editar datos institucionales' }));
      expect(screen.getByTestId('profile-destination')).toHaveTextContent('/perfil?section=general&tenant_slug=selected-government');
      expect(service.updateTenantConfig).not.toHaveBeenCalled();
      expect(session.user.tenantSlug).toBe('actor-home');
    });

  it('keeps partial logo URLs local until one explicit versioned save, with no copied identity fields', async () => {
    const pending = deferred(); service.updateTenantConfig.mockReturnValue(pending.promise);
    render(app()); await ready();
    const logoInput = screen.getByRole('textbox', { name: 'Logo institucional (URL)' });
    const nextLogo = 'https://assets.example.invalid/updated.svg';
    for (let length = 0; length <= nextLogo.length; length++) {
      fireEvent.change(logoInput, { target: { value: nextLogo.slice(0, length) } });
      expect(service.updateTenantConfig).not.toHaveBeenCalled();
    }
    expect(service.updateTenantConfig).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar logo' }));
    expect(service.updateTenantConfig).toHaveBeenCalledExactlyOnceWith('selected-government', {
      expected_revision: 'a'.repeat(64), organization_profile: { logo_url: 'https://assets.example.invalid/updated.svg' },
    }, { isCurrent: expect.any(Function) });
    expect(logoInput).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Guardando logo...' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Guardando logo...' }));
    expect(service.updateTenantConfig).toHaveBeenCalledOnce();
    await act(async () => pending.resolve(savedConfig('https://assets.example.invalid/updated.svg')));
    expect(messages.success).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Guardar logo' })).toBeDisabled();
  });

  it('does not resend a stale institutional name when saving one visual field', async () => {
    service.updateTenantConfig.mockImplementation(async (_slug, payload) => {
      if ('nombre' in (payload.organization_profile || {}) || 'tenant' in payload) throw new Error('organization_name_requires_profile_update');
      return savedConfig(payload.organization_profile!.logo_url, 'Nombre actualizado en el perfil');
    });
    render(app()); await ready();
    fireEvent.change(screen.getByRole('textbox', { name: 'Logo institucional (URL)' }), { target: { value: 'https://assets.example.invalid/new.svg' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar logo' }));
    await waitFor(() => expect(messages.success).toHaveBeenCalledOnce());
    expect(service.updateTenantConfig).toHaveBeenCalledExactlyOnceWith('selected-government', {
      expected_revision: 'a'.repeat(64), organization_profile: { logo_url: 'https://assets.example.invalid/new.svg' },
    }, { isCurrent: expect.any(Function) });
    expect(screen.getByRole('textbox', { name: 'Nombre / Razón Social' })).toHaveValue('Nombre actualizado en el perfil');
  });

  it('discards the visual draft without a request', async () => {
    render(app()); await ready();
    fireEvent.change(screen.getByRole('textbox', { name: 'Logo institucional (URL)' }), { target: { value: 'https://assets.example.invalid/new.svg' } });
    fireEvent.click(screen.getByRole('button', { name: 'Descartar cambios' }));
    expect(screen.getByRole('textbox', { name: 'Logo institucional (URL)' })).toHaveValue('https://assets.example.invalid/current.svg');
    expect(screen.getByRole('button', { name: 'Guardar logo' })).toBeDisabled();
    expect(service.updateTenantConfig).not.toHaveBeenCalled();
  });

  it.each(['missing', 'read_only', 'can_edit_false', 'contract', 'foreign_slug', 'invalid_id', 'different_id', 'invalid_revision', 'inactive'])
    ('keeps the logo readonly and the profile consultable for an uneditable %s descriptor', async cause => {
      const received = config();
      if (cause === 'missing') received.organization_profile = null;
      if (cause === 'read_only') received.organization_profile!.editability.mode = 'read_only';
      if (cause === 'can_edit_false') received.organization_profile!.can_edit = false;
      if (cause === 'contract') received.organization_profile!.contract_version = 'legacy';
      if (cause === 'foreign_slug') received.organization_profile!.tenant.slug = 'other-organization';
      if (cause === 'invalid_id') received.organization_profile!.tenant.id = 0;
      if (cause === 'different_id') received.organization_profile!.tenant.id = 99;
      if (cause === 'invalid_revision') received.organization_profile!.revision = 'unversioned';
      if (cause === 'inactive') received.organization_profile = null; // The real GET omits this descriptor for inactive tenants.
      service.getTenantConfig.mockResolvedValue(received);
      render(app()); await ready();
      const logo = screen.getByRole('textbox', { name: 'Logo institucional (URL)' });
      expect(logo).toBeDisabled();
      fireEvent.keyDown(logo, { key: 'N' });
      expect(logo).toHaveValue('https://assets.example.invalid/current.svg');
      fireEvent.click(screen.getByRole('button', { name: 'Guardar logo' }));
      expect(service.updateTenantConfig).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Consultar datos institucionales' }));
      expect(screen.getByTestId('profile-destination')).toHaveTextContent('/perfil?section=general&tenant_slug=selected-government');
    });

  it('reads the versioned owner logo when the legacy tenant logo is null and saves its trimmed replacement', async () => {
    const received = config(); received.tenant.logo_url = null;
    service.getTenantConfig.mockResolvedValue(received);
    service.updateTenantConfig.mockResolvedValue(savedConfig('https://assets.example.invalid/canonical.svg'));
    render(app()); await ready();
    expect(screen.getByRole('textbox', { name: 'Logo institucional (URL)' })).toHaveValue(received.organization_profile!.values.logo_url);
    fireEvent.change(screen.getByRole('textbox', { name: 'Logo institucional (URL)' }), { target: { value: '  https://assets.example.invalid/canonical.svg  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar logo' }));
    await waitFor(() => expect(messages.success).toHaveBeenCalledOnce());
    expect(service.updateTenantConfig.mock.calls[0][1]).toEqual({ expected_revision: 'a'.repeat(64),
      organization_profile: { logo_url: 'https://assets.example.invalid/canonical.svg' } });
    expect(screen.getByRole('textbox', { name: 'Logo institucional (URL)' })).toHaveValue('https://assets.example.invalid/canonical.svg');
  });

  it('requires an explicit save or discard before leaving a logo draft for the institutional profile', async () => {
    render(app()); await ready();
    fireEvent.change(screen.getByRole('textbox', { name: 'Logo institucional (URL)' }), { target: { value: 'https://assets.example.invalid/draft.svg' } });
    const profileLink = screen.getByRole('button', { name: 'Editar datos institucionales' });
    expect(profileLink).toBeDisabled(); fireEvent.click(profileLink);
    expect(screen.queryByTestId('profile-destination')).not.toBeInTheDocument();
    expect(service.updateTenantConfig).not.toHaveBeenCalled();
    expect(screen.getByText('Guardá o descartá el logo pendiente antes de abrir el perfil.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Descartar cambios' }));
    expect(profileLink).toBeEnabled(); fireEvent.click(profileLink);
    expect(screen.getByTestId('profile-destination')).toHaveTextContent('/perfil?section=general&tenant_slug=selected-government');
    expect(service.updateTenantConfig).not.toHaveBeenCalled();
  });

  it('keeps the logo draft during a current-scope refresh and saves against the new revision', async () => {
    render(app()); await ready();
    fireEvent.change(screen.getByRole('textbox', { name: 'Logo institucional (URL)' }), { target: { value: 'https://assets.example.invalid/draft.svg' } });
    const latest = config(undefined, 'Perfil actualizado'); latest.organization_profile!.revision = 'c'.repeat(64);
    service.getTenantConfig.mockResolvedValue(latest);
    service.updateTenantConfig.mockResolvedValue(savedConfig('https://assets.example.invalid/draft.svg'));
    fireEvent.click(screen.getByRole('button', { name: 'Recargar' }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Nombre / Razón Social' })).toHaveValue('Perfil actualizado'));
    expect(screen.getByRole('textbox', { name: 'Logo institucional (URL)' })).toHaveValue('https://assets.example.invalid/draft.svg');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar logo' }));
    await waitFor(() => expect(messages.success).toHaveBeenCalledOnce());
    expect(service.updateTenantConfig.mock.calls[0][1]).toEqual({ expected_revision: 'c'.repeat(64),
      organization_profile: { logo_url: 'https://assets.example.invalid/draft.svg' } });
  });

  it('opens the existing chat editor only for the exact public and private scope, with no legacy color save', async () => {
    render(app()); await ready();
    expect(screen.queryByRole('textbox', { name: 'Color Primario' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Apariencia del chat' }));
    expect(await screen.findByTestId('chat-customizer')).toHaveTextContent('selected-government');
    expect(editorLifecycle.mount).toHaveBeenCalledOnce();
    expect(service.updateTenantConfig).not.toHaveBeenCalled();
  });

  it.each(['null_slug', 'foreign_slug', 'loading', 'bootstrap_error', 'default_public_tenant'])
    ('does not mount a chat editor with %s bootstrap context and only retries verification', async cause => {
      if (cause === 'null_slug') tenantContext.currentSlug = null;
      if (cause === 'foreign_slug') tenantContext.currentSlug = 'actor-home';
      if (cause === 'loading') tenantContext.isLoadingTenant = true;
      if (cause === 'bootstrap_error') tenantContext.tenantError = 'No se pudo cargar';
      if (cause === 'default_public_tenant') tenantContext.tenant.slug = 'default';
      render(app()); await ready();
      fireEvent.click(screen.getByRole('button', { name: 'Apariencia del chat' }));
      expect(await screen.findByText('Verificando la organización del chat')).toBeInTheDocument();
      expect(screen.queryByTestId('chat-customizer')).not.toBeInTheDocument();
      expect(editorLifecycle.mount).not.toHaveBeenCalled();
      const retry = screen.getByRole('button', { name: 'Reintentar' });
      if (cause === 'loading') expect(retry).toBeDisabled();
      else { fireEvent.click(retry); expect(tenantContext.refreshTenant).toHaveBeenCalledOnce(); }
      expect(service.updateTenantConfig).not.toHaveBeenCalled();
    });

  it('retires the chat editor across a same-actor session generation and blocks the old tenant context', async () => {
    render(app()); await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Apariencia del chat' }));
    await screen.findByTestId('chat-customizer');
    act(() => advanceChatbocSessionRevision());
    await screen.findByTestId('chat-customizer');
    expect(editorLifecycle.unmount).toHaveBeenCalledOnce();
    expect(editorLifecycle.mount).toHaveBeenCalledTimes(2);
    service.getTenantConfig.mockResolvedValue(config('other-organization', 'Nueva organización'));
    act(() => changeRoute('/integracion?channel=widget&tenant_slug=other-organization'));
    await screen.findByText('Verificando la organización del chat');
    expect(screen.queryByTestId('chat-customizer')).not.toBeInTheDocument();
    expect(editorLifecycle.unmount).toHaveBeenCalledTimes(2);
    expect(editorLifecycle.mount).toHaveBeenCalledTimes(2);
    expect(service.updateTenantConfig).not.toHaveBeenCalled();
  });

  it.each(['tenant_slug=selected-government&tenant=other-organization', 'tenant_slug=&tenant=selected-government', 'tenant_slug=municipio'])
    ('rejects ambiguous or invalid explicit scope %s before loading or saving', async query => {
      render(app(`/integracion?${query}`));
      await screen.findByText('No pudimos validar la organización');
      expect(service.getTenantConfig).not.toHaveBeenCalled();
      expect(service.updateTenantConfig).not.toHaveBeenCalled();
    });

  it.each(['rejected', 'revision_conflict', 'foreign', 'foreign_id', 'not_applied', 'profile_not_applied'])('preserves the draft and avoids a success claim after %s receipt', async kind => {
    if (kind === 'rejected') service.updateTenantConfig.mockRejectedValue(new Error('save_rejected'));
    else if (kind === 'revision_conflict') service.updateTenantConfig.mockRejectedValue(Object.assign(new Error('profile_revision_conflict'), { status: 412 }));
    else if (kind === 'foreign') service.updateTenantConfig.mockResolvedValue(config('other-organization', 'Datos ajenos'));
    else if (kind === 'foreign_id') service.updateTenantConfig.mockResolvedValue({ ...savedConfig('https://assets.example.invalid/draft.svg'),
      tenant: { ...savedConfig('https://assets.example.invalid/draft.svg').tenant, id: 99 } });
    else if (kind === 'profile_not_applied') service.updateTenantConfig.mockResolvedValue({ ...config(), tenant: { ...config().tenant, logo_url: 'https://assets.example.invalid/draft.svg' } });
    else service.updateTenantConfig.mockResolvedValue(config());
    render(app()); await ready();
    fireEvent.change(screen.getByRole('textbox', { name: 'Logo institucional (URL)' }), { target: { value: 'https://assets.example.invalid/draft.svg' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar logo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Conservamos tus cambios');
    expect(screen.getByRole('textbox', { name: 'Logo institucional (URL)' })).toHaveValue('https://assets.example.invalid/draft.svg');
    expect(screen.getByRole('textbox', { name: 'Nombre / Razón Social' })).toHaveValue('Organización seleccionada');
    expect(screen.getByRole('button', { name: 'Guardar logo' })).toBeEnabled();
    expect(messages.success).not.toHaveBeenCalled();
    expect(service.updateTenantConfig).toHaveBeenCalledOnce();
    expect(screen.queryByDisplayValue('Datos ajenos')).not.toBeInTheDocument();
  });

  it.each([
    ['municipio', 'organization.type_label.v1', 'Gobierno', 'Gobierno'],
    ['colegio', 'organization.type_label.v1', 'Educación', 'Educación'],
    ['pyme', 'organization.type_label.v1', 'Empresa', 'Empresa'],
    ['unknown', 'organization.type_label.v1', null, 'Organización'],
    ['unknown', 'organization.type_label.v1', 'Educación', 'Educación'],
    ['unknown', 'organization.type_label.v2', 'Empresa', 'Organización'],
  ])('presents sector metadata without changing technical type %s/%s/%s', async (tipo, contract, label, expected) => {
    const received = config();
    Object.assign(received.tenant, { tipo, organization_type_label_contract: contract, organization_type_label: label });
    service.getTenantConfig.mockResolvedValue(received);
    render(app()); await ready();
    expect(screen.getByRole('textbox', { name: 'Sector' })).toHaveValue(expected);
    expect(received.tenant.tipo).toBe(tipo);
    expect(service.updateTenantConfig).not.toHaveBeenCalled();
  });

  it.each(['unverified_session', 'unverified_profile', 'conflicting_route', 'foreign_config'])
    ('does not expose a data editor or visual write for %s', async cause => {
      if (cause === 'unverified_session') session.hasVerifiedSession = false;
      if (cause === 'unverified_profile') session.organizationProfileVerified = false;
      if (cause === 'foreign_config') service.getTenantConfig.mockResolvedValue(config('foreign'));
      render(app(cause === 'conflicting_route'
        ? '/t/selected-government/integracion?tenant_slug=other' : undefined));
      await screen.findByRole('button', { name: 'Reintentar' });
      expect(screen.queryByRole('button', { name: 'Editar datos institucionales' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Guardar logo' })).not.toBeInTheDocument();
      expect(service.updateTenantConfig).not.toHaveBeenCalled();
      if (cause !== 'foreign_config') expect(service.getTenantConfig).not.toHaveBeenCalled();
  });

  it.each(['tenant', 'actor', 'session_generation'])
    ('retires a draft and ignores the previous save response after a %s change', async cause => {
      const pending = deferred(); service.updateTenantConfig.mockReturnValueOnce(pending.promise);
      const view = render(app()); await ready();
      fireEvent.change(screen.getByRole('textbox', { name: 'Logo institucional (URL)' }), { target: { value: 'https://assets.example.invalid/retired.svg' } });
      fireEvent.click(screen.getByRole('button', { name: 'Guardar logo' }));
      const nextSlug = cause === 'tenant' ? 'other-organization' : 'selected-government';
      service.getTenantConfig.mockResolvedValue(config(nextSlug, 'Nueva lectura verificada'));
      if (cause === 'tenant') act(() => changeRoute('/integracion?tenant_slug=other-organization'));
      if (cause === 'actor') { session.user = { ...session.user, id: 43 }; view.rerender(app()); }
      if (cause === 'session_generation') act(() => advanceChatbocSessionRevision());
      await waitFor(() => expect(screen.getByRole('textbox', { name: 'Nombre / Razón Social' })).toHaveValue('Nueva lectura verificada'));
      expect(screen.getByRole('textbox', { name: 'Logo institucional (URL)' })).toHaveValue('https://assets.example.invalid/current.svg');
      await act(async () => pending.resolve({ ...config(), tenant: { ...config().tenant,
        nombre: 'Respuesta retirada', logo_url: 'https://assets.example.invalid/retired.svg' } }));
      expect(screen.getByRole('textbox', { name: 'Nombre / Razón Social' })).toHaveValue('Nueva lectura verificada');
      expect(messages.success).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Guardar logo' })).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name: 'Editar datos institucionales' }));
      expect(screen.getByTestId('profile-destination')).toHaveTextContent(`/perfil?section=general&tenant_slug=${nextSlug}`);
      expect(service.updateTenantConfig).toHaveBeenCalledOnce();
    });

  it.each(['resolved', 'rejected'])('retires a %s institutional save on unmount without late notifications', async outcome => {
    const pending = deferred(); service.updateTenantConfig.mockReturnValueOnce(pending.promise);
    const view = render(app()); await ready();
    fireEvent.change(screen.getByRole('textbox', { name: 'Logo institucional (URL)' }), { target: { value: 'https://assets.example.invalid/retired.svg' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar logo' }));
    const lifecycle = service.updateTenantConfig.mock.calls[0][2]!;
    expect(lifecycle.isCurrent?.()).toBe(true);
    view.unmount();
    expect(lifecycle.isCurrent?.()).toBe(false);
    await act(async () => {
      if (outcome === 'resolved') pending.resolve(savedConfig('https://assets.example.invalid/retired.svg'));
      else pending.reject(new Error('Retired save'));
      await pending.promise.catch(() => undefined);
    });
    expect(service.getTenantConfig).toHaveBeenCalledOnce();
    expect(service.updateTenantConfig).toHaveBeenCalledOnce();
    expect(messages.success).not.toHaveBeenCalled(); expect(messages.error).not.toHaveBeenCalled();
  });

  it('keeps a StrictMode replay editable with the current lifecycle', async () => {
    service.updateTenantConfig.mockResolvedValue(savedConfig('https://assets.example.invalid/strict.svg'));
    render(<React.StrictMode>{app()}</React.StrictMode>); await ready();
    fireEvent.change(screen.getByRole('textbox', { name: 'Logo institucional (URL)' }), { target: { value: 'https://assets.example.invalid/strict.svg' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar logo' }));
    await waitFor(() => expect(messages.success).toHaveBeenCalledOnce());
    expect(service.updateTenantConfig).toHaveBeenCalledOnce();
  });
});
