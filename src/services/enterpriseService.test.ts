import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.fn();

vi.mock('@/utils/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

import { enterpriseService } from '@/services/enterpriseService';

describe('enterpriseService demo endpoints', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockResolvedValue({});
  });

  it('requests demo catalog without tenant scope params', async () => {
    await enterpriseService.getDemoCatalog();

    expect(apiFetchMock).toHaveBeenCalledWith('/auth/demo/catalog', {
      skipAuth: true,
      omitTenant: true,
    });
  });

  it('posts demo login payload without tenant scope params', async () => {
    await enterpriseService.demoLoginWithPayload({ rubro: 'municipio' });

    expect(apiFetchMock).toHaveBeenCalledWith('/auth/demo', {
      method: 'POST',
      body: { rubro: 'municipio' },
      skipAuth: true,
      omitTenant: true,
    });
  });
});
