import {
  safeSessionStorageGetItem,
  safeSessionStorageSetItem,
  safeSessionStorageRemoveItem,
  safeSessionStorageClear,
} from '../../utils/safeStorage.js';

export const safeSessionStorage = {
  getItem(key: string): string | null {
    if (typeof window === 'undefined') return null;
    return safeSessionStorageGetItem(key);
  },
  setItem(key: string, value: string) {
    if (typeof window === 'undefined') return;
    safeSessionStorageSetItem(key, value);
  },
  removeItem(key: string) {
    if (typeof window === 'undefined') return;
    safeSessionStorageRemoveItem(key);
  },
  clear() {
    if (typeof window === 'undefined') return;
    safeSessionStorageClear();
  },
};

export {
  safeSessionStorageGetItem,
  safeSessionStorageSetItem,
  safeSessionStorageRemoveItem,
  safeSessionStorageClear,
};
