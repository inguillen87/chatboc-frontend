import { describe, it, expect } from 'vitest';
import { getFormattedProducts } from 'server/catalog.js';

describe('getFormattedProducts', () => {
  it('should return formatted products', () => {
    const products = getFormattedProducts();
    expect(Array.isArray(products)).toBe(true);
    expect(products.length).toBeGreaterThanOrEqual(3);

    const camisa = products.find(p => p.nombre === 'Camisa Oxford');
    expect(camisa).toBeDefined();
    expect(Array.isArray(camisa.variants) && camisa.variants.length === 1).toBe(true);
  });
});
