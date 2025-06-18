const memoryLocal = {};
const memorySession = {};

export function safeLocalStorageGetItem(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (e) {
    return memoryLocal[key] || null;
  }
}

export function safeLocalStorageSetItem(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (e) {
    memoryLocal[key] = String(value);
  }
}

export function safeLocalStorageRemoveItem(key) {
  try {
    window.localStorage.removeItem(key);
  } catch (e) {
    delete memoryLocal[key];
  }
}

export function safeLocalStorageClear() {
  try {
    window.localStorage.clear();
  } catch (e) {
    for (const k in memoryLocal) delete memoryLocal[k];
  }
}

export function safeSessionStorageGetItem(key) {
  try {
    return window.sessionStorage.getItem(key);
  } catch (e) {
    return memorySession[key] || null;
  }
}

export function safeSessionStorageSetItem(key, value) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch (e) {
    memorySession[key] = String(value);
  }
}

export function safeSessionStorageRemoveItem(key) {
  try {
    window.sessionStorage.removeItem(key);
  } catch (e) {
    delete memorySession[key];
  }
}

export function safeSessionStorageClear() {
  try {
    window.sessionStorage.clear();
  } catch (e) {
    for (const k in memorySession) delete memorySession[k];
  }
}
