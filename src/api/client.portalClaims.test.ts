import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.fn();

vi.mock('@/utils/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  ApiError: class ApiError extends Error {},
}));

import { apiClient } from '@/api/client';

describe('apiClient portal claims contract', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('loads authenticated claims from the backend claims endpoint', async () => {
    const claims = [
      {
        id: '42',
        title: 'Alumbrado publico',
        description: 'La luminaria no funciona',
        status: 'en_proceso',
        date: '2026-07-10T12:00:00Z',
        updated_at: '2026-07-11T09:30:00Z',
      },
    ];
    apiFetchMock.mockResolvedValueOnce(claims);

    await expect(apiClient.listClaims('junin')).resolves.toEqual(claims);
    expect(apiFetchMock).toHaveBeenCalledWith('/api/v1/portal/junin/claims', {
      tenantSlug: 'junin',
    });
  });
});
