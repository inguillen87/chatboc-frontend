import { apiFetch } from '@/utils/api';
import type { Product } from '@/types';

export const productService = {
  getAll: async (tenantSlug?: string | null): Promise<Product[]> => {
    const path = tenantSlug
      ? `/pwa/public/${tenantSlug}/productos`
      : '/productos';
    const data = await apiFetch<Product[]>(path, { tenantSlug });
    return data;
  },
};
