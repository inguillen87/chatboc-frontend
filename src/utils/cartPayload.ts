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

const DEFAULT_PRODUCT_IMAGE =
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80';

const PRODUCT_IMAGE_FALLBACKS: { keywords: string[]; url: string }[] = [
  {
    keywords: ['kit', 'escolar', 'útiles', 'utiles', 'cuaderno', 'mochila'],
    url: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=600&q=80',
  },
  {
    keywords: ['árbol', 'arbol', 'forestal', 'nativo', 'plantar', 'plantación', 'plantacion'],
    url: 'https://images.unsplash.com/photo-1455218873509-8097305ee378?auto=format&fit=crop&w=600&q=80',
  },
  {
    keywords: ['hospital', 'salud', 'donación', 'donacion', 'bono', 'turno'],
    url: 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=600&q=80',
  },
  {
    keywords: ['bolson', 'bolsón', 'alimento', 'fruta', 'verdura', 'saludable'],
    url: 'https://images.unsplash.com/photo-1505253758473-96b7015fcd40?auto=format&fit=crop&w=600&q=80',
  },
  {
    keywords: ['canje', 'reciclaje', 'electrónico', 'electronico', 'residuos', 'puntos'],
    url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=600&q=80',
  },
  {
    keywords: ['bicicleta', 'movilidad', 'transporte'],
    url: 'https://images.unsplash.com/photo-1508979827776-5b7eb0f58c01?auto=format&fit=crop&w=600&q=80',
  },
  {
    keywords: ['tour', 'turismo', 'cultural', 'paseo'],
    url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=600&q=80',
  },
  {
    keywords: ['donación', 'donacion', 'solidaria', 'alimentos', 'alimento'],
    url: 'https://images.unsplash.com/photo-1504753793650-d4a2b783c15e?auto=format&fit=crop&w=600&q=80',
  },
];

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

const resolveImageFallback = (product: ProductDetails): string => {
  const haystack = normalizeText(
    [product.categoria, product.nombre, product.descripcion, product.presentacion]
      .filter(Boolean)
      .join(' ')
  );

  const fallback = PRODUCT_IMAGE_FALLBACKS.find((candidate) =>
    candidate.keywords.some((keyword) => haystack.includes(normalizeText(keyword)))
  );

  return fallback?.url ?? DEFAULT_PRODUCT_IMAGE;
};

const normalizeImageUrl = (candidate?: string | null): string | null => {
  if (!candidate) return null;
  const trimmed = candidate.trim();
  if (!trimmed) return null;

  if (/^data:/i.test(trimmed)) {
    return trimmed;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  return null;
};

export const enhanceProductDetails = (product: ProductDetails): ProductDetails => {
  const sanitized = sanitizeProductPricing(product);
  const normalizedImage = normalizeImageUrl(sanitized.imagen_url);

  return {
    ...sanitized,
    imagen_url: normalizedImage ?? resolveImageFallback(sanitized),
  };
};

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
    acc[product.nombre] = enhanceProductDetails(product);
    return acc;
  }, {} as Record<string, ProductDetails>);
};
