import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ChannelActivationChecklist from './ChannelActivationChecklist';
import { fetchTenantChannelActivation } from '@/api/v2/channelActivation';

vi.mock('@/api/v2/channelActivation', () => ({
  fetchTenantChannelActivation: vi.fn(),
}));

const activationPayload = {
  contract_version: 'tenant.channel_activation.v1' as const,
  tenant: { slug: 'junin', nombre: 'Municipalidad de Junin', plan: 'free' },
  summary: {
    total: 5,
    ready: 1,
    locked: 2,
    attention: 2,
    progress: 20,
    health_label: 'Activacion en progreso',
    primary_next_action: { id: 'connect_whatsapp', label: 'Conectar WhatsApp', href: '/t/junin/integracion' },
  },
  integration_access: {
    enabled: false,
    current_plan: 'free',
    required_plan: 'full',
    message: 'Requiere plan Full.',
  },
  channels: [
    {
      id: 'crm',
      label: 'CRM operativo',
      status: 'ready',
      ready: true,
      description: 'Bandeja activa.',
      actions: [{ id: 'open_crm', label: 'Abrir reclamos/tickets', href: '/perfil?tab=tickets', primary: true }],
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp Business',
      status: 'locked',
      locked: true,
      description: 'Sender productivo.',
      required_plan: 'full',
      actions: [{ id: 'connect_whatsapp', label: 'Conectar WhatsApp', href: '/t/junin/integracion', primary: true }],
    },
    {
      id: 'payments_checkout',
      label: 'Cobros y checkout',
      status: 'locked',
      locked: true,
      description: 'Links de pago y webviews seguros.',
      required_plan: 'full',
      actions: [{ id: 'configure_payments', label: 'Configurar cobros', href: '/t/junin/integracion', primary: true }],
    },
    {
      id: 'team_routing',
      label: 'Equipo y responsables',
      status: 'action_required',
      description: 'Operadores y categorias.',
      actions: [{ id: 'open_team', label: 'Configurar equipo', href: '/perfil?tab=empleados', primary: true }],
    },
    {
      id: 'catalog_marketplace',
      label: 'Catalogo y marketplace',
      status: 'action_required',
      description: 'Catalogo inicial.',
      actions: [{ id: 'open_catalog', label: 'Cargar catalogo', href: '/perfil?tab=catalogo', primary: true }],
    },
  ],
};

describe('ChannelActivationChecklist', () => {
  beforeEach(() => {
    vi.mocked(fetchTenantChannelActivation).mockReset();
    vi.mocked(fetchTenantChannelActivation).mockResolvedValue(activationPayload);
  });

  it('renders the activation contract with progress, statuses and CTAs', async () => {
    render(<ChannelActivationChecklist tenantSlug="junin" />);

    expect(await screen.findByRole('heading', { name: /activacion de canales/i })).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
    expect(screen.getByText(/1 de 5 frentes listos/i)).toBeInTheDocument();
    expect(screen.getByText('CRM operativo')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp Business')).toBeInTheDocument();
    expect(screen.getByText('Cobros y checkout')).toBeInTheDocument();
    expect(screen.getByText('Equipo y responsables')).toBeInTheDocument();
    expect(screen.getAllByText(/requiere plan full/i)).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: /conectar whatsapp/i })[0]).toHaveAttribute(
      'href',
      '/t/junin/integracion',
    );
    expect(screen.getByRole('link', { name: /configurar cobros/i })).toHaveAttribute('href', '/t/junin/integracion');
    expect(screen.getByRole('link', { name: /configurar equipo/i })).toHaveAttribute('href', '/perfil?tab=empleados');
  });

  it('refreshes the contract from the current tenant', async () => {
    render(<ChannelActivationChecklist tenantSlug="junin" initialData={activationPayload} />);

    await waitFor(() => expect(fetchTenantChannelActivation).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: /actualizar/i }));

    await waitFor(() => expect(fetchTenantChannelActivation).toHaveBeenCalledTimes(2));
    expect(fetchTenantChannelActivation).toHaveBeenLastCalledWith('junin');
  });

  it('shows a product fallback when the activation endpoint is temporarily unavailable', async () => {
    vi.mocked(fetchTenantChannelActivation).mockRejectedValueOnce(new Error('Failed to fetch'));

    render(<ChannelActivationChecklist tenantSlug="junin" />);

    expect(await screen.findByText(/no pudimos sincronizar los canales ahora/i)).toBeInTheDocument();
    expect(screen.getByText(/sincronizacion pendiente/i)).toBeInTheDocument();
    expect(screen.getByText(/esperando sincronizacion del backend/i)).toBeInTheDocument();
    expect(screen.queryByText('Failed to fetch')).not.toBeInTheDocument();
  });
});
