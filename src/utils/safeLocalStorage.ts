import { safeStorage } from "./safeStorage";

export type SafeLocalStorageLike = {
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
  removeItem: (k: string) => void;
  clear: () => void;
};

export const safeLocalStorage: SafeLocalStorageLike = {
  getItem: (k) => safeStorage.getItem(k),
  setItem: (k, v) => safeStorage.setItem(k, v),
  removeItem: (k) => safeStorage.removeItem(k),
  clear: () => safeStorage.clear(),
};

export const getLS = (k: string) => safeLocalStorage.getItem(k);
export const setLS = (k: string, v: string) => safeLocalStorage.setItem(k, v);
export const delLS = (k: string) => safeLocalStorage.removeItem(k);

export default safeLocalStorage;
