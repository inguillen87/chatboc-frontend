import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { DEMO_TENANT_STORAGE_KEY } from '@/features/demo/demoStorage';
import Demo from './Demo';

const demoApiMocks = vi.hoisted(() => ({
  createDemoSession: vi.fn(),
  getDemoAdminPreview: vi.fn(),
  getDemoCatalog: vi.fn(),
}));

vi.mock('@/features/demo/demoApi', () => demoApiMocks);

vi.mock('@/features/demo/DemoWorkspace', () => ({
  default: ({ loading, sector }: { loading?: boolean; sector?: string | null }) => (
    <div data-testid="demo-workspace" data-loading={String(Boolean(loading))} data-sector={sector ?? ''}>
      Workspace
    </div>
  ),
}));

vi.mock('@/features/demo/DemoSectorStep', () => ({
  default: () => <div data-testid="demo-sector-selector">Selector de sector</div>,
}));

vi.mock('@/features/demo/WhatsappSandboxLauncher', () => ({
  default: () => <div>WhatsApp sandbox</div>,
}));

vi.mock('@/components/chat/RubroSelector', () => ({
  default: () => <div data-testid="demo-rubro-selector">Selector de rubro</div>,
}));

vi.mock('@/components/MapLibreMap', () => ({
  default: () => <div>Mapa</div>,
}));

const catalog = {
  sectors: ['gobierno'],
  sector_groups: [
    {
      key: 'gobierno',
      label: 'Gobierno',
      tenant_slug: 'junin',
      default_rubro: 'municipio',
    },
  ],
  rubros: [
    {
      id: 1,
      clave: 'municipio',
      nombre: 'Municipio',
      sector: 'gobierno',
      tenant_slug: 'junin',
      session_payload: { tenant_slug: 'junin' },
    },
  ],
};

const preview = {
  contract_version: 'demo.admin_preview.v1',
  sector: 'gobierno',
  title: 'Panel demo para gestión ciudadana',
  subtitle: 'Gobierno local',
  description: 'Operación demostrativa trazable.',
  modules: [{ id: 'summary', label: 'Resumen' }],
};

