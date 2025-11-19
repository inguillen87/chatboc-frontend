import type { ProductDetails } from '@/components/product/ProductCard';
import { sanitizeProductPricing } from '@/utils/cartPayload';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

const LOCAL_CART_KEY = 'chatboc_demo_cart';

interface StoredCartEntry {
  key: string;
  quantity: number;
  product: ProductDetails;
  updatedAt: number;
}

export interface LocalCartProduct extends ProductDetails {
  cantidad: number;
  localCartKey: string;
}

const getProductKey = (productOrKey: ProductDetails | string): string => {
  if (typeof productOrKey === 'string') {
    return productOrKey.trim() || 'producto';
  }

  if (productOrKey?.id !== undefined && productOrKey?.id !== null) {
    const idAsString = String(productOrKey.id).trim();
    if (idAsString) {
      return idAsString;
    }
  }

  return productOrKey?.nombre?.trim() || 'producto';
};

const normalizeEntry = (candidate: unknown): StoredCartEntry | null => {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const anyCandidate = candidate as Partial<StoredCartEntry> & { cantidad?: number; qty?: number };
  const rawQuantity = anyCandidate.quantity ?? anyCandidate.cantidad ?? anyCandidate.qty;
  const numericQuantity = Number(rawQuantity);
  if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
    return null;
  }

  const product = anyCandidate.product;
  if (!product || typeof product !== 'object') {
    return null;
  }

  const nombre = (product as ProductDetails).nombre;
  if (typeof nombre !== 'string' || !nombre.trim()) {
    return null;
  }

  const sanitizedProduct = sanitizeProductPricing(product as ProductDetails);

  const key = typeof anyCandidate.key === 'string' && anyCandidate.key.trim()
    ? anyCandidate.key.trim()
    : getProductKey(sanitizedProduct);

  return {
    key,
    quantity: Math.floor(numericQuantity),
    product: sanitizedProduct,
    updatedAt: typeof anyCandidate.updatedAt === 'number' ? anyCandidate.updatedAt : Date.now(),
  };
};

const readEntries = (): StoredCartEntry[] => {
  try {
    const raw = safeLocalStorage.getItem(LOCAL_CART_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map(normalizeEntry)
      .filter((entry): entry is StoredCartEntry => Boolean(entry));
  } catch {
    return [];
  }
};

const persistEntries = (entries: StoredCartEntry[]): void => {
  try {
    if (!entries.length) {
      safeLocalStorage.removeItem(LOCAL_CART_KEY);
      return;
    }
    safeLocalStorage.setItem(LOCAL_CART_KEY, JSON.stringify(entries));
  } catch {
    // Ignored on purpose
  }
};

const mapEntriesToProducts = (entries: StoredCartEntry[]): LocalCartProduct[] => {
  return entries.map((entry) => ({
    ...sanitizeProductPricing(entry.product),
    cantidad: entry.quantity,
    localCartKey: entry.key,
  }));
};

export const getLocalCartProducts = (): LocalCartProduct[] => {
  return mapEntriesToProducts(readEntries());
};

export const addProductToLocalCart = (
  product: ProductDetails,
  quantity: number,
): LocalCartProduct[] => {
  if (!product?.nombre || quantity <= 0) {
    return getLocalCartProducts();
  }

  const sanitizedProduct = sanitizeProductPricing(product);
  const entries = readEntries();
  const key = getProductKey(product);
  const existingIndex = entries.findIndex((entry) => entry.key === key || entry.product.nombre === sanitizedProduct.nombre);

  if (existingIndex >= 0) {
    entries[existingIndex] = {
      ...entries[existingIndex],
      product: sanitizedProduct,
      quantity: entries[existingIndex].quantity + quantity,
      updatedAt: Date.now(),
    };
  } else {
    entries.push({
      key,
      quantity,
      product: sanitizedProduct,
      updatedAt: Date.now(),
    });
  }

  persistEntries(entries);
  return mapEntriesToProducts(entries);
};

export const setLocalCartItemQuantity = (
  productKeyOrName: string,
  quantity: number,
): LocalCartProduct[] => {
  const normalizedKey = productKeyOrName?.toString().trim();
  const entries = readEntries();
  const targetIndex = entries.findIndex((entry) => entry.key === normalizedKey || entry.product.nombre === normalizedKey);

  if (targetIndex === -1) {
    return mapEntriesToProducts(entries);
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    entries.splice(targetIndex, 1);
  } else {
    entries[targetIndex] = {
      ...entries[targetIndex],
      quantity: Math.floor(quantity),
      updatedAt: Date.now(),
    };
  }

  persistEntries(entries);
  return mapEntriesToProducts(entries);
};

export const removeLocalCartItem = (productKeyOrName: string): LocalCartProduct[] => {
  return setLocalCartItemQuantity(productKeyOrName, 0);
};

export const clearLocalCart = (): void => {
  try {
    safeLocalStorage.removeItem(LOCAL_CART_KEY);
  } catch {
    // Ignore removal errors
  }
};
