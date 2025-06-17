import { apiFetch } from '@/utils/api';
import type { Product } from '@/types';

export const productService = {
  getAll: async (): Promise<Product[]> => {
    const data = await apiFetch<Product[]>('/productos');
    return data;
  },
};
