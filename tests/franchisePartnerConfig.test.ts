import { afterEach, describe, expect, it, vi } from 'vitest';

describe('franchise partner config', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('reads partner metadata from env', async () => {
    vi.stubEnv('VITE_FRANCHISE_PARTNER_NAME', 'Chatboc Global Partners');
    vi.stubEnv('VITE_FRANCHISE_SALES_URL', 'https://partners.chatboc.com');

    const { getFranchisePartnerConfig } = await import('@/utils/franchisePartnerConfig');
    expect(getFranchisePartnerConfig()).toEqual({
      partnerName: 'Chatboc Global Partners',
      salesUrl: 'https://partners.chatboc.com',
    });
  });
});
