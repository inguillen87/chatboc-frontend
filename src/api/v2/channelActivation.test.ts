import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchTenantChannelActivation } from '@/api/v2/channelActivation';
import { apiFetch } from '@/utils/api';

vi.mock('@/utils/api', () => ({
  apiFetch: vi.fn(),
}));

describe('fetchTenantChannelActivation', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset().mockResolvedValue({
      contract_version: 'tenant.channel_activation.v1',
    } as never);
  });

  it('binds the explicit tenant to the versioned contract request', async () => {
    await fetchTenantChannelActivation('junin');

    expect(apiFetch).toHaveBeenCalledWith(
      '/api/v2/tenants/junin/activation/channels',
      { tenantSlug: 'junin' },
    );
  });
});
