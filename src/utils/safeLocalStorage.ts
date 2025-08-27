import {
  safeStorage,
  safeLocalStorageGetItem,
  safeLocalStorageSetItem,
  safeLocalStorageRemoveItem,
  safeLocalStorageClear,
} from "./safeStorage";

export const safeLocalStorage = safeStorage;
export const getLS = safeLocalStorageGetItem;
export const setLS = safeLocalStorageSetItem;
export const delLS = safeLocalStorageRemoveItem;
export const clearLS = safeLocalStorageClear;

export default safeLocalStorage;
