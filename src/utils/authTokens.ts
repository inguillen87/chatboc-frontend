import { safeLocalStorage } from "./safeLocalStorage";

interface JwtPayload {
  exp?: number;
}

const decodeJwtPayload = (token: string): JwtPayload | null => {
  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const decoded =
      typeof window === "undefined"
        ? Buffer.from(payload, "base64").toString("utf-8")
        : atob(payload);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
};

export const isJwtExpired = (token: string, skewSeconds = 30): boolean => {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return false;

  const now = Math.floor(Date.now() / 1000);
  return payload.exp + skewSeconds < now;
};

export const getValidStoredToken = (tokenKey: string): string | null => {
  const token = safeLocalStorage.getItem(tokenKey);
  if (!token) return null;

  if (isJwtExpired(token)) {
    safeLocalStorage.removeItem(tokenKey);
    return null;
  }

  return token;
};
