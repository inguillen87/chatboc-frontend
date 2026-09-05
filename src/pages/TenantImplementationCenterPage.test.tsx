import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TenantImplementationCenterPage from '@/pages/TenantImplementationCenterPage';

const pageState = vi.hoisted(() => ({
  currentSlug: 'gobierno-demo' as string | null,
  tenant: { nombre: 'Gobierno Demo' } as { nombre?: string | null } | null,
  loading: false,
  user: {
    tenant_slug: 'gobierno-demo',
    channel_activation: {
      contract_version: 'tenant.channel_activation.v1',
      tenant: { slug: 'gobierno-demo', nombre: 'Gobierno Demo' },
      channels: [],
    },
  } as any,
}));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({
    currentSlug: pageState.currentSlug,
    tenant: pageState.tenant,
  }),
}));

vi.mock('@/hooks/useUser', () => ({
  useUser: () => ({
    user: pageState.user,
    loading: pageState.loading,
  }),
}));

vi.mock('@/components/profile/ChannelActivationChecklist', () => ({
  default: ({ tenantSlug, initialData, highlighted }: any) => (
    <div
      data-testid="channel-activation-checklist"
      data-tenant-slug={tenantSlug || ''}
      data-initial-tenant={initialData?.tenant?.slug || ''}
      data-highlighted={highlighted ? 'true' : 'false'}
    >
      Contrato de implementación
    </div>
  ),
}));

const renderPage = (entry = '/implementacion') => render(
  <MemoryRouter initialEntries={[entry]}>
    <TenantImplementationCenterPage />
  </MemoryRouter>,
);

describe('TenantImplementationCenterPage', () => {
  beforeEach(() => {
    pageState.currentSlug = 'gobierno-demo';
    pageState.tenant = { nombre: 'Gobierno Demo' };
    pageState.loading = false;
    pageState.user = {
      tenant_slug: 'gobierno-demo',
      channel_activation: {
        contract_version: 'tenant.channel_activation.v1',
        tenant: { slug: 'gobierno-demo', nombre: 'Gobierno Demo' },
        channels: [],
      },
    };
  });

  it('uses the authorized tenant contract without inventing readiness', () => {
    renderPage('/implementacion?tenant_slug=gobierno-demo');

    expect(screen.getByRole('heading', { name: /preparar la solución para operar/i })).toBeInTheDocument();
    expect(screen.getByText(/un frente no publicado nunca se presenta como listo/i)).toBeInTheDocument();
    expect(screen.getByText(/sin estados inferidos/i)).toBeInTheDocument();
    expect(screen.getByTestId('channel-activation-checklist')).toHaveAttribute('data-tenant-slug', 'gobierno-demo');
    expect(screen.getByTestId('channel-activation-checklist')).toHaveAttribute('data-initial-tenant', 'gobierno-demo');
  });

  it('does not reuse a session snapshot from another tenant', () => {
    pageState.user.channel_activation.tenant = {
      slug: 'otro-tenant',
      nombre: 'Otro tenant',
    };

    renderPage('/implementacion?tenant_slug=gobierno-demo');

    expect(screen.getByTestId('channel-activation-checklist')).toHaveAttribute('data-tenant-slug', 'gobierno-demo');
    expect(screen.getByTestId('channel-activation-checklist')).toHaveAttribute('data-initial-tenant', '');
  });

  it('fails closed when tenant query parameters conflict', () => {
    renderPage('/implementacion?tenant=gobierno-demo&tenant_slug=organizacion-demo');

    expect(screen.getByRole('alert')).toHaveTextContent(/no pudimos validar el espacio de trabajo/i);
    expect(screen.queryByTestId('channel-activation-checklist')).not.toBeInTheDocument();
  });
});
