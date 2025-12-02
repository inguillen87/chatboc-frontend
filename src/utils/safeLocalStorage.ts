// src/utils/safeLocalStorage.ts
import { safeStorage } from "./safeStorage";

// Export nombrado y default para compatibilidad
export const safeLocalStorage = safeStorage;
export default safeLocalStorage;

// Helpers opcionales
export const getLS = (k: string) => safeLocalStorage.getItem(k);
export const setLS = (k: string, v: string) => safeLocalStorage.setItem(k, v);
export const delLS = (k: string) => safeLocalStorage.removeItem(k);
export const clearLS = () => safeLocalStorage.clear();

