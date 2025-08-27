const memoryLocal: Record<string, string> = {};
const memorySession: Record<string, string> = {};

export function safeLocalStorageGetItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memoryLocal[key] ?? null;
  }
}

export function safeLocalStorageSetItem(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    memoryLocal[key] = String(value);
  }
}

export function safeLocalStorageRemoveItem(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    delete memoryLocal[key];
  }
}

export function safeLocalStorageClear(): void {
  try {
    window.localStorage.clear();
  } catch {
    for (const k in memoryLocal) delete memoryLocal[k];
  }
}

export function safeSessionStorageGetItem(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return memorySession[key] ?? null;
  }
}

export function safeSessionStorageSetItem(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    memorySession[key] = String(value);
  }
}

export function safeSessionStorageRemoveItem(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    delete memorySession[key];
  }
}

export function safeSessionStorageClear(): void {
  try {
    window.sessionStorage.clear();
  } catch {
    for (const k in memorySession) delete memorySession[k];
  }
}

export const safeStorage = {
  getItem: safeLocalStorageGetItem,
  setItem: safeLocalStorageSetItem,
  removeItem: safeLocalStorageRemoveItem,
  clear: safeLocalStorageClear,
};

export {
  safeLocalStorageGetItem,
  safeLocalStorageSetItem,
  safeLocalStorageRemoveItem,
  safeLocalStorageClear,
  safeSessionStorageGetItem,
  safeSessionStorageSetItem,
  safeSessionStorageRemoveItem,
  safeSessionStorageClear,
};