describe('Demo direct-route layout stability', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('hydrates a landing-created session without racing back to the generic selector', async () => {
    demoApiMocks.getDemoCatalog.mockResolvedValue(catalog);
    demoApiMocks.createDemoSession.mockResolvedValue({});
    demoApiMocks.getDemoAdminPreview.mockResolvedValue(preview);

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/demo',
            search: '?session=sid_landing_colegio',
            state: {
              demoSession: {
                chat_session_id: 'sid_landing_colegio',
                tenant_slug: 'colegio-demo',
                workspace: {
                  title: 'Demo Workspace',
                  chat_bootstrap: { same_origin_endpoint: '/api/v2/demo/chat' },
                },
              },
              sector: 'educacion',
              rubroLabel: 'Colegios',
              rubroSlug: 'educacion',
            },
          },
        ]}
      >
        <Demo />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('demo-route-shell')).toHaveAttribute('data-demo-route-state', 'ready');
      expect(screen.getByTestId('demo-workspace')).toHaveAttribute('data-sector', 'educacion');
    });
    expect(screen.queryByTestId('demo-sector-selector')).not.toBeInTheDocument();
    expect(screen.queryByTestId('demo-rubro-selector')).not.toBeInTheDocument();
    expect(demoApiMocks.getDemoCatalog).not.toHaveBeenCalled();
    expect(demoApiMocks.createDemoSession).not.toHaveBeenCalled();
  });

  it('keeps the workspace shell stable and reloads the admin preview with a persisted selection', async () => {
    let resolveSession!: (value: unknown) => void;
    let resolvePreview!: (value: unknown) => void;
    const sessionPromise = new Promise((resolve) => {
      resolveSession = resolve;
    });
    const previewPromise = new Promise((resolve) => {
      resolvePreview = resolve;
    });

    localStorage.setItem('demoSectorSeleccionado', 'empresas');
    localStorage.setItem('rubroSeleccionado', 'ferreteria');
    localStorage.setItem('rubroSeleccionado_label', 'Ferretería');
    localStorage.setItem(DEMO_TENANT_STORAGE_KEY, 'tenant-anterior');
    demoApiMocks.getDemoCatalog.mockResolvedValue(catalog);
    demoApiMocks.createDemoSession.mockReturnValue(sessionPromise);
    demoApiMocks.getDemoAdminPreview.mockReturnValue(previewPromise);

    render(
      <MemoryRouter
        initialEntries={['/demo?sector=gobierno&rubro=municipio&tenant_slug=junin&remote_preview_qa=1']}
      >
        <Demo />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('demo-route-shell')).toHaveAttribute('data-demo-route-state', 'loading');
    expect(screen.getByTestId('demo-direct-loading-shell')).toHaveClass('min-h-[28rem]');
    expect(document.querySelector('[data-demo-workspace-shell]')).toHaveClass('min-h-[32rem]');
    expect(document.querySelector('[data-demo-workspace-shell]')).not.toHaveClass('xl:min-h-[720px]');
    expect(document.querySelector('[data-demo-admin-shell]')).not.toHaveClass('xl:min-h-[680px]');
    expect(screen.getByTestId('demo-workspace')).toHaveAttribute('data-sector', 'gobierno');
    expect(screen.getByTestId('demo-workspace')).toHaveAttribute('data-loading', 'true');
    expect(screen.getByRole('heading', { name: 'Centro de gestión ciudadana' })).toBeInTheDocument();
    expect(screen.queryByTestId('demo-sector-selector')).not.toBeInTheDocument();
    expect(screen.queryByTestId('demo-rubro-selector')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(demoApiMocks.createDemoSession).toHaveBeenCalledWith(
        expect.objectContaining({
          sector: 'gobierno',
          rubro: 'municipio',
          tenant_slug: 'junin',
        }),
      );
    });
    expect(demoApiMocks.getDemoAdminPreview).not.toHaveBeenCalled();

    await act(async () => {
      resolveSession({
        tenant_slug: 'junin',
        workspace: {
          title: 'Gestión ciudadana',
          chat_bootstrap: { same_origin_endpoint: '/api/v2/demo/chat' },
        },
      });
    });

    await waitFor(() => {
      expect(demoApiMocks.getDemoAdminPreview).toHaveBeenCalledWith(
        expect.objectContaining({
          sector: 'gobierno',
          tenant_slug: 'junin',
          presentation_mode: 'executive',
        }),
      );
    });

    await act(async () => {
      resolvePreview(preview);
    });

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Panel demo para gestión ciudadana' }),
    ).toBeVisible();
    await waitFor(() => {
      expect(screen.getByTestId('demo-route-shell')).toHaveAttribute('data-demo-route-state', 'ready');
      expect(screen.getByTestId('demo-workspace')).toHaveAttribute('data-loading', 'false');
    });
    expect(screen.getByRole('heading', { level: 2, name: 'Panel demo para gestión ciudadana' })).toBeVisible();
  });

  it('restores the persisted tenant before warming a queryless demo preview', async () => {
    let resolveSession!: (value: unknown) => void;
    let resolvePreview!: (value: unknown) => void;
    const sessionPromise = new Promise((resolve) => {
      resolveSession = resolve;
    });
    const previewPromise = new Promise((resolve) => {
      resolvePreview = resolve;
    });

    localStorage.setItem('demoSectorSeleccionado', 'gobierno');
    localStorage.setItem('rubroSeleccionado', 'municipio');
    localStorage.setItem('rubroSeleccionado_label', 'Municipio');
    localStorage.setItem(DEMO_TENANT_STORAGE_KEY, 'junin');
    demoApiMocks.getDemoCatalog.mockResolvedValue(catalog);
    demoApiMocks.createDemoSession.mockReturnValue(sessionPromise);
    demoApiMocks.getDemoAdminPreview.mockReturnValue(previewPromise);

    render(
      <MemoryRouter initialEntries={['/demo']}>
        <Demo />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('demo-route-shell')).toHaveAttribute('data-demo-route-state', 'loading');
    expect(screen.getByTestId('demo-direct-loading-shell')).toBeInTheDocument();
    expect(screen.getByTestId('demo-workspace')).toHaveAttribute('data-sector', 'gobierno');
    expect(screen.getByTestId('demo-workspace')).toHaveAttribute('data-loading', 'true');
    expect(screen.queryByTestId('demo-sector-selector')).not.toBeInTheDocument();
    expect(screen.queryByTestId('demo-rubro-selector')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(demoApiMocks.createDemoSession).toHaveBeenCalledWith(
        expect.objectContaining({
          sector: 'gobierno',
          pillar: 'gobierno',
          rubro: 'municipio',
          tenant_slug: 'junin',
        }),
      );
    });
    expect(demoApiMocks.getDemoAdminPreview).not.toHaveBeenCalled();

    await act(async () => {
      resolveSession({
        tenant_slug: 'junin',
        workspace: {
          title: 'Gestión ciudadana',
          chat_bootstrap: { same_origin_endpoint: '/api/v2/demo/chat' },
        },
      });
    });

    await waitFor(() => {
      expect(demoApiMocks.getDemoAdminPreview).toHaveBeenCalledWith(
        expect.objectContaining({
          sector: 'gobierno',
          tenant_slug: 'junin',
          presentation_mode: 'executive',
        }),
      );
    });

    await act(async () => {
      resolvePreview(preview);
    });

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Panel demo para gestión ciudadana' }),
    ).toBeVisible();

    await waitFor(() => {
      expect(screen.getByTestId('demo-route-shell')).toHaveAttribute('data-demo-route-state', 'ready');
      expect(screen.getByTestId('demo-workspace')).toHaveAttribute('data-loading', 'false');
    });
    expect(screen.getByTestId('demo-workspace')).toHaveAttribute('data-sector', 'gobierno');
  });

  it('normalizes an invalid persisted tenant before the first queryless request', async () => {
    localStorage.setItem('demoSectorSeleccionado', 'gobierno');
    localStorage.setItem('rubroSeleccionado', 'municipio');
    localStorage.setItem('rubroSeleccionado_label', 'Municipio');
    localStorage.setItem(DEMO_TENANT_STORAGE_KEY, '../tenant-ajeno');
    demoApiMocks.getDemoCatalog.mockResolvedValue(catalog);
    demoApiMocks.createDemoSession.mockResolvedValue({
      tenant_slug: 'junin',
      workspace: {
        title: 'Gestión ciudadana',
        chat_bootstrap: { same_origin_endpoint: '/api/v2/demo/chat' },
      },
    });
    demoApiMocks.getDemoAdminPreview.mockResolvedValue(preview);

    render(
      <MemoryRouter initialEntries={['/demo']}>
        <Demo />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('demo-route-shell')).toHaveAttribute('data-demo-route-state', 'loading');
    expect(screen.queryByTestId('demo-sector-selector')).not.toBeInTheDocument();
    expect(screen.queryByTestId('demo-rubro-selector')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(demoApiMocks.createDemoSession).toHaveBeenCalledWith(
        expect.objectContaining({ tenant_slug: 'municipio' }),
      );
      expect(demoApiMocks.getDemoAdminPreview).toHaveBeenCalledWith(
        expect.objectContaining({ tenant_slug: 'junin' }),
      );
    });

    const requests = [
      ...demoApiMocks.createDemoSession.mock.calls,
      ...demoApiMocks.getDemoAdminPreview.mock.calls,
    ];
    expect(requests).not.toContainEqual([
      expect.objectContaining({ tenant_slug: '../tenant-ajeno' }),
    ]);
  });

  it.each([
    '/demo?sector=gobierno',
    '/demo?rubro=municipio',
    '/demo?tenant_slug=junin',
    '/demo?tenant=junin',
    '/demo?sector=gobierno&tenant_slug=junin',
    '/demo?rubro=municipio&tenant_slug=junin',
  ])('does not restore a conflicting persisted workspace for partial selection %s', async (entry) => {
    localStorage.setItem('demoSectorSeleccionado', 'empresas');
    localStorage.setItem('rubroSeleccionado', 'ferreteria');
    localStorage.setItem('rubroSeleccionado_label', 'Ferretería');
    localStorage.setItem(DEMO_TENANT_STORAGE_KEY, 'tenant-empresa');
    demoApiMocks.getDemoCatalog.mockResolvedValue(catalog);
    demoApiMocks.createDemoSession.mockResolvedValue({
      tenant_slug: 'tenant-empresa',
      workspace: { title: 'Workspace persistido que no debe abrirse' },
    });
    demoApiMocks.getDemoAdminPreview.mockResolvedValue(preview);

    render(
      <MemoryRouter initialEntries={[entry]}>
        <Demo />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('demo-sector-selector')).toBeInTheDocument();
    expect(screen.queryByTestId('demo-route-shell')).not.toBeInTheDocument();
    expect(screen.queryByTestId('demo-workspace')).not.toBeInTheDocument();
    expect(demoApiMocks.createDemoSession).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(demoApiMocks.getDemoCatalog).toHaveBeenCalled();
    });

    expect(demoApiMocks.createDemoSession).not.toHaveBeenCalled();
    expect(demoApiMocks.createDemoSession).not.toHaveBeenCalledWith(
      expect.objectContaining({
        sector: 'empresas',
        rubro: 'ferreteria',
        tenant_slug: 'tenant-empresa',
      }),
    );
  });
});
