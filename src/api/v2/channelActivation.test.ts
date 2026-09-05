import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchTenantChannelActivation,
  parseTenantChannelActivation,
} from '@/api/v2/channelActivation';
import { apiFetch } from '@/utils/api';

vi.mock('@/utils/api', () => ({
  apiFetch: vi.fn(),
}));

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
});
