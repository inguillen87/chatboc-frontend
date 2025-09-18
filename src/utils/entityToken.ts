import { safeLocalStorage } from "./safeLocalStorage";

export const ENTITY_TOKEN_PLACEHOLDER_PREFIX = "demo-anon";

export function sanitizeEntityToken(token?: string | null): string | null {
  if (!token) return null;
  const trimmed = token.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase().startsWith(ENTITY_TOKEN_PLACEHOLDER_PREFIX)) {
    return null;
  }
  return trimmed;
}

export function storeEntityToken(token?: string | null): string | null {
  const sanitized = sanitizeEntityToken(token);
  try {
    if (sanitized) {
      safeLocalStorage.setItem("entityToken", sanitized);
    } else {
      safeLocalStorage.removeItem("entityToken");
    }
  } catch (error) {
    console.warn("[entityToken] Failed to persist entity token", error);
  }
  return sanitized;
}

export function getStoredEntityToken(): string | null {
  try {
    const raw = safeLocalStorage.getItem("entityToken");
    const sanitized = sanitizeEntityToken(raw);
    if (!sanitized && raw) {
      try {
        safeLocalStorage.removeItem("entityToken");
      } catch (cleanupError) {
        console.warn("[entityToken] Failed to remove placeholder entity token", cleanupError);
      }
    }
    return sanitized;
  } catch {
    return null;
  }
}
