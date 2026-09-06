import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TenantProvisioningReadinessPanel from '@/components/implementation/TenantProvisioningReadinessPanel';

const readinessApi = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock('@/api/v2/tenantProvisioningReadiness', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/api/v2/tenantProvisioningReadiness')>();
  return {
    ...original,
    fetchTenantProvisioningReadiness: readinessApi.fetch,
  };
});

const completeReadiness = {
  contract_version: 'tenant.provisioning_readiness.v1' as const,
  readiness_scope: 'tenant_configuration' as const,
  generated_at: '2026-09-05T15:30:00+00:00',
  tenant: { id: 41, slug: 'gobierno-demo', tipo: 'municipio' },
  template_key: 'municipio_default',
  evaluated_stage: 'configuration_complete' as const,
  requires_revalidation: false,
  status: 'ready' as const,
  ready: true,
  production_ready: false,
  checks: {
    base_configuration_valid: true,
    branding_configuration_complete: true,
    operator_configuration_complete: true,
    service_content_configured: true,
    channel_verification_complete: true,
    provider_activation_performed: false,
  },
  configured_keys: ['contacts', 'links', 'menu', 'widget'],
  missing: [],
  next_action: 'review_activation' as const,
  evidence: {
    base_configuration: {
      required_keys: ['contacts', 'links', 'menu', 'widget'],
      configured_keys: ['contacts', 'links', 'menu', 'widget'],
      missing_keys: [],
    },
    branding: { logo_configured: true, palette_configured: true },
    operator_team: { members: 5, ticket_categories: 8, routed_members: 4 },
    service_content: { catalog_items: 12, menu_items: 6 },
    channels: {
      selected: ['widget'],
      verified: ['widget'],
      missing: [],
      complete: true,
      provider_activation_performed: false,
    },
  },
  safety: {
    server_derived: true as const,
    side_effects_performed: false as const,
    provider_calls_performed: false as const,
    production_cutover_assessed: false,
  },
};

const renderPanel = (tenantSlug = 'gobierno-demo') => render(
  <MemoryRouter>
    <TenantProvisioningReadinessPanel tenantSlug={tenantSlug} />
  </MemoryRouter>,
);

describe('TenantProvisioningReadinessPanel', () => {
  beforeEach(() => {
    readinessApi.fetch.mockReset().mockResolvedValue(completeReadiness);
  });

  it('separates complete configuration from a production certification that was not published', async () => {
    renderPanel();

    expect(screen.getByText(/validando la configuración/i)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /centro de implementación/i })).toBeInTheDocument();
    expect(screen.getByText('Configuración lista')).toBeInTheDocument();
    expect(screen.getByText('Producción no certificada')).toBeInTheDocument();
    expect(screen.getByTestId('tenant-provisioning-readiness')).toHaveAttribute('data-state', 'configuration-ready');
    expect(document.querySelectorAll('[data-readiness-block]')).toHaveLength(5);
    expect(screen.getByText('5 de 5 controles')).toBeInTheDocument();
    expect(screen.getByText(/consultar este panel no activa proveedores ni modifica datos/i)).toBeInTheDocument();
  });

  it('routes each operational action to an existing tenant-scoped screen', async () => {
    renderPanel();
    await screen.findByRole('heading', { name: /centro de implementación/i });

    for (const label of ['Marca', 'Equipo y enrutamiento', 'Contenido', 'Canales', 'Certificación']) {
      const summary = screen.getByText(label).closest('summary');
      expect(summary).not.toBeNull();
      fireEvent.click(summary!);
    }

    expect(screen.getByRole('link', { name: /abrir identidad visual/i })).toHaveAttribute(
      'href',
      '/perfil?tenant_slug=gobierno-demo&tab=perfil&section=identity',
    );
    expect(screen.getByRole('link', { name: /abrir equipo y permisos/i })).toHaveAttribute(
      'href',
      '/perfil?tenant_slug=gobierno-demo&tab=empleados',
    );
    expect(screen.getByRole('link', { name: /abrir servicios y catálogo/i })).toHaveAttribute(
      'href',
      '/perfil?tenant_slug=gobierno-demo&tab=catalogo',
    );
    expect(screen.getByRole('link', { name: /abrir configuración de canales/i })).toHaveAttribute(
      'href',
      '/perfil?tenant_slug=gobierno-demo&tab=perfil&section=channels&setup=channels',
    );
    expect(screen.getAllByRole('link', { name: /ver controles de salida/i })[0]).toHaveAttribute(
      'href',
      '/implementacion?tenant_slug=gobierno-demo#controles-salida',
    );
  });

  it('fails closed on an unavailable contract and recovers only after an explicit retry', async () => {
    readinessApi.fetch
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(completeReadiness);

    renderPanel();

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se muestra ningún frente como listo/i);
    expect(screen.getByTestId('tenant-provisioning-readiness')).toHaveAttribute('data-state', 'unavailable');
    expect(document.querySelectorAll('[data-readiness-block]')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(await screen.findByRole('heading', { name: /centro de implementación/i })).toBeInTheDocument();
    await waitFor(() => expect(readinessApi.fetch).toHaveBeenCalledTimes(2));
  });
});
