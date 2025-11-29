import { apiFetch, resolveTenantSlug } from '@/utils/api';
import type { Product } from '@/types';

export const productService = {
  getAll: async (tenantSlug?: string | null): Promise<Product[]> => {
    const effectiveTenant = resolveTenantSlug(tenantSlug);
    const data = await apiFetch<Product[]>('/productos', {
      tenantSlug: effectiveTenant ?? undefined,
      sendAnonId: true,
      isWidgetRequest: true,
    });
    return data;
  },
};
