import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';

const runtime = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  user: null as any,
}));

vi.mock('@/utils/api', async () => {
  const actual = await vi.importActual<typeof import('@/utils/api')>('@/utils/api');
  return {
    ...actual,
    apiFetch: (...args: any[]) => runtime.apiFetch(...args),
  };
});

vi.mock('@/hooks/useUser', () => ({
  useUser: () => ({
    user: runtime.user,
    setUser: vi.fn(),
    refreshUser: vi.fn().mockResolvedValue(undefined),
    organizationProfileVerified: true,
    loading: false,
    hasVerifiedSession: true,
  }),
}));

vi.mock('@/context/CapabilitiesContext', () => ({
  useCapabilities: () => ({ hasCapability: () => true }),
}));

vi.mock('@/utils/sessionLogout', () => ({
  hasAuthenticatedChatbocSession: () => true,
  logoutChatbocSession: vi.fn().mockResolvedValue(undefined),
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

vi.mock('@/components/LazyMapLibreMap', () => ({ default: () => null }));
vi.mock('@/components/analytics/Heatmap', () => ({ default: () => null }));
vi.mock('@/components/catalog/ImportWizard', () => ({ default: () => null }));
vi.mock('@/components/ui/MiniChatWidgetPreview', () => ({ default: () => null }));
vi.mock('@/components/ui/AddressAutocomplete', () => ({ default: () => null }));

import Perfil from './Perfil';

const brandingSnapshot = (overrides: Record<string, unknown> = {}) => ({
  contract_version: 'organization.branding.v1',
  tenant: { id: 909, slug: 'junin' },
  revision: 'a'.repeat(64),
  version: 2,
  values: {
    enabled: true,
    primary_color: '#0055AA',
    accent_color: '#FFAA00',
  },
  history: [
    {
      version: 1,
      values: { enabled: true, primary_color: '#346600', accent_color: '#98C400' },
    },
  ],
  can_edit: true,
  reason_code: 'ready',
  message: '',
  appearance: {
    active: true,
    primary: { background: '#0055AA', foreground: '#FFFFFF', contrast: 7.51 },
    accent: { background: '#FFAA00', foreground: '#000000', contrast: 10.67 },
  },
  presets: [
    {
      id: 'junin',
      label: 'Verde Junín',
      primary_color: '#346600',
      accent_color: '#98C400',
    },
  ],
  heading: 'Paleta del espacio',
  scope_note: 'Aplica a botones y pestañas del portal público.',
  save_endpoint: '/api/admin/tenants/junin/config',
  ...overrides,
});

describe('Perfil identity section — Paleta del espacio', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    runtime.apiFetch.mockReset();
    runtime.user = {
      id: 1,
      name: 'Admin',
      email: 'admin@example.test',
      rol: 'superadmin',
      tipo_chat: 'municipio',
      tenant_slug: 'junin',
      tenantSlug: 'junin',
      plan: 'full',
      capabilities: ['settings.tenant.write'],
    };
  });

  it('renders Paleta del espacio at /perfil?section=identity&tenant_slug=junin and publishes without submitting profile form', async () => {
    const user = userEvent.setup();
    const putCalls: any[] = [];
    const savedBranding = brandingSnapshot({
      revision: 'b'.repeat(64),
      version: 3,
      values: { enabled: true, primary_color: '#346600', accent_color: '#98C400' },
    });

    runtime.apiFetch.mockImplementation(async (path: string, options?: any) => {
      if (path === '/api/v2/tenants/junin/activation/channels') {
        return {
          contract_version: 'tenant.channel_activation.v1',
          tenant: { id: 909, slug: 'junin', plan: 'full' },
          integration_access: { enabled: true, status: 'enabled', current_plan: 'full' },
          channels: [],
        };
      }
      if (path === '/api/admin/tenants/junin/config') {
        if (options?.method === 'PUT') {
          putCalls.push(options.body);
          return {
            contract_version: 'organization.branding_save.v1',
            saved: true,
            tenant: { id: 909, slug: 'junin' },
            brand: savedBranding,
          };
        }
        return {
          tenant: { id: 909, slug: 'junin', tipo: 'municipio', plan: 'full' },
          organization_profile: {
            contract_version: 'organization.profile_settings.v1',
            tenant: { id: 909, slug: 'junin' },
            revision: 'f'.repeat(64),
            can_edit: true,
            editability: { mode: 'editable' },
            values: {
              nombre_empresa: 'Municipalidad de Junín',
              telefono: '+542634000000',
              direccion: 'Av. Mitre 100',
              ciudad: 'Junín',
              provincia: 'Mendoza',
              pais: 'Argentina',
              latitud: null,
              longitud: null,
              link_web: 'https://junin.gob.ar',
              logo_url: '',
              horario_json: [],
            },
          },
          organization_branding: brandingSnapshot(),
        };
      }
      if (path.startsWith('/api/app/backoffice/navigation')) {
        return { contract_version: 'backoffice.navigation.v1', modules: [] };
      }
      return {};
    });

    window.history.replaceState({}, '', '/perfil?section=identity&tenant_slug=junin');
    render(
      <BrowserRouter>
        <Perfil />
      </BrowserRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Paleta del espacio' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Verde Junín/i }));
    await user.click(screen.getByRole('button', { name: /Publicar/i }));

    await waitFor(() => {
      expect(putCalls).toHaveLength(1);
    });
    expect(putCalls[0]).toEqual({
      organization_branding: {
        operation: 'publish',
        values: {
          enabled: true,
          primary_color: '#346600',
          accent_color: '#98C400',
        },
      },
      expected_revision: 'a'.repeat(64),
    });
    expect(await screen.findByText(/Paleta publicada correctamente \(versión 3\)/i)).toBeInTheDocument();
  });

  it('keeps Paleta del espacio read-only with backend message when branding can_edit is false', async () => {
    runtime.apiFetch.mockImplementation(async (path: string) => {
      if (path === '/api/v2/tenants/junin/activation/channels') {
        return {
          contract_version: 'tenant.channel_activation.v1',
          tenant: { id: 909, slug: 'junin', plan: 'pro' },
          integration_access: { enabled: true, status: 'enabled', current_plan: 'pro' },
          channels: [],
        };
      }
      if (path === '/api/admin/tenants/junin/config') {
        return {
          tenant: { id: 909, slug: 'junin', tipo: 'municipio', plan: 'pro' },
          organization_profile: {
            contract_version: 'organization.profile_settings.v1',
            tenant: { id: 909, slug: 'junin' },
            revision: 'f'.repeat(64),
            can_edit: true,
            editability: { mode: 'editable' },
            values: {
              nombre_empresa: 'Municipalidad de Junín',
              telefono: '+542634000000',
              direccion: 'Av. Mitre 100',
              ciudad: 'Junín',
              provincia: 'Mendoza',
              pais: 'Argentina',
              latitud: null,
              longitud: null,
              link_web: 'https://junin.gob.ar',
              logo_url: '',
              horario_json: [],
            },
          },
          organization_branding: brandingSnapshot({
            can_edit: false,
            reason_code: 'branding_full_required',
            message: 'La paleta personalizada está disponible en el plan Full.',
          }),
        };
      }
      if (path.startsWith('/api/app/backoffice/navigation')) {
        return { contract_version: 'backoffice.navigation.v1', modules: [] };
      }
      return {};
    });

    window.history.replaceState({}, '', '/perfil?section=identity&tenant_slug=junin');
    render(
      <BrowserRouter>
        <Perfil />
      </BrowserRouter>,
    );

    expect(
      await screen.findByText('La paleta personalizada está disponible en el plan Full.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Usar la paleta de la organización/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Publicar/i })).toBeDisabled();
  });
});
