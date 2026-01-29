import type { ProductDetails } from '@/components/product/ProductCard';

export type CartEntryTuple = [productName: string, quantity: number];

const PRODUCT_LIST_KEYS = ['items', 'productos', 'data', 'results', 'list'];
const CART_LIST_KEYS = ['items', 'cart', 'data', 'productos', 'list'];

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const normalizeModalidad = (value: unknown): ProductDetails['modalidad'] => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (['puntos', 'punto', 'canje'].includes(normalized)) return 'puntos';
  if (['donacion', 'donación', 'donar'].includes(normalized)) return 'donacion';
  return 'venta';
};

const toNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const parseFlexiblePrice = (value: unknown): { unitPrice: number | null; rawLabel: string | null } => {
  if (value === null || value === undefined) {
    return { unitPrice: null, rawLabel: null };
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return { unitPrice: value, rawLabel: String(value) };
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return { unitPrice: null, rawLabel: null };

    const numericCandidate = Number(trimmed.replace(/[^0-9.,-]/g, '').replace(',', '.'));
    if (Number.isFinite(numericCandidate)) {
      return { unitPrice: numericCandidate, rawLabel: trimmed };
    }

    return { unitPrice: null, rawLabel: trimmed };
  }

  return { unitPrice: null, rawLabel: null };
};

export const sanitizeProductPricing = (product: ProductDetails): ProductDetails => {
  const modalidad = normalizeModalidad(product.modalidad);
  const precio_unitario = modalidad === 'donacion' ? 0 : Number(product.precio_unitario) || 0;
  const precio_puntos = modalidad === 'puntos' ? toNullableNumber(product.precio_puntos ?? product.precio_unitario) : null;

  return {
    ...product,
    modalidad,
    precio_unitario,
    precio_puntos,
    precio_por_caja: toNullableNumber(product.precio_por_caja),
    unidades_por_caja: toNullableNumber(product.unidades_por_caja),
    precio_mayorista: toNullableNumber(product.precio_mayorista),
    cantidad_minima_mayorista: toNullableNumber(product.cantidad_minima_mayorista),
  };
};

type DemoPriceRule = {
  keywords: string[];
  price: number;
  previous?: number;
};

const DEMO_PRICE_RULES: DemoPriceRule[] = [
  {
    keywords: ['kit', 'escolar', 'mochila', 'útiles', 'utiles'],
    price: 1800,
    previous: 2200,
  },
  {
    keywords: ['árbol', 'arbol', 'nativo', 'forestal', 'plantar'],
    price: 1200,
    previous: 1450,
  },
  {
    keywords: ['bono', 'salud', 'hospital', 'turno'],
    price: 4500,
    previous: 5200,
  },
  {
    keywords: ['bolson', 'bolsón', 'alimento', 'fruta', 'verdura'],
    price: 3200,
    previous: 3650,
  },
  {
    keywords: ['canje', 'reciclaje', 'electrónico', 'electronico', 'residuos'],
    price: 890,
    previous: 1090,
  },
  {
    keywords: ['bicicleta', 'movilidad', 'pase diario'],
    price: 240,
    previous: 320,
  },
  {
    keywords: ['tour', 'turismo', 'cultural'],
    price: 2750,
    previous: 3100,
  },
  {
    keywords: ['donación', 'donacion', 'solidaria', 'alimentos'],
    price: 4500,
    previous: 5200,
  },
];

const DEMO_PRICE_FALLBACK = { price: 1990, previous: 2190 } as const;

const findDemoPrice = (product: ProductDetails): DemoPriceRule | typeof DEMO_PRICE_FALLBACK => {
  const haystack = normalizeText(
    [product.categoria, product.nombre, product.descripcion, product.presentacion]
      .filter(Boolean)
      .join(' ')
  );

  const match = DEMO_PRICE_RULES.find((rule) =>
    rule.keywords.some((keyword) => haystack.includes(normalizeText(keyword)))
  );

  return match ?? DEMO_PRICE_FALLBACK;
};

const applyDemoPricing = (product: ProductDetails): ProductDetails => {
  const candidate = sanitizeProductPricing(product);
  if (candidate.modalidad === 'donacion') {
    return { ...candidate, precio_unitario: 0, precio_anterior: null, precio_puntos: null };
  }

  if (candidate.modalidad === 'puntos') {
    const pointsValue = candidate.precio_puntos && candidate.precio_puntos > 0
      ? candidate.precio_puntos
      : Math.max(Math.round(candidate.precio_unitario || 0), 0) || 120;
    return {
      ...candidate,
      precio_unitario: 0,
      precio_puntos: pointsValue,
    };
  }
  const needsPrice = !candidate.precio_unitario || candidate.precio_unitario <= 0;

  const demoPricing = findDemoPrice(candidate);

  const precio_unitario = needsPrice ? demoPricing.price : candidate.precio_unitario;
  const precio_anterior = candidate.precio_anterior && candidate.precio_anterior > 0
    ? candidate.precio_anterior
    : demoPricing.previous && demoPricing.previous > precio_unitario
      ? demoPricing.previous
      : undefined;

  return {
    ...candidate,
    precio_unitario,
    precio_anterior,
  };
};

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
  const sanitized = applyDemoPricing(product);
  const normalizedImage = normalizeImageUrl(sanitized.imagen_url);

  return {
    ...sanitized,
    imagen_url: normalizedImage ?? resolveImageFallback(sanitized),
  };
};

