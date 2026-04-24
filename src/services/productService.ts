import { apiFetch, resolveTenantSlug } from '@/utils/api';
import { buildTenantApiPath } from '@/utils/tenantPaths';
import type { Product } from '@/types';

export const productService = {
  getAll: async (tenantSlug?: string | null): Promise<Product[]> => {
    const effectiveTenant = resolveTenantSlug(tenantSlug);
    if (!effectiveTenant) return [];

    const data = await apiFetch<Product[]>(buildTenantApiPath('/productos', effectiveTenant), {
      tenantSlug: effectiveTenant ?? undefined,
      sendAnonId: true,
      isWidgetRequest: true,
    });
    return data;
  },
};
