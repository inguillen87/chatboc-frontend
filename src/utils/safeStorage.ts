// src/utils/safeStorage.ts

type StorageLike = {
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
  removeItem: (k: string) => void;
  clear: () => void;
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/* ===== Fallbacks en memoria ===== */
const memLocal: Record<string, string> = {};
const memSession: Record<string, string> = {};

const memoryLocalStorage: StorageLike = {
  getItem: (k) => (k in memLocal ? memLocal[k] : null),
  setItem: (k, v) => {
    memLocal[k] = v;
  },
  removeItem: (k) => {
    delete memLocal[k];
  },
  clear: () => {
    for (const k of Object.keys(memLocal)) delete memLocal[k];
  },
};

const memorySessionStorage: StorageLike = {
  getItem: (k) => (k in memSession ? memSession[k] : null),
  setItem: (k, v) => {
    memSession[k] = v;
  },
  removeItem: (k) => {
    delete memSession[k];
  },
  clear: () => {
    for (const k of Object.keys(memSession)) delete memSession[k];
  },
};

/* ===== Storages reales, con try/catch ===== */
function detectLocalStorage(): StorageLike | null {
  if (!isBrowser()) return null;
  try {
    const ls = window.localStorage;
    const t = "__safeStorage_test__";
    ls.setItem(t, "1");
    ls.removeItem(t);
    return {
      getItem: (k) => ls.getItem(k),
      setItem: (k, v) => ls.setItem(k, v),
      removeItem: (k) => ls.removeItem(k),
      clear: () => ls.clear(),
    };
  } catch {
    return null;
  }
}

function detectSessionStorage(): StorageLike | null {
  if (!isBrowser()) return null;
  try {
    const ss = window.sessionStorage;
    const t = "__safeSession_test__";
    ss.setItem(t, "1");
    ss.removeItem(t);
    return {
      getItem: (k) => ss.getItem(k),
      setItem: (k, v) => ss.setItem(k, v),
      removeItem: (k) => ss.removeItem(k),
      clear: () => ss.clear(),
    };
  } catch {
    return null;
  }
}

/* ===== Exports principales ===== */
export const safeStorage: StorageLike = detectLocalStorage() ?? memoryLocalStorage;
export const safeSessionStorage: StorageLike = detectSessionStorage() ?? memorySessionStorage;

/* ===== Helpers (exports UNA sola vez) ===== */
export const safeLocalStorageGetItem = (k: string) => safeStorage.getItem(k);
export const safeLocalStorageSetItem = (k: string, v: string) => safeStorage.setItem(k, v);
export const safeLocalStorageRemoveItem = (k: string) => safeStorage.removeItem(k);
export const safeLocalStorageClear = () => safeStorage.clear();

export const safeSessionStorageGetItem = (k: string) => safeSessionStorage.getItem(k);
export const safeSessionStorageSetItem = (k: string, v: string) => safeSessionStorage.setItem(k, v);
export const safeSessionStorageRemoveItem = (k: string) => safeSessionStorage.removeItem(k);
export const safeSessionStorageClear = () => safeSessionStorage.clear();

/* Default (por si en algún lado lo importaste así) */
export default safeStorage;
