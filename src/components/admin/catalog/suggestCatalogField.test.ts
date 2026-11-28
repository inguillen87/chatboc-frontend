import { describe, expect, it } from 'vitest';
import { suggestCatalogField } from './suggestCatalogField';

describe('catalog column suggestion', () => {
  it.each([
    ['nombre', 'product_name'], ['Producto', 'product_name'], ['descripcion', 'description'], ['Descripción', 'description'],
    ['precio', 'price'], ['Precio unitario', 'price'], ['sku', 'sku'], ['Código', 'sku'], ['stock', 'stock'],
    ['categoria', 'category'], ['Categoría', 'category'], ['imagen', 'image_url'], ['imagen_url', 'image_url'], ['Foto', 'image_url'],
    ['imagenes', 'gallery_urls'], ['Galería', 'gallery_urls'], ['alt imagen', 'image_alt'], ['moneda', 'currency'], ['observaciones', 'ignore'],
  ])('%s → %s', (label, field) => {
    expect(suggestCatalogField(label)).toBe(field);
  });

  it('never suggests the product name twice for name and description', () => {
    expect(suggestCatalogField('nombre')).not.toBe(suggestCatalogField('descripcion'));
  });
});
