import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchTenantChannelActivation,
  parseTenantChannelActivation,
  parseTenantImplementationJourney,
} from '@/api/v2/channelActivation';
import { apiFetch } from '@/utils/api';

vi.mock('@/utils/api', () => ({
  apiFetch: vi.fn(),
}));

const journeyAction = {
  id: 'configure_channels',
  label: 'Configurar canales',
  href: '/integracion?tab=channels',
  kind: 'link' as const,
  primary: true,
};

const implementationJourney = {
  contract_version: 'tenant.implementation_journey.v1' as const,
  stages: [
    {
      id: 'identity',
      label: 'Identidad institucional',
      description: 'Marca y dominio.',
      status: 'ready' as const,
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
      description: 'WhatsApp y widget.',
      status: 'action_required' as const,
      ready: false,
      published: true,
      source_ids: ['whatsapp', 'widget'],
      evidence: [],
      reason_codes: ['sender_required'],
      primary_action: journeyAction,
    },
    {
      id: 'knowledge',
      label: 'Conocimiento',
      description: 'Contenido institucional.',
      status: 'pending' as const,
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
      description: 'Operadores y permisos.',
      status: 'blocked' as const,
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
      description: 'Pruebas de salida.',
      status: 'not_published' as const,
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
    next_action: journeyAction,
  },
};

describe('fetchTenantChannelActivation', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset().mockResolvedValue({
      contract_version: 'tenant.channel_activation.v1',
      tenant: { slug: 'gobierno-demo' },
      channels: [],
    } as never);
  });

  it('binds the explicit tenant to the versioned contract request', async () => {
    await fetchTenantChannelActivation('gobierno-demo');

    expect(apiFetch).toHaveBeenCalledWith(
      '/api/v2/tenants/gobierno-demo/activation/channels',
      { tenantSlug: 'gobierno-demo', persistTenantSlug: false, cache: 'no-store' },
    );
  });

  it('rejects a contract returned for a different tenant', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      contract_version: 'tenant.channel_activation.v1',
      tenant: { slug: 'otro-tenant' },
      channels: [],
    } as never);

    await expect(fetchTenantChannelActivation('gobierno-demo')).rejects.toThrow(
      'channel_activation_scope_mismatch',
    );
  });

  it('rejects an unknown contract version or malformed channel collection', () => {
    expect(() =>
      parseTenantChannelActivation({
        contract_version: 'tenant.channel_activation.v2',
        tenant: { slug: 'gobierno-demo' },
        channels: [],
      }, 'gobierno-demo'),
    ).toThrow('channel_activation_contract_invalid');

    expect(() =>
      parseTenantChannelActivation({
        contract_version: 'tenant.channel_activation.v1',
        tenant: { slug: 'gobierno-demo' },
        channels: {},
      }, 'gobierno-demo'),
    ).toThrow('channel_activation_contract_invalid');

    expect(() =>
      parseTenantChannelActivation({
        contract_version: 'tenant.channel_activation.v1',
        tenant: { slug: 'gobierno-demo' },
        channels: [{
          id: 'whatsapp',
          label: 'WhatsApp',
          status: 'pending',
          actions: { href: '/integracion' },
        }],
      }, 'gobierno-demo'),
    ).toThrow('channel_activation_contract_invalid');
  });

  it('accepts only the complete authoritative implementation journey and preserves its order', () => {
    const parsed = parseTenantImplementationJourney(implementationJourney);

    expect(parsed?.stages.map((stage) => stage.label)).toEqual([
      'Identidad institucional',
      'Canales',
      'Conocimiento',
      'Equipo',
      'Validación y salida',
    ]);
    expect(parsed?.summary.current_stage_id).toBe('channels');
  });

  it('keeps the channel contract usable but marks a malformed or missing journey unpublished', () => {
    const malformed = {
      ...implementationJourney,
      stages: implementationJourney.stages.map((stage) => stage.id === 'channels'
        ? { ...stage, ready: true }
        : stage),
    };

    expect(parseTenantImplementationJourney(malformed)).toBeNull();
    expect(parseTenantChannelActivation({
      contract_version: 'tenant.channel_activation.v1',
      tenant: { slug: 'gobierno-demo' },
      channels: [],
      implementation_journey: malformed,
    }, 'gobierno-demo').implementation_journey).toBeNull();
    expect(parseTenantChannelActivation({
      contract_version: 'tenant.channel_activation.v1',
      tenant: { slug: 'gobierno-demo' },
      channels: [],
    }, 'gobierno-demo').implementation_journey).toBeNull();
  });

  it('fails the optional journey closed when its summary contradicts the first incomplete stage', () => {
    expect(parseTenantImplementationJourney({
      ...implementationJourney,
      summary: { ...implementationJourney.summary, current_stage_id: 'knowledge' },
    })).toBeNull();

    expect(parseTenantImplementationJourney({
      ...implementationJourney,
      summary: { ...implementationJourney.summary, next_action: null },
    })).toBeNull();
  });
});
