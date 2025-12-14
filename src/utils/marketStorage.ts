import { MarketCartItem, MarketCartResponse } from '@/types/market';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

const STORAGE_KEY_PREFIX = 'chatboc_market_cart_';

const getStorageKey = (tenantSlug: string) => `${STORAGE_KEY_PREFIX}${tenantSlug}`;

export const readStoredCart = (tenantSlug: string): MarketCartResponse => {
  try {
    const raw = safeLocalStorage.getItem(getStorageKey(tenantSlug));
    if (!raw) return { items: [], totalAmount: 0, totalPoints: 0 };
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Failed to read stored cart', error);
    return { items: [], totalAmount: 0, totalPoints: 0 };
  }
};

const saveStoredCart = (tenantSlug: string, cart: MarketCartResponse) => {
  try {
    safeLocalStorage.setItem(getStorageKey(tenantSlug), JSON.stringify(cart));
  } catch (error) {
    console.warn('Failed to save stored cart', error);
  }
};

export const addItemToStoredCart = (
  tenantSlug: string,
  newItem: MarketCartItem,
  quantityToAdd: number = 1
): MarketCartResponse => {
  const currentCart = readStoredCart(tenantSlug);
  const existingItemIndex = currentCart.items.findIndex((item) => item.id === newItem.id);

  let updatedItems = [...currentCart.items];

  if (existingItemIndex >= 0) {
    updatedItems[existingItemIndex] = {
      ...updatedItems[existingItemIndex],
      quantity: updatedItems[existingItemIndex].quantity + quantityToAdd,
    };
  } else {
    updatedItems.push({ ...newItem, quantity: quantityToAdd });
  }

  const updatedCart = recalculateTotals({ ...currentCart, items: updatedItems });
  saveStoredCart(tenantSlug, updatedCart);
  return updatedCart;
};

export const removeItemFromStoredCart = (
  tenantSlug: string,
  productId: string
): MarketCartResponse => {
  const currentCart = readStoredCart(tenantSlug);
  const updatedItems = currentCart.items.filter((item) => item.id !== productId);
  const updatedCart = recalculateTotals({ ...currentCart, items: updatedItems });
  saveStoredCart(tenantSlug, updatedCart);
  return updatedCart;
};

export const clearStoredCart = (tenantSlug: string): MarketCartResponse => {
  const emptyCart = { items: [], totalAmount: 0, totalPoints: 0 };
  saveStoredCart(tenantSlug, emptyCart);
  return emptyCart;
};

const recalculateTotals = (cart: MarketCartResponse): MarketCartResponse => {
  let totalAmount = 0;
  let totalPoints = 0;

  cart.items.forEach((item) => {
    if (item.modality === 'puntos' && item.points) {
      totalPoints += item.points * item.quantity;
    } else if (item.price) {
      totalAmount += item.price * item.quantity;
    }
  });

  return { ...cart, totalAmount, totalPoints };
};
