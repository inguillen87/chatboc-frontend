import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.fn();

vi.mock('@/utils/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

import { tenantService } from '@/services/tenantService';
import type { TenantConfigBundle } from '@/types/TenantConfig';

const tenantConfigBundle: TenantConfigBundle = {
  tenant: {
    slug: 'junin',
    nombre: 'Municipalidad de Junin',
    tipo: 'municipio',
    plan: 'full',
  },
  configs: {
    menu: {},
    contacts: {},
    links: {},
    widget: {},
  },
  whatsapp: {
    has_number: true,
    phone_number: '+17432643718',
    sender_id: 'whatsapp:+17432643718',
  },
};

describe('tenantService config updates', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('returns the updated config when backend responds with the full bundle', async () => {
    apiFetchMock.mockResolvedValueOnce(tenantConfigBundle);

    const updated = await tenantService.updateTenantConfig('junin', {
      tenant: { ...tenantConfigBundle.tenant, color_primario: '#0f8f4f' },
    });

    expect(updated).toBe(tenantConfigBundle);
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith('/api/admin/tenants/junin/config', {
      method: 'PUT',
      body: JSON.stringify({
        tenant: { ...tenantConfigBundle.tenant, color_primario: '#0f8f4f' },
      }),
    });
  });

  it('refetches the config when backend responds with an acknowledgement only', async () => {
    apiFetchMock.mockResolvedValueOnce({ message: 'Config updated' }).mockResolvedValueOnce(tenantConfigBundle);

    const updated = await tenantService.updateTenantConfig('junin', {
      configs: { widget: { default: { welcome_title: 'Hola' } } },
    } as any);

    expect(updated).toBe(tenantConfigBundle);
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/admin/tenants/junin/config',
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(apiFetchMock).toHaveBeenNthCalledWith(2, '/api/admin/tenants/junin/config');
  });
});
