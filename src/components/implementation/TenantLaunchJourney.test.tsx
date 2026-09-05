import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { TenantImplementationJourneyContract } from '@/api/v2/channelActivation';
import TenantLaunchJourney, { buildTenantJourneyHref } from './TenantLaunchJourney';

const nextAction = {
  id: 'configure_channels',
  label: 'Configurar canales',
  href: '/integracion?tab=channels&tenant_slug=otro&return_to=https://example.com',
  kind: 'link' as const,
  primary: true,
};

const journey: TenantImplementationJourneyContract = {
  contract_version: 'tenant.implementation_journey.v1',
  stages: [
    {
      id: 'identity',
      label: 'Identidad institucional',
      description: 'Marca y dominio institucional.',
      status: 'ready',
      ready: true,
      published: true,
      source_ids: ['institutional_branding'],
      evidence: ['Marca configurada'],
      reason_codes: [],
      primary_action: null,
    },
    {
      id: 'channels',
      label: 'Canales',
      description: 'WhatsApp, widget y atención humana.',
      status: 'action_required',
      ready: false,
      published: true,
      source_ids: ['whatsapp', 'widget'],
      evidence: [],
      reason_codes: ['sender_required'],
      primary_action: nextAction,
    },
    {
      id: 'knowledge',
      label: 'Conocimiento',
      description: 'Fuentes institucionales verificadas.',
      status: 'pending',
      ready: false,
      published: true,
      source_ids: ['catalog_marketplace'],
      evidence: [],
      reason_codes: [],
      primary_action: null,
    },
    {
      id: 'team',
      label: 'Equipo',
      description: 'Responsables, permisos y derivaciones.',
      status: 'blocked',
      ready: false,
      published: true,
      source_ids: ['team_routing'],
      evidence: [],
      reason_codes: ['team_required'],
      primary_action: null,
    },
    {
      id: 'validation',
      label: 'Validación y salida',
      description: 'Pruebas, evidencias y habilitación.',
      status: 'not_published',
      ready: false,
      published: false,
      source_ids: ['public_intake_security'],
      evidence: [],
      reason_codes: ['not_published'],
      primary_action: null,
    },
  ],
  summary: {
    total: 5,
    ready: 1,
    blocked: 1,
    published: 4,
    progress: 20,
    current_stage_id: 'channels',
    next_action: nextAction,
  },
};

describe('TenantLaunchJourney', () => {
  it('keeps the authoritative order, expands the first incomplete stage and exposes one primary action', () => {
    render(<TenantLaunchJourney tenantSlug="junin" journey={journey} />);

    const list = screen.getByRole('list', { name: /etapas de implementación/i });
    expect(within(list).getAllByRole('button').map((button) => button.textContent)).toEqual([
      expect.stringContaining('Identidad institucional'),
      expect.stringContaining('Canales'),
      expect.stringContaining('Conocimiento'),
      expect.stringContaining('Equipo'),
      expect.stringContaining('Validación y salida'),
    ]);
    expect(screen.getByRole('button', { name: /canales/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /identidad institucional/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('region', { name: /detalle de canales/i })).toHaveTextContent(/whatsapp, widget/i);

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName(/configurar canales/i);
    expect(links[0]).toHaveAttribute(
      'href',
      '/integracion?tab=channels&tenant_slug=junin&return_to=%2Fimplementacion%3Ftenant_slug%3Djunin',
    );
  });

  it('keeps every other stage compact until the operator asks for its detail', () => {
    render(<TenantLaunchJourney tenantSlug="junin" journey={journey} />);

    expect(screen.queryByRole('region', { name: /detalle de conocimiento/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /conocimiento/i }));
    expect(screen.getByRole('region', { name: /detalle de conocimiento/i })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /detalle de canales/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /configurar canales/i })).not.toBeInTheDocument();
  });

  it('shows an unpublished route without inferring steps and keeps unknown channels in technical detail', () => {
    render(
      <TenantLaunchJourney
        tenantSlug="junin"
        journey={null}
        technicalDetails={<p>Canal experimental no clasificado</p>}
      />,
    );

    expect(screen.getByRole('heading', { name: /ruta de salida no publicada/i })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: /etapas de implementación/i })).not.toBeInTheDocument();
    const details = screen.getByTestId('implementation-technical-details');
    expect(within(details).getByText(/canal experimental no clasificado/i)).toBeInTheDocument();
    expect(details).not.toHaveAttribute('open');
  });

  it('does not navigate when the authoritative action is not an internal tenant-safe link', () => {
    const unsafeJourney: TenantImplementationJourneyContract = {
      ...journey,
      stages: journey.stages.map((stage) => stage.id === 'channels'
        ? { ...stage, primary_action: { ...nextAction, href: '/t/otro/integracion' } }
        : stage),
      summary: { ...journey.summary, next_action: { ...nextAction, href: '/t/otro/integracion' } },
    };

    render(<TenantLaunchJourney tenantSlug="junin" journey={unsafeJourney} />);

    expect(screen.queryByRole('link', { name: /configurar canales/i })).not.toBeInTheDocument();
    expect(screen.getByText(/enlace interno seguro/i)).toBeInTheDocument();
  });
});

describe('buildTenantJourneyHref', () => {
  it('rejects external, protocol-relative and cross-tenant destinations', () => {
    expect(buildTenantJourneyHref('https://example.com', 'junin')).toBeNull();
    expect(buildTenantJourneyHref('//example.com/path', 'junin')).toBeNull();
    expect(buildTenantJourneyHref('/t/otro/integracion', 'junin')).toBeNull();
  });
});
