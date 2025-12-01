import { safeLocalStorage } from '@/utils/safeLocalStorage';

type StoredContact = {
  name?: string;
  phone?: string;
};

const CONTACT_KEY_PREFIX = 'market_contact_';
const CART_KEY_PREFIX = 'market_cart_v1_';

type StoredCartItem = {
  id: string;
  name: string;
  quantity: number;
  price?: number | null;
  points?: number | null;
  imageUrl?: string | null;
};

export const readStoredCart = (
  slug: string,
): { items: StoredCartItem[]; totalAmount: number | null; totalPoints: number | null } => {
  try {
    const raw = safeLocalStorage.getItem(`${CART_KEY_PREFIX}${slug}`);
    if (!raw) return { items: [], totalAmount: null, totalPoints: null };

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { items: [], totalAmount: null, totalPoints: null };
    }

    const items = Array.isArray(parsed.items) ? parsed.items : [];
    const normalizedItems = items
      .map((item: any) => ({
        id: String(item?.id ?? ''),
        name: typeof item?.name === 'string' ? item.name : 'Producto',
        quantity: typeof item?.quantity === 'number' ? Math.max(1, item.quantity) : 1,
        price: typeof item?.price === 'number' ? item.price : null,
        points: typeof item?.points === 'number' ? item.points : null,
        imageUrl: typeof item?.imageUrl === 'string' ? item.imageUrl : null,
      }))
      .filter((item: StoredCartItem) => item.id);

    const totalAmount =
      typeof parsed.totalAmount === 'number' && Number.isFinite(parsed.totalAmount)
        ? parsed.totalAmount
        : normalizedItems.reduce((acc, item) => acc + (item.price ?? 0) * item.quantity, 0);
    const totalPoints =
      typeof parsed.totalPoints === 'number' && Number.isFinite(parsed.totalPoints)
        ? parsed.totalPoints
        : normalizedItems.reduce((acc, item) => acc + (item.points ?? 0) * item.quantity, 0);

    return { items: normalizedItems, totalAmount, totalPoints };
  } catch (error) {
    console.warn('[market] No se pudo leer el carrito almacenado', error);
    return { items: [], totalAmount: null, totalPoints: null };
  }
};

export const persistStoredCart = (slug: string, payload: { items: StoredCartItem[]; totalAmount: number | null; totalPoints: number | null }) => {
  try {
    safeLocalStorage.setItem(`${CART_KEY_PREFIX}${slug}`, JSON.stringify(payload));
  } catch (error) {
    console.warn('[market] No se pudo persistir el carrito local', error);
  }
};

export const addItemToStoredCart = (slug: string, item: StoredCartItem, quantity = 1) => {
  const current = readStoredCart(slug);
  const itemsMap = new Map<string, StoredCartItem>();
  current.items.forEach((existing) => itemsMap.set(existing.id, existing));

  const existing = itemsMap.get(item.id);
  const nextQuantity = (existing?.quantity ?? 0) + Math.max(1, quantity);

  itemsMap.set(item.id, {
    ...item,
    quantity: nextQuantity,
  });

  const items = Array.from(itemsMap.values());
  const totalAmount = items.reduce((acc, currentItem) => acc + (currentItem.price ?? 0) * currentItem.quantity, 0);
  const totalPoints = items.reduce((acc, currentItem) => acc + (currentItem.points ?? 0) * currentItem.quantity, 0);

  const payload = { items, totalAmount, totalPoints };
  persistStoredCart(slug, payload);
  return payload;
};

export const loadMarketContact = (slug: string): StoredContact => {
  try {
    const raw = safeLocalStorage.getItem(`${CONTACT_KEY_PREFIX}${slug}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return {
        name: typeof parsed.name === 'string' ? parsed.name : undefined,
        phone: typeof parsed.phone === 'string' ? parsed.phone : undefined,
      };
    }
  } catch (error) {
    console.warn('[market] No se pudo leer el contacto guardado', error);
  }
  return {};
};

export const saveMarketContact = (slug: string, contact: StoredContact): void => {
  try {
    safeLocalStorage.setItem(`${CONTACT_KEY_PREFIX}${slug}`, JSON.stringify(contact));
  } catch (error) {
    console.warn('[market] No se pudo persistir el contacto', error);
  }
};
