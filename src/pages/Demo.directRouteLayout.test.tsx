import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

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

  it('keeps the workspace shell stable and reloads the admin preview with a persisted selection', async () => {
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
    expect(screen.getByTestId('demo-direct-loading-shell')).toHaveClass('min-h-[520px]', 'xl:min-h-[680px]');
    expect(document.querySelector('[data-demo-workspace-shell]')).toHaveClass('xl:min-h-[720px]');
    expect(document.querySelector('[data-demo-admin-shell]')).toHaveClass('xl:min-h-[680px]');
    expect(screen.getByTestId('demo-workspace')).toHaveAttribute('data-sector', 'gobierno');
    expect(screen.getByTestId('demo-workspace')).toHaveAttribute('data-loading', 'true');
    expect(screen.getByText('Demo completa')).toBeInTheDocument();
    expect(screen.queryByTestId('demo-sector-selector')).not.toBeInTheDocument();
    expect(screen.queryByTestId('demo-rubro-selector')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(demoApiMocks.getDemoAdminPreview).toHaveBeenCalledWith(
        expect.objectContaining({
          sector: 'gobierno',
          tenant_slug: 'junin',
          presentation_mode: 'executive',
        }),
      );
      expect(demoApiMocks.createDemoSession).toHaveBeenCalledWith(
        expect.objectContaining({
          sector: 'gobierno',
          rubro: 'municipio',
          tenant_slug: 'junin',
        }),
      );
    });

    await act(async () => {
      resolvePreview(preview);
    });

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Panel demo para gestión ciudadana' }),
    ).toBeVisible();

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
      expect(screen.getByTestId('demo-route-shell')).toHaveAttribute('data-demo-route-state', 'ready');
      expect(screen.getByTestId('demo-workspace')).toHaveAttribute('data-loading', 'false');
    });
    expect(screen.getByRole('heading', { level: 2, name: 'Panel demo para gestión ciudadana' })).toBeVisible();
  });
});
