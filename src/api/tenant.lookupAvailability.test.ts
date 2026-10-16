import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/utils/api', () => ({
  apiFetch: (...args: unknown[]) => mocks.fetch(...args),
  ApiError: class extends Error {
    constructor(message: string, public status: number, public body?: unknown) {
      super(message);
    }
  },
}));

import { ApiError } from '@/utils/api';
import { getTenantPublicInfoFlexible } from './tenant';

const token = 'synthetic-widget-test';
const profile = {
  contract_version: 'public.tenant_profile.v1',
  tenant: { id: 7, slug: 'org-a', nombre: 'Organización A' },
};

beforeEach(() => { mocks.fetch.mockReset(); });

describe('public tenant lookup availability', () => {
  it.each([401, 403, 408, 409, 429, 500, 502, 503, 504])(
    'preserves HTTP %i without starting another lookup with a widget token',
    async status => {
      const error = new ApiError('Synthetic service failure', status);
      mocks.fetch.mockRejectedValue(error);

      await expect(getTenantPublicInfoFlexible('org-a', token)).rejects.toBe(error);

      expect(mocks.fetch).toHaveBeenCalledTimes(1);
      expect(mocks.fetch).toHaveBeenCalledWith(
        '/api/pwa/public/tenant-info?tenant=org-a',
        expect.objectContaining({ tenantSlug: 'org-a', skipAuth: true }),
      );
    },
  );

  it('preserves a network failure without making a token lookup', async () => {
    const error = new TypeError('Synthetic network failure');
    mocks.fetch.mockRejectedValue(error);
    await expect(getTenantPublicInfoFlexible('org-a', token)).rejects.toBe(error);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not mask an invalid response contract by repeating the lookup', async () => {
    mocks.fetch.mockResolvedValue({ ...profile, contract_version: 'unknown.v1' });
    await expect(getTenantPublicInfoFlexible('org-a', token)).rejects.toThrow('Contract version inválida');
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps the supported request-shape fallback for HTTP 400', async () => {
    mocks.fetch.mockRejectedValueOnce(new ApiError('Synthetic shape error', 400))
      .mockResolvedValueOnce(profile);
    await expect(getTenantPublicInfoFlexible('org-a', token)).resolves.toMatchObject({ slug: 'org-a' });
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(mocks.fetch).toHaveBeenNthCalledWith(
      2, `/api/pwa/public/tenant-info?tenant=org-a&widget_token=${token}`, expect.anything(),
    );
  });

  it.each([404, 405, 501])('keeps the compatible endpoint and token fallback for HTTP %i', async status => {
    mocks.fetch.mockRejectedValueOnce(new ApiError('Synthetic unsupported lookup', status))
      .mockRejectedValueOnce(new ApiError('Synthetic unsupported lookup', status))
      .mockRejectedValueOnce(new ApiError('Synthetic unsupported lookup', status))
      .mockResolvedValueOnce(profile);
    await expect(getTenantPublicInfoFlexible('org-a', token)).resolves.toMatchObject({ slug: 'org-a' });
    expect(mocks.fetch).toHaveBeenCalledTimes(4);
    expect(mocks.fetch).toHaveBeenNthCalledWith(
      4, `/api/pwa/public/tenant-info?tenant=org-a&widget_token=${token}`, expect.anything(),
    );
  });

  it('keeps structured resolution failures terminal even when a token is available', async () => {
    const error = new ApiError('Synthetic resolution failure', 400, {
      contract_version: 'pwa.public_tenant_resolution.v1', reason_code: 'tenant_resolution_failed',
    });
    mocks.fetch.mockRejectedValue(error);
    await expect(getTenantPublicInfoFlexible('org-a', token)).rejects.toBe(error);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not repeat a successful slug lookup', async () => {
    mocks.fetch.mockResolvedValue(profile);
    await expect(getTenantPublicInfoFlexible('org-a', token)).resolves.toMatchObject({ slug: 'org-a' });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it('retains a widget-only lookup when no slug was provided', async () => {
    mocks.fetch.mockResolvedValue(profile);
    await expect(getTenantPublicInfoFlexible(null, token)).resolves.toMatchObject({ slug: 'org-a' });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.fetch).toHaveBeenCalledWith(
      `/api/pwa/public/tenant-info?widget_token=${token}`, expect.anything(),
    );
  });
});
