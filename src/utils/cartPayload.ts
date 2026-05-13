type ProductModalidad = 'venta' | 'puntos' | 'donacion' | string | null;

type ProductDetails = {
  id: number | string;
  nombre: string;
  descripcion?: string | null;
  precio_unitario: number;
  precio_puntos?: number | null;
  precio_anterior?: number | null;
  imagen_url?: string | null;
  presentacion?: string | null;
  categoria?: string | null;
  badge?: string | null;
  badge_variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
  stock_disponible?: number | null;
  unidad_medida?: string | null;
  sku?: string | null;
  marca?: string | null;
  precio_por_caja?: number | null;
  unidades_por_caja?: number | null;
  promocion_activa?: string | null;
  promocion_info?: string | null;
  precio_texto?: string | null;
  moneda?: string | null;
  talles?: string[] | null;
  colores?: string[] | null;
  precio_mayorista?: number | null;
  cantidad_minima_mayorista?: number | null;
  modalidad?: ProductModalidad;
  instrucciones_entrega?: string | null;
  origen?: 'api' | 'demo';
  disponible?: boolean;
  checkout_type?: 'mercadolibre' | 'tiendanube' | 'chatboc' | null;
  external_url?: string | null;
};

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
    imagen_url: normalizedImage,
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
  const rawTalles = raw.talles ?? raw.sizes;
  const rawColores = raw.colores ?? raw.colors;
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
    precio_texto: typeof raw.precio_texto === 'string' ? raw.precio_texto : undefined,
    moneda: typeof raw.moneda === 'string' ? raw.moneda : undefined,
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
        : typeof raw.promoInfo === 'string'
          ? raw.promoInfo
          : undefined,
    promocion_info: typeof raw.promocion_info === 'string'
      ? raw.promocion_info
      : typeof raw.promoInfo === 'string'
        ? raw.promoInfo
        : undefined,
    precio_mayorista: toNullableNumber(raw.precio_mayorista ?? raw.wholesale_price),
    cantidad_minima_mayorista: toNullableNumber(raw.cantidad_minima_mayorista ?? raw.wholesale_min_qty),
    modalidad,
    talles: Array.isArray(rawTalles) ? rawTalles.filter((item): item is string => typeof item === 'string') : undefined,
    colores: Array.isArray(rawColores) ? rawColores.filter((item): item is string => typeof item === 'string') : undefined,
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
