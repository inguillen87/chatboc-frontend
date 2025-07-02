import {
  safeLocalStorageGetItem,
  safeLocalStorageSetItem,
  safeLocalStorageRemoveItem,
  safeLocalStorageClear,
} from '../../utils/safeStorage.js';

export const safeLocalStorage = {
  getItem(key: string): string | null {
    if (typeof window === 'undefined') return null;
    return safeLocalStorageGetItem(key);
  },
  setItem(key: string, value: string) {
    if (typeof window === 'undefined') return;
    safeLocalStorageSetItem(key, value);
  },
  removeItem(key: string) {
    if (typeof window === 'undefined') return;
    safeLocalStorageRemoveItem(key);
  },
  clear() {
    if (typeof window === 'undefined') return;
    safeLocalStorageClear();
  },
};

export {
  safeLocalStorageGetItem,
  safeLocalStorageSetItem,
  safeLocalStorageRemoveItem,
  safeLocalStorageClear,
};
