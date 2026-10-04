import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { panelReadOptions } from '@/utils/panelReadOptions';
import { CapabilitiesProvider } from '@/context/CapabilitiesContext';
import AccessRoute from '@/components/access/AccessRoute';

const runtime = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  getTicketStats: vi.fn(),
  getHeatmapDataset: vi.fn(),
  refreshUser: vi.fn(),
  setUser: vi.fn(),
  toast: vi.fn(),
  ticketMounts: 0,
  hasSession: true,
  realNavigation: false,
  user: null as Record<string, any> | null,
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => runtime.realNavigation
      ? actual.useNavigate()
      : vi.fn((path: string) => console.log(`Mocked navigate to: ${path}`)),
  };
});

vi.mock('@/hooks/useUser', () => ({
  useUser: () => ({
    user: runtime.user,
    setUser: runtime.setUser,
    refreshUser: runtime.refreshUser,
    loading: false,
    organizationProfileVerified: true,
  }),
}));

vi.mock('@/utils/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/api')>();
  return { ...actual, apiFetch: runtime.apiFetch };
});

vi.mock('@/utils/sessionLogout', () => ({
  hasAuthenticatedChatbocSession: () => runtime.hasSession,
  logoutChatbocSession: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/components/ui/use-toast', () => ({ toast: runtime.toast }));
vi.mock('@/services/statsService', () => ({
  getTicketStats: runtime.getTicketStats,
  getHeatmapDataset: runtime.getHeatmapDataset,
}));
vi.mock('@/hooks/useMunicipalPosts', () => ({
  useMunicipalPosts: () => ({
    posts: [],
    isLoading: false,
    error: null,
    filters: {},
    meta: { totalCount: 0, limit: 10, offset: 0, hasMore: false },
    setFilters: vi.fn().mockResolvedValue(undefined),
    loadMore: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@/services/catalogService', () => ({
  fetchCatalogVectorSyncStatus: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/services/documentIntelligenceService', () => ({
  requestDocumentPreview: vi.fn(),
}));
vi.mock('@/services/profileAvatarService', () => ({
  uploadProfileAvatar: vi.fn(),
}));

vi.mock('@/components/admin/EventForm', () => ({ EventForm: () => null }));
vi.mock('@/components/admin/PromotionForm', () => ({ PromotionForm: () => null }));
vi.mock('@/components/admin/AgendaPasteForm', () => ({ AgendaPasteForm: () => null }));
vi.mock('@/components/ui/MunicipioIcon', () => ({ default: () => <span /> }));
vi.mock('@/components/backoffice/BackofficeCommandCenter', () => ({ default: () => <div /> }));
vi.mock('@/components/profile/ChannelActivationChecklist', () => ({
  default: ({ tenantSlug, initialData }: { tenantSlug?: string | null; initialData?: any }) => (
    <div
      data-testid="mock-channel-activation"
      data-tenant-slug={tenantSlug || ''}
      data-current-plan={initialData?.integration_access?.current_plan || ''}
    />
  ),
}));
vi.mock('@/components/analytics/Heatmap', () => ({ default: () => <div /> }));
vi.mock('@/components/ui/MiniChatWidgetPreview', () => ({ default: () => <div /> }));
vi.mock('@/components/ui/AddressAutocomplete', () => ({ default: () => <div /> }));
vi.mock('@/components/identity/IdentityAvatar', () => ({ default: () => <div /> }));
vi.mock('@/components/LazyMapLibreMap', () => ({ default: () => <div /> }));
vi.mock('@/components/catalog/ImportWizard', () => ({ default: () => <div /> }));

vi.mock('@/pages/TicketsPanel', () => ({
  default: () => {
    runtime.ticketMounts += 1;
    return <div data-testid="mock-tickets" />;
  },
}));
vi.mock('@/pages/EstadisticasPage', () => ({ default: () => <div data-testid="mock-stats" /> }));
vi.mock('@/pages/analytics/AnalyticsPage', () => ({ default: () => <div data-testid="mock-analytics" /> }));
vi.mock('@/pages/UsuariosPage', () => ({
  default: ({ tenantSlugOverride, embedded }: { tenantSlugOverride?: string | null; embedded?: boolean }) => (
    <div data-testid="mock-users" data-tenant-slug={tenantSlugOverride || ''} data-embedded={String(Boolean(embedded))} />
  ),
}));
vi.mock('@/pages/SmartPedidosWrapper', () => ({ default: () => <div /> }));
vi.mock('@/pages/InternalUsers', () => ({ default: () => <div /> }));
vi.mock('@/pages/IncidentsMap', () => ({
  default: ({ tenantSlugOverride }: { tenantSlugOverride?: string | null }) => (
    <div data-testid="mock-map" data-tenant-slug={tenantSlugOverride || ''} />
  ),
}));
vi.mock('@/pages/admin/CatalogManagementPage', () => ({ default: () => <div /> }));

import Perfil from '@/pages/Perfil';
import { ApiError } from '@/utils/api';

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('scrollTo', vi.fn());
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

const verifiedUser = (tenantSlug = 'junin') => ({
  id: 22,
  email: 'mauricio@junin.com',
  name: 'Mauricio',
  nombre_empresa: 'Municipalidad de Junín',
  rol: 'admin',
  tipo_chat: 'municipio',
  rubro: 'municipio',
  plan: 'pro',
  tenantSlug,
  tenant_slug: tenantSlug,
  tenant: { slug: tenantSlug, tenant_slug: tenantSlug },
  capabilities: ['orders.read'],
});

const profileResponse = (tenantSlug: string) => ({
  id: 22,
  nombre_empresa: tenantSlug === 'junin' ? 'Municipalidad de Junín' : 'Municipalidad de Mendoza',
  telefono: '+541112345678',
  direccion: 'Av. Principal 100',
  ciudad: tenantSlug === 'junin' ? 'Junín' : 'Mendoza',
  provincia: 'Buenos Aires',
  pais: 'Argentina',
  latitud: -34.58,
  longitud: -60.95,
  link_web: 'https://example.test',
  plan: 'pro',
  preguntas_usadas: 2,
  limite_preguntas: 100,
  rubro: 'municipio',
  logo_url: '',
  avatar_url: '',
  avatar_consent: false,
  tenant_slug: tenantSlug,
  slug: tenantSlug,
  horario_json: [],
});

const organizationProfileResponse = (tenantSlug = 'selected-organization', canEdit = true) => ({
  contract_version: 'organization.profile_settings.v1',
  tenant: { id: 909, slug: tenantSlug },
  revision: 'a'.repeat(64),
  can_edit: canEdit,
  editability: { mode: canEdit ? 'editable' : 'read_only' },
  values: {
    nombre_empresa: 'Organización seleccionada', telefono: '+542900123456',
    direccion: 'Domicilio de la organización', ciudad: 'Ciudad seleccionada',
    provincia: 'Tierra del Fuego', pais: 'Argentina', latitud: null, longitud: null,
    link_web: 'https://organization.example.test', logo_url: '', horario_json: [],
  },
});

const wireSelectedOrganization = (loadProfile: () => any, saveProfile?: (body: any) => any) => {
  runtime.user = { ...verifiedUser('junin'), rol: 'superadmin', nombre_empresa: 'Mi cuenta personal' };
  runtime.apiFetch.mockImplementation(async (path: string, options?: any) => {
    if (path === '/api/v2/tenants/selected-organization/activation/channels') {
      return {
        contract_version: 'tenant.channel_activation.v1',
        tenant: { id: 909, slug: 'selected-organization', plan: 'full' },
        integration_access: { enabled: true, status: 'enabled', current_plan: 'full' }, channels: [],
      };
    }
    if (path === '/api/admin/tenants/selected-organization/config') {
      if (options?.method === 'PUT') return saveProfile?.(options.body);
      return { tenant: { slug: 'selected-organization', tipo: 'municipio', plan: 'full' }, organization_profile: await loadProfile() };
    }
    if (path === '/api/me') return { ...profileResponse('junin'), nombre_empresa: 'Mi cuenta personal' };
    if (path.startsWith('/api/app/backoffice/navigation')) {
      return { contract_version: 'backoffice.navigation.v1', modules: [] };
    }
    return {};
  });
};

const countApiCalls = (path: string) =>
  runtime.apiFetch.mock.calls.filter(([calledPath]) => calledPath === path).length;

const ProfileHarness = () => {
  const [, forceRender] = useState(0);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          runtime.user = verifiedUser('mendoza');
          forceRender((revision) => revision + 1);
        }}
      >
        Cambiar tenant de prueba
      </button>
      <button
        type="button"
        onClick={() => {
          runtime.user = {
            ...verifiedUser('junin'),
            rol: 'empleado',
          };
          forceRender((revision) => revision + 1);
        }}
      >
        Cambiar rol de prueba
      </button>
      <Perfil />
    </>
  );
};

const renderProfile = (initialEntry = '/perfil') => {
  window.history.replaceState({}, '', initialEntry);
  return render(
    <BrowserRouter>
      <ProfileHarness />
    </BrowserRouter>,
  );
};

const updateBrowserLocation = (nextPath: string) => {
  window.history.pushState({}, '', nextPath);
  window.dispatchEvent(new PopStateEvent('popstate'));
};

describe('Perfil request lifecycle', () => {
  beforeEach(() => {
    localStorage.clear();
    runtime.hasSession = true;
    runtime.realNavigation = false;
    runtime.user = verifiedUser('junin');
    runtime.apiFetch.mockReset();
    runtime.getTicketStats.mockReset().mockResolvedValue({ heatmap: [], heatmapDataset: { points: [] } });
    runtime.getHeatmapDataset.mockReset().mockResolvedValue({ points: [] });
    runtime.refreshUser.mockReset().mockResolvedValue(undefined);
    runtime.setUser.mockReset();
    runtime.toast.mockReset();
    runtime.ticketMounts = 0;
    runtime.apiFetch.mockImplementation(async (path: string, options?: { tenantSlug?: string | null }) => {
      const tenantSlug = options?.tenantSlug || runtime.user?.tenantSlug || 'junin';
      if (path === '/api/me') return profileResponse(tenantSlug);
      if (path.startsWith('/api/app/backoffice/navigation')) {
        return {
          contract_version: 'backoffice.navigation.v1',
          modules: [
            { id: 'operations', label: 'Operar reclamos', route: '/perfil?tab=tickets', enabled: true },
            { id: 'reports', label: 'Reportes claros', route: '/perfil?tab=estadisticas', enabled: true },
            { id: 'surveys', label: 'Encuestas y sondeos', route: '/admin/encuestas', enabled: true },
            { id: 'people', label: 'Personas y accesos', route: '/empleados', enabled: true },
            { id: 'maps', label: 'Mapas de calor', route: '/perfil?tab=estadisticas&view=mapas', enabled: true },
            { id: 'advanced_analytics', label: 'Analítica IA', route: '/analytics?mode=advanced', enabled: true },
          ],
        };
      }
      if (path === '/api/whatsapp/promocionar') return { can_send: true };
      if (path === '/municipal/categorias') return { categorias: [] };
      return {};
    });
  });

  it('never presents the personal company as the platform workspace or an unselected institutional editor', async () => {
    runtime.user = { ...verifiedUser('junin'), rol: 'super_admin', nombre_empresa: 'MyB Store',
      platform_workspace: { contract_version: 'platform.workspace.v1', heading: 'Chatboc · Plataforma',
        organization_label: 'Administración de plataforma', role_label: 'SuperAdmin',
        organization_action: { label: 'Organizaciones', href: '/superadmin?section=organizations' } } };
    runtime.apiFetch.mockImplementation(async (path: string) => path === '/api/me'
      ? { ...profileResponse('junin'), nombre_empresa: 'MyB Store' } : {});
    renderProfile('/perfil?section=general');
    await screen.findByText('Elegí una organización');
    expect(screen.queryByText('MyB Store')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Nombre legal o institucional' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
    expect(runtime.apiFetch.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(false);
    expect(screen.getAllByRole('link', { name: 'Organizaciones' }).every(link => link.getAttribute('href') === '/superadmin?section=organizations')).toBe(true);
  });

  it('saves name, contact and activity only in the verified organization without replaying the write', async () => {
    let profile = { ...organizationProfileResponse(), ui: { activity_label: 'Rubro o actividad', activity_description: 'Descripción institucional' },
      values: { ...organizationProfileResponse().values, actividad: 'Servicios públicos' } };
    wireSelectedOrganization(() => profile, body => {
      profile = { ...profile, revision: 'b'.repeat(64), values: { ...profile.values, ...body.organization_profile } };
      return { contract_version: 'organization.profile_save.v1', ok: true, tenant: profile.tenant, profile };
    });
    renderProfile('/perfil?section=general&tenant_slug=selected-organization');
    const activity = await screen.findByRole('textbox', { name: 'Rubro o actividad' });
    expect(activity).toHaveValue('Servicios públicos');
    fireEvent.change(activity, { target: { value: 'Asistencia y accesibilidad' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre legal o institucional' }), { target: { value: 'Organización actualizada' } });
    fireEvent.change(screen.getByRole('textbox', { name: /Teléfono institucional o de contacto/ }), { target: { value: '+54929015550101' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await screen.findByText('Cambios de la organización guardados correctamente.');
    const writes = runtime.apiFetch.mock.calls.filter(([, options]) => options?.method === 'PUT');
    expect(writes).toHaveLength(1);
    expect(writes[0]).toEqual(['/api/admin/tenants/selected-organization/config', expect.objectContaining({
      tenantSlug: 'selected-organization', singleAttempt: true, allowStartupRecovery: false, isCurrent: expect.any(Function),
      body: { expected_revision: 'a'.repeat(64), organization_profile: { nombre_empresa: 'Organización actualizada',
        telefono: '+54929015550101', actividad: 'Asistencia y accesibilidad' } },
    })]);
    expect(runtime.setUser).not.toHaveBeenCalled();
    expect(runtime.user?.nombre_empresa).toBe('Mi cuenta personal');
  });

  it('uses the scoped organization editor even when SuperAdmin explicitly selects the home organization', async () => {
    wireSelectedOrganization(() => organizationProfileResponse());
    runtime.user = { ...runtime.user, tenantSlug: 'selected-organization', tenant_slug: 'selected-organization' };
    renderProfile('/perfil?section=general&tenant_slug=selected-organization');
    await screen.findByRole('textbox', { name: 'Nombre legal o institucional' });
    expect(countApiCalls('/api/me')).toBe(0);
    expect(countApiCalls('/api/admin/tenants/selected-organization/config')).toBe(1);
    expect(screen.queryByText('Mi cuenta personal')).not.toBeInTheDocument();
  });

  it.each(['tenant_slug=', 'tenant_slug=../otro', 'tenant_slug=selected-organization&tenant=junin'])('never falls back to personal fields for an invalid explicit SuperAdmin selector: %s', async (query) => {
    wireSelectedOrganization(() => organizationProfileResponse());
    renderProfile(`/perfil?section=general&${query}`);
    await screen.findByText('Perfil institucional no habilitado');
    expect(countApiCalls('/api/me')).toBe(0);
    expect(screen.queryByText('Mi cuenta personal')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Nombre legal o institucional' })).not.toBeInTheDocument();
    expect(runtime.apiFetch.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(false);
  });

  it('retires the institutional save readback after leaving the editor', async () => {
    let finishSave!: (value: unknown) => void;
    const profile = organizationProfileResponse();
    wireSelectedOrganization(() => profile, () => new Promise(resolve => { finishSave = resolve; }));
    const view = renderProfile('/perfil?section=general&tenant_slug=selected-organization');
    const name = await screen.findByRole('textbox', { name: 'Nombre legal o institucional' });
    fireEvent.change(name, { target: { value: 'Edición pendiente' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(runtime.apiFetch.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(1));
    view.unmount();
    await act(async () => finishSave({ contract_version: 'organization.profile_save.v1', ok: true, tenant: profile.tenant, profile }));
    expect(runtime.apiFetch.mock.calls.filter(([path, options]) => path.endsWith('/config') && options?.method !== 'PUT')).toHaveLength(1);
  });

  it('resolves the legacy orders link into the guarded orders route with filters and verified organization', async () => {
    window.history.replaceState({}, '', '/perfil?tab=orders&focus=assisted&channel=marketplace&q=consulta');
    render(<BrowserRouter><Routes>
      <Route path="/perfil" element={<ProfileHarness />} />
      <Route path="/pedidos" element={<div>Pedidos verificados</div>} />
      <Route path="/403" element={<div>Acceso denegado</div>} />
    </Routes></BrowserRouter>);
    await screen.findByText('Pedidos verificados');
    expect(window.location.pathname).toBe('/pedidos');
    expect(new URLSearchParams(window.location.search).get('tenant_slug')).toBe('junin');
    expect(new URLSearchParams(window.location.search).get('focus')).toBe('assisted');
    expect(new URLSearchParams(window.location.search).get('channel')).toBe('marketplace');
    expect(new URLSearchParams(window.location.search).get('q')).toBe('consulta');
    expect(new URLSearchParams(window.location.search).has('tab')).toBe(false);
  });

  it('denies the legacy orders link when a verified actor lacks an orders read grant', async () => {
    runtime.user = { ...verifiedUser(), capabilities: ['tickets.read'] };
    window.history.replaceState({}, '', '/perfil?tab=orders&focus=assisted');
    render(<BrowserRouter><Routes>
      <Route path="/perfil" element={<ProfileHarness />} />
      <Route path="/pedidos" element={<div>Pedidos verificados</div>} />
      <Route path="/403" element={<div>Acceso denegado</div>} />
    </Routes></BrowserRouter>);
    await screen.findByText('Acceso denegado');
    expect(screen.queryByText('Pedidos verificados')).not.toBeInTheDocument();
  });

  it('does not reload identity or request territorial datasets from the institutional profile', async () => {
    renderProfile('/perfil?range=7d&scope=municipio');

    await waitFor(() => expect(countApiCalls('/api/me')).toBe(1));
    expect(countApiCalls('/api/whatsapp/promocionar')).toBe(0);
    expect(countApiCalls('/api/app/backoffice/navigation?tenant_slug=junin')).toBe(1);
    expect(countApiCalls('/municipal/categorias')).toBe(0);
    expect(runtime.getTicketStats).not.toHaveBeenCalled();
    expect(runtime.getHeatmapDataset).not.toHaveBeenCalled();
    expect(runtime.refreshUser).not.toHaveBeenCalled();

    await act(async () => {
      updateBrowserLocation('/perfil?tab=analytics&range=30d&scope=municipio');
    });
    await waitFor(() => {
      expect(screen.getByTestId('mock-analytics')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Abrir menú Inteligencia' })).toHaveAttribute('data-active', 'true');
    });

    await act(async () => {
      updateBrowserLocation('/perfil?tab=perfil&range=30d&scope=municipio');
    });
    await waitFor(() => expect(screen.getByText('Trabajo de hoy')).toBeInTheDocument());

    expect(countApiCalls('/api/me')).toBe(1);
    expect(countApiCalls('/api/whatsapp/promocionar')).toBe(0);
    expect(countApiCalls('/api/app/backoffice/navigation?tenant_slug=junin')).toBe(1);
    expect(countApiCalls('/municipal/categorias')).toBe(0);
    expect(runtime.getTicketStats).not.toHaveBeenCalled();
    expect(runtime.getHeatmapDataset).not.toHaveBeenCalled();
    expect(runtime.refreshUser).not.toHaveBeenCalled();
  });

  it('keeps the viewport workspace shell at full width inside the flex app layout', async () => {
    renderProfile('/perfil?tab=tickets');

    await waitFor(() => expect(screen.getByTestId('mock-tickets')).toBeInTheDocument());

    expect(screen.getByTestId('profile-page-shell')).toHaveClass('w-full', 'min-w-0');
    expect(screen.getByTestId('profile-ticket-workspace')).toHaveClass('flex-1', 'min-h-0', 'overflow-hidden');
  });

  it('keeps a structured workspace skeleton visible while authorization is still pending', async () => {
    let resolveNavigation: ((value: unknown) => void) | undefined;
    const navigationPromise = new Promise((resolve) => {
      resolveNavigation = resolve;
    });
    runtime.apiFetch.mockImplementation(async (path: string, options?: { tenantSlug?: string | null }) => {
      const tenantSlug = options?.tenantSlug || 'junin';
      if (path === '/api/me') return profileResponse(tenantSlug);
      if (path.startsWith('/api/app/backoffice/navigation')) return navigationPromise;
      return {};
    });

    renderProfile('/perfil?tab=usuarios&tenant_slug=junin&tenant=junin');

    await waitFor(() => {
      expect(screen.getByText('Verificando accesos del equipo')).toBeInTheDocument();
      expect(screen.getByTestId('profile-workspace-authorization-skeleton')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('mock-users')).not.toBeInTheDocument();

    await act(async () => {
      resolveNavigation?.({
        contract_version: 'backoffice.navigation.v1',
        modules: [
          { id: 'people', label: 'Personas y accesos', route: '/empleados', enabled: true },
        ],
      });
      await navigationPromise;
    });

    await waitFor(() => expect(screen.getByTestId('mock-users')).toBeInTheDocument());
    expect(screen.queryByTestId('profile-workspace-authorization-skeleton')).not.toBeInTheDocument();
  });

  it('uses the compact full-width console shell for the territorial workspace', async () => {
    renderProfile('/perfil?tab=mapas');

    await waitFor(() => expect(screen.getByTestId('mock-map')).toBeInTheDocument());

    expect(screen.getByTestId('profile-page-shell')).toHaveClass('w-full', 'min-w-0', 'px-1', 'py-1');
    expect(screen.getByTestId('profile-map-workspace')).toHaveClass('min-w-0', 'pb-0');
    expect(screen.getByText('Consola territorial')).toBeInTheDocument();
    expect(screen.queryByText('Espacio de trabajo')).not.toBeInTheDocument();
  });

  it.each([['mapas', 'mock-map'], ['tickets', 'mock-tickets'], ['usuarios', 'mock-users']])(
    'returns from %s to Inicio without restoring the previous tab', async (tab, probe) => {
      renderProfile(`/perfil?tab=${tab}`);
      await waitFor(() => expect(screen.getByTestId(probe)).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'Abrir Inicio' }));
      await waitFor(() => expect(screen.getByRole('heading', { name: 'Trabajo de hoy' })).toBeInTheDocument());
      expect(screen.queryByTestId(probe)).not.toBeInTheDocument();
      expect(window.location.search).not.toContain('tab=');
    },
  );

  it('restores an institutional section from the URL and keeps contact phone separate from WhatsApp', async () => {
    renderProfile('/perfil?tab=perfil&section=channels');

    await waitFor(() => expect(screen.getByTestId('institution-profile-panel-channels')).toBeInTheDocument());
    expect(screen.getByTestId('profile-institution-workspace')).toHaveClass('min-h-0', 'flex-1', 'overflow-hidden');
    expect(screen.getByTestId('institution-profile-workspace')).toHaveClass('h-full', 'min-h-0');
    expect(screen.getByRole('button', { name: 'Abrir menú Administración' })).toHaveAttribute('data-active', 'true');
    expect(screen.getByRole('button', { name: 'Abrir Inicio' })).not.toHaveAttribute('aria-current', 'page');
    expect(screen.getByText(/Guardar un teléfono en General no vincula WhatsApp/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('institution-profile-section-general'));

    await waitFor(() => expect(screen.getByTestId('institution-profile-panel-general')).toBeInTheDocument());
    expect(screen.getByText('Teléfono institucional o de contacto — no configura WhatsApp')).toBeInTheDocument();
    expect(window.location.search).not.toContain('section=channels');
    expect(window.location.search).toContain('section=general');
  });

  it('opens the existing tenant integration workspace for a municipal Full administrator with a settings grant', async () => {
    runtime.realNavigation = true;
    runtime.user = { ...verifiedUser(), rol: 'admin_municipio', plan: 'full', capabilities: ['settings.tenant.write'] };
    const read = runtime.apiFetch.getMockImplementation();
    runtime.apiFetch.mockImplementation(async (path: string, options?: any) => {
      const payload = await read?.(path, options);
      return path === '/api/me' ? { ...payload, plan: 'full' } : payload;
    });
    localStorage.setItem('tenantSlug', 'another-organization');
    window.history.replaceState({}, '', '/perfil?section=channels');
    render(<CapabilitiesProvider><BrowserRouter><Routes>
      <Route path="/perfil" element={<ProfileHarness />} />
      <Route path="/t/:tenant/integracion" element={
        <AccessRoute roles={['tenant_admin', 'superadmin']} requiredAllCapabilities={['settings.tenant.write']}>
          <div>Integraciones de la organización</div>
        </AccessRoute>
      } />
      <Route path="/municipal/integrations" element={<div>Placeholder municipal</div>} />
    </Routes></BrowserRouter></CapabilitiesProvider>);

    const entry = await screen.findByRole('button', { name: /Integraciones y canales web/ });
    expect(entry).toBeEnabled();
    fireEvent.click(entry);
    await screen.findByText('Integraciones de la organización');
    expect(window.location.pathname).toBe('/t/junin/integracion');
    expect(screen.queryByText('Placeholder municipal')).not.toBeInTheDocument();
  });

  it.each(['missing-tenant', 'missing-capability'] as const)(
    'keeps municipal integration navigation closed with %s and gives a recovery action', async (reason) => {
      runtime.realNavigation = true;
      runtime.user = {
        ...verifiedUser(reason === 'missing-tenant' ? '' : 'junin'), rol: 'admin_municipio', plan: 'full',
        capabilities: reason === 'missing-capability' ? ['knowledge.write'] : ['settings.tenant.write'],
      };
      if (reason === 'missing-tenant') {
        runtime.apiFetch.mockImplementation(async (path: string) => path === '/api/me' ? { ...profileResponse(''), plan: 'full' } : {});
      } else {
        const read = runtime.apiFetch.getMockImplementation();
        runtime.apiFetch.mockImplementation(async (path: string, options?: any) => {
          const payload = await read?.(path, options);
          return path === '/api/me' ? { ...payload, plan: 'full' } : payload;
        });
      }
      localStorage.setItem('tenantSlug', 'another-organization');
      window.history.replaceState({}, '', '/perfil?section=channels');
      render(<CapabilitiesProvider><BrowserRouter><ProfileHarness /></BrowserRouter></CapabilitiesProvider>);

      const entry = await screen.findByRole('button', { name: /Integraciones y canales web/ });
      expect(entry).toBeDisabled();
      fireEvent.click(entry);
      expect(window.location.pathname).toBe('/perfil');
      if (reason === 'missing-tenant') {
        fireEvent.click(screen.getByRole('button', { name: 'Reintentar verificación de organización' }));
        expect(runtime.refreshUser).toHaveBeenCalledTimes(1);
      } else {
        expect(screen.getByText(/Necesitás permiso para configurar los canales/)).toBeInTheDocument();
        expect(runtime.refreshUser).not.toHaveBeenCalled();
      }
    },
  );

  it('canonicalizes an institutional deep link without dropping section or setup', async () => {
    renderProfile('/perfil?tab=tickets&section=channels&setup=channels');

    await waitFor(() => expect(screen.getByTestId('institution-profile-panel-channels')).toBeInTheDocument());
    expect(runtime.ticketMounts).toBe(0);
    expect(window.location.search).toContain('tab=perfil');
    expect(window.location.search).toContain('section=channels');
    expect(window.location.search).toContain('setup=channels');
  });

  it('authorizes an explicit Junin deep link before sharing its canonical tenant with plan, people and maps', async () => {
    runtime.user = verifiedUser('municipio');
    runtime.apiFetch.mockImplementation(async (path: string, options?: { tenantSlug?: string | null }) => {
      if (path === '/api/v2/tenants/junin/activation/channels') {
        return {
          contract_version: 'tenant.channel_activation.v1',
          tenant: { slug: 'junin', nombre: 'Municipalidad de Junín', plan: 'full' },
          integration_access: { enabled: true, status: 'enabled', current_plan: 'full' },
          channels: [],
        };
      }
      if (path === '/api/me') {
        return {
          ...profileResponse('municipio'),
          plan: 'free',
          tenant_slug: 'municipio',
          slug: 'municipio',
        };
      }
      if (path === '/api/app/backoffice/navigation?tenant_slug=junin') {
        return {
          contract_version: 'backoffice.navigation.v1',
          modules: [
            { id: 'people', label: 'Personas y accesos', route: '/perfil?tab=usuarios', enabled: true },
            { id: 'maps', label: 'Mapas de calor', route: '/perfil?tab=mapas', enabled: true },
          ],
        };
      }
      return {};
    });

    renderProfile(
      '/perfil?tab=perfil&section=channels&setup=channels&tenant_slug=junin&tenant=junin',
    );

    await waitFor(() => {
      expect(screen.getByTestId('mock-channel-activation')).toHaveAttribute(
        'data-tenant-slug',
        'junin',
      );
      expect(screen.getByTestId('mock-channel-activation')).toHaveAttribute(
        'data-current-plan',
        'full',
      );
    });
    expect(runtime.apiFetch).toHaveBeenCalledWith('/api/me', expect.objectContaining({ tenantSlug: 'junin',
      isWidgetRequest: false, omitEntityToken: true, omitChatSessionId: true, omitCredentials: false,
      persistTenantSlug: false, singleAttempt: true, allowStartupRecovery: true, isCurrent: expect.any(Function) }));
    expect(localStorage.getItem('tenantSlug')).toBe('junin');

    await act(async () => {
      updateBrowserLocation('/perfil?tab=usuarios&tenant_slug=junin&tenant=junin');
    });
    await waitFor(() =>
      expect(screen.getByTestId('mock-users')).toHaveAttribute('data-tenant-slug', 'junin'),
    );
    expect(screen.getByTestId('mock-users')).toHaveAttribute('data-embedded', 'true');
    expect(screen.getByTestId('profile-crm-workspace')).toHaveClass('min-h-0', 'overflow-hidden');

    await act(async () => {
      updateBrowserLocation('/perfil?tab=mapas&tenant_slug=junin&tenant=junin');
    });
    await waitFor(() =>
      expect(screen.getByTestId('mock-map')).toHaveAttribute('data-tenant-slug', 'junin'),
    );

    expect(
      runtime.apiFetch.mock.calls.some(
        ([path, options]) =>
          path !== '/api/v2/tenants/junin/activation/channels' && options?.tenantSlug === 'municipio',
      ),
    ).toBe(false);
  });

  it('rejects an unauthorized tenant query and keeps every operational request on the session tenant', async () => {
    runtime.user = verifiedUser('junin');
    runtime.apiFetch.mockImplementation(async (path: string, options?: { tenantSlug?: string | null }) => {
      if (path === '/api/v2/tenants/mendoza/activation/channels') {
        throw new ApiError('Permisos insuficientes para este tenant', 403, {
          reason_code: 'forbidden_tenant',
        });
      }
      if (path === '/api/me') return profileResponse(options?.tenantSlug || 'junin');
      if (path === '/api/app/backoffice/navigation?tenant_slug=junin') {
        return {
          contract_version: 'backoffice.navigation.v1',
          modules: [{ id: 'people', label: 'Personas y accesos', route: '/perfil?tab=usuarios', enabled: true }],
        };
      }
      return {};
    });

    renderProfile('/perfil?tab=usuarios&tenant_slug=mendoza&tenant=mendoza');

    await waitFor(() =>
      expect(screen.getByTestId('mock-users')).toHaveAttribute('data-tenant-slug', 'junin'),
    );
    expect(runtime.apiFetch).toHaveBeenCalledWith(
      '/api/v2/tenants/mendoza/activation/channels',
      expect.objectContaining({ ...panelReadOptions('mendoza'), cache: 'no-store', isCurrent: expect.any(Function) }),
    );
    expect(runtime.apiFetch).toHaveBeenCalledWith('/api/me', expect.objectContaining({ tenantSlug: 'junin',
      isWidgetRequest: false, omitEntityToken: true, omitChatSessionId: true, omitCredentials: false,
      persistTenantSlug: false, singleAttempt: true, allowStartupRecovery: true, isCurrent: expect.any(Function) }));
    expect(countApiCalls('/api/app/backoffice/navigation?tenant_slug=mendoza')).toBe(0);
    expect(localStorage.getItem('tenantSlug')).not.toBe('mendoza');
    expect(
      runtime.apiFetch.mock.calls.some(
        ([path, options]) =>
          path !== '/api/v2/tenants/mendoza/activation/channels' && options?.tenantSlug === 'mendoza',
      ),
    ).toBe(false);
  });

  it('fails closed on a navigation error without losing the authorized Junin tenant', async () => {
    runtime.user = verifiedUser('municipio');
    runtime.apiFetch.mockImplementation(async (path: string, options?: { tenantSlug?: string | null }) => {
      if (path === '/api/v2/tenants/junin/activation/channels') {
        return {
          contract_version: 'tenant.channel_activation.v1',
          tenant: { slug: 'junin', plan: 'full' },
          integration_access: { enabled: true, status: 'enabled', current_plan: 'full' },
          channels: [],
        };
      }
      if (path === '/api/me') return profileResponse(options?.tenantSlug || 'junin');
      if (path === '/api/app/backoffice/navigation?tenant_slug=junin') {
        throw new Error('backend navigation unavailable');
      }
      return {};
    });

    renderProfile('/perfil?tab=usuarios&tenant_slug=junin&tenant=junin');

    await waitFor(() => expect(screen.getByText('No pudimos verificar los módulos')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(screen.queryByTestId('mock-users')).not.toBeInTheDocument();
    expect(localStorage.getItem('tenantSlug')).toBe('junin');
    expect(runtime.apiFetch).toHaveBeenCalledWith('/api/me', expect.objectContaining({ tenantSlug: 'junin',
      isWidgetRequest: false, omitEntityToken: true, omitChatSessionId: true, omitCredentials: false,
      persistTenantSlug: false, singleAttempt: true, allowStartupRecovery: true, isCurrent: expect.any(Function) }));
    expect(countApiCalls('/api/app/backoffice/navigation?tenant_slug=junin')).toBe(1);
  });

  it('uses the verified profile and channel tenant when the session omits its slug', async () => {
    runtime.user = {
      ...verifiedUser('junin'),
      tenantSlug: undefined,
      tenant_slug: undefined,
      tenant: undefined,
    };
    runtime.apiFetch.mockImplementation(async (path: string) => {
      if (path === '/api/me') {
        return {
          ...profileResponse('junin'),
          plan: 'full',
          channel_activation: {
            contract_version: 'tenant.channel_activation.v1',
            tenant: { slug: 'junin', plan: 'full' },
            integration_access: { enabled: true, status: 'enabled', current_plan: 'full' },
            channels: [],
          },
        };
      }
      if (path.startsWith('/api/app/backoffice/navigation')) {
        return {
          contract_version: 'backoffice.navigation.v1',
          modules: [{ id: 'operations', label: 'Operar reclamos', route: '/perfil?tab=tickets', enabled: true }],
        };
      }
      return {};
    });

    renderProfile('/perfil?tab=perfil&section=channels&setup=channels');

    await waitFor(() => {
      expect(screen.getByTestId('mock-channel-activation')).toHaveAttribute('data-tenant-slug', 'junin');
      expect(screen.getByTestId('mock-channel-activation')).toHaveAttribute('data-current-plan', 'full');
    });
  });

  it('preserves an institutional deep link when backend navigation denies the requested workspace tab', async () => {
    runtime.apiFetch.mockImplementation(async (path: string, options?: { tenantSlug?: string | null }) => {
      const tenantSlug = options?.tenantSlug || 'junin';
      if (path === '/api/me') return profileResponse(tenantSlug);
      if (path.startsWith('/api/app/backoffice/navigation')) {
        return {
          contract_version: 'backoffice.navigation.v1',
          modules: [{ id: 'people', label: 'Personas y accesos', route: '/empleados', enabled: true }],
        };
      }
      return {};
    });

    renderProfile('/perfil?tab=tickets&section=channels&setup=channels');

    await waitFor(() => expect(screen.getByTestId('institution-profile-panel-channels')).toBeInTheDocument());
    expect(window.location.search).toContain('tab=perfil');
    expect(window.location.search).toContain('section=channels');
    expect(window.location.search).toContain('setup=channels');
  });

  it('grants institutional administration to the normalized tenant_admin role', async () => {
    runtime.user = { ...verifiedUser('junin'), rol: 'tenant_admin' };
    renderProfile('/perfil?section=general');

    await waitFor(() => expect(screen.getByText('Administración habilitada')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
  });

  it('loads and saves the selected organization through its revisioned contract without changing the actor', async () => {
    let latestProfile = organizationProfileResponse();
    wireSelectedOrganization(() => latestProfile, (body) => {
      latestProfile = { ...latestProfile, revision: 'b'.repeat(64), values: { ...latestProfile.values, ...body.organization_profile } };
      return { contract_version: 'organization.profile_save.v1', ok: true, tenant: latestProfile.tenant, profile: latestProfile };
    });
    renderProfile('/perfil?section=general&tenant_slug=selected-organization');

    const name = await screen.findByRole('textbox', { name: 'Nombre legal o institucional' });
    expect(name).toHaveValue('Organización seleccionada');
    expect(name).toHaveAccessibleDescription('Se muestra en el encabezado del espacio de trabajo y en las comunicaciones oficiales.');
    expect(screen.getByRole('textbox', { name: /Teléfono institucional/ })).toHaveValue('+542900123456');
    expect(screen.getByRole('textbox', { name: /Teléfono institucional/ })).toHaveAttribute('type', 'tel');
    expect(screen.getByRole('textbox', { name: /Teléfono institucional/ })).toHaveAccessibleDescription('Es un dato de contacto del perfil. El número oficial de WhatsApp se vincula y verifica en Canales.');
    expect(countApiCalls('/api/me')).toBe(0);
    expect(runtime.apiFetch).toHaveBeenCalledWith('/api/admin/tenants/selected-organization/config', expect.objectContaining({
      tenantSlug: 'selected-organization', persistTenantSlug: false,
      omitEntityToken: true, omitChatSessionId: true, isWidgetRequest: false,
    }));

    fireEvent.change(name, { target: { value: 'Nombre actualizado de la organización' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await screen.findByText('Cambios de la organización guardados correctamente.');

    const saves = runtime.apiFetch.mock.calls.filter(([, options]) => options?.method === 'PUT');
    expect(saves).toHaveLength(1);
    expect(saves[0]).toEqual(['/api/admin/tenants/selected-organization/config', expect.objectContaining({
      tenantSlug: 'selected-organization', omitEntityToken: true, omitChatSessionId: true,
      isWidgetRequest: false, persistTenantSlug: false,
      body: { expected_revision: 'a'.repeat(64), organization_profile: { nombre_empresa: 'Nombre actualizado de la organización' } },
    })]);
    expect(runtime.setUser).not.toHaveBeenCalled();
    expect(runtime.user?.tenant_slug).toBe('junin');
    expect(runtime.user?.nombre_empresa).toBe('Mi cuenta personal');
    expect(countApiCalls('/perfil')).toBe(0);

    fireEvent.click(screen.getByTestId('institution-profile-section-hours'));
    await screen.findByText('Horarios sin configurar');
    fireEvent.click(screen.getByTestId('institution-profile-section-identity'));
    await screen.findByRole('textbox', { name: 'Logo institucional' });
    expect(screen.queryByRole('textbox', { name: 'Imagen personal autorizada' })).not.toBeInTheDocument();
  });

  it('keeps an authorized selected organization read only when the server disables edits', async () => {
    wireSelectedOrganization(() => organizationProfileResponse('selected-organization', false));
    renderProfile('/perfil?section=general&tenant_slug=selected-organization');

    await screen.findByText('Perfil en modo consulta');
    expect(screen.getByRole('textbox', { name: 'Nombre legal o institucional' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Actualizar perfil' })).toBeEnabled();
    expect(runtime.apiFetch.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(false);
  });

  it.each(['slug', 'id', 'revision'])('hides institutional fields when the selected profile has an invalid %s', async (invalidField) => {
    const profile = organizationProfileResponse();
    if (invalidField === 'slug') profile.tenant.slug = 'junin';
    if (invalidField === 'id') profile.tenant.id = 910;
    if (invalidField === 'revision') profile.revision = '';
    wireSelectedOrganization(() => profile);
    renderProfile('/perfil?section=general&tenant_slug=selected-organization');

    await screen.findByText('No pudimos verificar el perfil institucional');
    expect(screen.queryByRole('textbox', { name: 'Nombre legal o institucional' })).not.toBeInTheDocument();
    expect(screen.queryByText('Mi cuenta personal')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar perfil' })).toBeInTheDocument();
    expect(countApiCalls('/api/me')).toBe(0);
    expect(runtime.setUser).not.toHaveBeenCalled();
  });

  it('shows a safe denial and never falls back to actor fields after a selected profile 403', async () => {
    wireSelectedOrganization(() => { throw new ApiError('Private response body must stay hidden', 403); });
    renderProfile('/perfil?section=general&tenant_slug=selected-organization');

    await screen.findByText('Perfil institucional no habilitado');
    expect(screen.queryByText('Private response body must stay hidden')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Nombre legal o institucional' })).not.toBeInTheDocument();
    expect(countApiCalls('/api/me')).toBe(0);
  });

  it('preserves a selected organization draft on revision conflict without replaying the write', async () => {
    wireSelectedOrganization(() => organizationProfileResponse(), () => { throw new ApiError('Conflict', 412); });
    renderProfile('/perfil?section=general&tenant_slug=selected-organization');
    const name = await screen.findByRole('textbox', { name: 'Nombre legal o institucional' });
    fireEvent.change(name, { target: { value: 'Edición pendiente' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await screen.findByText(/Otra persona actualizó este perfil. Conservamos tus cambios:/);
    expect(name).toHaveValue('Edición pendiente');
    expect(runtime.apiFetch.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(1);
    expect(runtime.apiFetch.mock.calls.filter(([path, options]) => path.endsWith('/config') && options?.method !== 'PUT')).toHaveLength(1);
    expect(runtime.setUser).not.toHaveBeenCalled();
  });

  it('returns to the personal profile without carrying the selected organization into the actor', async () => {
    const navigateLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    wireSelectedOrganization(() => organizationProfileResponse());
    renderProfile('/perfil?section=general&tenant_slug=selected-organization');
    await screen.findByRole('textbox', { name: 'Nombre legal o institucional' });

    fireEvent.click(screen.getByRole('button', { name: 'Mi perfil' }));
    expect(navigateLog).toHaveBeenCalledWith('Mocked navigate to: /perfil');
    await act(async () => { updateBrowserLocation('/perfil'); });
    await waitFor(() => expect(countApiCalls('/api/me')).toBe(1));
    expect(runtime.apiFetch).toHaveBeenCalledWith('/api/me', expect.objectContaining({ tenantSlug: 'junin',
      isWidgetRequest: false, omitEntityToken: true, omitChatSessionId: true, omitCredentials: false,
      persistTenantSlug: false, singleAttempt: true, allowStartupRecovery: true, isCurrent: expect.any(Function) }));
    expect(window.location.search).not.toContain('tenant_slug');
    expect(runtime.setUser).not.toHaveBeenCalled();
    expect(runtime.user?.tenant_slug).toBe('junin');
    navigateLog.mockRestore();
  });

  it('validates the complete institutional record before saving from another section', async () => {
    renderProfile('/perfil?tab=perfil&section=general');

    const nameInput = await screen.findByRole('textbox', { name: 'Nombre legal o institucional' });
    fireEvent.change(nameInput, { target: { value: '' } });
    fireEvent.click(screen.getByTestId('institution-profile-section-channels'));
    await waitFor(() => expect(screen.getByTestId('institution-profile-panel-channels')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(screen.getByText(/Completá nombre institucional antes de guardar/i)).toBeInTheDocument());
    expect(window.location.search).toContain('section=general');
    expect(runtime.apiFetch.mock.calls.some(([path, options]) => path === '/perfil' && options?.method === 'PUT')).toBe(false);
  });

  it('separates the operational home from the institutional editor to avoid one long page', async () => {
    renderProfile('/perfil');

    await waitFor(() => expect(screen.getByText('Trabajo de hoy')).toBeInTheDocument());
    expect(screen.queryByTestId('institution-profile-workspace')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Perfil institucional' }));

    await waitFor(() => expect(screen.getByTestId('institution-profile-workspace')).toBeInTheDocument());
    expect(screen.queryByText('Trabajo de hoy')).not.toBeInTheDocument();
    expect(window.location.search).toContain('section=general');
  });

  it('opens one dedicated plan section without duplicating profile requests', async () => {
    renderProfile('/perfil?tab=perfil&section=plan');

    await waitFor(() => expect(countApiCalls('/api/me')).toBe(1));
    await waitFor(() => expect(screen.getByText('Uso de la organización')).toBeInTheDocument());

    expect(screen.getAllByText('Plan Pro')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /^Salir$/i })).not.toBeInTheDocument();
    expect(countApiCalls('/api/me')).toBe(1);
    expect(runtime.refreshUser).not.toHaveBeenCalled();

    expect(screen.getByRole('button', { name: 'Abrir menú Administración' })).toHaveAttribute('data-active', 'true');

    fireEvent.keyDown(screen.getByRole('button', { name: 'Abrir menú Atención' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('menuitem', { name: /Reclamos/i }));

    await waitFor(() => expect(screen.getByTestId('mock-tickets')).toBeInTheDocument());
    expect(window.location.search).toContain('tab=tickets');
    expect(window.location.search).not.toContain('section=plan');
  });

  it('opens plans from the Administration work area without exposing a loose top-level tab', async () => {
    renderProfile('/perfil');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Abrir menú Administración' })).toBeInTheDocument());
    fireEvent.keyDown(screen.getByRole('button', { name: 'Abrir menú Administración' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('menuitem', { name: /Planes y facturación/i }));

    await waitFor(() => expect(screen.getByText('Uso de la organización')).toBeInTheDocument());
    expect(window.location.search).toContain('tab=perfil');
    expect(window.location.search).toContain('section=plan');
    expect(screen.getByRole('button', { name: 'Abrir menú Administración' })).toHaveAttribute('data-active', 'true');
    expect(countApiCalls('/api/me')).toBe(1);
  });

  it('keeps the exact safe next URL when an unauthenticated query route redirects', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    runtime.hasSession = false;
    runtime.user = null;
    renderProfile('/perfil?tab=tickets&range=30d&scope=municipio');

    await waitFor(() => {
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Mocked navigate to: /login?next=%2Fperfil%3Ftab%3Dtickets%26range%3D30d%26scope%3Dmunicipio',
      );
    });
    expect(countApiCalls('/api/me')).toBe(0);
    expect(runtime.refreshUser).not.toHaveBeenCalled();
    consoleLogSpy.mockRestore();
  });

  it('does not hydrate private profile data from a persisted but unverified Clerk session', async () => {
    runtime.hasSession = true;
    runtime.user = null;
    renderProfile('/perfil?tab=analytics');

    await act(async () => undefined);

    expect(countApiCalls('/api/me')).toBe(0);
    expect(runtime.apiFetch).not.toHaveBeenCalled();
    expect(screen.queryByTestId('login-location')).not.toBeInTheDocument();
  });

  it('reloads the profile exactly once when the verified tenant scope changes', async () => {
    renderProfile('/perfil');
    await waitFor(() => expect(countApiCalls('/api/me')).toBe(1));

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar tenant de prueba' }));

    await waitFor(() => expect(countApiCalls('/api/me')).toBe(2));
    const profileCalls = runtime.apiFetch.mock.calls.filter(([path]) => path === '/api/me');
    expect(profileCalls[0][1]).toMatchObject({ tenantSlug: 'junin' });
    expect(profileCalls[1][1]).toMatchObject({ tenantSlug: 'mendoza' });
    expect(countApiCalls('/api/app/backoffice/navigation?tenant_slug=junin')).toBe(1);
    await waitFor(() => {
      expect(countApiCalls('/api/app/backoffice/navigation?tenant_slug=mendoza')).toBe(1);
    });
    expect(runtime.refreshUser).not.toHaveBeenCalled();
  });

  it('reloads role-scoped navigation when the verified role changes inside the same tenant', async () => {
    renderProfile('/perfil');
    await waitFor(() => expect(countApiCalls('/api/app/backoffice/navigation?tenant_slug=junin')).toBe(1));

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar rol de prueba' }));

    await waitFor(() => expect(countApiCalls('/api/app/backoffice/navigation?tenant_slug=junin')).toBe(2));
  });

  it('fails closed when the backend denies the operational navigation contract', async () => {
    runtime.user = { ...verifiedUser('junin'), rol: 'empleado' };
    runtime.apiFetch.mockImplementation(async (path: string, options?: { tenantSlug?: string | null }) => {
      const tenantSlug = options?.tenantSlug || 'junin';
      if (path === '/api/me') return profileResponse(tenantSlug);
      if (path.startsWith('/api/app/backoffice/navigation')) {
        throw new ApiError('Alcance operativo requerido', 403, {
          reason_code: 'backoffice_operational_capability_required',
        });
      }
      if (path === '/api/whatsapp/promocionar') return { can_send: true };
      if (path === '/municipal/categorias') return { categorias: [] };
      return {};
    });

    renderProfile('/perfil');

    await waitFor(() => expect(screen.getByText('Acceso operativo no habilitado')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Abrir menú Atención' })).not.toBeInTheDocument();
    expect(screen.queryByText('Abrir reclamos')).not.toBeInTheDocument();
    expect(screen.queryByText('Encuestas y sondeos')).not.toBeInTheDocument();
  });

  it('maps the backend maps module to the dedicated territory workspace', async () => {
    renderProfile('/perfil');

    const mapsCardTitle = await screen.findByText('Mapas de calor');
    const mapsCard = mapsCardTitle.closest('button');
    expect(mapsCard).not.toBeNull();
    fireEvent.click(mapsCard as HTMLButtonElement);

    await waitFor(() => expect(screen.getByTestId('mock-map')).toBeInTheDocument());
    expect(window.location.search).toContain('tab=mapas');
    expect(window.location.search).not.toContain('tab=estadisticas');
  });
});
