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

type PlaceholderTheme = {
  keywords: string[];
  label: string;
  emoji: string;
  colors: { bg: string; accent: string; text: string };
};

const PRODUCT_IMAGE_FALLBACKS: PlaceholderTheme[] = [
  {
    keywords: ['kit', 'escolar', 'útiles', 'utiles', 'cuaderno', 'mochila'],
    label: 'Educación',
    emoji: '🎒',
    colors: { bg: '#0ea5e9', accent: '#0f172a', text: '#e0f2fe' },
  },
  {
    keywords: ['árbol', 'arbol', 'forestal', 'nativo', 'plantar', 'plantación', 'plantacion'],
    label: 'Sustentabilidad',
    emoji: '🌳',
    colors: { bg: '#22c55e', accent: '#052e16', text: '#dcfce7' },
  },
  {
    keywords: ['hospital', 'salud', 'donación', 'donacion', 'bono', 'turno'],
    label: 'Salud',
    emoji: '🏥',
    colors: { bg: '#f97316', accent: '#311302', text: '#ffedd5' },
  },
  {
    keywords: ['bolson', 'bolsón', 'alimento', 'fruta', 'verdura', 'saludable'],
    label: 'Alimentación',
    emoji: '🥕',
    colors: { bg: '#f59e0b', accent: '#422006', text: '#fffbeb' },
  },
  {
    keywords: ['canje', 'reciclaje', 'electrónico', 'electronico', 'residuos', 'puntos'],
    label: 'Reciclaje',
    emoji: '♻️',
    colors: { bg: '#10b981', accent: '#022c22', text: '#d1fae5' },
  },
  {
    keywords: ['bicicleta', 'movilidad', 'transporte'],
    label: 'Movilidad',
    emoji: '🚲',
    colors: { bg: '#6366f1', accent: '#1e1b4b', text: '#e0e7ff' },
  },
  {
    keywords: ['tour', 'turismo', 'cultural', 'paseo'],
    label: 'Turismo',
    emoji: '🏛️',
    colors: { bg: '#8b5cf6', accent: '#2e1065', text: '#ede9fe' },
  },
  {
    keywords: ['donación', 'donacion', 'solidaria', 'alimentos', 'alimento'],
    label: 'Solidaridad',
    emoji: '🤝',
    colors: { bg: '#f43f5e', accent: '#3f0b1b', text: '#ffe4e6' },
  },
];

const DEFAULT_PLACEHOLDER_THEME: PlaceholderTheme = {
  keywords: [],
  label: 'Catálogo',
  emoji: '🛒',
  colors: { bg: '#0f172a', accent: '#020617', text: '#e2e8f0' },
};

const escapeSvgText = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildSvgPlaceholder = (theme: PlaceholderTheme, product: ProductDetails): string => {
  const title = escapeSvgText(product.categoria?.trim() || theme.label);
  const subtitle = escapeSvgText(product.nombre?.trim() || 'Producto');

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="480" viewBox="0 0 800 480" role="img" aria-label="${title}">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${theme.colors.bg}" stop-opacity="0.95" />
          <stop offset="100%" stop-color="${theme.colors.accent}" stop-opacity="0.95" />
        </linearGradient>
      </defs>
      <rect width="800" height="480" fill="url(#grad)" rx="24"/>
      <text x="50%" y="48%" text-anchor="middle" font-family="'Inter', system-ui" font-size="96" fill="${theme.colors.text}">
        ${theme.emoji}
      </text>
      <text x="50%" y="60%" text-anchor="middle" font-family="'Inter', system-ui" font-size="34" fill="${theme.colors.text}" font-weight="700">
        ${title}
      </text>
      <text x="50%" y="70%" text-anchor="middle" font-family="'Inter', system-ui" font-size="20" fill="${theme.colors.text}" opacity="0.85">
        ${subtitle}
      </text>
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

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

  const fallbackTheme = PRODUCT_IMAGE_FALLBACKS.find((candidate) =>
    candidate.keywords.some((keyword) => haystack.includes(normalizeText(keyword)))
  );

  return buildSvgPlaceholder(fallbackTheme ?? DEFAULT_PLACEHOLDER_THEME, product);
};

export const getProductPlaceholderImage = (product: ProductDetails): string =>
  resolveImageFallback(product);

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

  if (trimmed.startsWith('/')) {
    return trimmed;
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
