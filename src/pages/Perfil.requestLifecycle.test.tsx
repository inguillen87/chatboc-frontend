import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  getTicketStats: vi.fn(),
  getHeatmapDataset: vi.fn(),
  refreshUser: vi.fn(),
  setUser: vi.fn(),
  toast: vi.fn(),
  ticketMounts: 0,
  hasSession: true,
  user: null as Record<string, any> | null,
}));

vi.mock('@/hooks/useUser', () => ({
  useUser: () => ({
    user: runtime.user,
    setUser: runtime.setUser,
    refreshUser: runtime.refreshUser,
    loading: false,
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
vi.mock('@/pages/UsuariosPage', () => ({ default: () => <div /> }));
vi.mock('@/pages/SmartPedidosWrapper', () => ({ default: () => <div /> }));
vi.mock('@/pages/InternalUsers', () => ({ default: () => <div /> }));
vi.mock('@/pages/IncidentsMap', () => ({ default: () => <div data-testid="mock-map" /> }));
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

  it('restores an institutional section from the URL and keeps contact phone separate from WhatsApp', async () => {
    renderProfile('/perfil?tab=perfil&section=channels');

    await waitFor(() => expect(screen.getByTestId('institution-profile-panel-channels')).toBeInTheDocument());
    expect(screen.getByText(/Guardar un teléfono en General no vincula WhatsApp/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('institution-profile-section-general'));

    await waitFor(() => expect(screen.getByTestId('institution-profile-panel-general')).toBeInTheDocument());
    expect(screen.getByText('Teléfono institucional o de contacto — no configura WhatsApp')).toBeInTheDocument();
    expect(window.location.search).not.toContain('section=channels');
    expect(window.location.search).toContain('section=general');
  });

  it('canonicalizes an institutional deep link without dropping section or setup', async () => {
    renderProfile('/perfil?tab=tickets&section=channels&setup=channels');

    await waitFor(() => expect(screen.getByTestId('institution-profile-panel-channels')).toBeInTheDocument());
    expect(runtime.ticketMounts).toBe(0);
    expect(window.location.search).toContain('tab=perfil');
    expect(window.location.search).toContain('section=channels');
    expect(window.location.search).toContain('setup=channels');
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
