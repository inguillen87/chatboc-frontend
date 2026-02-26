// src/utils/safeLocalStorage.ts

// This file implements a lazy-initialized storage wrapper to prevent Temporal Dead Zone (TDZ)
// issues during module evaluation, especially when involved in circular dependencies.

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

const isValidStorage = (candidate: any): candidate is StorageLike => {
  return (
    candidate &&
    typeof candidate.getItem === "function" &&
    typeof candidate.setItem === "function" &&
    typeof candidate.removeItem === "function" &&
    typeof candidate.clear === "function"
  );
};

/* ===== Factories para detección tardía ===== */
function detectLocalStorage(): StorageLike | null {
  if (!isBrowser()) return null;
  try {
    const ls = window.localStorage;
    // Simple verification
    if (!ls) return null;
    return ls;
  } catch {
    return null;
  }
}

function detectSessionStorage(): StorageLike | null {
  if (!isBrowser()) return null;
  try {
    const ss = window.sessionStorage;
    if (!ss) return null;
    return ss;
  } catch {
    return null;
  }
}

// Lazy storage initialization
let _safeLocalStorage: StorageLike | null = null;
let _safeSessionStorage: StorageLike | null = null;

function getSafeLocalStorage(): StorageLike {
  if (_safeLocalStorage) return _safeLocalStorage;

  const candidate = detectLocalStorage();
  const fallback = memoryLocalStorage;
  const storage = isValidStorage(candidate) ? candidate : fallback;

  _safeLocalStorage = {
    getItem: (k) => { try { return storage.getItem(k); } catch { return null; } },
    setItem: (k, v) => { try { storage.setItem(k, v); } catch { fallback.setItem(k, v); } },
    removeItem: (k) => { try { storage.removeItem(k); } catch { fallback.removeItem(k); } },
    clear: () => { try { storage.clear(); } catch { fallback.clear(); } },
  };
  return _safeLocalStorage;
}

function getSafeSessionStorage(): StorageLike {
  if (_safeSessionStorage) return _safeSessionStorage;

  const candidate = detectSessionStorage();
  const fallback = memorySessionStorage;
  const storage = isValidStorage(candidate) ? candidate : fallback;

  _safeSessionStorage = {
    getItem: (k) => { try { return storage.getItem(k); } catch { return null; } },
    setItem: (k, v) => { try { storage.setItem(k, v); } catch { fallback.setItem(k, v); } },
    removeItem: (k) => { try { storage.removeItem(k); } catch { fallback.removeItem(k); } },
    clear: () => { try { storage.clear(); } catch { fallback.clear(); } },
  };
  return _safeSessionStorage;
}

/* ===== Exports principales (Lazy Proxy Object) ===== */
// We export an object that proxies calls to the lazy getter.
// This ensures that even if 'safeLocalStorage' is imported early in a cycle,
// the underlying storage detection doesn't run until a method is actually called.

export const safeLocalStorage: StorageLike = {
  getItem: (k) => getSafeLocalStorage().getItem(k),
  setItem: (k, v) => getSafeLocalStorage().setItem(k, v),
  removeItem: (k) => getSafeLocalStorage().removeItem(k),
  clear: () => getSafeLocalStorage().clear(),
};

// Alias for backward compatibility if needed
export const safeStorage = safeLocalStorage;

export const safeSessionStorage: StorageLike = {
  getItem: (k) => getSafeSessionStorage().getItem(k),
  setItem: (k, v) => getSafeSessionStorage().setItem(k, v),
  removeItem: (k) => getSafeSessionStorage().removeItem(k),
  clear: () => getSafeSessionStorage().clear(),
};

/* ===== Default Export ===== */
export default safeLocalStorage;

/* ===== Helpers ===== */
export const getLS = (k: string) => safeLocalStorage.getItem(k);
export const setLS = (k: string, v: string) => safeLocalStorage.setItem(k, v);
export const delLS = (k: string) => safeLocalStorage.removeItem(k);
export const clearLS = () => safeLocalStorage.clear();

export const safeLocalStorageGetItem = (k: string) => safeLocalStorage.getItem(k);
export const safeLocalStorageSetItem = (k: string, v: string) => safeLocalStorage.setItem(k, v);
export const safeLocalStorageRemoveItem = (k: string) => safeLocalStorage.removeItem(k);
export const safeLocalStorageClear = () => safeLocalStorage.clear();

export const safeSessionStorageGetItem = (k: string) => safeSessionStorage.getItem(k);
export const safeSessionStorageSetItem = (k: string, v: string) => safeSessionStorage.setItem(k, v);
export const safeSessionStorageRemoveItem = (k: string) => safeSessionStorage.removeItem(k);
export const safeSessionStorageClear = () => safeSessionStorage.clear();
