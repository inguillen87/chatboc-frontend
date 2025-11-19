import type { ProductDetails } from '@/components/product/ProductCard';

export type CartEntryTuple = [productName: string, quantity: number];

const PRODUCT_LIST_KEYS = ['items', 'productos', 'data', 'results', 'list'];
const CART_LIST_KEYS = ['items', 'cart', 'data', 'productos', 'list'];

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const toNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

export const sanitizeProductPricing = (product: ProductDetails): ProductDetails => ({
  ...product,
  precio_unitario: Number(product.precio_unitario) || 0,
  precio_por_caja: toNullableNumber(product.precio_por_caja),
  unidades_por_caja: toNullableNumber(product.unidades_por_caja),
  precio_mayorista: toNullableNumber(product.precio_mayorista),
  cantidad_minima_mayorista: toNullableNumber(product.cantidad_minima_mayorista),
});

export const normalizeProductsPayload = (raw: unknown, context: string = 'Catalog'): ProductDetails[] => {
  if (Array.isArray(raw)) {
    return raw as ProductDetails[];
  }

  if (isRecord(raw)) {
    for (const key of PRODUCT_LIST_KEYS) {
      const candidate = raw[key];
      if (Array.isArray(candidate)) {
        return candidate as ProductDetails[];
      }
    }
  }

  console.warn(`[${context}] Formato inesperado en /productos. Se utilizará un arreglo vacío.`, raw);
  return [];
};

const mapRecordEntries = (record: Record<string, unknown>): CartEntryTuple[] => {
  return Object.entries(record)
    .map(([productName, quantity]) => {
      const normalizedQuantity = Number(quantity);
      if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
        return null;
      }
      return [productName, normalizedQuantity] as CartEntryTuple;
    })
    .filter((entry): entry is CartEntryTuple => entry !== null);
};

export const normalizeCartPayload = (raw: unknown, context: string = 'Cart'): CartEntryTuple[] => {
  if (!raw) {
    return [];
  }

  if (Array.isArray(raw)) {
    return raw
      .map((entry) => {
        if (!entry) {
          return null;
        }

        if (typeof entry === 'string') {
          return [entry, 1] as CartEntryTuple;
        }

        if (isRecord(entry)) {
          const nombre =
            entry.nombre ??
            entry.name ??
            entry.producto ??
            null;

          const cantidadRaw =
            entry.cantidad ??
            entry.quantity ??
            entry.cantidad_total ??
            entry.qty ??
            1;

          if (typeof nombre === 'string') {
            const normalizedQuantity = Number(cantidadRaw);
            const safeQuantity = Number.isFinite(normalizedQuantity) && normalizedQuantity > 0
              ? normalizedQuantity
              : 1;
            return [nombre, safeQuantity] as CartEntryTuple;
          }
        }

        return null;
      })
      .filter((entry): entry is CartEntryTuple => entry !== null);
  }

  if (isRecord(raw)) {
    for (const key of CART_LIST_KEYS) {
      if (key in raw) {
        const candidate = raw[key];
        if (!candidate || candidate === raw) {
          continue;
        }
        if (Array.isArray(candidate)) {
          return normalizeCartPayload(candidate, context);
        }
        if (isRecord(candidate)) {
          return normalizeCartPayload(candidate, context);
        }
      }
    }

    return mapRecordEntries(raw);
  }

  console.warn(`[${context}] Formato inesperado en /carrito. Se utilizará un arreglo vacío.`, raw);
  return [];
};

export const buildProductMap = (products: ProductDetails[]): Record<string, ProductDetails> => {
  return products.reduce((acc, product) => {
    acc[product.nombre] = sanitizeProductPricing(product);
    return acc;
  }, {} as Record<string, ProductDetails>);
};