const normalizeProductRecord = (raw: Record<string, unknown>, index: number): ProductDetails => {
  const nombre = typeof raw.nombre === 'string' && raw.nombre.trim()
    ? raw.nombre.trim()
    : typeof raw.name === 'string' && raw.name.trim()
      ? raw.name.trim()
      : `producto-${index}`;

  const descripcion = typeof raw.descripcion === 'string'
    ? raw.descripcion
    : typeof raw.description === 'string'
      ? raw.description
      : null;
  const presentacion = typeof raw.presentacion === 'string'
    ? raw.presentacion
    : typeof raw.presentation === 'string'
      ? raw.presentation
      : typeof raw.quantityLabel === 'string'
        ? raw.quantityLabel
        : typeof raw.quantity_label === 'string'
          ? raw.quantity_label
          : null;
  const categoria = typeof raw.categoria === 'string'
    ? raw.categoria
    : typeof raw.category === 'string'
      ? raw.category
      : null;
  const modalidad = normalizeModalidad(raw.modalidad ?? raw.tipo ?? raw.mode ?? null);
  const flexiblePrice = parseFlexiblePrice((raw as Record<string, any>).precio_flexible ?? (raw as Record<string, any>).precioFlexible ?? (raw as Record<string, any>).flexible_price);

  const base: ProductDetails = {
    id: raw.id ?? nombre ?? index,
    nombre,
    descripcion,
    presentacion: presentacion ?? undefined,
    categoria,
    badge: typeof raw.badge === 'string' ? raw.badge : null,
    badge_variant: (raw.badge_variant as ProductDetails['badge_variant']) ?? undefined,
    precio_unitario: Number(raw.precio_unitario ?? raw.precio ?? raw.price ?? flexiblePrice.unitPrice ?? 0) || 0,
    precio_puntos: toNullableNumber(raw.precio_puntos ?? raw.puntos ?? raw.points ?? flexiblePrice.unitPrice),
    precio_anterior: toNullableNumber(raw.precio_anterior ?? raw.precioAnterior ?? raw.previous_price),
    imagen_url: normalizeImageUrl(
      (raw.imagen_url as string | null | undefined) ??
      (raw.imagen as string | null | undefined) ??
      (raw.image as string | null | undefined),
    ),
    stock_disponible: toNullableNumber(raw.stock_disponible ?? raw.stock ?? raw.inventory),
    unidad_medida: typeof raw.unidad_medida === 'string'
      ? raw.unidad_medida
      : typeof raw.unidad === 'string'
        ? raw.unidad
        : typeof raw.unit === 'string'
          ? raw.unit
          : undefined,
    sku: typeof raw.sku === 'string' ? raw.sku : undefined,
    marca: typeof raw.marca === 'string' ? raw.marca : undefined,
    precio_por_caja: toNullableNumber(
      raw.precio_por_caja ?? raw.precio_pack ?? raw.precio_caja ?? raw.caja_precio,
    ),
    unidades_por_caja: toNullableNumber(raw.unidades_por_caja ?? raw.caja_unidades ?? raw.units_per_case),
    promocion_activa: typeof raw.promocion_activa === 'string'
      ? raw.promocion_activa
      : typeof raw.promocion_info === 'string'
        ? raw.promocion_info
        : undefined,
    precio_mayorista: toNullableNumber(raw.precio_mayorista ?? raw.wholesale_price),
    cantidad_minima_mayorista: toNullableNumber(raw.cantidad_minima_mayorista ?? raw.wholesale_min_qty),
    modalidad,
    checkout_type: (raw.checkout_type ?? raw.checkoutType) as ProductDetails['checkout_type'],
    external_url: typeof raw.external_url === 'string'
      ? raw.external_url
      : typeof raw.externalUrl === 'string'
        ? raw.externalUrl
        : null,
  };

  return sanitizeProductPricing(base);
};

export const normalizeProductsPayload = (raw: unknown, context: string = 'Catalog'): ProductDetails[] => {
  const mapProducts = (list: unknown[]): ProductDetails[] =>
    list.map((item, index) =>
      isRecord(item) ? normalizeProductRecord(item, index) : sanitizeProductPricing(item as ProductDetails),
    );

  if (Array.isArray(raw)) {
    return mapProducts(raw);
  }

  if (isRecord(raw)) {
    for (const key of PRODUCT_LIST_KEYS) {
      const candidate = raw[key];
      if (Array.isArray(candidate)) {
        return mapProducts(candidate);
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
