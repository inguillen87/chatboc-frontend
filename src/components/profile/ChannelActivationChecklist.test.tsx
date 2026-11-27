import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ChannelActivationChecklist from './ChannelActivationChecklist';
import { fetchTenantChannelActivation } from '@/api/v2/channelActivation';
vi.mock('@/hooks/useUser', () => ({ useUser: () => ({
  user: { id: 1, rol: 'admin' }, hasVerifiedSession: true, organizationProfileVerified: true, loading: false,
}) }));

vi.mock('@/api/v2/channelActivation', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/api/v2/channelActivation')>(),
  fetchTenantChannelActivation: vi.fn(),
}));

const activationPayload = {
  contract_version: 'tenant.channel_activation.v1' as const,
  tenant: { slug: 'junin', nombre: 'Municipalidad de Junin', plan: 'free' },
  summary: {
    total: 7,
    ready: 1,
    locked: 2,
    attention: 4,
    progress: 14,
    health_label: 'Activacion en progreso',
    primary_next_action: { id: 'connect_whatsapp', label: 'Conectar WhatsApp', href: '/t/junin/integracion' },
  },
  integration_access: {
    enabled: false,
    status: 'partial',
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
      id: 'identity_auth',
      label: 'Identidad y login social',
      status: 'pending',
      description: 'Portal, Clerk y avatar consentido.',
      evidence: ['tenant vinculado a Clerk', 'JWT/JWKS configurado'],
      reason_code: 'clerk_webhook_recommended',
      progress_hint: 'Configurar CLERK_WEBHOOK_SECRET para sincronizar altas, bajas y cambios de email.',
      actions: [{ id: 'open_profile', label: 'Abrir perfil', href: '/perfil', primary: true }],
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
      id: 'public_intake_security',
      label: 'Proteccion publica',
      status: 'action_required',
      description: 'Cloudflare Turnstile para cargas anonimas de marketplace y encuestas.',
      evidence: ['protege marketplace asistido', 'enforcement pendiente'],
      reason_code: 'turnstile_config_missing',
      progress_hint: 'Configurar Cloudflare Turnstile antes de exigir desafio publico.',
      actions: [{ id: 'configure_turnstile', label: 'Configurar Cloudflare', href: '/t/junin/integracion', primary: true }],
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

const fullActivationPayload = {
  ...activationPayload,
  tenant: { ...activationPayload.tenant, plan: 'full' },
  integration_access: {
    ...activationPayload.integration_access,
    enabled: true,
    status: 'enabled',
    current_plan: 'full',
    required_plan: 'full',
  },
};

describe('ChannelActivationChecklist', () => {
  beforeEach(() => {
    vi.mocked(fetchTenantChannelActivation).mockReset();
    vi.mocked(fetchTenantChannelActivation).mockResolvedValue(activationPayload);
  });

  it('renders the activation contract with progress, statuses and CTAs', async () => {
    render(<ChannelActivationChecklist tenantSlug="junin" />);

    expect(await screen.findByRole('heading', { name: /preparación para empezar/i })).toBeInTheDocument();
    expect(screen.getByText('14%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /progreso de la preparación/i })).toBeInTheDocument();
    expect(screen.getByText(/1 de 7 pasos listos/i)).toBeInTheDocument();
    expect(screen.getByText(/configuración guiada disponible/i)).toBeInTheDocument();
    expect(screen.getByText('Personas y casos')).toBeInTheDocument();
    expect(screen.getByText('Identidad y inicio de sesión')).toBeInTheDocument();
    const identitySupport = screen.getByText(/Configurar CLERK_WEBHOOK_SECRET/i).closest('details');
    expect(identitySupport).not.toBeNull();
    expect(identitySupport).not.toHaveAttribute('open');
    expect(screen.getByText('WhatsApp Business')).toBeInTheDocument();
    expect(screen.getByText('Proteccion publica')).toBeInTheDocument();
    expect(screen.getByText(/Configurar Cloudflare Turnstile/i)).toBeInTheDocument();
    expect(screen.getByText('Cobros y pago en línea')).toBeInTheDocument();
    expect(screen.getByText('Equipo y responsables')).toBeInTheDocument();
    expect(screen.getAllByText(/requiere plan full/i)).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: /conectar whatsapp/i })[0]).toHaveAttribute(
      'href',
      '/t/junin/integracion?tenant_slug=junin&return_to=%2Fimplementacion%3Ftenant_slug%3Djunin',
    );
    expect(screen.getByRole('link', { name: /configurar cloudflare/i })).toHaveAttribute('href', '/t/junin/integracion?tenant_slug=junin&return_to=%2Fimplementacion%3Ftenant_slug%3Djunin');
    expect(screen.getByRole('link', { name: /configurar cobros/i })).toHaveAttribute('href', '/t/junin/integracion?tenant_slug=junin&return_to=%2Fimplementacion%3Ftenant_slug%3Djunin');
    expect(screen.getByRole('link', { name: /configurar equipo/i })).toHaveAttribute('href', '/perfil?tab=empleados&tenant_slug=junin&return_to=%2Fimplementacion%3Ftenant_slug%3Djunin');
  });

  it('refreshes the contract from the current tenant', async () => {
    render(<ChannelActivationChecklist tenantSlug="junin" initialData={activationPayload} />);

    await waitFor(() => expect(fetchTenantChannelActivation).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: /actualizar/i }));

    await waitFor(() => expect(fetchTenantChannelActivation).toHaveBeenCalledTimes(2));
    expect(fetchTenantChannelActivation).toHaveBeenLastCalledWith('junin', { isCurrent: expect.any(Function) });
  });

  it('hides catalog and order preparation when those modules are not enabled', async () => {
    render(
      <ChannelActivationChecklist
        tenantSlug="junin"
        initialData={activationPayload}
        catalogEnabled={false}
        ordersEnabled={false}
      />,
    );

    await screen.findByRole('heading', { name: /preparación para empezar/i });
    expect(screen.queryByText('Catalogo y marketplace')).not.toBeInTheDocument();
    expect(screen.queryByText('Cobros y pago en línea')).not.toBeInTheDocument();
    expect(screen.queryByText('Proteccion publica')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /cargar catalogo|configurar cobros/i })).not.toBeInTheDocument();
    expect(screen.getByText(/1 de 4 pasos listos/i)).toBeInTheDocument();
  });

  it('shows a product fallback when the activation endpoint is temporarily unavailable', async () => {
    vi.mocked(fetchTenantChannelActivation).mockRejectedValueOnce(new Error('Failed to fetch'));

    render(<ChannelActivationChecklist tenantSlug="junin" />);

    expect(await screen.findByText(/no pudimos actualizar los pasos de preparación/i)).toBeInTheDocument();
    expect(screen.getByText(/todavía no hay pasos para mostrar/i)).toBeInTheDocument();
    expect(screen.getByText(/falta recibir la lista de pasos/i)).toBeInTheDocument();
    expect(screen.queryByText('Failed to fetch')).not.toBeInTheDocument();
  });

  it('replaces a stale session plan when the verified profile snapshot arrives', async () => {
    vi.mocked(fetchTenantChannelActivation).mockRejectedValue(new Error('temporarily unavailable'));
    const { rerender } = render(
      <ChannelActivationChecklist tenantSlug="junin" initialData={activationPayload} />,
    );

    await screen.findByText(/no pudimos actualizar los pasos de preparación/i);
    expect(screen.getByText(/^plan free$/i)).toBeInTheDocument();

    rerender(
      <ChannelActivationChecklist tenantSlug="junin" initialData={fullActivationPayload} />,
    );

    await waitFor(() => expect(screen.getByText(/^plan full$/i)).toBeInTheDocument());
    expect(screen.queryByText(/^plan free$/i)).not.toBeInTheDocument();
  });

  it('renders reusable government workstreams published by the backend', async () => {
    vi.mocked(fetchTenantChannelActivation).mockResolvedValueOnce({
      contract_version: 'tenant.channel_activation.v1',
      tenant: { slug: 'gobierno-demo', nombre: 'Gobierno Demo', plan: 'enterprise' },
      summary: { total: 3, ready: 0, progress: 0 },
      channels: [
        {
          id: 'institutional_branding',
          label: 'Identidad institucional',
          status: 'action_required',
          description: 'Marca y superficies públicas.',
        },
        {
          id: 'accessibility',
          label: 'Accesibilidad',
          status: 'pending',
          description: 'Preferencias y validación accesible.',
        },
        {
          id: 'territorial_intelligence',
          label: 'Inteligencia territorial',
          status: 'blocked',
          description: 'Cobertura y fuentes geográficas.',
        },
      ],
    });

    render(<ChannelActivationChecklist tenantSlug="gobierno-demo" />);

    expect(await screen.findByText('Identidad institucional')).toBeInTheDocument();
    expect(screen.getByText('Accesibilidad')).toBeInTheDocument();
    expect(screen.getByText('Inteligencia territorial')).toBeInTheDocument();
  });

  it('never invents a launch route from channels and confines unknowns to folded technical detail', async () => {
    vi.mocked(fetchTenantChannelActivation).mockResolvedValueOnce({
      contract_version: 'tenant.channel_activation.v1',
      tenant: { slug: 'gobierno-demo', nombre: 'Gobierno Demo' },
      channels: [{
        id: 'future_provider_channel',
        label: 'Canal futuro no clasificado',
        status: 'ready',
        ready: true,
        description: 'Dato técnico aditivo.',
      }],
      implementation_journey: null,
    });

    render(
      <ChannelActivationChecklist
        tenantSlug="gobierno-demo"
        presentation="launch-journey"
      />,
    );

    expect(await screen.findByRole('heading', { name: /ruta de salida no publicada/i })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: /etapas de implementación/i })).not.toBeInTheDocument();
    const details = screen.getByTestId('implementation-technical-details');
    expect(within(details).getByText('Canal futuro no clasificado')).toBeInTheDocument();
    expect(details).not.toHaveAttribute('open');
  });

  it('does not label a network failure as an unpublished launch route', async () => {
    vi.mocked(fetchTenantChannelActivation).mockRejectedValueOnce(new Error('Failed to fetch'));

    render(
      <ChannelActivationChecklist
        tenantSlug="gobierno-demo"
        presentation="launch-journey"
      />,
    );

    expect(await screen.findByRole('heading', { name: /estado de la ruta no disponible/i })).toBeInTheDocument();
    expect(screen.getByTestId('tenant-launch-journey')).toHaveAttribute('data-state', 'unavailable');
    expect(screen.queryByRole('heading', { name: /ruta de salida no publicada/i })).not.toBeInTheDocument();
  });
});
