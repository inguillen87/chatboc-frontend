// src/utils/safeLocalStorage.ts
import { safeStorage } from "./safeStorage";

// Re-export safeStorage as safeLocalStorage directly
// Avoids `const safeLocalStorage = safeStorage;` which creates a new binding that might be TDZ if cyclical deps exist.
export { safeStorage as safeLocalStorage };

// Also default export
export default safeStorage;

// Helpers opcionales
export const getLS = (k: string) => safeStorage.getItem(k);
export const setLS = (k: string, v: string) => safeStorage.setItem(k, v);
export const delLS = (k: string) => safeStorage.removeItem(k);
export const clearLS = () => safeStorage.clear();
