import { apiFetch } from '@/utils/api';
import type { Product } from '@/types';

export const productService = {
  getAll: async (tenantSlug?: string | null): Promise<Product[]> => {
    const data = await apiFetch<Product[]>('/productos', {
      tenantSlug: tenantSlug ?? undefined,
      sendAnonId: true,
      isWidgetRequest: true,
    });
    return data;
  },
};
