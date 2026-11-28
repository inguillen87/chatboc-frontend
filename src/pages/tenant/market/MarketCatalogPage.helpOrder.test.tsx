import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('catalog help blocks', () => {
  it('move after the products once the catalog is full', () => {
    const source = readFileSync('src/pages/tenant/market/MarketCatalogPage.tsx', 'utf8');
    expect(source).toContain("const helpOrder = products.length > 6 ? 'order-4' : 'order-2';");
    expect(source.match(/\$\{helpOrder\}/g)).toHaveLength(1);
  });
});
