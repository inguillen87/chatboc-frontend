import type { CatalogField } from '@/types/catalog-import';
import { looksLikeImageColumn } from '@/utils/marketImages';

const plain = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/** First guess for an imported column, from its header. The person can change it before publishing. */
export function suggestCatalogField(label: string): CatalogField {
  const name = plain(label);
  const words = name.split(/[^a-z0-9]+/).filter(Boolean);
  const has = (...options: string[]) => options.some((option) => words.includes(option) || name.includes(option));
  if (has('precio', 'price')) return 'price';
  if (has('sku', 'codigo', 'code')) return 'sku';
  if (has('stock', 'cantidad', 'existencia', 'inventario')) return 'stock';
  if (has('categoria', 'category', 'rubro')) return 'category';
  if (has('moneda', 'currency')) return 'currency';
  if (has('descripcion', 'description', 'detalle')) return 'description';
  if (has('galeria', 'gallery', 'imagenes', 'images', 'fotos', 'photos')) return 'gallery_urls';
  if (words.includes('alt')) return 'image_alt';
  if (words.includes('imagen') || words.includes('image') || looksLikeImageColumn(name)) return 'image_url';
  if (has('nombre', 'producto', 'product', 'titulo', 'title', 'name')) return 'product_name';
  return 'ignore';
}
