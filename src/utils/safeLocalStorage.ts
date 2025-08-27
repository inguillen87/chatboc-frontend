import { safeStorage } from "./safeStorage";

export const getLS = (key: string): string | null => safeStorage.getItem(key);
export const setLS = (key: string, val: string): void => safeStorage.setItem(key, val);
export const delLS = (key: string): void => safeStorage.removeItem(key);
